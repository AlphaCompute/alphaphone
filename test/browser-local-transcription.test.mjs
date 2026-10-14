import test from 'node:test';
import assert from 'node:assert/strict';
import {browserLocalSpeechStatus,transcribeWithSelectedBrowserAgent} from '../apps/app/src/browser/local-transcription.ts';
const signal=()=>new AbortController().signal;
test('no selected agent means unavailable without decoding or network fallback',async()=>{
 assert.equal((await browserLocalSpeechStatus(()=>null,signal())).ready,false);
 let decoded=0;await assert.rejects(transcribeWithSelectedBrowserAgent(()=>null,async()=>{decoded++;return new Uint8Array();},signal()),/unavailable/);assert.equal(decoded,0);
});
test('only explicitly selected agent receives the owned recording',async()=>{
 const calls=[],bytes=new Uint8Array([1,2]);const agent={session:'a',speechRequest:async(audio)=>{calls.push(audio);return {ready:true,text:'Reviewed words'};}};
 assert.equal((await browserLocalSpeechStatus(()=>agent,signal())).ready,true);
 const result=await transcribeWithSelectedBrowserAgent(()=>agent,async()=>bytes,signal());assert.equal(result.text,'Reviewed words');assert.deepEqual(calls,[undefined,bytes]);
});
test('selection changes during decode or provider response discard old work',async()=>{
 let calls=0,current;const a={session:'a',speechRequest:async()=>{calls++;current=null;return {text:'late'};}};current=a;
 await assert.rejects(transcribeWithSelectedBrowserAgent(()=>current,async()=>{current=null;return new Uint8Array();},signal()),/selection changed/);assert.equal(calls,0);
 current=a;await assert.rejects(transcribeWithSelectedBrowserAgent(()=>current,async()=>new Uint8Array(),signal()),/selection changed/);assert.equal(calls,1);
});
test('aborted transcription and empty text never become a completed transcript',async()=>{
 const controller=new AbortController(),agent={session:'a',speechRequest:async()=>{controller.abort();return {text:'late'};}};
 await assert.rejects(transcribeWithSelectedBrowserAgent(()=>agent,async()=>new Uint8Array(),controller.signal),{name:'AbortError'});
 agent.speechRequest=async()=>({text:' '});await assert.rejects(transcribeWithSelectedBrowserAgent(()=>agent,async()=>new Uint8Array(),signal()),/No speech/);
});
