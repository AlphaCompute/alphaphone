import { accessSync, constants, existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { mkdtemp, chmod, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const MODEL_SHA = '4baf807ea95de42a7f9df96e24a36fe835ac8fb5b6ca20d7539ef521c42e6a2b';

/** Configure installed, verified host ASR assets without downloading a model. */
export function agentAsrEnvironment(env = process.env, home = homedir(), platform = process.platform) {
  const mode = env.ALPHA_LOCAL_ASR || 'auto';
  if (!['auto', 'off', 'required'].includes(mode)) {
    throw Error('ALPHA_LOCAL_ASR must be auto, off or required');
  }
  if (mode === 'off') return {};
  const backend = env.ALPHA_WHISPER_BACKEND || (platform === 'darwin' ? 'auto' : 'cpu');
  if (!['auto', 'cpu'].includes(backend)) throw Error('ALPHA_WHISPER_BACKEND must be auto or cpu');

  const binary = env.ALPHA_WHISPER_BIN || '/opt/homebrew/bin/whisper-cli';
  const model = env.ALPHA_ASR_MODEL || join(home, '.cache/alphaphone-asr/tiny.en/ggml-model.bin');
  if (!isAbsolute(binary) || !isAbsolute(model)) {
    throw Error('Local ASR requires absolute executable and model paths');
  }
  if (!existsSync(binary) || !existsSync(model)) {
    if (mode === 'required' || env.ALPHA_WHISPER_BIN || env.ALPHA_ASR_MODEL) {
      throw Error('Configured local ASR assets are missing');
    }
    return {};
  }
  const bs = statSync(binary), ms = statSync(model);
  if (!bs.isFile() || !ms.isFile() || bs.size > 32 * 1024 * 1024 || ms.size !== 77704698) {
    throw Error('Local ASR assets do not match the supported provider');
  }
  accessSync(binary, constants.X_OK);
  if (createHash('sha256').update(readFileSync(model)).digest('hex') !== MODEL_SHA) {
    throw Error('Local ASR model checksum does not match');
  }
  return {
    ELIZA_WHISPER_ENABLED: '1',
    ELIZA_WHISPER_BACKEND: backend,
    ELIZA_WHISPER_BINARY: binary,
    ELIZA_WHISPER_MODEL: model,
    ELIZA_WHISPER_BINARY_SHA256: createHash('sha256').update(readFileSync(binary)).digest('hex'),
  };
}

/** Compile automatic-backend kernels before accepting the first recording. */
export async function warmAgentAsr(config, {signal, run = promisify(execFile)} = {}) {
  if (config.ELIZA_WHISPER_ENABLED !== '1' || config.ELIZA_WHISPER_BACKEND !== 'auto') return {warmed: false};
  signal?.throwIfAborted();
  const directory = await mkdtemp(join(tmpdir(), 'alpha-asr-warmup-'));
  const started = performance.now();
  try {
    await chmod(directory, 0o700);
    // One second of synthetic silence, never microphone or user content.
    const wav = Buffer.alloc(44 + 32000);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(32000, 40);
    const input = join(directory, 'silence.wav');
    await writeFile(input, wav, {mode: 0o600});
    await run(config.ELIZA_WHISPER_BINARY, ['-m', config.ELIZA_WHISPER_MODEL, '-f', input,
      '-l', 'en', '-t', '4', '-nt', '-np', '-nf', '-bs', '1', '-bo', '1'], {
      cwd: directory, env: {PATH: process.env.PATH || '/usr/bin:/bin', LANG: 'C'},
      signal, timeout: 90000, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024,
    });
    signal?.throwIfAborted();
    return {warmed: true, elapsedMs: Math.round(performance.now() - started)};
  } catch (error) {
    if (signal?.aborted) throw error;
    throw Error('Local ASR warm-up failed. Check the installed backend or select ALPHA_WHISPER_BACKEND=cpu.', {cause: error});
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
}
