/** Actual BrowserVoice and local playback helper; all media/network ports are closed fakes. */
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

export function browserVoiceOwnedFixture(options={}){
 const f={spoken:[],audio:[],captureCancels:0,recognizerStops:0,engineCancels:0,cloudCalls:0,pairedCalls:[],localVoices:true,...options},listeners=new Map();
 const window=Object.assign(new EventTarget(),{}),document=Object.assign(new EventTarget(),{hidden:false,documentElement:{dataset:{}},querySelectorAll:()=>[]});
 const engine=Object.assign(new EventTarget(),{getVoices:()=>f.localVoices?[{name:'Closed local voice',localService:true,lang:'en-US'}]:[],speak:value=>f.spoken.push(value),cancel:()=>f.engineCancels++});window.speechSynthesis=engine;
 const connection={getSnapshot:()=>({session:{sessionId:'owned-session'}}),getCloudEnvironment:()=> 'production',getCloudClient:()=>({sessionId:'cloud-session',credentialId:'cloud-credential'}),subscribe:()=>()=>{},getBrowserSpeechAgent:()=>f.agent||null};
 const agent={session:{sessionId:'paired-session'},synthesizeSpeech:async(text,signal)=>{f.pairedCalls.push({text,signal});if(f.holdPaired)await new Promise(resolve=>f.releasePaired=resolve);return new Blob(['closed synthetic bytes'],{type:'audio/mpeg'});}};
 class FakeAudio{paused=true;ended=false;currentTime=0;constructor(url){this.src=url;f.audio.push(this);}async play(){this.paused=false;if(f.holdAudioStart)await new Promise(resolve=>f.releaseAudioStart=resolve);}pause(){this.paused=true;this.pauses=(this.pauses||0)+1;}removeAttribute(){this.src='';}load(){}}
 class WebPlugin{async addListener(name,callback){const set=listeners.get(name)||new Set();listeners.set(name,set);set.add(callback);return {remove:async()=>set.delete(callback)};}async notifyListeners(name,event){for(const callback of listeners.get(name)||[])callback(event);}}
 const box={devSurfacesEnabled:true,connectionController:connection,WebPlugin,BrowserAudioCapture:class{cancel(){f.captureCancels++;}clear(){}},BrowserSpeechRecognizer:class{stop(){f.recognizerStops++;}cancel(){}},browserMediaVolume:()=>1,migrateAudio:async()=>{},window,document,navigator:{language:'en-US'},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},Audio:FakeAudio,URL:{createObjectURL:()=> 'blob:closed-fixture',revokeObjectURL(){}},Blob,crypto,AbortController,DOMException,Event,EventTarget,Promise,setTimeout,clearTimeout,console,browserCloudCredential:async()=>{},browserCloudVoice:async()=>{f.cloudCalls++;if(!f.allowCloud)throw Error('Explicit local text reached Cloud');return {blob:async()=>new Blob(['closed cloud bytes'],{type:'audio/mpeg'})};},Capacitor:{isNativePlatform:()=>false},planLocalSpeech:()=>{throw Error('Native planning must not run');}};
 const load=(file,expose)=>{const source=fs.readFileSync(file,'utf8').replace(/^import .*;\n/gm,'').replaceAll('export class','class').replaceAll('export async function','async function').replaceAll('export function','function');vm.runInNewContext('{'+stripTypeScriptTypes(source,{mode:'transform'})+'\n'+expose+'}',box);};
 load('apps/app/src/browser/voice.ts','globalThis.BrowserVoice=BrowserVoice;');const voice=new box.BrowserVoice();box.registerPlugin=()=>voice;load('apps/app/src/local-speech-playback.ts','globalThis.speakLocalText=speakLocalText;');
 return Object.assign(f,{voice,pairedAgent:agent,box,engine,document,window,listeners,voicesReady(){this.localVoices=true;engine.dispatchEvent(new Event('voiceschanged'));},async close(){this.holdPaired=false;this.releasePaired?.();this.holdAudioStart=false;this.releaseAudioStart?.();await voice.releaseLocalSpeech();}});
}
export async function flushBrowserVoice(){for(let i=0;i<30;i++)await Promise.resolve();}
