import {devSurfacesEnabled} from '../build-flags';
import {browserCloudVoice,browserCloudCredential} from './cloud-connection';
import type {LocalAgentProtocol} from '../runtime/local-agent';
import {browserSpeechConnection as connectionController} from './agent-speech';
import {recordingPcmSamples,recordingPcmWav} from './recording-pcm';
import {browserMediaVolume} from './audio-settings';
import {audioRecord,audioMetadata,retainAudio,changeAudioDeleted,audioDeletionStatus,migrateAudio,purgeAudio} from './note-audio-store';
import { BrowserSpeechRecognizer } from './speech-recognizer';
import { speechError } from './speech-protocol';
import { silentRecording } from './whisper-engine';
import { BrowserAudioCapture } from './audio-capture';
import { WebPlugin } from '@capacitor/core';
// Recordings stay local until transcription is requested. The selected Cloud or
// explicit local/development route owns processing; provider credentials stay off-page.
export class BrowserVoice extends WebPlugin {
 private connection=Promise.resolve(connectionController).then(connectionController=>{
  const selected=()=>JSON.stringify([connectionController.getSnapshot().session?.sessionId,connectionController.getCloudEnvironment(),connectionController.getCloudClient()?.sessionId,connectionController.getCloudClient()?.credentialId]);
  let binding=selected();
  connectionController.subscribe(()=>{const next=selected();if(next!==binding){binding=next;void this.releaseLocalSpeech();}});
  return connectionController;
 });
 private speechRequest?:AbortController;
 private speechRequestId?:string;
 private capture=new BrowserAudioCapture(event=>{void this.notifyListeners('recordingStopped',event);});
 private recognizer=new BrowserSpeechRecognizer();
 private speech=new Map<string,string>();
 private agentAudio=new Map<string,{blob:Blob;requestId?:string;agent?:LocalAgentProtocol;sessionId:string;cloud?:{environment:string;credentialId:string}}>();
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
 async localSpeechStatus(){return this.withAgentSpeech(async signal=>{
  // The entrypoint binds this facade after browser factories have registered.
  const connectionController=await this.connection;signal.throwIfAborted();
  const agent=connectionController.getBrowserSpeechAgent();if(agent){const result=await agent.speechRequest(undefined,signal);return {ready:result.ready===true,execution:'browser',route:'local-agent'};}
  // Readiness never downloads the model; it is fetched from this app on the first transcription.
  return {ready:!!navigator.mediaDevices?.getUserMedia&&typeof MediaRecorder!=='undefined'&&typeof Worker!=='undefined'&&typeof WebAssembly!=='undefined',execution:'browser',route:'browser',engine:'whisper',model:'whisper-tiny.en',language:'en'};
 });}
 getRecordingMetrics(input:{recordingId:string}){return Promise.resolve(this.capture.metrics(input.recordingId));}
 startRecording(input:{maxDurationMs?:number}={}){return this.capture.start(input);}
 stopRecording(){return this.capture.stop();}
 async cancelRecording(){this.capture.cancel();}
 async transcribeLocalRecording(input:{recordingId:string;requestId?:string}){
  const clip=this.capture.get(input.recordingId);if(!clip)throw Error('Record a clip first.');
  return this.withAgentSpeech(async signal=>{
   const connectionController=await this.connection;signal.throwIfAborted();
   const agent=connectionController.getBrowserSpeechAgent();
   if(agent){const selectedSession=agent.session;const audio=await recordingPcmWav(clip.blob,signal);if(connectionController.getBrowserSpeechAgent()!==agent||agent.session!==selectedSession)throw new DOMException('Voice selection changed','AbortError');const result=await agent.speechRequest(audio,signal);return {text:result.text,local:true,execution:'browser',route:'local-agent',language:'en'};}
   if(document.hidden)throw new DOMException('Transcription cancelled','AbortError');
   const samples=await recordingPcmSamples(clip.blob,signal);
   // Silence is reported before any model download.
   if(silentRecording(samples))throw speechError('no-speech','No speech detected.');
   const requestId=input.requestId;
   const result=await this.recognizer.transcribe(samples,signal,progress=>{void this.notifyListeners('speechProgress',{requestId,...progress});});
   signal.throwIfAborted();
   if(result.noSpeech||!result.text.trim())throw speechError('no-speech','No speech detected.');
   return {text:result.text,local:true,execution:'browser',route:'browser',engine:result.engine,model:result.model,modelRevision:result.modelRevision,runtime:result.runtime,language:result.language};
  });
 }

