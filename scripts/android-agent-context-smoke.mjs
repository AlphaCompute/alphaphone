/** Opt-in disposable-phone UI matrix through a real authenticated forwarding observer. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { androidEnv } from './toolchain.mjs';
const serial=process.env.ANDROID_SERIAL,env=androidEnv();
const requestIntervalMs=Number(process.env.ALPHA_CONTEXT_REQUEST_INTERVAL_MS??10000);
if(!Number.isSafeInteger(requestIntervalMs)||requestIntervalMs<0||requestIntervalMs>60000)throw Error('Request interval must be 0–60000ms');
if(!/^emulator-\d+$/.test(serial||''))throw Error('Explicit disposable ANDROID_SERIAL required');
const workflowId=process.env.ALPHA_WORKFLOW_FIXTURE_ID;
if(!/^[a-f0-9-]{36}$/.test(workflowId||''))throw Error('Explicit reviewed ALPHA_WORKFLOW_FIXTURE_ID required');
const reviewedSource=`/** @jsxImportSource smthrs */
import {createSmithers} from "smthrs/create";
import {z} from "zod";
const {Workflow,Task,smithers,outputs}=createSmithers({answer:z.object({value:z.number()})},{dbPath:process.env.ELIZA_SMTHRS_DB_PATH});
export default smithers(()=><Workflow name="alpha-arithmetic"><Task id="answer" output={outputs.answer}>{{value:7*8}}</Task></Workflow>);`;
const sessionFile=process.env.ALPHA_DEVICE_SESSION_FILE||path.join(os.homedir(),'.local/share/alphaphone/local-device-actions/paired-session.json');
if((fs.statSync(sessionFile).mode&0o077)!==0)throw Error('Owner-only session file required');
const credential=JSON.parse(fs.readFileSync(sessionFile,'utf8'));
const origin='http://127.0.0.1:47840',proxyOrigin='http://127.0.0.1:47842';
const request=async(endpoint,authenticated=true,body)=>{
 // Only this host-side pairing-code bootstrap intentionally uses loopback.
 // Every proxied app request gets X-Forwarded-For and must truly authenticate.
 if(!authenticated&&endpoint!=='/api/auth/pair-code')throw Error('Unsupported unauthenticated fixture request');
 const response=await fetch(origin+endpoint,{method:body===undefined?'GET':'POST',headers:authenticated?{Authorization:`Bearer ${credential.token}`,'X-Forwarded-For':'192.0.2.1',...(body===undefined?{}:{'Content-Type':'application/json'})}:undefined,...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Fixture request failed');return response.json();
};
const me=await request('/api/auth/me'),agents=await request('/api/agents');
if(me.access?.role!=='OWNER'||me.access?.mode!=='session'||agents.agents?.length!==1)throw Error('Authenticated owner and one running agent required');
const listed=await request('/api/workflow/workflows'),workflow=await request(`/api/workflow/workflows/${workflowId}`);
if(workflow.id!==workflowId||workflow.active!==false||workflow.schedule||typeof workflow.versionId!=='string'||!workflow.versionId||workflow.source?.replaceAll('\r\n','\n').trim()!==reviewedSource||listed.workflows?.filter(w=>typeof w.name==='string'&&w.name.includes(workflow.name)).length!==1)throw Error('Verified unique inactive arithmetic fixture required');
const views=['home','inbox','calendar','browser','camera','photos','maps','notes','files','workflows','settings','workflows','photos'];
let active=null;
function inspectMessage(raw){
 if(active.providerFailure)throw Error('Provider failed; further model calls are blocked');
 const body=JSON.parse(raw.toString('utf8'));
 const escaped=active.marker.replaceAll('-','\\-');
 const match=typeof body.text==='string'&&body.text.match(new RegExp(`Context flow fixture ${escaped} case (\\d+)\\.`));
 if(!match)throw Error('Only this run synthetic prompts are allowed');
 const index=Number(match[1]);
 const context=body.metadata?.alphaPhone?.context;
 const record={index,expectedInteger:active.base+index+1,paired:false,responseStatus:null,replyMatches:false};
 active.records.push(record);
 if(index>=views.length)throw Error('Sensitive or unexpected outbound message');
 assert.equal(context?.view,views[index]);assert.equal(context.sensitive,false);assert.ok(Number.isSafeInteger(context.revision));
 assert.deepEqual(Object.keys(context).sort(),['revision','sensitive','view',...(context.selectedObject?['selectedObject']:[])].sort());
 const line=body.text.split('\n').find(line=>line.startsWith('{"source":"Alpha Phone client"'));
 assert.ok(line&&line.length<=2048);assert.deepEqual(JSON.parse(line),{source:'Alpha Phone client',...context});
 if(context.selectedObject){
  assert.ok(Object.keys(context.selectedObject).every(k=>['kind','id','revision','accountId'].includes(k)));
  for(const value of Object.values(context.selectedObject))assert.match(value,/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/);
 }
 if(index===11)assert.deepEqual(context.selectedObject,{kind:'workflow',id:workflowId,revision:workflow.versionId});
 if(index===9)assert.equal(context.selectedObject,undefined);
 if(index===12){assert.equal(context.selectedObject?.kind,'video');assert.match(context.selectedObject.id,/^native-camera-v:[1-9][0-9]*$/);assert.match(context.selectedObject.revision,/^[0-9]+:[1-9][0-9]*$/);}
 record.context=context;return record;
}
const proxy=http.createServer(async(req,res)=>{
 let record;try{
  if(!req.url?.startsWith('/api/')||req.url.startsWith('//'))throw Error('Unsupported proxy path');
  const chunks=[];let bytes=0;
  for await(const chunk of req){bytes+=chunk.length;if(bytes>1024*1024)throw Error('Request bound');chunks.push(chunk);}
  const body=Buffer.concat(chunks);
  if(req.method==='POST'&&/^\/api\/conversations\/[^/]+\/messages$/.test(req.url)){
   if(!active)throw Error('No active fixture');
   assert.equal(req.url,`/api/conversations/${encodeURIComponent(active.conversationId)}/messages`,'Only selected fixture conversation may receive synthetic turns');
   record=inspectMessage(body);record.fixtureConversation=true;record.paired=/^Bearer \S+$/.test(req.headers.authorization||'');assert.ok(record.paired);
  }
  const headers={...req.headers,host:'10.0.2.2:47840','x-forwarded-for':'192.0.2.1'};
  delete headers.connection;delete headers['transfer-encoding'];headers['content-length']=String(body.length);
  // Fixed loopback upstream; Node HTTP does not follow redirects.
  const upstream=http.request(origin+req.url,{method:req.method,headers,timeout:150000},reply=>{
   const chunks=[];let size=0;
   reply.on('data',chunk=>{size+=chunk.length;if(size>8*1024*1024){upstream.destroy();return;}chunks.push(chunk);});
   reply.on('end',()=>{
    const data=Buffer.concat(chunks);
    if(record){
     record.responseStatus=reply.statusCode;
     if([429,500,502,503,504].includes(reply.statusCode))active.providerFailure=true;
     try{
      const parsed=JSON.parse(data),text=typeof parsed.text==='string'?parsed.text:null,trimmed=text?.trim()??'';
      const numericOnly=trimmed.length>0&&trimmed.length<=32&&/^-?\d+$/.test(trimmed);
      const numericParsed=numericOnly&&Number.isSafeInteger(Number(trimmed));
      if(parsed.terminalFailure||parsed.failureKind)active.providerFailure=true;
      const rateLimited=parsed.failureKind==='rate_limited'||parsed.terminalFailure?.kind==='rate_limited';
      record.replyMatches=trimmed===String(record.expectedInteger)&&!parsed.terminalFailure&&!parsed.failureKind;
      // Only classifications of the synthetic fixture response, never raw model
      // text, arbitrary failure messages, tokens, or conversation history.
      record.responseDiagnostic={rateLimited,terminalFailure:!!parsed.terminalFailure,failureKindPresent:!!parsed.failureKind,
       replyLength:text===null?null:Math.min(text.length,100000),replyLengthCapped:text!==null&&text.length>100000,
       numericOnly,numericParsed,numericValueMatches:numericParsed&&Number(trimmed)===record.expectedInteger,
       responseClass:parsed.terminalFailure?'terminal-failure':parsed.failureKind?'backend-failure':text===null?'missing-text':!trimmed?'empty-text':record.replyMatches?'exact-numeric':numericOnly?'different-numeric':'non-numeric'};
     }catch{record.replyMatches=false;record.responseDiagnostic={responseClass:'invalid-json'};}
    }
    if(active&&req.url==='/api/auth/me'&&reply.statusCode===200){try{const parsed=JSON.parse(data);active.pairedOwner=parsed.access?.mode==='session'&&parsed.access?.role==='OWNER'&&/^Bearer \S+$/.test(req.headers.authorization||'');}catch{}}
    const responseHeaders={...reply.headers,'content-length':String(data.length)};delete responseHeaders['transfer-encoding'];res.writeHead(reply.statusCode,responseHeaders);res.end(data);
   });
   reply.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});
  });
  upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});
  res.on('close',()=>{if(!res.writableEnded)upstream.destroy();});upstream.end(body);
 }catch{if(active)active.observerFailure=true;if(!res.headersSent)res.writeHead(400);res.end('Fixture observer rejected request');}
});
await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(47842,'127.0.0.1',resolve);});
const adb=path.join(env.ANDROID_HOME,'platform-tools/adb'),appId=JSON.parse(fs.readFileSync('app.config.json')).appId;
const archive=process.env.ALPHA_BUILD_ARCHIVE;
const manifestPath=archive?path.join(archive,'apk-manifest.json'):'artifacts/apk-manifest.json';
const manifest=JSON.parse(fs.readFileSync(manifestPath));
const out=process.env.ALPHA_DEVICE_RESULTS||'test-results/android-agent-context';fs.mkdirSync(out,{recursive:true});
const run=(args,input)=>execFileSync(adb,['-s',serial,...args],{env,input,encoding:'utf8',timeout:180000});
const instrument=()=>new Promise((resolve,reject)=>{
 const child=spawn(adb,['-s',serial,'shell','am','instrument','-w','-e','agentContext','true','-e','class',`${appId}.AllViewAgentContextInstrumentedTest`,`${appId}.test/androidx.test.runner.AndroidJUnitRunner`],{env});
 let output='';const timeout=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Instrumentation timeout'));},2400000);
 const collect=chunk=>{output+=chunk.toString();if(output.length>1024*1024){child.kill('SIGTERM');reject(Error('Output bound'));}};
 child.stdout.on('data',collect);child.stderr.on('data',collect);child.on('error',error=>{clearTimeout(timeout);reject(error);});child.on('close',code=>{clearTimeout(timeout);resolve({code,output});});
});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');const results=[];let providerStopped=false;
const writeReport=()=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({createdAt:new Date().toISOString(),serial,requestIntervalMs,variantPauseMs:65000,archive:archive||null,manifestPath,workflowId,workflowVersion:workflow.versionId,reviewedSourceSha256:crypto.createHash('sha256').update(reviewedSource).digest('hex'),scope:'Real Android UI/native HTTP forwarding to configured local Eliza model; 11 allowed root views plus selected workflow and real captured/decoded video; exact video metadata and cleanup checked; deferred Phone/SMS/Contacts/Wallet controls absent and zero extra outbound; excludes Cloud, enclave and stale approval cases',results},null,2)+'\n');
try{
 const unauthorized=await fetch(proxyOrigin+'/api/conversations',{redirect:'error',signal:AbortSignal.timeout(15000)});
 assert.equal(unauthorized.status,401,'Forwarder must not inherit loopback ownership');
 for(const variant of ['standalone','launcher']){
  const apk=archive?path.join(archive,`${variant}-debug.apk`):`artifacts/${variant}-debug.apk`,testApk=archive?path.join(archive,`${variant}-androidTest.apk`):`android/app/build/outputs/apk/androidTest/${variant}/debug/app-${variant}-debug-androidTest.apk`;
  const sha256=hash(apk),testSha256=hash(testApk);
  if(archive){
   assert.equal(manifest[`${variant}-debug.apk`],sha256,'Archived app SHA must match archive manifest');
   assert.equal(manifest[`${variant}-androidTest.apk`],testSha256,'Archived test SHA must match archive manifest');
  }else{
   assert.ok(Array.isArray(manifest.results),'Current artifact manifest format required');
   assert.ok(manifest.results.some(row=>row.file===`artifacts/${variant}-debug.apk`&&row.sha256===sha256),'Current app SHA must match artifact manifest');
   // Current build manifests omit instrumentation; its exact hash is recorded.
  }
  if(providerStopped){
   results.push({variant,apk,sha256,testApk,testSha256,passed:false,status:'not-run',reason:'previous-variant-provider-failure',requests:[]});writeReport();console.log(`${variant}: not run (provider failure)`);continue;
  }
  if(results.length){console.log('Waiting 65 seconds before the next independent variant; no failed request is retried.');await new Promise(resolve=>setTimeout(resolve,65000));}
  active={marker:crypto.randomUUID(),base:crypto.randomInt(100000,900000),records:[],pairedOwner:false,observerFailure:false,providerFailure:false};let passed=false,stage='install',failureStage;
  try{
   run(['install','--no-incremental','-r',apk]);run(['install','--no-incremental','-r',testApk]);run(['shell','am','force-stop',appId]);
   stage='conversation-fixture';
   const conversationTitle=`Alpha context fixture ${active.marker}`;
   const created=await request('/api/conversations',true,{title:conversationTitle});
   assert.match(created.conversation?.id,/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/);
   active.conversationId=created.conversation.id;
   const empty=await request(`/api/conversations/${encodeURIComponent(active.conversationId)}/messages`);assert.deepEqual(empty.messages,[]);
   stage='pairing';const pairing=await request('/api/auth/pair-code',false);assert.equal(typeof pairing.code,'string');
   run(['shell',`run-as ${appId} sh -c 'umask 077; mkdir -p files; cat > files/agent-context-pairing.json'`],JSON.stringify({code:pairing.code,origin:'http://10.0.2.2:47842',marker:active.marker,base:active.base,requestIntervalMs,workflowTitle:workflow.name,conversationId:active.conversationId,conversationTitle}));
   stage='instrumentation';const {code,output}=await instrument();fs.writeFileSync(path.join(out,variant+'.txt'),output);
   assert.equal(code,0);assert.match(output,/OK \(1 test\)/);assert.doesNotMatch(output,/FAILURES|INSTRUMENTATION_FAILED|Process crashed/);
   stage='wire-verification';const video=JSON.parse(run(['shell','run-as',appId,'cat','files/agent-context-video.json']));
   assert.equal(video.marker,active.marker);assert.equal(video.decoded,true);assert.equal(video.cleaned,true);
   assert.deepEqual(active.records.find(r=>r.index===12)?.context?.selectedObject,{kind:video.kind,id:video.id,revision:video.revision});
   run(['shell','run-as',appId,'rm','files/agent-context-video.json']);
   assert.equal(active.observerFailure,false);assert.equal(active.pairedOwner,true);assert.equal(active.records.length,views.length);
   assert.deepEqual(active.records.map(r=>r.index),views.map((_,i)=>i));
   assert.ok(active.records.every(r=>r.fixtureConversation&&r.paired&&r.responseStatus===200&&r.replyMatches));passed=true;
  }catch{failureStage=stage;/* Never print exceptions with private pairing inputs or request bodies. */}
  providerStopped=active.providerFailure;
  results.push({variant,apk,sha256,testApk,testSha256,passed,providerFailure:active.providerFailure,unexecutedCaseIndexes:views.map((_,i)=>i).filter(i=>!active.records.some(r=>r.index===i)),...(failureStage?{failureStage}:{}),pairedOwner:active.pairedOwner,observerFailure:active.observerFailure,requests:active.records,unauthenticatedStatus:401});
  writeReport();
  console.log(`${variant}: ${passed?'passed':'failed'}`);active=null;
 }
}finally{proxy.closeAllConnections();await new Promise(resolve=>proxy.close(resolve));}
if(results.some(r=>!r.passed))process.exitCode=1;
