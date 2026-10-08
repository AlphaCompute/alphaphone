import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserSpeechFiles} from '../scripts/browser-speech-assets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = await import('../apps/app/src/browser/whisper-engine.ts');

/** 16-bit PCM WAV narration from the repository, linearly resampled to 16 kHz mono. */
function narration(name) {
  const bytes = fs.readFileSync(path.join(root, 'design-assets/video/narration', name));
  const rate = bytes.readUInt32LE(24), channels = bytes.readUInt16LE(22);
  let offset = 12; while (bytes.toString('ascii', offset, offset + 4) !== 'data') offset += 8 + bytes.readUInt32LE(offset + 4);
  const frames = bytes.readUInt32LE(offset + 4) / 2 / channels, input = new Float32Array(frames);
  for (let i = 0; i < frames; i++) input[i] = bytes.readInt16LE(offset + 8 + i * 2 * channels) / 32768;
  const output = new Float32Array(Math.floor(frames * 16000 / rate));
  for (let i = 0; i < output.length; i++) { const x = i * rate / 16000, j = Math.floor(x), f = x - j; output[i] = (input[j] || 0) * (1 - f) + (input[j + 1] || 0) * f; }
  return output;
}
const words = text => text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
function wordErrorRate(reference, hypothesis) {
  const a = words(reference), b = words(hypothesis), row = Array.from({length: b.length + 1}, (_, j) => j);
  for (let i = 1; i <= a.length; i++) { let previous = row[0]; row[0] = i; for (let j = 1; j <= b.length; j++) { const current = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1)); previous = current; } }
  return row[b.length] / a.length;
}

test('mel filters match the Slaney/librosa layout Whisper was trained with', () => {
  const filters = W.melFilterBank();
  assert.equal(filters.length, 80 * 201);
  assert.ok(filters.every(value => value >= 0));
  // Every filter is a single triangle with area normalisation 2/(upper-lower).
  for (let m = 0; m < 80; m++) {
    const row = filters.subarray(m * 201, m * 201 + 201), nonzero = [...row.keys()].filter(k => row[k] > 0);
    assert.ok(nonzero.length >= 1, `filter ${m} is empty`);
    assert.equal(nonzero.at(-1) - nonzero[0] + 1, nonzero.length, `filter ${m} is not contiguous`);
  }
  // Librosa reference: filter 0 peaks at bin 1 with weight 0.024862.
  assert.ok(Math.abs(filters[1] - 0.024862) < 1e-4, String(filters[1]));
});

test('log-mel features: silence is the floor; a tone lands in its mel band; padding is skipped exactly', () => {
  const silence = W.logMelSpectrogram(new Float32Array(16000));
  assert.equal(silence.length, 80 * 3000);
  assert.ok(silence.every(value => Math.abs(value - -1.5) < 1e-6));
  const tone = Float32Array.from({length: 16000}, (_, i) => 0.5 * Math.sin(2 * Math.PI * 1000 * i / 16000));
  const features = W.logMelSpectrogram(tone), frame = 50;
  let best = 0; for (let m = 1; m < 80; m++) if (features[m * 3000 + frame] > features[best * 3000 + frame]) best = m;
  const filters = W.melFilterBank(), bin = Math.round(1000 * 400 / 16000);
  let expected = 0; for (let m = 1; m < 80; m++) if (filters[m * 201 + bin] > filters[expected * 201 + bin]) expected = m;
  assert.ok(Math.abs(best - expected) <= 1, `tone peaked at mel ${best}, expected ${expected}`);
  // Frames after the tone are at the clamped floor (max - 8 decades), never computed noise.
  const floor = Math.min(...Array.from({length: 80}, (_, m) => features[m * 3000 + 2999]));
  assert.ok(Array.from({length: 80}, (_, m) => features[m * 3000 + 2000]).every(value => value === floor));
});

test('byte-level token decoding, suppression, loop detection and no-speech policy', () => {
  const decode = W.createTokenDecoder({'Hello': 0, 'Ġworld': 1, 'Ġcaf': 2, 'Ã©': 3, '.': 4});
  assert.equal(decode([0, 1, 2, 3, 4, W.WHISPER.eot, W.WHISPER.sot]), 'Hello world café.');
  const logits = new Float32Array(51864).fill(-10);
  logits[W.WHISPER.sot] = 10; logits[50400] = 9; logits[220] = 8; logits[7] = 7; logits[42] = 1;
  assert.equal(W.selectToken(logits, 0, 51864, new Set([7]), true, new Set([220, W.WHISPER.eot])), 42, 'specials, timestamps, suppressed and begin-suppressed tokens are never chosen');
  assert.equal(W.selectToken(logits, 0, 51864, new Set([7]), false, new Set([220])), 220);
  assert.equal(W.repeatingTail([5, 1, 2, 1, 2, 1, 2, 1, 2]), 2);
  assert.equal(W.repeatingTail([1, 2, 3, 4]), 0);
  assert.equal(W.noSpeechDecision('', 0, 0), true);
  assert.equal(W.noSpeechDecision(' [BLANK_AUDIO] ', 0, 0), true);
  assert.equal(W.noSpeechDecision('you', 0.9, -0.6), true, 'a confident no-speech token overrides a short hallucination');
  assert.equal(W.noSpeechDecision('Hold the side key.', 0.02, -0.2), false);
  assert.equal(W.silentRecording(new Float32Array(16000)), true);
  assert.equal(W.silentRecording(new Float32Array(800).fill(0.3)), true, 'under 100 ms is not speech');
  assert.equal(W.silentRecording(Float32Array.from({length: 16000}, (_, i) => 0.2 * Math.sin(i / 5))), false);
});

const assets = browserSpeechFiles(root);
test('Whisper tiny.en transcribes known phrases accurately with the pinned model and runtime', {skip: assets.problems.length ? `browser speech assets not prepared (npm run browser-speech:prepare): ${assets.problems[0]}` : false, timeout: 180000}, async () => {
  const ort = await import('onnxruntime-web');
  ort.env.wasm.numThreads = 1;
  const file = role => fs.readFileSync(assets.files.find(item => item.role === role).source);
  const recognizer = await W.createWhisperRecognizer(ort, {encoder: file('encoder'), decoder: file('decoder'), vocab: JSON.parse(file('vocab')), generation: JSON.parse(file('generation'))});
  try {
    const scenes = JSON.parse(fs.readFileSync(path.join(root, 'design-assets/video/scenes.json'), 'utf8'));
    for (const id of ['voice', 'notes', 'calendar']) {
      const reference = scenes.find(scene => scene.id === id).say, result = await recognizer.transcribe(narration(`${id}.wav`));
      const rate = wordErrorRate(reference, result.text);
      assert.ok(rate <= 0.2, `${id}: "${result.text}" vs "${reference}" (WER ${rate.toFixed(2)})`);
      assert.equal(result.noSpeech, false);
    }
    const quiet = await recognizer.transcribe(new Float32Array(32000));
    assert.equal(quiet.noSpeech, true, `silence produced "${quiet.text}"`);
    let checks = 0;
    await assert.rejects(recognizer.transcribe(narration('voice.wav'), () => { if (++checks > 2) throw new DOMException('cancelled', 'AbortError'); }), {name: 'AbortError'});
  } finally { await recognizer.release(); }
});
