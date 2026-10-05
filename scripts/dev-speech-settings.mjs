import {constants, openSync, closeSync, fstatSync, readSync} from 'node:fs';
import {join, isAbsolute} from 'node:path';

const modes = {
  ALPHA_LOCAL_ASR: ['auto', 'off', 'required'],
  ALPHA_LOCAL_TTS: ['auto', 'off', 'required'],
  ALPHA_WHISPER_BACKEND: ['auto', 'cpu'],
};
const paths = new Set(['ALPHA_WHISPER_BIN', 'ALPHA_ASR_MODEL', 'ALPHA_TTS_LIBRARY', 'ALPHA_TTS_MODEL_DIR']);

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
  for (const [key, value] of Object.entries(saved)) {
    if (!Object.hasOwn(modes, key) && !paths.has(key)) throw Error('Unsupported local speech setting. Store credentials separately.');
    if (typeof value !== 'string' || (Object.hasOwn(modes, key) ? !modes[key].includes(value) : !isAbsolute(value) || value.includes('\0'))) {
      throw Error('Invalid local speech setting. Use supported modes and absolute asset paths.');
    }
  }
  // Explicit environment choices, including "off", always win over saved defaults.
  return {...saved, ...inherited};
}
