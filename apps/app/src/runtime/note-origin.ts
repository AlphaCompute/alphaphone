/** Back-reference from a saved reminder or calendar event to the voice note its draft came from.
 * It is a display link only: it grants no access to the note and carries none of its content. */
export type NoteOrigin = { version: 1; noteId: string; audioId: string; revision: string; title: string };
export type NoteOriginKind = 'event' | 'reminder';
export type NoteOriginIndex = { version: 1; links: Record<string, NoteOrigin & { savedAt: number }> };
type Bag = Record<string, any>;

export const noteOriginLimit = 200;
const text = (value: unknown, max: number) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);

export function noteOriginOf(value: unknown): NoteOrigin | undefined {
  const o = value as NoteOrigin | undefined;
  if (!o || typeof o !== 'object' || o.version !== 1 || !text(o.noteId, 128) || !text(o.audioId, 128) || typeof o.revision !== 'string' || !/^[a-f0-9]{64}$/.test(o.revision) || !text(o.title, 120)) return;
  return { version: 1, noteId: o.noteId, audioId: o.audioId, revision: o.revision, title: o.title };
}
/** The origin for a saved recording as reviewed now. `revision` is the hash of the whole note record. */
export function noteOriginFor(note: unknown, revision: string): NoteOrigin | undefined {
  const n = note as Bag | undefined;
  return noteOriginOf({ version: 1, noteId: n?.id, audioId: n?.audio?.audioId, revision, title: String(n?.title || '').replace(/[\x00-\x1f\x7f]+/g, ' ').trim().slice(0, 120) || 'Voice note' });
}
/** Events repeat as `<id>:occ:<begin>`; one link covers the series. */
export const noteOriginKey = (kind: NoteOriginKind, id: string) => `${kind}:${kind === 'event' ? id.replace(/:occ:-?\d+$/, '') : id}`;

export function noteOriginIndex(value: unknown): NoteOriginIndex {
  if (value === null || value === undefined) return { version: 1, links: {} };
  const v = value as NoteOriginIndex;
  if (typeof v !== 'object' || v.version !== 1 || !v.links || typeof v.links !== 'object' || Array.isArray(v.links) || Object.keys(v).some(key => !['version', 'links'].includes(key))) throw Error('Note links need recovery.');
  const entries = Object.entries(v.links);
  if (entries.length > noteOriginLimit) throw Error('Note links need recovery.');
  const links: NoteOriginIndex['links'] = {};
  for (const [key, row] of entries) {
    const origin = noteOriginOf(row);
    if (!/^(event|reminder):[^\x00-\x1f\x7f]{1,256}$/.test(key) || !origin || !Number.isSafeInteger(row.savedAt) || row.savedAt < 0) throw Error('Note links need recovery.');
    links[key] = { ...origin, savedAt: row.savedAt };
  }
  return { version: 1, links };
}
/** Adds a link for a newly saved record. An existing link for that record is never replaced:
 * a record keeps the note it was created from. The oldest links make room past the limit. */
export function addNoteOrigin(index: NoteOriginIndex, kind: NoteOriginKind, id: string, value: unknown, now: number): NoteOriginIndex {
  const origin = noteOriginOf(value), key = noteOriginKey(kind, id);
  if (!origin || !id || key.length > 256 + kind.length + 1) throw Error('Invalid note link.');
  if (index.links[key]) return index;
  const links = { ...index.links, [key]: { ...origin, savedAt: now } };
  const oldest = Object.keys(links).filter(k => k !== key).sort((a, b) => links[a].savedAt - links[b].savedAt);
  while (Object.keys(links).length > noteOriginLimit && oldest.length) delete links[oldest.shift()!];
  return { version: 1, links };
}
export function removeNoteOrigin(index: NoteOriginIndex, kind: NoteOriginKind, id: string): NoteOriginIndex {
  const key = noteOriginKey(kind, id);
  if (!index.links[key]) return index;
  const links = { ...index.links }; delete links[key];
  return { version: 1, links };
}
export function findNoteOrigin(index: NoteOriginIndex, kind: NoteOriginKind, id: string): NoteOrigin | undefined {
  return noteOriginOf(index.links[noteOriginKey(kind, id)]);
}
/** Resolves a link against the current Notes list. Fails closed: exactly one note must still exist
 * under the stored id and it must still be the same recording. The caller compares `revision` to say
 * whether that note was edited after the link was made. */
export function resolveNoteOrigin(value: unknown, notes: unknown): { status: 'missing' } | { status: 'found'; origin: NoteOrigin; note: Bag } {
  const origin = noteOriginOf(value);
  if (!origin || !Array.isArray(notes)) return { status: 'missing' };
  const matches = notes.filter((n: Bag) => n && n.id === origin.noteId);
  if (matches.length !== 1) return { status: 'missing' };
  const note = matches[0] as Bag;
  if (!note.audio || note.audio.audioId !== origin.audioId) return { status: 'missing' };
  return { status: 'found', origin, note };
}
