export type AudioRow={audioId:string;noteId:string;durationMs:number;blob:Blob;bytes?:ArrayBuffer;transcript:string;createdAt:number;mimeType:string;deletedAt?:number;expired?:true;deletionOperations?:Record<string,'removed'|'restored'>;activeDeletionOperation?:string};
const retention=30*24*60*60*1000;
let database:Promise<IDBDatabase>|undefined;
const id=(value:string)=>{if(typeof value!=='string'||!value||value.length>128)throw Error('Invalid recording identity.');};
function db(){return database??=new Promise((resolve,reject)=>{const r=indexedDB.open('alpha.browser.audio.v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('audio',{keyPath:'audioId'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>{database=undefined;reject(r.error);};});}
function normalize(row:any):AudioRow{
 if(row?.bytes instanceof ArrayBuffer)row={...row,blob:new Blob([row.bytes],{type:row.mimeType||'application/octet-stream'})};
 if(!row||!(row.blob instanceof Blob)||(!row.blob.size&&!row.expired)||!Number.isFinite(row.durationMs)||row.durationMs<=0)throw Error('Recording metadata needs recovery.');id(row.audioId);id(row.noteId);
 return {...row,transcript:typeof row.transcript==='string'?row.transcript:'',createdAt:Number.isFinite(row.createdAt)?row.createdAt:Date.now(),mimeType:row.blob.type||'application/octet-stream'};
}
const stored=(row:AudioRow)=>{if(row.bytes instanceof ArrayBuffer){const {blob,...data}=row;return data;}return row;};
export const audioMetadata=({blob,bytes,...metadata}:AudioRow)=>metadata;
async function mutate<T>(audioId:string,edit:(row:AudioRow|undefined,store:IDBObjectStore)=>T):Promise<T>{
 id(audioId);const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('audio','readwrite'),store=tx.objectStore('audio');let result:T,error:unknown;
 tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(error||tx.error||Error('Recording change could not be saved.'));
 const request=store.get(audioId);request.onsuccess=()=>{try{const row=request.result?normalize(request.result):undefined;result=edit(row,store);}catch(e){error=e;tx.abort();}};
 });
}
export async function retainAudio(audioId:string,noteId:string,transcript:string,clip?:{blob:Blob;durationMs:number}){
 id(noteId);if(typeof transcript!=='string'||transcript.length>64000)throw Error('Transcript is too long.');
 const bytes=clip?await clip.blob.arrayBuffer():undefined;
 return mutate(audioId,(prior,store)=>{if(prior&&(prior.noteId!==noteId||prior.deletedAt))throw Error('This recording is not available for this note.');if(!prior&&!clip)throw Error('Record a clip first.');const row=normalize(prior?{...prior,transcript}:{audioId,noteId,...clip,bytes, mimeType:clip?.blob.type,transcript,createdAt:Date.now()});prior?store.put(stored(row)):store.add(stored(row));return audioMetadata(row);});
}
export async function audioRecord(audioId:string,includeDeleted=false){
 return mutate(audioId,(row,store)=>{if(!row)throw Error('Recording not found.');if(row.deletedAt&&!includeDeleted)throw Error('Restore this recording before playing it.');store.put(stored(row));return row;});
}
const operationId=(value:string)=>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value))throw Error('Invalid deletion operation');};
const receipt=(row:AudioRow,operation:string)=>({audioId:row.audioId,noteId:row.noteId,operationId:operation,status:row.deletionOperations?.[operation]||'unknown'});
export async function audioDeletionStatus(audioId:string,noteId:string,operation:string){operationId(operation);return mutate(audioId,row=>{if(!row||row.noteId!==noteId)throw Error('Recording owner changed');return receipt(row,operation);});}
export async function changeAudioDeleted(audioId:string,noteId:string,deleted:boolean,operation:string){
 id(noteId);operationId(operation);return mutate(audioId,(row,store)=>{
 if(!row||row.noteId!==noteId)throw Error('This recording belongs to another note.');
 const operations=row.deletionOperations||{},prior=operations[operation];
 if(prior==='restored'||(deleted&&prior==='removed'))return receipt(row,operation);
 if(!prior&&Object.keys(operations).length>=128)throw Error('Recording operation history full');
 const legacyRestore=!deleted&&!!row.deletedAt&&!('activeDeletionOperation' in row)&&!('deletionOperations' in row);
 if(row.deletedAt&&row.activeDeletionOperation!==operation&&!legacyRestore)throw Error('Another deletion owns recording');
 if(row.deletedAt&&Date.now()-row.deletedAt>retention)throw Error('This recording has expired.');
 if(deleted){row.deletedAt=Date.now();row.activeDeletionOperation=operation;}else{delete row.deletedAt;delete row.activeDeletionOperation;}
 operations[operation]=deleted?'removed':'restored';row.deletionOperations=operations;store.put(stored(row));return receipt(row,operation);
 });
}
export async function migrateAudio(){
 const d=await db();return new Promise<{state:string;failedRecords:number}>((resolve,reject)=>{const tx=d.transaction('audio','readwrite'),store=tx.objectStore('audio');let failedRecords=0;
 tx.oncomplete=()=>resolve({state:failedRecords?'needs-recovery':'complete',failedRecords});tx.onabort=tx.onerror=()=>reject(tx.error||Error('Recording metadata could not be updated.'));
 const request=store.openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;try{const row=normalize(cursor.value);if(row.deletedAt&&Date.now()-row.deletedAt>retention){if(!row.deletionOperations)cursor.delete();else cursor.update(stored({...row,blob:new Blob([]),bytes:new ArrayBuffer(0),transcript:'',expired:true}));}else cursor.update(stored(row));}catch{failedRecords++;}cursor.continue();};
 });
}
