import type {ImportedCameraImage} from './browser-image-import';
import {drawCameraFrame} from '../browser/camera-frame';
import {BrowserVideoCapture} from '../browser/video-capture';
import {editStore,readStore} from '../browser/store';

type Row={id:string;kind:'image'|'video';path?:string;duration?:number;operationId?:string;image:string;width:number;height:number;date:number;revision:string;mutationRevision:string;favorite:boolean;trashed:boolean};
const finder='[aria-label="Viewfinder. Tap to focus, hold to ask Alpha, swipe to change mode"]';
const revision=()=>crypto.randomUUID();
let database:Promise<IDBDatabase>|undefined;
function db(){return database??=new Promise<IDBDatabase>((resolve,reject)=>{
 const request=indexedDB.open('alpha.browser.photos.v1',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('photos',{keyPath:'id'});
 request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();database=undefined;};resolve(request.result);};
 request.onerror=()=>{database=undefined;reject(request.error);};
 request.onblocked=()=>{database=undefined;reject(Error('Close other Alpha tabs to open photo storage.'));};
});}
async function transaction<T>(mode:IDBTransactionMode,action:(store:IDBObjectStore,set:(value:T)=>void,fail:(error:Error)=>void)=>void):Promise<T>{
 const connection=await db();
 return new Promise((resolve,reject)=>{const tx=connection.transaction('photos',mode);let value:T,error:Error|undefined;
  tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(error??tx.error);tx.onabort=()=>reject(error??tx.error??Error('Photo storage interrupted.'));
  try{action(tx.objectStore('photos'),v=>{value=v;},e=>{error=e;tx.abort();});}catch(e){error=e as Error;tx.abort();}
 });
}
async function rows(options:{before?:string;trashed?:boolean;album?:string}={},metadata=false){
 const custom=options.album&&!['favorites','videos'].includes(options.album)?readStore<Album[]>('alpha.browser.albums.v1',()=>[]).find(a=>a.id===options.album!.replace(/^custom:/,'')):undefined;
 if(options.album&&!['favorites','videos'].includes(options.album)&&!custom)throw Error('Album no longer available.');
 const members=new Set(custom?.memberIds||[]);
 return transaction<Row[]>('readonly',(store,set)=>{const result:Row[]=[];const request=store.openCursor(undefined,'prev');
  request.onsuccess=()=>{const cursor=request.result;if(!cursor){set(result);return;}const row=cursor.value as Row;if(row.kind!=='image'&&row.kind!=='video'){cursor.continue();return;}
   if((!options.before||row.id<options.before)&&(metadata||(!!row.trashed===!!options.trashed&&(!options.album||options.album==='favorites'&&row.favorite||options.album==='videos'&&row.kind==='video'||members.has(row.id)))))result.push(metadata?{...row,image:'',path:undefined}:row);
   if(!metadata&&result.length>=41){set(result);return;}cursor.continue();
  };
 });
}
async function read(id:string){return transaction<Row>('readonly',(store,set,fail)=>{const r=store.get(id);r.onsuccess=()=>['image','video'].includes(r.result?.kind)?set(r.result):fail(Error('Photo no longer available.'));});}
async function change(input:{id:string;revision:string},patch:Partial<Pick<Row,'favorite'|'trashed'>>){
 return transaction<Row>('readwrite',(store,set,fail)=>{const r=store.get(input.id);r.onsuccess=()=>{const row=r.result as Row|undefined;
  if(!row||!['image','video'].includes(row.kind)||row.mutationRevision!==input.revision){fail(Error('Photo changed in another tab. Reopen it and try again.'));return;}
  const updated={...row,...patch,mutationRevision:revision()};store.put(updated);set(updated);
 };});
}
type EditParameters={rotation:number;crop:boolean;filter:string};
type EditSession={id:string;source:Row;active:boolean;expiresAt:number};
type EditRecord={id:string;kind:'edit-receipt';operationId:string;sourceId:string;sourceRevision:string;copyId:string;status:'prepared'|'saving'|'saved'|'failed'|'cancelled'|'unchanged';parameters?:string;attempt?:string};
type EditResult={status:string;operationId:string;id?:string};
const edits=new Map<string,EditSession>();
const filters:Record<string,string>={none:'none',vivid:'saturate(1.55) contrast(1.08)',warm:'sepia(.3) saturate(1.35) hue-rotate(-8deg)',cool:'saturate(1.1) hue-rotate(14deg) brightness(1.03)',mono:'grayscale(1) contrast(1.05)',fade:'contrast(.78) brightness(1.12) saturate(.75)',noir:'grayscale(1) contrast(1.55) brightness(.88)'};
const photoId=()=>Date.now().toString().padStart(13,'0')+Array.from(crypto.getRandomValues(new Uint8Array(12)),n=>String(n%10)).join('');
function editKey(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid edit identity.');return 'edit:'+id;}
function parameters(input:EditParameters){if(![0,90,180,270].includes(input.rotation)||typeof input.crop!=='boolean'||!Object.hasOwn(filters,input.filter))throw Error('Invalid photo transform.');return JSON.stringify([input.rotation,input.crop,input.filter]);}
function session(id:string){const value=edits.get(id);if(!value?.active||Date.now()>value.expiresAt)throw Error('Reopen the photo editor.');return value;}
function outcome(record:EditRecord):EditResult{return {operationId:record.operationId,status:record.status==='saved'?'saved':record.status==='failed'?'failed':record.status==='unchanged'?'unchanged':'not-started',...(record.status==='saved'?{id:record.copyId}:{})};}
async function renderEdit(value:EditSession,input:EditParameters){
 input={rotation:input.rotation,crop:input.crop,filter:input.filter};
 parameters(input);session(value.id);
 const image=new Image();image.src=value.source.image;await image.decode();session(value.id);
 if(image.naturalWidth!==value.source.width||image.naturalHeight!==value.source.height)throw Error('Photo dimensions changed.');
 const crop=input.crop?1.3:1,sw=image.naturalWidth/crop,sh=image.naturalHeight/crop;
 const rotated=input.rotation===90||input.rotation===270,scale=Math.min(1,2048/Math.max(sw,sh));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round((rotated?sh:sw)*scale));canvas.height=Math.max(1,Math.round((rotated?sw:sh)*scale));
 const context=canvas.getContext('2d');if(!context)throw Error('Photo editing is unavailable.');
 if(input.filter!=='none'&&!('filter' in context))throw Error('Photo filters are unavailable in this browser.');
 context.filter=filters[input.filter];context.translate(canvas.width/2,canvas.height/2);context.rotate(input.rotation*Math.PI/180);
 context.drawImage(image,(image.naturalWidth-sw)/2,(image.naturalHeight-sh)/2,sw,sh,-sw*scale/2,-sh*scale/2,sw*scale,sh*scale);
 const encoded=canvas.toDataURL('image/jpeg',0.9);if(!encoded.startsWith('data:image/jpeg;base64,')||encoded.length>12_000_000)throw Error('Edited photo could not be encoded.');
 return {sessionId:value.id,operationId:value.id,image:encoded,width:canvas.width,height:canvas.height,reduced:scale<1,maxEdge:2048,filter:input.filter};
}
async function beginPhotoEdit(input:{id:string;revision:string}){
 for(const value of edits.values())if(Date.now()>value.expiresAt)await cancelPhotoEdit({sessionId:value.id});
 if(edits.size>=4)throw Error('Close another photo editor first.');
 const source=await read(input.id);if(source.trashed||source.mutationRevision!==input.revision)throw Error('Photo changed. Reopen it before editing.');
 const id=revision(),value:EditSession={id,source,active:true,expiresAt:Date.now()+15*60*1000};edits.set(id,value);
 try{
  const preview=await renderEdit(value,{rotation:0,crop:false,filter:'none'});
  const record:EditRecord={id:editKey(id),kind:'edit-receipt',operationId:id,sourceId:source.id,sourceRevision:source.mutationRevision,copyId:photoId(),status:'prepared'};
  await transaction<void>('readwrite',(store,set)=>{store.add(record);set(undefined);});return preview;
 }catch(error){edits.delete(id);value.active=false;throw error;}
}
async function previewPhotoEdit(input:EditParameters&{sessionId:string}){return renderEdit(session(input.sessionId),input);}
async function resultPhotoEdit(input:{operationId:string}):Promise<EditResult>{
 // Reading an uncommitted outcome retires its authority in the same transaction.
 // A suspended save cannot commit later after recovery reported no copy.
 return transaction<EditResult>('readwrite',(store,set)=>{const request=store.get(editKey(input.operationId));request.onsuccess=()=>{
  const record=request.result as EditRecord|undefined;
  if(!record){set({status:'not-started',operationId:input.operationId});return;}
  if(record.status==='prepared'||record.status==='saving'){record.status='cancelled';store.put(record);}
  set(outcome(record));
 };});
}
async function cancelPhotoEdit(input:{sessionId:string}){const value=edits.get(input.sessionId);if(value)value.active=false;edits.delete(input.sessionId);await resultPhotoEdit({operationId:input.sessionId});}
async function savePhotoEdit(input:EditParameters&{sessionId:string}):Promise<EditResult>{
 input={sessionId:input.sessionId,rotation:input.rotation,crop:input.crop,filter:input.filter};
 const encodedParameters=parameters(input),key=editKey(input.sessionId),attempt=revision();
 const claimed=await transaction<EditRecord>('readwrite',(store,set,fail)=>{const request=store.get(key);request.onsuccess=()=>{
  const record=request.result as EditRecord|undefined;
  if(!record){fail(Error('Reopen the photo editor.'));return;}
  if(record.parameters&&record.parameters!==encodedParameters){fail(Error('This save already refers to another edit.'));return;}
  if(record.status==='saved'||record.status==='failed'||record.status==='cancelled'||record.status==='unchanged'){set(record);return;}
  if(record.status==='saving'){fail(Error('Save is already in progress. Check its existing outcome.'));return;}
  record.status=input.rotation===0&&!input.crop&&input.filter==='none'?'unchanged':'saving';record.parameters=encodedParameters;record.attempt=attempt;store.put(record);set(record);
 };});
 if(claimed.status!=='saving')return outcome(claimed);
 try{
  const value=session(input.sessionId),rendered=await renderEdit(value,input);session(input.sessionId);
  return await transaction<EditResult>('readwrite',(store,set)=>{const request=store.get(key);request.onsuccess=()=>{
   const record=request.result as EditRecord;
   if(record.status!=='saving'||record.attempt!==attempt){set(outcome(record));return;}
   const original=store.get(record.sourceId);original.onsuccess=()=>{
    const source=original.result as Row|undefined;
    if(!value.active||Date.now()>value.expiresAt||!source||source.trashed||source.mutationRevision!==record.sourceRevision){record.status='failed';store.put(record);set(outcome(record));return;}
    const copy:Row={id:record.copyId,kind:'image',image:rendered.image,width:rendered.width,height:rendered.height,date:Date.now(),revision:revision(),mutationRevision:revision(),favorite:false,trashed:false};
    // Copy and receipt either both commit or neither does. The original is never written.
    store.add(copy);record.status='saved';store.put(record);set(outcome(record));
   };
  };});
 }catch(error){
  await transaction<void>('readwrite',(store,set)=>{const request=store.get(key);request.onsuccess=()=>{const record=request.result as EditRecord|undefined;if(record?.status==='saving'&&record.attempt===attempt){record.status='failed';store.put(record);}set(undefined);};});throw error;
 }
}

