import { Capacitor, registerPlugin } from '@capacitor/core';

/** Probe installed bridge code, not permissions or model readiness. Older APKs remain protocol 1. */
export async function workflowPresentationProtocol(signal: AbortSignal): Promise<1 | 2> {
  signal.throwIfAborted();
  if (!Capacitor.isNativePlatform()) return 2;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  try {
    const probes = Promise.all(['AlphaNotifications', 'AlphaVoiceCloud'].map(name =>
      registerPlugin<{workflowPresentationCapabilities(): Promise<{protocol?: unknown}>}>(name).workflowPresentationCapabilities()));
    const result = await Promise.race([
      probes,
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 2000); }),
      new Promise<never>((_, reject) => { cancel = () => reject(signal.reason); signal.addEventListener('abort', cancel, {once:true}); if(signal.aborted)cancel(); }),
    ]);
    signal.throwIfAborted();
    return result?.every(value => value?.protocol === 2) ? 2 : 1;
  } catch { signal.throwIfAborted(); return 1; }
  finally { clearTimeout(timer); if(cancel)signal.removeEventListener('abort',cancel); }
}
