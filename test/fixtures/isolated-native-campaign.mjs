import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const scripts={calendar:path.resolve('scripts/test-calendar-regression.mjs'),camera:path.resolve('scripts/test-camera-permission.mjs')};
export function exercise(mode,kind='calendar'){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'alpha-calendar-runner-')));
 try{
  const selectedClass={range:'CalendarRangeInstrumentedTest',truncation:'CalendarTruncationInstrumentedTest'}[kind]??'CalendarCreationRecoveryInstrumentedTest';
  const selectedMethod={camera:'denyingCameraAllowsExplicitRetryWithoutFakePreview',range:'distantDatesLoadRealRowsAndNewestNavigationWins',truncation:'realInstanceLimitCannotClaimAnUnreturnedDateIsFree'}[kind]??'creationRecovery';
  const pkg='ai.elizaresearch.alphaphone',apk=path.join(root,'artifacts/standalone-debug.apk'),testApk=path.join(root,'android/app/build/outputs/apk/androidTest/standalone/debug/app-standalone-debug-androidTest.apk');
  for(const [file,bytes] of [[apk,'app'],[testApk,'test']]){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
  const cameraTest=path.join(root,'artifacts/standalone-androidTest.apk');
  fs.copyFileSync(testApk,cameraTest);
  const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  fs.writeFileSync(path.join(root,'artifacts/apk-manifest.json'),JSON.stringify({'standalone-debug.apk':hash(apk),'standalone-androidTest.apk':hash(cameraTest)}));
  const jdk=path.join(root,'jdk');fs.mkdirSync(jdk);fs.writeFileSync(path.join(jdk,'release'),'JAVA_VERSION="21.0.1"');
  if(mode==='archive-pin')fs.writeFileSync(cameraTest,'changed');
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
 const cls=pkg+${JSON.stringify(kind==='camera'?'.CameraFlowInstrumentedTest':'.'+selectedClass)},block=code=>'INSTRUMENTATION_STATUS: class='+cls+'\\nINSTRUMENTATION_STATUS: test=${selectedMethod}\\nINSTRUMENTATION_STATUS: numtests=1\\nINSTRUMENTATION_STATUS_CODE: '+code+'\\n';
 if(mode==='timeout'||mode==='stop-failure'){console.log(block(1));console.error('fixture transport');process.exit(1);}
 let output=block(1)+block(0)+'OK (1 test)\\nINSTRUMENTATION_CODE: -1\\n';
 if(mode==='summary-only')output='OK (1 test)\\n';
 if(mode==='missing-start')output=block(0)+'OK (1 test)\\nINSTRUMENTATION_CODE: -1\\n';
 if(mode==='wrong-method')output=output.replaceAll('test=${selectedMethod}','test=unrequestedMethod');
 if(mode==='wrong-class')output=output.replaceAll(cls,pkg+'.WrongTest');
 if(mode==='wrong-terminal')output=output.replace('INSTRUMENTATION_CODE: -1','INSTRUMENTATION_CODE: 0');
 if(mode==='duplicate')output=block(1)+block(0)+output;
 if(mode==='skipped')output=block(1)+block(-4)+'OK (1 test)\\nINSTRUMENTATION_CODE: -1\\n';console.log(output);
}else if(a.includes('start-user')||a.includes('stop-user')||a.includes('grant')||a.includes('revoke')||a.includes('clear-permission-flags')||a[1]==='input'||a[1]==='wm'){}
else{console.error('Unexpected command '+JSON.stringify(a));process.exit(1);}
`,{mode:0o700});
  const testClass=mode==='companion-pin'?'CalendarExternalEditorInstrumentedTest':selectedClass;
  const run=spawnSync(process.execPath,[scripts[kind]??scripts.calendar,...(kind==='camera'?[apk,cameraTest,path.join(root,'output')]:[`--case=${testClass}`,'--variant=standalone',...(mode==='companion-pin'?['--external']:[])])],{cwd:root,env:{...process.env,ALPHA_CALENDAR_TEST_ROOT:root,ALPHA_CALENDAR_TEST_SERIAL:'emulator-5580',ALPHA_CALENDAR_TEST_AVD:'calendar-fixture',ALPHA_CALENDAR_TEST_ABI:'x86_64',ANDROID_HOME:root,ANDROID_SDK_ROOT:root,JAVA_HOME:jdk,ANDROID_SERIAL:'emulator-5580',ALPHA_CAMERA_TEST_AVD:'calendar-fixture',ALPHA_CAMERA_TEST_ABI:'x86_64',ELIZA_DEVICE_LEASE_DIR:path.join(root,'leases')},encoding:'utf8',timeout:120000});
  // Source authentication alone can exceed the old whole-fixture deadline.
  // Surface process failures before reading output that may never have been created.
  assert.ifError(run.error);
  const directory=kind==='camera'?path.join(root,'output'):path.join(root,'test-results',fs.readdirSync(path.join(root,'test-results'))[0],`standalone-${testClass}`);
  return {code:run.status,stderr:run.stderr,record:fs.existsSync(path.join(directory,'result.json'))?JSON.parse(fs.readFileSync(path.join(directory,'result.json'),'utf8')):null,state:JSON.parse(fs.readFileSync(state)),commands:fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse),log:fs.existsSync(path.join(directory,'standalone.log'))?fs.readFileSync(path.join(directory,'standalone.log'),'utf8'):''};
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
