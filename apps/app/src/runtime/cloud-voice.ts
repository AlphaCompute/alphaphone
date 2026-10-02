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
  stopPlayback(input?: { requestId: string }): Promise<void>;
  cancel(input: { requestId: string }): Promise<void>;
  addListener(event: 'recordingStopped', callback: (clip: VoiceClip) => void): Promise<PluginListenerHandle>;
  addListener(event: 'playbackEnded' | 'playbackFailed', callback: (event: { playbackId?: string }) => void): Promise<PluginListenerHandle>;
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
      let active = true, playbackId: string | undefined;
      let cleanup: Promise<void> | undefined;
      const handles = new Set<PluginListenerHandle>();
      const bounded = (operation: () => Promise<unknown>) => new Promise<void>(resolve => {
        const timer = setTimeout(resolve, 500);
        Promise.resolve().then(operation).catch(() => {}).finally(() => { clearTimeout(timer); resolve(); });
      });
      const remove = (handle: PluginListenerHandle) => bounded(() => handle.remove());
      let rejectInterrupted!: (reason: unknown) => void;
      const interrupted = new Promise<never>((_, reject) => { rejectInterrupted = reject; });
      void interrupted.catch(() => {});
      let resolveEnded!: () => void, rejectPlayback!: (reason: unknown) => void;
      const playback = new Promise<void>((resolve, reject) => { resolveEnded = resolve; rejectPlayback = reject; });
      void playback.catch(() => {});
      const dispose = () => {
        if (cleanup) return cleanup;
        active = false;
        // Request-scoped native stop cannot clear a newer account's playback.
        cleanup = Promise.all([
          bounded(() => native.cancel({ requestId })),
          bounded(() => native.stopPlayback({ requestId })),
          ...Array.from(handles, remove),
        ]).then(() => {});
        handles.clear();
        return cleanup;
      };
      const cancel = (reason: unknown) => {
        rejectInterrupted(reason || new DOMException('Playback cancelled', 'AbortError'));
        void dispose();
      };
      const onAbort = () => cancel(signal.reason);
      signal.addEventListener('abort', onAbort, { once: true });
      const unsubscribe = connectionController.subscribe(() => {
        try { check(); } catch (error) { cancel(error); }
      });
      const listen = async (event: 'playbackEnded' | 'playbackFailed') => {
        const pending = native.addListener(event, value => {
          if (!active || !playbackId || value.playbackId !== playbackId) return;
          try { check(); } catch (error) { cancel(error); return; }
          if (event === 'playbackEnded') resolveEnded();
          else rejectPlayback(new Error('Audio playback failed.'));
        }).then(handle => {
          if (!active) void remove(handle);
          else handles.add(handle);
        });
        await Promise.race([pending, interrupted]);
      };
      try {
        await listen('playbackEnded');
        await listen('playbackFailed');
        signal.throwIfAborted(); check();
        const result = await Promise.race([native.synthesize({ text, requestId, environment, credentialId }), interrupted]);
        check(); signal.throwIfAborted();
        playbackId = result.playbackId;
        await Promise.race([native.play({ playbackId }), interrupted]);
        await Promise.race([playback, interrupted]);
        check();
      } finally {
        signal.removeEventListener('abort', onAbort);
        unsubscribe();
        await dispose();
      }
    },
  };
}
