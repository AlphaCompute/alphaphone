import { WebPlugin } from '@capacitor/core';
// Browser media is retained locally; no provider credentials or uploads.
export class BrowserVoice extends WebPlugin {
 private recorder?:MediaRecorder;
 private stream?:MediaStream;
 private started=0;
 private recordingId='';
 private clip?:Promise<Blob>;
 private clips=new Map<string,{blob:Blob;durationMs:number}>();
 private speech=new Map<string,string>();
 private audio?:HTMLAudioElement;
 private audioId?:string;
 private generation=0;
 private timer?:ReturnType<typeof setTimeout>;
 async localSpeechStatus(){return {ready:true,execution:'browser'};}
 async startRecording(input:{maxDurationMs?:number}={}){
  await this.cancelRecording();const generation=this.generation;const stream=await navigator.mediaDevices.getUserMedia({audio:true});if(generation!==this.generation){stream.getTracks().forEach(track=>track.stop());throw new DOMException('Recording cancelled','AbortError');}this.stream=stream;const recorder=this.recorder=new MediaRecorder(stream),id=this.recordingId=crypto.randomUUID();this.started=Date.now();const chunks:Blob[]=[];
  this.clip=new Promise((resolve,reject)=>{recorder.ondataavailable=event=>chunks.push(event.data);recorder.onerror=()=>reject(Error('Recording interrupted.'));recorder.onstop=()=>{clearTimeout(this.timer);stream.getTracks().forEach(track=>track.stop());resolve(new Blob(chunks,{type:recorder.mimeType}));};});
  recorder.start();const maxDurationMs=input.maxDurationMs||59000;this.timer=setTimeout(()=>{void this.stopRecording().then(result=>this.notifyListeners('recordingStopped',result));},maxDurationMs);return {recordingId:id,maxDurationMs};
 }
 async stopRecording(){const id=this.recordingId;if(!this.recorder||!this.clip)throw Error('Start a recording first.');if(this.recorder.state==='recording')this.recorder.stop();const blob=await this.clip,durationMs=Date.now()-this.started;this.clips.set(id,{blob,durationMs});this.recorder=undefined;this.clip=undefined;return {recordingId:id,durationMs};}
 async cancelRecording(){++this.generation;clearTimeout(this.timer);if(this.recorder?.state==='recording')this.recorder.stop();this.stream?.getTracks().forEach(track=>track.stop());this.stream=undefined;this.recorder=undefined;this.clip=undefined;}
 async transcribeLocalRecording(input:{recordingId:string}){
  if(!this.clips.has(input.recordingId))throw Error('Record a clip first.');
  const text=await new Promise<string>((resolve,reject)=>{const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Recording transcript');const label=document.createElement('label');label.textContent='Transcript';const field=document.createElement('textarea');label.append(field);const done=document.createElement('button');done.textContent='Use transcript';done.onclick=()=>{if(field.value.trim()){resolve(field.value.trim());dialog.close();}};const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.onclick=()=>dialog.close();dialog.onclose=()=>{dialog.remove();reject(new DOMException('Cancelled','AbortError'));};dialog.append(label,done,cancel);document.body.append(dialog);dialog.showModal();field.focus();});
  return {text,local:true,execution:'browser'};
 }
 transcribeRecording(input:{recordingId:string}){return this.transcribeLocalRecording(input);}
 async synthesizeLocal(input:{text:string}){const playbackId=crypto.randomUUID();this.speech.set(playbackId,input.text);return {playbackId,execution:'browser'};}
 async play(input:{playbackId?:string;audioId?:string}){
  await this.stopPlayback();if(input.playbackId){const text=this.speech.get(input.playbackId);if(text===undefined)throw Error('Prepare speech first.');const speech=new SpeechSynthesisUtterance(text);speech.onend=()=>void this.notifyListeners('playbackEnded',{playbackId:input.playbackId});speech.onerror=()=>void this.notifyListeners('playbackFailed',{playbackId:input.playbackId});speechSynthesis.speak(speech);return;}
  const row=await audioRecord(input.audioId!);this.audioId=input.audioId;this.audio=new Audio(URL.createObjectURL(row.blob));await this.audio.play();
 }
 async stopPlayback(){window.speechSynthesis?.cancel();if(this.audio){this.audio.pause();URL.revokeObjectURL(this.audio.src);this.audio=undefined;}this.audioId=undefined;}
 stop(){return this.stopPlayback();}
 async state(){return {playing:!!this.audio&&!this.audio.paused,audioId:this.audioId,positionMs:(this.audio?.currentTime||0)*1000};}
 async saveRecording(input:{recordingId:string;noteId:string;transcript:string}){const clip=this.clips.get(input.recordingId);if(!clip)throw Error('Record a clip first.');const audioId=crypto.randomUUID();await audioWrite({audioId,noteId:input.noteId,...clip});return {audioId,noteId:input.noteId,durationMs:clip.durationMs,transcript:input.transcript};}
 async remove(){await this.stopPlayback();} // Retain audio while its owning note is in recoverable trash.
 async restore(){}
 async cancel(){await this.cancelRecording();await this.stopPlayback();document.querySelector<HTMLDialogElement>('dialog[aria-label="Recording transcript"]')?.close();}
 async releaseLocalSpeech(){await this.cancel();this.speech.clear();}
}
let database:Promise<IDBDatabase>|undefined;
function db(){return database??=new Promise((resolve,reject)=>{const r=indexedDB.open('alpha.browser.audio.v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('audio',{keyPath:'audioId'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function audioWrite(value:{audioId:string;noteId:string;blob:Blob;durationMs:number}){const d=await db();return new Promise<void>((resolve,reject)=>{const tx=d.transaction('audio','readwrite');tx.objectStore('audio').put(value);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
async function audioRecord(id:string){const d=await db();return new Promise<{blob:Blob}>((resolve,reject)=>{const r=d.transaction('audio').objectStore('audio').get(id);r.onsuccess=()=>r.result?resolve(r.result):reject(Error('Recording not found.'));r.onerror=()=>reject(r.error);});}
