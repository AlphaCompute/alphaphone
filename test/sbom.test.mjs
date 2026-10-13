// The release SBOM is built offline from committed pins and must be reproducible.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {BUN_ENTRY, ROOT, VOICE_HOST, collectNotices, loadTemplates, productionLockPackages, runtimeEntries} from '../scripts/generate-licenses.mjs';
import {GRADLE_VERIFICATION, LICENCE_NOT_RECORDED, buildSbom, gradleArtifactHash, gradleVerificationHashes, integrityHash, renderSbom} from '../scripts/generate-sbom.mjs';
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

test('fonts and OCR cores carry the hashes of the pinned bytes, and no web speech files ship', () => {
  const denton = byRef.get('font:apps/app/public/denton-300.woff2');
  assert.deepEqual(denton.hashes, [{alg: 'SHA-256', content: read('licenses/font-licenses.json').entries.find(entry => entry.name === 'Denton typeface').sha256[0]}]);
  // Proprietary, recorded on the owner's statement: never an open-source identifier, and flagged so nobody assumes it is redistributable.
  assert.deepEqual(denton.licenses, [{license: {name: 'LicenseRef-Commercial-Font'}}]);
  assert.deepEqual([prop(denton, 'licence-expression'), prop(denton, 'licence-flags')], ['LicenseRef-Commercial-Font', 'proprietary-licence-held-outside-repo']);
  assert.equal(prop(denton, 'open-source'), 'false');
  assert.equal(prop(denton, 'licence-evidence'), 'held-outside-repository: owner statement recorded in licenses/font-licenses.json; the licence document is not in this repository');
  const fraunces = sbom.components.filter(component => component.name.startsWith('Fraunces typeface'));
  assert.equal(fraunces.length, 2);
  for (const font of fraunces) {
    assert.deepEqual(font.licenses, [{license: {id: 'OFL-1.1'}}]);
    assert.deepEqual([prop(font, 'licence-expression'), prop(font, 'licence-flags')], ['OFL-1.1', 'none']);
    assert.equal(font.hashes[0].content, createHash('sha256').update(fs.readFileSync(path.join(ROOT, prop(font, 'source')))).digest('hex'));
  }
  for (const [file, digest] of Object.entries(read('licenses/tesseract-core/sources.json').cores)) assert.equal(byRef.get(`ocr-core:${file}`).hashes[0].content, digest);
  // The web build ships no speech model or inference runtime: local speech runs on the agent's libelizainference.
  assert.deepEqual(sbom.components.filter(component => /^browser-speech/.test(component['bom-ref']) || prop(component, 'ships-in') === 'web').map(component => component['bom-ref']), []);
});