 private async cloudBinding(input:{environment:string;credentialId:string}) {
  if(!devSurfacesEnabled)throw Error('Cloud voice requires the native app or a development host.');
  const connection=await this.connection,binding=connection.getCloudClient();
  if(!binding||connection.getCloudEnvironment()!==input.environment||binding.credentialId!==input.credentialId)throw Object.assign(Error('Sign in to Eliza Cloud before using voice.'),{code:'voice-http-401'});
  const current=()=>{const next=connection.getCloudClient();if(document.hidden||connection.getCloudEnvironment()!==input.environment||next?.sessionId!==binding.sessionId||next.credentialId!==binding.credentialId)throw new DOMException('Cloud account changed','AbortError');};
  current();return {sessionId:binding.sessionId,current};
 }
 async transcribeRecording(input:{recordingId:string;requestId:string;environment:string;credentialId:string}){
  if(!devSurfacesEnabled)throw Error('Cloud voice requires the native app or a development host.');
  return this.withAgentSpeech(async signal=>{
   const binding=await this.cloudBinding(input),clip=this.capture.get(input.recordingId);if(!clip)throw Error('Record a clip first.');
   const response=await browserCloudVoice(input,'stt',clip.blob,signal),result=await response.json();signal.throwIfAborted();binding.current();
   if(result.local!==false||typeof result.text!=='string'||!result.text.trim())throw Error('Eliza Cloud returned no usable transcript.');
   return {text:result.text,local:false};
  },input.requestId);
 }
 async synthesize(input:{text:string;requestId:string;environment:string;credentialId:string}){
  if(!devSurfacesEnabled)throw Error('Cloud voice requires the native app or a development host.');
  return this.withAgentSpeech(async signal=>{
   const binding=await this.cloudBinding(input),response=await browserCloudVoice(input,'tts',input.text,signal),blob=await response.blob();signal.throwIfAborted();binding.current();
   if(!blob.size||blob.size>8*1024*1024||!['audio/mpeg','audio/mp3','audio/wav'].includes(blob.type.split(';')[0]))throw Error('Eliza Cloud returned no usable speech.');
   const playbackId=crypto.randomUUID();this.agentAudio.set(playbackId,{blob,requestId:input.requestId,sessionId:binding.sessionId,cloud:{environment:input.environment,credentialId:input.credentialId}});
   while(this.agentAudio.size>8)this.agentAudio.delete(this.agentAudio.keys().next().value!);
   return {playbackId};
  },input.requestId);
 }
 async synthesizeLocal(input:{text:string}){
  if(typeof input.text!=='string'||!input.text.trim()||input.text.length>16000)throw Error('Choose text between 1 and 16000 characters.');
  return this.withAgentSpeech(async signal=>{
  const connectionController=await this.connection;signal.throwIfAborted();
  const agent=connectionController.getBrowserSpeechAgent();
  if(agent){
   const sessionId=agent.session?.sessionId;if(!sessionId)throw Error('Connect the local agent first.');
   const blob=await agent.synthesizeSpeech(input.text,signal);signal.throwIfAborted();
   if(connectionController.getBrowserSpeechAgent()!==agent||agent.session?.sessionId!==sessionId)throw new DOMException('Voice selection changed','AbortError');
   const playbackId=crypto.randomUUID();this.agentAudio.set(playbackId,{blob,agent,sessionId});
   while(this.agentAudio.size>8)this.agentAudio.delete(this.agentAudio.keys().next().value!);
   return {playbackId,execution:'browser'};
  }
  const playbackId=crypto.randomUUID();this.speech.set(playbackId,input.text);
  while(this.speech.size>8)this.speech.delete(this.speech.keys().next().value!);
  return {playbackId,execution:'browser'};
  });
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
   const prepared=this.agentAudio.get(input.playbackId);
   if(prepared){
    const connectionController=await this.connection;
    if(!current())throw new DOMException('Playback cancelled','AbortError');
    if(prepared.cloud){if(!devSurfacesEnabled)throw Error('Cloud voice requires a development host.');await browserCloudCredential(prepared.cloud.environment,prepared.cloud.credentialId,abort.signal);if(!current())throw new DOMException('Playback cancelled','AbortError');}
    const cloud=connectionController.getCloudClient();
    const stale=prepared.cloud ? connectionController.getCloudEnvironment()!==prepared.cloud.environment||cloud?.credentialId!==prepared.cloud.credentialId||cloud?.sessionId!==prepared.sessionId : !prepared.agent||connectionController.getBrowserSpeechAgent()!==prepared.agent||prepared.agent.session?.sessionId!==prepared.sessionId;
    if(stale){this.agentAudio.delete(input.playbackId);throw new DOMException('Voice selection changed','AbortError');}
    const url=URL.createObjectURL(prepared.blob);let audio:HTMLAudioElement;
    try{audio=new Audio(url);audio.volume=browserMediaVolume();}catch(error){URL.revokeObjectURL(url);throw error;}
    this.audio=audio;
    const finish=(event:'playbackEnded'|'playbackFailed')=>{if(!current()||this.audio!==audio)return;this.releaseAudio(audio);this.activeSpeechId=undefined;this.agentAudio.delete(input.playbackId!);void this.notifyListeners(event,{playbackId:input.playbackId});};
    audio.onended=()=>finish('playbackEnded');audio.onerror=()=>finish('playbackFailed');
    try{const playing=audio.play();void playing.then(()=>{if(!current())audio.pause();},()=>{});await playbackWait(playing,abort.signal);if(!current())throw new DOMException('Playback cancelled','AbortError');return;}
    catch(error){if(this.audio===audio)finish('playbackFailed');throw error;}
   }
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
  }catch(error){if(current()){const playbackId=this.activeSpeechId;this.activeSpeechId=undefined;if(playbackId)void this.notifyListeners('playbackFailed',{playbackId,message:error instanceof Error?error.message:'Speech playback failed.'});await this.stopPlayback();}throw error;}
 }
 async stopPlayback(input?:{playbackId?:string;requestId?:string}){
  if(input?.requestId&&(!this.activeSpeechId||this.agentAudio.get(this.activeSpeechId)?.requestId!==input.requestId))return;
  if(input?.playbackId&&this.activeSpeechId!==input.playbackId)return;
  const stopped=this.activeSpeechId;this.activeSpeechId=undefined;
  ++this.playbackGeneration;this.pendingAudioId=undefined;this.playbackAbort?.abort();this.playbackAbort=undefined;
  if(this.utterance){this.utterance.onend=null;this.utterance.onerror=null;this.utterance=undefined;window.speechSynthesis?.cancel();}
  if(this.audio)this.releaseAudio(this.audio);
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
 async purge(input:{audioId:string;noteId:string;operationId:string}){if([this.audioId,this.pendingAudioId].includes(input.audioId))await this.stopPlayback();return purgeAudio(input.audioId,input.noteId,input.operationId);}
 private async withAgentSpeech<T>(run:(signal:AbortSignal)=>Promise<T>,requestId?:string){
  this.speechRequest?.abort();const controller=this.speechRequest=new AbortController();this.speechRequestId=requestId;
  try{return await run(controller.signal);}finally{if(this.speechRequest===controller)this.speechRequest=undefined;}
 }
 async cancel(input?:{requestId?:string}){
  if(input?.requestId){
   if(input.requestId===this.speechRequestId){this.speechRequest?.abort();this.speechRequest=undefined;this.speechRequestId=undefined;}
   await this.stopPlayback({requestId:input.requestId});
   for(const [id,audio] of this.agentAudio)if(audio.requestId===input.requestId)this.agentAudio.delete(id);
   return;
  }
  this.speechRequest?.abort();this.speechRequest=undefined;this.speechRequestId=undefined;this.recognizer.stop();this.capture.cancel();await this.stopPlayback();
 }
 async releaseLocalSpeech(){await this.cancel();this.recognizer.cancel();this.speech.clear();this.agentAudio.clear();this.capture.clear();}
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
