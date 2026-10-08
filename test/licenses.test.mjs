import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ROOT, JSON_OUTPUT, TEXT_OUTPUT, ALLOWLIST, UNVERIFIED, KNOWN_LICENSES,
  generate, collectNotices, productionLockPackages, declarationOnlyPackage, unknownLicenseTerms, fontNames, fontLicense, parseGradleTree,
} from '../scripts/generate-licenses.mjs';

const fresh = generate(ROOT);
const shipped = JSON.parse(fs.readFileSync(path.join(ROOT, JSON_OUTPUT), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));

test('notice generation is complete: no unknown licenses, missing texts or unreviewed unverified items', () => {
  assert.deepEqual(fresh.errors, []);
});

test('checked-in notices are byte-identical to a fresh generation', () => {
  assert.equal(fs.readFileSync(path.join(ROOT, JSON_OUTPUT), 'utf8'), fresh.json, `${JSON_OUTPUT} is stale; run node scripts/generate-licenses.mjs`);
  assert.equal(fs.readFileSync(path.join(ROOT, TEXT_OUTPUT), 'utf8'), fresh.text, `${TEXT_OUTPUT} is stale; run node scripts/generate-licenses.mjs`);
});

test('every entry has exactly {name, version, license, source, text} as non-empty strings', () => {
  for (const entry of shipped) {
    assert.deepEqual(Object.keys(entry), ['name', 'version', 'license', 'source', 'text'], entry.name);
    for (const value of Object.values(entry)) assert.ok(typeof value === 'string' && value.trim(), entry.name);
    assert.deepEqual(unknownLicenseTerms(entry.license), [], `${entry.name}: ${entry.license}`);
  }
});

test('every package-lock production dependency is listed once with its declared license and version', () => {
  const production = productionLockPackages(lock);
  assert.ok(production.length > 40, 'expected the renderer production closure');
  const npmEntries = shipped.filter(entry => entry.source.startsWith('https://registry.npmjs.org/'));
  for (const pkg of production) {
    const matches = shipped.filter(entry => entry.name === pkg.name && entry.version === pkg.version);
    assert.equal(matches.length, 1, `${pkg.name}@${pkg.version} listed ${matches.length} times`);
    assert.equal(matches[0].license, pkg.license, pkg.name);
  }
  // Nothing from npm is listed that is not a lockfile production dependency.
  const productionIds = new Set(production.map(pkg => `${pkg.name}@${pkg.version}`));
  for (const entry of npmEntries) assert.ok(productionIds.has(`${entry.name}@${entry.version}`), `${entry.name}@${entry.version} is not a production dependency`);
  assert.equal(npmEntries.length, production.length);
  // Development-only and optional native packages are excluded.
  for (const [key, meta] of Object.entries(lock.packages)) {
    if (key && (meta.dev || meta.optional)) {
      const name = key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
      assert.ok(!npmEntries.some(entry => entry.name === name && entry.version === meta.version), `${name} must not be listed from npm`);
    }
  }
});