test('Android coordinates, the voice host and the upstream pin match their records', () => {
  const classpath = read('licenses/android-runtime-classpath.json');
  const maven = sbom.components.filter(component => component.purl?.startsWith('pkg:maven/'));
  assert.deepEqual(maven.map(component => `${component.group}:${component.name}:${component.version}`).sort(), [...classpath.coordinates].sort());
  // Every Gradle component carries the SHA-256 Gradle dependency verification enforces.
  const verified = gradleVerificationHashes(fs.readFileSync(path.join(ROOT, GRADLE_VERIFICATION), 'utf8'));
  assert.equal(maven.length, 71);
  for (const component of maven) {
    const coordinate = `${component.group}:${component.name}:${component.version}`;
    assert.equal(component.hashes?.length, 1, coordinate);
    assert.equal(component.hashes[0].alg, 'SHA-256');
    assert.match(component.hashes[0].content, /^[0-9a-f]{64}$/);
    const [artifact] = prop(component, 'hash-of').split(' ');
    assert.ok(verified.get(coordinate).some(row => row.artifact === artifact && row.sha256 === component.hashes[0].content), coordinate);
  }
  // Speech is the libelizainference voice host only (fixture coverage: test/voice-host-record.test.mjs).
  const banned = new RegExp(['on' + 'nx', 'sher' + 'pa', 'k2' + 'fsa', 'ort-' + 'wasm'].join('|'), 'i');
  assert.deepEqual(sbom.components.filter(component => banned.test(JSON.stringify(component))).map(component => component['bom-ref']), []);
  if (fs.existsSync(path.join(ROOT, VOICE_HOST))) {
    const record = read(VOICE_HOST);
    for (const abi of record.abis) for (const library of abi.libraries) assert.equal(byRef.get(`voice-host:${abi.abi}/${library.name}`).hashes[0].content, library.sha256);
    // Open rows (sha256 null) are not pinned, so they are not components.
    for (const model of record.models) {
      if (model.sha256 === null) assert.equal(byRef.has(`voice-model:${model.role}/${model.name}`), false, model.name);
      else assert.equal(byRef.get(`voice-model:${model.role}/${model.name}`).hashes[0].content, model.sha256);
    }
    if (record.lexicon?.sha256) assert.equal(byRef.get(`voice-lexicon:${record.lexicon.path}`).hashes[0].content, record.lexicon.sha256);
  } else assert.deepEqual(sbom.components.filter(component => /^voice-(host|model):/.test(component['bom-ref'])), []);
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
  // (Voice-host libraries are such components; test/voice-host-record.test.mjs covers them with a fixture record.)
  const unrecorded = sbom.components.filter(component => prop(component, 'licence-expression') === LICENCE_NOT_RECORDED);
  for (const component of unrecorded) assert.equal(prop(component, 'licence-flags'), 'unverified', component['bom-ref']);
  // Flags never fail the SBOM: the script exits 0 and prints them as warnings.
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-sbom-')), 'sbom.json');
  const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts/generate-sbom.mjs'), '--out', out], {cwd: ROOT, encoding: 'utf8'});
  fs.rmSync(path.dirname(out), {recursive: true, force: true});
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /^LICENCE FLAG copyleft-weak: mediabunny@[^ ]+ \(MPL-2\.0\)$/m);
  assert.match(run.stderr, /^LICENCE FLAG proprietary-licence-held-outside-repo: Denton typeface /m);
});

test('Gradle hashes come from verification metadata, and a coordinate without one fails generation', t => {
  const xml = `<components>
      <component group="androidx.core" name="core" version="1.0.0">
         <artifact name="core-1.0.0.aar"><sha256 value="${'a'.repeat(64)}" origin="Generated by Gradle"/></artifact>
         <artifact name="core-1.0.0.module"><sha256 value="${'b'.repeat(64)}" origin="Generated by Gradle"/></artifact>
      </component>
      <component group="androidx.collection" name="collection" version="1.4.2">
         <artifact name="collection-1.4.2.module"><sha256 value="${'c'.repeat(64)}" origin="Generated by Gradle"/></artifact>
      </component></components>`;
  const hashes = gradleVerificationHashes(xml);
  assert.deepEqual(gradleArtifactHash('androidx.core:core:1.0.0', hashes.get('androidx.core:core:1.0.0')), {artifact: 'core-1.0.0.aar', sha256: 'a'.repeat(64)});
  assert.deepEqual(gradleArtifactHash('androidx.collection:collection:1.4.2', hashes.get('androidx.collection:collection:1.4.2')),
    {artifact: 'collection-1.4.2.module', sha256: 'c'.repeat(64)}, 'a multiplatform root is hashed by its module metadata');
  assert.equal(gradleArtifactHash('androidx.missing:missing:1.0.0', hashes.get('androidx.missing:missing:1.0.0')), null);
  assert.deepEqual(gradleArtifactHash('g:lib:2.0', [{artifact: 'lib-2.0-sources.jar', sha256: 'd'.repeat(64)}, {artifact: 'lib-2.0.pom', sha256: 'e'.repeat(64)}]),
    {artifact: 'lib-2.0.pom', sha256: 'e'.repeat(64)}, 'a sources jar never stands for the runtime artifact');
  // A copy of the repository whose metadata lost one runtime coordinate refuses to write an SBOM.
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-sbom-gradle-'));
  t.after(() => fs.rmSync(copy, {recursive: true, force: true}));
  const [dropped] = read('licenses/android-runtime-classpath.json').coordinates;
  const [group, name, version] = dropped.split(':');
  const original = fs.readFileSync(path.join(ROOT, GRADLE_VERIFICATION), 'utf8');
  const trimmed = original.replace(new RegExp(`<component group="${group}" name="${name}" version="${version}">[\\s\\S]*?</component>`), '');
  assert.notEqual(trimmed, original);
  for (const entry of fs.readdirSync(ROOT)) if (entry !== 'android') fs.symlinkSync(path.join(ROOT, entry), path.join(copy, entry));
  fs.mkdirSync(path.join(copy, 'android/gradle'), {recursive: true});
  for (const entry of fs.readdirSync(path.join(ROOT, 'android'))) if (entry !== 'gradle') fs.symlinkSync(path.join(ROOT, 'android', entry), path.join(copy, 'android', entry));
  fs.writeFileSync(path.join(copy, GRADLE_VERIFICATION), trimmed);
  assert.throws(() => buildSbom(copy), new RegExp(`records no SHA-256 for ${dropped.replace(/\./g, '\\.')}`));
  fs.rmSync(path.join(copy, GRADLE_VERIFICATION));
  assert.throws(() => buildSbom(copy), /verification-metadata\.xml is missing/);
});

