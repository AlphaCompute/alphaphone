import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localAgentStorage} from './local-agent-dev-storage.ts';
import {developmentDigestStore} from '../apps/app/src/runtime/local-agent-storage.ts';
import {DigestInbox} from '../apps/app/src/runtime/hosted-digests.ts';
const dir=mkdtempSync(join(tmpdir(),'alpha-digests-'));
const scope='hosted-digests:v1:'+'a'.repeat(64);
const request=async input=>localAgentStorage(dir,input);
const store=()=>developmentDigestStore(request);
try {
 const first=store(),second=store();
 assert.equal(await first.read(scope+':pending'),null);
 assert.equal(await second.read(scope+':pending'),null);
 const pending={path:'sources',body:{id:'mutation-one'},summary:'Synthetic source'};
 await first.write(scope+':pending',pending);
 await assert.rejects(second.write(scope+':pending',{...pending,body:{id:'mutation-two'}}),/another tab/);
 await assert.rejects(second.remove(scope+':pending'),/another tab/);
 assert.deepEqual(await store().read(scope+':pending'),pending);
 await assert.rejects(first.write(scope+':pending',{...pending,body:{id:'mutation-two'}}),/awaiting recovery/);
 await first.remove(scope+':pending');
 assert.equal(await store().read(scope+':pending'),null);
 await assert.rejects(first.write('device:'+'a'.repeat(64),{}),/scope/);
 await assert.rejects(first.write(scope+':large','x'.repeat(800001)),/Invalid digest/);
 assert.equal(await store().read('hosted-digests:v1:'+'b'.repeat(64)),null);
 const now=new Date().toISOString();
 const result={cursor:1,runId:'run-one',workflowId:'workflow',workflowVersionId:'version',templateVersion:'template',scheduledAt:now,source:{kind:'tasks'},status:'completed',startedAt:now,completedAt:now,output:'Synthetic digest',error:null};
 let acked=false,ackAttempts=0;
 const client={results:async()=>acked?[]:[result],ack:async()=>{
  // Inspect a fresh store before allowing the host to advance its cursor.
  assert.deepEqual(await new DigestInbox(store(),scope).history(),[result]);
  if(++ackAttempts===1)throw Error('Lost synthetic ack');
  acked=true;
 }};
 await assert.rejects(new DigestInbox(store(),scope).sync(client,new AbortController().signal),/Lost synthetic ack/);
 assert.deepEqual(await new DigestInbox(store(),scope).sync(client,new AbortController().signal),[result]);
 assert.equal(ackAttempts,2);
 let falseAck=false;
 const failingStore=developmentDigestStore(async input=>{
  if(input.operation==='digestCompareExchange'&&input.slot.endsWith(':run-two'))throw Error('Synthetic disk failure');
  return request(input);
 });
 await assert.rejects(new DigestInbox(failingStore,scope).sync({results:async()=>[{...result,cursor:2,runId:'run-two'}],ack:async()=>{falseAck=true;}},new AbortController().signal),/disk failure/);
 assert.equal(falseAck,false);
 assert.deepEqual(await new DigestInbox(store(),scope).history(),[result]);
 console.log('Local digest persistence, stale tabs, scope isolation, commit-before-ack and lost-ack recovery passed.');
} finally {rmSync(dir,{recursive:true,force:true});}
