/** Photos > Device library: the full permitted MediaStore library (issue 408, policy P-24).
 * Native reads go through AlphaPhotoLibrary; rules live in runtime/photo-library.ts.
 * The library is paged only while this album is open; nothing is copied or uploaded. */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { createCaptureRevisions } from './context-selection';
import {
  LibraryCatalog, LibrarySelection, parsePage, parseScope, parseValidation, parseItem, prepareReview, reviewCurrent, scopePresentation,
  LIBRARY_LIMITS, type LibraryAction, type LibraryReview, type LibraryScopeState, type LibraryItem, type LibraryChange,
} from '../runtime/photo-library';

type Bag = Record<string, any>;
type Items = { items: { id: string; revision: string }[] };
export type PhotoLibraryPort = {
  scope(): Promise<unknown>;
  requestAccess(): Promise<unknown>;
  page(options: { before?: string; limit?: number; thumbnails?: boolean; thumbnailSize?: number; kind?: string; query?: string; from?: number; to?: number; favorites?: boolean }): Promise<unknown>;
  inspect(options: { id: string; size?: number }): Promise<unknown>;
  validate(options: Items): Promise<unknown>;
  changes(options: { version: string; generation: number }): Promise<Bag>;
  requestChange(options: Items & { operation: LibraryChange }): Promise<{ status: string; operation?: string; outcomes?: { id: string; status: string }[] }>;
  share(options: Items): Promise<{ status: string; count: number }>;
  addListener(event: 'libraryChanged' | 'scopeChanged', listener: (value: Bag) => void): Promise<PluginListenerHandle>;
};
const nativePort = registerPlugin<PhotoLibraryPort>('AlphaPhotoLibrary');
const device = registerPlugin<{ openSettings(options: { page: 'privacy' }): Promise<{ status: string }> }>('AlphaDevice');
export const deviceLibraryAvailable = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('AlphaPhotoLibrary');

const PAGE = LIBRARY_LIMITS.thumbnailRows - 6;
const background = (item: LibraryItem) => item.image ? `url("${item.image}") center / cover no-repeat` : 'var(--s2)';
const duration = (seconds: number) => seconds ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '';