test('declaration-only type packages are not production code, but packages with code are', () => {
  const production = new Set(productionLockPackages(lock).map(pkg => pkg.name));
  for (const name of ['@types/node', 'undici-types']) {
    assert.ok(declarationOnlyPackage(path.join(ROOT, 'node_modules', name)), `${name} holds only declarations`);
    assert.ok(!production.has(name), `${name} ships no code and must not be listed`);
  }
  for (const name of ['react', 'onnxruntime-web', 'protobufjs']) assert.ok(production.has(name), name);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-types-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{}'); fs.writeFileSync(path.join(dir, 'index.d.ts'), 'export {};');
    assert.equal(declarationOnlyPackage(dir), true);
    fs.mkdirSync(path.join(dir, 'lib')); fs.writeFileSync(path.join(dir, 'lib', 'index.js'), 'module.exports = 1;');
    assert.equal(declarationOnlyPackage(dir), false, 'any runtime file makes it a code package');
    assert.equal(declarationOnlyPackage(path.join(dir, 'missing')), false, 'a missing package is reported, never skipped');
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('direct product dependencies, fonts, Android, speech, elizaOS and map data are covered', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const names = new Set(shipped.map(entry => entry.name));
  for (const name of Object.keys(pkg.dependencies)) assert.ok(names.has(name), name);
  for (const name of Object.keys(pkg.devDependencies).filter(name => name.startsWith('@fontsource/'))) assert.ok(names.has(name), name);
  for (const name of ['elizaOS', 'OpenStreetMap data', 'ONNX Runtime', 'Sherpa-ONNX (no-eSpeak Android build)', 'Fraunces typeface', 'Denton typeface',
    'Tesseract English trained data (tessdata 4.0.0_best_int)', 'AndroidX (Android Jetpack) libraries, including CameraX', 'Kotlin standard library'])
    assert.ok(names.has(name), name);
  const androidx = shipped.find(entry => entry.name.startsWith('AndroidX'));
  for (const artifact of ['androidx.camera:camera-core:', 'androidx.webkit:webkit:', 'androidx.work:work-runtime:', 'androidx.appcompat:appcompat:'])
    assert.ok(androidx.version.includes(artifact), artifact);
  const osm = shipped.find(entry => entry.name === 'OpenStreetMap data');
  assert.equal(osm.license, 'ODbL-1.0');
  assert.match(osm.text, /© OpenStreetMap contributors/);
});

test('every shipped font file is accounted for and unverified items carry their review reason', () => {
  const fonts = [];
  const walk = dir => { for (const entry of fs.readdirSync(dir, {withFileTypes: true})) { const p = path.join(dir, entry.name); if (entry.isDirectory()) walk(p); else if (/\.(woff2|ttf|otf)$/.test(entry.name)) fonts.push(path.relative(path.join(ROOT, 'apps/app/public'), p)); } };
  walk(path.join(ROOT, 'apps/app/public'));
  assert.ok(fonts.length >= 6);
  for (const font of fonts) assert.ok(shipped.some(entry => entry.source.includes(font)), font);
  const allowlist = JSON.parse(fs.readFileSync(path.join(ROOT, ALLOWLIST), 'utf8'));
  const unverified = shipped.filter(entry => entry.license === UNVERIFIED);
  assert.equal(unverified.length, allowlist.entries.length);
  for (const entry of unverified) assert.match(entry.text, /^LICENSE UNVERIFIED\. /, entry.name);
  assert.match(fs.readFileSync(path.join(ROOT, TEXT_OUTPUT), 'utf8'), new RegExp(`marked "${UNVERIFIED}": ${unverified.length} \\(pending legal review\\)`));
});

test('libraries statically linked into the shipped OCR WebAssembly cores are listed with pinned texts', () => {
  const pinned = JSON.parse(fs.readFileSync(path.join(ROOT, 'licenses/tesseract-core/sources.json'), 'utf8'));
  for (const name of ['Tesseract OCR engine', 'Leptonica image processing library', 'Independent JPEG Group libjpeg', 'libpng', 'LibTIFF', 'libwebp', 'GIFLIB', 'zlib', 'OpenLibm'])
    assert.ok(pinned.components.some(component => component.name === name), name);
  for (const component of pinned.components) {
    const entry = shipped.find(item => item.name.startsWith(`${component.name} (linked into tesseract.js-core`));
    assert.ok(entry, component.name);
    assert.equal(entry.license, component.license);
  }
  assert.match(shipped.find(item => item.name.startsWith('Independent JPEG Group libjpeg')).text, /^This software is based in part on the work of the Independent JPEG Group\./);
});

test('generation fails when the shipped OCR cores or their pinned license copies change', t => {
  const dir = scratchRoot(t);
  const file = path.join(dir, 'licenses/tesseract-core/sources.json');
  const pinned = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.appendFileSync(path.join(dir, 'licenses/tesseract-core/leptonica-license.txt'), '\nmodified');
  assert.ok(collectNotices(dir).errors.some(error => error.includes('leptonica-license.txt does not match')));
  fs.writeFileSync(file, JSON.stringify({...pinned, version: '0.0.0', cores: {...pinned.cores, 'tesseract-core-lstm.wasm.js': '0'.repeat(64)}}));
  const errors = collectNotices(dir).errors;
  assert.ok(errors.some(error => error.includes('differs from licenses/tesseract-core/sources.json (0.0.0)')));
  assert.ok(errors.some(error => error.includes('tesseract-core-lstm.wasm.js differs from the core pinned')));
});

test('existing mediabunny and OCR/tessdata notices are retained', () => {
  for (const file of ['apps/app/public/licenses/mediabunny/LICENSE.txt', 'apps/app/public/licenses/mediabunny/NOTICE.txt', 'licenses/mediabunny-MPL-2.0.txt', 'licenses/tessdata-APACHE-2.0.txt'])
    assert.ok(fs.statSync(path.join(ROOT, file)).size > 0, file);
});

test('license expressions outside the known set are rejected', () => {
  assert.deepEqual(unknownLicenseTerms('MIT'), []);
  assert.deepEqual(unknownLicenseTerms('(MIT OR Apache-2.0)'), []);
  assert.deepEqual(unknownLicenseTerms('BSD-3-Clause AND Apache-2.0'), []);
  assert.deepEqual(unknownLicenseTerms(UNVERIFIED), []);
  assert.deepEqual(unknownLicenseTerms('GPL-3.0-only'), ['GPL-3.0-only']);
  assert.deepEqual(unknownLicenseTerms('(MIT OR WTFPL)'), ['WTFPL']);
  assert.deepEqual(unknownLicenseTerms('UNLICENSED'), ['UNLICENSED']);
  assert.deepEqual(unknownLicenseTerms(undefined), ['undefined']);
  assert.ok(!KNOWN_LICENSES.has('GPL-2.0-only'));
});

test('font metadata is read from TTF and WOFF2 name tables', () => {
  const denton = fontNames(fs.readFileSync(path.join(ROOT, 'apps/app/public/denton-300.woff2')));
  assert.match(denton.copyright, /PeregrinStudio/);
  assert.equal(fontLicense(denton), UNVERIFIED);
  const fraunces = fontNames(fs.readFileSync(path.join(ROOT, 'apps/app/public/fonts/c3c6d103fb2c49381256.ttf')));
  assert.equal(fraunces.family, 'Fraunces');
  assert.equal(fontLicense(fraunces), 'OFL-1.1');
  const publicSans = fontNames(fs.readFileSync(path.join(ROOT, 'apps/app/public/fonts/3a00a32f0242b723dcea.woff2')));
  assert.match(publicSans.copyright, /Public Sans Project Authors/);
  assert.equal(fontLicense(publicSans), 'OFL-1.1');
  assert.throws(() => fontNames(Buffer.from('not a font file')));
});

test('Gradle dependency trees resolve conflicts and skip constraints and projects', () => {
  const tree = [
    '+--- project :capacitor-android',
    '|    +--- androidx.appcompat:appcompat:1.7.1',
    '|    |    +--- androidx.activity:activity:1.8.0 -> 1.10.1',
    '|    |    \\--- org.jetbrains.kotlin:kotlin-stdlib -> 2.2.20 (*)',
    '|    +--- androidx.lifecycle:lifecycle-livedata:2.6.2 (c)',
    '\\--- androidx.webkit:webkit:1.17.1',
  ].join('\n');
  assert.deepEqual(parseGradleTree(tree), ['androidx.activity:activity:1.10.1', 'androidx.appcompat:appcompat:1.7.1', 'androidx.webkit:webkit:1.17.1', 'org.jetbrains.kotlin:kotlin-stdlib:2.2.20']);
});

function scratchRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-licenses-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  for (const name of ['node_modules', 'vendor', 'android']) fs.symlinkSync(path.join(ROOT, name), path.join(dir, name));
  fs.mkdirSync(path.join(dir, 'apps/app'), {recursive: true});
  fs.symlinkSync(path.join(ROOT, 'apps/app/public'), path.join(dir, 'apps/app/public'));
  for (const name of ['package.json', 'package-lock.json', 'upstream.lock.json']) fs.copyFileSync(path.join(ROOT, name), path.join(dir, name));
  fs.cpSync(path.join(ROOT, 'licenses'), path.join(dir, 'licenses'), {recursive: true});
  return dir;
}

