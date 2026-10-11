// MVP-43: the Denton typeface has no recorded embedding licence (owner decision A-21).
// It is proprietary, so the open-source licence policy (P-09) does not cover it. It stays listed and
// flagged proprietary-no-licence-recorded, and keeps the one separately named check
// unresolved-font-licence. Whether that check withholds `distributable` is the single constant
// UNRESOLVED_FONT_LICENCE_BLOCKS_DISTRIBUTION; both settings are exercised here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ALLOWLIST, COMMERCIAL_FONT, FONT_LICENSES, NO_FONT_LICENCE, ROOT, UNVERIFIED, collectNotices, fontLicense, fontNames, sha256} from '../scripts/generate-licenses.mjs';
import {FONT_BLOCKER, FONT_BLOCKER_REFERENCE, FONT_FLAG, fontLicenceCheck, fontLicenceLine, fontLicenseBlockers, readUnverifiedFontHashes} from '../scripts/font-license-blockers.mjs';
import {UNRESOLVED_FONT_LICENCE_BLOCKS_DISTRIBUTION} from '../scripts/licence-policy.mjs';
import {releaseBlockers} from '../scripts/release-blockers.mjs';

const DENTON = 'apps/app/public/denton-300.woff2';
const dentonBytes = fs.readFileSync(path.join(ROOT, DENTON));
const dentonSha = sha256(dentonBytes);
const committedNotices = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/app/public/licenses/third-party-notices.json'), 'utf8'));

function payload(t, {notices, files = {}}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-font-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  fs.mkdirSync(path.join(dir, 'licenses'));
  if (notices) fs.writeFileSync(path.join(dir, 'licenses/third-party-notices.json'), JSON.stringify(notices));
  for (const [name, bytes] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), {recursive: true});
    fs.writeFileSync(path.join(dir, name), bytes);
  }
  return dir;
}

test('Denton stays listed, flagged proprietary and described plainly; it is never presented as open source', () => {
  const denton = committedNotices.find(entry => entry.name === 'Denton typeface');
  assert.equal(denton.license, NO_FONT_LICENCE);
  assert.deepEqual(denton.flags, [FONT_FLAG]);
  assert.equal(FONT_FLAG, 'proprietary-no-licence-recorded');
  assert.match(denton.text, /All rights reserved/i);
  assert.match(denton.obligations[0].note, /proprietary item, not open-source software, and no licence to embed or redistribute it is recorded/);
  assert.match(denton.obligations[0].note, /open-source licence policy does not cover it/);
  assert.ok(denton.source.includes(`denton-300.woff2 (sha256 ${dentonSha})`));
  assert.ok(fs.existsSync(path.join(ROOT, DENTON)), 'the font is not removed');
  const text = fs.readFileSync(path.join(ROOT, 'apps/app/public/licenses/THIRD_PARTY_NOTICES.txt'), 'utf8');
  assert.match(text.split('='.repeat(78))[0], /proprietary-no-licence-recorded \(1\):\n  - Denton typeface@/);
  // No other entry of the committed notices is a font-check item.
  assert.deepEqual(committedNotices.filter(entry => entry.flags.includes(FONT_FLAG)).map(entry => entry.name), ['Denton typeface']);
});

