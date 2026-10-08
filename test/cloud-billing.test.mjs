// In-memory protocol exercise. No network, billing, login session or native store is used.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
if (!process.execArgv.includes('--experimental-transform-types')) {
  const child=spawnSync(process.execPath,['--experimental-transform-types',process.argv[1]],{stdio:'inherit'});
  process.exit(child.status??1);
}
const {CloudProtocol,CloudProtocolError}=await import('../apps/app/src/runtime/cloud-protocol.ts');
function fixture(environment='production') {
 let credential={credentialId:'login-one',token:'synthetic-token',expiresAt:Date.now()+60000};
 const requests=[],opened=[];let respond=async()=>({status:200,data:{balance:3.5}});
 const store={read:async()=>credential,write:async(_env,value)=>{credential=value;},clear:async()=>{credential=null;}};
 const client=new CloudProtocol(environment,async request=>{requests.push(request);return respond(request);},store,async url=>{opened.push(url);});
 return {client,requests,opened,setCredential:value=>{credential=value;},respond:value=>{respond=value;}};
}
test('balance uses only the existing authenticated credits route and binds its login',async()=>{
 const f=fixture();assert.deepEqual(await f.client.creditBalance(new AbortController().signal),{balance:3.5,credentialId:'login-one'});
 assert.equal(f.requests.length,1);const r=f.requests[0];assert.equal(r.url,'https://api.eliza.app/api/v1/credits/balance');assert.equal(r.method,'GET');assert.equal(r.headers.Authorization,'Bearer synthetic-token');assert.equal(r.redirect,'error');assert.equal(r.body,undefined);
});
test('zero, debt and numeric-string balances stay distinct from unavailable status',async()=>{
 for(const balance of [0,-1,'0','2.75']){const f=fixture();f.respond(async()=>({status:200,data:{balance}}));assert.equal((await f.client.creditBalance(new AbortController().signal)).balance,Number(balance));}
});
test('missing, malformed and nonfinite balances fail closed',async()=>{
 for(const balance of [undefined,null,'',' ',true,{},[],NaN,Infinity,'Infinity','invalid']){const f=fixture();f.respond(async()=>({status:200,data:{balance}}));await assert.rejects(f.client.creditBalance(new AbortController().signal),e=>e instanceof CloudProtocolError&&e.code==='invalid-response');}
});
test('auth, exhausted-credit and server failures are not converted to zero',async()=>{
 for(const status of [401,403,402,503]){const f=fixture();f.respond(async()=>({status,data:{balance:0}}));await assert.rejects(f.client.creditBalance(new AbortController().signal),e=>e.code==='http'&&e.status===status);}
 const f=fixture();f.respond(async()=>{throw Error('synthetic offline');});await assert.rejects(f.client.creditBalance(new AbortController().signal),/synthetic offline/);
});
test('account replacement or logout during a response cannot return positive credit',async()=>{
 for(const next of [null,{credentialId:'login-two',token:'other-synthetic-token'}]){const f=fixture();f.respond(async()=>{f.setCredential(next);return {status:200,data:{balance:100}};});await assert.rejects(f.client.creditBalance(new AbortController().signal),e=>e.code==='account-changed');}
});
test('expiry and cancellation during a response cannot unlock credit',async()=>{
 const f=fixture();f.respond(async()=>{f.setCredential({credentialId:'login-one',token:'synthetic-token',expiresAt:Date.now()-1});return {status:200,data:{balance:100}};});await assert.rejects(f.client.creditBalance(new AbortController().signal),e=>e.code==='expired');
 const cancelled=fixture(),controller=new AbortController();cancelled.respond(async()=>{controller.abort();return {status:200,data:{balance:100}};});await assert.rejects(cancelled.client.creditBalance(controller.signal),e=>e.name==='AbortError');
});
test('missing credentials and pre-cancellation issue no requests',async()=>{
 const f=fixture();f.setCredential(null);await assert.rejects(f.client.creditBalance(new AbortController().signal),e=>e.code==='credentials-missing');assert.equal(f.requests.length,0);
 const controller=new AbortController();controller.abort();await assert.rejects(f.client.creditBalance(controller.signal),e=>e.name==='AbortError');assert.equal(f.requests.length,0);
});
test('top-up opens only the existing environment-specific hosted page without a credential',async()=>{
 for(const [environment,url] of [['production','https://cloud.eliza.app/cloud/billing'],['staging','https://cloud-staging.eliza.app/cloud/billing']]){const f=fixture(environment);f.setCredential(null);await f.client.openTopUp(new AbortController().signal);assert.deepEqual(f.opened,[url]);assert.equal(f.requests.length,0);}
 const f=fixture(),controller=new AbortController();controller.abort();await assert.rejects(f.client.openTopUp(controller.signal),e=>e.name==='AbortError');assert.deepEqual(f.opened,[]);
});
