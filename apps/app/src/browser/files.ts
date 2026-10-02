import { WebPlugin } from '@capacitor/core';
import { revision } from './store';
type Entry={id:string;parentId:string;name:string;mimeType:string;directory:boolean;size:number;revision:string;blob?:Blob};
let database:Promise<IDBDatabase>|undefined;
function db(){return database??=new Promise((resolve,reject)=>{const r=indexedDB.open('alpha.browser.files.v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('entries',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>{database=undefined;reject(r.error);};});}
async function entries(){const d=await db();return new Promise<Entry[]>((resolve,reject)=>{const r=d.transaction('entries').objectStore('entries').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function write(action:(store:IDBObjectStore)=>void){const d=await db();return new Promise<void>((resolve,reject)=>{const tx=d.transaction('entries','readwrite');tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error);try{action(tx.objectStore('entries'));}catch(error){tx.abort();reject(error);}});}
const root:Entry={id:'root',parentId:'',name:'Browser files',mimeType:'',directory:true,size:0,revision:'root'};
const publicEntry=({blob,...entry}:Entry)=>({...entry,canCreate:entry.directory,canRename:entry.id!=='root',canDelete:entry.id!=='root',canMove:entry.id!=='root'});
const validName=(name:string)=>{if(!name.trim()||/[\\/\0]/.test(name)||['.','..'].includes(name)||name.length>240)throw Error('Choose a valid file name.');return name.trim();};
export class BrowserFiles extends WebPlugin {
 private selection=new Map<string,string>();
 private urls=new Map<string,string>();
 async choose(){return this.list({});}
 async list(input:{id?:string}){const all=await entries(),folder=input.id&&input.id!=='root'?all.find(e=>e.id===input.id):root;if(!folder?.directory)throw Error('Choose a folder.');return {status:'ready',message:'',rootId:'root',folder:publicEntry(folder),entries:all.filter(e=>e.parentId===folder.id).map(publicEntry)};}
 async createFolder(input:{id:string;name:string}){const parent=(await this.list({id:input.id})).folder;const row:Entry={id:crypto.randomUUID(),parentId:parent.id,name:validName(input.name),mimeType:'',directory:true,size:0,revision:revision()};await write(store=>store.add(row));return this.list({id:parent.id});}
 async importFile(file:File,parentId='root'){await this.list({id:parentId});const row:Entry={id:crypto.randomUUID(),parentId,name:validName(file.name),mimeType:file.type||'application/octet-stream',directory:false,size:file.size,revision:revision(),blob:file};await write(store=>store.add(row));return this.select({id:row.id});}
 async pick(photos=false){return new Promise<any>(resolve=>{const input=document.createElement('input');input.type='file';if(photos)input.accept='image/*,video/*';input.style.display='none';document.body.append(input);input.oncancel=()=>{input.remove();resolve({status:'cancelled',action:photos?'photos':'files'});};input.onchange=async()=>{try{resolve(input.files?.[0]?await this.importFile(input.files[0]):{status:'cancelled',action:'files'});}catch{resolve({status:'failed',action:'files',message:'File could not be imported. Try again.'});}finally{input.remove();}};input.click();});}
 private async mutate(input:{id:string;expectedRevision:string},change:(row:Entry,all:Entry[])=>Entry|null){
  const perform=async()=>{const all=await entries(),row=all.find(e=>e.id===input.id);if(!row||row.revision!==input.expectedRevision)throw Error('This file changed. Refresh and try again.');const updated=change(row,all);await write(store=>updated?store.put({...updated,revision:revision()}):store.delete(row.id));return this.list({id:updated?.parentId||row.parentId});};
  return navigator.locks?navigator.locks.request('alpha.browser.files',perform):perform();
 }
 async rename(input:{id:string;expectedRevision:string;name:string}){return this.mutate(input,row=>({...row,name:validName(input.name)}));}
 async delete(input:{id:string;expectedRevision:string;confirmPermanent:boolean}){if(!input.confirmPermanent)throw Error('Confirm deletion.');return this.mutate(input,(row,all)=>{if(all.some(e=>e.parentId===row.id))throw Error('Empty this folder before deleting it.');return null;});}
 async move(input:{id:string;expectedRevision:string;destinationId:string}){return this.mutate(input,(row,all)=>{const target=input.destinationId==='root'?root:all.find(e=>e.id===input.destinationId);if(!target?.directory)throw Error('Choose a destination folder.');let ancestor:Entry|undefined=target;while(ancestor){if(ancestor.id===row.id)throw Error('Choose a folder outside this folder.');ancestor=all.find(e=>e.id===ancestor!.parentId);}return {...row,parentId:target.id};});}
 async select(input:{id:string}){const row=(await entries()).find(e=>e.id===input.id);if(!row?.blob)throw Error('Choose a file.');const selectionId=crypto.randomUUID(),uri=URL.createObjectURL(row.blob);this.selection.set(selectionId,row.id);this.urls.set(selectionId,uri);return {status:'selected',action:'files',selectionId,uri,name:row.name,mimeType:row.mimeType};}
 private async selected(id:string){const row=(await entries()).find(e=>e.id===this.selection.get(id));if(!row?.blob)throw Error('Select this file again.');return row;}
 async readSelected(input:{selectionId:string}){const row=await this.selected(input.selectionId);if(row.size>2_000_000)return {status:'large',message:'Open or download this file to read it.'};const text=await row.blob!.text();return {status:'read',text,mimeType:row.mimeType,bytes:row.size};}
 async openSelected(input:{selectionId:string}){await this.selected(input.selectionId);window.open(this.urls.get(input.selectionId),'_blank','noopener,noreferrer');return {status:'opened',message:'Document opened.'};}
 async shareSelected(input:{selectionId:string}){const row=await this.selected(input.selectionId),link=document.createElement('a');link.href=this.urls.get(input.selectionId)!;link.download=row.name;document.body.append(link);link.click();link.remove();return {status:'opened'};}
 async renameSelected(input:{selectionId:string;name:string}){const row=await this.selected(input.selectionId);await this.rename({id:row.id,expectedRevision:row.revision,name:input.name});await this.forgetSelected(input);return this.select({id:row.id});}
 async forgetSelected(input:{selectionId:string}){const url=this.urls.get(input.selectionId);if(url)URL.revokeObjectURL(url);this.urls.delete(input.selectionId);this.selection.delete(input.selectionId);}
 async restoreSelected(){return {status:'cancelled',action:'files'};}
 async forget(){for(const id of this.selection.keys())await this.forgetSelected({selectionId:id});return {status:'ready',message:''};}
}
