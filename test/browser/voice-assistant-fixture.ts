import {expect,type Page} from '@playwright/test';
import {flagOffAndroid,residentHome,fenceNetwork,button} from './flag-off-android';
// Synthetic native live capture for production UI and explicit source-level API tests. Synthetic ports only: the AlphaVoiceCloud live capture
// (frames and Silero VAD edges), the resident agent's live ASR route and local playback. This is
// routing, lifecycle and accounting evidence, not microphone, echo, JNI, model or device evidence.
export async function setupLiveAssistant(page:Page){
 const foreign=await fenceNetwork(page);await flagOffAndroid(page);
 await page.addInitScript(()=>{
  const w=window as any,c=w.Capacitor,prior=c.nativePromise;
  // Voice replies need correlated message identities; the generic chat fixture omits them.
  const emit=w.flagOff.emit;let reply=0;w.flagOff.emit=(plugin:string,event:string,value:any)=>{
   if(plugin==='Agent'&&event==='alphaAgentStream'&&value.event?.type==='chunk'){
    const data=JSON.parse(atob(value.event.dataBase64).slice(6));
    if(data.type==='done'){reply++;value={...value,event:{...value.event,dataBase64:btoa('data: '+JSON.stringify({...data,messageId:'11111111-1111-4111-8111-11111111111'+reply,userMessageId:'22222222-2222-4222-8222-22222222222'+reply})+'\n\n')}};}
   }
   return emit(plugin,event,value);
  };
  const f=w.live={noCanceller:false,captures:[] as any[],stops:[] as string[],active:null as string|null,routes:[] as any[],finals:[] as string[],spoken:[] as string[],plays:[] as string[],stopped:0,forbidden:[] as string[],onStop:null as null|((id:string)=>void)};
  const events:Array<{event:string;callback:(value:any)=>void}>=[];
  f.emit=(event:string,value:any)=>{for(const row of events)if(row.event===event)row.callback(value);};
  f.frame=(timestamp:number)=>({pcm16:btoa(String.fromCharCode(...new Uint8Array(1024))),sampleRate:16000,channels:1,samples:512,timestamp});
  f.frames=(frames:number[],vad:Array<{type:string;timestampMs:number}>=[])=>f.emit('liveCaptureFrames',{captureId:f.active,frames:frames.map(f.frame),vad,peak:.3});
  f.finishPlayback=()=>f.emit('playbackEnded',{playbackId:f.plays.at(-1)});
  const header=c.PluginHeaders.find((p:any)=>p.name==='AlphaVoiceCloud');
  header.methods=[...['checkPermissions','localSpeechStatus','liveCaptureStatus','startLiveCapture','stopLiveCapture','synthesizeLocal','play','stopPlayback','cancel','releaseLocalSpeech','cancelRecording'].map(name=>({name,rtype:'promise'})),{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'callback'}];
  const callback=c.nativeCallback;c.nativeCallback=(plugin:string,method:string,input:any,fn:any)=>{if(plugin==='AlphaVoiceCloud'&&method==='addListener'){events.push({event:input.eventName,callback:fn});return String(events.length);}return callback(plugin,method,input,fn);};
  c.nativePromise=async(plugin:string,method:string,input:any)=>{
   if(plugin==='Agent'&&method==='request'&&String(input.path).startsWith('/api/asr/local-inference/live')){
    if(input.path==='/api/asr/local-inference/live/status')return {status:200,body:JSON.stringify({ready:true,streaming:true,sessions:0,maxSessions:4})};
    const body=JSON.parse(input.body);f.routes.push(body);
    const end=Array.isArray(body.vad)&&body.vad.some((edge:any)=>edge.type==='speech-end');
    return {status:200,body:JSON.stringify({ok:true,sessionId:body.sessionId,mode:'stream',framesReceived:f.routes.length,...(end?{final:{turnId:'turn-'+f.routes.length,text:f.finals.shift()??'',mode:'stream',asrFinalFromSpeechEndMs:30}}:{}),...(body.close?{closed:true}:{})})};
   }
   if(plugin!=='AlphaVoiceCloud')return prior(plugin,method,input);
   if(method==='checkPermissions')return {microphone:'granted'};
   if(method==='localSpeechStatus')return {ready:true,execution:'device'};
   if(method==='liveCaptureStatus')return {permission:true,available:true};
   if(method==='startLiveCapture'){f.captures.push({captureId:input.captureId,echoCancel:input.echoCancel===true});f.active=input.captureId;return {captureId:input.captureId,sampleRate:16000,echoCancelled:input.echoCancel===true&&!f.noCanceller};}
   if(method==='stopLiveCapture'){const id=input.captureId;f.stops.push(id);f.onStop?.(id);if(f.active===id){f.active=null;}f.emit('liveCaptureEnded',{captureId:id});return {captureId:id,durationMs:1000};}
   if(method==='synthesizeLocal'){f.spoken.push(input.text);return {playbackId:'play-'+f.spoken.length,execution:'device'};}
   if(method==='play'){f.plays.push(input.playbackId);return {};}
   if(method==='stopPlayback'){f.stopped++;return {};}
   if(['cancel','releaseLocalSpeech','removeListener','cancelRecording'].includes(method))return {};
   f.forbidden.push(method);throw Error('Not part of the live voice path: '+method);
  };
 });await residentHome(page);return foreign;
}