/** A staged resident runtime: Bun and the musl loader per ABI, PGlite, an agent bundle and a workflow worker. */
function stagedRuntime(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-sbom-runtime-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const main = path.join(dir, 'android/app/src/main'), agent = path.join(main, 'assets/agent'), source = path.join(dir, 'source');
  const write = (file, text) => { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, text); };
  write(path.join(agent, 'agent-bundle.js'), ['// @bun', '// ../../node_modules/.bun/zod@4.1.0/node_modules/zod/index.js', '// ../../node_modules/hoisted/lib/index.js', '// ../../packages/core/src/index.ts'].join('\n'));
  write(path.join(source, 'node_modules/.bun/zod@4.1.0/node_modules/zod/package.json'), JSON.stringify({name: 'zod', version: '4.1.0', license: 'MIT'}));
  write(path.join(source, 'node_modules/.bun/zod@4.1.0/node_modules/zod/LICENSE'), 'zod licence text');
  write(path.join(source, 'node_modules/hoisted/package.json'), JSON.stringify({name: 'hoisted', version: '0.1.0', license: 'Apache-2.0'}));
  write(path.join(agent, 'workflow-worker/dependencies.json'), JSON.stringify([{name: 'effect', version: '4.0.0', license: 'MIT', sourcePath: 'node_modules/effect', notices: ['licenses/1/LICENSE']}]));
  write(path.join(agent, 'workflow-worker/node_modules/effect/package.json'), JSON.stringify({name: 'effect', version: '4.0.0', license: 'MIT'}));
  write(path.join(agent, 'workflow-worker/licenses/1/LICENSE'), 'effect licence text');
  const payload = {
    'assets/agent/agent-bundle.js': null, 'lib/x86_64/libeliza_bun.so': 'bun x86_64', 'lib/arm64-v8a/libeliza_bun.so': 'bun arm64',
    'assets/agent/x86_64/ld-musl-x86_64.so.1': 'musl x86_64', 'assets/agent/arm64-v8a/ld-musl-aarch64.so.1': 'musl arm64',
    'assets/agent/pglite.wasm': 'pglite wasm', 'assets/agent/pglite.data': 'pglite data',
  };
  const files = Object.entries(payload).map(([rel, text]) => {
    const file = path.join(main, rel.startsWith('lib/') ? `jniLibs/${rel.slice(4)}` : rel);
    if (text !== null) write(file, text);
    const bytes = fs.readFileSync(file);
    return {path: rel, size_bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), source: {}};
  });
  write(path.join(agent, 'android-agent-runtime-provenance.json'), JSON.stringify({schema: 'eliza.android_agent_runtime_provenance.v1',
    bun: {version: '1.4.2', revision: 'b'.repeat(40), architectures: ['x86_64', 'arm64-v8a']}, files}));
  return {agent, source, main, files};
}

