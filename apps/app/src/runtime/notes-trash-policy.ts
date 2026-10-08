import type {NoteRecord} from './notes-store';
import type {NotesTarget} from './notes-contract';

/** Product deletion policy: a deleted note stays restorable in Trash for exactly three days. */
export const NOTES_TRASH_RETENTION_MS=3*24*60*60*1000;
export const NOTES_TRASH_MAX_ENTRIES=10000;
export const NOTES_TRASH_MAX_BYTES=30*1024*1024;
const DAY=24*60*60*1000;
const operationId=/^[-\w]{1,128}$/;

/**
 * One trashed note. `id` is the deletion operation id; for agent and voice deletions it
 * equals the shared store tombstone's operationId. `target` is the reviewed revision of
 * the exact record at deletion, so a restore can prove it reinstated the same note.
 * `audio` is present only when the recording itself was moved to the audio trash under
 * the same operation id.
 */
export type NotesTrashEntry={
 id:string;
 note:NoteRecord;
 target?:NotesTarget;
 index:number;
 deletedAt:number;
 audio?:{audioId:string};
};
export type NotesTrashDocument={version:1;entries:NotesTrashEntry[]};

export function emptyNotesTrash():NotesTrashDocument{return {version:1,entries:[]};}

export function validateNotesTrash(value:unknown):NotesTrashDocument{
 if(value===null||value===undefined)return emptyNotesTrash();
 const doc=value as NotesTrashDocument;
 if(!doc||typeof doc!=='object'||Array.isArray(doc)||doc.version!==1||!Array.isArray(doc.entries)||Object.keys(doc).some(key=>key!=='version'&&key!=='entries'))throw Error('Invalid Notes Trash');
 if(doc.entries.length>NOTES_TRASH_MAX_ENTRIES||new TextEncoder().encode(JSON.stringify(doc)).length>NOTES_TRASH_MAX_BYTES)throw Error('Notes Trash is full');
 const ids=new Set<string>(),notes=new Set<string>();
 for(const entry of doc.entries){
  const note=entry?.note;
  if(!entry||typeof entry!=='object'||typeof entry.id!=='string'||!operationId.test(entry.id)||ids.has(entry.id)||
   !note||typeof note!=='object'||typeof note.id!=='string'||!note.id||typeof note.title!=='string'||!['text','list','voice','link'].includes(note.kind)||notes.has(note.id)||
   !Number.isSafeInteger(entry.index)||entry.index<0||!Number.isSafeInteger(entry.deletedAt)||entry.deletedAt<=0)throw Error('Invalid Notes Trash entry');
  if(entry.target!==undefined&&(typeof entry.target!=='object'||entry.target.noteId!==note.id||typeof entry.target.revision!=='string'||typeof entry.target.sourceId!=='string'))throw Error('Invalid Notes Trash target');
  if(entry.audio!==undefined&&(note.kind!=='voice'||typeof entry.audio.audioId!=='string'||!entry.audio.audioId||(note.audio as {audioId?:string}|undefined)?.audioId!==entry.audio.audioId))throw Error('Invalid Notes Trash recording');
  ids.add(entry.id);notes.add(note.id);
 }
 return doc;
}

export function notesTrashExpiresAt(entry:Pick<NotesTrashEntry,'deletedAt'>){return entry.deletedAt+NOTES_TRASH_RETENTION_MS;}
/** Expired exactly when three full days have elapsed. A clock moved backwards never extends past now+3 days. */
export function notesTrashExpired(entry:Pick<NotesTrashEntry,'deletedAt'>,now:number){return now>=notesTrashExpiresAt(entry);}
/** Whole days left, rounded up: 3 right after deletion, 1 during the final day, 0 once due. */
export function notesTrashDaysLeft(entry:Pick<NotesTrashEntry,'deletedAt'>,now:number){
 const left=notesTrashExpiresAt(entry)-now;
 return left<=0?0:Math.min(3,Math.ceil(left/DAY));
}
export function notesTrashDaysLabel(entry:Pick<NotesTrashEntry,'deletedAt'>,now:number){
 const days=notesTrashDaysLeft(entry,now);
 return days===0?'Deleting permanently':days===1?'1 day left':`${days} days left`;
}

/** Record a deletion before it is committed. A newer deletion of the same note replaces an older, stale entry. */
export function addNotesTrashEntry(doc:NotesTrashDocument,entry:NotesTrashEntry):NotesTrashDocument{
 const current=validateNotesTrash(doc);
 if(current.entries.some(x=>x.id===entry.id))throw Error('Deletion already recorded');
 return validateNotesTrash({version:1,entries:[entry,...current.entries.filter(x=>x.note.id!==entry.note.id)]});
}
export function removeNotesTrashEntries(doc:NotesTrashDocument,ids:Iterable<string>):NotesTrashDocument{
 const drop=new Set(ids);
 return validateNotesTrash({version:1,entries:validateNotesTrash(doc).entries.filter(x=>!drop.has(x.id))});
}

export type NotesTrashPlan={stale:NotesTrashEntry[];expired:NotesTrashEntry[];kept:NotesTrashEntry[]};
/**
 * Decide what maintenance must do, from authoritative saved note ids.
 * - stale: the note is live again (undo, restore, or a deletion that never committed). Only the trash row goes.
 * - expired: deleted at least three days ago and still absent. Its content is purged.
 * Pure and idempotent: applying the plan and planning again yields nothing to do.
 */
export function planNotesTrash(doc:NotesTrashDocument,liveNoteIds:ReadonlySet<string>,now:number):NotesTrashPlan{
 const plan:NotesTrashPlan={stale:[],expired:[],kept:[]};
 for(const entry of validateNotesTrash(doc).entries){
  if(liveNoteIds.has(entry.note.id))plan.stale.push(entry);
  else if(notesTrashExpired(entry,now))plan.expired.push(entry);
  else plan.kept.push(entry);
 }
 return plan;
}

/** Reinsert the exact saved record near its old position. Refuses to replace a live note with the same id. */
export function restoreNotesTrashEntry(list:NoteRecord[],entry:NotesTrashEntry):NoteRecord[]{
 if(list.some(n=>n.id===entry.note.id))throw Error('A note with this identity already exists');
 const next=list.slice();next.splice(Math.min(entry.index,next.length),0,structuredClone(entry.note));
 return next;
}

/** Newest deletion first, for presentation. */
export function sortedNotesTrash(doc:NotesTrashDocument){return validateNotesTrash(doc).entries.slice().sort((a,b)=>b.deletedAt-a.deletedAt);}
