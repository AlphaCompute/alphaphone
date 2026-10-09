import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {loadPreparedBatchVoice} from './fixtures/shared-batch-voice.mjs';
import {browserVoiceOwnedFixture} from './fixtures/browser-voice-owned.mjs';

// Actual Cloud controller/helper and Maps coordinator; all native/network/media ports are closed.
function fixture(){
 const subscriptions=new Set(),listeners=new Map(),f={calls:[],plays:[],stops:[],account:0,credential:'credential-a',session:'account-a',environment:'production',open:false,busy:false,local:0,active:null};
 const document=Object.assign(new EventTarget(),{hidden:false,documentElement:{dataset:{}},querySelectorAll:()=>[]});
 const native={
  synthesize:async input=>{if(input.replace===false&&f.busy)throw Object.assign(Error('Busy'),{code:'playback-busy'});f.calls.push(input);if(f.failure)throw f.failure;return {playbackId:'audio-'+input.requestId};},
  play:async input=>{f.plays.push(input);f.active={playbackId:input.playbackId,requestId:f.calls.at(-1).requestId};},
  cancel:async()=>{},stopPlayback:async input=>{f.stops.push(input);if(f.stopWait)await f.stopWait();if(f.stopFailure)throw f.stopFailure;if(f.active?.requestId===input.requestId)f.active=null;},
  synthesizeLocal:async()=>{f.local++;throw Error('Generic speech used local synthesis');},
  addListener:async(event,callback)=>{const set=listeners.get(event)||new Set();listeners.set(event,set);set.add(callback);return {remove:async()=>set.delete(callback)};},
 };
 const controller={getSnapshot:()=>({open:f.open}),getCloudEnvironment:()=>f.environment,getCloudClient:()=>f.credential?{credentialId:f.credential,sessionId:f.session}:null,openCloudAccount:()=>{f.account++;f.open=true;},subscribe:callback=>{subscriptions.add(callback);return()=>subscriptions.delete(callback);}};
 const window=new EventTarget(),box={Capacitor:{isNativePlatform:()=>false},registerPlugin:()=>native,connectionController:controller,document,window,crypto,AbortController,DOMException,setTimeout,clearTimeout};loadPreparedBatchVoice(box);
 const load=(file,expose)=>{const source=fs.readFileSync(file,'utf8').replace(/^import .*;\n/gm,'').replaceAll('export async function','async function').replaceAll('export function','function').replaceAll('export class','class').replaceAll('export type','type');vm.runInNewContext('{'+stripTypeScriptTypes(source,{mode:'transform'})+'\n'+expose+'}',box);};
 load('apps/app/src/local-speech-playback.ts','globalThis.playOwnedSpeech=playOwnedSpeech;');load('apps/app/src/runtime/cloud-voice.ts','globalThis.speakCloudText=speakCloudText;');
 load('.eliza/client-features/plugins/plugin-maps/src/client/navigation-voice.ts','globalThis.SharedNavigationVoice=NavigationVoice;');load('apps/app/src/maps/navigation-voice.ts','globalThis.NavigationVoice=NavigationVoice;');
 f.speak=box.speakCloudText;f.navigation=failed=>new box.NavigationVoice(failed);f.document=document;f.window=window;f.changed=()=>{for(const callback of subscriptions)callback();};f.emit=(event,id=f.active?.playbackId)=>{for(const callback of listeners.get(event)||[])callback({playbackId:id});};return f;
}
async function until(check){for(let i=0;i<100&&!check();i++)await new Promise(resolve=>setTimeout(resolve,5));assert.ok(check());}

