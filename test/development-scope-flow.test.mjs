import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fork} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {DEVELOPMENT_PROPOSAL_VIEWS} from '../apps/app/src/runtime/development-view-contract.ts';

test('real loopback development request advertises only supported routes and rejects injected deferred proposals', {timeout:20000}, async()=>{
 const child=fork(fileURLToPath(new URL('../scripts/dev-agent.mjs',import.meta.url)),[],{execArgv:['--import',fileURLToPath(new URL('./fixtures/development-scope-provider.mjs',import.meta.url))],env:{...process.env,CEREBRAS_API_KEY:'synthetic-test-only',CEREBRAS_BASE_URL:'https://provider.invalid',ALPHA_DEV_MODEL:'synthetic-model',ALPHA_AGENT_BACKEND:'direct-diagnostic'},stdio:['ignore','pipe','pipe','ipc']});
 let ready,port,schemas=[],output='',error='';
 child.on('message',m=>{if(m.port)port=m.port;if(m.schema)schemas.push(m.schema);});
 child.stdout.on('data',b=>{output+=b;for(const line of output.split('\n')){try{const p=JSON.parse(line);if(p.status==='ready')ready=p;}catch{}}});child.stderr.on('data',b=>error+=b);
 try{
  const deadline=Date.now()+5000;while(!ready||!port){if(child.exitCode!==null)throw new Error('Child failed: '+error);assert.ok(Date.now()<deadline,'server startup deadline');await new Promise(r=>setTimeout(r,10));}
  const token=(await fs.readFile(ready.tokenPath,'utf8')).trim();
  let requests=0;
  for(const view of [...DEVELOPMENT_PROPOSAL_VIEWS,'phone','messages','contacts','wallet','passwords','assistant','apps']){
   const response=await fetch(`http://127.0.0.1:${port}/chat`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({requestId:randomUUID(),text:view,context:{view:'assistant',revision:9}}),signal:AbortSignal.timeout(3000)});
   assert.equal(response.status,200);const reply=await response.json();requests++;
   const schemaDeadline=Date.now()+2000;while(schemas.length<requests){assert.ok(Date.now()<schemaDeadline,'provider schema IPC deadline');await new Promise(r=>setTimeout(r,5));}
   assert.equal(schemas.length,requests);assert.deepEqual(schemas.at(-1),[...DEVELOPMENT_PROPOSAL_VIEWS]);
   const allowed=DEVELOPMENT_PROPOSAL_VIEWS.includes(view);assert.equal(reply.proposals.length,allowed?1:0,view);
   if(allowed){assert.deepEqual(reply.proposals[0].operation,{type:'open_view',view});assert.equal(reply.proposals[0].contextRevision,9);}
  }
  // Source parity only: this check does not execute Android native validation.
  const native=await fs.readFile(new URL('../android/app/src/debug/java/ai/elizaresearch/alphaphone/DevelopmentAgentPlugin.java',import.meta.url),'utf8');
  const values=native.match(/Arrays\.asList\(([^\n]+)\)\.contains\(view\)/)[1].match(/"[^"]+"/g).map(x=>JSON.parse(x));
  assert.deepEqual(values,[...DEVELOPMENT_PROPOSAL_VIEWS]);
 }finally{
  const terminal=()=>child.exitCode!==null||child.signalCode!==null;
  if(!terminal()){
   const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');
   await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,2000).unref())]);
   if(!terminal()){child.kill('SIGKILL');await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,2000).unref())]);}
  }
  assert.ok(terminal(),'Child exit unconfirmed; retain owned directory');
  if(ready){
   assert.match(ready.sessionId,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
   const owned=join(tmpdir(),`alphaphone-dev-agent-${ready.sessionId}`);
   assert.equal(ready.tokenPath,join(owned,'development-agent-token'));
   assert.equal(dirname(ready.tokenPath),owned);assert.equal(await fs.realpath(owned),await fs.realpath(tmpdir())+`/alphaphone-dev-agent-${ready.sessionId}`);
   await fs.rm(owned,{recursive:true,force:true});
  }
 }
});
