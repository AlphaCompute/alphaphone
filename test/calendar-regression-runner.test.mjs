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
  const pkg='ai.elizaresearch.alphaphone',apk=path.join(root,'artifacts/standalone-debug.apk'),testApk=path.join(root,'android/app/build/outputs/apk/androidTest/standalone/debug/app-standalone-debug-androidTest.apk');
  for(const [file,bytes] of [[apk,'app'],[testApk,'test']]){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
  if(mode==='companion-pin'){const file=path.join(root,'artifacts/calendar-external/ws.xsoh.etar_57.apk');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'unreviewed APK');}
  fs.writeFileSync(path.join(root,'app.config.json'),JSON.stringify({appId:pkg}));
  const adb=path.join(root,'platform-tools/adb'),aapt=path.join(root,'build-tools/36.0.0/aapt'),state=path.join(root,'state.json'),log=path.join(root,'commands.jsonl');
  fs.mkdirSync(path.dirname(adb),{recursive:true});fs.mkdirSync(path.dirname(aapt),{recursive:true});fs.writeFileSync(log,'');fs.writeFileSync(state,JSON.stringify({user:'0',created:false,files:mode==='existing'?{[pkg]:'unowned'}:{}}));
  fs.writeFileSync(aapt,`#!/usr/bin/env node
const args=process.argv.slice(2);if(args[1]==='badging')console.log("package: name='${pkg}"+(args[2].includes('androidTest')?'.test':'')+"'");else console.log('E: manifest\\n  E: instrumentation\\n    A: android:name="androidx.test.runner.AndroidJUnitRunner"\\n    A: android:targetPackage="${pkg}"');
`,{mode:0o700});
  fs.writeFileSync(adb,`#!/usr/bin/env node
const fs=require('node:fs'),a=process.argv.slice(4),file=${JSON.stringify(state)},s=JSON.parse(fs.readFileSync(file)),pkg=${JSON.stringify(pkg)},mode=${JSON.stringify(mode)};const save=()=>fs.writeFileSync(file,JSON.stringify(s));fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(a)+'\\n');
if(a[0]==='emu')console.log('calendar-fixture\\nOK');
else if(a.includes('ro.kernel.qemu'))console.log('1');
else if(a.includes('ro.product.cpu.abi'))console.log('x86_64');
else if(a.includes('getenforce'))console.log('Enforcing');
else if(a.includes('get-current-user'))console.log(s.user);
else if(a.includes('create-user')){s.created=true;save();console.log('Success: created user id 10');}
else if(a.includes('switch-user')){s.user=a.at(-1);save();}
else if(a.includes('remove-user')){s.created=false;save();console.log('Success');}
else if(a.includes('is-user-stopped'))console.log('true');
else if(a.includes('users'))console.log('UserInfo{0:Owner:13}'+(s.created?'\\nUserInfo{10:Fixture:10}':''));
else if(a.includes('packages'))console.log(Object.keys(s.files).map(p=>'package:'+p).join('\\n'));
else if(a.includes('resolve-activity'))console.log('com.android.launcher3/.Launcher');
else if(a.includes('set-home-activity'))console.log('Success');
else if(a.includes('activities'))console.log('topResumedActivity=ActivityRecord u'+s.user+' com.android.launcher3/.Launcher');
else if(a[0]==='install'){const source=a.at(-1),id=source.includes('androidTest')?pkg+'.test':pkg,dest=file+'.'+id+'.apk';fs.copyFileSync(source,dest);s.files[id]=dest;save();console.log('Success');}
else if(a.slice(0,3).join(' ')==='shell pm path')console.log('package:/data/'+a.at(-1)+'.apk');
else if(a[0]==='pull')fs.copyFileSync(s.files[a[1].slice(6,-4)],a[2]);
else if(a[0]==='uninstall'){delete s.files[a[1]];save();console.log('Success');}
else if(a.includes('force-stop')){if(mode==='stop-failure')process.exit(1);}
else if(a.includes('instrument')){
 const cls=pkg+'.CalendarCreationRecoveryInstrumentedTest',block=code=>'INSTRUMENTATION_STATUS: class='+cls+'\\nINSTRUMENTATION_STATUS: test=creationRecovery\\nINSTRUMENTATION_STATUS: numtests=1\\nINSTRUMENTATION_STATUS_CODE: '+code+'\\n';
 if(mode==='timeout'||mode==='stop-failure'){console.log(block(1));console.error('fixture transport');process.exit(1);}
 let output=block(1)+block(0)+'OK (1 test)\\nINSTRUMENTATION_CODE: -1\\n';
 if(mode==='summary-only')output='OK (1 test)\\n';
 if(mode==='missing-start')output=block(0)+'OK (1 test)\\nINSTRUMENTATION_CODE: -1\\n';
 if(mode==='wrong-class')output=output.replaceAll(cls,pkg+'.WrongTest');
 if(mode==='wrong-terminal')output=output.replace('INSTRUMENTATION_CODE: -1','INSTRUMENTATION_CODE: 0');
 if(mode==='duplicate')output=block(1)+block(0)+output;
 if(mode==='skipped')output=block(1)+block(-4)+'OK (1 test)\\nINSTRUMENTATION_CODE: -1\\n';console.log(output);
}else if(a.includes('start-user')||a.includes('stop-user')||a.includes('grant')||a[1]==='input'||a[1]==='wm'){}
else{console.error('Unexpected command '+JSON.stringify(a));process.exit(1);}
`,{mode:0o700});
  const testClass=mode==='companion-pin'?'CalendarExternalEditorInstrumentedTest':'CalendarCreationRecoveryInstrumentedTest';
  const run=spawnSync(process.execPath,[script,`--case=${testClass}`,'--variant=standalone',...(mode==='companion-pin'?['--external']:[])],{cwd:root,env:{...process.env,ALPHA_CALENDAR_TEST_ROOT:root,ALPHA_CALENDAR_TEST_SERIAL:'emulator-5580',ALPHA_CALENDAR_TEST_AVD:'calendar-fixture',ALPHA_CALENDAR_TEST_ABI:'x86_64',ANDROID_HOME:root,ELIZA_DEVICE_LEASE_DIR:path.join(root,'leases')},encoding:'utf8',timeout:120000});
  // Source authentication alone can exceed the old whole-fixture deadline.
  // Surface process failures before reading output that may never have been created.
  assert.ifError(run.error);
  const directory=path.join(root,'test-results',fs.readdirSync(path.join(root,'test-results'))[0],`standalone-${testClass}`);
  return {code:run.status,stderr:run.stderr,record:JSON.parse(fs.readFileSync(path.join(directory,'result.json'),'utf8')),state:JSON.parse(fs.readFileSync(state)),commands:fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse),log:fs.existsSync(path.join(directory,'standalone.log'))?fs.readFileSync(path.join(directory,'standalone.log'),'utf8'):''};
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
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
