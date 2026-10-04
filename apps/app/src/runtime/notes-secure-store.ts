import { SecureNotesStore as SharedSecureNotesStore, readLegacyDailyNotes as readLegacy, type NotesVault, type NotesOpenStage } from '../../../../.eliza/client-features/plugins/plugin-notes/src/client/notes-secure-store.ts';
import { notesStorageKeys, type NoteRecord } from './notes-store';
export type { NotesVault, NotesOpenStage } from '../../../../.eliza/client-features/plugins/plugin-notes/src/client/notes-secure-store.ts';
export const SECURE_NOTES_SLOT = 'notes-records:v1:device';
const config = {...notesStorageKeys,secureSlot:SECURE_NOTES_SLOT,daily:'alphaphone:daily:v1'};
type LegacyStorage = {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void};
export function readLegacyDailyNotes(storage:Pick<LegacyStorage,'getItem'>){return readLegacy(config,storage);}
export type SecureNotesStore = SharedSecureNotesStore;
export const SecureNotesStore = {
 open(vault:NotesVault,legacy:LegacyStorage,initial:NoteRecord[]|(()=>NoteRecord[])=[],onStage:(stage:NotesOpenStage)=>void=()=>{}){
  return SharedSecureNotesStore.open(config,vault,legacy,initial,onStage);
 }
};
