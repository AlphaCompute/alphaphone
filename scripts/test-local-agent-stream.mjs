import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {createLocalAgentDevHandler} from './local-agent-dev-bridge.ts';
import {readLocalAgentStream} from '../apps/app/src/runtime/local-agent-stream.ts';
import {AlphaClient} from '../apps/app/src/runtime/alpha-client.ts';
const encoder=new TextEncoder(),signal=new AbortController().signal;
const event=value=>`data: ${JSON.stringify(value)}\n\n`;
function response(text,size=1){const bytes=encoder.encode(text);return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=size)c.enqueue(bytes.slice(i,i+size));c.close();}}),{headers:{'content-type':'text/event-stream'}});}
const progress=[];
const terminal=await readLocalAgentStream(response(': heartbeat\r\n\r\n'+event({type:'token',text:'Hé'}).replaceAll('\n','\r\n')+event({type:'token',text:'llo'})+event({type:'token',fullText:'Hello revised'})+event({type:'tool',action:'execute',proposal:{id:'untrusted'}})+event({type:'done',fullText:'Final',agentName:'Fixture'})),signal,text=>progress.push(text));
assert.deepEqual(progress,['Hé','Héllo','Hello revised']);assert.equal(terminal.text,'Final');assert.equal(terminal.proposals,undefined);
await assert.rejects(readLocalAgentStream(response(event({type:'token',text:'Partial'})),signal,()=>{}),/without a completed reply/);
await assert.rejects(readLocalAgentStream(response(event({type:'error',message:'untrusted provider secret'})),signal,()=>{}),error=>!error.message.includes('secret')&&error.message.includes('interrupted'));
await assert.rejects(readLocalAgentStream(response(event({type:'done',fullText:'not enough'})),signal,()=>{}),/Invalid terminal/);
await assert.rejects(readLocalAgentStream(response(event({type:'token',text:'x'.repeat(200001)}),4096),signal,()=>{}),/display limit/);
await assert.rejects(readLocalAgentStream(response('data: not-json\n\n'),signal,()=>{}));
let cancelled=false;
const aborted=new AbortController();const hanging=new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'text/event-stream'}});
const pending=readLocalAgentStream(hanging,aborted.signal,()=>{});aborted.abort();await assert.rejects(pending,error=>error.name==='AbortError');assert.equal(cancelled,true);

