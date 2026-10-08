import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT, readConfig, browserSpeechFiles, browserSpeechManifest, ensureBrowserSpeechAssets, pruneAndroidBrowserSpeech} from '../scripts/browser-speech-assets.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-browser-speech-'));

test('pins are exact: model revision, file sizes and hashes, runtime package and license sources', () => {
  const config = readConfig();
  assert.match(config.source.revision, /^[0-9a-f]{40}$/);
  assert.ok(config.source.url.startsWith(`https://huggingface.co/${config.source.repository}/resolve/${config.source.revision}/`));
  assert.equal(config.language, 'en');
  for (const file of [...config.files, ...config.runtime.files]) { assert.match(file.sha256, /^[0-9a-f]{64}$/, file.path); assert.ok(file.bytes > 0, file.path); }
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  assert.equal(pkg.dependencies[config.runtime.package], config.runtime.version, 'exact runtime dependency');
  assert.equal(lock.packages[`node_modules/${config.runtime.package}`].version, config.runtime.version);
  for (const pinned of [config.source.modelCard, config.runtime.notices])
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, pinned.path))), pinned.sha256, pinned.path);
  // The runtime files the worker loads ship from the pinned npm package, not a CDN.
  const runtime = browserSpeechFiles().files.filter(file => ['wasm', 'glue'].includes(file.role));
  assert.deepEqual(runtime.map(file => file.published), ['browser-speech/ort/ort-wasm-simd-threaded.wasm', 'browser-speech/ort/ort-wasm-simd-threaded.mjs']);
  for (const file of runtime) assert.equal(sha256(fs.readFileSync(file.source)), file.sha256, file.source);
});

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

test('the browser manifest names every role with its published path, size and hash', () => {
  const {config, files} = browserSpeechFiles();
  const manifest = browserSpeechManifest(config, files);
  assert.equal(manifest.version, 1); assert.equal(manifest.engine, 'whisper'); assert.equal(manifest.language, 'en');
  assert.equal(manifest.revision, `${config.source.repository}@${config.source.revision}`);
  assert.deepEqual(Object.keys(manifest.files).sort(), ['decoder', 'encoder', 'generation', 'glue', 'vocab', 'wasm']);
  for (const [role, entry] of Object.entries(manifest.files)) {
    const file = files.find(item => item.role === role);
    assert.equal(`browser-speech/${entry.path}`, file.published); assert.equal(entry.sha256, file.sha256); assert.equal(entry.bytes, file.bytes);
  }
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
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['android:sync'], /cap sync android && node scripts\/browser-speech-assets\.mjs prune-android$/);
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
