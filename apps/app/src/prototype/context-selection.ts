/** Selection identity and review scope for sources whose own views publish them:
 * the Files folder being browsed, the open Settings page, a pressed Alpha Phone
 * notification and the capture a question is about. Dependency-free so the rules
 * run in node tests (test/context-selection.test.mjs).
 *
 * Identities are opaque. A display name, path, provider URI or native revision
 * string never becomes an identity; content is shared only as an excerpt the owner
 * reviewed. */
type Bag = Record<string, any>;
const OPAQUE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
export const FOLDER_CONTEXT_EVENT = 'alpha-folder-context';

export type FolderScopeEntry = { id: string; revision: string; name: string; mimeType: string; directory: boolean };
/** Exactly what a folder review covers: one folder and the entries loaded for it. */
export type FolderScope = {
  folder: { id: string; revision: string; name: string };
  entries: FolderScopeEntry[];
  /** Entries the provider reported for the folder, when known. */
  total?: number;
  /** More entries exist than the loaded ones. */
  more: boolean;
};
type Listed = { folder?: Bag; entries?: Bag[]; total?: number; cursor?: string; truncated?: boolean };

const entryOf = (value: Bag): FolderScopeEntry | undefined =>
  value && typeof value.id === 'string' && typeof value.revision === 'string' && typeof value.name === 'string'
    ? { id: value.id, revision: value.revision, name: value.name, mimeType: typeof value.mimeType === 'string' ? value.mimeType : '', directory: value.directory === true }
    : undefined;

/** The reviewable scope of a ready folder listing, or undefined when it has no usable identity. */
export function folderScope(listing: Listed | undefined): FolderScope | undefined {
  const folder = listing?.folder;
  if (!folder || typeof folder.id !== 'string' || !OPAQUE.test(folder.id) || typeof folder.revision !== 'string') return undefined;
  const entries: FolderScopeEntry[] = [];
  for (const row of listing!.entries || []) { const entry = entryOf(row); if (!entry) return undefined; entries.push(entry); }
  return {
    folder: { id: folder.id, revision: folder.revision, name: typeof folder.name === 'string' && folder.name ? folder.name : 'Selected folder' },
    entries, more: !!listing!.cursor || listing!.truncated === true,
    ...(Number.isSafeInteger(listing!.total) ? { total: listing!.total } : {}),
  };
}

/** Local comparison key. It contains provider revisions (which may embed names), so it is never sent. */
export function folderSignature(scope: FolderScope): string {
  return JSON.stringify([scope.folder.id, scope.folder.revision, scope.entries.map(entry => [entry.id, entry.revision]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)]);
}

export type FolderSelection = { kind: 'folder'; id: string; revision: string };
/** Maps each distinct listing of a folder to a session-local counter. The counter is the
 * only revision that leaves the phone: it changes whenever the folder or a loaded entry
 * changes, and reveals nothing about names, sizes or times. */
export function createFolderRevisions() {
  const seen = new Map<string, { signature: string; revision: number }>();
  let counter = 0;
  return (scope: FolderScope | undefined): FolderSelection | undefined => {
    if (!scope) return undefined;
    const signature = folderSignature(scope), previous = seen.get(scope.folder.id);
    const revision = previous?.signature === signature ? previous.revision : ++counter;
    seen.set(scope.folder.id, { signature, revision });
    return { kind: 'folder', id: scope.folder.id, revision: 'listing-' + revision };
  };
}

/** Whether a fresh read of the folder still matches what was reviewed. A removed, renamed,
 * replaced or added entry, a changed folder, or lost access all fail. With several loaded
 * pages only the first page is re-read; it must agree and the reported total must match. */
export function folderScopeCurrent(reviewed: FolderScope, fresh: Listed & { status?: string }): boolean {
  if (fresh.status !== undefined && fresh.status !== 'ready') return false;
  const now = folderScope(fresh);
  if (!now || now.folder.id !== reviewed.folder.id || now.folder.revision !== reviewed.folder.revision) return false;
  if (now.total !== reviewed.total) return false;
  const known = new Map(reviewed.entries.map(entry => [entry.id, entry.revision]));
  if (!now.entries.every(entry => known.get(entry.id) === entry.revision)) return false;
  // The fresh read is the first page: it can be shorter than several loaded pages, never longer.
  return now.more ? now.entries.length <= reviewed.entries.length : now.entries.length === reviewed.entries.length;
}

export const FOLDER_EXCERPT_LIMIT = 200;
/** The excerpt offered for review: names and types of the loaded entries of this one folder.
 * Nothing inside a file or a subfolder is read. */
export function folderExcerpt(scope: FolderScope, typeLabel: (mimeType: string, directory: boolean) => string): string {
  const shown = scope.entries.slice(0, FOLDER_EXCERPT_LIMIT), hidden = scope.entries.length - shown.length;
  const lines = ['Folder: ' + scope.folder.name];
  if (!shown.length) lines.push(scope.more ? 'No entries are loaded.' : 'This folder is empty.');
  else lines.push(shown.length + (shown.length === 1 ? ' entry' : ' entries') + ' listed by name and type. File contents and subfolder contents are not included.');
  for (const entry of shown) lines.push('- ' + entry.name + ' (' + typeLabel(entry.mimeType, entry.directory) + ')');
  if (hidden > 0) lines.push(hidden + ' more loaded ' + (hidden === 1 ? 'entry is' : 'entries are') + ' not listed here.');
  if (scope.more) lines.push('The folder has more entries that are not loaded' + (scope.total !== undefined ? ' (' + scope.total + ' in total).' : '.'));
  return lines.join('\n');
}

