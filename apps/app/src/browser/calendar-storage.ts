import {BrowserDocumentStore,BrowserDocumentConflict,type BrowserDocumentSnapshot} from '../../../../vendor/eliza/packages/ui/src/platform/browser-document-store';
export const calendarStorageKey='alpha.browser.calendar.v1';
const documents=new BrowserDocumentStore('alpha.browser.documents.v1');
const changes=new BroadcastChannel('alpha.browser.documents.v1');
changes.onmessage=event=>{if(event.data===calendarStorageKey)window.dispatchEvent(new Event('alpha:calendar-preferences'));};

/** Import once; retain the original bytes for recovery rather than keeping two writers. */
export async function calendarSnapshot(signal?:AbortSignal):Promise<BrowserDocumentSnapshot>{
 const current=await documents.read(calendarStorageKey,signal);if(current)return current;
 const raw=localStorage.getItem(calendarStorageKey);
 try{return await documents.compareExchange(calendarStorageKey,undefined,raw,signal);}
 catch(error){if(!(error instanceof BrowserDocumentConflict))throw error;const winner=await documents.read(calendarStorageKey,signal);if(!winner)throw error;return winner;}
}
export async function readCalendarStore<T>(initial:()=>T,signal?:AbortSignal):Promise<T>{
 const {raw}=await calendarSnapshot(signal);return raw===null?editCalendarStore(initial,data=>data,signal):JSON.parse(raw);
}
export async function editCalendarStore<T,R>(initial:()=>T,edit:(data:T)=>R|Promise<R>,signal?:AbortSignal):Promise<R>{
 await calendarSnapshot(signal);
 const result=await documents.edit(calendarStorageKey,async before=>{
  if(!before)throw Error('Calendar document unavailable.');
  const data:T=before.raw===null?initial():JSON.parse(before.raw);
  const result=await edit(data),raw=JSON.stringify(data);return {raw,result:{value:result,changed:raw!==before.raw}};
 },signal);
 if(result.changed)changes.postMessage(calendarStorageKey);
 return result.value;
}
export async function resetCalendarStore(expected:BrowserDocumentSnapshot,signal?:AbortSignal){
 await documents.compareExchange(calendarStorageKey,expected,null,signal);
 changes.postMessage(calendarStorageKey);
}
