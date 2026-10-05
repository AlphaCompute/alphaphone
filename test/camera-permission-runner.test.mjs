import test from 'node:test';
import assert from 'node:assert/strict';
import {exercise} from './fixtures/isolated-native-campaign.mjs';
const run=mode=>exercise(mode,'camera');
test('camera campaign owns its APKs and user and scopes permission changes to that user',()=>{
 const r=run('pass');assert.equal(r.code,0,r.stderr);assert.equal(r.record.passed,true);assert.equal(r.record.userLifecycle.removed,true);assert.equal(r.state.created,false);assert.equal(r.state.user,'0');
 assert.deepEqual(r.record.result.variants[0].instrumentation.cases,['ai.elizaresearch.alphaphone.CameraFlowInstrumentedTest#denyingCameraAllowsExplicitRetryWithoutFakePreview']);
 assert.equal(r.commands.filter(a=>a[0]==='uninstall').length,2);
 const permissions=r.commands.filter(a=>a.includes('revoke')||a.includes('clear-permission-flags'));assert.equal(permissions.length,2);assert.ok(permissions.every(a=>a[a.indexOf('--user')+1]==='10'));
});
for(const mode of ['summary-only','missing-start','wrong-class','wrong-method','wrong-terminal','duplicate','skipped'])test(`camera campaign rejects ${mode} and removes its completed fixture`,()=>{
 const r=run(mode);assert.notEqual(r.code,0);assert.equal(r.record.passed,false);assert.equal(r.state.created,false);assert.equal(r.state.user,'0');assert.match(r.log,/OK \(1 test\)/);
});
test('camera transport failure stops owned packages before cleanup',()=>{
 const r=run('timeout');assert.notEqual(r.code,0);assert.equal(r.commands.filter(a=>a.includes('force-stop')).length,2);assert.equal(r.commands.filter(a=>a[0]==='uninstall').length,2);assert.equal(r.state.created,false);
});
test('camera uncertain termination retains the fixture user and packages',()=>{
 const r=run('stop-failure');assert.notEqual(r.code,0);assert.equal(r.record.userLifecycle.cleanupDeferred,true);assert.equal(r.state.created,true);assert.equal(r.state.user,'0');assert.equal(r.commands.filter(a=>a[0]==='uninstall').length,0);
});
test('camera refuses unowned package registration before installing or creating a user',()=>{
 const r=run('existing');assert.notEqual(r.code,0);assert.equal(r.record.passed,false);assert.ok(!r.commands.some(a=>a[0]==='install'||a.includes('create-user')));
});
test('camera admits only the exact archived app and instrumentation bytes',()=>{
 const r=run('archive-pin');assert.notEqual(r.code,0);assert.equal(r.record,null);assert.match(r.stderr,/Exact matching archived distribution/);assert.equal(r.commands.length,0);
});
