// What the strict distribution build needs, which of it a script may produce, and which needs a person.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {BUILD_TOOLCHAIN, HUMAN_ACTION, QUALIFIED_HOST, Stop, compareWithQualified, describeDifference, run, stageReproduced, stagedLibraries} from '../scripts/build-embedding-host.mjs';
import {formatReport, strictBuildInputs} from '../scripts/android-build-preflight.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const sha = text => createHash('sha256').update(text).digest('hex');
const readJson = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

/** A product root with a three-library "reviewed" manifest whose bytes are the library names. */
function fixture(t, {remapBuildPath = false} = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-embedding-step-')));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), {recursive: true}); fs.writeFileSync(path.join(root, rel), text); };
  const names = ['libelizainference.so', 'libelizavoicejni.so', 'libc++_shared.so'];
  const manifest = {abi: 'arm64-v8a', forkPin: 'a'.repeat(40), qualificationReceiptSha256: 'b'.repeat(64),
    model: {path: 'android/app/src/main/assets/agent/models/model.gguf'},
    libraries: names.map(name => ({name, sha256: sha(`reviewed ${name}`), bytes: `reviewed ${name}`.length}))};
  write(QUALIFIED_HOST, JSON.stringify(manifest));
  write(BUILD_TOOLCHAIN, JSON.stringify({ndk: '0.0.0', cmake: '0.0.0', remapBuildPath, remapBuildPathEvidence: 'the reviewed bytes embed an unrecorded build directory'}));
  const stage = (name, text = `reviewed ${name}`) => write(`android/app/src/main/jniLibs/arm64-v8a/${name}`, text);
  return {root, write, names, manifest, stage};
}

test('the embedding host step stages nothing it cannot prove and names the person when no script can produce the bytes', t => {
  const f = fixture(t);
  assert.deepEqual(stagedLibraries(f.root).map(row => row.state), ['missing', 'missing', 'missing']);
  // Reviewed bytes that embed an unrecorded build directory: stop at once, before any fetch or compile.
  assert.throws(() => run(f.root), error => error instanceof Stop && error.code === 3
    && /libelizainference\.so, libelizavoicejni\.so, libc\+\+_shared\.so missing/.test(error.message)
    && /No script can produce them: the reviewed bytes embed an unrecorded build directory/.test(error.message)
    && error.message.includes(HUMAN_ACTION));
  assert.equal(fs.existsSync(path.join(f.root, '.eliza')), false, 'nothing was fetched or built');
  assert.match(HUMAN_ACTION, /^Needs a person: /);
  assert.match(HUMAN_ACTION, /stage-embedding-host\.mjs --receipt/);
  assert.match(HUMAN_ACTION, /qualifiedAt/);
  assert.match(HUMAN_ACTION, /No script may do either\.$/);

  // A library that is not the reviewed bytes is never replaced and never accepted.
  f.stage('libelizainference.so', 'rebuilt elsewhere');
  assert.throws(() => run(f.root), error => error.code === 2 && /libelizainference\.so .* is not the reviewed bytes.*never replaces a staged library/.test(error.message));
  assert.equal(fs.readFileSync(path.join(f.root, 'android/app/src/main/jniLibs/arm64-v8a/libelizainference.so'), 'utf8'), 'rebuilt elsewhere');

  // The reviewed bytes, however they were supplied, pass without building.
  for (const name of f.names) f.stage(name);
  assert.equal(run(f.root), 0);
  assert.equal(run(f.root, {status: true}), 0);
});

test('a rebuild is staged only when every library is byte-identical to the reviewed manifest', t => {
  const f = fixture(t);
  const built = {};
  for (const name of f.names) { built[name] = path.join(f.root, 'out', name); f.write(`out/${name}`, `reviewed ${name}`); }
  f.write('out/libelizainference.so', 'same source, different build directory');
  let comparison = compareWithQualified(f.manifest, built);
  assert.deepEqual(comparison.map(row => row.reproduced), [false, true, true]);
  assert.match(describeDifference(comparison)[0], /^libelizainference\.so: built 38 bytes sha256 [0-9a-f]{64}, reviewed \d+ bytes sha256 [0-9a-f]{64}$/);
  assert.throws(() => stageReproduced(f.root, f.manifest, comparison), /Refusing to stage: the rebuilt embedding host is not the reviewed bytes/);
  assert.deepEqual(stagedLibraries(f.root).map(row => row.state), ['missing', 'missing', 'missing'], 'a partial match stages nothing');
  assert.deepEqual(compareWithQualified(f.manifest, {}).map(row => row.reason), ['not built', 'not built', 'not built']);

  f.write('out/libelizainference.so', 'reviewed libelizainference.so');
  comparison = compareWithQualified(f.manifest, built);
  stageReproduced(f.root, f.manifest, comparison);
  assert.deepEqual(stagedLibraries(f.root).map(row => row.state), ['staged', 'staged', 'staged']);
});

