import { registerPlugin } from '../platform-plugins';
import { type PluginListenerHandle } from '@capacitor/core';
import { connectionController } from './connection-ui';

export type VoiceClip = { recordingId: string; durationMs: number };
const native = registerPlugin<{
  startRecording(): Promise<{ recordingId: string; maxDurationMs: number }>;
  stopRecording(): Promise<VoiceClip>;
  cancelRecording(): Promise<void>;
  transcribeRecording(input: { recordingId: string; requestId: string; environment: string; credentialId: string }): Promise<{ text: string; local: false }>;
  synthesize(input: { text: string; requestId: string; environment: string; credentialId: string }): Promise<{ playbackId: string }>;
  play(input: { playbackId: string }): Promise<void>;
  stopPlayback(): Promise<void>;
  cancel(input: { requestId: string }): Promise<void>;
  addListener(event: 'recordingStopped', callback: (clip: VoiceClip) => void): Promise<PluginListenerHandle>;
  addListener(event: 'playbackEnded' | 'playbackFailed', callback: () => void): Promise<PluginListenerHandle>;
}>('AlphaVoiceCloud');

/** Binds all audio to the explicitly selected account. Native code owns the
 * private recording, bearer credential, upload and decoded playback file. */
export function createCloudVoice() {
  const environment = connectionController.getCloudEnvironment();
  const binding = connectionController.getCloudClient();
  const sessionId = binding?.sessionId, credentialId = binding?.credentialId;
  if (!environment || !sessionId || !credentialId) throw new Error('Sign in to Eliza Cloud to use Cloud voice.');
  const check = () => {
    if (environment !== connectionController.getCloudEnvironment() || sessionId !== connectionController.getCloudClient()?.sessionId) throw new DOMException('Voice account changed', 'AbortError');
  };
  return {
    cloud: true as const,
    async startRecording() { check(); const result = await native.startRecording(); check(); return result; },
    async stopRecording() { check(); const result = await native.stopRecording(); check(); return result; },
    async transcribeRecording(input: { recordingId: string; requestId: string }) {
      check(); const result = await native.transcribeRecording({ ...input, environment, credentialId }); check();
      if (typeof result.text !== 'string' || !result.text.trim() || result.local !== false) throw new Error('Eliza Cloud returned no usable transcript.');
      return result;
    },
    cancel: (input: { requestId: string }) => native.cancel(input),
    async cancelRecording() { await Promise.all([native.cancelRecording(), native.stopPlayback()]); },
    addListener: (event: 'recordingStopped', callback: (clip: VoiceClip) => void) => native.addListener(event, value => {
      try { check(); callback(value); } catch { /* Stale account events never update the new account. */ }
    }),
    async speak(text: string, signal: AbortSignal) {
      check(); signal.throwIfAborted();
      const requestId = crypto.randomUUID();
      let rejectInterrupted: (reason: unknown) => void = () => {};
      let resolveEnded: () => void = () => {};
      let rejectPlayback: (reason: unknown) => void = () => {};
      const interrupted = new Promise<never>((_, reject) => { rejectInterrupted = reject; });
      void interrupted.catch(() => {});
      const playback = new Promise<void>((resolve, reject) => { resolveEnded = resolve; rejectPlayback = reject; });
      // Playback may fail before synthesis settles; observe the promise now.
      void playback.catch(() => {});
      const cancel = () => {
        void native.cancel({ requestId }).catch(() => {});
        void native.stopPlayback().catch(() => {});
        rejectInterrupted(signal.reason || new DOMException('Playback cancelled', 'AbortError'));
      };
      signal.addEventListener('abort', cancel, { once: true });
      const handles: PluginListenerHandle[] = [];
      try {
        handles.push(await native.addListener('playbackEnded', resolveEnded));
        handles.push(await native.addListener('playbackFailed', () => rejectPlayback(new Error('Audio playback failed.'))));
        signal.throwIfAborted(); check();
        const synthesis = native.synthesize({ text, requestId, environment, credentialId });
        if (signal.aborted) cancel();
        const result = await Promise.race([synthesis, interrupted]);
        check(); signal.throwIfAborted();
        await Promise.race([native.play({ playbackId: result.playbackId }), interrupted]);
        await Promise.race([playback, interrupted]);
        check();
      } finally {
        signal.removeEventListener('abort', cancel);
        await Promise.all(handles.map(handle => handle.remove()));
        await native.stopPlayback().catch(() => {});
      }
    },
  };
}
