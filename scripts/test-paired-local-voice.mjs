import fs from 'node:fs';import http from 'node:http';import crypto from 'node:crypto';
import {RemoteProtocol} from '../apps/app/src/runtime/remote-protocol.ts';
const origin=process.env.ALPHA_VOICE_ORIGIN || 'http://127.0.0.1:47844';
const target=new URL(origin); if(target.hostname!=='127.0.0.1'||target.protocol!=='http:'||target.username||target.password||target.pathname!=='/')throw Error('Explicit loopback fixture only');
const output=process.env.ALPHA_VOICE_OUTPUT || new URL('../test-results/local-agent-voice',import.meta.url).pathname;fs.mkdirSync(output,{recursive:true});
const raw=input=>new Promise((resolve,reject)=>{const req=http.request(input.url,{method:input.method,headers:{...input.headers,Host:'10.0.2.2:'+target.port},signal:input.signal},res=>{let bytes=0,chunks=[];res.on('data',c=>{bytes+=c.length;if(bytes>4*1024*1024)req.destroy(Error('response-limit'));else chunks.push(c)});res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(chunks)}));res.on('error',reject)});req.on('error',reject);req.end(input.body)});
const requester=async input=>{const r=await raw(input);return{status:r.status,body:JSON.parse(r.bytes.toString())}};
let saved;const client=new RemoteProtocol(origin,requester,{read:async()=>saved,write:async value=>{saved=value;},remove:async()=>{saved=null;}},{developmentOrigins:[origin]});
const result={testedAt:new Date().toISOString(),scope:'Real isolated paired Eliza host, local Kokoro TTS and Cerebras text; not Android or ASR',origin};
try{
 const pairing=await(await fetch(origin+'/api/auth/pair-code',{signal:AbortSignal.timeout(10000)})).json();
 const owner=await client.pair(pairing.code,AbortSignal.timeout(20000));result.ownerVerified=owner.role==='OWNER';

 const auth={Authorization:'Bearer '+saved.token,'Content-Type':'application/json'};
 const ready=await requester({url:origin+'/api/tts/local-inference/status',method:'GET',headers:auth,signal:AbortSignal.timeout(10000)});result.ttsReady=ready.body.ready;
 const denied=await raw({url:origin+'/api/tts/local-inference',method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Unauthorized fixture'}),signal:AbortSignal.timeout(10000)});result.unauthenticatedStatus=denied.status;
 const invalid=await raw({url:origin+'/api/tts/local-inference',method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic-invalid-session'},body:JSON.stringify({text:'Invalid credential fixture'}),signal:AbortSignal.timeout(10000)});result.invalidCredentialStatus=invalid.status;
 const tts=await raw({url:origin+'/api/tts/local-inference',method:'POST',headers:auth,body:JSON.stringify({text:'Alpha Phone local voice verification. Please remember to water the plants tomorrow morning.'}),signal:AbortSignal.timeout(120000)});result.ttsStatus=tts.status;result.contentType=tts.headers['content-type'];result.bytes=tts.bytes.length;
 if(tts.status===200&&result.contentType?.startsWith('audio/')){fs.writeFileSync(output+'/paired-synthetic-tts.wav',tts.bytes);result.sha256=crypto.createHash('sha256').update(tts.bytes).digest('hex');}else result.ttsError=JSON.parse(tts.bytes.toString()).error;
 const conversation=await client.createConversation('Synthetic voice and text verification',AbortSignal.timeout(20000));const reply=await client.send(conversation.id,'What is 6 multiplied by 7? Reply with only the integer.',{clientMessageId:crypto.randomUUID(),signal:AbortSignal.timeout(120000)});result.textReply=reply.text;result.textVerified=reply.text.trim()==='42';
 const asr=await requester({url:origin+'/api/asr/local-inference/status',method:'GET',headers:auth,signal:AbortSignal.timeout(10000)});result.asrStatus=asr.status;result.asrReady=asr.body.ready;result.asrError=asr.body.error;
 result.passed=result.ownerVerified&&result.unauthenticatedStatus===401&&result.invalidCredentialStatus===401&&result.ttsStatus===200&&result.bytes>44&&result.textVerified;
}catch(error){result.failure=error.code||error.message;result.passed=false;}
fs.writeFileSync(output+'/paired-http.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));

if(!result.passed)process.exitCode=1;
