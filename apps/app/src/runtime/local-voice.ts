import { planLocalSpeech } from './local-speech-text';
import { speakLocalText } from '../local-speech-playback';
import { registerPlugin } from '../platform-plugins';
import { Capacitor } from '@capacitor/core';
import { connectionController } from './connection-ui';
const native = registerPlugin<{
  /** `ready` is recognition readiness; `playback`, when reported, is read-aloud readiness on its own. */
  localSpeechStatus(input: { requestId: string }): Promise<{ ready: boolean; playback?: boolean; execution: string }>;
  transcribeLocalRecording(input: { recordingId: string; requestId: string }): Promise<LocalTranscript>;
  releaseLocalSpeech(): Promise<void>;
  cancel(input: { requestId: string }): Promise<void>;
}>('AlphaVoiceCloud');
/**
 * Provenance reported with a transcript. On the phone it comes from the native
 * libelizainference engine; in a browser, from the local agent on this computer.
 */
export type LocalTranscript = { text: string; local: true; execution: string; route?: string; engine?: string; model?: string; modelRevision?: string; runtime?: string; language?: string };
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
  if (!Capacitor.isPluginAvailable('AlphaVoiceCloud') || document.documentElement.dataset.connectionMode === 'mock') return null;
  installReleaseWatcher();
  const binding = () => [connectionController.getSnapshot().session?.sessionId, connectionController.getCloudClient()?.sessionId, document.documentElement.dataset.connectionMode].join(':');
  const selected = binding();
  const check = () => {
    if (document.hidden || document.documentElement.dataset.connectionMode === 'mock' || connectionController.getSnapshot().open || selected !== binding()) throw new DOMException('Voice selection changed', 'AbortError');
  };
  async function operation<T>(signal: AbortSignal, run: (id: string, interrupted: Promise<never>, ownedSignal: AbortSignal) => Promise<T>): Promise<T> {
    check(); signal.throwIfAborted();
    const owned = new AbortController(); const id = crypto.randomUUID(); let reject!: (reason: unknown) => void;
    const interrupted = new Promise<never>((_, fail) => { reject = fail; }); void interrupted.catch(() => {});
    const cancel = () => { void native.cancel({ requestId: id }).catch(() => {}); owned.abort(new DOMException('Voice cancelled', 'AbortError')); reject(owned.signal.reason); };
    const unsubscribe = connectionController.subscribe(() => { try { check(); } catch { cancel(); } });
    const modeChanged = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(() => { try { check(); } catch { cancel(); } });
    modeChanged?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-connection-mode'] });
    const visibility = () => { if (document.hidden) cancel(); };
    signal.addEventListener('abort', cancel, { once: true }); document.addEventListener('visibilitychange', visibility);
    try { const result = await run(id, interrupted, owned.signal); check(); signal.throwIfAborted(); return result; }
    finally { modeChanged?.disconnect(); signal.removeEventListener('abort', cancel); document.removeEventListener('visibilitychange', visibility); unsubscribe(); }
  }
  return {
    async ready(signal: AbortSignal) { return operation(signal, async (requestId, interrupted) => { const result = await Promise.race([native.localSpeechStatus({ requestId }), interrupted]); return result.ready === true && result.execution === (Capacitor.isNativePlatform()?'device':'browser'); }); },
    /** Read-aloud readiness: a browser without the local agent can still use its own local voices. */
    async playbackReady(signal: AbortSignal) { return operation(signal, async (requestId, interrupted) => { const result = await Promise.race([native.localSpeechStatus({ requestId }), interrupted]); return (result.ready === true || result.playback === true) && result.execution === (Capacitor.isNativePlatform()?'device':'browser'); }); },
    async transcribe(recordingId: string, signal: AbortSignal) { return operation(signal, async (requestId, interrupted) => {
      const result = await Promise.race([native.transcribeLocalRecording({ recordingId, requestId }), interrupted]);
      if (result.execution !== (Capacitor.isNativePlatform()?'device':'browser') || result.local !== true || typeof result.text !== 'string' || !result.text.trim()) throw new Error('No usable on-device transcript');
      return result;
    }); },
    async speak(text: string, signal: AbortSignal, onStarted?:()=>void, strictDrain=false, options?:{queue?:boolean;assertCurrent?:()=>void}) {
      const chunks = planLocalSpeech(text);
      return operation(signal, async (_requestId, interrupted, ownedSignal) => {
        let started=false;
        for (const chunk of chunks) {
          check(); options?.assertCurrent?.(); ownedSignal.throwIfAborted();
          const playback=speakLocalText(chunk, ownedSignal, ()=>{if(!started){started=true;onStarted?.();}}, options?.queue??false, {execution:Capacitor.isNativePlatform()?'device':'browser',assertCurrent:()=>{check();options?.assertCurrent?.();}},strictDrain);
          // Conversation capture may resume only after the native speaker confirms cleanup.
          if(strictDrain)await playback;else await Promise.race([playback,interrupted]);
        }
      });
    },
  };
}