/** One instance per Photos module mount. */
export function createDeviceLibrary(port: PhotoLibraryPort = nativePort, available = deviceLibraryAvailable) {
  const catalog = new LibraryCatalog(), selection = new LibrarySelection(), revisions = createCaptureRevisions();
  let scope: LibraryScopeState | undefined, busy = false, error = '', status = '', review: LibraryReview | undefined, acting = false, epoch = 0, disposed = false;
  let api: Bag | undefined;
  const listeners: Promise<PluginListenerHandle>[] = [];
  const visible = () => !!api && api.isActive?.() !== false && api.get?.('photos')?.album === 'device';
  const refresh = () => { if (api && !disposed) api.set({ nativeLibraryRevision: Date.now(), nativeLibrarySelection: focused() }); };
  /** Exactly one selected item becomes the assistant's selected object: identity only. */
  const focused = () => {
    if (selection.size !== 1 || !visible()) return null;
    const [chosen] = selection.items(), item = catalog.items.find(row => row.id === chosen.id);
    return item ? revisions({ kind: item.kind, id: item.id, revision: item.revision }) : null;
  };

  async function readScope(): Promise<LibraryScopeState | undefined> {
    if (!available()) { scope = undefined; return undefined; }
    try { scope = parseScope(await port.scope()); if (catalog.observeScope(scope)) selection.clear(); }
    catch { error = 'Library access could not be read.'; }
    return scope;
  }

  async function load(more = false) {
    if (busy || disposed || !available()) return;
    const token = ++epoch; busy = true; error = ''; refresh();
    try {
      const current = await readScope();
      if (token !== epoch) return;
      if (!current || current.scope === 'denied' || current.locked) { catalog.reset(); selection.clear(); return; }
      const page = parsePage(await port.page({ before: more ? catalog.next : '', limit: PAGE, thumbnails: true, thumbnailSize: 240 }));
      if (token !== epoch) return;
      scope = page.scope; catalog.apply(page, !more);
      const dropped = selection.reconcile(catalog);
      if (dropped.dropped || dropped.changed) status = 'Some selected items changed or left the library and were unselected.';
    } catch (failure) {
      if (token === epoch) error = (failure as { code?: string })?.code === 'LIBRARY_DENIED' ? '' : 'The device library could not be loaded. Try again.';
      if ((failure as { code?: string })?.code === 'LIBRARY_DENIED') { catalog.reset(); selection.clear(); await readScope(); }
    } finally { if (token === epoch) { busy = false; refresh(); } }
  }

  /** External edits, deletes, reboots and grant changes: revalidate what is loaded. */
  async function revalidate() {
    if (busy || disposed || !available() || !catalog.loaded) return;
    const token = epoch;
    try {
      const before = scope?.scope, current = await readScope();
      if (token !== epoch) return;
      if (!current || current.scope !== before || !catalog.loaded) { await load(); return; }
      if (catalog.version && current.version !== catalog.version) { await load(); return; }
      let changes: Bag | undefined;
      if (catalog.generation) changes = await port.changes({ version: catalog.version, generation: catalog.generation });
      if (changes && changes.reset !== true && Array.isArray(changes.items)) {
        const rows = changes.items.map((row: unknown) => ({ ...parseItem(row), trashed: (row as Bag).trashed === true }));
        const result = catalog.applyChanges(rows, Number(changes.generation) || 0);
        if (result.added) status = `${result.added} new ${result.added === 1 ? 'item' : 'items'} in the library. Reload to show them.`;
      }
      // Deletions are not reported by generation; revalidate loaded identities directly.
      for (let offset = 0; offset < catalog.items.length && token === epoch; offset += LIBRARY_LIMITS.validate) {
        const batch = catalog.validationBatch(offset);
        if (!batch.length) break;
        const result = catalog.reconcile(parseValidation(await port.validate({ items: batch })));
        if (result.removed.length) offset -= result.removed.length;
      }
      const dropped = selection.reconcile(catalog);
      if (dropped.dropped || dropped.changed) status = 'Some selected items changed or left the library and were unselected.';
      if (review && !reviewCurrent(review, catalog)) { review = undefined; status = 'The reviewed items changed. Review them again.'; }
    } catch { if (token === epoch) error = 'Library changes could not be checked. Reload the library.'; }
    finally { refresh(); }
  }

  async function requestAccess() {
    if (!scope || acting) return;
    const presentation = scopePresentation(scope);
    if (presentation.actionKind === 'settings') {
      try { await device.openSettings({ page: 'privacy' }); status = 'Change Photos and videos access in Android Settings, then return to Alpha.'; }
      catch { status = 'Open Android Settings > Apps > Alpha Phone > Permissions to change access.'; }
      refresh(); return;
    }
    acting = true; refresh();
    try { scope = parseScope(await port.requestAccess()); if (catalog.observeScope(scope)) selection.clear(); }
    catch { error = 'Android did not open the access dialog.'; }
    finally { acting = false; }
    await load();
  }

  function startReview(action: LibraryAction) {
    if (acting || !selection.size) return;
    try { review = prepareReview(action, selection.items()); status = ''; }
    catch (failure) { status = (failure as Error).message; }
    refresh();
  }

  /** Runs only from the owner's in-app confirmation, then Android's own dialog or chooser. */
  async function confirmReview() {
    const pending = review;
    if (!pending || acting) return;
    if (!reviewCurrent(pending, catalog)) { review = undefined; status = 'The reviewed items changed. Review them again.'; refresh(); return; }
    acting = true; review = undefined; refresh();
    try {
      if (pending.action === 'share') {
        const result = await port.share({ items: pending.items });
        status = result.status === 'opened' ? `Android share sheet opened for ${result.count} ${result.count === 1 ? 'item' : 'items'}. Nothing is sent until you pick an app.` : 'Sharing did not open.';
      } else {
        const result = await port.requestChange({ operation: pending.action, items: pending.items });
        const verified = result.outcomes?.filter(row => row.status === 'verified').length ?? 0;
        status = result.status === 'declined' ? 'Android review was cancelled. Nothing changed.' : result.status === 'applied' ? `${verified} ${verified === 1 ? 'item' : 'items'} changed and verified.` : `${verified} of ${pending.items.length} changes verified. Reload to see the current library.`;
        if (result.status !== 'declined') { selection.clear(); await revalidate(); }
      }
    } catch (failure) {
      status = (failure as { code?: string })?.code === 'LIBRARY_STALE' ? 'An item changed before Android review. Nothing changed; review again.' : 'The action could not be completed. Reload the library before retrying.';
    } finally { acting = false; refresh(); }
  }

  function attach() {
    if (!available() || listeners.length) return;
    listeners.push(port.addListener('libraryChanged', () => { if (visible()) void revalidate(); }));
    listeners.push(port.addListener('scopeChanged', value => {
      try { scope = parseScope(value); if (catalog.observeScope(scope)) { selection.clear(); review = undefined; status = 'Library access changed in Android.'; } } catch { /* read again on next render */ }
      if (visible()) void load(); else refresh();
    }));
  }

  return {
    /** The album tile for Photos' album row. */
    tile(currentApi: Bag) {
      api = currentApi;
      if (!available()) return undefined;
      if (!scope && !busy) queueMicrotask(() => { void readScope().then(refresh); });
      attach();
      return {
        name: 'Device library', count: scope ? scopePresentation(scope).label : '…', bg: catalog.items[0]?.image ? background(catalog.items[0]) : 'var(--s2)', tf: '', flt: '',
        open: () => { currentApi.set({ album: 'device', open: null, nativePhotoSelection: null }); void (catalog.loaded ? revalidate() : load()); },
      };
    },
    /** The album view data when Photos shows the device library. */
    album(st: Bag, currentApi: Bag) {
      api = currentApi;
      const presentation = scopePresentation(scope);
      const message = [error, status, presentation.detail, selection.size ? `${selection.size} selected${selection.size === 1 ? ' · the assistant can see this item\'s identity only' : ''}` : ''].filter(Boolean).join(' ');
      const reviewOpen = !!review;
      return {
        title: 'Device library', isTrash: false, notTrash: true, isCustom: false, isDevice: true, count: presentation.label,
        empty: catalog.loaded && !catalog.items.length && !busy, close: () => { selection.clear(); review = undefined; currentApi.set({ album: null, nativeLibrarySelection: null }); },
        status: busy && !catalog.items.length ? 'Loading…' : message,
        more: !!catalog.next || !!error, moreLabel: error ? 'Retry' : busy ? 'Loading…' : 'Load more', loadMore: () => { void load(!error && !!catalog.next); },
        dev: {
          accessLabel: presentation.action, hasAccess: presentation.actionKind !== 'none' && !acting, access: () => { void requestAccess(); },
          canAct: selection.size > 0 && !acting && !reviewOpen, canEdit: selection.size > 0 && !acting && !reviewOpen && !!scope?.canEditOthers,
          share: () => startReview('share'), favorite: () => startReview('favorite'), trash: () => startReview('trash'), delete: () => startReview('delete'),
          clear: () => { selection.clear(); refresh(); },
          reviewing: reviewOpen, reviewTitle: review?.title || '', reviewDetail: review?.detail || '',
          confirm: () => { void confirmReview(); }, cancel: () => { review = undefined; status = 'Review cancelled. Nothing changed.'; refresh(); },
        },
        items: catalog.items.map(item => ({
          nativeMediaId: item.id, bg: background(item), tf: '', flt: '', vid: item.kind === 'video', dur: duration(item.duration), dim: acting ? 'opacity:.35;pointer-events:none' : '',
          selecting: true, on: selection.has(item.id), selCss: selection.has(item.id) ? 'background:var(--acc);box-shadow:0 0 0 2px #ffffff' : 'background:rgba(0,0,0,.7);box-shadow:inset 0 0 0 2px #ffffff',
          alt: `${selection.has(item.id) ? 'Unselect' : 'Select'} ${item.kind === 'video' ? 'video' : 'photo'} from ${new Date(item.takenAt).toLocaleDateString()}`,
          tap: () => { if (acting || review) return; try { selection.toggle(item); status = ''; } catch (failure) { status = (failure as Error).message; } refresh(); },
          pd: () => {}, pu: () => {},
        })),
      };
    },
    selected: focused,
    leave() { selection.clear(); review = undefined; status = ''; epoch++; busy = false; },
    dispose() { disposed = true; epoch++; for (const handle of listeners.splice(0)) void handle.then(value => value.remove()).catch(() => {}); },
  };
}
