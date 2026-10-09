import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// release-05: the canonical synthesis-to-recognition round trip failed because sherpa-onnx's
// default VITS noise made every synthesis a new random waveform (host replica: 94 of 120 default
// renderings recognized every keyword, 16 heard "lady" for "lazy"; 60 of 60 at zero noise).
// Patch 0066 makes the engine deterministic, and the Android module compiles the patched file.
const patch = fs.readFileSync(new URL('../patches/eliza/0066-local-speech-deterministic-synthesis.patch', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../patches/eliza/local-speech-deterministic-synthesis-source.json', import.meta.url), 'utf8'));
const engine = 'packages/app/platforms/android/local-speech/src/main/java/ai/eliza/speech/LocalSpeechEngine.java';

test('patch 0066 configures zero-noise VITS synthesis on the pinned engine only', () => {
  assert.equal(manifest.patch, '0066-local-speech-deterministic-synthesis.patch');
  assert.deepEqual(manifest.changed, [engine]);
  assert.deepEqual(manifest.basePaths, [engine]);
  const added = patch.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).join('\n');
  assert.match(added, /SYNTHESIS_NOISE_SCALE=0f,SYNTHESIS_NOISE_SCALE_W=0f,SYNTHESIS_LENGTH_SCALE=1f;/);
  assert.match(added, /vits\.setNoiseScale\(SYNTHESIS_NOISE_SCALE\);vits\.setNoiseScaleW\(SYNTHESIS_NOISE_SCALE_W\);vits\.setLengthScale\(SYNTHESIS_LENGTH_SCALE\);/);
  // Configured before this VITS config is handed to the OfflineTts model config.
  const after = patch.slice(patch.indexOf('vits.setNoiseScale('));
  assert.ok(after.indexOf('voice.setVits(vits)') > 0);
  // No other engine behaviour changes: only additions.
  assert.equal(patch.split('\n').filter(line => line.startsWith('-') && !line.startsWith('---')).length, 0);
});

test('the Android speech module overlays the materialized patched files on the pinned module', () => {
  const gradle = fs.readFileSync(new URL('../android/local-speech/build.gradle', import.meta.url), 'utf8');
  assert.match(gradle, /vendor\/eliza\/packages\/app\/platforms\/android\/local-speech/);
  assert.match(gradle, /\.eliza\/patched/);
  assert.match(gradle, /packages\/app\/platforms\/android\/local-speech/);
  assert.match(gradle, /throw new GradleException\('Run npm run upstream:prepare-client/);
  // The pinned module is copied first and the patched files second, so a patch wins.
  assert.ok(gradle.indexOf('from pinnedSpeechSource') < gradle.indexOf('from patchedSpeechSource'));
  assert.match(gradle, /apply from: new File\(speechSource, 'consumer.gradle'\)/);
});