test('the one constant decides whether unresolved-font-licence withholds distribution: both settings', t => {
  assert.equal(UNRESOLVED_FONT_LICENCE_BLOCKS_DISTRIBUTION, true, 'default keeps the behaviour before P-09 for Denton only; changing it is the owner\'s decision (A-21)');
  const dir = payload(t, {notices: committedNotices, files: {'denton-300.woff2': dentonBytes}});
  const message = fontLicenseBlockers(dir)[0].message;
  const row = {mode: 'release', distributable: true, testMocks: false, bundleAudit: 'passed', signed: true, runtime: 'PACKAGED', runtimeNotices: true,
    releaseAdmission: {failures: [], blockers: [], signerMatches: true}, speechQualification: {byteMatch: true, functionalPassed: true, qualified: true}, licenceFlags: []};
  // What verify-apks computes for `distributable`, with the same inputs it uses.
  const distributable = check => check.blockers.length === 0;

  // true: recorded, printed as a release blocker, withholds distributable, blocks every gate.
  const blocking = fontLicenceCheck(dir, {blocksDistribution: true});
  assert.deepEqual(blocking, {check: FONT_BLOCKER, flag: FONT_FLAG, blocksDistribution: true, items: [message], blockers: [message]});
  assert.equal(distributable(blocking), false);
  assert.deepEqual(releaseBlockers({...row, licenceBlockers: blocking.blockers}, {fontLicenceBlocks: true}), [message]);
  assert.equal(fontLicenceLine(message, true), `RELEASE BLOCKER ${message}`);

  // false: still run, still recorded as a flagged item, printed as a warning, and nothing is withheld or blocked.
  const reporting = fontLicenceCheck(dir, {blocksDistribution: false});
  assert.deepEqual(reporting, {check: FONT_BLOCKER, flag: FONT_FLAG, blocksDistribution: false, items: [message], blockers: []});
  assert.equal(distributable(reporting), true);
  assert.deepEqual(releaseBlockers({...row, licenceBlockers: reporting.blockers}, {fontLicenceBlocks: false}), []);
  // A row recorded while the check blocked is not a blocker once the constant is false, and the reverse holds.
  assert.deepEqual(releaseBlockers({...row, licenceBlockers: [message]}, {fontLicenceBlocks: false}), []);
  assert.deepEqual(releaseBlockers({...row, licenceBlockers: [message]}, {fontLicenceBlocks: true}), [message]);
  assert.equal(fontLicenceLine(message, false), `LICENCE FLAG (reported, not blocking) ${message}`);
  // Either way the check must have been run and recorded.
  for (const fontLicenceBlocks of [true, false]) assert.deepEqual(releaseBlockers({...row, licenceBlockers: undefined}, {fontLicenceBlocks}), ['font licence check was not recorded']);

  // The defaults follow the constant, and a payload without the font reports nothing under either setting.
  assert.equal(fontLicenceCheck(dir).blocksDistribution, UNRESOLVED_FONT_LICENCE_BLOCKS_DISTRIBUTION);
  assert.deepEqual(releaseBlockers({...row, licenceBlockers: [message]}), UNRESOLVED_FONT_LICENCE_BLOCKS_DISTRIBUTION ? [message] : []);
  const clean = payload(t, {notices: committedNotices.filter(entry => entry.name !== 'Denton typeface'), files: {'other.woff2': Buffer.from('other')}});
  for (const blocksDistribution of [true, false]) assert.deepEqual(fontLicenceCheck(clean, {blocksDistribution}).items, []);
});

test('the shipped public directory reports Denton as the one named font check item', () => {
  assert.deepEqual(readUnverifiedFontHashes(), [{name: 'Denton typeface', sha256: dentonSha}]);
  const blockers = fontLicenseBlockers(path.join(ROOT, 'apps/app/public'));
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].blocker, FONT_BLOCKER);
  assert.equal(blockers[0].name, 'Denton typeface');
  assert.deepEqual(blockers[0].files, ['denton-300.woff2']);
  assert.match(blockers[0].message, /^unresolved-font-licence: Denton typeface \(denton-300\.woff2\) has no recorded embedding licence; .*owner decision A-21/);
  const [doc, anchor] = FONT_BLOCKER_REFERENCE.split('#');
  const heading = fs.readFileSync(path.join(ROOT, doc), 'utf8').split('\n').find(line => line.startsWith('## ') && line.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/ /g, '-') === anchor);
  assert.ok(heading, `${doc} has the section the blocker points at`);
});

