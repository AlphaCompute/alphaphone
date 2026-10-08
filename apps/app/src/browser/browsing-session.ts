/** Saved normal browser tabs and history. Product decision: tabs keep sign-ins
 * and are restored after a cold start; private tabs are never saved. Mirrors
 * the bounds of the native encrypted `BrowserSessionStore`. */
export const MAX_SAVED_TABS = 8, MAX_SAVED_HISTORY = 100, MAX_SAVED_TITLE = 200;
export type SavedTab = { id: string; url: string; title: string };
export type SavedBrowsing = { history: string[]; tabs: SavedTab[]; cur: string };
type Bag = Record<string, any>;

export function savedBrowserUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 4096 || /[\u0000- \u007f]/.test(value)) return false;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password; } catch { return false; }
}
const savedTitle = (value: unknown) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, MAX_SAVED_TITLE).trim();

/** Bounded canonical form; invalid rows are dropped rather than stored. */
export function normalizeBrowsing(input: any): SavedBrowsing {
  const history: string[] = [];
  for (const url of Array.isArray(input?.history) ? input.history : []) if (history.length < MAX_SAVED_HISTORY && savedBrowserUrl(url) && !history.includes(url)) history.push(url);
  const tabs: SavedTab[] = [];
  for (const tab of Array.isArray(input?.tabs) ? input.tabs : [])
    if (tabs.length < MAX_SAVED_TABS && typeof tab?.id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(tab.id) && savedBrowserUrl(tab.url) && !tabs.some(saved => saved.id === tab.id))
      tabs.push({ id: tab.id, url: tab.url, title: savedTitle(tab.title) });
  return { history, tabs, cur: tabs.some(tab => tab.id === input?.cur) ? input.cur : '' };
}

/** What the renderer saves: normal tabs with a committed (or still-unloaded
 * restored) address, and history. Private tabs and their pages are excluded. */
export function browsingSnapshot(state: { tabs: Bag[]; visits: string[]; cur: string }, page: (id: string) => { url?: string; title?: string } | undefined): SavedBrowsing {
  const tabs: SavedTab[] = [];
  for (const tab of state.tabs) {
    if (tab.priv || tabs.length >= MAX_SAVED_TABS) continue;
    const known = page(tab.id);
    if (known?.url) tabs.push({ id: tab.id, url: known.url, title: savedTitle(known.title) });
  }
  return normalizeBrowsing({ history: state.visits, tabs, cur: state.cur });
}

/** Merge a saved record into the renderer. Saved tabs replace only an untouched
 * single new tab; otherwise only history is merged so nothing open is lost. */
export function restoreBrowsing(saved: unknown, state: { tabs: Bag[]; visits: string[] }, pristine: boolean) {
  const record = normalizeBrowsing(saved);
  const visits = [...state.visits, ...record.history.filter(url => !state.visits.includes(url))].slice(0, MAX_SAVED_HISTORY);
  if (!pristine || !record.tabs.length) return { visits, restored: [] as SavedTab[] };
  const tabs = record.tabs.map(tab => ({ id: tab.id, hist: ['newtab'], pos: 0 }));
  return { visits, restored: record.tabs, tabs, cur: record.cur || tabs[0].id };
}
