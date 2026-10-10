#!/usr/bin/env node
/**
 * npm advisory triage against the committed lockfile.
 *
 *   node scripts/dependency-audit.mjs                 # network: run `npm audit --json`, compare with the recorded dispositions
 *   node scripts/dependency-audit.mjs --write         # network: also rewrite docs/dependency-audit.snapshot.json
 *   node scripts/dependency-audit.mjs --from <file>   # offline: read a saved `npm audit --json` instead of running it
 *   node scripts/dependency-audit.mjs --offline       # offline: check the committed snapshot only (what `npm test` does)
 *
 * The snapshot is the normalised audit of one exact package-lock.json (bound by SHA-256).
 * docs/dependency-audit.dispositions.json is written by a reviewer: every advisory path in the
 * snapshot needs an unexpired exception, and every fix recorded there must still hold in the
 * lockfile. test/dependency-audit.test.mjs runs the same check offline. This reads the registry's
 * advisory database only; it installs nothing and changes no dependency.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LOCK = 'package-lock.json';
export const SNAPSHOT = 'docs/dependency-audit.snapshot.json';
export const DISPOSITIONS = 'docs/dependency-audit.dispositions.json';
export const REFRESH = 'node scripts/dependency-audit.mjs --write';
/** A reviewed exception may not outlive its review by more than this. */
export const MAX_EXCEPTION_DAYS = 120;
const SEVERITY = ['info', 'low', 'moderate', 'high', 'critical'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const sha256 = data => createHash('sha256').update(data).digest('hex');
const readJson = (root, rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const packageName = location => location.slice(location.lastIndexOf('node_modules/') + 'node_modules/'.length);

/** Node resolution inside the lockfile: the nearest node_modules/<name> at or above `from`. */
function resolveLocation(lock, from, name) {
  let base = from;
  for (;;) {
    const candidate = `${base ? `${base}/` : ''}node_modules/${name}`;
    if (lock.packages[candidate]) return candidate;
    if (!base) return null;
    const cut = base.lastIndexOf('/node_modules/');
    base = cut === -1 ? '' : base.slice(0, cut);
  }
}

/** Every chain from a root dependency down to `location`, as "a > b > c" (root omitted), sorted. */
export function dependencyPaths(lock, location) {
  const dependents = new Map();
  for (const [from, meta] of Object.entries(lock.packages))
    for (const name of Object.keys({...meta.dependencies, ...meta.optionalDependencies, ...meta.peerDependencies, ...(from === '' ? meta.devDependencies : {})})) {
      const target = resolveLocation(lock, from, name);
      if (!target) continue;
      if (!dependents.has(target)) dependents.set(target, new Set());
      dependents.get(target).add(from);
    }
  const out = new Set();
  const walk = (at, chain, seen) => {
    if (at === '') { out.add(chain.join(' > ')); return; }
    for (const parent of dependents.get(at) || []) {
      if (seen.has(parent)) continue;
      walk(parent, parent === '' ? chain : [packageName(parent), ...chain], new Set([...seen, parent]));
    }
  };
  walk(location, [packageName(location)], new Set([location]));
  return [...out].sort();
}

/** Reduce `npm audit --json` (auditReportVersion 2) to the facts a reviewer dispositions. */
export function normalizeAudit(audit, lock, lockText) {
  const vulnerabilities = audit.vulnerabilities || {};
  const rootAdvisories = (name, seen = new Set()) => {
    if (seen.has(name) || !vulnerabilities[name]) return [];
    seen.add(name);
    return vulnerabilities[name].via.flatMap(via => typeof via === 'string' ? rootAdvisories(via, seen) : [via]);
  };
  const findings = Object.values(vulnerabilities).map(entry => {
    const advisories = new Map();
    for (const via of rootAdvisories(entry.name)) {
      const id = /GHSA-[0-9a-z-]+/.exec(via.url || '')?.[0] || `npm-${via.source}`;
      advisories.set(id, {id, package: via.name, severity: via.severity, vulnerableRange: via.range, title: via.title, url: via.url});
    }
    return {
      package: entry.name,
      severity: entry.severity,
      direct: entry.isDirect === true,
      affectedRange: entry.range,
      via: entry.via.map(via => typeof via === 'string' ? via : via.name).filter((name, index, all) => all.indexOf(name) === index).sort(),
      advisories: [...advisories.values()].sort((a, b) => a.id.localeCompare(b.id)),
      installed: [...entry.nodes].sort().map(location => ({
        location,
        version: lock.packages[location]?.version ?? null,
        scope: lock.packages[location]?.dev ? 'dev' : lock.packages[location]?.optional ? 'optional' : 'production',
        paths: lock.packages[location] ? dependencyPaths(lock, location) : [],
      })),
      fixAvailable: entry.fixAvailable === true ? 'compatible' : entry.fixAvailable
        ? `${entry.fixAvailable.name}@${entry.fixAvailable.version}${entry.fixAvailable.isSemVerMajor ? ' (outside the declared range)' : ''}` : 'none',
    };
  }).sort((a, b) => a.package.localeCompare(b.package));
  const counts = Object.fromEntries(SEVERITY.map(level => [level, findings.filter(row => row.severity === level).length]));
  return {lockSha256: sha256(lockText), counts, findings};
}

function versionAtLeast(version, minimum) {
  const parse = text => /^(\d+)\.(\d+)\.(\d+)$/.exec(text)?.slice(1).map(Number);
  const a = parse(version), b = parse(minimum);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}

/**
 * @returns {string[]} problems; empty when every advisory path is dispositioned and nothing is stale.
 */
export function checkDispositions({snapshot, dispositions, lock, lockText, today}) {
  const problems = [];
  if (snapshot.lockSha256 !== sha256(lockText))
    problems.push(`${SNAPSHOT} was taken for a different ${LOCK}; re-audit with: ${REFRESH}`);
  if (!DAY.test(snapshot.auditedOn || '')) problems.push(`${SNAPSHOT}: auditedOn must be YYYY-MM-DD`);
  const exceptions = dispositions.exceptions || [], fixes = dispositions.fixes || [];
  const used = new Set();
  for (const finding of snapshot.findings) {
    if (!finding.advisories.length) problems.push(`${finding.package}: ${finding.severity} finding names no advisory`);
    for (const advisory of finding.advisories) {
      const label = `${finding.severity} ${advisory.id} via ${finding.package}`;
      const match = exceptions.find(item => item.advisory === advisory.id);
      if (!match) { problems.push(`Unrecorded advisory: ${label}. Fix it or record a reviewed exception in ${DISPOSITIONS}.`); continue; }
      used.add(match);
      if (!match.packages?.includes(finding.package)) problems.push(`Unrecorded advisory path: ${label} is not among the packages reviewed for ${advisory.id}`);
      for (const installed of finding.installed) {
        if (installed.scope !== 'dev' && match.scope === 'dev')
          problems.push(`${label}: ${installed.location} is a ${installed.scope} dependency, but the exception was reviewed as dev-only`);
        for (const chain of installed.paths)
          if (!match.paths?.includes(chain)) problems.push(`Unrecorded advisory path: ${label} reaches the tree through "${chain}"`);
      }
      const order = SEVERITY.indexOf(advisory.severity);
      if (order > SEVERITY.indexOf(match.severity)) problems.push(`${label}: severity rose from the reviewed ${match.severity} to ${advisory.severity}`);
    }
  }
  for (const item of exceptions) {
    const label = `exception ${item.advisory}`;
    if (!used.has(item)) problems.push(`${DISPOSITIONS}: stale ${label}; the snapshot no longer reports it`);
    for (const field of ['reachability', 'justification', 'removeWhen', 'reviewedBy'])
      if (typeof item[field] !== 'string' || item[field].trim().length < 3) problems.push(`${label}: missing ${field}`);
    if (!DAY.test(item.reviewedOn || '') || !DAY.test(item.reviewBy || '')) { problems.push(`${label}: reviewedOn and reviewBy must be YYYY-MM-DD`); continue; }
    const days = (Date.parse(item.reviewBy) - Date.parse(item.reviewedOn)) / 86400000;
    if (!(days > 0 && days <= MAX_EXCEPTION_DAYS)) problems.push(`${label}: reviewBy must fall within ${MAX_EXCEPTION_DAYS} days after reviewedOn`);
    if (today > item.reviewBy) problems.push(`${label} expired on ${item.reviewBy}; re-audit (${REFRESH}) and re-review or fix it`);
  }
  for (const fix of fixes) {
    const locations = Object.keys(lock.packages).filter(location => location.startsWith('node_modules/') && packageName(location) === fix.package);
    for (const location of locations)
      if (!versionAtLeast(lock.packages[location].version, fix.fixedIn))
        problems.push(`fix ${fix.advisory} regressed: ${location} is ${lock.packages[location].version}, below ${fix.fixedIn}`);
    if (snapshot.findings.some(finding => finding.advisories.some(advisory => advisory.id === fix.advisory)))
      problems.push(`fix ${fix.advisory}: the snapshot still reports the advisory`);
  }
  return problems;
}

export function loadAndCheck(root = ROOT, today = new Date().toISOString().slice(0, 10)) {
  const lockText = fs.readFileSync(path.join(root, LOCK), 'utf8');
  return checkDispositions({snapshot: readJson(root, SNAPSHOT), dispositions: readJson(root, DISPOSITIONS), lock: JSON.parse(lockText), lockText, today});
}

function runNpmAudit(root) {
  // npm exits 1 when it finds anything; the JSON report on stdout is the result either way.
  const result = spawnSync('npm', ['audit', '--json', '--package-lock-only'], {cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  if (result.error) throw result.error;
  let report;
  try { report = JSON.parse(result.stdout); } catch { throw new Error(`npm audit returned no JSON report:\n${result.stderr || result.stdout}`); }
  if (report.error) throw new Error(`npm audit failed: ${report.error.summary || JSON.stringify(report.error)}`);
  return report;
}

function main(argv) {
  const known = ['--write', '--offline', '--from'];
  const flags = argv.filter(arg => arg.startsWith('--'));
  const from = argv.includes('--from') ? argv[argv.indexOf('--from') + 1] : null;
  if (flags.some(flag => !known.includes(flag)) || (argv.includes('--from') && !from)) {
    console.error('Usage: node scripts/dependency-audit.mjs [--write] [--offline | --from <npm-audit.json>]');
    return 2;
  }
  const today = new Date().toISOString().slice(0, 10);
  const lockText = fs.readFileSync(path.join(ROOT, LOCK), 'utf8');
  const lock = JSON.parse(lockText);
  let snapshot;
  if (argv.includes('--offline')) snapshot = readJson(ROOT, SNAPSHOT);
  else {
    const report = from ? JSON.parse(fs.readFileSync(from, 'utf8')) : runNpmAudit(ROOT);
    snapshot = {
      description: `Normalised \`npm audit --json\` for the ${LOCK} with this SHA-256. Regenerate with: ${REFRESH}. Dispositions live in ${DISPOSITIONS}.`,
      auditedOn: today,
      ...normalizeAudit(report, lock, lockText),
    };
    if (argv.includes('--write')) {
      fs.writeFileSync(path.join(ROOT, SNAPSHOT), `${JSON.stringify(snapshot, null, 2)}\n`);
      console.log(`Wrote ${SNAPSHOT}`);
    }
  }
  for (const finding of snapshot.findings)
    for (const installed of finding.installed)
      console.log(`${finding.severity.padEnd(8)} ${finding.package}@${installed.version} [${installed.scope}] ${finding.advisories.map(row => row.id).join(',')} :: ${installed.paths.join(' | ')}`);
  console.log(`Findings: ${SEVERITY.filter(level => snapshot.counts[level]).map(level => `${snapshot.counts[level]} ${level}`).join(', ') || 'none'} (${LOCK} sha256 ${snapshot.lockSha256.slice(0, 12)})`);
  const problems = checkDispositions({snapshot, dispositions: readJson(ROOT, DISPOSITIONS), lock, lockText, today});
  for (const problem of problems) console.error(`FAIL ${problem}`);
  if (!problems.length) console.log('PASS every advisory path has an unexpired reviewed disposition.');
  return problems.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
