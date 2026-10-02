#!/usr/bin/env node
/** Verify synthetic speech against the real authenticated local agent ASR route. */
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const port=Number(process.env.ALPHA_REMOTE_PORT||47859);
assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535);
assert.ok(process.env.ALPHA_REMOTE_PROFILE,'Set an isolated ALPHA_REMOTE_PROFILE');
const base=`http://127.0.0.1:${port}`;
const root=(await readFile(join(process.env.ALPHA_REMOTE_PROFILE,'owner-token'),'utf8')).trim();
async function json(path,body,token=root){
 const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,200,`Unexpected status for ${path}`);return response.json();
}
const status=await json('/api/auth/status');
const code=await json('/api/auth/pair-code');
const paired=await json('/api/auth/pair',{code:code.code,instanceId:status.instanceId});
assert.equal(paired.access,'owner');assert.equal(paired.instanceId,status.instanceId);assert.equal(typeof paired.token,'string');
const ready=await json('/api/asr/whisper/status',undefined,paired.token);
assert.equal(ready.ready,true);assert.equal(ready.provider,'standalone-whisper.cpp');
const directory=await mkdtemp(join(tmpdir(),'alpha-agent-asr-'));
const run=(exe,args)=>new Promise((resolve,reject)=>{const child=spawn(exe,args,{stdio:'ignore'});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error('Synthetic fixture generation failed')));});
try{
 const phrase='Please remember to water the plants tomorrow morning.';
 const aiff=join(directory,'speech.aiff'),wav=join(directory,'speech.wav'),silence=join(directory,'silence.wav');
 await run('/usr/bin/say',['-v','Samantha','-o',aiff,phrase]);
 await run('/opt/homebrew/bin/ffmpeg',['-v','error','-i',aiff,'-ar','16000','-ac','1','-c:a','pcm_s16le',wav]);
 await run('/opt/homebrew/bin/ffmpeg',['-v','error','-f','lavfi','-i','anullsrc=r=16000:cl=mono','-t','3','-c:a','pcm_s16le',silence]);
 const bytes=await readFile(wav),requestId=randomUUID();
 const post=(body,id=randomUUID(),token=paired.token)=>fetch(base+'/api/asr/whisper',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'audio/wav','X-Request-Id':id},body,signal:AbortSignal.timeout(120000)});
 const started=Date.now(),response=await post(bytes,requestId);assert.equal(response.status,200);
 const transcript=await response.json();assert.equal(transcript.local,true);assert.equal(transcript.provider,ready.provider);assert.equal(transcript.requestId,requestId);
 assert.match(transcript.text.toLowerCase(),/water the plants tomorrow morning/);
 const duplicate=await post(bytes,requestId);assert.equal(duplicate.status,409);
 const invalid=await post(Buffer.from('not a wav'));assert.equal(invalid.status,422);
 const quiet=await post(await readFile(silence));assert.equal(quiet.status,422);
 const denied=await post(bytes,randomUUID(),'invalid-token');assert.equal(denied.status,401);
 const report={testedAt:new Date().toISOString(),scope:'Real isolated host ASR with synthetic audio; browser transport and Android acceptance not included',provider:ready.provider,modelSha256:ready.modelSha256,executableSha256:ready.executableSha256,transcript:transcript.text,elapsedMs:Date.now()-started,checks:{transcription:response.status,duplicate:duplicate.status,invalid:invalid.status,silence:quiet.status,unauthorized:denied.status}};
 await mkdir('test-results/host-asr-review',{recursive:true});await writeFile('test-results/host-asr-review/runtime.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await rm(directory,{recursive:true,force:true});}
