/** Loads the actual Alpha voice views with in-memory ports only.
 * No microphone, MediaRecorder, native plugin, provider, playback or account API is used. */
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

function load(file,box,names){
 const source=fs.readFileSync('apps/app/src/'+file,'utf8').replace(/^import .*;\n/gm,'').replaceAll('export async function','async function').replaceAll('export function','function').replaceAll('export type','type');
 vm.runInNewContext('{'+stripTypeScriptTypes(source,{mode:'transform'})+'\n'+names.map(name=>'globalThis.'+name+'='+name+';').join('\n')+'}',box);
}
export function cloudVoiceViewFixture(options={}){
 const f={account:'cloud-account',credential:'cloud-credential',agent:'agent-session',kind:'resident',platform:'android',native:true,open:false,starts:0,stops:0,uploads:0,cloudSpeech:0,localFactories:0,localSpeech:0,pairedFactories:0,accountOpens:0,sends:0,audioSaves:0,recordingCancels:[],activeRecording:null,lastRecording:null,error:null,...options};
 const subscriptions=new Set(),events=new Map();
 const driver={startRecording:async()=>{const id='synthetic-clip-'+(++f.starts);const result=f.holdStart?await new Promise(resolve=>f.releaseStart=resolve):{recordingId:id,maxDurationMs:59000};f.activeRecording=result.recordingId;f.lastRecording=result.recordingId;return result;},stopRecording:async()=>{f.stops++;f.activeRecording=null;return {recordingId:f.lastRecording,durationMs:1000};},transcribeRecording:async input=>{f.uploads++;f.transcribeInput=input;if(f.error)throw f.error;if(f.holdTranscript)return new Promise(resolve=>f.releaseTranscript=resolve);return {text:'Synthetic Cloud transcript',local:false};},cancelRecording:async()=>{f.recordingCancels.push(f.activeRecording);f.activeRecording=null;},cancel:async()=>{},stop:async()=>{},stopPlayback:async()=>{},synthesize:async input=>{f.cloudSpeech++;if(f.error)throw f.error;return {playbackId:'synthetic-'+input.requestId};},play:async input=>{queueMicrotask(()=>{for(const callback of events.get('playbackEnded')||[])callback(input);});},addListener:async(name,callback)=>{const callbacks=events.get(name)||new Set();events.set(name,callbacks);callbacks.add(callback);return {remove:async()=>{callbacks.delete(callback);}};},saveRecording:async input=>{f.audioSaves++;return {audioId:input.recordingId,noteId:input.noteId,durationMs:1000,transcript:input.transcript};}};
 const controller={getCloudEnvironment:()=>f.account?'production':null,getCloudClient:()=>f.account?{sessionId:f.account,credentialId:f.credential}:null,getSnapshot:()=>({kind:f.kind,open:f.open,session:{sessionId:f.agent,ownerId:'synthetic-owner',agentId:'synthetic-agent'}}),getPairedVoiceBinding:()=>null,getBrowserSpeechAgent:()=>null,openCloudAccount:()=>{f.accountOpens++;},subscribe:callback=>{subscriptions.add(callback);return()=>subscriptions.delete(callback);}};
 const local={ready:async()=>true,speak:async()=>{f.localSpeech++;}};
 const box={testMocksEnabled:false,browserDevProfile:false,Capacitor:{getPlatform:()=>f.platform,isNativePlatform:()=>f.native,isPluginAvailable:()=>true},connectionController:controller,registerPlugin:()=>driver,createOnDeviceVoice:()=>{f.localFactories++;return local;},createPairedVoice:()=>{f.pairedFactories++;return null;},planLocalSpeech:()=>[],recordingLevels:()=>[],localStorage:{getItem:()=>JSON.stringify({kind:f.kind})},document:{hidden:false,documentElement:{dataset:{}},querySelector:()=>f.noteEditor||null,addEventListener(){},removeEventListener(){}},window:{addEventListener(){},removeEventListener(){},dispatchEvent(){},getSelection:()=>({isCollapsed:true})},queueMicrotask,setInterval,clearInterval,setTimeout,clearTimeout,Date,crypto,AbortController,DOMException,Event,console};
 load('runtime/voice-selection.ts',box,['selectVoiceRoute']);
 load('local-speech-playback.ts',box,['playOwnedSpeech']);
 load('runtime/cloud-voice.ts',box,['cloudVoiceFailure','createCloudVoice']);
 load('prototype/local-speech-playback.ts',box,['installLocalSpeechPlayback','stopLocalSpeechPlayback']);
 load('runtime/voice-states.ts',box,['voiceFailure','transcriptProvenance','speechProgressMessage']);
 load('prototype/voice-adapter.ts',box,['installPrototypeVoiceAdapter']);
 const icons={check:'check',mic:'official-mic-path',stop:'stop',play:'play',x:'close',cloud:'cloud',user:'account'};
 class Shell{
  live=true;state={view:null,chat:'sheet',draft:'',msgs:[{id:'message',from:'agent',text:'Synthetic reply'}]};notes={list:[]};messages=[];
  S(){return this.state;}setState(patch){Object.assign(this.state,patch);}renderVals(){return {msgs:[{text:'Synthetic reply'}],ic:icons};}openView(view){this.state.view=view;}goHome(){this.state.view=null;}back(){this.state.view=null;}toast(message){this.messages.push(message);}vset(_key,patch){if(this.failPersistence)return false;Object.assign(this.notes,patch);return true;}api(){return {get:()=>this.notes,setView:(_key,patch)=>Object.assign(this.notes,patch)};}startVoice(){throw Error('Legacy voice must not run');}send(){f.sends++;}componentWillUnmount(){}
 }
 const views={notes:{render:()=>({ed:{}}),back:()=>false,onLeave(){}}};box.installPrototypeVoiceAdapter(Shell,views);
 const shell=new Shell(),api={...shell.api('notes'),get:()=>shell.notes,set:patch=>Object.assign(shell.notes,patch),ic:icons};
 const render=()=>views.notes.render(shell.notes,api);
 render();
 return Object.assign(f,{box,shell,render,renderChat:()=>shell.renderVals().chatRecorder,changed:()=>{for(const callback of subscriptions)callback();},close:()=>{views.notes.onLeave();shell.componentWillUnmount();},tick:()=>new Promise(resolve=>setTimeout(resolve,0))});
}
