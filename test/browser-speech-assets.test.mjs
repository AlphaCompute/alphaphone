import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ROOT, readConfig, browserSpeechFiles, ensureBrowserSpeechAssets, pruneAndroidBrowserSpeech} from '../scripts/browser-speech-assets.mjs';

const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-browser-speech-'));

test('a configured model directory is verified, never downloaded into, and corrupt files are reported', async () => {
  const directory = temporary();
  try {
    const env = {ELIZA_BROWSER_SPEECH_DIR: directory};
    const missing = browserSpeechFiles(ROOT, env);
    assert.equal(missing.directory, directory);
    assert.deepEqual(missing.problems.slice(0, 2), ['onnx/encoder_model_quantized.onnx: missing', 'onnx/decoder_model_merged_quantized.onnx: missing']);
    await assert.rejects(ensureBrowserSpeechAssets(ROOT, env, () => {}), /ELIZA_BROWSER_SPEECH_DIR/);
    const config = readConfig(), vocab = config.files.find(file => file.role === 'vocab');
    fs.mkdirSync(path.join(directory, path.dirname(vocab.path)), {recursive: true});
    fs.writeFileSync(path.join(directory, vocab.path), Buffer.alloc(vocab.bytes));
    assert.ok(browserSpeechFiles(ROOT, env).problems.includes('vocab.json: SHA-256 mismatch'));
    fs.writeFileSync(path.join(directory, vocab.path), 'short');
    assert.ok(browserSpeechFiles(ROOT, env).problems.includes(`vocab.json: size 5, expected ${vocab.bytes}`));
  } finally { fs.rmSync(directory, {recursive: true, force: true}); }
});

test('Android sync prunes the browser model from the APK web payload', () => {
  const root = temporary();
  try {
    const target = path.join(root, 'android/app/src/main/assets/public/browser-speech/whisper-tiny.en');
    fs.mkdirSync(target, {recursive: true}); fs.writeFileSync(path.join(target, 'encoder_model_quantized.onnx'), 'x');
    fs.writeFileSync(path.join(root, 'android/app/src/main/assets/public/index.html'), '<!doctype html>');
    assert.equal(pruneAndroidBrowserSpeech(root), true);
    assert.equal(fs.existsSync(path.dirname(target)), false);
    assert.equal(fs.existsSync(path.join(root, 'android/app/src/main/assets/public/index.html')), true);
    assert.equal(pruneAndroidBrowserSpeech(root), false);
    const outside = path.join(root, 'outside'); fs.mkdirSync(outside);
    fs.symlinkSync(outside, path.join(root, 'android/app/src/main/assets/public/browser-speech'));
    assert.throws(() => pruneAndroidBrowserSpeech(root), /linked/);
    assert.equal(fs.existsSync(outside), true);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

test('offline acquisition without a cache fails with guidance, and leaves no partial files', async () => {
  const root = temporary();
  try {
    const config = readConfig();
    config.source.url = 'http://127.0.0.1:9/unreachable/';
    fs.mkdirSync(path.join(root, 'config')); fs.writeFileSync(path.join(root, 'config/browser-speech.json'), JSON.stringify(config));
    await assert.rejects(ensureBrowserSpeechAssets(root, {}, () => {}, 1), error => {
      assert.match(error.message, /could not be downloaded \(offline or blocked\?\)/);
      assert.match(error.message, /npm run browser-speech:prepare/);
      assert.match(error.message, /ELIZA_BROWSER_SPEECH_DIR/);
      return true;
    });
    const cache = path.join(root, '.eliza/browser-speech', config.source.revision);
    const leftovers = fs.existsSync(cache) ? fs.readdirSync(cache, {recursive: true}).filter(name => /partial/.test(name)) : [];
    assert.deepEqual(leftovers, []);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});
