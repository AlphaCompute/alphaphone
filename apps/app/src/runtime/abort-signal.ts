/** Compose cancellation on WebView 113, which has AbortController but no AbortSignal.any. */
export function anyAbortSignal(signals: readonly AbortSignal[]): AbortSignal {
 if (typeof AbortSignal.any === 'function') return AbortSignal.any([...signals]);
 const controller = new AbortController();
 const sources = [...new Set(signals)];
 // Preserve iterable order when more than one source was already cancelled.
 for (const signal of sources) if (signal.aborted) { controller.abort(signal.reason); return controller.signal; }
 const listeners = new Map<AbortSignal, () => void>();
 const cleanup = () => { for (const [source, listener] of listeners) source.removeEventListener('abort', listener); listeners.clear(); };
 for (const source of sources) {
  const listener = () => { cleanup(); controller.abort(source.reason); };
  listeners.set(source, listener);
  source.addEventListener('abort', listener, {once: true});
 }
 return controller.signal;
}
