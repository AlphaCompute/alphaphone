import test from 'node:test';
import assert from 'node:assert/strict';
import {exercise} from './fixtures/isolated-native-campaign.mjs';
for(const kind of ['recovery','recurrence-recovery']){
 test(`${kind} witnesses actual boundaries in the same owned user`,()=>{
  const r=exercise('pass',kind);assert.equal(r.code,0,r.stderr);assert.equal(r.record.passed,true);
  assert.equal(r.record.userLifecycle.removed,true);assert.equal(r.state.user,'0');assert.deepEqual(r.state.files,{});
  for(const command of r.commands.filter(a=>a.includes('grant')||a.includes('revoke')||a.includes('instrument')||a.includes('run-as')))
   assert.equal(command[command.indexOf('--user')+1],'10');
  const reboot=r.commands.findIndex(a=>a[0]==='reboot');assert.ok(reboot>0);
  const witness=r.commands.findIndex((a,i)=>i>reboot&&a.includes('notification'));
  const nextInstrumentation=r.commands.findIndex((a,i)=>i>reboot&&a.includes('instrument'));
  assert.ok(witness>reboot&&nextInstrumentation>witness,'External notification proof precedes new instrumentation');
  assert.notEqual(r.record.boot.before,r.record.boot.after);
  assert.ok(r.commands.some(a=>a.at(-1)==='shared_prefs/alpha-reminder-envelope-v1.xml'));
 });
 for(const mode of ['summary-only','wrong-class','skipped','archive-pin','existing','grant-resumes'])test(`${kind} rejects ${mode}`,()=>{
  const r=exercise(mode,kind);assert.notEqual(r.code,0);
  if(['archive-pin','existing'].includes(mode))assert.ok(!r.commands.some(a=>a[0]==='install'||a.includes('create-user')));
  else {
   assert.equal(r.state.user,'0');
   const uncertain=['summary-only','wrong-class','skipped'].includes(mode);
   assert.equal(r.record.userLifecycle.cleanupDeferred,uncertain);
   assert.equal(r.record.userLifecycle.removed,!uncertain);
   assert.equal(r.state.created,uncertain);
  }
 });
}
test('recurrence recovery rejects changed occurrence before it can reboot',()=>{
 const r=exercise('changed-occurrence','recurrence-recovery');assert.notEqual(r.code,0);assert.ok(!r.commands.some(a=>a[0]==='reboot'));assert.equal(r.record.userLifecycle.removed,true);
});
