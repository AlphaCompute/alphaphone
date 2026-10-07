import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { affected, changedPaths } from '../scripts/ci/affected.mjs';

const none = { verify: false, browser: false, android: false, prepare: false };
test('reference-only changes spend no build or test runners', () => {
  assert.deepEqual(affected(['README.md', 'docs/verification.md', 'design/reference.html']), none);
});
test('host tests do not rebuild native speech; browser tests select the browser lane', () => {
  assert.deepEqual(affected(['test/credential-contract.test.mjs']), { ...none, verify: true });
  assert.deepEqual(affected(['test/browser/notes.spec.ts']), { ...none, verify: true, browser: true });
});
test('renderer changes qualify browser and packaged APK bytes, native changes select Android', () => {
  assert.deepEqual(affected(['apps/app/src/main.tsx']), { ...none, verify: true, browser: true, android: true });
  assert.deepEqual(affected(['android/app/src/main/AndroidManifest.xml']), { ...none, verify: true, android: true });
});
test('shared pins, dependencies, selection logic and unknown inputs fail open to all checks', () => {
  for (const path of ['vendor/eliza', 'upstream.lock.json', 'package-lock.json', 'scripts/ci/affected.mjs', '.github/workflows/changes.yml', 'new-build-input']) {
    assert.deepEqual(affected([path]), { verify: true, browser: true, android: true, prepare: true }, path);
  }
});
test('complete Git diff preserves deleted paths and both sides of a rename into docs', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'alpha-ci-diff-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
  try {
    git('init', '-q'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'CI test');
    mkdirSync(join(cwd, 'apps/app'), { recursive: true });
    writeFileSync(join(cwd, 'apps/app/source.ts'), 'export const value = 1;\n');
    writeFileSync(join(cwd, 'package-lock.json'), '{}\n');
    git('add', '.'); git('commit', '-qm', 'base'); const base = git('rev-parse', 'HEAD').trim();
    mkdirSync(join(cwd, 'docs')); git('mv', 'apps/app/source.ts', 'docs/reference.ts'); git('rm', 'package-lock.json');
    git('commit', '-qm', 'move and delete'); const head = git('rev-parse', 'HEAD').trim();
    const paths = changedPaths(base, head, git);
    assert.deepEqual(paths.sort(), ['apps/app/source.ts', 'docs/reference.ts', 'package-lock.json']);
    assert.deepEqual(affected(paths), { verify: true, browser: true, android: true, prepare: true });
    assert.throws(() => changedPaths('--output=/tmp/file', head, git), /full base and head/);
    assert.throws(() => changedPaths('0'.repeat(40), head, git));
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
