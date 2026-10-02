export type AudioRow={audioId:string;noteId:string;durationMs:number;blob:Blob;transcript:string;createdAt:number;mimeType:string;deletedAt?:number};
const retention=30*24*60*60*1000;
let database:Promise<IDBDatabase>|undefined;
const id=(value:string)=>{if(typeof value!=='string'||!value||value.length>128)throw Error('Invalid recording identity.');};
function db(){return database??=new Promise((resolve,reject)=>{const r=indexedDB.open('alpha.browser.audio.v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('audio',{keyPath:'audioId'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>{database=undefined;reject(r.error);};});}
function normalize(row:any):AudioRow{
 if(!row||!(row.blob instanceof Blob)||!row.blob.size||!Number.isFinite(row.durationMs)||row.durationMs<=0)throw Error('Recording metadata needs recovery.');id(row.audioId);id(row.noteId);
 return {...row,transcript:typeof row.transcript==='string'?row.transcript:'',createdAt:Number.isFinite(row.createdAt)?row.createdAt:Date.now(),mimeType:row.blob.type||'application/octet-stream'};
}
export const audioMetadata=({blob,...metadata}:AudioRow)=>metadata;
async function mutate<T>(audioId:string,edit:(row:AudioRow|undefined,store:IDBObjectStore)=>T):Promise<T>{
 id(audioId);const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('audio','readwrite'),store=tx.objectStore('audio');let result:T,error:unknown;
 tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(error||tx.error||Error('Recording change could not be saved.'));
 const request=store.get(audioId);request.onsuccess=()=>{try{const row=request.result?normalize(request.result):undefined;result=edit(row,store);}catch(e){error=e;tx.abort();}};
 });
}
export async function retainAudio(audioId:string,noteId:string,transcript:string,clip?:{blob:Blob;durationMs:number}){
 id(noteId);if(typeof transcript!=='string'||transcript.length>64000)throw Error('Transcript is too long.');
 return mutate(audioId,(prior,store)=>{if(prior&&(prior.noteId!==noteId||prior.deletedAt))throw Error('This recording is not available for this note.');if(!prior&&!clip)throw Error('Record a clip first.');const row=normalize(prior?{...prior,transcript}:{audioId,noteId,...clip,transcript,createdAt:Date.now()});prior?store.put(row):store.add(row);return audioMetadata(row);});
}
export async function audioRecord(audioId:string,includeDeleted=false){
 return mutate(audioId,(row,store)=>{if(!row)throw Error('Recording not found.');if(row.deletedAt&&!includeDeleted)throw Error('Restore this recording before playing it.');store.put(row);return row;});
}
export async function changeAudioDeleted(audioId:string,noteId:string,deleted:boolean){
 id(noteId);return mutate(audioId,(row,store)=>{if(!row||row.noteId!==noteId)throw Error('This recording belongs to another note.');if(row.deletedAt&&Date.now()-row.deletedAt>retention)throw Error('This recording has expired.');if(deleted)row.deletedAt??=Date.now();else delete row.deletedAt;store.put(row);return audioMetadata(row);});
}
export async function migrateAudio(){
 const d=await db();return new Promise<{state:string;failedRecords:number}>((resolve,reject)=>{const tx=d.transaction('audio','readwrite'),store=tx.objectStore('audio');let failedRecords=0;
 tx.oncomplete=()=>resolve({state:failedRecords?'needs-recovery':'complete',failedRecords});tx.onabort=tx.onerror=()=>reject(tx.error||Error('Recording metadata could not be updated.'));
 const request=store.openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;try{const row=normalize(cursor.value);if(row.deletedAt&&Date.now()-row.deletedAt>retention)cursor.delete();else cursor.update(row);}catch{failedRecords++;}cursor.continue();};
 });
}
