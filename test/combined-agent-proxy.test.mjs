import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import {createCombinedAgentProxy} from '../scripts/combined-agent-proxy.mjs';

function record() {return {workflowId:'workflow',approvalRunId:'approval',conversationId:'conversation',answer:56,sessions:new Set(),devices:new Set(),readReceipts:new Set(),lifecycleReceipts:[],nativeRunIds:[],pairings:0,chats:0,asr:0,tts:0,deviceDecisions:0,deviceClaims:0,deviceReceipts:0,metadataPosts:0,droppedMetadata:0,approvalDecisions:0,replayAttempts:0,restoredAuth:0,restoredHistory:0,failed:false,providerFailure:false};}
async function listen(server) {await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${server.address().port}`;}
async function setup(t,handler,options={}) {
  const upstream=http.createServer(handler),host=await listen(upstream);
  let active=record();
  const proxy=createCombinedAgentProxy({host,getActive:()=>active,...options}),origin=await listen(proxy);
  t.after(async()=>{for(const server of [proxy,upstream]){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}});
  return {get active(){return active;},set active(value){active=value;},origin};
}
function request(origin,route,method='POST',headers={}) {return new Promise((resolve,reject)=>{
  const req=http.request(origin+route,{method,headers,timeout:3000},res=>{
    let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,body}));
  });req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('fixture timeout')));req.end();
});}
const json=(res,data)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};

test('campaign proxy retains route counters and hashes one session/device identity',async t=>{
  const observed=[],f=await setup(t,(req,res)=>{observed.push(req.headers);json(res,req.url.includes('/messages')?{text:'56'}:req.url.endsWith('/run')?{execution:{id:'run'}}:{receipt:{operation:'remove'}});});
  const headers={authorization:'Bearer synthetic','x-eliza-device-id':'device','x-eliza-device-key':'synthetic-key'};
  for(const route of ['/api/auth/pair','/api/conversations/conversation/messages','/api/asr/whisper','/api/tts/local-inference','/api/client-devices/device/decision','/api/client-devices/device/claim','/api/client-devices/device/receipt','/api/workflow/executions/approval/approvals/write-fixture/0','/api/workflow/workflows/workflow/lifecycle','/api/workflow/workflows/workflow/run'])assert.equal((await request(f.origin,route,'POST',headers)).status,200);
  for(const key of ['pairings','chats','asr','tts','deviceDecisions','deviceClaims','deviceReceipts','approvalDecisions'])assert.equal(f.active[key],1,key);
  assert.equal(f.active.exactChat,true);assert.equal(f.active.sessions.size,1);assert.equal(f.active.devices.size,1);assert.equal(f.active.failed,false);
  assert.deepEqual(f.active.nativeRunIds,['run']);assert.deepEqual(f.active.lifecycleReceipts,[{operation:'remove'}]);assert.match([...f.active.sessions][0],/^[0-9a-f]{64}$/);
  assert.ok(observed.every(h=>h.host==='10.0.2.2:47858'&&h['x-forwarded-for']==='192.0.2.1'));
});
test('metadata fault injection retains the receipt without reporting a transport failure',async t=>{
  const receipt={mutationId:'mutation',versionId:'revision'},f=await setup(t,(_req,res)=>json(res,{receipt}));
  await assert.rejects(request(f.origin,'/api/workflow/workflows/workflow/metadata'));
  assert.equal(f.active.metadataPosts,1);assert.equal(f.active.droppedMetadata,1);assert.deepEqual(f.active.metadataReceipt,receipt);assert.equal(f.active.mutationId,'mutation');assert.equal(f.active.failed,false);
});
test('restart verification rejects replay without forwarding and admits enrollment and reads',async t=>{
  let forwarded=0;const f=await setup(t,(_req,res)=>{forwarded++;json(res,{});});f.active.phase='verify';
  assert.equal((await request(f.origin,'/api/workflow/workflows/workflow/run')).status,409);assert.equal(forwarded,0);assert.equal(f.active.replayAttempts,1);
  await request(f.origin,'/api/client-devices/register');
  for(const route of ['/api/auth/me','/api/conversations/conversation/messages','/api/workflow/executions/run'])await request(f.origin,route,'GET');
  assert.equal(forwarded,4);assert.equal(f.active.restoredAuth,1);assert.equal(f.active.restoredHistory,1);assert.deepEqual([...f.active.readReceipts],['run']);
});
for(const change of ['owner','phase','retire'])test(`late response cannot become current evidence after ${change} changes`,async t=>{
  let release,arrived;const seen=new Promise(resolve=>arrived=resolve);
  const f=await setup(t,(_req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.flushHeaders();release=()=>res.end(JSON.stringify({text:'56'}));arrived();});
  const prior=f.active;prior.phase='prepare';const pending=request(f.origin,'/api/conversations/conversation/messages');const rejected=assert.rejects(pending);
  await seen;
  if(change==='owner')f.active=record();else if(change==='phase')f.active.phase='verify';else f.active=null;
  release();await rejected;assert.equal(prior.failed,true);assert.equal(prior.chats,0);if(f.active)assert.equal(f.active.chats,0);
});
test('oversized buffered responses fail the bound campaign and close the client',async t=>{
  const f=await setup(t,(_req,res)=>json(res,{text:'x'.repeat(2048)}),{maxBytes:1024});
  await assert.rejects(request(f.origin,'/api/conversations/conversation/messages'));assert.equal(f.active.failed,true);assert.equal(f.active.chats,0);
});
test('upstream timeout fails the campaign instead of only returning a gateway error',async t=>{
  const f=await setup(t,()=>{}, {timeout:100});
  assert.equal((await request(f.origin,'/api/auth/me','GET')).status,502);assert.equal(f.active.failed,true);
});
test('malformed responses and changed session identities invalidate campaign evidence',async t=>{
  const f=await setup(t,(req,res)=>req.url.includes('/messages')?res.end('not json'):json(res,{}));
  await request(f.origin,'/api/auth/me','GET',{authorization:'first'});await request(f.origin,'/api/auth/me','GET',{authorization:'second'});assert.equal(f.active.failed,true);
  f.active=record();await request(f.origin,'/api/conversations/conversation/messages');assert.equal(f.active.failed,true);assert.equal(f.active.chats,0);
});
