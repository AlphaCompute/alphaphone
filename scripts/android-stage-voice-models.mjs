#!/usr/bin/env node
/**
 * Stage the on-device voice bundle into the APK assets from operator-supplied files.
 *
 *   node scripts/android-stage-voice-models.mjs --from <directory> [--lexicon <file>]
 *   node scripts/android-stage-voice-models.mjs --plan
 *
 * Every model row of android/voice-host/qualified-voice-host.json that has recorded bytes is looked
 * up in <directory> by its bundle path (for example tts/kokoro/kokoro-82m-v1_0.gguf) or by its file
 * name, checked by size and SHA-256, and copied into android/app/src/main/assets/voice/v1. The
 * lexicon comes from scripts/android-voice-lexicon.mjs (default .eliza/voice-lexicon/en-us-lexicon.tsv).
 * Rows without recorded bytes (the ASR pair today) are never staged, so local ASR stays
 * unavailable and the product stays on the Cloud route. Nothing is downloaded or repaired: an
 * existing target with other bytes is refused. `--plan` prints the pinned rows and their sources.
 */
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {VOICE_ASSET_ROOT, VOICE_BUNDLE_FORMAT, VOICE_HOST_MANIFEST, pinnedVoiceFiles, readVoiceHost, verifyVoiceHost} from './stage-embedding-host.mjs';
import {DEFAULT_OUTPUT} from './android-voice-lexicon.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Finds a pinned row's bytes under `from`, by bundle path first and then by file name. */
export function locate(from, row) {
  for (const candidate of [path.join(from, row.path), path.join(from, path.basename(row.path))]) {
    if (!fs.existsSync(candidate)) continue;
    if (fs.lstatSync(candidate).isSymbolicLink()) throw new Error(`Refusing linked input ${candidate}`);
    if (fs.statSync(candidate).size === row.bytes && hash(candidate) === row.sha256) return candidate;
    throw new Error(`${candidate} does not match the pinned ${row.path} (${row.sha256}, ${row.bytes} bytes)`);
  }
  return null;
}

export function stageVoiceModels(productRoot, {from, lexicon = path.join(productRoot, DEFAULT_OUTPUT)}) {
  const manifest = readVoiceHost(productRoot);
  const rows = manifest.models.filter(row => row.sha256 !== null).map(row => ({path: row.path, role: row.role, sha256: row.sha256, bytes: row.bytes}));
  if (manifest.lexicon.sha256 === null) throw new Error(`No lexicon is recorded in ${VOICE_HOST_MANIFEST}; run node scripts/android-voice-lexicon.mjs --cmudict <cmudict.dict> --record first`);
  const files = [];
  for (const row of rows) {
    const source = locate(path.resolve(from), row);
    if (!source) throw new Error(`Missing ${row.path} in ${from}; pinned source ${manifest.models.find(item => item.path === row.path).source}`);
    files.push({...row, source});
  }
  const lexiconRow = pinnedVoiceFiles(manifest).find(row => row.role === 'lexicon');
  if (!fs.existsSync(lexicon) || fs.statSync(lexicon).size !== lexiconRow.bytes || hash(lexicon) !== lexiconRow.sha256)
    throw new Error(`${lexicon} is not the recorded lexicon (${lexiconRow.sha256}); regenerate it with node scripts/android-voice-lexicon.mjs`);
  files.push({...lexiconRow, source: lexicon});
  const target = path.join(productRoot, VOICE_ASSET_ROOT);
  // Inside the product tree no directory on the way to the assets may be a link.
  for (let p = target; p !== productRoot && p !== path.dirname(p); p = path.dirname(p)) if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) throw new Error('Voice assets must not traverse a link');
  for (const row of files) {
    const destination = path.join(target, row.path);
    if (fs.existsSync(destination) && (fs.lstatSync(destination).isSymbolicLink() || hash(destination) !== row.sha256))
      throw new Error(`${path.relative(productRoot, destination)} already exists with other bytes; review before replacing`);
  }
  for (const row of files) {
    const destination = path.join(target, row.path);
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    if (!fs.existsSync(destination)) fs.copyFileSync(row.source, destination, fs.constants.COPYFILE_EXCL);
  }
  const bundle = {format: VOICE_BUNDLE_FORMAT, qualifiedVoiceHostSha256: hash(path.join(productRoot, VOICE_HOST_MANIFEST)),
    files: files.map(({source, ...row}) => row).sort((a, b) => a.path.localeCompare(b.path))};
  fs.writeFileSync(path.join(target, 'manifest.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  return {staged: bundle.files.map(row => row.path), asr: bundle.files.some(row => row.role === 'asr-model')};
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--plan') {
    const manifest = readVoiceHost(root);
    for (const row of manifest.models) console.log(`${row.path}\t${row.sha256 ?? 'not pinned'}\t${row.bytes ?? '-'}\t${row.source ?? row.status}`);
    console.log(`${manifest.lexicon.path}\t${manifest.lexicon.sha256 ?? 'not recorded'}\tgenerated by ${manifest.lexicon.generator} from ${manifest.lexicon.source.url}`);
    return;
  }
  const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  for (let i = 0; i < args.length; i++) {
    if (['--from', '--lexicon'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) { i++; continue; }
    throw new Error('Usage: node scripts/android-stage-voice-models.mjs --from <directory> [--lexicon <file>] | --plan');
  }
  if (!option('--from')) throw new Error('--from <directory of pinned voice models> is required');
  const result = stageVoiceModels(root, {from: option('--from'), ...(option('--lexicon') ? {lexicon: path.resolve(option('--lexicon'))} : {})});
  const admission = verifyVoiceHost(root, {allowAbsentRuntime: true});
  console.log(JSON.stringify({...result, admission: admission.status, note: result.asr ? 'ASR pair staged' : 'No ASR pair staged: localSpeechStatus reports ready:false and the product stays on Cloud'}, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
