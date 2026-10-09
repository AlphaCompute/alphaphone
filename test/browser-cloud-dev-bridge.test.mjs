import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
if(!process.execArgv.some((arg,i)=>arg==='--import'&&process.execArgv[i+1]==='tsx')){const child=spawnSync(process.execPath,['--import','tsx',process.argv[1]],{stdio:'inherit',timeout:60000});if(child.error)throw child.error;process.exit(child.status??1);}
const {createBrowserCloudDevHandler}=await import('../scripts/browser-cloud-dev-bridge.ts');
const {CloudProtocol}=await import('../apps/app/src/runtime/cloud-protocol.ts');
const {BrowserCloudConnection}=await import('../apps/app/src/browser/cloud-connection.ts');
const owner='11111111-1111-4111-8111-111111111111',org='22222222-2222-4222-8222-222222222222',credentialId='33333333-3333-4333-8333-333333333333',reference='browser-cloud-reference:44444444-4444-4444-8444-444444444444';
const secret='synthetic-cloud-credential-not-a-real-key';
async function fixture(){
 const profile=await mkdtemp(join(tmpdir(),'alpha-browser-cloud-')),file=join(profile,'existing-secret');await writeFile(file,secret,{mode:0o600});
 const seed={environment:'production',credentialFile:file,credentialSha256:createHash('sha256').update(secret).digest('hex'),userId:owner,organizationId:org,credentialReference:reference,credentialId};await writeFile(join(profile,'initial-credential.json'),JSON.stringify(seed),{mode:0o600});
 const calls=[];let response=async()=>new Response('{}');const session=randomUUID();
 const request=async(url,input={})=>{
  const path=new URL(url).pathname;calls.push({url,input});
  if(path==='/api/auth/cli-session')return Response.json({sessionId:session,expiresAt:new Date(Date.now()+60000).toISOString()});
  if(path==='/api/auth/cli-session/'+session)return Response.json({status:'authenticated',apiKey:secret});
  assert.equal(new Headers(input.headers).get('Authorization'),'Bearer '+secret);
  if(path==='/api/v1/user')return Response.json({success:true,data:{id:owner,organization_id:org,email:'owned@example.invalid'}});
  if(path==='/api/v1/credits/balance')return Response.json({balance:4});
  return response(url,input);
 };
 let server,origin;
 const start=async()=>{server=createServer(createBrowserCloudDevHandler({profile,request}));await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;};await start();
 const send=(data,options={})=>fetch(origin,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Alpha-Browser-Cloud':'1',...(options.headers||{})},body:JSON.stringify(data),signal:options.signal});
 const rpc=async data=>{const r=await send(data);return {status:r.status,data:await r.json()};};
 return {profile,file,calls,send,rpc,setResponse:fn=>{response=fn;},origin:()=>origin,session,restart:async()=>{await new Promise(r=>server.close(r));await start();},close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}};
}
test('existing Mac credential becomes a real canonical identity/credit reference, never a browser bearer',async()=>{
 const f=await fixture();try{
  const stored=await f.rpc({operation:'secureRead',slot:'cloud:production'});assert.equal(stored.status,200);assert.equal(stored.data.value.includes(secret),false);const credential=JSON.parse(stored.data.value);assert.equal(credential.credentialReference,reference);assert.equal(credential.credentialId,credentialId);assert.equal(credential.token,undefined);
  const result=await f.rpc({operation:'request',environment:'production',requestId:randomUUID(),input:{url:'https://api.eliza.app/api/v1/user',method:'GET',headers:{Accept:'application/json'},credentialReference:reference}});assert.equal(result.data.status,200);assert.equal(result.data.data.data.id,owner);assert.equal(result.data.data.data.organization_id,org);
  const balance=await f.rpc({operation:'request',environment:'production',requestId:randomUUID(),input:{url:'https://api.eliza.app/api/v1/credits/balance',method:'GET',headers:{Accept:'application/json'},credentialReference:reference}});assert.equal(balance.data.data.balance,4);assert.equal((await stat(f.profile)).mode&0o077,0);
 }finally{await f.close();}
});
test('negative origins, methods, authorities, routes, private bearer headers and wrong reference never dispatch',async()=>{
 const f=await fixture();try{
  const before=f.calls.length;assert.equal((await f.send({operation:'secureRead',slot:'cloud:production'},{headers:{Origin:'https://other.invalid'}})).status,403);
  for(const input of [{url:'https://other.invalid/api/v1/user',method:'GET'},{url:'https://api.eliza.app/api/v1/user',method:'PUT'},{url:'https://api.eliza.app/api/v1/api-keys',method:'POST'},{url:'https://api.eliza.app/api/v1/user?other=1',method:'GET'},{url:'https://api.eliza.app/api/v1/user',method:'GET',credentialReference:'browser-cloud-reference:'+randomUUID()},{url:'https://api.eliza.app/api/v1/user',method:'GET',headers:{Authorization:'Bearer '+secret}}]){
   const r=await f.rpc({operation:'request',environment:'production',requestId:randomUUID(),input:{headers:{Accept:'application/json'},credentialReference:reference,...input}});assert.ok([400,409].includes(r.status));
  }
  assert.equal(f.calls.length,before);
 }finally{await f.close();}
});
test('normal canonical CLI poll claims stay server-private and commit by reference with atomic account generation',async()=>{
 const f=await fixture();try{
  const account=new BrowserCloudConnection(),original=globalThis.fetch;globalThis.fetch=(url,options={})=>original(f.origin(),{...options,headers:{...options.headers,Origin:f.origin()}});
  try{
   const old=await account.secureRead({slot:'cloud:production'});assert.equal(JSON.parse(old.value).credentialReference,reference);
   const store={acceptsReferences:true,read:async()=>{const r=await account.secureRead({slot:'cloud:production'});return r.value?JSON.parse(r.value):null;},write:async(_env,value)=>account.secureWrite({slot:'cloud:production',value:JSON.stringify({...value,credentialId:randomUUID()})}),clear:async()=>account.secureRemove({slot:'cloud:production'})};
   const client=new CloudProtocol('production',input=>account.request({...input,requestId:randomUUID(),body:input.body===undefined?undefined:JSON.stringify(input.body)}),store,async()=>{});
   await client.login(new AbortController().signal);const credential=await store.read();assert.equal(credential.token,undefined);assert.match(credential.credentialReference,/^browser-cloud-reference:/);assert.notEqual(credential.credentialReference,reference);assert.deepEqual(await client.identity(new AbortController().signal),{userId:owner,organizationId:org,email:'owned@example.invalid'});
   assert.equal(JSON.stringify(credential).includes(secret),false);const privateState=JSON.parse(await readFile(join(f.profile,'credentials.json'),'utf8'));assert.equal(privateState.production.token,secret);assert.equal((await stat(join(f.profile,'credentials.json'))).mode&0o077,0);
   await client.disconnect();await f.restart();assert.equal((await f.rpc({operation:'secureRead',slot:'cloud:production'})).data.value,null);
  }finally{globalThis.fetch=original;}
 }finally{await f.close();}
});
test('Cloud STT uses multipart canonical audio route, TTS uses canonical JSON; no local speech route exists',async()=>{
 const f=await fixture();try{
  f.setResponse(async(url,input)=>{if(url.endsWith('/voice/stt')){assert.ok(input.body instanceof FormData);assert.equal(input.body.get('audio').type,'audio/webm');return Response.json({transcript:'Synthetic fixture transcript'});}assert.equal(url,'https://api.eliza.app/api/v1/voice/tts');assert.deepEqual(JSON.parse(input.body),{text:'Synthetic fixture text',format:'mp3'});return new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'audio/mpeg'}});});
  const form=new FormData();for(const [k,v]of Object.entries({operation:'stt',environment:'production',credentialReference:reference,credentialId,requestId:randomUUID()}))form.append(k,v);form.append('audio',new Blob(['synthetic closed fixture'],{type:'audio/webm'}),'fixture.webm');
  const response=await fetch(f.origin(),{method:'POST',headers:{Origin:f.origin(),'X-Alpha-Browser-Cloud':'1'},body:form});assert.equal(response.status,200);assert.deepEqual(await response.json(),{text:'Synthetic fixture transcript',local:false});
  const tts=await f.send({operation:'tts',environment:'production',credentialReference:reference,credentialId,requestId:randomUUID(),text:'Synthetic fixture text'});assert.equal(tts.status,200);assert.equal(tts.headers.get('Content-Type'),'audio/mpeg');assert.equal((await tts.arrayBuffer()).byteLength,3);assert.equal(f.calls.filter(x=>x.url.includes('voice')).length,2);assert.ok(f.calls.every(x=>!x.url.includes('whisper')&&!x.url.includes('kokoro')));
 }finally{await f.close();}
});
test('wrong account, logout and server restart invalidate old references without deleting another account',async()=>{
 const f=await fixture();try{
  const wrong=await f.rpc({operation:'tts',environment:'production',credentialReference:reference,credentialId:randomUUID(),requestId:randomUUID(),text:'Synthetic'});assert.equal(wrong.status,409);assert.equal(f.calls.length,0);
  const stale=await f.rpc({operation:'secureRemove',slot:'cloud:production',previousReference:'browser-cloud-reference:'+randomUUID()});assert.equal(stale.status,400);assert.notEqual((await f.rpc({operation:'secureRead',slot:'cloud:production'})).data.value,null);
  assert.equal((await f.rpc({operation:'secureRemove',slot:'cloud:production',previousReference:reference})).status,200);await f.restart();assert.equal((await f.rpc({operation:'secureRead',slot:'cloud:production'})).data.value,null);
  assert.equal((await f.rpc({operation:'tts',environment:'production',credentialReference:reference,credentialId,requestId:randomUUID(),text:'Synthetic'})).status,401);
 }finally{await f.close();}
});
test('cancel closes an in-flight Cloud audio stream; stale account audio cannot be returned',async()=>{
 const f=await fixture();try{
  const entered=Promise.withResolvers(),cancelled=Promise.withResolvers();f.setResponse(async(_url,input)=>{entered.resolve();input.signal.addEventListener('abort',()=>cancelled.resolve(),{once:true});return new Response(new ReadableStream({start(c){input.signal.addEventListener('abort',()=>c.error(new DOMException('Cancelled','AbortError')),{once:true});c.enqueue(new Uint8Array([1]));}}),{headers:{'Content-Type':'audio/mpeg'}});});
  const id=randomUUID(),pending=f.send({operation:'tts',environment:'production',credentialReference:reference,credentialId,requestId:id,text:'Synthetic'});await entered.promise;await f.rpc({operation:'cancel',requestId:id});await cancelled.promise;const r=await pending;assert.equal(r.status,409);assert.equal((await r.json()).error,'Cloud operation cancelled');
 }finally{await f.close();}
});

test('native production Cloud stores never admit a development reference as a bearer',async()=>{
 let writes=0;const id=randomUUID(),client=new CloudProtocol('production',async input=>({status:200,data:input.url.endsWith('/api/auth/cli-session')?{sessionId:id,expiresAt:new Date(Date.now()+60000).toISOString()}:{status:'authenticated',credentialReference:reference}}),{read:async()=>null,write:async()=>{writes++;},clear:async()=>{}},async()=>{});
 await assert.rejects(client.login(new AbortController().signal),e=>e.code==='credential-consumed');assert.equal(writes,0);
});
