import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const script=path.resolve('scripts/test-calendar-regression.mjs');
function exercise(mode){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-calendar-runner-'));
 try{
  const apk=path.join(root,'artifacts/standalone-debug.apk'),testApk=path.join(root,'android/app/build/outputs/apk/androidTest/standalone/debug/app-standalone-debug-androidTest.apk');
  for(const [file,bytes] of [[apk,'app'],[testApk,'test']]){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
  fs.writeFileSync(path.join(root,'app.config.json'),JSON.stringify({appId:'ai.elizaresearch.alphaphone'}));
  const preload=path.join(root,'preload.mjs');
  fs.writeFileSync(preload,`
import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import fs from 'node:fs';
const pkg='ai.elizaresearch.alphaphone',installed=new Map();let user='0',created=false;
cp.execFileSync=(file,all)=>{
 const a=all.slice(2);fs.appendFileSync('commands.jsonl',JSON.stringify(a)+'\\n');
 if(a.join(' ')==='emu avd name')return 'calendar-fixture\\nOK';
 if(a.join(' ')==='shell am get-current-user')return user;
 if(a.slice(0,4).join(' ')==='shell pm list users')return 'UserInfo{0:Owner:13}'+(created?'\\nUserInfo{10:Fixture:10}':'');
 if(a.slice(0,4).join(' ')==='shell pm list packages')return installed.has(a.at(-1))?'package:'+a.at(-1):'';
 if(a[0]==='install'){const f=a.at(-1);installed.set(f.includes('androidTest')?pkg+'.test':pkg,f);return 'Success\\n';}
 if(a.slice(0,3).join(' ')==='shell pm path')return 'package:/fixture/'+a.at(-1);
 if(a[0]==='pull'){fs.copyFileSync(installed.get(a[1].slice('/fixture/'.length)),a[2]);return '';}
 if(a.slice(0,3).join(' ')==='shell pm create-user'){created=true;return 'Success: created user id 10';}
 if(a.slice(0,3).join(' ')==='shell am start-user')return 'Success';
 if(a.includes('resolve-activity'))return 'com.android.launcher3/.Launcher';
 if(a.includes('set-home-activity'))return 'Success';
 if(a.slice(0,3).join(' ')==='shell am switch-user'){user=a[3];return '';}
 if(a[1]==='input'||a[1]==='wm'||a[2]==='grant')return '';
 if(a.slice(0,3).join(' ')==='shell dumpsys activity')return 'topResumedActivity=ActivityRecord u'+user+' com.android.launcher3/.Launcher';
 if(a.includes('instrument')){
  const cls=pkg+'.CalendarCreationRecoveryInstrumentedTest',mode=${JSON.stringify(mode)};
  const block=code=>'INSTRUMENTATION_STATUS: class='+cls+'\\nINSTRUMENTATION_STATUS: test=creationRecovery\\nINSTRUMENTATION_STATUS: numtests=1\\nINSTRUMENTATION_STATUS_CODE: '+code+'\\n';
  if(mode==='timeout')throw Object.assign(Error('transport timeout'),{stdout:block(1),stderr:'fixture transport',code:'ETIMEDOUT'});
  let output=block(1)+block(0)+'OK (1 test)\\nINSTRUMENTATION_CODE: -1\\n';
  if(mode==='summary-only')output='OK (1 test)\\n';
  if(mode==='missing-start')output=block(0)+'OK (1 test)\\nINSTRUMENTATION_CODE: -1\\n';
  if(mode==='wrong-class')output=output.replaceAll(cls,pkg+'.WrongTest');
  if(mode==='wrong-terminal')output=output.replace('INSTRUMENTATION_CODE: -1','INSTRUMENTATION_CODE: 0');
  if(mode==='duplicate')output=block(1)+block(0)+output;
  if(mode==='skipped')output=block(1)+block(-4)+'OK (1 test)\\nINSTRUMENTATION_CODE: -1\\n';
  return output;
 }
 if(a[0]==='uninstall'){installed.delete(a[1]);return 'Success';}
 if(a.slice(0,3).join(' ')==='shell am stop-user')return '';
 if(a.slice(0,3).join(' ')==='shell am is-user-stopped')return 'true';
 if(a.slice(0,3).join(' ')==='shell pm remove-user'){created=false;return 'Success';}
 throw Error('Unexpected command '+JSON.stringify(a));
};syncBuiltinESMExports();`);
  const run=spawnSync(process.execPath,['--import',preload,script,'--case=CalendarCreationRecoveryInstrumentedTest','--variant=standalone'],{cwd:root,env:{...process.env,ALPHA_CALENDAR_TEST_ROOT:root,ALPHA_CALENDAR_TEST_SERIAL:'emulator-5580',ALPHA_CALENDAR_TEST_AVD:'calendar-fixture',ANDROID_HOME:root},encoding:'utf8',timeout:15000});
  const directory=path.join(root,'test-results',fs.readdirSync(path.join(root,'test-results'))[0],'standalone-CalendarCreationRecoveryInstrumentedTest');
  return {code:run.status,stderr:run.stderr,record:JSON.parse(fs.readFileSync(path.join(directory,'result.json'),'utf8')),commands:fs.readFileSync(path.join(root,'commands.jsonl'),'utf8').trim().split('\n').map(JSON.parse),log:fs.readFileSync(path.join(directory,'instrumentation.log'),'utf8')};
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('Calendar runner records complete raw evidence and cleans only its fixture installation',()=>{
 const r=exercise('pass');assert.equal(r.code,0,r.stderr);assert.equal(r.record.passed,true);assert.equal(r.record.phases.instrumentation.evidence.totalTests,1);assert.ok(r.commands.find(a=>a.includes('instrument')).includes('-r'));assert.equal(r.commands.filter(a=>a[0]==='uninstall').length,2);
});
for(const mode of ['summary-only','missing-start','wrong-class','wrong-terminal','duplicate','skipped'])test(`Calendar runner rejects ${mode} evidence`,()=>{const r=exercise(mode);assert.notEqual(r.code,0);assert.equal(r.record.passed,false);assert.ok(r.log.includes('OK (1 test)'));});
test('Calendar runner preserves owned resources when instrumentation transport is uncertain',()=>{
 const r=exercise('timeout');assert.notEqual(r.code,0);assert.equal(r.record.passed,false);assert.ok(r.log.includes('fixture transport'));const index=r.commands.findIndex(a=>a.includes('instrument'));assert.deepEqual(r.commands.slice(index+1),[]);assert.match(r.record.cleanup.join('\n'),/Deferred/);
});