test('the committed embedding host record says its bytes are not reproducible and keeps the candidate apart', () => {
  const host = readJson(QUALIFIED_HOST), toolchain = readJson(BUILD_TOOLCHAIN);
  // Flipping this is the commit that replaces the reviewed libraries; it must not happen by accident.
  assert.equal(toolchain.remapBuildPath, false);
  assert.match(toolchain.remapBuildPathEvidence, /embed the absolute directory/);
  assert.match(toolchain.ndk, /^\d+\.\d+\.\d+$/);
  assert.match(toolchain.engineRepository, /^https:\/\/github\.com\/elizaOS\/llama\.cpp\.git$/);
  const candidate = toolchain.unqualifiedCandidateMeasurement;
  assert.match(candidate.note, /^NOT reviewed, NOT qualified and NOT staged/);
  const reviewed = Object.fromEntries(host.libraries.map(row => [row.name, row.sha256]));
  for (const row of candidate.libraries.filter(item => item.name !== 'libc++_shared.so')) assert.notEqual(row.sha256, reviewed[row.name], `${row.name}: the candidate is not the reviewed bytes`);
  assert.equal(candidate.libraries.find(item => item.name === 'libc++_shared.so').sha256, reviewed['libc++_shared.so'], 'the NDK runtime identifies the toolchain');
  // The libraries are never committed: they are staged bytes checked against the manifest.
  assert.match(fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8'), /^android\/app\/src\/main\/jniLibs\/$/m);
});

test('path remapping is opt-in, recorded in the receipt and leaves the default build unchanged', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/prepare-embedding-host.mjs'), 'utf8');
  assert.match(source, /const remapEnv=remap\?\{CCC_OVERRIDE_OPTIONS:/);
  assert.match(source, /:\{\};\nconst receipt=\{[^\n]*\.\.\.remapEnv\},buildPathRemapped:remap,/);
  assert.match(source, /-ffile-prefix-map=\$\{from\}=\$\{to\}/);
  // An unknown option is still refused before anything is written.
  const output = path.join(os.tmpdir(), `alpha-embed-unknown-${process.pid}`);
  const result = spawnSync(process.execPath, ['scripts/prepare-embedding-host.mjs', '--fork', ROOT, '--output', output, '--remap'], {cwd: ROOT, encoding: 'utf8'});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option/);
  assert.equal(fs.existsSync(output), false);
  const step = fs.readFileSync(path.join(ROOT, 'scripts/build-embedding-host.mjs'), 'utf8');
  assert.doesNotMatch(step, /qualifiedAt\s*[:=]/, 'the step never writes a qualification');
  assert.doesNotMatch(step, /writeFileSync\([^)]*QUALIFIED_HOST/, 'the step never rewrites the reviewed manifest');
});

