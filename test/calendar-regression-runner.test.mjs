import test from 'node:test';
import assert from 'node:assert/strict';
import {exercise} from './fixtures/isolated-native-campaign.mjs';
test('Calendar runner records complete raw evidence and cleans only its fixture installation',()=>{
 const r=exercise('pass');assert.equal(r.code,0,r.stderr);assert.equal(r.record.passed,true);assert.equal(r.record.result.variants[0].instrumentation.totalTests,1);assert.ok(r.commands.find(a=>a.includes('instrument')).includes('-r'));assert.equal(r.commands.filter(a=>a[0]==='uninstall').length,2);assert.equal(r.state.created,false);assert.equal(r.state.user,'0');
});
for(const mode of ['summary-only','missing-start','wrong-class','wrong-terminal','duplicate','skipped'])test(`Calendar runner rejects ${mode} evidence`,()=>{const r=exercise(mode);assert.notEqual(r.code,0);assert.equal(r.record.passed,false);assert.ok(r.log.includes('OK (1 test)'));});
test('Calendar transport failure requires stopping both owned packages before cleanup',()=>{
 const r=exercise('timeout');assert.notEqual(r.code,0);assert.match(r.log,/fixture transport/);assert.equal(r.commands.filter(a=>a.includes('force-stop')).length,2);assert.equal(r.commands.filter(a=>a[0]==='uninstall').length,2);assert.equal(r.state.created,false);
});
test('Calendar runner retains packages and user when termination is uncertain',()=>{
 const r=exercise('stop-failure');assert.notEqual(r.code,0);assert.equal(r.commands.filter(a=>a[0]==='uninstall').length,0);assert.equal(r.record.userLifecycle.cleanupDeferred,true);assert.equal(r.state.created,true);assert.equal(r.state.user,'0');
});
test('Calendar runner refuses existing packages before creating a user',()=>{const r=exercise('existing');assert.notEqual(r.code,0);assert.ok(!r.commands.some(a=>a.includes('create-user')||a[0]==='install'));});

test('Calendar external editor rejects an APK that differs from the product pin',()=>{const r=exercise('companion-pin');assert.notEqual(r.code,0);assert.match(r.record.error,/Companion APK differs from its pin/);assert.ok(!r.commands.some(a=>a[0]==='install'));});

for(const [kind,method] of [['agent','reviewedNativeCreateReadUpdateDeleteAndStaleRevision'],['range','distantDatesLoadRealRowsAndNewestNavigationWins'],['truncation','realInstanceLimitCannotClaimAnUnreturnedDateIsFree']]){
 test(`Calendar ${kind} selects its exact native method in an isolated user`,()=>{
  const r=exercise('pass',kind);assert.equal(r.code,0,r.stderr);assert.equal(r.record.passed,true);
  const instrument=r.commands.find(a=>a.includes('instrument'));
  assert.equal(instrument[instrument.indexOf('class')+1],`ai.elizaresearch.alphaphone.${r.record.testClass}#${method}`);
  assert.ok(instrument.includes(kind==='agent'?'calendarAgent':'calendarRange'));assert.equal(r.state.created,false);assert.equal(r.state.user,'0');
  const grants=r.commands.filter(a=>a.includes('grant'));assert.equal(grants.length,2);assert.ok(grants.every(a=>a[a.indexOf('--user')+1]==='10'));
 });
 test(`Calendar ${kind} rejects a different method in the requested class`,()=>{
  const r=exercise('wrong-method',kind);assert.notEqual(r.code,0);assert.equal(r.record.passed,false);assert.equal(r.state.created,false);assert.match(r.log,/unrequestedMethod/);
 });
}
