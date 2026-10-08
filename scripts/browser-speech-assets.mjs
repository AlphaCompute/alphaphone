#!/usr/bin/env node
// Self-hosted assets for in-browser English speech recognition (Whisper tiny.en on ONNX
// Runtime Web). The pinned inputs are in config/browser-speech.json.
//
//   node scripts/browser-speech-assets.mjs ensure          acquire missing model files (verified)
//   node scripts/browser-speech-assets.mjs check           verify without downloading (exit 1 if missing)
//   node scripts/browser-speech-assets.mjs prune-android   remove them from the synced Android web assets
//
// Model files are downloaded once at build time from the pinned revision into
// .eliza/browser-speech/<revision>/ (or ELIZA_BROWSER_SPEECH_DIR) and verified by size and
// SHA-256. The ONNX Runtime WebAssembly comes from the exact npm package in package-lock.
// The web build publishes them under browser-speech/; the browser fetches only from this
// app. Android uses its native on-device recognizer, so the synced APK assets omit them.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG = 'config/browser-speech.json';
export const PUBLISHED = 'browser-speech';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function readConfig(root = ROOT) { return JSON.parse(fs.readFileSync(path.join(root, CONFIG), 'utf8')); }
export function modelDirectory(root = ROOT, env = process.env, config = readConfig(root)) {
  const configured = env.ELIZA_BROWSER_SPEECH_DIR?.trim();
  return configured ? path.resolve(configured) : path.join(root, '.eliza/browser-speech', config.source.revision);
}
function packageDirectory(root, name) { return path.join(root, 'node_modules', name); }

function verifyFile(file, expected) {
  let stat;
  try { stat = fs.lstatSync(file); } catch (error) { if (error.code === 'ENOENT') return 'missing'; throw error; }
  if (!stat.isFile()) return 'not a regular file';
  if (stat.size !== expected.bytes) return `size ${stat.size}, expected ${expected.bytes}`;
  if (sha256(fs.readFileSync(file)) !== expected.sha256) return 'SHA-256 mismatch';
  return '';
}

/**
 * Every published file with its verified source: model files from the acquisition directory,
 * runtime files from the pinned npm package. Problems are returned, never silently skipped.
 */
export function browserSpeechFiles(root = ROOT, env = process.env) {
  const config = readConfig(root), directory = modelDirectory(root, env, config), problems = [], files = [];
  const runtime = packageDirectory(root, config.runtime.package);
  let installed = '';
  try { installed = JSON.parse(fs.readFileSync(path.join(runtime, 'package.json'), 'utf8')).version; } catch { /* reported below */ }
  if (installed !== config.runtime.version) problems.push(`${config.runtime.package} ${installed || 'is not installed'}; ${CONFIG} pins ${config.runtime.version} (run npm ci)`);
  const model = config.model;
  for (const entry of config.files) {
    const source = path.join(directory, entry.path), problem = verifyFile(source, entry);
    if (problem) problems.push(`${entry.path}: ${problem}`);
    files.push({role: entry.role, published: `${PUBLISHED}/${model}/${path.posix.basename(entry.path)}`, source, bytes: entry.bytes, sha256: entry.sha256});
  }
  for (const entry of config.runtime.files) {
    const source = path.join(runtime, entry.path), problem = installed === config.runtime.version ? verifyFile(source, entry) : '';
    if (problem) problems.push(`${config.runtime.package}/${entry.path}: ${problem}`);
    files.push({role: entry.role, published: `${PUBLISHED}/ort/${path.posix.basename(entry.path)}`, source, bytes: entry.bytes, sha256: entry.sha256});
  }
  return {config, directory, files, problems};
}

/** Manifest the browser worker reads; paths are relative to browser-speech/manifest.json. */
export function browserSpeechManifest(config, files) {
  const byRole = Object.fromEntries(files.map(file => [file.role, {path: file.published.slice(PUBLISHED.length + 1), bytes: file.bytes, sha256: file.sha256}]));
  return {
    version: 1, engine: config.engine, model: config.model, language: config.language,
    revision: `${config.source.repository}@${config.source.revision}`,
    runtime: `${config.runtime.package} ${config.runtime.version} (WebAssembly, single thread)`,
    files: {encoder: byRole.encoder, decoder: byRole.decoder, vocab: byRole.vocab, generation: byRole.generation, wasm: byRole.wasm, glue: byRole.glue},
  };
}

