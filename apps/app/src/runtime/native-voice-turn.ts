import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '../platform-plugins';
import { setNativeVoiceStageSink } from './voice-timing';

/**
 * Issue #395 bridge from renderer agent-turn events to the native latency collector
 * (AlphaVoiceCloudPlugin.markVoiceTurn, VoiceLatencyTrials). The renderer reports only a stage name
 * ('asr-final', 'request', 'first-token') and the native turn id it was given; the native side
 * stamps the monotonic time on arrival. No text, account or conversation identifier is sent.
 */
type NativeVoiceTiming = {
  markVoiceTurn(input: { stage: 'asr-final' | 'request' | 'first-token'; voiceTurnId?: string }): Promise<{ marked?: boolean; voiceTurnId?: string }>;
  nativeVoiceTiming(): Promise<unknown>;
};
const plugin = () => registerPlugin<NativeVoiceTiming>('AlphaVoiceCloud');
let installed = false;

/** On the phone, forward conversation stage marks to the native collector. Idempotent. */
export function installNativeVoiceTurnMarks() {
  if (installed || !Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('AlphaVoiceCloud')) return;
  installed = true;
  setNativeVoiceStageSink(async (stage, voiceTurnId) => {
    const result = await plugin().markVoiceTurn({ stage, ...(voiceTurnId ? { voiceTurnId } : {}) });
    return typeof result?.voiceTurnId === 'string' ? result.voiceTurnId : undefined;
  });
}

/**
 * The native timing export (alpha-native-voice-timing-v3) for diagnostics, or null when it is not
 * available within the time limit. buildDiagnostics copies timing fields only.
 */
export async function readNativeVoiceTiming(timeoutMs = 10_000): Promise<unknown> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('AlphaVoiceCloud')) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([plugin().nativeVoiceTiming(), new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); })]);
  } catch { return null; }
  finally { if (timer) clearTimeout(timer); }
}
