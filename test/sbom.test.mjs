// The release SBOM is built offline from committed pins and must be reproducible.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {ROOT, collectNotices, productionLockPackages} from '../scripts/generate-licenses.mjs';
import {LICENCE_NOT_RECORDED, buildSbom, integrityHash, renderSbom} from '../scripts/generate-sbom.mjs';
import {FLAGS} from '../scripts/licence-policy.mjs';

const sbom = buildSbom(ROOT);
const read = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const lock = read('package-lock.json');
const byRef = new Map(sbom.components.map(component => [component['bom-ref'], component]));
const prop = (component, name) => component.properties.find(item => item.name === `alphaphone:${name}`)?.value;

test('the SBOM is deterministic CycloneDX with no timestamp', () => {
  assert.equal(renderSbom(buildSbom(ROOT)), renderSbom(sbom));
  assert.equal(sbom.bomFormat, 'CycloneDX');
  assert.equal(sbom.specVersion, '1.6');
  assert.match(sbom.serialNumber, /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(sbom.metadata.timestamp, undefined);
  assert.doesNotMatch(renderSbom(sbom), /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'no build time in the document');
  assert.doesNotMatch(renderSbom(sbom), new RegExp(ROOT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'no machine path in the document');
  assert.equal(byRef.size, sbom.components.length, 'component references are unique');
  assert.deepEqual(sbom.components.map(component => component['bom-ref']), [...byRef.keys()].sort((a, b) => a.localeCompare(b)));
  for (const component of sbom.components) {
    assert.ok(component.name && component.type, component['bom-ref']);
    assert.ok(prop(component, 'ships-in') && prop(component, 'source'), `${component['bom-ref']} says where it ships and where the pin lives`);
    for (const hash of component.hashes ?? []) assert.match(hash.content, /^[0-9a-f]+$/);
  }
});

test('every shipped npm package is listed with its lockfile integrity, and no dev package is', () => {
  const shipped = productionLockPackages(lock, ROOT);
  const npm = sbom.components.filter(component => component.purl?.startsWith('pkg:npm/'));
  assert.equal(npm.length, shipped.length);
  for (const pkg of shipped) {
    const component = npm.find(item => prop(item, 'source') === `package-lock.json ${pkg.key}`);
    assert.ok(component, pkg.key);
    assert.equal(component.version, pkg.version);
    assert.deepEqual(component.hashes, [integrityHash(lock.packages[pkg.key].integrity)]);
    assert.equal(component.hashes[0].alg, 'SHA-512');
    assert.equal(component.hashes[0].content.length, 128);
  }
  for (const name of Object.keys(read('package.json').dependencies)) assert.ok(npm.some(component => component.name === name), name);
  for (const name of ['vite', 'typescript', '@capacitor/cli', 'source-map-js', 'uuid']) assert.ok(!npm.some(component => component.name === name), `${name} is build tooling`);
  assert.equal(prop(sbom.metadata, 'package-lock-sha256'), createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'package-lock.json'))).digest('hex'));
});

test('fonts, OCR cores and web speech files carry the hashes of the pinned bytes', () => {
  const denton = byRef.get('font:apps/app/public/denton-300.woff2');
  assert.deepEqual(denton.hashes, [{alg: 'SHA-256', content: read('licenses/unverified-allowlist.json').entries.find(entry => entry.name === 'Denton typeface').sha256}]);
  assert.deepEqual(denton.licenses, [{license: {name: 'proprietary, no licence recorded'}}]);
  assert.deepEqual([prop(denton, 'licence-expression'), prop(denton, 'licence-flags')], ['proprietary, no licence recorded', 'proprietary-no-licence-recorded']);
  const fraunces = sbom.components.filter(component => component.name.startsWith('Fraunces typeface'));
  assert.equal(fraunces.length, 2);
  for (const font of fraunces) {
    assert.deepEqual(font.licenses, [{license: {id: 'OFL-1.1'}}]);
    assert.deepEqual([prop(font, 'licence-expression'), prop(font, 'licence-flags')], ['OFL-1.1', 'none']);
    assert.equal(font.hashes[0].content, createHash('sha256').update(fs.readFileSync(path.join(ROOT, prop(font, 'source')))).digest('hex'));
  }
  for (const [file, digest] of Object.entries(read('licenses/tesseract-core/sources.json').cores)) assert.equal(byRef.get(`ocr-core:${file}`).hashes[0].content, digest);
  const speech = read('config/browser-speech.json');
  for (const file of speech.files) {
    const component = byRef.get(`browser-speech:${file.path}`);
    assert.equal(component.hashes[0].content, file.sha256);
    assert.equal(component.version, speech.source.revision);
    assert.equal(prop(component, 'ships-in'), 'web', 'Android APKs omit the web speech model');
  }
  for (const file of speech.runtime.files) assert.equal(byRef.get(`browser-speech-runtime:${file.path}`).hashes[0].content, file.sha256);
});

