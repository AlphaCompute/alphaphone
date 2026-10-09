import { SecureNotesStore as SharedSecureNotesStore, readLegacyDailyNotes as readLegacy, type NotesVault, type NotesOpenStage } from '../../../../.eliza/client-features/plugins/plugin-notes/src/client/notes-secure-store.ts';
import { NotesDocumentConflict } from '../../../../.eliza/client-features/plugins/plugin-notes/src/client/notes-document-store.ts';
import { notesStorageKeys, isStorageFull, STORAGE_FULL_CODE, type NoteRecord } from './notes-store';
export type { NotesVault, NotesOpenStage } from '../../../../.eliza/client-features/plugins/plugin-notes/src/client/notes-secure-store.ts';
export const SECURE_NOTES_SLOT = 'notes-records:v1:device';
/** Encrypted Keystore slot for edits whose collection commit failed or is uncertain. */
export const SECURE_NOTES_DRAFT_SLOT = 'notes-draft:v1:device';
const config = {...notesStorageKeys,secureSlot:SECURE_NOTES_SLOT,daily:'alphaphone:daily:v1'};
type LegacyStorage = {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void};
export function readLegacyDailyNotes(storage:Pick<LegacyStorage,'getItem'>){return readLegacy(config,storage);}

/** Definite, not-applied capacity refusal. A NotesDocumentConflict subclass, so the shared
 * document store reports it as a non-applied failure instead of an uncertain commit. */
export class NotesStorageFull extends NotesDocumentConflict {
 readonly code = STORAGE_FULL_CODE;
 constructor(){super('Notes storage is full. Nothing was written.');}
}
/** The shared store turns unexpected port errors into uncertain commits; keep capacity distinct. */
function capacityAware(vault:NotesVault):NotesVault{
 return {
  read:key=>vault.read(key),
  async compareExchange(key,expected,value){
   try{return await vault.compareExchange(key,expected,value);}
   catch(error){if(isStorageFull(error))throw new NotesStorageFull();throw error;}
  },
 };
}

export type NotesDraftReason = 'failed' | 'uncertain' | 'storage-full';
/** Unsaved Notes edits kept after a failed or uncertain commit, as a change set against the
 * collection they were edited from: changed or added records and removed ids. `base` is the
 * SHA-256 of that collection's bytes. Applying it later keeps unrelated newer edits. */
export type NotesDraft = {version:1;savedAt:number;base:string;reason:NotesDraftReason;records:NoteRecord[];added:string[];removed:string[]};
export async function notesDraftBase(raw:string):Promise<string>{
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),b=>b.toString(16).padStart(2,'0')).join('');
}
function validDraft(value:unknown):NotesDraft{
 const d=value as NotesDraft;
 if(!d||typeof d!=='object'||d.version!==1||!Number.isFinite(d.savedAt)||typeof d.base!=='string'||!/^[a-f0-9]{64}$/.test(d.base)||!['failed','uncertain','storage-full'].includes(d.reason)||!Array.isArray(d.records)||d.records.some(r=>!r||typeof r!=='object'||typeof r.id!=='string')||[d.added,d.removed].some(ids=>!Array.isArray(ids)||ids.some(id=>typeof id!=='string')))throw Error('Invalid Notes draft');
 return d;
}
// notes-draft-changes:begin (dependency-free; exercised by test/notes-draft-changes.test.mjs)
/** The change set from `saved` to the attempted editor `list`. */
export function notesDraftChanges(list:NoteRecord[],saved:NoteRecord[]){
 const before=new Map(saved.map(n=>[n.id,JSON.stringify(n)])),after=new Set(list.map(n=>n.id));
 const records=list.filter(n=>before.get(n.id)!==JSON.stringify(n));
 return {records,added:records.filter(n=>!before.has(n.id)).map(n=>n.id),removed:saved.filter(n=>!after.has(n.id)).map(n=>n.id)};
}
/** Apply a draft over the current saved list: drafted edits win, removed ids are dropped and
 * notes created in the draft are added first. A drafted edit of a note deleted since is not
 * revived, and every other note keeps its current saved content. */
export function applyNotesDraft(list:NoteRecord[],draft:Pick<NotesDraft,'records'|'added'|'removed'>):NoteRecord[]{
 const drafted=new Map(draft.records.map(n=>[n.id,n])),added=new Set(draft.added),removed=new Set(draft.removed),present=new Set(list.map(n=>n.id));
 return [...draft.records.filter(n=>added.has(n.id)&&!present.has(n.id)),...list.filter(n=>!removed.has(n.id)).map(n=>drafted.get(n.id)??n)];
}
// notes-draft-changes:end

export type SecureNotesStore = SharedSecureNotesStore;
export const SecureNotesStore = {
 open(vault:NotesVault,legacy:LegacyStorage,initial:NoteRecord[]|(()=>NoteRecord[])=[],onStage:(stage:NotesOpenStage)=>void=()=>{}){
  return SharedSecureNotesStore.open(config,capacityAware(vault),legacy,initial,onStage);
 },
 /** Read the encrypted unsaved draft. Throws for an unreadable or invalid slot (recovery). */
 async readDraft(vault:NotesVault):Promise<NotesDraft|null>{
  const value=await vault.read<unknown>(SECURE_NOTES_DRAFT_SLOT);
  return value===null?null:validDraft(value);
 },
 /** Persist the change set of a failed or uncertain commit. A storage-full refusal of the
  * draft itself propagates: the caller keeps the text on screen and says so. */
 async saveDraft(vault:NotesVault,input:{base:string;reason:NotesDraftReason;list:NoteRecord[];saved:NoteRecord[]}):Promise<NotesDraft>{
  const draft:NotesDraft={version:1,savedAt:Date.now(),base:input.base,reason:input.reason,...notesDraftChanges(input.list,input.saved)};
  for(let attempt=0;attempt<3;attempt++){
   const expected=await vault.read<unknown>(SECURE_NOTES_DRAFT_SLOT);
   if((await vault.compareExchange(SECURE_NOTES_DRAFT_SLOT,expected,draft)).status==='saved')return draft;
  }
  throw Error('Notes draft changed in another view');
 },
 /** Remove the exact draft that was reviewed, applied or exported. */
 async clearDraft(vault:NotesVault,expected:NotesDraft):Promise<boolean>{
  return (await vault.compareExchange(SECURE_NOTES_DRAFT_SLOT,expected,null)).status==='saved';
 },
};
