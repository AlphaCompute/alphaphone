import assert from 'node:assert/strict';
import test from 'node:test';
import {exercise} from './fixtures/isolated-native-campaign.mjs';
const run=mode=>exercise(mode,'workflow');
const approvalClass='ai.elizaresearch.alphaphone.WorkflowApprovalNoticeInstrumentedTest';
test('workflow campaign runs every exact case of both phases in disposable users and scopes permissions',()=>{
 const r=run('pass');assert.equal(r.code,0,r.stderr);assert.equal(r.record.results.length,14);
 assert.ok(r.record.results.every(row=>row.passed&&row.userLifecycle.removed));
 assert.equal(r.state.user,'0');assert.equal(r.state.created,false);assert.deepEqual(r.state.files,{});
 const calls=r.commands.filter(a=>a.includes('instrument'));assert.equal(calls.length,14);
 assert.equal(new Set(calls.map(a=>a[a.indexOf('class')+1])).size,7);
 const permissions=r.commands.filter(a=>a.includes('grant')||a.includes('revoke')||a.includes('clear-permission-flags'));
 // Ten workflow cases and four approval-notice cases scope Calendar (4 commands each); the two OS-posting cases also grant notifications.
 assert.equal(permissions.length,60);assert.ok(permissions.every(a=>a[a.indexOf('--user')+1]==='10'));
 approvalNoticePhase(r);
});
// Same full campaign run as above: the approval-notice phase, its gate, grant and report.
function approvalNoticePhase(r){
 const calls=r.commands.filter(a=>a.includes('instrument')&&a[a.indexOf('class')+1].startsWith(approvalClass+'#'));
 assert.deepEqual(calls.map(a=>a[a.indexOf('class')+1].split('#')[1]),['approvalAndStepBuildersAreRedactedAndExpire','approvalNoticeOpensItsRunOnceAndIsWithdrawnOnDecision','approvalAndStepBuildersAreRedactedAndExpire','approvalNoticeOpensItsRunOnceAndIsWithdrawnOnDecision']);
 assert.ok(calls.every(a=>a[a.indexOf('workflowApprovalNotice')+1]==='1'&&a[a.indexOf('--user')+1]==='10'));
 // Only the OS-posting tap case receives POST_NOTIFICATIONS, once per distribution, before its instrumentation.
 const grants=r.commands.map((a,index)=>({a,index})).filter(({a})=>a.includes('grant')&&a.includes('android.permission.POST_NOTIFICATIONS'));
 assert.equal(grants.length,2);assert.ok(!r.commands.some(a=>a.includes('revoke')&&a.includes('android.permission.POST_NOTIFICATIONS')));
 for(const {index} of grants){const next=r.commands.slice(index).find(a=>a.includes('instrument'));assert.equal(next[next.indexOf('class')+1],approvalClass+'#approvalNoticeOpensItsRunOnceAndIsWithdrawnOnDecision');}
 // The report names each phase, its coverage on both distributions and the exact archived pair.
 const phase=r.record.phases['approval-notice'];
 assert.deepEqual([phase.expected,phase.passed,phase.complete],[4,4,true]);
 assert.deepEqual([...new Set(phase.cases.map(row=>row.variant))],['standalone','launcher']);assert.ok(phase.cases.every(row=>row.status==='passed'));
 assert.deepEqual([r.record.phases.workflow.expected,r.record.phases.workflow.passed,r.record.phases.workflow.complete],[10,10,true]);
 assert.equal(r.record.passed,true);assert.equal(r.record.failure,undefined);
 for(const row of r.record.results.filter(row=>row.phase==='approval-notice')){assert.match(row.appSha256,/^[0-9a-f]{64}$/);assert.equal(row.appSha256,r.record.apks[row.variant].appSha256);assert.equal(row.testSha256,r.record.apks[row.variant].testSha256);}
}
test('a failed case names itself, leaves later phases not-run and fails the campaign',()=>{
 const r=run('skipped');assert.notEqual(r.code,0);
 assert.equal(r.record.passed,false);
 assert.deepEqual([r.record.failure.variant,r.record.failure.phase],['standalone','workflow']);assert.match(r.record.failure.method,/WorkflowPhoneNativeInstrumentedTest#/);
 assert.equal(r.record.phases.workflow.complete,false);assert.equal(r.record.phases['approval-notice'].complete,false);
 assert.ok(r.record.phases['approval-notice'].cases.every(row=>row.status==='not-run'));
 assert.equal(r.record.phases.workflow.cases[0].status,'failed');
});
for(const mode of ['summary-only','missing-start','wrong-method','wrong-class','skipped','wrong-terminal','duplicate'])test(`workflow rejects ${mode} evidence and cleans its fixture`,()=>{
 const r=run(mode);assert.notEqual(r.code,0);assert.equal(r.record.results[0].passed,false);assert.equal(r.state.created,false);assert.equal(r.state.user,'0');assert.match(r.log,/OK \(1 test\)/);
});
test('workflow refuses existing package registrations before mutation',()=>{
 const r=run('existing');assert.notEqual(r.code,0);assert.ok(!r.commands.some(a=>a[0]==='install'||a.includes('create-user')));
});
test('workflow validates every archived APK before mutation',()=>{
 const r=run('archive-pin');assert.notEqual(r.code,0);assert.equal(r.commands.length,0);
});
test('workflow transport failure stops owned packages before cleanup',()=>{
 const r=run('timeout');assert.notEqual(r.code,0);assert.equal(r.commands.filter(a=>a.includes('force-stop')).length,2);assert.equal(r.state.created,false);
});
test('workflow retains its fixture on uncertain termination',()=>{
 const r=run('stop-failure');assert.notEqual(r.code,0);assert.equal(r.record.results[0].userLifecycle.cleanupDeferred,true);assert.equal(r.state.created,true);assert.equal(r.commands.filter(a=>a[0]==='uninstall').length,0);
});
