
type Row={id:string;kind:'image';image:string;width:number;height:number;date:number;revision:string;mutationRevision:string;favorite:boolean;trashed:boolean};
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
 return transaction<Row[]>('readonly',(store,set)=>{const result:Row[]=[];const request=store.openCursor(undefined,'prev');
  request.onsuccess=()=>{const cursor=request.result;if(!cursor){set(result);return;}const row=cursor.value as Row;
   if((!options.before||row.id<options.before)&&(metadata||(!!row.trashed===!!options.trashed&&(!options.album||options.album==='favorites'&&row.favorite))))result.push(metadata?{...row,image:''}:row);
   if(!metadata&&result.length>=41){set(result);return;}cursor.continue();
  };
 });
}
async function read(id:string){return transaction<Row>('readonly',(store,set,fail)=>{const r=store.get(id);r.onsuccess=()=>r.result?set(r.result):fail(Error('Photo no longer available.'));});}
async function change(input:{id:string;revision:string},patch:Partial<Pick<Row,'favorite'|'trashed'>>){
 return transaction<Row>('readwrite',(store,set,fail)=>{const r=store.get(input.id);r.onsuccess=()=>{const row=r.result as Row|undefined;
  if(!row||row.mutationRevision!==input.revision){fail(Error('Photo changed in another tab. Reopen it and try again.'));return;}
  const updated={...row,...patch,mutationRevision:revision()};store.put(updated);set(updated);
 };});
}
const prepared=new Map<string,{id:string;revision:string}[]>();
export const browserPhotoLibrary={
 async list(options:{before?:string;trashed?:boolean;album?:string}={}){const result=await rows(options);return {items:result.slice(0,40),next:result.length>40?result[39].id:''};},
 async read(input:{id:string}){return read(input.id);},
 async summary(){const all=await rows({},true);return {favorites:all.filter(r=>!r.trashed&&r.favorite).length,videos:0,trash:all.filter(r=>r.trashed).length,canFavorite:true};},
 async albums(){return {items:[]};},
 async setFavorite(input:{id:string;revision:string;favorite:boolean}){return change(input,{favorite:input.favorite});},
 async setTrashed(input:{id:string;revision:string;trashed:boolean}){return {...await change(input,{trashed:input.trashed}),status:'updated'};},
 async changeMany(input:{operation:'favorite'|'trash'|'restore';items:{id:string;revision:string}[]}){
  const outcomes=[];for(const item of input.items){try{const row=await change(item,input.operation==='favorite'?{favorite:true}:{trashed:input.operation==='trash'});outcomes.push({id:item.id,status:'updated',item:row});}catch{outcomes.push({id:item.id,status:'conflict'});}}return {status:'complete',outcomes};
 },
 async share(input:{id:string}){const row=await read(input.id);if(row.trashed)throw Error('Restore this photo before downloading.');
  const link=document.createElement('a');link.href=row.image;link.download=`Alpha-photo-${row.id}.jpg`;document.body.append(link);link.click();link.remove();return {status:'opened',message:'Photo download requested. Check your browser downloads.'};
 },
 async prepareDeleteTrash(){const confirmation=revision();prepared.clear();const selected=(await rows({},true)).filter(r=>r.trashed).map(r=>({id:r.id,revision:r.mutationRevision}));prepared.set(confirmation,selected);return {confirmation,count:selected.length};},
 async cancelDeleteTrash(input:{confirmation:string}){prepared.delete(input.confirmation);},
 async deletePreparedTrash(input:{confirmation:string}){const selected=prepared.get(input.confirmation);if(!selected)throw Error('Review the trash again.');prepared.delete(input.confirmation);
  return transaction<{status:string;deletedIds:string[];skippedIds:string[];failedIds:string[]}>('readwrite',(store,set)=>{const result={status:'complete',deletedIds:[] as string[],skippedIds:[] as string[],failedIds:[] as string[]};set(result);for(const item of selected){const r=store.get(item.id);r.onsuccess=()=>{const row=r.result as Row|undefined;if(row?.trashed&&row.mutationRevision===item.revision){store.delete(item.id);result.deletedIds.push(item.id);}else result.skippedIds.push(item.id);};}});
 },
};
const unavailable=async()=>{throw Error('This operation is not available for browser photos. The original is unchanged.');};
export const browserLibrary=new Proxy(browserPhotoLibrary,{get(target,key){return Reflect.get(target,key)??unavailable;}});
let preview:HTMLVideoElement|null=null,stream:MediaStream|null=null,generation=0;
let starting:AbortController|undefined;
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
   preview=ownVideo;stream=ownStream;frame.prepend(ownVideo);
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
 async stopPreview(){++generation;starting?.abort();starting=undefined;release(preview,stream);preview=null;stream=null;},
 async capturePhoto(){const token=generation,video=preview;if(!video||!stream||video.readyState<2)throw Error('Camera is not ready.');
  const width=video.videoWidth,height=video.videoHeight;if(width<=0||height<=0||width*height>32_000_000)throw Error('Unsupported photo dimensions.');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');if(!context)throw Error('Photo encoding is unavailable.');context.drawImage(video,0,0,width,height);
  const image=canvas.toDataURL('image/jpeg',0.85);if(!image.startsWith('data:image/jpeg;base64,'))throw Error('Photo encoding failed.');
  const photo={base64:image.slice('data:image/jpeg;base64,'.length),format:'jpeg',width,height};if(token!==generation)throw Error('Camera view changed.');
  if(!photo.base64||photo.base64.length>12_000_000)throw Error('Photo is too large to save in this browser.');
  // Decimal time plus random suffix is sortable and keeps the existing receipt parser.
  const id=Date.now().toString().padStart(13,'0')+Array.from(crypto.getRandomValues(new Uint8Array(12)),n=>String(n%10)).join('');
  const row:Row={id,kind:'image',image:'data:image/jpeg;base64,'+photo.base64,width:photo.width,height:photo.height,date:Date.now(),revision:revision(),mutationRevision:revision(),favorite:false,trashed:false};
  await transaction<void>('readwrite',(store,set)=>{store.add(row);set(undefined);});
  return {...photo,path:'browser-photo:///'+id};
 },
 async switchCamera(options:{direction:'front'|'back'}){return browserCamera.startPreview({...options,resolution:{width:1280,height:720},mirror:options.direction==='front'});},
 setZoom:unavailable,setSettings:unavailable,setFocusPoint:unavailable,startRecording:unavailable,stopRecording:unavailable,getRecordingState:unavailable,
};
