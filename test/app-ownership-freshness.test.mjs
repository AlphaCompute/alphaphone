// The committed apps/app ownership inventory must describe the current source bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const audit = path.join(root, 'scripts/audit-app-ownership.mjs');
const run = (...args) => spawnSync(process.execPath, [audit, ...args], { cwd: root, encoding: 'utf8' });

test('docs/app-ownership-inventory.json is current for apps/app', () => {
  const result = run('--check');
  assert.equal(result.status, 0, `${result.stderr || result.stdout}\nRun: node scripts/audit-app-ownership.mjs`);
});

test('inventory is content-addressed and lists every admitted apps/app file once', () => {
  const inventory = JSON.parse(fs.readFileSync(path.join(root, 'docs/app-ownership-inventory.json'), 'utf8'));
  assert.equal(inventory.schema, 2);
  assert.match(inventory.sourceDigest, /^[a-f0-9]{64}$/);
  assert.equal(inventory.sourceCommit, undefined, 'a commit hash can never match the commit that contains it');
  const listed = inventory.files.map(file => file.file);
  assert.equal(new Set(listed).size, listed.length);
  const tracked = spawnSync('git', ['ls-files', '-z', '-co', '--exclude-standard', '--', 'apps/app'], { cwd: root, encoding: 'utf8' });
  if (tracked.status === 0) assert.deepEqual([...listed].sort(), tracked.stdout.split('\0').filter(Boolean).map(file => path.posix.relative('apps/app', file)).sort());
});

test('--check fails on a stale inventory and names the regeneration command', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ownership-'));
  try {
    const stale = path.join(directory, 'inventory.json');
    const inventory = JSON.parse(fs.readFileSync(path.join(root, 'docs/app-ownership-inventory.json'), 'utf8'));
    inventory.files[0] = { ...inventory.files[0], sha256: '0'.repeat(64) };
    fs.writeFileSync(stale, JSON.stringify(inventory, null, 2) + '\n');
    const result = run('--check', stale);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /is stale; 1 file entries differ/);
    assert.match(result.stderr, /node scripts\/audit-app-ownership\.mjs/);
    assert.equal(run('--check', path.join(directory, 'missing.json')).status, 1);
    assert.equal(run('--bogus').status, 2);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