test('generation fails for an unverified font that is not allowlisted, or a stale allowlist entry', t => {
  const dir = scratchRoot(t);
  const file = path.join(dir, ALLOWLIST);
  const allowlist = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({...allowlist, entries: allowlist.entries.filter(entry => entry.name !== 'Denton typeface')}));
  assert.ok(collectNotices(dir).errors.some(error => error.startsWith('Denton typeface') && error.includes(UNVERIFIED)));
  fs.writeFileSync(file, JSON.stringify({...allowlist, entries: [...allowlist.entries, {name: 'Removed font', reason: 'no longer shipped anywhere in the product'}]}));
  assert.ok(collectNotices(dir).errors.some(error => error.includes('stale entry Removed font')));
  // A swapped Denton file (different hash) is not covered by the existing allowlist entry.
  fs.writeFileSync(file, JSON.stringify({...allowlist, entries: allowlist.entries.map(entry => entry.sha256 ? {...entry, sha256: '0'.repeat(64)} : entry)}));
  assert.ok(collectNotices(dir).errors.some(error => error.startsWith('Denton typeface')));
});

test('generation fails for a production dependency with an unknown license', t => {
  const dir = scratchRoot(t);
  const altered = structuredClone(lock);
  altered.packages['node_modules/react'].license = 'SSPL-1.0';
  fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify(altered));
  assert.ok(collectNotices(dir).errors.some(error => error === 'react@19.3.0: unknown license SSPL-1.0'));
});

test('generation fails when pinned speech license copies drift from the upstream reference manifest', t => {
  const dir = scratchRoot(t);
  fs.appendFileSync(path.join(dir, 'licenses/whisper-MIT.txt'), '\nmodified');
  assert.ok(collectNotices(dir).errors.some(error => error.includes('licenses/whisper-MIT.txt does not match')));
});
