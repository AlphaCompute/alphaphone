export {DocumentNotesStore} from '../../../../.eliza/client-features/plugins/plugin-notes/src/client/notes-document-store.ts';
import {DocumentNotesStore,NotesDocumentConflict,type NotesDocumentPort,type NotesDocumentSnapshot} from '../../../../.eliza/client-features/plugins/plugin-notes/src/client/notes-document-store.ts';
import {BrowserDocumentConflict} from '../../../../.eliza/client-features/packages/ui/src/platform/browser-document-store';
import {browserDocuments} from '../browser/documents';
import type {DomainRecovery} from '../browser/domain-document';
import {NotesStore,NOTES_KEY,LEGACY_NOTES_KEY} from './notes-store';
import {readLegacyDailyNotes} from './notes-secure-store';
import {withAudioDeletionLock} from './note-audio-lock';

export const browserNotesKey='alpha.browser.notes.v1';
const dailyKey='alphaphone:daily:v1';
type Archive={v1:string|null;v2:string|null;daily:string|null};
type Envelope={version:1;archive:Archive;currentRaw:string};
const legacy=():Archive=>({v1:localStorage.getItem(LEGACY_NOTES_KEY),v2:localStorage.getItem(NOTES_KEY),daily:localStorage.getItem(dailyKey)});
function decode(raw:string|null):Envelope{
 const value=raw===null?null:JSON.parse(raw);
 if(!value||value.version!==1||typeof value.currentRaw!=='string'||!value.archive||Object.keys(value.archive).length!==3||!['v1','v2','daily'].every(key=>Object.hasOwn(value.archive,key)&&(value.archive[key]===null||typeof value.archive[key]==='string')))throw Error('Browser Notes metadata needs recovery.');
 return value;
}
function sameLegacy(a:Archive,b:Archive){
 if(a.v1!==b.v1||a.v2!==b.v2)return false;
 if(a.daily===b.daily)return true;
 // Other fields in the old Daily record do not belong to Notes.
 try{const notes=(raw:string|null)=>raw===null?[]:JSON.parse(raw).notes;const left=notes(a.daily),right=notes(b.daily);return Array.isArray(left)&&Array.isArray(right)&&JSON.stringify(left)===JSON.stringify(right);}catch{return false;}
}
function assertLegacy(archive:Archive){if(!sameLegacy(legacy(),archive))throw Error('Older Notes changed. Close older tabs and review recovery before editing.');}
function receipt(snapshot:{revision:string;raw:string|null}):NotesDocumentSnapshot{const value=decode(snapshot.raw);assertLegacy(value.archive);return {revision:snapshot.revision,raw:value.currentRaw};}

/** Product keys, exact legacy archive and reset policy; upstream owns Notes semantics. */
export const browserNotesPort:NotesDocumentPort={
 async initialize(create,signal){
  if(!navigator.locks?.request)throw Error('Safe browser Notes requires Web Locks');
  return navigator.locks.request(JSON.stringify(['browser-document','alpha.browser.documents.v1',browserNotesKey]),{mode:'exclusive',...(signal?{signal}:{})},async()=>{
   signal?.throwIfAborted();const saved=await browserDocuments.read(browserNotesKey,signal);if(saved)return receipt(saved);
   const archive=legacy(),currentRaw=create(archive.v2,archive.v1);assertLegacy(archive);signal?.throwIfAborted();
   try{return receipt(await browserDocuments.compareExchange(browserNotesKey,undefined,JSON.stringify({version:1,archive,currentRaw}),signal));}
   catch(error){if(error instanceof BrowserDocumentConflict)throw new NotesDocumentConflict('Notes were initialized in another view. Reopen Notes.');throw error;}
  });
 },
 async read(signal){const saved=await browserDocuments.read(browserNotesKey,signal);return saved?receipt(saved):null;},
 async compareExchange(expected,raw,signal){
  signal?.throwIfAborted();const before=await browserDocuments.read(browserNotesKey,signal);
  if(!before)throw new NotesDocumentConflict('Notes storage changed. Reopen Notes.');
  const current=receipt(before);if(current.revision!==expected.revision||current.raw!==expected.raw)throw new NotesDocumentConflict('Notes changed in another view. Reopen before editing.');
  const value=decode(before.raw);assertLegacy(value.archive);signal?.throwIfAborted();
  try{return receipt(await browserDocuments.compareExchange(browserNotesKey,before,JSON.stringify({...value,currentRaw:raw}),signal));}
  catch(error){if(error instanceof BrowserDocumentConflict)throw new NotesDocumentConflict('Notes changed in another view. Reopen before editing.');throw error;}
 },
};
export const openBrowserNotes=(signal?:AbortSignal)=>DocumentNotesStore.open(browserNotesPort,()=>readLegacyDailyNotes(localStorage),signal);
export async function readBrowserNotesRaw(){const saved=await browserNotesPort.read();if(!saved)throw Error('Notes readback unavailable');return saved.raw;}

export const browserNotesRecovery={
 async capture(signal?:AbortSignal):Promise<DomainRecovery>{
  const snapshot=await browserDocuments.read(browserNotesKey,signal),current=legacy(),older=JSON.stringify(current);
  if(!snapshot)return {snapshot,legacy:older,raw:older,format:'domain',legacyChanged:false};
  try{const value=decode(snapshot.raw);return {snapshot,legacy:older,raw:snapshot.raw,format:'domain',legacyChanged:!sameLegacy(current,value.archive)};}
  catch{return {snapshot,legacy:older,raw:snapshot.raw,format:'unrecognized',legacyChanged:false};}
 },
 async reset(expected:DomainRecovery,signal?:AbortSignal){
  await withAudioDeletionLock(async()=>{
   signal?.throwIfAborted();const archive=legacy();if(JSON.stringify(archive)!==expected.legacy)throw Error('Older Notes changed. Capture recovery again.');
   // An explicit reset creates a new empty collection and cannot reimport the archive.
   const values=new Map<string,string>(),store=new NotesStore({getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);}});
   await browserDocuments.compareExchange(browserNotesKey,expected.snapshot,JSON.stringify({version:1,archive,currentRaw:store.raw}),signal);
  },signal);
 },
};
