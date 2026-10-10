// MVP-43: the Denton typeface has no recorded embedding licence (owner decision A-21).
// These checks keep the release blocker, both exits from it, and the documented patch honest.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ALLOWLIST, COMMERCIAL_FONT, FONT_LICENSES, ROOT, UNVERIFIED, collectNotices, fontLicense, fontNames, sha256} from '../scripts/generate-licenses.mjs';
import {FONT_BLOCKER, FONT_BLOCKER_REFERENCE, fontLicenseBlockers, readUnverifiedFontHashes} from '../scripts/font-license-blockers.mjs';

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

test('the shipped public directory reports Denton as the one named font release blocker', () => {
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
  assert.equal(denton.license, UNVERIFIED);
  const others = committedNotices.filter(entry => entry !== denton);
  // Notices say unverified.
  assert.equal(fontLicenseBlockers(payload(t, {notices: committedNotices, files: {'denton-300.woff2': dentonBytes}})).length, 1);
  // Stale or missing notices cannot hide the bytes, wherever the file sits.
  for (const notices of [others, null]) {
    const [blocker] = fontLicenseBlockers(payload(t, {notices, files: {'assets/renamed.woff2': dentonBytes}}));
    assert.deepEqual([blocker.name, blocker.files], ['Denton typeface', ['assets/renamed.woff2']]);
  }
  // Choice (b): the face is gone from bytes and notices.
  assert.deepEqual(fontLicenseBlockers(payload(t, {notices: others, files: {'fonts/other.woff2': Buffer.from('not denton')}})), []);
  // Choice (a): a recorded licence replaces the unverified marker and the allowlist entry.
  const licensed = [...others, {...denton, license: COMMERCIAL_FONT}];
  assert.deepEqual(fontLicenseBlockers(payload(t, {notices: licensed, files: {'denton-300.woff2': dentonBytes}}), {unverifiedFonts: []}), []);
  // Other unverified items (models, runtimes) are not font blockers.
  assert.ok(others.some(entry => entry.license === UNVERIFIED));
});

test('the bundle audit reports the blocker without failing a developer build', t => {
  const dir = payload(t, {notices: committedNotices, files: {
    'denton-300.woff2': dentonBytes, 'index.html': '<!doctype html>', 'build-flags.json': JSON.stringify({testMocks: false}),
  }});
  const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts/audit-production-bundle.mjs'), dir], {encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^PASS /m);
  assert.match(run.stderr, /^RELEASE BLOCKER unresolved-font-licence: Denton typeface \(denton-300\.woff2\)/m);
});

test('verify-apks records the blocker and withholds distributable without throwing', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/verify-apks.mjs'), 'utf8');
  assert.match(source, /licenceBlockers = fontLicenseBlockers\(payload\.public\)\.map\(row => row\.message\)/);
  assert.match(source, /row\.speechQualification\.qualified === true &&\n\s+row\.licenceBlockers\.length === 0;/);
  assert.match(source, /console\.warn\(`RELEASE BLOCKER \$\{blocker\}`\)/);
  // Reported per row and in the manifest; never added to the per-APK failures that abort verification.
  assert.doesNotMatch(source, /problems\.push\([^)]*licenceBlockers/);
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
  // The allowlist entry must go in the same change.
  write([record], true);
  assert.ok(collectNotices(dir).errors.some(error => error.includes('stale entry Denton typeface')));
  // A record for other bytes, an incomplete record, or a scope without web embedding does not license the face.
  write([{...record, sha256: ['0'.repeat(64)]}]);
  let errors = collectNotices(dir).errors;
  assert.ok(errors.some(error => error.startsWith('Denton typeface') && error.includes(UNVERIFIED)) && errors.some(error => error.includes(`${FONT_LICENSES}: stale entry Denton typeface`)));
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
