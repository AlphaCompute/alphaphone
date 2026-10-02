import { BrowserAudioCapture } from './audio-capture';
import { WebPlugin } from '@capacitor/core';
// Browser media is retained locally; no provider credentials or uploads.
export class BrowserVoice extends WebPlugin {
 private capture=new BrowserAudioCapture(event=>{void this.notifyListeners('recordingStopped',event);});
 private speech=new Map<string,string>();
 private audio?:HTMLAudioElement;
 private audioId?:string;
 private playbackGeneration=0;
 private playbackAbort?:AbortController;
 private utterance?:SpeechSynthesisUtterance;
 constructor(){super();
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void this.cancel();});
  window.addEventListener('pagehide',()=>{void this.cancel();});
 }
 async localSpeechStatus(){return {ready:!!navigator.mediaDevices?.getUserMedia&&typeof MediaRecorder!=='undefined',execution:'browser'};}
 startRecording(input:{maxDurationMs?:number}={}){return this.capture.start(input);}
 stopRecording(){return this.capture.stop();}
 async cancelRecording(){this.capture.cancel();}
 async transcribeLocalRecording(input:{recordingId:string}){
  if(!this.capture.get(input.recordingId))throw Error('Record a clip first.');
  const text=await new Promise<string>((resolve,reject)=>{const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Recording transcript');const label=document.createElement('label');label.textContent='Transcript';const field=document.createElement('textarea');label.append(field);const done=document.createElement('button');done.textContent='Use transcript';done.onclick=()=>{if(field.value.trim()){resolve(field.value.trim());dialog.close();}};const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.onclick=()=>dialog.close();dialog.onclose=()=>{dialog.remove();reject(new DOMException('Cancelled','AbortError'));};dialog.append(label,done,cancel);document.body.append(dialog);dialog.showModal();field.focus();});
  return {text,local:true,execution:'browser'};
 }
 transcribeRecording(input:{recordingId:string}){return this.transcribeLocalRecording(input);}
 async synthesizeLocal(input:{text:string}){
  if(typeof input.text!=='string'||!input.text.trim()||input.text.length>16000)throw Error('Choose text between 1 and 16000 characters.');
  const playbackId=crypto.randomUUID();this.speech.set(playbackId,input.text);
  while(this.speech.size>8)this.speech.delete(this.speech.keys().next().value!);
  return {playbackId,execution:'browser'};
 }
 private releaseAudio(audio:HTMLAudioElement){
  audio.onended=null;audio.onerror=null;audio.pause();const url=audio.src;audio.removeAttribute('src');audio.load();URL.revokeObjectURL(url);
  if(this.audio===audio){this.audio=undefined;this.audioId=undefined;}
 }
 async play(input:{playbackId?:string;audioId?:string}){
  void this.stopPlayback();const generation=this.playbackGeneration,abort=new AbortController();this.playbackAbort=abort;
  const current=()=>generation===this.playbackGeneration&&!abort.signal.aborted;
  if(document.hidden)throw new DOMException('Playback cancelled','AbortError');
  if(!!input.playbackId===!!input.audioId)throw Error('Choose one recording or prepared speech.');
  if(input.playbackId){
   const text=this.speech.get(input.playbackId);if(text===undefined)throw Error('Prepare speech first.');
   const engine=window.speechSynthesis;if(!engine)throw Error('Local speech is unavailable. Read the reply as text.');
   const voices=()=>engine.getVoices().filter(voice=>voice.localService===true);
   if(!voices().length)await new Promise<void>((resolve,reject)=>{
    let timer:ReturnType<typeof setTimeout>;
    const finish=(error?:Error)=>{clearTimeout(timer);engine.removeEventListener('voiceschanged',changed);abort.signal.removeEventListener('abort',cancel);error?reject(error):resolve();};
    const changed=()=>{if(voices().length)finish();};const cancel=()=>finish(new DOMException('Playback cancelled','AbortError'));
    timer=setTimeout(()=>finish(),1500);engine.addEventListener('voiceschanged',changed);abort.signal.addEventListener('abort',cancel,{once:true});changed();
   });
   if(!current())throw new DOMException('Playback cancelled','AbortError');
   const local=voices(),language=navigator.language.split('-')[0];
   const voice=local.find(v=>v.lang===navigator.language)||local.find(v=>v.lang.split('-')[0]===language)||local[0];
   if(!voice)throw Error('No local browser voice is available. Read the reply as text.');
   const speech=this.utterance=new SpeechSynthesisUtterance(text);speech.voice=voice;
   const finish=(event:'playbackEnded'|'playbackFailed')=>{if(!current()||this.utterance!==speech)return;this.utterance=undefined;speech.onend=null;speech.onerror=null;void this.notifyListeners(event,{playbackId:input.playbackId});};
   speech.onend=()=>finish('playbackEnded');speech.onerror=()=>finish('playbackFailed');
   try{engine.speak(speech);}catch(error){finish('playbackFailed');throw error;}return;
  }
  const row=await playbackWait(audioRecord(input.audioId!),abort.signal);
  if(!current())throw new DOMException('Playback cancelled','AbortError');
  const url=URL.createObjectURL(row.blob);let audio:HTMLAudioElement;
  try{audio=new Audio(url);}catch(error){URL.revokeObjectURL(url);throw error;}
  this.audio=audio;this.audioId=input.audioId;
  const finish=(event:'playbackEnded'|'playbackFailed')=>{if(!current()||this.audio!==audio)return;this.releaseAudio(audio);void this.notifyListeners(event,{audioId:input.audioId});};
  audio.onended=()=>finish('playbackEnded');audio.onerror=()=>finish('playbackFailed');
  try{
   const playing=audio.play();
   void playing.then(()=>{if(!current())audio.pause();},()=>{});
   await playbackWait(playing,abort.signal);
   if(!current())throw new DOMException('Playback cancelled','AbortError');
  }catch(error){if(this.audio===audio)this.releaseAudio(audio);throw error;}
 }
 async stopPlayback(){
  ++this.playbackGeneration;this.playbackAbort?.abort();this.playbackAbort=undefined;
  if(this.utterance){this.utterance.onend=null;this.utterance.onerror=null;this.utterance=undefined;}
  window.speechSynthesis?.cancel();if(this.audio)this.releaseAudio(this.audio);
 }
 stop(){return this.stopPlayback();}
 async state(){return {playing:!!this.audio&&!this.audio.paused&&!this.audio.ended,audioId:this.audioId,positionMs:(this.audio?.currentTime||0)*1000};}
 async saveRecording(input:{recordingId:string;noteId:string;transcript:string}){const clip=this.capture.get(input.recordingId);if(!clip)throw Error('Record a clip first.');const audioId=crypto.randomUUID();await audioWrite({audioId,noteId:input.noteId,...clip});return {audioId,noteId:input.noteId,durationMs:clip.durationMs,transcript:input.transcript};}
 async remove(){await this.stopPlayback();} // Retain audio while its owning note is in recoverable trash.
 async restore(){}
 async cancel(){await this.cancelRecording();await this.stopPlayback();document.querySelector<HTMLDialogElement>('dialog[aria-label="Recording transcript"]')?.close();}
 async releaseLocalSpeech(){await this.cancel();this.speech.clear();this.capture.clear();}
}
let database:Promise<IDBDatabase>|undefined;
function db(){return database??=new Promise((resolve,reject)=>{const r=indexedDB.open('alpha.browser.audio.v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('audio',{keyPath:'audioId'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function audioWrite(value:{audioId:string;noteId:string;blob:Blob;durationMs:number}){const d=await db();return new Promise<void>((resolve,reject)=>{const tx=d.transaction('audio','readwrite');tx.objectStore('audio').put(value);tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error||Error('Audio could not be saved.'));});}
async function audioRecord(id:string){const d=await db();return new Promise<{blob:Blob}>((resolve,reject)=>{const r=d.transaction('audio').objectStore('audio').get(id);r.onsuccess=()=>r.result?resolve(r.result):reject(Error('Recording not found.'));r.onerror=()=>reject(r.error);});}

function playbackWait<T>(work:Promise<T>,signal:AbortSignal):Promise<T>{
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(error:unknown,value?:T)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',cancel);error?reject(error):resolve(value!);};
  const cancel=()=>finish(new DOMException('Playback cancelled','AbortError'));
  const timer=setTimeout(()=>finish(Error('Audio did not start. Try again.')),5000);
  signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
  work.then(value=>finish(null,value),error=>finish(error));
 });
}