const directory=mkdtempSync(join(tmpdir(),'alpha-stream-')),tokenFile=join(directory,'token');writeFileSync(tokenFile,'a'.repeat(64),{mode:0o600});
let requests=0,mode='stream',finish;let disconnected;
const host=http.createServer(async(req,res)=>{
 let raw='';for await(const chunk of req)raw+=chunk;
 if(req.url.endsWith('/messages/stream')){
  requests++;assert.equal(req.headers.authorization,'Bearer fixture-token');assert.equal(req.headers['x-eliza-device-id'],'device');
  if(mode==='unauthorized'){res.writeHead(401);res.end('{}');return;}
  assert.equal(req.method,'POST');assert.equal(JSON.parse(raw).streamProtocol,'delta-v2');
  res.writeHead(200,{'content-type':'text/event-stream'});res.write(event({type:'token',text:'First'}));
  res.on('close',()=>disconnected?.());finish=()=>res.end(event({type:'done',fullText:'Final',agentName:'Fixture'}));return;
 }
 const data=req.url==='/api/auth/status'?{instanceId:'instance'}:req.url==='/api/auth/pair-code'?{code:'fixture'}:req.url==='/api/auth/pair'?{access:'owner',token:'fixture-token',identityId:'owner',instanceId:'instance'}:{identity:{id:'owner'},access:{role:'OWNER'},session:{id:'fixture-token',expiresAt:Date.now()+60000}};
 res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(data));
});
const listen=server=>new Promise(r=>server.listen(0,'127.0.0.1',r));await listen(host);
const proxy=http.createServer(createLocalAgentDevHandler({origin:`http://127.0.0.1:${host.address().port}`,tokenFile}));await listen(proxy);
const origin=`http://127.0.0.1:${proxy.address().port}`,input={path:'/api/conversations/thread/messages/stream',method:'POST',ownerId:'owner',stream:true,headers:{'X-Eliza-Device-Id':'device'},body:JSON.stringify({text:'Synthetic',streamProtocol:'delta-v2'})};
const invoke=(body=input,requestSignal)=>fetch(origin,{method:'POST',headers:{Origin:origin,'content-type':'application/json','X-Alpha-Local-Agent':'1'},body:JSON.stringify(body),signal:requestSignal});
try{
 const navigationInput={path:'/api/views/interact-claim',method:'POST',ownerId:'owner',body:JSON.stringify({requestId:'owned-handoff'})};
 assert.equal((await invoke(navigationInput)).status,200);
 assert.equal((await invoke({...navigationInput,ownerId:'wrong'})).status,409);
 assert.equal((await invoke({...navigationInput,ownerId:undefined})).status,400);
 for(const ownerId of ['', '  ', 42])assert.equal((await invoke({...navigationInput,ownerId})).status,400);
 assert.equal((await invoke({...navigationInput,method:'GET',body:undefined})).status,400);
 assert.equal((await invoke({...navigationInput,path:'/api/views/interact'})).status,400);
 assert.equal((await invoke({...input,ownerId:'wrong'})).status,409);assert.equal(requests,0);
 assert.equal((await invoke({...input,path:'/api/auth/me'})).status,400);
 assert.equal((await invoke({...input,stream:false})).status,400);
 const live=await invoke();let observed;
 const first=new Promise(resolve=>{observed=resolve;});let completed=false;
 const result=readLocalAgentStream(live,signal,text=>observed(text)).then(value=>{completed=true;return value;});
 assert.equal(await first,'First');assert.equal(completed,false,'Progress must arrive before terminal completion');finish();assert.equal((await result).text,'Final');assert.equal(requests,1);
 const stop=new AbortController();const closed=new Promise(resolve=>{disconnected=resolve;});const abortResponse=await invoke(input,stop.signal);
 const stopping=readLocalAgentStream(abortResponse,stop.signal,()=>stop.abort());await assert.rejects(stopping);await Promise.race([closed,new Promise((_,reject)=>setTimeout(()=>reject(Error('Upstream socket did not close')),2000))]);
 mode='unauthorized';assert.equal((await invoke()).status,401);assert.equal(requests,3,'Failed streams are not replayed');
}finally{proxy.closeAllConnections();host.closeAllConnections();await Promise.all([new Promise(r=>proxy.close(r)),new Promise(r=>host.close(r))]);rmSync(directory,{recursive:true,force:true});}

const client=new AlphaClient();let late,resolveSend;const values=[];
client.attachVerifiedTransport({session:{ownerId:'owner',agentId:'agent',sessionId:'session',origin:'https://agent.example'},send:async({onText})=>{late=onText;onText('Progress');return {text:'Final'};},execute:async()=>{throw Error('No action');}});
await client.send('Hello',text=>values.push(text));late('Late');assert.deepEqual(values,['Progress']);
client.disconnect();client.attachVerifiedTransport({session:{ownerId:'owner',agentId:'agent',sessionId:'new',origin:'https://agent.example'},send:({onText})=>{late=onText;return new Promise(r=>{resolveSend=r;});},execute:async()=>{throw Error('No action');}});
const stale=client.send('Cancel',text=>values.push(text));client.cancel();late('Stale');resolveSend({text:'Too late'});await assert.rejects(stale);assert.deepEqual(values,['Progress']);
console.log('Streaming framing, progress, terminal validation, interruption, owner binding, no replay, upstream cancellation and stale callback checks passed.');

// Navigation is carried only by the authenticated terminal result; status/tool
// frames and prose are never instructions to switch views or approve effects.
const handoff={actionName:'VIEWS',success:true,values:{mode:'show',viewId:'notes',navigationPrepared:true,completedActionHandoffId:'owned-handoff'}};
const navWire=await readLocalAgentStream(response(event({type:'tool',actionResults:[{...handoff,values:{...handoff.values,viewId:'wallet'}}]})+event({type:'done',fullText:'Opening Notes.',agentName:'Fixture',actionResults:[handoff]})),signal,()=>{});
assert.deepEqual(navWire.actionResults,[handoff]);
const navigationClient=new AlphaClient();let automaticEffects=0;
navigationClient.attachVerifiedTransport({session:{ownerId:'owner',agentId:'agent',sessionId:'navigation-session',origin:'https://agent.example'},send:async()=>({text:navWire.text,actionResults:navWire.actionResults}),execute:async()=>{automaticEffects++;throw Error('Navigation must not auto-approve device actions');}});
const navigationReply=await navigationClient.send('Open Notes');assert.deepEqual(navigationReply.actionResults,[handoff]);assert.equal(automaticEffects,0);
console.log('PASS terminal navigation metadata survives the existing stream/client boundary without executing device approvals.');
