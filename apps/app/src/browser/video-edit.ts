export type VideoEdit={start:number;end:number;rotation:number;crop:boolean};
export function validateVideoEdit(edit:VideoEdit,duration:number){
 if(!Number.isFinite(duration)||duration<=0||duration>300||!Number.isFinite(edit.start)||!Number.isFinite(edit.end)||edit.start<0||edit.end>duration+.05||edit.end-edit.start<.1||![0,90,180,270].includes(edit.rotation)||typeof edit.crop!=='boolean')throw Error('Choose a valid video range of at least 0.1 seconds.');
}
/** Local real-time re-encoding; audio is routed directly from the file, never a microphone. */
export async function renderVideoEdit(source:{path:string;duration:number},edit:VideoEdit,signal:AbortSignal){
 validateVideoEdit(edit,source.duration);signal.throwIfAborted();
 if(!/^data:video\/(webm|mp4);base64,/.test(source.path)||source.path.length>140_000_000)throw Error('Choose a local video up to 100 MB.');
 const video=document.createElement('video');video.playsInline=true;video.preload='auto';video.src=source.path;
 let audio:AudioContext|undefined,output:MediaStream|undefined,recorder:MediaRecorder|undefined,timer:ReturnType<typeof setInterval>|undefined;
 const wait=(event:string,action:()=>void)=>new Promise<void>((resolve,reject)=>{const finish=(error?:unknown)=>{clearTimeout(timeout);video.removeEventListener(event,ok);video.removeEventListener('error',bad);signal.removeEventListener('abort',abort);error?reject(error):resolve();},ok=()=>finish(),bad=()=>finish(Error('Video could not decode.')),abort=()=>finish(signal.reason);const timeout=setTimeout(()=>finish(Error('Video decode timed out.')),15000);video.addEventListener(event,ok,{once:true});video.addEventListener('error',bad,{once:true});signal.addEventListener('abort',abort,{once:true});try{signal.throwIfAborted();action();}catch(error){finish(error);}});
 try{
  await wait('loadeddata',()=>video.load());signal.throwIfAborted();
  if(!video.videoWidth||!video.videoHeight||video.videoWidth*video.videoHeight>32000000)throw Error('Unsupported video dimensions.');
  if(edit.start>0)await wait('seeked',()=>{video.currentTime=edit.start;});signal.throwIfAborted();
  const canvas=drawEditedVideo(video,edit),draw=()=>{drawEditedVideo(video,edit,canvas);};const image=canvas.toDataURL('image/jpeg',.85);
  output=canvas.captureStream(30);audio=new AudioContext();const sourceNode=audio.createMediaElementSource(video),destination=audio.createMediaStreamDestination();sourceNode.connect(destination);output.addTrack(destination.stream.getAudioTracks()[0]);await new Promise<void>((resolve,reject)=>{const finish=(error?:unknown)=>{clearTimeout(timeout);signal.removeEventListener('abort',abort);error?reject(error):resolve();},abort=()=>finish(signal.reason),timeout=setTimeout(()=>finish(Error('Video audio startup timed out.')),15000);signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}void audio!.resume().then(()=>finish(),finish);});signal.throwIfAborted();
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));if(!mime)throw Error('No local video encoder is available.');recorder=new MediaRecorder(output,{mimeType:mime});
  const blob=await new Promise<Blob>((resolve,reject)=>{
   const chunks:Blob[]=[];let bytes=0,settled=false;const finish=(error?:unknown)=>{if(settled)return;settled=true;clearTimeout(deadline);clearInterval(timer);signal.removeEventListener('abort',abort);video.pause();video.onended=null;video.onerror=null;if(recorder!.state!=='inactive')recorder!.stop();error?reject(error):bytes?resolve(new Blob(chunks,{type:mime.split(';')[0]})):reject(Error('Edited video is empty.'));};
   const abort=()=>finish(signal.reason),stop=()=>{video.pause();if(recorder!.state!=='inactive')recorder!.stop();};
   const deadline=setTimeout(()=>finish(Error('Video export timed out.')),(edit.end-edit.start)*1000+15000);signal.addEventListener('abort',abort,{once:true});
   recorder!.ondataavailable=e=>{if(settled)return;bytes+=e.data.size;if(bytes>100*1024*1024){finish(Error('Edited video exceeds 100 MB.'));return;}chunks.push(e.data);};recorder!.onstop=()=>finish();recorder!.onerror=()=>finish(Error('Video encoding interrupted.'));video.onerror=()=>finish(Error('Video decoding interrupted.'));video.onended=stop;
   try{recorder!.start(200);timer=setInterval(()=>{try{draw();if(video.currentTime>=edit.end)stop();}catch(error){finish(error);}},20);void video.play().catch(finish);}catch(error){finish(error);}
  });
  signal.throwIfAborted();const path=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});signal.throwIfAborted();return {path,image,width:canvas.width,height:canvas.height,duration:edit.end-edit.start};
 }finally{clearInterval(timer);if(recorder?.state==='recording')recorder.stop();output?.getTracks().forEach(t=>t.stop());await audio?.close().catch(()=>{});video.pause();video.removeAttribute('src');video.load();}
}

export function drawEditedVideo(video:HTMLVideoElement,edit:VideoEdit,canvas=document.createElement('canvas')){
 const factor=edit.crop?1.3:1,sw=video.videoWidth/factor,sh=video.videoHeight/factor,scale=Math.min(1,1920/Math.max(sw,sh)),rotated=edit.rotation%180!==0;
 const width=Math.max(2,Math.round((rotated?sh:sw)*scale/2)*2),height=Math.max(2,Math.round((rotated?sw:sh)*scale/2)*2);if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Video canvas could not open.');ctx.save();ctx.fillStyle='black';ctx.fillRect(0,0,width,height);ctx.translate(width/2,height/2);ctx.rotate(edit.rotation*Math.PI/180);ctx.drawImage(video,(video.videoWidth-sw)/2,(video.videoHeight-sh)/2,sw,sh,-sw*scale/2,-sh*scale/2,sw*scale,sh*scale);ctx.restore();return canvas;
}