test('the blocker follows the packaged bytes and notices, and clears for either owner choice', t => {
  const denton = committedNotices.find(entry => entry.name === 'Denton typeface');
  assert.equal(denton.license, NO_FONT_LICENCE);
  const others = committedNotices.filter(entry => entry !== denton);
  // Notices flag it; a payload built before P-09 marked it "license unverified" and is still caught.
  assert.equal(fontLicenseBlockers(payload(t, {notices: committedNotices, files: {'denton-300.woff2': dentonBytes}})).length, 1);
  for (const legacy of [{name: denton.name, version: denton.version, license: UNVERIFIED, source: denton.source, text: denton.text}, {...denton, flags: [], license: NO_FONT_LICENCE}])
    assert.deepEqual(fontLicenseBlockers(payload(t, {notices: [...others, legacy]}), {unverifiedFonts: []}).map(row => row.files), [['denton-300.woff2']]);
  // Stale or missing notices cannot hide the bytes, wherever the file sits.
  for (const notices of [others, null]) {
    const [blocker] = fontLicenseBlockers(payload(t, {notices, files: {'assets/renamed.woff2': dentonBytes}}));
    assert.deepEqual([blocker.name, blocker.files], ['Denton typeface', ['assets/renamed.woff2']]);
  }
  // Choice (b): the face is gone from bytes and notices.
  assert.deepEqual(fontLicenseBlockers(payload(t, {notices: others, files: {'fonts/other.woff2': Buffer.from('not denton')}})), []);
  // Choice (a): a recorded licence replaces the unverified marker and the allowlist entry.
  const licensed = [...others, {...denton, license: COMMERCIAL_FONT, flags: [], obligations: undefined}];
  assert.deepEqual(fontLicenseBlockers(payload(t, {notices: licensed, files: {'denton-300.woff2': dentonBytes}}), {unverifiedFonts: []}), []);
  // Other flagged items (models, runtimes, copyleft and text-less packages) are not font check items.
  assert.ok(others.some(entry => entry.license === UNVERIFIED) && others.some(entry => entry.flags.includes('copyleft-strong')));
});

test('the bundle audit prints licence flags and the font check as warnings without failing a developer build', t => {
  const dir = payload(t, {notices: committedNotices, files: {
    'denton-300.woff2': dentonBytes, 'index.html': '<!doctype html>', 'build-flags.json': JSON.stringify({testMocks: false}),
  }});
  const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts/audit-production-bundle.mjs'), dir], {encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^PASS /m);
  assert.match(run.stderr, new RegExp(`^${UNRESOLVED_FONT_LICENCE_BLOCKS_DISTRIBUTION ? 'RELEASE BLOCKER' : 'LICENCE FLAG \\(reported, not blocking\\)'} unresolved-font-licence: Denton typeface \\(denton-300\\.woff2\\)`, 'm'));
  assert.match(run.stderr, /^LICENCE FLAG proprietary-no-licence-recorded: Denton typeface@[^\n]+ \(proprietary, no licence recorded\)$/m);
  assert.match(run.stderr, /^LICENCE FLAG copyleft-strong: pdf\.js standard fonts: Liberation@/m);
  assert.match(run.stderr, /^LICENCE FLAG unverified: Piper LJSpeech medium voice model \(int8\)@/m);
  // Flags are warnings: nothing but the font check is ever called a blocker.
  assert.deepEqual(run.stderr.split('\n').filter(line => line.startsWith('RELEASE BLOCKER') && !line.includes('unresolved-font-licence')), []);
});

