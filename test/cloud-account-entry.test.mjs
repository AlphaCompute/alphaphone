import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('actual account close preserves native onboarding and active sessions',()=>{
 const source=fs.readFileSync('apps/app/src/runtime/connection-ui.tsx','utf8'),start=source.indexOf('  close() {'),end=source.indexOf('\n  cancel()',start);assert.ok(start>0&&end>start);
 for(const native of [true,false])for(const connected of [true,false]){
  const session=connected?{sessionId:'retained-session'}:null,history={messages:['retained']},state={purpose:'cloud-account',open:true,busy:false,session,history};let cleared=0;
  const sandbox={localAppsSelected:()=>false,state,isAndroid:native,testMocksEnabled:false,update:patch=>Object.assign(state,patch),clearPersonalSetup:()=>cleared++};vm.runInNewContext('globalThis.controller={'+source.slice(start,end)+'}',sandbox);sandbox.controller.close();
  assert.equal(state.session,session);assert.equal(state.history,history);assert.equal(cleared,0);assert.equal(state.purpose,'agent');assert.equal(state.open,native&&!connected);
 }
});