test('the input report separates what a script produces from what needs a person', t => {
  const f = fixture(t);
  f.write('upstream.lock.json', JSON.stringify({commit: 'c'.repeat(40)}));
  f.write('android/local-speech/runtime-manifest.json', JSON.stringify({aarSha256: sha('local build')}));
  f.write('android/local-speech/qualified-runtime-manifest.json', JSON.stringify({aarSha256: sha('reviewed'), functionalAcceptance: {passed: false, state: 'failed', abis: {'arm64-v8a': {state: 'failed'}, x86_64: {state: 'not-executed'}}}}));
  f.write('android/release-signer.json', JSON.stringify({schema: 1, signerSha256: 'unset', lastRelease: {versionCode: null}}));
  let rows = strictBuildInputs(f.root, null, {env: {}});
  const row = name => rows.find(item => item.input === name);
  assert.deepEqual(rows.filter(item => item.suppliedBy === 'person').map(item => item.input), ['speech runtime qualified', 'embedding host libraries', 'release signer']);
  assert.ok(rows.every(item => item.state === 'missing' && item.action), 'an empty checkout has nothing ready and an action for every input');
  assert.match(row('pinned upstream checkout').action, /git submodule update --init vendor\/eliza/);
  assert.match(row('speech runtime qualified').detail, /installed AAR is not the reviewed one.*functional acceptance is failed \(arm64-v8a failed, x86_64 not-executed\)/);
  assert.match(row('speech runtime qualified').action, /^Needs a person: the owner decides A-24/);
  assert.match(row('embedding host libraries').action, /^Needs a person: /);
  assert.match(row('release signer').action, /^Needs a person: decision A-06/);
  assert.match(row('release signer').detail, /says unset; not set in this environment: ELIZAOS_KEYSTORE_PATH, ELIZAOS_KEYSTORE_PASSWORD, ELIZAOS_KEY_ALIAS, ELIZAOS_KEY_PASSWORD/);
  for (const name of ['prepared resident runtime source', 'workflow worker artifact', 'staged resident runtime payload', 'embedding model', 'Gradle dependency verification metadata'])
    assert.match(row(name).action, /^npm run /, name);
  let report = formatReport(rows);
  assert.match(report, /3 input\(s\) only a person can supply: speech runtime qualified, embedding host libraries, release signer\./);
  assert.match(report, /The chain cannot pass Gradle :app:verifyEmbeddingHost until a person supplies the embedding host libraries\./);
  assert.match(report, /do not stop the build: verify-apks records its releases distributable:false/);

  // A locally built speech runtime is installed but is never the qualified one; values of signing variables are never printed.
  f.write('android/local-speech/libs/sherpa-onnx-1.13.8-no-espeak.aar', 'local build');
  for (const name of f.names) f.stage(name);
  const prepared = path.join(f.root, 'artifacts/local-agent-resident-' + 'c'.repeat(40));
  f.write(path.relative(f.root, path.join(prepared, '.alpha-runtime-source.json')), 'stamp');
  f.write('android/app/src/main/assets/agent/alpha-source.json', 'stamp');
  f.write('android/app/src/main/assets/agent/workflow-worker/manifest.json', '{}');
  rows = strictBuildInputs(f.root, prepared, {env: {ELIZAOS_KEYSTORE_PATH: '/secret/path.jks', ELIZAOS_KEYSTORE_PASSWORD: 'hunter2', ELIZAOS_KEY_ALIAS: 'release', ELIZAOS_KEY_PASSWORD: 'hunter2'}});
  assert.equal(row('speech runtime installed').state, 'ready');
  assert.equal(row('speech runtime qualified').state, 'missing');
  assert.equal(row('embedding host libraries').state, 'ready');
  assert.equal(row('staged resident runtime payload').state, 'ready');
  assert.equal(row('release signer').state, 'missing', 'signing variables alone do not make a release signer');
  report = formatReport(rows);
  assert.doesNotMatch(report, /hunter2|secret\/path/);
  assert.doesNotMatch(report, /cannot pass Gradle/);

  // Once the reviewed bytes are reproducible the same row belongs to a script.
  const g = fixture(t, {remapBuildPath: true});
  for (const file of ['upstream.lock.json', 'android/local-speech/runtime-manifest.json', 'android/local-speech/qualified-runtime-manifest.json', 'android/release-signer.json'])
    g.write(file, fs.readFileSync(path.join(f.root, file), 'utf8'));
  const host = strictBuildInputs(g.root, null, {env: {}}).find(item => item.input === 'embedding host libraries');
  assert.deepEqual([host.suppliedBy, host.action], ['script', 'npm run agent:build-embedding-host']);
});

test('the real checkout reports its inputs without failing and without building', () => {
  const result = spawnSync(process.execPath, ['scripts/android-build-preflight.mjs', '--report', '--json'], {cwd: ROOT, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  const rows = JSON.parse(result.stdout);
  assert.deepEqual(rows.map(row => row.input), ['pinned upstream checkout', 'speech runtime installed', 'speech runtime qualified', 'embedding host libraries',
    'prepared resident runtime source', 'workflow worker artifact', 'staged resident runtime payload', 'embedding model', 'Gradle dependency verification metadata', 'release signer']);
  assert.equal(rows.find(row => row.input === 'Gradle dependency verification metadata').state, 'ready');
  // Until the owner decisions and qualifications exist these stay with a person, whatever is staged locally.
  assert.equal(rows.find(row => row.input === 'release signer').state, 'missing');
  assert.equal(rows.find(row => row.input === 'speech runtime qualified').state, 'missing');
  assert.equal(rows.find(row => row.input === 'embedding host libraries').suppliedBy, 'person');
});