test('generic speech uses only bound Cloud synthesis and matching completion',async()=>{
 const f=fixture(),pending=f.speak('Public synthetic direction',new AbortController().signal);await until(()=>f.plays.length===1);assert.equal(f.local,0);assert.equal(f.calls[0].text,'Public synthetic direction');assert.equal(f.calls[0].environment,'production');assert.equal(f.calls[0].credentialId,'credential-a');f.emit('playbackEnded');await pending;
});
test('unsigned generic speech opens the account without preparing any audio',async()=>{
 const f=fixture();f.credential=null;await assert.rejects(f.speak('Synthetic words',new AbortController().signal),/Sign in/);assert.equal(f.account,1);assert.equal(f.calls.length,0);assert.equal(f.local,0);
});
test('queued Cloud speech waits for unrelated playback; cancelling the wait leaves it alone',async()=>{
 const f=fixture();f.busy=true;f.active={playbackId:'foreign',requestId:'foreign'};const c=new AbortController(),pending=f.speak('Queued synthetic words',c.signal,undefined,true),rejected=assert.rejects(pending);await new Promise(resolve=>setTimeout(resolve,130));assert.equal(f.calls.length,0);assert.equal(f.plays.length,0);c.abort();await rejected;assert.equal(f.active.requestId,'foreign');assert.ok(f.stops.every(row=>row.requestId!=='foreign'));
});
test('queued Cloud speech starts once the unrelated speaker becomes idle',async()=>{
 const f=fixture();f.busy=true;const pending=f.speak('Queued synthetic words',new AbortController().signal,undefined,true);await new Promise(resolve=>setTimeout(resolve,130));assert.equal(f.calls.length,0);f.busy=false;await until(()=>f.plays.length===1);assert.equal(f.calls[0].replace,false);assert.equal(f.plays[0].replace,false);f.emit('playbackEnded');await pending;
});
test('cancelling a queued generic waiter settles promptly without releasing prior media admission',async()=>{
 const f=fixture(),first=f.speak('First synthetic speech',new AbortController().signal);await until(()=>f.plays.length===1);const previous=f.active,c=new AbortController(),second=f.speak('Cancelled queued speech',c.signal),rejected=assert.rejects(second);c.abort();await Promise.race([rejected,new Promise((_,reject)=>setTimeout(()=>reject(Error('Queued cancellation did not settle promptly')),200))]);assert.equal(f.active,previous);assert.equal(f.calls.length,1);
 const third=f.speak('Third synthetic speech',new AbortController().signal);await new Promise(resolve=>setTimeout(resolve,30));assert.equal(f.calls.length,1);f.emit('playbackEnded');await first;await until(()=>f.plays.length===2);assert.equal(f.calls[1].text,'Third synthetic speech');f.emit('playbackEnded');await third;
});
for(const retirement of ['device-state','pagehide','lock'])test('queued generic speech cannot start after '+retirement,async()=>{
 const f=fixture();f.busy=true;f.active={playbackId:'foreign',requestId:'foreign'};const pending=f.speak('Queued synthetic words',new AbortController().signal,undefined,true),rejected=assert.rejects(pending);await new Promise(resolve=>setTimeout(resolve,130));if(retirement==='lock')f.document.documentElement.dataset.devBackground='true';else f.window.dispatchEvent(new Event(retirement==='device-state'?'alpha:device-state':'pagehide'));await rejected;f.busy=false;await new Promise(resolve=>setTimeout(resolve,130));assert.equal(f.calls.length,0);assert.equal(f.plays.length,0);assert.equal(f.active.requestId,'foreign');
});
for(const change of ['account','context'])test('waiting generic admission rejects changed '+change+' after prior cleanup',async()=>{
 const f=fixture(),c=new AbortController(),first=f.speak('First synthetic words',c.signal),oldRejected=assert.rejects(first);await until(()=>f.plays.length===1);let release;f.stopWait=()=>new Promise(resolve=>release=resolve);c.abort();await until(()=>release);let current=true;const next=f.speak('Second synthetic words',new AbortController().signal,undefined,false,()=>{if(!current)throw Error('Context changed');}),rejected=assert.rejects(next);if(change==='account'){f.credential='credential-b';f.session='account-b';f.changed();}else current=false;assert.equal(f.calls.length,1);f.stopWait=null;release();await oldRejected;await rejected;assert.equal(f.calls.length,1);
});
test('unconfirmed generic speech cleanup blocks replacement; ordinary billing failure remains retryable',async()=>{
 const f=fixture(),c=new AbortController(),pending=f.speak('First synthetic words',c.signal),rejected=assert.rejects(pending,error=>error.code==='speech-cleanup-unconfirmed');await until(()=>f.plays.length===1);f.stopFailure=Error('Unconfirmed speaker cleanup');c.abort();await rejected;await assert.rejects(f.speak('No replacement',new AbortController().signal),error=>error.code==='speech-cleanup-unconfirmed');assert.equal(f.calls.length,1);
 const retry=fixture();retry.failure=Object.assign(Error('Synthetic billing refusal'),{code:'voice-http-402'});await assert.rejects(retry.speak('Synthetic words',new AbortController().signal),/Add credits/);retry.failure=null;const good=retry.speak('Retry synthetic words',new AbortController().signal);await until(()=>retry.plays.length===1);retry.emit('playbackEnded');await good;
});
test('actual Maps step replacement waits for old cleanup and mute cancels its Cloud request',async()=>{
 const f=fixture(),failures=[],navigation=f.navigation(error=>failures.push(error));navigation.update('one','First synthetic direction');await until(()=>f.plays.length===1);let release;f.stopWait=()=>new Promise(resolve=>release=resolve);navigation.update('two','Second synthetic direction');await until(()=>release);assert.equal(f.calls.length,1);f.stopWait=null;release();await until(()=>f.plays.length===2);assert.equal(f.calls[1].text,'Second synthetic direction');navigation.toggle();await until(()=>f.active===null);assert.equal(failures.length,0);assert.equal(f.local,0);
});
test('explicit local helper still never uploads reviewed text to Cloud',async()=>{
 const f=browserVoiceOwnedFixture();try{const c=new AbortController(),pending=f.box.speakLocalText('Explicit local synthetic excerpt',c.signal),rejected=assert.rejects(pending);await until(()=>f.spoken.length===1);c.abort();await rejected;assert.equal(f.cloudCalls,0);assert.equal(f.engineCancels,1);}finally{await f.close();}
});
test('actual BrowserVoice queued Cloud admission leaves foreign local playback and preparation untouched',async()=>{
 for(const pending of [false,true]){
  const f=browserVoiceOwnedFixture({allowCloud:true,holdPaired:pending});try{
   let preparation;if(pending){f.agent=f.pairedAgent;preparation=f.voice.synthesizeLocal({text:'Explicit local preparation',requestId:'foreign'});await until(()=>f.pairedCalls.length===1);}else await f.voice.play(await f.voice.synthesizeLocal({text:'Explicit local playback',requestId:'foreign'}));
   await assert.rejects(f.voice.synthesize({text:'Generic Cloud words',requestId:'queued',environment:'production',credentialId:'cloud-credential',replace:false}),error=>error.code==='playback-busy');assert.equal(f.cloudCalls,0);assert.equal(f.engineCancels,0);if(pending){assert.equal(f.pairedCalls[0].signal.aborted,false);f.releasePaired();await preparation;}else assert.ok(f.voice.activeSpeechId);
  }finally{await f.close();}
 }
});
