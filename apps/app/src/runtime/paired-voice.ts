import { registerPlugin } from '../platform-plugins';
import { type PluginListenerHandle } from '@capacitor/core';
import { connectionController } from './connection-ui';
type Binding = { origin: string; ownerId: string; expiresAt: number; sessionId: string };
const native = registerPlugin<{
  pairedVoiceStatus(input: Binding & { requestId: string }): Promise<{ ready: boolean }>;
  pairedTranscriptionStatus(input: Binding & { requestId: string }): Promise<{ ready: boolean; provider: string }>;
  transcribePairedRecording(input: Binding & { recordingId: string; requestId: string }): Promise<{ text: string; local: true; provider: string }>;
  synthesizePaired(input: Binding & { text: string; requestId: string }): Promise<{ playbackId: string }>;
  synthesizeBrowserReading(input: Binding & { readingToken: string; requestId: string }): Promise<{ playbackId: string }>;
  play(input: { playbackId: string }): Promise<void>;
  stopPlayback(): Promise<void>;
  cancel(input: { requestId: string }): Promise<void>;
  addListener(event: 'playbackEnded' | 'playbackFailed', callback: () => void): Promise<PluginListenerHandle>;
}>('AlphaVoiceCloud');
/** Explicit selected-agent speech operations. Native code owns credentials and audio. */
export function createPairedVoice() {
  const binding = connectionController.getPairedVoiceBinding();
  if (!binding) return null;
  const check = () => {
    if (JSON.stringify(connectionController.getPairedVoiceBinding()) !== JSON.stringify(binding) || connectionController.getSnapshot().open || document.hidden) throw new DOMException('Voice connection changed', 'AbortError');
  };
  async function operation<T>(signal: AbortSignal, run: (requestId: string, interrupted: Promise<never>) => Promise<T>): Promise<T> {
    check(); signal.throwIfAborted();
    const requestId = crypto.randomUUID();
    let reject!: (error: unknown) => void;
    const interrupted = new Promise<never>((_, fail) => { reject = fail; }); void interrupted.catch(() => {});
    const cancel = () => { void native.cancel({ requestId }).catch(() => {}); void native.stopPlayback().catch(() => {}); reject(new DOMException('Playback cancelled', 'AbortError')); };
    const unsubscribe = connectionController.subscribe(() => { try { check(); } catch { cancel(); } });
    signal.addEventListener('abort', cancel, { once: true });
    try { const result = await run(requestId, interrupted); check(); signal.throwIfAborted(); return result; }
    finally { unsubscribe(); signal.removeEventListener('abort', cancel); }
  }
  return {
    async ready(signal: AbortSignal) { return operation(signal, async (requestId, interrupted) => { const pending = native.pairedVoiceStatus({ ...binding, requestId }); if (signal.aborted) void native.cancel({requestId}); return (await Promise.race([pending, interrupted])).ready === true; }); },
    async transcriptionReady(signal: AbortSignal) { return operation(signal, async (requestId, interrupted) => { const pending = native.pairedTranscriptionStatus({ ...binding, requestId }); if (signal.aborted) void native.cancel({requestId}); const result = await Promise.race([pending, interrupted]); return result.ready === true && result.provider === 'standalone-whisper.cpp'; }); },
    async transcribe(recordingId: string, signal: AbortSignal) { return operation(signal, async (requestId, interrupted) => { const pending = native.transcribePairedRecording({ ...binding, recordingId, requestId }); if (signal.aborted) void native.cancel({requestId}); const result = await Promise.race([pending, interrupted]); if (result.local !== true || result.provider !== 'standalone-whisper.cpp' || typeof result.text !== 'string' || !result.text.trim()) throw new Error('Selected agent returned no usable transcript'); return result; }); },
    async speak(text: string, signal: AbortSignal, readingToken?: string) {
      return operation(signal, async (requestId, interrupted) => {
        const handles: PluginListenerHandle[] = [];
        let ended!: () => void, failed!: (error: unknown) => void;
        const playback = new Promise<void>((resolve, reject) => { ended = resolve; failed = reject; }); void playback.catch(() => {});
        try {
          handles.push(await native.addListener('playbackEnded', ended));
          handles.push(await native.addListener('playbackFailed', () => failed(new Error('Audio playback failed'))));
          check(); signal.throwIfAborted();
          const pending = readingToken ? native.synthesizeBrowserReading({ ...binding, readingToken, requestId }) : native.synthesizePaired({ ...binding, text, requestId }); if (signal.aborted) void native.cancel({requestId});
          const result = await Promise.race([pending, interrupted]); check(); signal.throwIfAborted();
          await Promise.race([native.play({ playbackId: result.playbackId }), interrupted]);
          await Promise.race([playback, interrupted]);
        } finally { await Promise.all(handles.map(handle => handle.remove())); await native.stopPlayback().catch(() => {}); }
      });
    },
  };
}
