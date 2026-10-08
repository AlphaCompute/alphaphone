import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {createLocalAgentDevHandler} from './local-agent-dev-bridge.ts';
import {readLocalAgentStream} from '../apps/app/src/runtime/local-agent-stream.ts';
import {AlphaClient} from '../apps/app/src/runtime/alpha-client.ts';
import {LocalAgentProtocol} from '../apps/app/src/runtime/local-agent.ts';
import {RemoteProtocol} from '../apps/app/src/runtime/remote-protocol.ts';
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

// Dropped stream: exactly one non-streaming read of the persisted reply under the same clientMessageId.
{
 const posts=[];let mode='drop';
 const bridge={start:async()=>({}),request:async input=>{posts.push(JSON.parse(input.body));return {status:200,body:JSON.stringify({text:'Persisted reply',agentName:'Fixture'})};},
  stream:async(_input,signal,onText)=>{onText('Partial');if(mode==='hold')await new Promise((_,reject)=>{if(signal.aborted)reject(signal.reason);else signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});if(mode==='status')throw Object.assign(Error('Local agent request failed (HTTP 409).'),{status:409});throw Error('Response interrupted. Outcome unknown; check history before retrying.');}};
 const local=new LocalAgentProtocol(bridge);local.session={ownerId:'owner',agentId:'agent',sessionId:'session',origin:'https://device.alpha.invalid'};
 const shown=[];
 const reply=await local.send('thread','Hello',{clientMessageId:'client-1',metadata:{a:1},onText:text=>shown.push(text)});
 assert.equal(reply.text,'Persisted reply');assert.deepEqual(shown,['Partial']);
 assert.equal(posts.length,1,'one persisted-reply read after a dropped stream');assert.equal(local.recoveries,1);
 assert.deepEqual(posts[0],{text:'Hello',channelType:'DM',metadata:{a:1},clientMessageId:'client-1'},'identical idempotent request without the stream protocol');
 await assert.rejects(local.send('thread','No key',{onText:()=>{}}));assert.equal(posts.length,1,'no recovery without a clientMessageId');
 mode='status';await assert.rejects(local.send('thread','Refused',{clientMessageId:'client-2',onText:()=>{}}));assert.equal(posts.length,1,'a refused request is not repeated');
 mode='hold';const stop=new AbortController();const stopped=local.send('thread','Stop me',{clientMessageId:'client-3',signal:stop.signal,onText:()=>stop.abort()});
 await assert.rejects(stopped,error=>error.name==='AbortError');assert.equal(posts.length,1,'Stop never reads or repeats the turn');
}
// Remote: a transport drop repeats the identical request once; HTTP failures and Stop are not repeated.
{
 const saved={origin:'https://agent.example',token:'session-token',identityId:'owner',sessionId:'session-token',expiresAt:Date.now()+60000};
 const posts=[];let failures=1,status=200;
 const requester=async input=>{
  const path=new URL(input.url).pathname;
  if(path==='/api/auth/me')return {status:200,body:{identity:{id:'owner',kind:'owner',displayName:'Owner'},session:{id:'session-token',kind:'machine',expiresAt:Date.now()+60000},access:{role:'OWNER',mode:'session'}}};
  if(input.method==='POST'){posts.push(input.body);if(failures-->0)throw Error('socket hang up');return {status,body:{text:'Durable reply',agentName:'Fixture'}};}
  return {status:404,body:{}};
 };
 const remote=new RemoteProtocol('https://agent.example',requester,{read:async()=>saved,write:async()=>{},remove:async()=>{}});
 await remote.restore();
 assert.equal((await remote.send('thread','Hi',{clientMessageId:'remote-1'})).text,'Durable reply');
 assert.equal(posts.length,2);assert.equal(posts[0],posts[1],'the replay is byte-identical');
 failures=1;await assert.rejects(remote.send('thread','No key'));assert.equal(posts.length,3,'no replay without a clientMessageId');
 failures=0;status=500;await assert.rejects(remote.send('thread','Server error',{clientMessageId:'remote-2'}));assert.equal(posts.length,4,'a server error is not repeated');
 const stop=new AbortController();stop.abort();await assert.rejects(remote.send('thread','Stopped',{clientMessageId:'remote-3',signal:stop.signal}));assert.equal(posts.length,4);
}
console.log('Streaming framing, progress, terminal validation, interruption, owner binding, no replay, upstream cancellation, stale callback, single persisted-reply recovery after a dropped stream and no Stop replay checks passed.');