test('verify-apks records licence flags and the font check, and only the font check can withhold distributable', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/verify-apks.mjs'), 'utf8');
  // The font check is recorded in full; only its `blockers` (empty while the constant is false) reach `distributable`.
  assert.match(source, /fontCheck = fontLicenceCheck\(payload\.public\);/);
  assert.match(source, /const licenceBlockers = fontCheck\.blockers;/);
  assert.match(source, /fontLicenceCheck: \{ check: fontCheck\.check, flag: fontCheck\.flag, blocksDistribution: fontCheck\.blocksDistribution, items: fontCheck\.items \},/);
  assert.match(source, /row\.speechQualification\.qualified === true &&\n\s+row\.licenceBlockers\.length === 0;/);
  // Flags are recorded per APK and printed; they are not part of the distributable expression or of any failure.
  assert.match(source, /licenceFlags = licenceFlagRecords\(entries\);/);
  assert.match(source, /for \(const line of flagLines\) console\.warn\(line\);/);
  const distributable = /row\.distributable = ([\s\S]*?);\n/.exec(source)[1];
  assert.doesNotMatch(distributable, /licenceFlags/);
  assert.doesNotMatch(source, /problems\.push\([^)]*licence/i);
  assert.doesNotMatch(source, /failures\.push\([^)]*licence/i);
  assert.match(source, /console\.warn\(fontLicenceLine\(item, blocks\)\)/);
});

function scratchRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-font-licenses-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  for (const name of ['node_modules', 'vendor', 'android']) fs.symlinkSync(path.join(ROOT, name), path.join(dir, name));
  fs.mkdirSync(path.join(dir, 'apps/app'), {recursive: true});
  fs.symlinkSync(path.join(ROOT, 'apps/app/public'), path.join(dir, 'apps/app/public'));
  for (const name of ['package.json', 'package-lock.json', 'upstream.lock.json']) fs.copyFileSync(path.join(ROOT, name), path.join(dir, name));
  for (const name of ['licenses', 'config']) fs.cpSync(path.join(ROOT, name), path.join(dir, name), {recursive: true});
  return dir;
}

test('choice (a): a recorded embedding licence is data only, bound to the exact font bytes', t => {
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ROOT, FONT_LICENSES), 'utf8')).entries, [], 'no licence has been recorded; that is the owner\'s step');
  const dir = scratchRoot(t);
  const allowlist = JSON.parse(fs.readFileSync(path.join(dir, ALLOWLIST), 'utf8'));
  const record = {name: 'Denton typeface', sha256: [dentonSha], license: COMMERCIAL_FONT, licensor: 'Example Foundry', licensee: 'Example Licensee',
    scope: 'app embedding and web embedding', evidence: 'licence reference EXAMPLE-1', recordedOn: '2026-10-10'};
  const write = (entries, keepAllowlisted = false) => {
    fs.writeFileSync(path.join(dir, FONT_LICENSES), JSON.stringify({entries}));
    fs.writeFileSync(path.join(dir, ALLOWLIST), JSON.stringify({...allowlist, entries: allowlist.entries.filter(entry => keepAllowlisted || entry.name !== 'Denton typeface')}));
  };
  write([record]);
  const result = collectNotices(dir);
  assert.deepEqual(result.errors, []);
  const entry = result.entries.find(item => item.name === 'Denton typeface');
  assert.equal(entry.license, COMMERCIAL_FONT);
  assert.match(entry.text, /Used under a commercial licence from Example Foundry to Example Licensee\. Scope: app embedding and web embedding\. Evidence: licence reference EXAMPLE-1/);
  assert.deepEqual([entry.flags, entry.obligations], [[], undefined], 'a recorded licence clears the flag');
  // The recorded reason should go in the same change; leaving it is reported, not fatal.
  write([record], true);
  assert.ok(collectNotices(dir).warnings.some(warning => warning.includes('stale entry Denton typeface')));
  assert.deepEqual(collectNotices(dir).errors, []);
  // A record for other bytes, an incomplete record, or a scope without web embedding does not license the face.
  write([{...record, sha256: ['0'.repeat(64)]}]);
  let errors = collectNotices(dir).errors;
  assert.ok(errors.some(error => error.includes(`${FONT_LICENSES}: stale entry Denton typeface`)));
  assert.deepEqual(collectNotices(dir).entries.find(item => item.name === 'Denton typeface').flags, [FONT_FLAG], 'a record for other bytes does not license the face');
  write([{...record, evidence: ''}]);
  assert.ok(collectNotices(dir).errors.some(error => error.includes('is missing evidence')));
  write([{...record, scope: 'app embedding'}]);
  assert.ok(collectNotices(dir).errors.some(error => error.includes('scope must cover app and web embedding')));
  write([{...record, license: 'MIT'}]);
  assert.ok(collectNotices(dir).errors.some(error => error.includes(`must use license ${COMMERCIAL_FONT}`)));
});

