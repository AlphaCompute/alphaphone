import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import http from 'node:http';
import {createLocalAgentDevHandler} from './local-agent-dev-bridge.ts';
const directory=mkdtempSync(join(tmpdir(),'alpha-tts-bridge-')),tokenFile=join(directory,'token'),root='a'.repeat(64),token='synthetic-owner-token';writeFileSync(tokenFile,root,{mode:0o600});
const wav=Buffer.alloc(46);wav.write('RIFF');wav.writeUInt32LE(38,4);wav.write('WAVE',8);
let calls=0,mode='ok',closed;const disconnected=new Promise(resolve=>{closed=resolve;});
const host=http.createServer(async(req,res)=>{
 const chunks=[];for await(const chunk of req)chunks.push(chunk);const raw=Buffer.concat(chunks).toString();let value;
 if(req.url==='/api/auth/status')value={instanceId:'instance'};
 else if(req.url==='/api/auth/pair-code')value={code:'fixture'};
 else if(req.url==='/api/auth/pair')value={token,instanceId:'instance',identityId:'owner',access:'owner'};
 else if(req.url==='/api/auth/me')value={identity:{id:'owner'},access:{role:'OWNER'},session:{id:token,expiresAt:Date.now()+60000}};
 else{
  calls++;assert.equal(req.headers.authorization,`Bearer ${token}`);
  if(req.url.endsWith('/status')){assert.equal(req.method,'GET');value={ready:true,provider:'standalone-kokoro'};}
  else{
   assert.equal(req.method,'POST');assert.equal(req.headers['content-type'],'application/json');assert.deepEqual(JSON.parse(raw),{text:'Synthetic speech'});
   if(mode==='held'){res.on('close',closed);return;}
   res.writeHead(200,{'Content-Type':mode==='type'?'text/plain':'audio/wav','X-Request-Id':mode==='id'?randomUUID():req.headers['x-request-id'],'X-Eliza-Speech-Provider':mode==='provider'?'other':'standalone-kokoro'});
   res.end(mode==='oversized'?Buffer.alloc(1440045):mode==='invalid'?Buffer.from('invalid WAV'):wav);return;
  }
 }
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));
});
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));await listen(host);
const proxy=http.createServer(createLocalAgentDevHandler({origin:`http://127.0.0.1:${host.address().port}`,tokenFile}));await listen(proxy);const origin=`http://127.0.0.1:${proxy.address().port}`;
const invoke=(input,signal)=>fetch(origin,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Alpha-Local-Agent':'1'},body:JSON.stringify(input),signal});
const input={path:'/api/tts/kokoro',method:'POST',ownerId:'owner',requestId:randomUUID(),body:JSON.stringify({text:'Synthetic speech'})};
try{
 const response=await invoke(input);assert.equal(response.status,200);const envelope=await response.json();assert.equal(envelope.status,200);const result=JSON.parse(envelope.body);assert.deepEqual(Buffer.from(result.audioBase64,'base64'),wav);assert.equal(result.requestId,input.requestId);assert.equal(result.provider,'standalone-kokoro');assert.ok(!JSON.stringify(envelope).includes(token));
 assert.equal((await invoke({path:'/api/tts/kokoro/status',method:'GET',ownerId:'owner'})).status,200);
 const before=calls;
 for(const patch of [{ownerId:undefined},{requestId:'bad'},{method:'GET'},{body:'{'},{body:JSON.stringify({text:'x'.repeat(501)})},{body:JSON.stringify({text:'Synthetic speech',voice:'other'})},{audioBase64:'AAAA'},{stream:true},{path:'/api/tts/kokoro/other'}])assert.equal((await invoke({...input,...patch})).status,400);
 assert.equal((await invoke({...input,ownerId:'other-owner'})).status,409);assert.equal(calls,before);
 for(const bad of ['id','type','provider','invalid','oversized']){mode=bad;const result=await invoke(input);assert.equal(result.status,bad==='oversized'?503:502,bad);assert.ok(!(await result.text()).includes('audioBase64'));}
 mode='held';const controller=new AbortController(),prior=calls,pending=invoke(input,controller.signal);
 for(let i=0;i<300&&calls===prior;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(calls,prior+1);controller.abort();await assert.rejects(pending,error=>error.name==='AbortError');await Promise.race([disconnected,new Promise((_,reject)=>setTimeout(()=>reject(Error('Upstream synthesis was not cancelled')),3000).unref())]);
 console.log('TTS bridge: exact audio, session ownership, validation, output bounds and cancellation passed');
}finally{proxy.closeAllConnections();host.closeAllConnections();await Promise.all([new Promise(resolve=>proxy.close(resolve)),new Promise(resolve=>host.close(resolve))]);rmSync(directory,{recursive:true,force:true});}
