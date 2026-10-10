import test from 'node:test';
import assert from 'node:assert/strict';
import {browserVoiceOwnedFixture as fixture,flushBrowserVoice as flush} from './fixtures/browser-voice-owned.mjs';

test('owned active plain local speech stops without touching microphone or Cloud',async()=>{
 const f=fixture();try{const prepared=await f.voice.synthesizeLocal({text:'Explicitly local words',requestId:'local-owner'});await f.voice.play(prepared);const utterance=f.spoken[0];await f.voice.stopPlayback({...prepared,requestId:'local-owner'});assert.equal(f.engineCancels,1);assert.equal(utterance.onend,null);assert.equal(f.voice.activeSpeechId,undefined);assert.equal(f.captureCancels,0);assert.equal(f.recognizerStops,0);assert.equal(f.cloudCalls,0);}finally{await f.close();}
});
test('cancelled owned voices wait cannot start late after voices become available',async()=>{
 const f=fixture({localVoices:false});try{const prepared=await f.voice.synthesizeLocal({text:'Local pending words',requestId:'pending-local'});const playing=f.voice.play(prepared),rejected=assert.rejects(playing);await flush();await f.voice.stopPlayback({...prepared,requestId:'pending-local'});f.voicesReady();await rejected;assert.equal(f.spoken.length,0);assert.equal(f.cloudCalls,0);}finally{await f.close();}
});
test('owned pending paired preparation is aborted and cannot publish late audio',async()=>{
 const f=fixture({holdPaired:true});try{f.agent=f.pairedAgent;const prepared=f.voice.synthesizeLocal({text:'Explicit local-agent words',requestId:'paired-owner'});void prepared.catch(()=>{});await flush();assert.equal(f.pairedCalls.length,1);await f.voice.cancel({requestId:'paired-owner'});assert.equal(f.pairedCalls[0].signal.aborted,true);const rejected=assert.rejects(prepared);f.releasePaired();await rejected;assert.equal(f.voice.agentAudio.size,0);assert.equal(f.audio.length,0);assert.equal(f.captureCancels,0);assert.equal(f.cloudCalls,0);}finally{await f.close();}
});
for(const paired of [false,true])test(`owned ${paired?'paired':'plain local'} prepared speech is retired before playback`,async()=>{
 const f=fixture();try{f.agent=paired?f.pairedAgent:null;const prepared=await f.voice.synthesizeLocal({text:'Retire this local preparation',requestId:'prepared-owner'});await f.voice.cancel({requestId:'prepared-owner'});await assert.rejects(f.voice.play(prepared));assert.equal(f.spoken.length,0);assert.equal(f.audio.length,0);assert.equal(f.cloudCalls,0);}finally{await f.close();}
});
for(const newer of ['cloud','paired'])test(`late old local cleanup cannot stop newer ${newer} playback`,async()=>{
 const f=fixture({allowCloud:true});try{f.agent=null;const old=await f.voice.synthesizeLocal({text:'Old local words',requestId:'old'});f.agent=newer==='paired'?fixtureAgent(f):null;const current=newer==='cloud'?await f.voice.synthesize({text:'New Cloud words',requestId:'new',environment:'production',credentialId:'cloud-credential'}):await f.voice.synthesizeLocal({text:'New paired words',requestId:'new'});await f.voice.play(current);const audio=f.audio.at(-1);await f.voice.stopPlayback({...old,requestId:'old'});await f.voice.cancel({requestId:'old'});assert.equal(f.voice.activeSpeechId,current.playbackId);assert.equal(audio.paused,false);assert.equal(f.captureCancels,0);assert.equal(f.recognizerStops,0);assert.equal(f.voice.agentAudio.has(current.playbackId),true);}finally{await f.close();}
});
function fixtureAgent(f){return {session:{sessionId:'paired-current'},synthesizeSpeech:async()=>new Blob(['closed current bytes'],{type:'audio/mpeg'})};}
test('actual local speech helper cancels a held paired preparation before release',async()=>{
 const f=fixture({holdPaired:true});try{f.agent=f.pairedAgent;const controller=new AbortController(),speaking=f.box.speakLocalText('Keep this explicit local choice',controller.signal),rejected=assert.rejects(speaking);await flush();assert.equal(f.pairedCalls.length,1);controller.abort();await rejected;assert.equal(f.pairedCalls[0].signal.aborted,true);f.releasePaired();await flush();assert.equal(f.voice.agentAudio.size,0);assert.equal(f.audio.length,0);assert.equal(f.cloudCalls,0);}finally{await f.close();}
});
test('active request ownership survives eviction of its prepared cache entry',async()=>{
 const f=fixture();try{f.agent=null;const active=await f.voice.synthesizeLocal({text:'Owned active local speech',requestId:'active-owner'});await f.voice.play(active);for(let i=0;i<9;i++)await f.voice.synthesizeLocal({text:'Other preparation',requestId:'other-'+i});await f.voice.stopPlayback({...active,requestId:'active-owner'});assert.equal(f.engineCancels,1);assert.equal(f.voice.activeSpeechId,undefined);}finally{await f.close();}
});
test('empty foreign request is scoped and cannot become global cancellation',async()=>{
 const f=fixture();try{f.agent=null;const active=await f.voice.synthesizeLocal({text:'Active local words',requestId:'active-owner'});await f.voice.play(active);await f.voice.cancel({requestId:''});assert.equal(f.engineCancels,0);assert.equal(f.voice.activeSpeechId,active.playbackId);assert.equal(f.captureCancels,0);assert.equal(f.recognizerStops,0);}finally{await f.close();}
});
