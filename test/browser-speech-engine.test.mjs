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