type Album={id:string;name:string;revision:string;count:number;memberIds:string[]};
const mediaId=()=>Date.now().toString().padStart(13,'0')+Array.from(crypto.getRandomValues(new Uint8Array(12)),n=>String(n%10)).join('');
const prepared=new Map<string,{id:string;revision:string}[]>();
export const browserPhotoLibrary={
 beginEdit:beginPhotoEdit,previewEdit:previewPhotoEdit,saveEdit:savePhotoEdit,editResult:resultPhotoEdit,cancelEdit:cancelPhotoEdit,
 async list(options:{before?:string;trashed?:boolean;album?:string}={}){const result=await rows(options);return {items:result.slice(0,40),next:result.length>40?result[39].id:''};},
 async read(input:{id:string}){return read(input.id);},
 async summary(){const all=await rows({},true);return {favorites:all.filter(r=>!r.trashed&&r.favorite).length,videos:all.filter(r=>!r.trashed&&r.kind==='video').length,trash:all.filter(r=>r.trashed).length,canFavorite:true};},
 async albums(){const live=new Set((await rows({},true)).filter(row=>!row.trashed).map(row=>row.id));return {items:readStore<Album[]>('alpha.browser.albums.v1',()=>[]).map(album=>({...album,count:album.memberIds.filter(id=>live.has(id)).length}))};},
 async shareMany(input:{items:{id:string;revision:string}[]}){for(const item of input.items){const row=await read(item.id);if(row.mutationRevision!==item.revision||row.trashed)throw Error('Selection changed.');}for(const item of input.items)await browserPhotoLibrary.share(item);return {status:'opened',count:input.items.length};},
 async changeAlbum(input:Record<string,unknown>){
  if(!['create','rename','delete','add','remove'].includes(String(input.operation)))throw Error('Unknown album operation.');
  const name=typeof input.name==='string'?input.name.trim():'';
  if(['create','rename'].includes(String(input.operation))&&(!name||name.length>80||/[\u0000-\u001f\u007f]/.test(name)))throw Error('Choose an album name between 1 and 80 characters.');
  return editStore<Album[],{status:string;id:string;revision:string}>('alpha.browser.albums.v1',()=>[],async albums=>{
   let media:Row|undefined;
   if(input.operation==='add'||input.operation==='remove'||input.operation==='create'&&(input.mediaId!==undefined||input.mediaRevision!==undefined)){
    if(typeof input.mediaId!=='string'||typeof input.mediaRevision!=='string')throw Error('Select the photo again.');
    media=await read(input.mediaId);if(media.mutationRevision!==input.mediaRevision||media.trashed)throw Error('Photo changed. Reopen it.');
   }
   if(input.operation==='create'){const memberIds=media?[media.id]:[],album:Album={id:crypto.randomUUID(),name,revision:revision(),count:memberIds.length,memberIds};albums.push(album);return {status:'updated',id:album.id,revision:album.revision};}
   const album=albums.find(a=>a.id===input.id);if(!album||album.revision!==input.revision)throw Error('Album changed. Reopen it.');
   if(input.operation==='delete')albums.splice(albums.indexOf(album),1);
   else if(input.operation==='rename')album.name=name;
   else {album.memberIds=album.memberIds.filter(id=>id!==media!.id);if(input.operation==='add')album.memberIds.push(media!.id);}
   album.revision=revision();album.count=album.memberIds.length;return {status:'updated',id:album.id,revision:album.revision};
  });
 },
 async setFavorite(input:{id:string;revision:string;favorite:boolean}){return change(input,{favorite:input.favorite});},
 async setTrashed(input:{id:string;revision:string;trashed:boolean}){return {...await change(input,{trashed:input.trashed}),status:'updated'};},
 async changeMany(input:{operation:'favorite'|'trash'|'restore';items:{id:string;revision:string}[]}){
  const outcomes=[];for(const item of input.items){try{const row=await change(item,input.operation==='favorite'?{favorite:true}:{trashed:input.operation==='trash'});outcomes.push({id:item.id,status:'updated',item:row});}catch{outcomes.push({id:item.id,status:'conflict'});}}return {status:'complete',outcomes};
 },
 async share(input:{id:string}){const row=await read(input.id);if(row.trashed)throw Error('Restore this photo before downloading.');
  const link=document.createElement('a');link.href=row.path||row.image;link.download=`Alpha-photo-${row.id}.${row.kind==='video'?(row.path?.startsWith('data:video/mp4;')?'mp4':'webm'):'jpg'}`;document.body.append(link);link.click();link.remove();return {status:'opened',message:'Photo download requested. Check your browser downloads.'};
 },
 async prepareDeleteTrash(){const confirmation=revision();prepared.clear();const selected=(await rows({},true)).filter(r=>r.trashed).map(r=>({id:r.id,revision:r.mutationRevision}));prepared.set(confirmation,selected);return {confirmation,count:selected.length};},
 async cancelDeleteTrash(input:{confirmation:string}){prepared.delete(input.confirmation);},
 async deletePreparedTrash(input:{confirmation:string}){const selected=prepared.get(input.confirmation);if(!selected)throw Error('Review the trash again.');prepared.delete(input.confirmation);
  return transaction<{status:string;deletedIds:string[];skippedIds:string[];failedIds:string[]}>('readwrite',(store,set)=>{const result={status:'complete',deletedIds:[] as string[],skippedIds:[] as string[],failedIds:[] as string[]};set(result);for(const item of selected){const r=store.get(item.id);r.onsuccess=()=>{const row=r.result as Row|undefined;if(row?.trashed&&row.mutationRevision===item.revision){store.delete(item.id);result.deletedIds.push(item.id);}else result.skippedIds.push(item.id);};}});
 },
};
export async function importBrowserPhoto(image:ImportedCameraImage,signal:AbortSignal){
 signal.throwIfAborted();const row:Row={id:photoId(),kind:'image',image:image.image,width:image.width,height:image.height,date:Date.now(),revision:revision(),mutationRevision:revision(),favorite:false,trashed:false};
 await transaction<void>('readwrite',(store,set)=>{signal.throwIfAborted();store.add(row);set(undefined);});return row;
}
const unavailable=async()=>{throw Error('This operation is not available for browser photos. The original is unchanged.');};
export const browserLibrary=new Proxy(browserPhotoLibrary,{get(target,key){return Reflect.get(target,key)??unavailable;}});
const videoCapture=new BrowserVideoCapture();
let videoSession=0;
let videoSave:Promise<{path:string;duration:number;width:number;height:number;fileSize:number}>|undefined;
let preview:HTMLVideoElement|null=null,stream:MediaStream|null=null,generation=0;
let starting:AbortController|undefined;
let zoom=1,mirror=false;
function release(video:HTMLVideoElement|null,media:MediaStream|null){media?.getTracks().forEach(track=>track.stop());if(video){video.pause();video.srcObject=null;video.remove();}}
export function mountBrowserCamera(){const frame=document.querySelector<HTMLElement>(finder);if(preview&&frame&&preview.parentElement!==frame)frame.prepend(preview);}
export const browserCamera={
 async startPreview(options:{direction:'front'|'back';resolution:{width:number;height:number};mirror:boolean}){
  void browserCamera.stopPreview();const token=++generation,controller=new AbortController();starting=controller;
  let ownStream:MediaStream|null=null,ownVideo:HTMLVideoElement|null=null;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera access is unavailable in this browser.');
   ownStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:options.direction==='front'?'user':'environment',width:{ideal:options.resolution.width},height:{ideal:options.resolution.height}}});
   controller.signal.throwIfAborted();if(token!==generation)throw Error('Camera cancelled.');
   const frame=document.querySelector<HTMLElement>(finder);if(!frame)throw Error('Camera view is closed.');
   ownVideo=document.createElement('video');ownVideo.srcObject=ownStream;ownVideo.autoplay=true;ownVideo.playsInline=true;ownVideo.muted=true;
   ownVideo.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:1'+(options.mirror?';transform:scaleX(-1)':'');
   preview=ownVideo;stream=ownStream;zoom=1;mirror=options.mirror;frame.prepend(ownVideo);
   await new Promise<void>((resolve,reject)=>{
    const finish=(error?:unknown)=>{clearTimeout(timeout);controller.signal.removeEventListener('abort',abort);error?reject(error):resolve();};
    const abort=()=>finish(new DOMException('Camera cancelled.','AbortError'));
    const timeout=setTimeout(()=>finish(Error('Camera preview timed out.')),15000);
    controller.signal.addEventListener('abort',abort,{once:true});
    if(controller.signal.aborted){abort();return;}ownVideo!.play().then(()=>finish(),finish);
   });
   controller.signal.throwIfAborted();
   const settings=ownStream.getVideoTracks()[0].getSettings();return {width:ownVideo.videoWidth,height:ownVideo.videoHeight,deviceId:settings.deviceId??''};
  }catch(error){release(ownVideo,ownStream);if(preview===ownVideo){preview=null;stream=null;}throw error;}
  finally{if(starting===controller)starting=undefined;}
 },
 async stopPreview(){++generation;++videoSession;videoCapture.cancel();starting?.abort();starting=undefined;release(preview,stream);preview=null;stream=null;},
 async capturePhoto(){const token=generation,video=preview;if(!video||!stream||video.readyState<2)throw Error('Camera is not ready.');
  const width=video.videoWidth,height=video.videoHeight;if(width<=0||height<=0||width*height>32_000_000)throw Error('Unsupported photo dimensions.');
  const canvas=drawCameraFrame(video,{zoom,mirror});
  const image=canvas.toDataURL('image/jpeg',0.85);if(!image.startsWith('data:image/jpeg;base64,'))throw Error('Photo encoding failed.');
  const photo={base64:image.slice('data:image/jpeg;base64,'.length),format:'jpeg',width,height};if(token!==generation)throw Error('Camera view changed.');
  if(!photo.base64||photo.base64.length>12_000_000)throw Error('Photo is too large to save in this browser.');
  // Decimal time plus random suffix is sortable and keeps the existing receipt parser.
  const id=photoId();
  const row:Row={id,kind:'image',image:'data:image/jpeg;base64,'+photo.base64,width:photo.width,height:photo.height,date:Date.now(),revision:revision(),mutationRevision:revision(),favorite:false,trashed:false};
  await transaction<void>('readwrite',(store,set)=>{store.add(row);set(undefined);});
  return {...photo,path:'browser-photo:///'+id};
 },
 async switchCamera(options:{direction:'front'|'back'}){return browserCamera.startPreview({...options,resolution:{width:1280,height:720},mirror:options.direction==='front'});},
 async setZoom(input:{zoom:number}){if(!preview)throw Error('Start camera first.');if(!Number.isFinite(input.zoom)||input.zoom<1||input.zoom>8)throw Error('Digital zoom must be between 1× and 8×.');if(videoCapture.state().isRecording)throw Error('Stop recording before changing zoom.');zoom=input.zoom;preview.style.transform=`scale(${mirror?-zoom:zoom},${zoom})`;},
 async setSettings(input:{settings:{flash:string}}){
  if(!['on','off'].includes(input.settings.flash))throw Error('Choose flash on or off.');
  const track=stream?.getVideoTracks()[0],token=generation,enabled=input.settings.flash==='on';if(!track)throw Error('Start camera first.');
  if(!(track.getCapabilities() as MediaTrackCapabilities&{torch?:boolean}).torch){if(enabled)throw Error('This camera does not expose a torch.');return;}
  await track.applyConstraints({advanced:[{torch:enabled} as MediaTrackConstraintSet&{torch:boolean}]});
  if(token!==generation)throw Error('Camera changed.');
  if((track.getSettings() as MediaTrackSettings&{torch?:boolean}).torch!==enabled){await track.applyConstraints({advanced:[{torch:false} as MediaTrackConstraintSet&{torch:boolean}]});throw Error('The camera could not confirm its torch setting.');}
 },
 async setFocusPoint(){throw Error('Manual focus is not exposed by this browser camera.');},
 async startRecording(input:{audio?:boolean;maxDuration:number;maxFileSize:number}){if(!preview)throw Error('Start camera first.');++videoSession;videoSave=undefined;await videoCapture.start(preview,input,{zoom,mirror});},
 stopRecording(){
  if(videoSave)return videoSave;
  const token=generation,session=videoSession;
  videoSave=(async()=>{
   const clip=await videoCapture.stop(),id=mediaId();
   const path=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(clip.blob);});
   const row:Row={id:'v:'+id,kind:'video',path,duration:clip.duration,image:clip.image,width:clip.width,height:clip.height,date:Date.now(),revision:revision(),mutationRevision:revision(),favorite:false,trashed:false};
   await transaction<void>('readwrite',(store,set)=>{if(token!==generation||session!==videoSession)throw new DOMException('Video save cancelled.','AbortError');store.add(row);set(undefined);});
   return {path:'browser-video:///'+id,duration:clip.duration,width:clip.width,height:clip.height,fileSize:clip.blob.size};
  })();return videoSave;
 },
 async getRecordingState(){return videoCapture.state();},
};
