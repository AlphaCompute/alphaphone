import {browserMediaVolume} from './audio-settings';
import {audioRecord,audioMetadata,retainAudio,changeAudioDeleted,audioDeletionStatus,migrateAudio} from './note-audio-store';
import { BrowserTranscriptReview } from './transcript-review';
import { BrowserAudioCapture } from './audio-capture';
import { WebPlugin } from '@capacitor/core';
// Browser media is retained locally; no provider credentials or uploads.
export class BrowserVoice extends WebPlugin {
 private capture=new BrowserAudioCapture(event=>{void this.notifyListeners('recordingStopped',event);});
 private transcript=new BrowserTranscriptReview();
 private speech=new Map<string,string>();
 private audio?:HTMLAudioElement;
 private audioId?:string;
 private pendingAudioId?:string;
 private audioChanges=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('alpha.browser.audio.changes'):undefined;
 private playbackGeneration=0;
 private playbackAbort?:AbortController;
 private utterance?:SpeechSynthesisUtterance;
 private activeSpeechId?:string;
 constructor(){super();
  window.addEventListener('alpha:device-settings',()=>{if(this.audio)this.audio.volume=browserMediaVolume();});
  if(this.audioChanges)this.audioChanges.onmessage=event=>{if(event.data?.deleted&&[this.audioId,this.pendingAudioId].includes(event.data.audioId))void this.stopPlayback();};
  void migrateAudio().catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void this.cancel();});
  window.addEventListener('pagehide',()=>{void this.cancel();});
  window.addEventListener('alpha:device-state',()=>{void this.cancel();});
 }
 async localSpeechStatus(){return {ready:!!navigator.mediaDevices?.getUserMedia&&typeof MediaRecorder!=='undefined',execution:'browser'};}
 startRecording(input:{maxDurationMs?:number}={}){return this.capture.start(input);}
 stopRecording(){return this.capture.stop();}
 async cancelRecording(){this.capture.cancel();}
 async transcribeLocalRecording(input:{recordingId:string}){
  const clip=this.capture.get(input.recordingId);if(!clip)throw Error('Record a clip first.');
  const text=await this.transcript.open(clip.blob);return {text,local:true,execution:'browser'};
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
 async play(input:{playbackId?:string;audioId?:string;replace?:boolean}){
  if(input.replace===false){
   if(document.hidden||document.documentElement.dataset.devBackground==='true'||Array.from(document.querySelectorAll('[aria-label="Unlock with fingerprint"], [aria-label="Wake"]')).some(element=>element.getClientRects().length))throw new DOMException('Playback cancelled','AbortError');
   if(this.activeSpeechId||this.audio||this.pendingAudioId)throw Object.assign(Error('Playback is busy.'),{code:'playback-busy'});
  }
  void this.stopPlayback();const generation=this.playbackGeneration,abort=new AbortController();this.playbackAbort=abort;
  const current=()=>generation===this.playbackGeneration&&!abort.signal.aborted;
  try{
  if(document.hidden)throw new DOMException('Playback cancelled','AbortError');
  if(!!input.playbackId===!!input.audioId)throw Error('Choose one recording or prepared speech.');
  if(input.playbackId){
   this.activeSpeechId=input.playbackId;
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
   const speech=this.utterance=new SpeechSynthesisUtterance(text);speech.voice=voice;speech.volume=browserMediaVolume();
   const finish=(event:'playbackEnded'|'playbackFailed')=>{if(!current()||this.utterance!==speech)return;this.utterance=undefined;this.activeSpeechId=undefined;speech.onend=null;speech.onerror=null;void this.notifyListeners(event,{playbackId:input.playbackId});};
   speech.onend=()=>finish('playbackEnded');speech.onerror=()=>finish('playbackFailed');
   try{engine.speak(speech);}catch(error){finish('playbackFailed');throw error;}return;
  }
  this.pendingAudioId=input.audioId;
  const row=await playbackWait(audioRecord(input.audioId!),abort.signal);
  if(!current())throw new DOMException('Playback cancelled','AbortError');
  const url=URL.createObjectURL(row.blob);let audio:HTMLAudioElement;
  try{audio=new Audio(url);audio.volume=browserMediaVolume();}catch(error){URL.revokeObjectURL(url);throw error;}
  this.audio=audio;this.audioId=input.audioId;this.pendingAudioId=undefined;
  const finish=(event:'playbackEnded'|'playbackFailed')=>{if(!current()||this.audio!==audio)return;this.releaseAudio(audio);void this.notifyListeners(event,{audioId:input.audioId});void this.notifyListeners(event==='playbackEnded'?'ended':'failed',{audioId:input.audioId});};
  audio.onended=()=>finish('playbackEnded');audio.onerror=()=>finish('playbackFailed');
  try{
   const playing=audio.play();
   void playing.then(()=>{if(!current())audio.pause();},()=>{});
   await playbackWait(playing,abort.signal);
   if(!current())throw new DOMException('Playback cancelled','AbortError');
   const receipt={audioId:input.audioId,playing:!audio.paused,positionMs:audio.currentTime*1000};void this.notifyListeners('started',receipt);return receipt;
  }catch(error){if(this.audio===audio)finish('playbackFailed');throw error;}
  }catch(error){if(current())await this.stopPlayback();throw error;}
 }
 async stopPlayback(input?:{playbackId:string}){
  if(input&&this.activeSpeechId!==input.playbackId)return;
  const stopped=this.activeSpeechId;this.activeSpeechId=undefined;
  ++this.playbackGeneration;this.pendingAudioId=undefined;this.playbackAbort?.abort();this.playbackAbort=undefined;
  if(this.utterance){this.utterance.onend=null;this.utterance.onerror=null;this.utterance=undefined;}
  window.speechSynthesis?.cancel();if(this.audio)this.releaseAudio(this.audio);
  if(stopped)void this.notifyListeners('playbackStopped',{playbackId:stopped});
 }
 stop(){return this.stopPlayback();}
 async state(){return {playing:!!this.audio&&!this.audio.paused&&!this.audio.ended,audioId:this.audioId,positionMs:(this.audio?.currentTime||0)*1000};}
 async saveRecording(input:{recordingId:string;noteId:string;transcript:string}){
  if(!input.recordingId||input.recordingId.length>128||!input.noteId||input.noteId.length>128||typeof input.transcript!=='string')throw Error('Invalid recording destination.');
  const saved=await retainAudio(input.recordingId,input.noteId,input.transcript,this.capture.get(input.recordingId));
  return {audioId:saved.audioId,noteId:saved.noteId,durationMs:saved.durationMs,transcript:input.transcript};
 }
 async describe(input:{audioId:string}){return audioMetadata(await audioRecord(input.audioId,true));}
 migrationStatus(){return migrateAudio();}
 async deletionStatus(input:{audioId:string;noteId:string;operationId:string}){return audioDeletionStatus(input.audioId,input.noteId,input.operationId);}
 async remove(input:{audioId:string;noteId:string;operationId:string}){const result=await changeAudioDeleted(input.audioId,input.noteId,true,input.operationId);if(result.status==='removed'){if([this.audioId,this.pendingAudioId].includes(input.audioId))await this.stopPlayback();this.audioChanges?.postMessage({audioId:input.audioId,deleted:true});}return result;}
 async restore(input:{audioId:string;noteId:string;operationId:string}){return changeAudioDeleted(input.audioId,input.noteId,false,input.operationId);}
 async cancel(){this.transcript.cancel();this.capture.cancel();await this.stopPlayback();}
 async releaseLocalSpeech(){await this.cancel();this.speech.clear();this.capture.clear();}
}
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
