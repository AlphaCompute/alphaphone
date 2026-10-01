#!/usr/bin/env node
/** Actual local synthesized speech -> local ASR. No user audio or remote upload. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { transcribeLocal } from './local-asr.mjs';
const phrase='Please remember to water the plants tomorrow morning.';
const directory=await mkdtemp(join(tmpdir(),'alphaphone-asr-test-'));
const run=(exe,args)=>new Promise((resolve,reject)=>{const p=spawn(exe,args,{stdio:'ignore'});p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error('Fixture audio command failed')));});
try {
 const aiff=join(directory,'fixture.aiff'),wav=join(directory,'fixture.wav');
 await run('/usr/bin/say',['-v','Samantha','-o',aiff,phrase]);
 await run('/opt/homebrew/bin/ffmpeg',['-v','error','-i',aiff,'-ar','16000','-ac','1','-c:a','pcm_s16le',wav]);
 const audio=await readFile(wav),started=Date.now();
 let result;
 const http=process.argv.includes('--http');
 let checks={};
 if(http) {
  const token=(await readFile(process.env.ALPHA_DEV_TOKEN_FILE,'utf8')).trim();
  const url='http://127.0.0.1:47831/transcribe',requestId=randomUUID();
  const headers={Authorization:`Bearer ${token}`,'Content-Type':'audio/wav','X-Request-Id':requestId};
  const response=await fetch(url,{method:'POST',headers,body:audio,signal:AbortSignal.timeout(120000)});
  assert.equal(response.status,200);result=await response.json();assert.equal(result.requestId,requestId);
  const denied=await fetch(url,{method:'POST',headers:{'Content-Type':'audio/wav','X-Request-Id':randomUUID()},body:audio});
  assert.equal(denied.status,401);
  const duplicate=await fetch(url,{method:'POST',headers,body:audio});assert.equal(duplicate.status,409);
  const invalid=await fetch(url,{method:'POST',headers:{...headers,'X-Request-Id':randomUUID()},body:Buffer.from('not audio')});assert.equal(invalid.status,422);
  checks={httpStatus:response.status,unauthorized:denied.status,duplicate:duplicate.status,invalidAudio:invalid.status};
 } else result=await transcribeLocal(audio,'audio/wav',AbortSignal.timeout(120000));
 const normalized=result.text.toLowerCase().replace(/[^a-z ]/g,'');
 assert.ok(normalized.includes('water the plants tomorrow morning'), 'Actual transcript must contain the spoken phrase');
 assert.equal(result.local,true);
 const silencePath=join(directory,'silence.wav');
 await run('/opt/homebrew/bin/ffmpeg',['-v','error','-f','lavfi','-i','anullsrc=r=16000:cl=mono','-t','3','-c:a','pcm_s16le',silencePath]);
 const silenceAudio=await readFile(silencePath);
 if(http) {
  const token=(await readFile(process.env.ALPHA_DEV_TOKEN_FILE,'utf8')).trim();
  const silence=await fetch('http://127.0.0.1:47831/transcribe',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'audio/wav','X-Request-Id':randomUUID()},body:silenceAudio,signal:AbortSignal.timeout(120000)});
  assert.equal(silence.status,422);checks.silenceHttpStatus=silence.status;
 } else await assert.rejects(()=>transcribeLocal(silenceAudio,'audio/wav',AbortSignal.timeout(120000)), /No usable speech was recognized/);
 checks.silenceRejected=true;
 const modelPath=process.env.ALPHA_ASR_MODEL||join(homedir(),'.cache/alphaphone-asr/tiny.en/ggml-model.bin');
 const report={testedAt:new Date().toISOString(),scope:http?'Authenticated loopback HTTP and real host ASR; not Android microphone acceptance':'Real host ASR helper; not HTTP or Android microphone acceptance',phrase,transcript:result.text,engine:result.engine,language:result.language,durationSeconds:result.durationSeconds,elapsedMs:Date.now()-started,audioBytes:audio.length,modelSha256:createHash('sha256').update(await readFile(modelPath)).digest('hex'),checks};
 await mkdir('test-results',{recursive:true});await writeFile('test-results/local-asr'+(http?'-http':'')+'.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
} finally {await rm(directory,{recursive:true,force:true});}
