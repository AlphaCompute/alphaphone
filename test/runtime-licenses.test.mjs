// Runtime notice enumeration on a synthetic staged payload; not APK or legal evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { agentBundlePackageDirs, BUN_ENTRY, collectNotices, packagedRuntimePresent, runtimeEntries, ROOT, shippedPackagedRuntime } from '../scripts/generate-licenses.mjs';

const templates = { mit: 'MIT terms', isc: 'ISC terms', apache: 'Apache terms' };

function stagedRuntime(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-runtime-notices-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const agent = path.join(root, 'android/app/src/main/assets/agent');
  const source = path.join(root, 'artifacts/local-agent-resident-' + 'a'.repeat(40));
  const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  write(path.join(agent, 'agent-bundle.js'), [
    '// @bun', 'var x = 1;',
    '// ../../node_modules/.bun/zod@4.1.0/node_modules/zod/index.js',
    '// ../../node_modules/.bun/zod@4.1.0/node_modules/zod/v4/core.js',
    '// ../../node_modules/.bun/@scope+pkg@2.0.0+abc/node_modules/@scope/pkg/dist/a.js',
    '// ../../node_modules/hoisted/lib/index.js',
    '// ../../packages/core/src/index.ts',
    '  // ../../node_modules/.bun/indented@1.0.0/node_modules/indented/x.js',
  ].join('\n'));
  write(path.join(agent, 'android-agent-runtime-provenance.json'), JSON.stringify({ bun: { version: '1.4.2', revision: 'b'.repeat(40), architectures: ['x86_64', 'arm64-v8a'] } }));
  write(path.join(agent, 'alpha-source.json'), JSON.stringify({ base: 'a'.repeat(40) }));
  write(path.join(source, 'node_modules/.bun/zod@4.1.0/node_modules/zod/package.json'), JSON.stringify({ name: 'zod', version: '4.1.0', license: 'MIT' }));
  write(path.join(source, 'node_modules/.bun/zod@4.1.0/node_modules/zod/LICENSE'), 'zod license text');
  write(path.join(source, 'node_modules/.bun/@scope+pkg@2.0.0+abc/node_modules/@scope/pkg/package.json'), JSON.stringify({ name: '@scope/pkg', version: '2.0.0', license: { type: 'ISC' } }));
  write(path.join(source, 'node_modules/hoisted/package.json'), JSON.stringify({ name: 'hoisted', version: '0.1.0', license: 'Apache-2.0' }));
  write(path.join(agent, 'workflow-worker/dependencies.json'), JSON.stringify([
    { name: 'zod', version: '4.1.0', license: 'MIT', sourcePath: 'node_modules/zod', notices: ['licenses/1/LICENSE'] },
    { name: 'effect', version: '4.0.0', license: 'MIT', sourcePath: 'node_modules/effect', notices: [] },
  ]));
  write(path.join(agent, 'workflow-worker/licenses/1/LICENSE'), 'zod license text');
  return { root, agent, source };
}

test('bundle path comments name each contributing npm package once, never workspace sources', () => {
  assert.deepEqual(agentBundlePackageDirs([
    '// ../../node_modules/.bun/a@1.0.0/node_modules/a/x.js', '// ../../node_modules/.bun/a@1.0.0/node_modules/a/y.js',
    '// node_modules/.bun/@s+b@2.0.0/node_modules/@s/b/z.js', '// ../../plugins/plugin-sql/src/index.ts', 'var s = "// ../../node_modules/fake/x.js";',
  ].join('\n')), ['node_modules/.bun/@s+b@2.0.0/node_modules/@s/b', 'node_modules/.bun/a@1.0.0/node_modules/a']);
});

test('a PACKAGED runtime lists Bun with its LGPL notice and every bundled agent and worker package', t => {
  const { root, agent, source } = stagedRuntime(t);
  assert.equal(packagedRuntimePresent(root), true);
  const errors = [];
  const entries = runtimeEntries(root, templates, errors, { agentDir: agent, sourceDir: source });
  assert.deepEqual(errors, []);
  const byName = Object.fromEntries(entries.map(entry => [entry.name, entry]));
  const bun = byName['Bun JavaScript runtime (libeliza_bun.so)'];
  assert.ok(bun, 'Bun entry');
  assert.match(bun.version, /^1\.4\.2 \(oven-sh\/bun b{40}\)$/);
  assert.match(bun.text, /MIT terms/);
  assert.match(bun.text, /JavaScriptCore/);
  assert.match(bun.text, /LGPL/);
  assert.match(bun.text, /Corresponding source/);
  assert.match(bun.text, /Source offer/);
  assert.equal(byName.zod.license, 'MIT');
  assert.match(byName.zod.text, /agent bundle and workflow worker/);
  assert.equal(byName['@scope/pkg'].license, 'ISC');
  assert.equal(byName.hoisted.license, 'Apache-2.0');
  assert.match(byName.effect.text, /workflow worker/);
  assert.equal(entries.filter(entry => entry.name === 'zod').length, 1, 'deduplicated across bundles');
  // Default source directory comes from the staged stamp.
  assert.equal(runtimeEntries(root, templates, [], { agentDir: agent }).length, entries.length);
});

test('a missing prepared package or worker inventory fails generation', t => {
  const { root, agent, source } = stagedRuntime(t);
  fs.rmSync(path.join(source, 'node_modules/hoisted'), { recursive: true });
  fs.rmSync(path.join(agent, 'workflow-worker/dependencies.json'));
  const errors = [];
  runtimeEntries(root, templates, errors, { agentDir: agent, sourceDir: source });
  assert.ok(errors.some(error => /not in the prepared runtime source/.test(error)));
  assert.ok(errors.some(error => /dependencies\.json is missing/.test(error)));
});

test('without a staged runtime only the umbrella payload entry is shipped', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-no-runtime-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(packagedRuntimePresent(root), false);
  assert.deepEqual(runtimeEntries(root, templates, []), []);
});

test('runtime enumeration is explicit: a staged runtime never changes the committed notices', () => {
  const isBun = entry => entry.name === BUN_ENTRY;
  // The committed notices are generated without --packaged-runtime, so a development
  // checkout with a staged runtime still matches them (test/licenses.test.mjs).
  assert.equal(shippedPackagedRuntime(ROOT), false);
  const committed = collectNotices(ROOT);
  assert.equal(committed.entries.some(isBun), false);
  assert.ok(committed.entries.some(entry => entry.name === 'On-device elizaOS agent runtime payload'));
  const packaged = collectNotices(ROOT, { packagedRuntime: true });
  if (packagedRuntimePresent(ROOT)) assert.ok(packaged.entries.some(isBun));
  else assert.ok(packaged.errors.some(error => /--packaged-runtime needs a staged runtime/.test(error)), 'refuses without a staged runtime');
});

test('generation follows the shipped mode, and --packaged-runtime is wired into the PACKAGED build', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-shipped-mode-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(shippedPackagedRuntime(root), false, 'no shipped notices');
  fs.mkdirSync(path.join(root, 'apps/app/public/licenses'), { recursive: true });
  fs.writeFileSync(path.join(root, 'apps/app/public/licenses/third-party-notices.json'), JSON.stringify([{ name: BUN_ENTRY }]));
  assert.equal(shippedPackagedRuntime(root), true);
  const resident = fs.readFileSync(path.join(ROOT, '.github/workflows/resident-android.yml'), 'utf8');
  assert.match(resident, /node scripts\/generate-licenses\.mjs --packaged-runtime\n/);
});
