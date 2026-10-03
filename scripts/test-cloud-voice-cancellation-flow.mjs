import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const root=new URL('../',import.meta.url);
let account='owner-A', activePlayback, request, plays=0;
const subscribers=new Set(), events=[], stops=[];
const never=()=>new Promise(()=>{}), tick=()=>new Promise(r=>setTimeout(r,0));
const port={startRecording:async()=>({recordingId:'clip',maxDurationMs:59000}),stopRecording:async()=>({recordingId:'clip',durationMs:1000}),cancelRecording:async()=>{},transcribeRecording:async()=>({text:'Reviewed fixture',local:false}),cancel:async()=>{},stopPlayback:async input=>{stops.push(input);if(input?.requestId)return never();},synthesize:async input=>{request=input.requestId;activePlayback='audio-'+request;return {playbackId:activePlayback};},play:async()=>{plays++;},addListener:async(event,callback)=>{const row={event,callback};events.push(row);return{remove:async()=>{if(event.startsWith('playback'))return never();}};}};
const controller={getCloudEnvironment:()=>account?'production':null,getCloudClient:()=>account?{sessionId:account,credentialId:'opaque-'+account}:null,getSnapshot:()=>({kind:'cloud',session:{sessionId:account}}),getPairedVoiceBinding:()=>null,subscribe:f=>{subscribers.add(f);return()=>subscribers.delete(f);}};
const box={browserDevProfile:false,connectionController:controller,registerPlugin:()=>port,crypto,console,setTimeout,clearTimeout,setInterval,clearInterval,AbortController,DOMException,Date,createOnDeviceVoice:()=>null,createPairedVoice:()=>null,Capacitor:{isNativePlatform:()=>true,isPluginAvailable:()=>true},localStorage:{getItem:()=>JSON.stringify({kind:'cloud'})},document:{documentElement:{dataset:{}},querySelector:()=>null,addEventListener(){},removeEventListener(){}},window:{addEventListener(){},removeEventListener(){}}};
const evaluate=(source,expose)=>vm.runInNewContext('{'+stripTypeScriptTypes(source.replace(/^import .*;\n/gm,'').replaceAll('export async function','async function').replaceAll('export function','function').replaceAll('export type','type'),{mode:'transform'})+'\n'+expose+'}',box);
evaluate(await fs.readFile(new URL('apps/app/src/local-speech-playback.ts',root),'utf8'),'globalThis.playOwnedSpeech=playOwnedSpeech;');
evaluate(await fs.readFile(new URL('apps/app/src/runtime/cloud-voice.ts',root),'utf8'),'globalThis.createCloudVoice=createCloudVoice;');
evaluate(await fs.readFile(new URL('apps/app/src/prototype/local-speech-playback.ts',root),'utf8'),'globalThis.installLocalSpeechPlayback=installLocalSpeechPlayback;globalThis.stopLocalSpeechPlayback=stopLocalSpeechPlayback;');
evaluate(await fs.readFile(new URL('apps/app/src/prototype/voice-adapter.ts',root),'utf8'),'globalThis.install=installPrototypeVoiceAdapter;');
class Shell{constructor(){this.state={view:'notes'};this.notes={list:[]};}S(){return this.state;}setState(p){Object.assign(this.state,p);}openView(v){this.state.view=v;}goHome(){this.state.view=null;}toast(){}vset(_,p){Object.assign(this.notes,p);return true;}startVoice(){}componentWillUnmount(){}}
const views={notes:{render:()=>({ed:{}}),back:()=>false,onLeave:()=>{}}};box.install(Shell,views);const shell=new Shell();const api={get:()=>shell.notes,setView:(_,p)=>Object.assign(shell.notes,p),set:p=>Object.assign(shell.notes,p),ic:{}};const render=()=>views.notes.render(shell.notes,api);
render().record();render().rec.changeRoute();await tick();render().rec.stop();await tick();render().rec.stop();await tick();render().rec.stop();await tick();assert.equal(render().rec.review,true);
render().rec.toggle();await tick();assert.equal(plays,1);assert.equal(render().rec.pauseLabel,'Stop audio');render().rec.toggle();await new Promise(r=>setTimeout(r,650));

assert.equal(render().rec.pauseLabel,'Listen to transcript');assert.equal(stops.filter(s=>s?.requestId===request).length,1,'idempotent request-scoped cleanup');
// An old session's delayed native callback cannot finish new playback.
const old=events.filter(e=>e.event.startsWith('playback'));account='owner-B';for(const f of [...subscribers])f();await tick();
const next=box.createCloudVoice(), abort=new AbortController();let settled=false;const speech=next.speak('New owner',abort.signal).then(()=>{settled=true;},()=>{settled=true;});await tick();for(const e of old)e.callback({playbackId:activePlayback});await tick();assert.equal(settled,false);abort.abort();await speech;assert.equal(settled,true);
// Cancellation while listener registration is unresolved must settle too.
const originalAdd=port.addListener;let lateListener,removed=0;
port.addListener=()=>new Promise(resolve=>{lateListener=resolve;});
const waiting=box.createCloudVoice(), stop=new AbortController();let cancelled=false;
const waitSpeech=waiting.speak('Pending listener',stop.signal).catch(()=>{cancelled=true;});await tick();stop.abort();await waitSpeech;assert.equal(cancelled,true);
const playsBefore=plays;lateListener({remove:async()=>{removed++;}});await tick();assert.equal(removed,1);assert.equal(plays,playsBefore);port.addListener=originalAdd;
const originalSynthesize=port.synthesize;let finishSynthesis;
port.synthesize=()=>new Promise(resolve=>{finishSynthesis=resolve;});
const slow=box.createCloudVoice(), slowAbort=new AbortController();const slowSpeech=slow.speak('Late synthesis',slowAbort.signal).catch(()=>{});await tick();slowAbort.abort();await slowSpeech;
const priorPlays=plays;finishSynthesis({playbackId:'late-old-audio'});await tick();assert.equal(plays,priorPlays,'cancelled synthesis cannot dispatch late play');port.synthesize=originalSynthesize;
shell.componentWillUnmount();console.log('PASS: actual renderer/cloud-driver recording→review→play→cancel settles despite hung cleanup; stale account callbacks suppressed; scoped cleanup idempotent. Controlled native port only.');
