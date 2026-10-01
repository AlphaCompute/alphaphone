import { planLocalSpeech } from './local-speech-text';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { connectionController } from './connection-ui';
const native = registerPlugin<{
  localSpeechStatus(input: { requestId: string }): Promise<{ ready: boolean; execution: string }>;
  transcribeLocalRecording(input: { recordingId: string; requestId: string }): Promise<{ text: string; local: true; execution: string }>;
  synthesizeLocal(input: { text: string; requestId: string }): Promise<{ playbackId: string; execution: string }>;
  play(input: { playbackId: string }): Promise<void>;
  stopPlayback(): Promise<void>;
  releaseLocalSpeech(): Promise<void>;
  cancel(input: { requestId: string }): Promise<void>;
  addListener(event: 'playbackEnded' | 'playbackFailed', callback: (event: { playbackId?: string }) => void): Promise<PluginListenerHandle>;
}>('AlphaVoiceCloud');
let releaseWatcherInstalled = false;
function installReleaseWatcher() {
  if (releaseWatcherInstalled) return;
  releaseWatcherInstalled = true;
  const binding = () => [connectionController.getSnapshot().session?.sessionId, connectionController.getCloudClient()?.sessionId, document.documentElement.dataset.connectionMode].join(':');
  let previous = binding();
  const releaseChangedBinding = () => {
    const current = binding();
    if (current !== previous) { previous = current; void native.releaseLocalSpeech().catch(() => {}); }
  };
  connectionController.subscribe(releaseChangedBinding);
  if (typeof MutationObserver !== 'undefined') new MutationObserver(releaseChangedBinding).observe(document.documentElement, { attributes: true, attributeFilter: ['data-connection-mode'] });
}
/** On-device CPU speech. No origin, credential, provider API, or HTTP fallback. */
export function createOnDeviceVoice() {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('AlphaVoiceCloud') || document.documentElement.dataset.connectionMode === 'mock') return null;
  installReleaseWatcher();
  const binding = () => [connectionController.getSnapshot().session?.sessionId, connectionController.getCloudClient()?.sessionId, document.documentElement.dataset.connectionMode].join(':');
  const selected = binding();
  const check = () => {
    if (document.hidden || document.documentElement.dataset.connectionMode === 'mock' || connectionController.getSnapshot().open || selected !== binding()) throw new DOMException('Voice selection changed', 'AbortError');
  };
  async function operation<T>(signal: AbortSignal, run: (id: string, interrupted: Promise<never>) => Promise<T>): Promise<T> {
    check(); signal.throwIfAborted();
    const id = crypto.randomUUID(); let reject!: (reason: unknown) => void;
    const interrupted = new Promise<never>((_, fail) => { reject = fail; }); void interrupted.catch(() => {});
    const cancel = () => { void native.cancel({ requestId: id }).catch(() => {}); void native.stopPlayback().catch(() => {}); reject(new DOMException('Voice cancelled', 'AbortError')); };
    const unsubscribe = connectionController.subscribe(() => { try { check(); } catch { cancel(); } });
    const modeChanged = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(() => { try { check(); } catch { cancel(); } });
    modeChanged?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-connection-mode'] });
    const visibility = () => { if (document.hidden) cancel(); };
    signal.addEventListener('abort', cancel, { once: true }); document.addEventListener('visibilitychange', visibility);
    try { const result = await run(id, interrupted); check(); signal.throwIfAborted(); return result; }
    finally { modeChanged?.disconnect(); signal.removeEventListener('abort', cancel); document.removeEventListener('visibilitychange', visibility); unsubscribe(); }
  }
  return {
    async ready(signal: AbortSignal) { return operation(signal, async (requestId, interrupted) => { const result = await Promise.race([native.localSpeechStatus({ requestId }), interrupted]); return result.ready === true && result.execution === 'device'; }); },
    async transcribe(recordingId: string, signal: AbortSignal) { return operation(signal, async (requestId, interrupted) => { const result = await Promise.race([native.transcribeLocalRecording({ recordingId, requestId }), interrupted]); if (result.execution !== 'device' || result.local !== true || typeof result.text !== 'string' || !result.text.trim()) throw new Error('No usable on-device transcript'); return result; }); },
    async speak(text: string, signal: AbortSignal) {
      const chunks = planLocalSpeech(text);
      return operation(signal, async (requestId, interrupted) => {
        let expected: string | undefined; let ended!: () => void, failed!: (error: Error) => void;

        const handles: PluginListenerHandle[] = [];
        try {
          handles.push(await native.addListener('playbackEnded', event => { if (expected && event.playbackId === expected) ended(); }));
          handles.push(await native.addListener('playbackFailed', event => { if (expected && event.playbackId === expected) failed(new Error('On-device playback failed')); }));
          check(); signal.throwIfAborted();
          for (const chunk of chunks) {
            check(); signal.throwIfAborted();
            const completed = new Promise<void>((resolve, reject) => { ended = resolve; failed = reject; }); void completed.catch(() => {});
            const result = await Promise.race([native.synthesizeLocal({ text: chunk, requestId }), interrupted]);
            if (result.execution !== 'device' || !result.playbackId) throw new Error('Invalid on-device speech result');
            expected = result.playbackId; check(); signal.throwIfAborted();
            await Promise.race([native.play({ playbackId: expected }), interrupted]);
            await Promise.race([completed, interrupted]);
            expected = undefined;
          }
        } finally { await Promise.all(handles.map(handle => handle.remove())); await native.stopPlayback().catch(() => {}); }
      });
    },
  };
}
