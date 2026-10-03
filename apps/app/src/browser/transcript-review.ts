import './transcript-review.css';
import {browserScreenLocked} from './screen-locked';
type Recognition={processLocally:boolean;lang:string;continuous:boolean;interimResults:boolean;onstart:(()=>void)|null;onresult:((event:any)=>void)|null;onerror:(()=>void)|null;onend:(()=>void)|null;start:(track:MediaStreamTrack)=>void;abort:()=>void};
type Provider={new():Recognition;available?:(input:{langs:string[];processLocally:true})=>Promise<string>;install?:(input:{langs:string[];processLocally:true})=>Promise<boolean>};
const abort=()=>new DOMException('Transcript review cancelled','AbortError');
/** Local recognition consumes only the retained recording; it never requests another microphone. */
export class BrowserTranscriptReview {
 private close?:()=>void;
 cancel(){this.close?.();}
 open(blob:Blob):Promise<string>{
  this.cancel();if(document.hidden||document.documentElement.dataset.devBackground==='true'||browserScreenLocked())return Promise.reject(abort());return new Promise((resolve,reject)=>{
   let settled=false,generation=0,recognition:Recognition|undefined,context:AudioContext|undefined,source:AudioBufferSourceNode|undefined,track:MediaStreamTrack|undefined,timer:ReturnType<typeof setTimeout>|undefined;
   const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Recording transcript');dialog.className='alpha-transcript-review';
   const shell=document.querySelector('.os');if(shell){const theme=getComputedStyle(shell);for(const token of ['bg','fg','s2','line'])dialog.style.setProperty('--transcript-'+token,theme.getPropertyValue('--'+token));dialog.style.colorScheme=theme.getPropertyValue('--bg').trim().toUpperCase()==='#000000'?'dark':'light';}
   const title=document.createElement('h2');title.textContent='Review transcript';
   const label=document.createElement('label');label.textContent='Transcript';const field=document.createElement('textarea');field.rows=6;field.maxLength=16000;label.append(field);
   const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Add or edit the transcript.';
   const automatic=document.createElement('button');automatic.hidden=true;
   const stop=document.createElement('button');stop.textContent='Stop transcription';stop.hidden=true;
   const use=document.createElement('button');use.textContent='Use transcript';const cancel=document.createElement('button');cancel.textContent='Cancel';

   const cleanup=()=>{++generation;clearTimeout(timer);if(recognition){recognition.onstart=recognition.onresult=recognition.onerror=recognition.onend=null;try{recognition.abort();}catch{}recognition=undefined;}try{source?.stop();}catch{}source?.disconnect();source=undefined;track?.stop();track=undefined;if(context){void context.close().catch(()=>{});context=undefined;}stop.hidden=true;automatic.disabled=false;};
   const previous=document.activeElement as HTMLElement|null;
   const finish=(text?:string)=>{if(settled)return;settled=true;cleanup();window.removeEventListener('alpha-back',back,true);window.removeEventListener('pagehide',close);window.removeEventListener('alpha:device-state',close);document.removeEventListener('visibilitychange',hidden);dialog.close();dialog.remove();if(this.close===close)this.close=undefined;previous?.focus();text===undefined?reject(abort()):resolve(text);};
   const close=()=>finish();this.close=close;
   const back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();close();};const hidden=()=>{if(document.hidden)close();};
   dialog.onclose=close;cancel.onclick=close;use.onclick=()=>{if(field.value.trim())finish(field.value.trim());else field.focus();};stop.onclick=()=>{cleanup();status.textContent='Review and edit the transcript.';};field.addEventListener('input',()=>{if(automatic.disabled){cleanup();status.textContent='Review and edit the transcript.';}});
   const content=document.createElement('section'),actions=document.createElement('footer');content.append(title,label,status,automatic,stop);actions.append(use,cancel);dialog.append(content,actions);document.body.append(dialog);dialog.showModal();field.focus();window.addEventListener('alpha-back',back,true);window.addEventListener('pagehide',close);window.addEventListener('alpha:device-state',close);document.addEventListener('visibilitychange',hidden);
   const Provider=((window as any).SpeechRecognition||(window as any).webkitSpeechRecognition) as Provider|undefined,language=navigator.language||'en-US',options={langs:[language],processLocally:true as const};
   let availability='unchecked';
   // Some embedded/headless Chromium builds expose SODA APIs without the speech service.
   // Avoid that known crash path; other providers are queried only after an explicit click.
   if(!/HeadlessChrome|Electron/i.test(navigator.userAgent)&&Provider?.available){try{if('processLocally' in new Provider()){automatic.textContent='Transcribe recording';automatic.hidden=false;}}catch{}}
   automatic.onclick=async()=>{
    cleanup();const token=generation,current=()=>!settled&&token===generation;automatic.disabled=true;status.textContent='Preparing local transcription…';
    try{
     if(availability==='unchecked'){availability=await Provider!.available!(options);if(!current())return;if(availability!=='available'){cleanup();if(['downloadable','downloading'].includes(availability)&&Provider!.install){automatic.textContent='Set up local transcription';status.textContent='Set up local speech for this language, or edit the transcript.';}else{automatic.hidden=true;status.textContent='Add or edit the transcript.';}return;}}
     if(availability!=='available'){if(!await Provider!.install!(options))throw Error('Language pack not ready');if(!current())return;availability=await Provider!.available!(options);if(availability!=='available')throw Error('Language pack not ready');}
     if(!current())return;const ownContext=new AudioContext();context=ownContext;await ownContext.resume();const bytes=await blob.arrayBuffer();if(!current())return;const audio=await ownContext.decodeAudioData(bytes);if(!current())return;
     const sink=ownContext.createMediaStreamDestination(),ownSource=ownContext.createBufferSource();ownSource.buffer=audio;ownSource.connect(sink);source=ownSource;track=sink.stream.getAudioTracks()[0];if(!track)throw Error('Recording has no audio track');
     const engine=new Provider!();recognition=engine;engine.processLocally=true;if(engine.processLocally!==true)throw Error('Local recognition required');engine.lang=language;engine.continuous=true;engine.interimResults=false;
     const segments=new Map<number,string>();
     engine.onstart=()=>{if(current()){ownSource.start();status.textContent='Transcribing on this device…';}};
     engine.onresult=event=>{if(!current())return;for(let i=event.resultIndex||0;i<event.results.length;i++)if(event.results[i].isFinal)segments.set(i,String(event.results[i][0].transcript));field.value=[...segments.entries()].sort((a,b)=>a[0]-b[0]).map(([,text])=>text).join(' ').slice(0,16000);};
     engine.onend=()=>{if(current()){cleanup();status.textContent='Review and edit the transcript.';}};engine.onerror=()=>{if(current()){cleanup();status.textContent='Add or edit the transcript.';}};
     timer=setTimeout(()=>{if(current()){cleanup();status.textContent='Review and edit the transcript.';}},Math.min(90000,audio.duration*1000+10000));stop.hidden=false;automatic.textContent='Transcribe recording';engine.start(track);
    }catch{if(current()){cleanup();status.textContent='Add or edit the transcript.';}}
   };
  });
 }
}
