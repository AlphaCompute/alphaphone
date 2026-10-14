import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateNativeVoice, nativeTimingFormat } from '../scripts/native-voice-latency.mjs';
import { aggregate } from '../scripts/aggregate-voice-latency.mjs';
const identity = { sourceSha256: 'a'.repeat(64), engineSha256: 'b'.repeat(64), modelSha256: 'c'.repeat(64), device: 'test-device', abi: 'arm64-v8a', network: 'offline', thermal: 'nominal' };
function trial(index, duration = 5900) {
  return { id: `trial-${index}`, cold: index < 5, mode: 'voice-assistant', queryClass: 'simple', clock: 'native-monotonic-ms', outcome: 'passed', identity: { ...identity }, marks: { 'last-user-audio': 1000, endpoint: 3000, 'transcript-ready': 3200, request: 3300, 'first-token': 4000, 'first-pcm': 5000, 'audible-playback': 1000 + duration } };
}
const document = records => ({ format: nativeTimingFormat, records });
const samples = () => Array.from({ length: 50 }, (_, i) => trial(i));

test('native latency includes endpoint delay and playback buffering in cold/warm percentiles', () => {
  const rows = samples(), summary = aggregate([document(rows)]);
  assert.equal(summary.sufficient, true);
  assert.equal(summary.native.withinBudget, true);
  assert.equal(summary.native.cohorts[0].warm.p95, 5900);
  assert.equal(summary.native.cohorts[0].cold.p50, 5900);
  assert.equal(aggregateNativeVoice([document(rows.slice(1))]).sufficient, false);
  assert.equal(aggregateNativeVoice([document(rows)], {warm: 46, cold: 5}).sufficient, false);
  assert.equal(aggregateNativeVoice([document(rows.map((row, i) => trial(i, 7000)))]).withinBudget, false);
});

test('incompatible engine, model, hardware, network and thermal cohorts never pool trials', () => {
  for (const key of Object.keys(identity)) {
    const rows = samples(); rows[0].identity[key] = key.endsWith('Sha256') ? 'd'.repeat(64) : key === 'abi' ? 'x86_64' : 'different';
    const summary = aggregateNativeVoice([document(rows)]);
    assert.equal(summary.sufficient, false, key);
    assert.equal(summary.cohorts.length, 2, key);
  }
});

test('missing, renderer, dictation and out-of-order timestamps cannot qualify audio evidence', () => {
  for (const mutate of [row => delete row.marks['audible-playback'], row => row.clock = 'renderer-performance-now', row => row.mode = 'dictation', row => row.marks.endpoint = 0, row => row.identity.modelSha256 = 'unknown']) {
    const rows = samples(); mutate(rows[0]);
    const summary = aggregateNativeVoice([document(rows)]);
    assert.equal(summary.invalid, 1); assert.equal(summary.sufficient, false);
  }
});

test('failures and cancellations remain visible and conflicting duplicate trials fail closed', () => {
  const rows = samples(), failed = trial(50); failed.outcome = 'failed'; delete failed.marks['audible-playback'];
  const cancelled = trial(51); cancelled.outcome = 'cancelled';
  const summary = aggregateNativeVoice([document([...rows, failed, cancelled]), document(rows)]);
  assert.equal(summary.cohorts[0].trials, 52); assert.equal(summary.cohorts[0].failures, 1); assert.equal(summary.cohorts[0].cancelled, 1);
  assert.equal(summary.sufficient, true); assert.equal(summary.withinBudget, false);
  const conflicting = trial(0, 7000);
  const conflict = aggregateNativeVoice([document(rows), document([conflicting])]);
  assert.equal(conflict.conflictingTrials, 1); assert.equal(conflict.sufficient, false);
});