test('--packaged-runtime lists every runtime notice entry and every staged payload file with its hash', t => {
  const {agent, source, main, files} = stagedRuntime(t);
  const packaged = buildSbom(ROOT, {packagedRuntime: true, agentDir: agent, sourceDir: source});
  const refs = new Map(packaged.components.map(component => [component['bom-ref'], component]));
  // One component per runtime notice entry of generate-licenses --packaged-runtime.
  const notices = runtimeEntries(ROOT, loadTemplates(ROOT), [], {agentDir: agent, sourceDir: source});
  assert.deepEqual(notices.map(entry => entry.name).sort(), [BUN_ENTRY, 'effect', 'hoisted', 'zod'].sort());
  assert.equal(packaged.components.filter(component => /^runtime:(bun|pkg:)/.test(component['bom-ref'])).length, notices.length);
  const bun = refs.get('runtime:bun');
  assert.match(bun.version, /^1\.4\.2 \(oven-sh\/bun b{40}\)$/);
  for (const abi of ['x86_64', 'arm64-v8a'])
    assert.equal(prop(bun, `file-sha256:lib/${abi}/libeliza_bun.so`), files.find(file => file.path === `lib/${abi}/libeliza_bun.so`).sha256);
  assert.equal(prop(bun, 'licence-flags'), 'copyleft-weak,unverified');
  const zod = refs.get('runtime:pkg:npm/zod@4.1.0');
  assert.equal(zod.version, '4.1.0');
  assert.equal(prop(zod, 'bundled-in-sha256:assets/agent/agent-bundle.js'), files.find(file => file.path === 'assets/agent/agent-bundle.js').sha256);
  const effect = refs.get('runtime:pkg:npm/effect@4.0.0');
  assert.equal(prop(effect, 'staged-package-json-sha256:assets/agent/workflow-worker/node_modules/effect/package.json'),
    createHash('sha256').update(fs.readFileSync(path.join(agent, 'workflow-worker/node_modules/effect/package.json'))).digest('hex'));
  assert.ok(refs.get('runtime:pkg:npm/hoisted@0.1.0'));
  // Every staged file, including the musl loaders and PGlite, with the hash of its staged bytes.
  for (const file of files) assert.deepEqual(refs.get(`runtime-file:${file.path}`)?.hashes, [{alg: 'SHA-256', content: file.sha256}], file.path);
  assert.equal(prop(refs.get('runtime-file:assets/agent/x86_64/ld-musl-x86_64.so.1'), 'role'), 'musl loader');
  assert.equal(prop(refs.get('runtime-file:assets/agent/pglite.wasm'), 'role'), 'PGlite');
  // With the mode the runtime is covered; without it, it is named as not covered.
  assert.equal(prop(packaged.metadata, 'not-covered'), undefined);
  assert.match(prop(packaged.metadata, 'resident-runtime'), /staged payload, not the bytes of a built APK/);
  assert.match(prop(sbom.metadata, 'not-covered'), /resident runtime payload/);
  assert.equal(packaged.components.length, sbom.components.length + notices.length + files.length);
  // A staged file that drifted from its provenance fails, as does a missing runtime.
  fs.writeFileSync(path.join(main, 'jniLibs/x86_64/libeliza_bun.so'), 'tampered');
  assert.throws(() => buildSbom(ROOT, {packagedRuntime: true, agentDir: agent, sourceDir: source}), /lib\/x86_64\/libeliza_bun\.so: staged bytes [0-9a-f]{64} differ from the runtime provenance/);
  assert.throws(() => buildSbom(ROOT, {packagedRuntime: true, agentDir: path.join(main, 'assets/none'), sourceDir: source}), /--packaged-runtime needs a staged runtime/);
});
