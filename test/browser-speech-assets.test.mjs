import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pruneAndroidBrowserSpeech} from '../scripts/browser-speech-assets.mjs';
const temporary=()=>fs.mkdtempSync(path.join(os.tmpdir(),'alpha-browser-speech-'));
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
