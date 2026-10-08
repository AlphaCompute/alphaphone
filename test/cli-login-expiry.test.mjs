import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
if(!process.execArgv.includes('--experimental-transform-types')){const child=spawnSync(process.execPath,['--experimental-transform-types',process.argv[1]],{stdio:'inherit'});process.exit(child.status??1);}
const {CloudProtocol}=await import('../apps/app/src/runtime/cloud-protocol.ts');
const session='72475cd0-e135-4c42-a9e2-fb5fe0820ada';
for(const phase of ['browser','response','save'])test(`wall-clock expiry at ${phase} refuses late claim/persistence even with paused timers`,async()=>{
 const originalNow=Date.now;let now=originalNow(),polls=0,writes=0;const expires=now+60000;
 Date.now=()=>now;
 const client=new CloudProtocol('production',async input=>{
  if(input.method==='POST')return {status:200,data:{sessionId:session,expiresAt:new Date(expires).toISOString()}};
  polls++;assert.equal(input.expiresAt,expires);
  if(phase==='response')now=expires;
  const data={status:'authenticated',apiKey:'synthetic-test-key'};
  if(phase==='save')Object.defineProperty(data,'userId',{get(){now=expires;return 'synthetic-owner';}});
  return {status:200,data};
 },{read:async()=>null,write:async()=>{writes++;},clear:async()=>{}},async()=>{if(phase==='browser')now=expires;});
 try{await assert.rejects(client.login(new AbortController().signal),error=>error.code==='expired');assert.equal(polls,phase==='browser'?0:1);assert.equal(writes,0);}finally{Date.now=originalNow;}
});
