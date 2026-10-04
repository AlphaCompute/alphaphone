#!/usr/bin/env node
/** Opt-in real-provider qualification. Owns only a new synthetic profile. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {sourceDirectory,verifySource} from './local-agent-source.mjs';
import {readLocalAgentStream} from '../apps/app/src/runtime/local-agent-stream.ts';

if(!process.argv.includes('--live'))throw Error('Pass --live to send synthetic test prompts to the configured Cerebras provider.');
if(process.platform==='win32')throw Error('This qualification requires POSIX process groups.');
const product=path.resolve(import.meta.dirname,'..');
const source=process.env.ALPHA_ELIZA_SOURCE?path.resolve(process.env.ALPHA_ELIZA_SOURCE):sourceDirectory(product);
const lock=JSON.parse(fs.readFileSync(path.join(product,'upstream.lock.json')));
verifySource(source,lock.commit);
const bun=execFileSync('/usr/bin/which',[process.env.ALPHA_BUN||'bun'],{encoding:'utf8'}).trim();
if(!path.isAbsolute(bun)||/[\r\n]/.test(bun))throw Error('Expected an absolute Bun executable.');
const output=path.join(product,'test-results','local-redaction');fs.mkdirSync(output,{recursive:true});
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-redaction-'));fs.chmodSync(fixture,0o700);
const profile=path.join(fixture,'profile'),wireFile=path.join(fixture,'wire.jsonl');
const email='alpha.redaction.probe@example.invalid',phone='+1 202-555-0147';
const credentials=[
 {name:'quoted spaces',text:'password="q7 CredentialTailZ8"',marker:'CredentialTailZ8'},
 {name:'escaped quote',text:JSON.stringify({password:'q7"CredentialTailZ8'}),marker:'CredentialTailZ8'},
 {name:'escaped newline',text:JSON.stringify({password:'q7\nCredentialTailZ8'}),marker:'CredentialTailZ8'},
 {name:'HTTPS userinfo',text:'https://synthetic:q7@CredentialTailZ8@example.invalid/path',marker:'CredentialTailZ8'},
 {name:'database userinfo',text:'postgresql://user:q7@@CredentialTailZ8@localhost:5432/db',marker:'CredentialTailZ8'},
 {name:'short named password',text:'password="z9Q2!"',marker:'z9Q2!'},
];
const markers=[...new Set(credentials.map(c=>c.marker))];
// Record booleans only; never provider headers, credentials, or request bodies.
const preload=path.join(fixture,'wire.mjs');
fs.writeFileSync(preload,`import {appendFileSync} from 'node:fs';
const original=globalThis.fetch;
globalThis.fetch=async function(input,init){
 const url=input instanceof Request?input.url:String(input);
 if(new URL(url).hostname==='api.cerebras.ai'){
  const body=typeof init?.body==='string'?init.body:input instanceof Request?await input.clone().text():'';
  const record={captured:body.length>0,rawEmail:body.includes(${JSON.stringify(email)}),rawPhone:body.includes(${JSON.stringify(phone)}),rawCredential:${JSON.stringify(markers)}.some(value=>body.includes(value))};
  appendFileSync(${JSON.stringify(wireFile)},JSON.stringify(record)+'\\n',{mode:0o600});
 }
 return original.call(this,input,init);
};\n`,{mode:0o600});
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
const wrapper=path.join(fixture,'bun-instrumented');
fs.writeFileSync(wrapper,`#!/bin/sh\nexec ${quote(bun)} --preload ${quote(preload)} "$@"\n`,{mode:0o700});
const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const origin=`http://127.0.0.1:${port}`;
let child,token,owner,retainedConversation,runtimePid;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(route,body,credential=token){
 const response=await fetch(origin+route,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error(`Qualification request failed: HTTP ${response.status}`);
 return response.json();
}
async function start(){
 const log=fs.openSync(path.join(fixture,'launcher.log'),'a',0o600);
 child=spawn(process.execPath,['scripts/start-local-remote.mjs'],{cwd:product,detached:true,stdio:['ignore',log,log],env:{...process.env,ALPHA_BUN:wrapper,ALPHA_ELIZA_SOURCE:source,ALPHA_REMOTE_PROFILE:profile,ALPHA_REMOTE_PORT:String(port),ALPHA_LOCAL_ASR:'off',ALPHA_LOCAL_TTS:'off',ELIZA_SECRET_SWAP_ENABLED:'true',ELIZA_PII_SWAP_ENABLED:'true'}});fs.closeSync(log);
 let exited=false;child.once('exit',()=>{exited=true;});const deadline=Date.now()+180000;
 while(true){
  if(exited)throw Error('Isolated runtime exited before readiness.');
  if(Date.now()>deadline)throw Error('Isolated runtime readiness deadline exceeded.');
  try{const root=fs.readFileSync(path.join(profile,'owner-token'),'utf8').trim();const response=await fetch(origin+'/api/auth/status',{headers:{Authorization:'Bearer '+root},signal:AbortSignal.timeout(2000)});if(response.ok){const status=await response.json();const code=await request('/api/auth/pair-code',undefined,root);const paired=await request('/api/auth/pair',{code:code.code,instanceId:status.instanceId},root);assert.equal(paired.access,'owner');token=paired.token;const who=await request('/api/auth/me');assert.equal(who.access.role,'OWNER');const agents=await request('/api/agents');if(agents.agents?.length===1){const metadata=JSON.parse(fs.readFileSync(path.join(profile,'process.json')));assert.equal(metadata.revision,lock.commit);assert.equal(metadata.egressRedactionRequested,'all');assert.ok(Number.isInteger(metadata.pid));runtimePid=metadata.pid;owner=who.identity.id;return;}}}catch{}
  await wait(500);
 }
}
async function stop(){
 if(!child)return;
 const current=child;child=undefined;
 const terminate=signal=>{try{process.kill(-current.pid,signal);}catch(error){if(error.code!=='ESRCH')throw error;}};
 terminate('SIGTERM');
 const deadline=Date.now()+10000;while(current.exitCode===null&&current.signalCode===null&&Date.now()<deadline)await wait(50);
 // The complete isolated process group belongs to this fixture, including workers.
 terminate('SIGKILL');
 if(current.exitCode===null&&current.signalCode===null)await once(current,'exit');
}
const interrupted=()=>{void stop().finally(()=>process.exit(130));};process.once('SIGINT',interrupted);process.once('SIGTERM',interrupted);
const report={checkedAt:new Date().toISOString(),source:lock.commit,scope:'Synthetic real-provider host requests; no browser UI or Android acceptance',cases:[],passed:false};
const safe=text=>!markers.some(value=>text.includes(value))&&!/__ELIZA_(SECRET|CONTACT)_/.test(text);
const restored=text=>text.includes(email)&&text.includes(phone);
try{
 await start();const firstOwner=owner,firstPid=runtimePid;
 for(const [index,credential]of credentials.entries()){
  const {conversation}=await request('/api/conversations',{title:'Synthetic privacy qualification '+index});if(index===0)retainedConversation=conversation.id;
  const reply=await request(`/api/conversations/${conversation.id}/messages`,{text:`Draft a fictional contact card for Jane using email ${email} and telephone ${phone}. Include both contact values exactly. This unrelated test credential must not appear in the card: ${credential.text}. Do not send anything or use tools.`,channelType:'DM',clientMessageId:crypto.randomUUID()});
  report.cases.push({name:credential.name,contactsRestored:restored(reply.text||''),safe:safe(reply.text||'')});
 }
 const {conversation}=await request('/api/conversations',{title:'Synthetic streaming privacy qualification'});let progress='',progressSafe=true;
 const signal=AbortSignal.timeout(120000);const response=await fetch(origin+`/api/conversations/${conversation.id}/messages/stream`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({text:`Draft a fictional contact card with email ${email} and telephone ${phone}. Include both exactly. Exclude this unrelated password="q7 CredentialTailZ8". Do not send anything or use tools.`,channelType:'DM',streamProtocol:'delta-v2',clientMessageId:crypto.randomUUID()}),signal});
 const reply=await readLocalAgentStream(response,signal,text=>{progress=text;progressSafe=progressSafe&&safe(text);});
 report.stream={contactsRestored:restored(reply.text),safe:safe(reply.text),progressSafe,progressReceived:progress.length>0};
 await stop();await start();
 const retained=await request(`/api/conversations/${retainedConversation}/messages`,{text:'Repeat the fictional contact card from earlier, including its exact email and phone. Keep unrelated credentials out. Do not use tools or send anything.',channelType:'DM',clientMessageId:crypto.randomUUID()});
 report.restart={distinctRuntimeProcess:runtimePid!==firstPid,ownerRetained:owner===firstOwner,contactsRestored:restored(retained.text||''),safe:safe(retained.text||'')};
 const wire=fs.readFileSync(wireFile,'utf8').trim().split('\n').map(JSON.parse);
 report.wire={requests:wire.length,safe:wire.length>=credentials.length+2&&wire.every(row=>row.captured&&!row.rawCredential&&!row.rawEmail&&!row.rawPhone)};
 report.passed=report.cases.every(row=>row.contactsRestored&&row.safe)&&Object.values(report.stream).every(Boolean)&&Object.values(report.restart).every(Boolean)&&report.wire.safe;
}finally{
 await stop();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');
 // The private synthetic profile is retained for failure diagnosis, never copied
 // into the repository or included in the public summary.
 console.log(JSON.stringify(report,null,2));
 if(report.passed)fs.rmSync(fixture,{recursive:true,force:true});else console.error('Private synthetic evidence retained at '+fixture);
}
if(!report.passed)process.exitCode=1;
