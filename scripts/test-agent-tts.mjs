#!/usr/bin/env node
/** Real authenticated agent TTS, intelligibility, isolation and worker cancellation. */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {transcribeLocal} from './local-asr.mjs';
const profile=process.env.ALPHA_REMOTE_PROFILE;assert.ok(profile,'Set an isolated ALPHA_REMOTE_PROFILE');
const port=Number(process.env.ALPHA_REMOTE_PORT||47869);assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535);
const base=`http://127.0.0.1:${port}`,root=(await readFile(join(profile,'owner-token'),'utf8')).trim();
const json=async(path,body,token=root)=>{const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});assert.equal(response.status,200,path);return response.json();};
const status=await json('/api/auth/status'),code=await json('/api/auth/pair-code');
const paired=await json('/api/auth/pair',{code:code.code,instanceId:status.instanceId});assert.equal(paired.access,'owner');assert.equal(paired.instanceId,status.instanceId);
const speechStatus=()=>json('/api/tts/kokoro/status',undefined,paired.token);
const before=Date.now(),ready=await speechStatus();assert.equal(ready.ready,true);assert.equal(ready.provider,'standalone-kokoro');
const phrase='Please remember to water the plants tomorrow morning.',id=randomUUID();
const post=(body,requestId=randomUUID(),token=paired.token,signal=AbortSignal.timeout(45000))=>fetch(base+'/api/tts/kokoro',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Request-Id':requestId},body:JSON.stringify(body),signal});
const response=await post({text:phrase},id);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'audio/wav');assert.equal(response.headers.get('x-request-id'),id);assert.equal(response.headers.get('x-eliza-speech-provider'),'standalone-kokoro');
const bytes=Buffer.from(await response.arrayBuffer());assert.ok(bytes.length>44&&bytes.length<1440045);
const transcript=await transcribeLocal(bytes,'audio/wav',AbortSignal.timeout(120000));assert.match(transcript.text.toLowerCase(),/water the plants tomorrow morning/);
assert.equal((await post({text:phrase},id)).status,409);assert.equal((await post({text:'x'.repeat(501)})).status,422);assert.equal((await post({text:'<think>secret reasoning</think>'})).status,422);assert.equal((await post({text:phrase,voice:'other'})).status,422);assert.equal((await post({text:phrase},randomUUID(),'invalid')).status,401);assert.equal((await post({text:phrase},randomUUID(),root)).status,403);
assert.equal((await post(null)).status,422);
const malformed=await fetch(base+'/api/tts/kokoro',{method:'POST',headers:{Authorization:`Bearer ${paired.token}`,'Content-Type':'application/json','X-Request-Id':randomUUID()},body:'{',signal:AbortSignal.timeout(15000)});assert.equal(malformed.status,400);
const metadata=JSON.parse(await readFile(join(profile,'process.json'),'utf8'));
const workers=()=>{let pids;try{pids=execFileSync('pgrep',['-P',String(metadata.pid)],{encoding:'utf8'}).trim().split(/\s+/);}catch{return [];}
 return pids.filter(pid=>{try{return execFileSync('ps',['-p',pid,'-o','command='],{encoding:'utf8'}).includes('/host-tts-worker.ts');}catch{return false;}}).map(Number);};
assert.equal(workers().length,1);const oldWorker=workers()[0];
const controller=new AbortController(),pending=post({text:Array(7).fill(phrase).join(' ')},randomUUID(),paired.token,controller.signal).then(response=>({status:response.status}),error=>({error:error.name}));
let observedBusy=false;for(let i=0;i<100;i++){if((await speechStatus()).busy){observedBusy=true;break;}await new Promise(resolve=>setTimeout(resolve,10));}assert.equal(observedBusy,true,'Cancellation must exercise a dispatched synthesis');controller.abort();assert.equal((await pending).error,'AbortError');
let recovered;for(let i=0;i<40;i++){recovered=await speechStatus();if(recovered.ready&&!recovered.busy&&workers().length===1&&workers()[0]!==oldWorker)break;await new Promise(resolve=>setTimeout(resolve,50));}
assert.equal(recovered.ready,true);assert.equal(recovered.busy,false);assert.equal(workers().length,1);assert.notEqual(workers()[0],oldWorker);assert.throws(()=>process.kill(oldWorker,0),error=>error.code==='ESRCH');
const retry=await post({text:phrase});assert.equal(retry.status,200);await retry.arrayBuffer();
const report={testedAt:new Date().toISOString(),scope:'Real isolated host agent TTS; no browser playback or Android execution',provider:ready.provider,voice:ready.voice,transcript:transcript.text,audioBytes:bytes.length,elapsedMs:Date.now()-before,checks:{ownerAudio:200,duplicate:409,oversizedText:422,hiddenOnlyText:422,unsupportedOptions:422,nullBody:422,malformedJson:400,unauthorized:401,unpairedRoot:403,dispatchedCancellation:true,workerTerminated:true,readinessRecovered:true,retry:200}};
await mkdir('test-results/host-tts-review',{recursive:true});await writeFile('test-results/host-tts-review/agent-http.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
