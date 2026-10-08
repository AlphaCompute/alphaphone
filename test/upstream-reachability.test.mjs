import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { assessDevelopReachability, reachabilityMode, REACHABILITY_RECORD } from '../scripts/pinned-upstream-source.mjs';

const pin = 'a'.repeat(40);
const base = { schema: 1, base: 'develop', head: pin, mergeBase: 'b'.repeat(40), recordedAt: '2026-10-08' };

test('develop reaches the pin only when the recorded compare has no pin-only commits', () => {
  assert.equal(assessDevelopReachability({ ...base, status: 'identical', aheadBy: 0, behindBy: 0, pinOnlyCommits: [] }, pin).reachable, true);
  assert.equal(assessDevelopReachability({ ...base, status: 'behind', aheadBy: 0, behindBy: 9, pinOnlyCommits: [] }, pin).reachable, true);
  const diverged = assessDevelopReachability({ ...base, status: 'diverged', aheadBy: 2, behindBy: 3,
    pinOnlyCommits: [{ sha: 'c'.repeat(40), subject: 'fix(x): y' }] }, pin);
  assert.equal(diverged.reachable, false);
  assert.equal(diverged.reason, 'unreachable');
  assert.match(diverged.message, /cccccccccc fix\(x\): y/);
});

test('a missing, malformed, inconsistent or stale record never reports reachable', () => {
  assert.equal(assessDevelopReachability(null, pin).reason, 'missing');
  assert.equal(assessDevelopReachability({}, pin).reason, 'invalid');
  assert.equal(assessDevelopReachability({ ...base, status: 'behind', aheadBy: 1, behindBy: 1, pinOnlyCommits: [] }, pin).reason, 'invalid');
  assert.equal(assessDevelopReachability({ ...base, status: 'identical', aheadBy: 0, behindBy: 4, pinOnlyCommits: [] }, pin).reason, 'invalid');
  assert.equal(assessDevelopReachability({ ...base, status: 'behind', aheadBy: 0, behindBy: 1, pinOnlyCommits: [] }, 'd'.repeat(40)).reason, 'stale');
});

test('mode is warn by default and configurable by flag or ELIZA_ variable', () => {
  assert.equal(reachabilityMode([], {}), 'warn');
  assert.equal(reachabilityMode([], { ELIZA_UPSTREAM_REACHABILITY: 'fail' }), 'fail');
  assert.equal(reachabilityMode(['--upstream-reachability=off'], { ELIZA_UPSTREAM_REACHABILITY: 'fail' }), 'off');
  assert.throws(() => reachabilityMode(['--upstream-reachability=maybe'], {}));
});

test('the committed record is valid for the current pin, and verify-upstream warns or fails on it', () => {
  const lock = JSON.parse(fs.readFileSync('upstream.lock.json', 'utf8'));
  const record = JSON.parse(fs.readFileSync(REACHABILITY_RECORD, 'utf8'));
  const result = assessDevelopReachability(record, lock.commit);
  assert.notEqual(result.reason, 'invalid');
  assert.notEqual(result.reason, 'stale', 'refresh scripts/ci/upstream-reachability.json after a pin change');
  const run = env => spawnSync(process.execPath, ['scripts/verify-upstream.mjs', '--reachability-only'], { encoding: 'utf8', env: { ...process.env, ...env } });
  const warn = run({ ELIZA_UPSTREAM_REACHABILITY: 'warn' });
  assert.equal(warn.status, 0, warn.stderr);
  const fail = run({ ELIZA_UPSTREAM_REACHABILITY: 'fail' });
  assert.equal(fail.status, result.ok ? 0 : 1, fail.stderr);
});
