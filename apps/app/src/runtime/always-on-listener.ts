import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '../platform-plugins';
import { listenerStartsVoice, parseAssistantInvocation, parseInvocationUnlocked, parseListenerStatus, type AssistantInvocation, type ListenerStatus } from './always-on-listener-status';

export type { AssistantInvocation, ListenerState, ListenerStatus } from './always-on-listener-status';

type Reply = Promise<Record<string, unknown>>;
const listener = registerPlugin<{ status(): Reply; pause(): Reply; turnOff(): Reply; openSettings(): Promise<{ opened?: unknown }> }>('AlphaListener');
const agent = registerPlugin<{ takeInvocation?(): Reply }>('Agent');

const nativeListener = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('AlphaListener');
async function ask(method: 'status' | 'pause' | 'turnOff'): Promise<ListenerStatus> {
  if (!nativeListener()) return { available: false };
  try { return parseListenerStatus(await listener[method]()); } catch { return { available: false }; }
}

/** Status of the image's listener; `{available:false}` on the web build and on phones without it. */
export const listenerStatus = () => ask('status');
/** Pauses until the user resumes in the listener's own UI. */
export const pauseListener = () => ask('pause');
/** Turns listening off; consent is kept. Turning it back on happens only in the listener's UI. */
export const turnOffListener = () => ask('turnOff');

/** Opens the listener's consent and settings screen. */
export async function openListenerSettings(): Promise<boolean> {
  if (!nativeListener()) return false;
  try { return (await listener.openSettings()).opened === true; } catch { return false; }
}

/**
 * 'listener' when the wake phrase opened the assistant surface, 'assist' for other assist entries,
 * otherwise null. One-shot: the native side clears the listener origin when it is read, so later
 * calls for the same launch return 'assist'.
 */
export async function assistantInvocation(): Promise<AssistantInvocation> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('Agent')) return null;
  try { return parseAssistantInvocation(await agent.takeInvocation?.()); } catch { return null; }
}

/**
 * The listener's wake phrase opened the assistant surface: start the voice assistant (on-device
 * VAD, streaming ASR and speech, #423) once the shell is ready. The native origin is consumed when
 * it is read, so it is read only when the shell can act on it, and one invocation starts at most
 * one conversation. Runs on the first render and whenever the surface returns to the foreground
 * (a new invocation of the single-task activity).
 */
export function installListenerInvocation(shell: () => { startVoice?: () => unknown; live?: boolean } | undefined, state: { connectionOpen: () => boolean; voiceActive: () => boolean }) {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('Agent')) return () => {};
  let checking = false, disposed = false;
  const check = async () => {
    if (checking || disposed || document.hidden) return;
    const current = shell();
    if (!current?.startVoice || current.live === false) return;
    checking = true;
    try {
      const raw = await agent.takeInvocation?.().catch(() => null);
      if (disposed || current !== shell()) return;
      const start = listenerStartsVoice({
        invocation: parseAssistantInvocation(raw), unlocked: parseInvocationUnlocked(raw), hidden: document.hidden,
        dialogOpen: !!document.querySelector('dialog[open]'), connectionOpen: state.connectionOpen(), voiceActive: state.voiceActive(),
      });
      if (start) void current.startVoice();
    } finally { checking = false; }
  };
  // The shell mounts after this installs; poll briefly for the first render, then follow visibility.
  let tries = 0;
  const first = setInterval(() => { if (shell()?.startVoice || ++tries > 50) { clearInterval(first); void check(); } }, 100);
  const visible = () => { if (!document.hidden) void check(); };
  document.addEventListener('visibilitychange', visible);
  return () => { disposed = true; clearInterval(first); document.removeEventListener('visibilitychange', visible); };
}
