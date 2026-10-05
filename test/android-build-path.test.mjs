import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {checkoutProblems, preparedRuntimeProblems, SPEECH_AAR, SPEECH_MANIFEST} from '../scripts/android-build-preflight.mjs';
import {TURBO_AGENT_DETECTION_ENV, preparedSourceEnv} from '../scripts/local-agent-source.mjs';
import {ensurePreparedWorkflowWorker} from '../scripts/prepared-workflow-worker.mjs';
import {workerHash} from '../scripts/workflow-worker-artifact.mjs';

const read = file => fs.readFileSync(file, 'utf8');
const scripts = JSON.parse(read('package.json')).scripts;

test('android:build:local builds the workflow worker between preparation and staging', () => {
  const steps = scripts['android:build:local'].split(' && ');
  assert.deepEqual(steps, [
    'node scripts/android-build-preflight.mjs --before-prepare',
    'npm run agent:prepare',
    'npm run agent:build-workflow-worker',
    'npm run agent:stage-android',
    'npm run android:build',
  ]);
  // Each chained step is a real script, so the chain cannot silently skip one.
  for (const step of steps.filter(step => step.startsWith('npm run ')))
    assert.ok(scripts[step.slice('npm run '.length)], step);
  // Staging verifies the worker artifact; the chain must produce it first.
  assert.match(read('scripts/stage-workflow-worker.mjs'), /stageWorkerArtifact\(artifact/);
});

test('prepared-source children run without the agent variables turbo detects', () => {
  // Each name below was observed to make turbo 2.11.5 write the managed AGENTS.md block.
  for (const name of ['AI_AGENT', 'CLAUDECODE', 'CLAUDE_CODE', 'CODEX_SANDBOX', 'CURSOR_AGENT', 'CURSOR_TRACE_ID', 'GEMINI_CLI', 'AUGMENT_AGENT', 'OPENCODE', 'OPENCODE_CLIENT', 'REPL_ID'])
    assert.ok(TURBO_AGENT_DETECTION_ENV.includes(name), name);
  const base = Object.fromEntries(TURBO_AGENT_DETECTION_ENV.map(name => [name, '1']));
  const env = preparedSourceEnv({...base, PATH: '/bin', HOME: '/home/x'}, {ELIZA_SKIP_FUSED_INFERENCE_SETUP: '1'});
  assert.deepEqual(env, {PATH: '/bin', HOME: '/home/x', ELIZA_SKIP_FUSED_INFERENCE_SETUP: '1'});
  // An extra cannot reintroduce a detection variable either.
  assert.equal('CLAUDECODE' in preparedSourceEnv({}, {CLAUDECODE: '1'}), false);
  // Every producer that runs commands inside the prepared checkout uses the scrubbed env.
  assert.match(read('scripts/prepare-local-agent.mjs'), /env:preparedSourceEnv\(process\.env,\{ELIZA_SKIP_FUSED_INFERENCE_SETUP:'1'\}\)/);
  assert.match(read('scripts/stage-local-agent-runtime.mjs'), /const env=preparedSourceEnv\(process\.env,/);
  assert.match(read('scripts/build-workflow-worker.ts'), /const env=preparedSourceEnv\(process\.env\);\nfor\(const name of Object\.keys\(process\.env\)\)if\(!\(name in env\)\)delete process\.env\[name\];/);
});

test('scrubbed children leave a turbo-style AGENTS.md updater with nothing to detect', t => {
  // Stand-in for turbo's detector: appends a managed block when any variable is set.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-agents-md-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'upstream\n');
  const updater = `const fs=require('fs');const names=${JSON.stringify(TURBO_AGENT_DETECTION_ENV)};if(names.some(n=>process.env[n]))fs.appendFileSync('AGENTS.md','<!-- BEGIN:turborepo-agent-rules -->\\n');`;
  const run = env => execFileSync(process.execPath, ['-e', updater], {cwd: dir, env});
  run(preparedSourceEnv({...process.env, CLAUDECODE: '1', AI_AGENT: 'claude', CODEX_SANDBOX: 'seatbelt'}));
  assert.equal(read(path.join(dir, 'AGENTS.md')), 'upstream\n');
  run({...process.env, CLAUDECODE: '1'});
  assert.notEqual(read(path.join(dir, 'AGENTS.md')), 'upstream\n');
});

function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-android-preflight-')));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const upstream = path.join(root, 'vendor/eliza');
  fs.mkdirSync(upstream, {recursive: true});
  const git = (...args) => execFileSync('git', args, {cwd: upstream, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  git('init', '-q');
  fs.writeFileSync(path.join(upstream, 'README'), 'pinned\n');
  git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-q', '-m', 'pin');
  const commit = git('rev-parse', 'HEAD');
  fs.writeFileSync(path.join(root, 'upstream.lock.json'), JSON.stringify({commit}));
  const write = (name, text) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, text);
  };
  const source = path.join(root, 'artifacts/local-agent-resident-' + commit);
  return {root, source, write, commit};
}

test('preflight names the exact command for each missing build input', t => {
  const f = fixture(t);
  f.write(SPEECH_MANIFEST, JSON.stringify({aarSha256: '0'.repeat(64), noEspeak: true}));
  let problems = checkoutProblems(f.root);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Speech runtime .* is missing .*scripts\/local-speech\/README\.md/);

  f.write(SPEECH_AAR, 'locally built');
  assert.match(checkoutProblems(f.root)[0], /does not match android\/local-speech\/runtime-manifest\.json/);
  f.write(SPEECH_MANIFEST, JSON.stringify({aarSha256: createHash('sha256').update('locally built').digest('hex'), noEspeak: true}));
  assert.deepEqual(checkoutProblems(f.root), []);

  // A clean checkout: no prepared source. This is what used to fail deep in Gradle.
  problems = preparedRuntimeProblems(f.root, f.source);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /:app:stageLocalAgentSources/);
  assert.match(problems[0], /Run: npm run android:build:local/);
  assert.match(problems[0], /npm run agent:prepare before npm run android:build -- --allow-unpackaged-runtime/);

  f.write(path.relative(f.root, path.join(f.source, '.alpha-runtime-source.json')), '{"stamp":1}\n');
  assert.deepEqual(preparedRuntimeProblems(f.root, f.source, {allowUnpackagedRuntime: true}), []);
  assert.deepEqual(preparedRuntimeProblems(f.root, f.source, {testMocks: true}), []);
  assert.match(preparedRuntimeProblems(f.root, f.source)[0], /not staged.*npm run agent:build-workflow-worker && npm run agent:stage-android/);

  f.write('android/app/src/main/assets/agent/workflow-worker/manifest.json', '{}');
  f.write('android/app/src/main/assets/agent/alpha-source.json', '{"stamp":0}\n');
  assert.match(preparedRuntimeProblems(f.root, f.source)[0], /different prepared source/);
  f.write('android/app/src/main/assets/agent/alpha-source.json', '{"stamp":1}\n');
  assert.deepEqual(preparedRuntimeProblems(f.root, f.source), []);
});

