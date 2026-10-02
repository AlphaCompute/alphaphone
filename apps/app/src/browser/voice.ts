import { BrowserAudioCapture } from './audio-capture';
import { WebPlugin } from '@capacitor/core';
// Browser media is retained locally; no provider credentials or uploads.
export class BrowserVoice extends WebPlugin {
 private capture=new BrowserAudioCapture(event=>{void this.notifyListeners('recordingStopped',event);});
 private speech=new Map<string,string>();
 private audio?:HTMLAudioElement;
 private audioId?:string;
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
 async synthesizeLocal(input:{text:string}){const playbackId=crypto.randomUUID();this.speech.set(playbackId,input.text);return {playbackId,execution:'browser'};}
 async play(input:{playbackId?:string;audioId?:string}){
  await this.stopPlayback();if(input.playbackId){const text=this.speech.get(input.playbackId);if(text===undefined)throw Error('Prepare speech first.');const speech=new SpeechSynthesisUtterance(text);speech.onend=()=>void this.notifyListeners('playbackEnded',{playbackId:input.playbackId});speech.onerror=()=>void this.notifyListeners('playbackFailed',{playbackId:input.playbackId});speechSynthesis.speak(speech);return;}
  const row=await audioRecord(input.audioId!);this.audioId=input.audioId;this.audio=new Audio(URL.createObjectURL(row.blob));await this.audio.play();
 }
 async stopPlayback(){window.speechSynthesis?.cancel();if(this.audio){this.audio.pause();URL.revokeObjectURL(this.audio.src);this.audio=undefined;}this.audioId=undefined;}
 stop(){return this.stopPlayback();}
 async state(){return {playing:!!this.audio&&!this.audio.paused,audioId:this.audioId,positionMs:(this.audio?.currentTime||0)*1000};}
 async saveRecording(input:{recordingId:string;noteId:string;transcript:string}){const clip=this.capture.get(input.recordingId);if(!clip)throw Error('Record a clip first.');const audioId=crypto.randomUUID();await audioWrite({audioId,noteId:input.noteId,...clip});return {audioId,noteId:input.noteId,durationMs:clip.durationMs,transcript:input.transcript};}
 async remove(){await this.stopPlayback();} // Retain audio while its owning note is in recoverable trash.
 async restore(){}
 async cancel(){await this.cancelRecording();await this.stopPlayback();document.querySelector<HTMLDialogElement>('dialog[aria-label="Recording transcript"]')?.close();}
 async releaseLocalSpeech(){await this.cancel();this.speech.clear();this.capture.clear();}
}
let database:Promise<IDBDatabase>|undefined;
function db(){return database??=new Promise((resolve,reject)=>{const r=indexedDB.open('alpha.browser.audio.v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('audio',{keyPath:'audioId'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function audioWrite(value:{audioId:string;noteId:string;blob:Blob;durationMs:number}){const d=await db();return new Promise<void>((resolve,reject)=>{const tx=d.transaction('audio','readwrite');tx.objectStore('audio').put(value);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
async function audioRecord(id:string){const d=await db();return new Promise<{blob:Blob}>((resolve,reject)=>{const r=d.transaction('audio').objectStore('audio').get(id);r.onsuccess=()=>r.result?resolve(r.result):reject(Error('Recording not found.'));r.onerror=()=>reject(r.error);});}
