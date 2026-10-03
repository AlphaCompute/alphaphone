#!/usr/bin/env bun
/** Real local Kokoro -> WAV -> Whisper qualification; no user text or network. */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {transcribeLocal} from './local-asr.mjs';
const source=process.env.ALPHA_ELIZA_SOURCE,library=process.env.ELIZA_INFERENCE_LIBRARY;
assert.ok(source&&isAbsolute(source),'Set ALPHA_ELIZA_SOURCE to a prepared runtime');
assert.ok(library&&isAbsolute(library),'Set ELIZA_INFERENCE_LIBRARY to the installed native library');
// This qualification must never select the optional HTTP fork backend.
process.env.KOKORO_BACKEND='ffi';
const load=name=>import(pathToFileURL(join(source,'plugins/plugin-local-inference/src/services',name)).href);
const {createKokoroSpeakerPreset,createKokoroTtsBackend}=await load('voice/engine-bridge.ts');
const {loadElizaInferenceFfi}=await load('voice/ffi-bindings.ts');
const {resolveKokoroEngineConfig}=await load('voice/kokoro/kokoro-engine-discovery.ts');
const config=resolveKokoroEngineConfig();assert.ok(config,'Stage the supported Kokoro model and voice');
const ffi=loadElizaInferenceFfi(library);assert.ok(ffi.libraryAbiVersion>=14&&ffi.kokoroSupported(),'Native Kokoro ABI is required');
const backend=createKokoroTtsBackend(config,{ffi}),preset=createKokoroSpeakerPreset(config);
const phrase='Please remember to water the plants tomorrow morning.';
const trials=[];
const warm=process.argv.includes('--warm');let startupWarmupMs=0;
try{
 if(warm){const started=performance.now();await backend.synthesizeStream({phrase:{id:0,text:'Ready.',fromIndex:0,toIndex:6,terminator:'punctuation'},preset,cancelSignal:{cancelled:false},onChunk:()=>undefined});startupWarmupMs=Math.round(performance.now()-started);}
 for(let iteration=0;iteration<3;iteration++){
  const chunks=[],started=performance.now();let firstAudioMs;
  await backend.synthesizeStream({phrase:{id:iteration+1,text:phrase,fromIndex:0,toIndex:phrase.length,terminator:'punctuation'},preset,cancelSignal:{cancelled:false},onChunk:chunk=>{
   if(!chunk.isFinal&&chunk.pcm.length){assert.equal(chunk.sampleRate,24000);firstAudioMs??=performance.now()-started;chunks.push(new Float32Array(chunk.pcm));}
  }});
  const samples=chunks.reduce((total,chunk)=>total+chunk.length,0);assert.ok(samples>2400&&samples<30*24000,'Expected bounded speech audio');
  const audio=Buffer.alloc(44+samples*2);audio.write('RIFF');audio.writeUInt32LE(audio.length-8,4);audio.write('WAVE',8);audio.write('fmt ',12);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(24000,24);audio.writeUInt32LE(48000,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(samples*2,40);
  let offset=44;for(const chunk of chunks)for(const sample of chunk){assert.ok(Number.isFinite(sample));const value=Math.max(-1,Math.min(1,sample));audio.writeInt16LE(Math.round(value*(value<0?32768:32767)),offset);offset+=2;}
  const transcript=await transcribeLocal(audio,'audio/wav',AbortSignal.timeout(120000));
  const normalized=transcript.text.toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim();
  assert.equal(normalized,phrase.toLowerCase().replace(/[^a-z ]/g,''),'Synthesized speech must be intelligible to the independent local recognizer');
  trials.push({iteration,cold:!warm&&iteration===0,firstAudioMs:Math.round(firstAudioMs),samples,durationSeconds:samples/24000,transcript:transcript.text});
 }
 const digest=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
 let cancelledSamples=0;const cancelled=await backend.synthesizeStream({phrase:{id:99,text:phrase,fromIndex:0,toIndex:phrase.length,terminator:'punctuation'},preset,cancelSignal:{cancelled:true},onChunk:chunk=>{cancelledSamples+=chunk.pcm.length;}});assert.equal(cancelled.cancelled,true);assert.equal(cancelledSamples,0);
 const report={startupWarmupMs,preCancelledAudioSamples:cancelledSamples,testedAt:new Date().toISOString(),scope:'Real host Kokoro FFI synthesis and independent Whisper transcription; not agent registration, browser playback or Android acceptance',abi:ffi.libraryAbiVersion,librarySha256:await digest(library),modelSha256:await digest(join(config.layout.root,config.layout.modelFile)),voice:config.defaultVoiceId,voiceSha256:await digest(join(config.layout.voicesDir,config.defaultVoiceId+'.bin')),trials,firstAudioBudgetMs:700,firstAudioBudgetPassed:trials.every(trial=>trial.firstAudioMs<=700)};
 await mkdir('test-results/host-tts-review',{recursive:true});await writeFile(warm?'test-results/host-tts-review/roundtrip-warm.json':'test-results/host-tts-review/roundtrip.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 assert.equal(report.firstAudioBudgetPassed,true,'One or more trials exceed the unchanged 700ms first-audio budget; retain the report as failed qualification');
}finally{backend.dispose();ffi.close?.();}