test('preflight rejects an unpinned checkout and android:build stops before sync and Gradle', t => {
  const f = fixture(t);
  f.write('upstream.lock.json', JSON.stringify({commit: 'f'.repeat(40)}));
  assert.match(checkoutProblems(f.root)[0], /vendor\/eliza is at .*pins f{40}\. Run: git submodule update --init vendor\/eliza/);
  // The real entry point exits with status 2 and the guidance, without starting the build.
  for (const file of ['build-android.mjs', 'android-build-preflight.mjs', 'toolchain.mjs'])
    f.write('scripts/' + file, read('scripts/' + file));
  const result = spawnSync(process.execPath, ['scripts/build-android.mjs'], {cwd: f.root, encoding: 'utf8'});
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /Android build prerequisites are missing/);
  assert.match(result.stderr, /git submodule update --init vendor\/eliza/);
  assert.equal(fs.existsSync(path.join(f.root, 'artifacts')), false);
  assert.equal(fs.existsSync(path.join(f.root, 'web-dist')), false);
});

test('the Gradle source-staging task explains a missing prepared runtime', () => {
  assert.match(read('scripts/stage-local-agent-sources.mjs'), /Prepared runtime source .* is missing\. Run npm run android:build:local .* or npm run agent:prepare first\./);
});

test('worker build reuses only an artifact that verifies against the prepared source', async t => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-worker-reuse-')));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const source = path.join(root, 'artifacts/source'), output = path.join(root, 'artifacts/worker');
  fs.mkdirSync(source, {recursive: true});
  fs.writeFileSync(path.join(source, '.alpha-runtime-source.json'), 'stamp-a');
  fs.writeFileSync(path.join(source, 'bun.lock'), 'lock');
  const producer = path.join(source, 'packages/scripts/plugins/plugin-workflow/build-workflow-artifact.ts');
  fs.mkdirSync(path.dirname(producer), {recursive: true});
  fs.writeFileSync(producer, `import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
export async function buildWorkflowArtifact({sourceRoot,outputDir,sourceIdentity}){const hash=x=>createHash('sha256').update(x).digest('hex');const files={};for(const name of ['node_modules/smthrs/package.json','node_modules/zod/package.json','node_modules/effect/package.json','node_modules/@smthrs/engine/package.json','dependencies.json']){const f=path.join(outputDir,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,'{}');files[name]=hash('{}');}fs.writeFileSync(path.join(outputDir,'manifest.json'),JSON.stringify({version:1,sourceStampSha256:sourceIdentity,lockSha256:hash(fs.readFileSync(path.join(sourceRoot,'bun.lock'))),files}));fs.appendFileSync(path.join(sourceRoot,'builds'),'x');}
`);
  const first = await ensurePreparedWorkflowWorker(root, source, output);
  assert.equal(first.reused, false);
  assert.equal(first.manifest.sourceStampSha256, workerHash(Buffer.from('stamp-a')));
  const second = await ensurePreparedWorkflowWorker(root, source, output);
  assert.equal(second.reused, true);
  assert.equal(read(path.join(source, 'builds')), 'x');
  // A re-prepared source never adopts the old artifact.
  fs.writeFileSync(path.join(source, '.alpha-runtime-source.json'), 'stamp-b');
  await assert.rejects(ensurePreparedWorkflowWorker(root, source, output), /does not match the prepared runtime source .*ALPHA_WORKFLOW_WORKER_OUTPUT/);
  assert.equal(read(path.join(source, 'builds')), 'x');
});
