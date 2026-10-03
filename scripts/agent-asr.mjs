import { accessSync, constants, existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

const MODEL_SHA = '4baf807ea95de42a7f9df96e24a36fe835ac8fb5b6ca20d7539ef521c42e6a2b';

/** Configure installed, verified host ASR assets without downloading a model. */
export function agentAsrEnvironment(env = process.env, home = homedir()) {
  const mode = env.ALPHA_LOCAL_ASR || 'auto';
  if (!['auto', 'off', 'required'].includes(mode)) {
    throw Error('ALPHA_LOCAL_ASR must be auto, off or required');
  }
  if (mode === 'off') return {};

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
    ELIZA_WHISPER_BINARY: binary,
    ELIZA_WHISPER_MODEL: model,
    ELIZA_WHISPER_BINARY_SHA256: createHash('sha256').update(readFileSync(binary)).digest('hex'),
  };
}