test('choice (b): Denton is loaded by one rule, and upright Fraunces is not bundled yet', () => {
  const sources = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), {withFileTypes: true})) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { if (entry.name !== 'fixtures') walk(rel); } else if (/\.(css|html|tsx?|jsx?|mjs)$/.test(entry.name)) sources.push(rel);
    }
  };
  walk('apps/app/src');
  sources.push('apps/app/index.html');
  const text = Object.fromEntries(sources.map(file => [file, fs.readFileSync(path.join(ROOT, file), 'utf8')]));
  const referencing = sources.filter(file => /denton/i.test(text[file])).sort();
  assert.deepEqual(referencing, ['apps/app/src/prototype/prototype.css', 'apps/app/src/prototype/template.html'], 'update docs/dependency-audit.md when Denton is referenced elsewhere');
  const css = text['apps/app/src/prototype/prototype.css'];
  // The only rule that loads the file; removing it (and the file) drops every stack to its next family.
  assert.deepEqual(css.match(/@font-face\{[^}]*Denton[^}]*\}/g), ["@font-face{font-family:'Denton';src:url(/denton-300.woff2) format('woff2');font-weight:100 900;font-style:normal;font-display:swap}"]);
  assert.equal(Object.values(text).join('\n').match(/denton-300\.woff2/g).length, 1, 'no preload or second URL for the file');
  // Every stack that names Denton continues to an open or system face.
  const stacks = Object.values(text).join('\n').match(/font-family:[^;}"]*Denton[^;}"]*/g).map(stack => stack.replace(/['\s]/g, '')).filter(stack => stack !== 'font-family:Denton');
  const shapes = {};
  for (const stack of stacks) shapes[stack] = (shapes[stack] ?? 0) + 1;
  assert.deepEqual(Object.keys(shapes).sort(), ['font-family:Denton,Fraunces,Georgia,serif', 'font-family:Denton,Georgia,serif']);
  assert.equal(shapes['font-family:Denton,Georgia,serif'], 1, 'one sample card skips Fraunces and falls back to Georgia');

  // Fraunces is bundled and OFL-licensed, but only as italics. The upright .serif text would
  // render in Fraunces Italic if Denton were simply removed; the patch must add an upright face.
  const fraunces = [...css.matchAll(/@font-face\s*\{[^}]*font-family:\s*'Fraunces'[^}]*\}/g)].map(match => ({
    style: /font-style:\s*(\w+)/.exec(match[0])[1], weight: /font-weight:\s*(\d+)/.exec(match[0])[1], file: /url\(\/([^)]+)\)/.exec(match[0])[1],
  }));
  assert.deepEqual(fraunces.map(face => `${face.style} ${face.weight}`), ['italic 300', 'italic 400']);
  for (const face of fraunces) {
    const names = fontNames(fs.readFileSync(path.join(ROOT, 'apps/app/public', face.file)));
    assert.equal(names.family, 'Fraunces');
    assert.match(names.fullName, /Italic/);
    assert.equal(fontLicense(names), 'OFL-1.1');
  }
  assert.match(css, /\.serif\{font-family:'Denton','Fraunces',Georgia,serif;font-weight:300;/);
  assert.equal(committedNotices.find(entry => entry.name === 'Fraunces typeface').license, 'OFL-1.1');
  // An OFL upright face is already installed for the patch (declared devDependency).
  const upright = fs.readFileSync(path.join(ROOT, 'node_modules/@fontsource/fraunces/files/fraunces-latin-300-normal.woff2'));
  assert.equal(fontLicense(fontNames(upright)), 'OFL-1.1');
});
