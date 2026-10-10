import {NotesStore as SharedNotesStore,type StoragePort,type NoteRecord} from '../../../../.eliza/client-features/plugins/plugin-notes/src/client/notes-store.ts';
export { NotesCommitUncertain, type NoteRecord } from '../../../../.eliza/client-features/plugins/plugin-notes/src/client/notes-store.ts';
export const LEGACY_NOTES_KEY = 'alphaphone:prototype:notes:v1';
export const NOTES_KEY = 'alphaphone:notes:v2';
export const notesStorageKeys = {current:NOTES_KEY,legacy:LEGACY_NOTES_KEY};
/** Preserve installed data; revision/migration behavior belongs to plugin-notes. */
export class NotesStore extends SharedNotesStore {
 constructor(storage:StoragePort,initial:NoteRecord[]|(()=>NoteRecord[])=[]){super(notesStorageKeys,storage,initial);}
}
/** Stable native code (AlphaConnectionPlugin) for a definite refusal above a slot's byte cap. */
export const STORAGE_FULL_CODE = 'storage-full';
/** True only for the definite native capacity refusal; nothing was written. */
export function isStorageFull(error:unknown):boolean{
 return !!error&&typeof error==='object'&&(error as {code?:unknown}).code===STORAGE_FULL_CODE;
}
