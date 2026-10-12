// Clock handoff, native half (LOOP-C). Host-JVM run of ClockContract fed with the pinned upstream
// validateClockOperation outputs, plus source checks of the plugin wiring. Not Android or Clock-app
// evidence: no AlarmClock intent is resolved or started here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {root,nativeSource,fixture,runJvm,jsonJarSkip} from './fixtures/jvm-tools.mjs';

const upstream=join(root,'vendor/eliza/plugins/plugin-assistant/src/services/device-actions/clock-contract.ts');

test('upstream-valid repeat days (unordered or empty) are normalized natively, never refused',{skip:jsonJarSkip},async()=>{
 const {validateClockOperation}=await import(upstream);
 const set=days=>({type:'clock_handoff',action:'set',hour:7,minute:30,label:'Wake',timeZone:'America/New_York',...(days===undefined?{}:{days})});
 const cases=[[[3,2],[2,3]],[[],[]],[[7,1,4],[1,4,7]],[[2,3,4,5,6],[2,3,4,5,6]],[[1,2,3,4,5,6,7],[1,2,3,4,5,6,7]]].map(([days,expected])=>{
  const operation=validateClockOperation(set(days));
  assert.deepEqual(operation.days,days,'the pinned upstream contract admits these days as given');
  return {days:operation.days,expected};
 });
 assert.throws(()=>validateClockOperation(set([1,1])),/Duplicate/,'upstream refuses duplicates itself');
 assert.match(runJvm([nativeSource('ClockContract.java'),fixture('ClockContractTest.java')],'ai.elizaresearch.alphaphone.ClockContractTest',{json:true,args:[JSON.stringify(cases)]}),/^PASS clock contract/);
});

test('surfaceInfo, clockHandoff, ClockHandoff.launch and the capability header carry repeat days end to end',()=>{
 const daily=readFileSync(nativeSource('DailyAppsPlugin.java'),'utf8');
 assert.match(daily,/value\.put\("clockRepeatDaysVersion", 1\);/);
 const handoff=daily.slice(daily.indexOf('@PluginMethod public void clockHandoff('),daily.indexOf('@PluginMethod public void capabilities('));
 assert.match(handoff,/"timeZone","days"\)\.contains\(key\)/,'days is an accepted option');
 assert.match(handoff,/call\.getString\("timeZone"\),ClockHandoff\.days\(data\.opt\("days"\)\)\)\);/,'parsed strictly and passed to the 9-argument launch');
 const launch=readFileSync(nativeSource('ClockHandoff.java'),'utf8');
 const body=launch.slice(launch.indexOf('String timeZone,java.util.List<Integer> repeatDays) {'));
 assert.match(body,/ClockContract\.receiver\(activity\.getPackageName\(\),resolved\.activityInfo\.packageName\)/,'the handler is resolved and Alpha itself refused');
 assert.match(body,/target\.setComponent\(new android\.content\.ComponentName\(receiver,resolved\.activityInfo\.name\)\);\n   activity\.startActivity\(target\);/,'an explicit component is started');
 assert.match(body,/opened\.put\("package",receiver\);/,'the receipt names the receiving package');
 assert.doesNotMatch(body,/target\.resolveActivity\(/);
 const review=readFileSync(nativeSource('ClockAgentReview.java'),'utf8');
 assert.match(review,/if\(operation\.has\("days"\)\)ClockContract\.agentDays\(operation\.get\("days"\)\);/);
 assert.match(review,/ClockContract\.agentDays\(operation\.opt\("days"\)\)\);/);
 assert.match(review,/ClockContract\.receiver\(activity\.getPackageName\(\),resolved\.activityInfo\.packageName\)==null\)return result\(action,"unavailable"\);/);
 const connection=readFileSync(nativeSource('AlphaConnectionPlugin.java'),'utf8');
 assert.match(connection,/"clock\.handoff\.v1","clock\.handoff\.v2"\);/,'the device capability header may advertise v2');
});