test('Android coordinates, speech natives and the upstream pin match their manifests', () => {
  const classpath = read('licenses/android-runtime-classpath.json');
  const maven = sbom.components.filter(component => component.purl?.startsWith('pkg:maven/'));
  assert.deepEqual(maven.map(component => `${component.group}:${component.name}:${component.version}`).sort(), [...classpath.coordinates].sort());
  // Stated, not hidden: these have no hash until Gradle dependency verification is enabled.
  for (const component of maven) {
    assert.equal(component.hashes, undefined);
    assert.match(prop(component, 'hash'), /^not recorded/);
  }
  const manifest = read('android/local-speech/runtime-manifest.json');
  assert.equal(byRef.get('speech:sherpa-onnx-no-espeak.aar').hashes[0].content, manifest.aarSha256);
  for (const abi of manifest.qualifiedAbis)
    for (const native of abi.native) {
      const component = byRef.get(`speech-native:${abi.abi}/${native.file}`);
      assert.equal(component.hashes[0].content, native.sha256);
      assert.equal(prop(component, 'bytes'), String(native.bytes));
    }
  assert.ok(sbom.components.some(component => component.type === 'machine-learning-model' && component['bom-ref'].startsWith('speech-input:')));
  const upstream = read('upstream.lock.json');
  assert.equal(sbom.components.find(component => component.name === 'elizaOS').version, upstream.commit);
  assert.match(prop(sbom.metadata, 'not-covered'), /resident runtime payload/);
  assert.match(prop(sbom.metadata, 'evidence'), /not a scan of built APK/);
});

test('every component carries its licence expression and flags, matching the notices', () => {
  const notices = new Map(collectNotices(ROOT, {packagedRuntime: false}).entries.map(entry => [`${entry.name}@${entry.version}`, entry]));
  for (const component of sbom.components) {
    assert.ok(prop(component, 'licence-expression'), component['bom-ref']);
    const flags = prop(component, 'licence-flags');
    assert.ok(flags === 'none' || flags.split(',').every(flag => FLAGS.includes(flag)), `${component['bom-ref']}: ${flags}`);
  }
  for (const component of sbom.components.filter(item => item.purl?.startsWith('pkg:npm/'))) {
    const notice = notices.get(`${component.name}@${component.version}`);
    assert.equal(prop(component, 'licence-expression'), notice.license, component.name);
    assert.equal(prop(component, 'licence-flags'), notice.flags.join(',') || 'none', component.name);
  }
  const npm = name => sbom.components.find(component => component.purl?.startsWith('pkg:npm/') && component.name === name);
  assert.deepEqual([prop(npm('mediabunny'), 'licence-expression'), prop(npm('mediabunny'), 'licence-flags')], ['MPL-2.0', 'copyleft-weak']);
  assert.equal(prop(npm('tr46'), 'licence-flags'), 'licence-text-missing-from-package');
  assert.deepEqual([prop(npm('react'), 'licence-expression'), prop(npm('react'), 'licence-flags')], ['MIT', 'none']);
  for (const component of sbom.components.filter(item => item.purl?.startsWith('pkg:maven/'))) assert.deepEqual([prop(component, 'licence-expression'), prop(component, 'licence-flags')], ['Apache-2.0', 'none'], component.name);
  // A component whose licence this inventory does not record says so and is flagged, never left blank.
  const unrecorded = sbom.components.filter(component => prop(component, 'licence-expression') === LICENCE_NOT_RECORDED);
  assert.ok(unrecorded.length > 0);
  for (const component of unrecorded) assert.equal(prop(component, 'licence-flags'), 'unverified', component['bom-ref']);
  // Flags never fail the SBOM: the script exits 0 and prints them as warnings.
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-sbom-')), 'sbom.json');
  const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts/generate-sbom.mjs'), '--out', out], {cwd: ROOT, encoding: 'utf8'});
  fs.rmSync(path.dirname(out), {recursive: true, force: true});
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /^LICENCE FLAG copyleft-weak: mediabunny@[^ ]+ \(MPL-2\.0\)$/m);
  assert.match(run.stderr, /^LICENCE FLAG proprietary-no-licence-recorded: Denton typeface /m);
});