async function download(url, destination, expected, attempts = 3) {
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  const partial = `${destination}.partial-${process.pid}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {redirect: 'follow'});
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      const hash = createHash('sha256'), out = fs.createWriteStream(partial, {flags: 'w', mode: 0o644});
      let bytes = 0;
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > expected.bytes) throw new Error(`more than the pinned ${expected.bytes} bytes`);
        hash.update(chunk);
        if (!out.write(chunk)) await new Promise(resolve => out.once('drain', resolve));
      }
      await new Promise((resolve, reject) => out.end(error => error ? reject(error) : resolve()));
      if (bytes !== expected.bytes) throw new Error(`received ${bytes} bytes, expected ${expected.bytes}`);
      const digest = hash.digest('hex');
      if (digest !== expected.sha256) throw new Error(`SHA-256 ${digest} does not match the pin`);
      fs.renameSync(partial, destination);
      return;
    } catch (error) {
      fs.rmSync(partial, {force: true});
      if (attempt >= attempts) throw new Error(`Could not acquire ${url}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
}

/** Acquire any missing or corrupt model file from the pinned revision, then re-verify everything. */
export async function ensureBrowserSpeechAssets(root = ROOT, env = process.env, log = console.log, attempts = 3) {
  const config = readConfig(root), directory = modelDirectory(root, env, config);
  for (const entry of config.files) {
    const file = path.join(directory, entry.path), problem = verifyFile(file, entry);
    if (!problem) continue;
    if (env.ELIZA_BROWSER_SPEECH_DIR?.trim()) throw new Error(`ELIZA_BROWSER_SPEECH_DIR ${directory}: ${entry.path}: ${problem}`);
    if (problem !== 'missing') fs.rmSync(file, {force: true});
    log(`Acquiring browser speech ${entry.path} (${(entry.bytes / 1e6).toFixed(1)} MB) from ${config.source.repository}@${config.source.revision.slice(0, 12)}`);
    try { await download(new URL(entry.path, config.source.url).href, file, entry, attempts); }
    catch (error) {
      throw new Error(`${error.message}\nBrowser speech model files are not cached in ${path.relative(root, directory) || directory} and could not be downloaded (offline or blocked?). `
        + `Connect once and rerun npm run browser-speech:prepare to cache the pinned files, or set ELIZA_BROWSER_SPEECH_DIR to a directory that already holds them (verified, never written).`);
    }
  }
  const result = browserSpeechFiles(root, env);
  if (result.problems.length) throw new Error(`Browser speech assets are not ready:\n- ${result.problems.join('\n- ')}`);
  return result;
}

/** Android packages its own native recognizer; never ship the browser model inside an APK. */
export function pruneAndroidBrowserSpeech(root = ROOT) {
  const target = path.join(root, 'android/app/src/main/assets/public', PUBLISHED);
  let stat;
  try { stat = fs.lstatSync(target); } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  if (stat.isSymbolicLink()) throw new Error(`Refusing to follow a linked ${target}`);
  fs.rmSync(target, {recursive: true, force: true});
  return true;
}

async function main(argv) {
  const [command] = argv;
  if (command === 'ensure') {
    const {files, directory} = await ensureBrowserSpeechAssets();
    const total = files.reduce((sum, file) => sum + file.bytes, 0);
    console.log(`Browser speech assets verified: ${files.length} files, ${(total / 1e6).toFixed(1)} MB (${path.relative(ROOT, directory) || directory}).`);
    return 0;
  }
  if (command === 'check') {
    const {problems} = browserSpeechFiles();
    if (problems.length) { console.error(`Browser speech assets are not ready (run npm run browser-speech:prepare):\n- ${problems.join('\n- ')}`); return 1; }
    console.log('Browser speech assets verified.');
    return 0;
  }
  if (command === 'prune-android') {
    console.log(pruneAndroidBrowserSpeech() ? 'Removed browser speech assets from the Android web payload.' : 'Android web payload has no browser speech assets.');
    return 0;
  }
  console.error('Usage: node scripts/browser-speech-assets.mjs ensure|check|prune-android');
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => { console.error(error.message); process.exitCode = 1; });
}
