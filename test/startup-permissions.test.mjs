import {test} from 'node:test';
import assert from 'node:assert/strict';
const {createStartupPermissionFlow} = await import('../apps/app/src/startup-permission-flow.ts');
function fixture(access) {
  const calls = [];
  const bridge = {status: async () => {calls.push('status'); return access;}, request: async () => calls.push('request'), openSettings: async () => calls.push('settings')};
  return {flow:createStartupPermissionFlow(bridge), calls, bridge};
}
test('startup checks never request or open settings, and granted access needs no prompt', async () => {
  const {flow,calls} = fixture({granted:true,enabled:true});
  assert.equal(await flow.refresh(),'ready'); assert.deepEqual(calls,['status']);
  assert.equal(await flow.enable(),'ready'); assert.ok(!calls.includes('request'));
});
test('denial transitions to settings and refresh never repeats the OS prompt', async () => {
  const {flow,calls} = fixture({granted:false,enabled:false});
  assert.equal(await flow.refresh(),'request'); assert.equal(await flow.enable(),'settings');
  await flow.refresh(); await flow.enable();
  assert.equal(calls.filter(x=>x==='request').length,1); assert.equal(calls.filter(x=>x==='settings').length,1);
});
test('app-level block uses settings even with granted runtime permission',async()=>{
 const {flow,calls}=fixture({granted:true,enabled:false});
 assert.equal(await flow.refresh(),'settings'); await flow.enable(); assert.ok(!calls.includes('request')); assert.ok(calls.includes('settings'));
});
test('unavailable and malformed status cannot trigger a permission request',async()=>{
 for(const access of [{}, {granted:'true',enabled:true}]) {
  const {flow,calls}=fixture(access); assert.equal(await flow.enable(),'unavailable'); assert.deepEqual(calls,['status','status']);
 }
});
test('double taps do not issue overlapping prompts and grant is read back', async()=>{
 let resolve; const access={granted:false,enabled:false}; const {flow,bridge,calls}=fixture(access);
 bridge.request=async()=>{calls.push('request');await new Promise(r=>resolve=r);access.granted=access.enabled=true;};
 const first=flow.enable(); await new Promise(r=>setImmediate(r)); await flow.enable(); resolve();
 assert.equal(await first,'ready');assert.equal(calls.filter(x=>x==='request').length,1);
});
test('microphone denial is independent from notification grant and never retries automatically',async()=>{
 const mic=fixture({granted:false,enabled:false}), notices=fixture({granted:true,enabled:true});
 assert.equal(await notices.flow.refresh(),'ready'); assert.equal(await mic.flow.enable(),'settings');
 await mic.flow.refresh(); await notices.flow.refresh();
 assert.equal(mic.calls.filter(x=>x==='request').length,1); assert.ok(!notices.calls.includes('request'));
});
test('unavailable notifications do not prevent a microphone grant',async()=>{
 const mic=fixture({granted:false,enabled:false}), notices=fixture({});
 mic.bridge.request=async()=>{mic.calls.push('request');mic.bridge.status=async()=>({granted:true,enabled:true});};
 assert.equal(await notices.flow.refresh(),'unavailable'); assert.equal(await mic.flow.enable(),'ready');
 assert.deepEqual(mic.calls,['status','request']);
});
test('startup microphone bridge uses permission APIs and contains no recording call',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../apps/app/src/startup-permissions.tsx',import.meta.url),'utf8');
 assert.match(source,/microphone\.checkPermissions\(\)/);
 assert.match(source,/microphone\.requestPermissions\(\{permissions: \['microphone'\]\}\)/);
 assert.doesNotMatch(source,/\.(startRecording|startCapture|record|capture|startListening)\(/);
});
