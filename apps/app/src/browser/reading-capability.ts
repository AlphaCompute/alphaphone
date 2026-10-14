// Page reading on Android (Read aloud, Ask about page) extracts text with a script that runs in a
// world the page's own script cannot reach. A WebView provider without that capability gets no
// reading at all: the native side never injects into the page's world instead. This module holds
// the one answer the native side gives, so the renderer can say so before the owner starts a
// review, not after a speech route has been prepared.
//
// The wording is an engineering default, not reviewed product copy.
export const READING_UNSUPPORTED_MESSAGE =
  'Read aloud and Ask about page are unavailable on this device: its Android System WebView cannot read a page privately. Update Android System WebView.';

export type ReadingSupport = 'unknown' | 'available' | 'unavailable';

export interface ReadingSupportProbe {
  /** Last confirmed answer; 'unknown' until the native side has answered. */
  readonly state: ReadingSupport;
  /** Asks once and remembers a definite answer; a failed question is asked again next time. */
  check(): Promise<ReadingSupport>;
}

/**
 * `query` asks the native browser. Only an explicit boolean is believed: a failed or malformed
 * answer leaves the state unknown, and the native review then refuses on its own if it must.
 * `changed` runs when a definite answer first arrives, so an open menu can show it.
 */
export function createReadingSupport(query: () => Promise<unknown>, changed: () => void = () => {}): ReadingSupportProbe {
  let state: ReadingSupport = 'unknown';
  let pending: Promise<ReadingSupport> | undefined;
  return {
    get state() { return state; },
    check() {
      if (state !== 'unknown') return Promise.resolve(state);
      pending ??= Promise.resolve().then(query).then((answer): ReadingSupport => {
        const available = (answer as { available?: unknown } | null | undefined)?.available;
        if (available === true) state = 'available';
        else if (available === false) state = 'unavailable';
        if (state !== 'unknown') changed();
        return state;
      }, (): ReadingSupport => state).finally(() => { pending = undefined; });
      return pending;
    },
  };
}