const SETTINGS_SECTION = /^[a-z][a-z0-9-]{0,63}$/;
const SENSITIVE_SETTINGS = /pass|credential|vault|secret|token|key|unlock|pin|biometric/;
/** The open Settings page as an identity: its section slug only, never a value shown on it.
 * Credential and unlock pages have no identity (the screen is also paused as sensitive). */
export function settingsSelection(state: Bag | undefined): { kind: 'settings'; id: string } | undefined {
  const page = state?.page;
  if (typeof page !== 'string' || !SETTINGS_SECTION.test(page) || SENSITIVE_SETTINGS.test(page)) return undefined;
  return { kind: 'settings', id: page };
}

export type Notice = { id: string; revision: string; source: string; title?: string; text?: string; appLabel?: string };
/** Only Alpha Phone's own, unredacted notifications can be reviewed for a question. A row
 * hidden by the lock screen shows its app label and no text, which is nothing to review. */
export function noticeReviewable(notice: Notice): boolean {
  const title = (notice.title || '').trim(), text = (notice.text || '').trim();
  return notice.source === 'own' && OPAQUE.test(notice.id) && OPAQUE.test(notice.revision) && (!!text || (!!title && title !== (notice.appLabel || '').trim()));
}
/** The exact notification is still listed with the revision that was reviewed. */
export function noticeCurrent(reviewed: Pick<Notice, 'id' | 'revision' | 'source'>, items: readonly Notice[] | undefined): boolean {
  return !!items && items.filter(item => item.id === reviewed.id && item.source === reviewed.source).length === 1
    && items.some(item => item.id === reviewed.id && item.source === reviewed.source && item.revision === reviewed.revision);
}
export function noticeExcerpt(notice: Notice): string {
  return [notice.title, notice.text].map(value => (value || '').trim()).filter(Boolean).join('\n');
}

export type CaptureQuestion =
  /** The live viewfinder frame. */
  | { kind: 'frame' }
  /** One saved photo or video, by its exact library identity. */
  | { kind: 'item'; id: string }
  /** A typed library search. It names no capture and reads no media. */
  | { kind: 'search' }
  /** The viewer is open on something this adapter does not own. */
  | { kind: 'none' };
/** Routes a Camera or Photos question control to what it is about. A search question is
 * never treated as a capture, and a viewer question always carries the open item's id. */
export function captureQuestion(module: string, key: string, path: string, state: Bag | undefined): CaptureQuestion | undefined {
  if (module !== 'camera' && module !== 'photos') return undefined;
  if (key === 'askQ' || key === 'askSearch') return { kind: 'search' };
  if (key !== 'ask') return undefined;
  if (module === 'camera') return { kind: 'frame' };
  const open = state?.open;
  return path === 'v.ask' && typeof open === 'string' && open ? { kind: 'item', id: open } : { kind: 'none' };
}

const MIME_TYPE = /^[a-z]+\/([a-z0-9][a-z0-9.+-]{0,126}|\*)$/;
/** Document types for a Files location tile, as the list the native picker accepts
 * (DailyAppsPlugin.mimeTypes). Undefined means any document. */
export function locationMimeTypes(name: string): string[] | undefined {
  const key = name.toLowerCase();
  const types = /(picture|image|photo)/.test(key) ? ['image/*']
    : /(music|audio|recording)/.test(key) ? ['audio/*']
    : /video|movie/.test(key) ? ['video/*']
    : /doc|pdf/.test(key) ? ['application/pdf', 'text/*', 'application/*']
    : undefined;
  return types?.every(type => MIME_TYPE.test(type)) ? types : undefined;
}

/** Publishes the folder and Settings identities the agent context reads from the shell.
 * The folder identity exists only while its folder is the visible Files subview. */
export function installContextSelection(Component: any) {
  const p = Component.prototype, mount = p.componentDidMount, unmount = p.componentWillUnmount;
  p.componentDidMount = function () {
    mount?.call(this);
    this.alphaFolderContextHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const next = detail && detail.kind === 'folder' && typeof detail.id === 'string' && OPAQUE.test(detail.id) && typeof detail.revision === 'string' && OPAQUE.test(detail.revision)
        ? { kind: 'folder' as const, id: detail.id, revision: detail.revision } : undefined;
      if (JSON.stringify(next) === JSON.stringify(this.alphaFolderSelection)) return;
      this.alphaFolderSelection = next;
      // Re-render so the agent context is recomputed with the new identity.
      this.setState({ folderContextRevision: Date.now() });
    };
    window.addEventListener(FOLDER_CONTEXT_EVENT, this.alphaFolderContextHandler);
  };
  p.componentWillUnmount = function () {
    window.removeEventListener(FOLDER_CONTEXT_EVENT, this.alphaFolderContextHandler);
    this.alphaFolderSelection = undefined;
    unmount?.call(this);
  };
  p.folderSelection = function (): FolderSelection | undefined {
    const chosen = this.alphaFolderSelection as FolderSelection | undefined;
    if (!chosen || document.hidden || this.S().view !== 'files') return undefined;
    const files = this.vget('files');
    return files.folder === '__native_tree' && !files.open ? { ...chosen } : undefined;
  };
  p.settingsSelection = function () {
    return document.hidden || this.S().view !== 'settings' ? undefined : settingsSelection(this.vget('settings'));
  };
}
