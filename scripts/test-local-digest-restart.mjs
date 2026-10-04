#!/usr/bin/env node
// Destructive process tests own only their temporary synthetic runtime/profile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {verifySource} from './local-agent-source.mjs';
const product=path.resolve(import.meta.dirname,'..');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,timeout=90000){const deadline=Date.now()+timeout;while(Date.now()<deadline){const result=await check();if(result)return result;await sleep(100);}throw Error('Timed out waiting for isolated digest recovery');}
if(process.env.ALPHA_DIGEST_CRASH_CHILD==='1'){
 const source=process.env.ALPHA_DIGEST_SOURCE,dir=process.env.ALPHA_DIGEST_FIXTURE,phase=process.env.ALPHA_DIGEST_PHASE;
 const load=relative=>import(pathToFileURL(path.join(source,relative)).href);
 const {ModelType,ServiceType,TaskService}=await load('packages/core/src/index.ts');
 const {createRealTestRuntime}=await load('packages/app/test/helpers/real-runtime.ts');
 const {workflowPlugin}=await load('plugins/plugin-workflow/src/index.ts');
 const write=(name,value)=>fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(value,null,2));
 const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name+'.json')));
 const state=await createRealTestRuntime({characterName:'AlphaDigestCrashFixture',pgliteDir:path.join(dir,'db'),removePgliteDirOnCleanup:false,plugins:[workflowPlugin,{name:'synthetic-crash-model',description:'Synthetic read-only test model',models:{[ModelType.TEXT_LARGE]:async()=>{
   fs.appendFileSync(path.join(dir,'model-calls.jsonl'),JSON.stringify({phase,at:new Date().toISOString()})+'\n');
   if(phase==='admit'){write('provider-entered',{phase});await new Promise(()=>{});}
   return 'Synthetic recovery task remains open. No current phone data was read.';
 }}}]});
 const engine=state.runtime.getService('embedded_workflow_service');
 const owner='synthetic-crash-owner';
 const loop=async(source,at)=>engine.saveHostedDigest(owner,randomUUID(),{version:1,template:'morning',sourceId:source.id,sourceRevision:source.revision,timeZone:'UTC',localTime:new Date(at).toISOString().slice(11,16),enabled:true});
 try{
  if(phase==='admit'){
   const source=await engine.saveDigestSource(owner,{id:randomUUID(),kind:'tasks',label:'Synthetic recovery snapshot',text:'Synthetic recovery task is open. Explicit snapshot only.',observedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),confirmed:true});
   const scheduledAt=Math.floor(Date.now()/60000)*60000,receipt=await loop(source,scheduledAt);
   const run=await engine.startWorkflow(receipt.workflowId,{mode:'trigger',triggerData:{scheduledAtMs:scheduledAt,workflowVersionId:receipt.versionId}});
   write('admitted',{source,receipt,scheduledAt,runId:run.id});
   await new Promise(()=>{});
  }else if(phase==='recover'){
   const saved=read('admitted');
   const run=await until(async()=>{const row=await engine.getExecution(saved.runId);return row.reconciliation?.state==='outcome-unknown'&&row;});
   assert.equal(run.finished,false);assert.equal(run.id,saved.runId);
   assert.equal(run.stoppedAt,null);
   const repeats=await Promise.all([1,2].map(()=>engine.startWorkflow(saved.receipt.workflowId,{mode:'trigger',triggerData:{scheduledAtMs:saved.scheduledAt,workflowVersionId:saved.receipt.versionId}})));
   assert.ok(repeats.every(r=>r.id===saved.runId));
   const entries=(await engine.digestResults(owner,'crash-reader')).entries.filter(e=>e.workflowId===saved.receipt.workflowId);
   assert.equal(entries.length,0);
   const missedAt=Math.floor(Date.now()/60000)*60000-86400000,missed=await loop(saved.source,missedAt);
   const tasks=await state.runtime.getTasks({agentIds:[state.runtime.agentId],tags:['trigger']});
   const task=tasks.find(t=>t.metadata?.trigger?.workflowId===missed.workflowId);assert.ok(task);
   await state.runtime.updateTask(task.id,{metadata:{...task.metadata,updatedAt:missedAt,updateInterval:1,idempotencyKey:`${missed.workflowId}:${Math.floor(missedAt/60000)}`,trigger:{...task.metadata.trigger,nextRunAtMs:missedAt}}});
   write('recovered',{sameRunId:true,resultCount:entries.length,duplicateAdmissionsSameRun:true,runId:run.id,reconciliation:run.reconciliation.state,finished:run.finished});
   write('overdue',{receipt:missed,scheduledAt:missedAt,taskId:task.id});
  }else if(phase==='overdue'){
   const saved=read('overdue');
   const {registerTriggerTaskWorker}=await load('packages/agent/src/triggers/runtime.ts');registerTriggerTaskWorker(state.runtime);
   if(!state.runtime.getService(ServiceType.TASK))await state.runtime.registerService(TaskService);
   const entries=await until(async()=>{const rows=(await engine.digestResults(owner,'overdue-reader')).entries.filter(e=>e.workflowId===saved.receipt.workflowId);return rows.length&&rows;});
   assert.equal(entries.length,1);assert.equal(entries[0].status,'missed');assert.equal(entries[0].scheduledAt,new Date(saved.scheduledAt).toISOString());
   const task=await until(async()=>{const rows=await state.runtime.getTasks({agentIds:[state.runtime.agentId],tags:['trigger']});const t=rows.find(t=>t.id===saved.taskId);return t?.metadata?.trigger?.nextRunAtMs>Date.now()&&t;});
   const again=await engine.startWorkflow(saved.receipt.workflowId,{mode:'trigger',triggerData:{scheduledAtMs:saved.scheduledAt,workflowVersionId:saved.receipt.versionId}});assert.equal(again.id,entries[0].runId);
   write('overdue-result',{status:entries[0].status,resultCount:1,nextOccurrenceFuture:true,duplicateAdmissionSameRun:true});
  }else throw Error('Unknown fixture phase');
 }finally{await state.cleanup();}
 process.exit(0);
}else{
 if(process.platform==='win32')throw Error('This fixture requires POSIX process groups');
 const source=process.env.ALPHA_ELIZA_SOURCE;if(!source||!path.isAbsolute(source))throw Error('Set ALPHA_ELIZA_SOURCE to the reproduced source with installed dependencies');
 const verify=()=>verifySource(source,{baseCommit:JSON.parse(fs.readFileSync(path.join(product,'upstream.lock.json'))).commit,candidateFiles:{}},{files:{}});verify();
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-digest-crash-'));const children=new Set();
 const killOwned=child=>{assert.ok(Number.isSafeInteger(child.pid)&&child.pid>1);try{process.kill(-child.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}};
 const cleanEnv=Object.fromEntries(['PATH','HOME','TMPDIR','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 const start=phase=>{const log=fs.openSync(path.join(dir,phase+'.log'),'a');const child=spawn(process.env.ALPHA_BUN||'bun',['--conditions=eliza-source',fileURLToPath(import.meta.url)],{cwd:dir,detached:true,env:{...cleanEnv,ALPHA_DIGEST_CRASH_CHILD:'1',ALPHA_DIGEST_SOURCE:source,ALPHA_DIGEST_FIXTURE:dir,ALPHA_DIGEST_PHASE:phase},stdio:['ignore',log,log]});fs.closeSync(log);children.add(child);child.once('exit',()=>children.delete(child));child.once('error',error=>{child.spawnError=error;children.delete(child);});return child;};
 const finish=child=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{killOwned(child);reject(Error(`Fixture exceeded 120 seconds; evidence: ${dir}`));},120000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',(code,signal)=>{clearTimeout(timer);code===0?resolve():reject(Error(`Fixture exited ${code}/${signal}; evidence: ${dir}`));});});
 try{
  const held=start('admit');
  await until(()=>{if(held.spawnError)throw held.spawnError;if(held.exitCode!==null||held.signalCode!==null)throw Error(`Admission exited; evidence: ${dir}`);return fs.existsSync(path.join(dir,'provider-entered.json'))&&fs.existsSync(path.join(dir,'admitted.json'));});
  const killed=new Promise(resolve=>held.once('exit',(_,signal)=>resolve(signal)));killOwned(held);assert.equal(await killed,'SIGKILL');
  await finish(start('recover'));await finish(start('overdue'));
  const calls=fs.readFileSync(path.join(dir,'model-calls.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(calls.filter(c=>c.phase==='admit').length,1);assert.equal(calls.filter(c=>c.phase==='recover').length,0);assert.equal(calls.filter(c=>c.phase==='overdue').length,0);
  verify();
  fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({crashDuringInference:true,scope:'owned-process-group',preservedSameRun:true,unknownOutcomeNotReplayed:true,noFabricatedResult:true,overdueSkippedWithoutInference:true,modelAttempts:calls.length},null,2));
  console.log(JSON.stringify({evidence:dir,result:JSON.parse(fs.readFileSync(path.join(dir,'result.json')))}));
 }finally{await Promise.all([...children].map(child=>new Promise(resolve=>{child.once('exit',resolve);killOwned(child);})));}
}
