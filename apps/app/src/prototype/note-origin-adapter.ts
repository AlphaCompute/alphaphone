import {Capacitor} from '@capacitor/core';
import {secureConnectionStore} from '../runtime/native-connection';
import {addNoteOrigin,removeNoteOrigin,findNoteOrigin,noteOriginIndex,noteOriginOf,resolveNoteOrigin,type NoteOrigin,type NoteOriginKind,type NoteOriginIndex} from '../runtime/note-origin';
import {recordingRevision} from './summary-source';
type Bag=Record<string,any>;
const slot='note-origins:v1:device';
let cache:NoteOriginIndex|null=null,loading:Promise<void>|null=null;
const listeners=new Set<()=>void>();
let browserDocument:Promise<{readJson<T>():Promise<T|null>;editJson<T>(update:(value:T|null)=>T|null):Promise<void>}>|null=null;
const browser=()=>browserDocument??=import('../browser/json-domain-document').then(m=>new m.BrowserJsonDomainDocument('alpha.browser.'+slot));
const native=()=>Capacitor.getPlatform()==='android';
/** The stored links, validated. */
export async function readNoteOrigins(){return noteOriginIndex(native()?await secureConnectionStore.read<NoteOriginIndex>(slot):await (await browser()).readJson<NoteOriginIndex>());}
async function change(update:(index:NoteOriginIndex)=>NoteOriginIndex){
 if(native()){
  const raw=await secureConnectionStore.read<NoteOriginIndex>(slot),index=noteOriginIndex(raw),next=update(index);
  if(next!==index&&(await secureConnectionStore.compareExchange(slot,raw,next)).status!=='saved')throw Error('Note links changed.');
 }else await (await browser()).editJson<NoteOriginIndex>(raw=>{const index=noteOriginIndex(raw),next=update(index);return next===index?raw:next;});
 cache=await readNoteOrigins();for(const listener of listeners)listener();
}
/** Reads the saved links once. A failed read shows no links; it never invents one. */
export function loadNoteOrigins(){return loading??=readNoteOrigins().then(index=>{cache=index;for(const listener of listeners)listener();},()=>{loading=null;});}
/** Device calendar row ids are provider-assigned and can be reused, so native events are not linked. */
export const noteOriginSupported=(kind:NoteOriginKind)=>kind==='reminder'||!Capacitor.isNativePlatform();
/** Links a record that was just saved to the note its draft came from. Resolves false when the link
 * was not stored; the saved record itself is never affected. */
export async function rememberNoteOrigin(kind:NoteOriginKind,id:string,value:unknown):Promise<boolean>{
 const origin=noteOriginOf(value);if(!origin||!id||!noteOriginSupported(kind))return false;
 try{await change(index=>addNoteOrigin(index,kind,id,origin,Date.now()));return JSON.stringify(savedNoteOrigin(kind,id))===JSON.stringify(origin);}catch{return false;}
}
export async function forgetNoteOrigin(kind:NoteOriginKind,id:string):Promise<void>{try{await change(index=>removeNoteOrigin(index,kind,id));}catch{/* An orphaned link names no existing record. */}}
export function savedNoteOrigin(kind:NoteOriginKind,id:string):NoteOrigin|undefined{return cache&&id?findNoteOrigin(cache,kind,id):undefined;}

/** Shows "From note" on a saved reminder or event and opens that exact note, or nothing. */
export function installNoteOriginAdapter(Component:Bag,views:Bag){
 const p=Component.prototype,mount=p.componentDidMount,unmount=p.componentWillUnmount,render=views.calendar.render;
 p.componentDidMount=function(){mount.call(this);this.noteOriginChanged=()=>{if(this.live!==false)this.vset('calendar',{});};listeners.add(this.noteOriginChanged);void loadNoteOrigins();};
 p.componentWillUnmount=function(){listeners.delete(this.noteOriginChanged);unmount.call(this);};
 let opening=false;
 views.calendar.render=(state:Bag,api:Bag)=>{
  const out=render(state,api),selected=out.ev&&state.open?(state.events||[]).find((e:Bag)=>e.id===state.open):undefined;
  const origin=selected?.alphaReminderId?savedNoteOrigin('reminder',selected.alphaReminderId):selected?.alphaCalendarId?savedNoteOrigin('event',String(selected.nativeEvent?.seriesId||selected.alphaCalendarId)):undefined;
  if(!origin||!out.ev)return out;
  const openId=state.open;
  out.ev.hasOrigin=true;out.ev.originLabel=`From note: ${origin.title}`;out.ev.originOpenLabel=`Open note ${origin.title}`;
  out.ev.openOrigin=async()=>{
   if(opening)return;opening=true;
   try{
    const gone=()=>api.toast('The note this came from was deleted or replaced. Nothing was opened.');
    const found=resolveNoteOrigin(origin,api.get('notes')?.list);
    if(found.status!=='found'){gone();return;}
    const changed=await recordingRevision(found.note)!==origin.revision;
    if(!api.isActive()||document.hidden||api.get('calendar').open!==openId)return;
    // The note may have been deleted while its revision was computed.
    if(resolveNoteOrigin(origin,api.get('notes')?.list).status!=='found'){gone();return;}
    api.open('notes',{open:origin.noteId});
    if(changed)api.toast('This note was edited after this was created from it.');
   }finally{opening=false;}
  };
  return out;
 };
}
