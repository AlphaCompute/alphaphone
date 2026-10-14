import {constants, openSync, closeSync, fstatSync, readSync} from 'node:fs';
import {join, isAbsolute} from 'node:path';

import {RENAMED, RETIRED} from './speech-env.mjs';

// Upstream elizaOS names only (scripts/speech-env.mjs).
const modes = {
  ELIZA_ASR_ENABLED: ['0', '1'],
  ELIZA_PARADEE_ENABLED: ['0', '1'],
};
const paths = new Set(['ELIZA_INFERENCE_LIBRARY', 'ELIZA_ASR_MODEL_DIR', 'ELIZA_PARADEE_MODEL_DIR']);
// Saved files written before the upstream names were adopted keep working: a renamed key is read
// as its upstream replacement (never written back; the upstream key wins when both exist). The old
// auto/off/required modes map to unset/0/1.
const legacyMode = {auto: undefined, off: '0', required: '1'};

/** Host-only, nonsecret asset selection. Existing asset admission still runs at startup. */
export function developmentSpeechEnvironment(profile, inherited = process.env) {
  const file = join(profile, 'local-speech.json');
  let fd;
  try { fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
  catch (error) { if (error.code === 'ENOENT') return {...inherited}; throw error; }
  let saved;
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || (stat.mode & 0o077) || (process.getuid && stat.uid !== process.getuid())) {
      throw Error('Local speech settings must be an owner-only regular file.');
    }
    if (stat.size > 16384) throw Error('Local speech settings are too large.');
    const bytes = Buffer.alloc(16385); let length = 0;
    while (length < bytes.length) { const count = readSync(fd, bytes, length, bytes.length - length, null); if (!count) break; length += count; }
    if (length > 16384) throw Error('Local speech settings are too large.');
    const text = bytes.subarray(0, length).toString('utf8');
    try { saved = JSON.parse(text); } catch { throw Error('Local speech settings must contain valid JSON.'); }
  } finally { closeSync(fd); }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw Error('Local speech settings must be an object.');
  // A retired key (Whisper CLI, single ASR model, Kokoro) has no equivalent: it is ignored, never applied.
  for (const name of RETIRED) if (Object.hasOwn(saved, name)) {
    delete saved[name];
    console.warn(`local-speech.json: ${name} is retired and ignored; configure ELIZA_INFERENCE_LIBRARY, ELIZA_ASR_MODEL_DIR and ELIZA_PARADEE_MODEL_DIR.`);
  }
  for (const [old, replacement] of Object.entries(RENAMED)) if (Object.hasOwn(saved, old)) {
    let value = saved[old];
    if (Object.hasOwn(modes, replacement)) {
      if (!Object.hasOwn(legacyMode, value)) throw Error('Invalid local speech setting. Use supported modes and absolute asset paths.');
      value = legacyMode[value];
    }
    if (!Object.hasOwn(saved, replacement) && value !== undefined) saved[replacement] = value;
    delete saved[old];
    console.warn(`local-speech.json: ${old} is read as ${replacement}; rename it there.`);
  }
  for (const [key, value] of Object.entries(saved)) {
    if (!Object.hasOwn(modes, key) && !paths.has(key) && key !== 'ELIZA_INFERENCE_LIBRARY_SHA256') throw Error('Unsupported local speech setting. Store credentials separately.');
    if (typeof value !== 'string' || (Object.hasOwn(modes, key) ? !modes[key].includes(value) : key === 'ELIZA_INFERENCE_LIBRARY_SHA256' ? !/^[a-f0-9]{64}$/.test(value) : !isAbsolute(value) || value.includes('\0'))) {
      throw Error('Invalid local speech setting. Use supported modes and absolute asset paths.');
    }
  }
  // Explicit environment choices, including "off", always win over saved defaults.
  return {...saved, ...inherited};
}
