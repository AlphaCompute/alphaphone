import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const scripts={'one-off':path.resolve('scripts/test-reminder-one-off.mjs'),recurrence:path.resolve('scripts/test-reminder-recurrence.mjs'),workflow:path.resolve('scripts/android-workflow-native.mjs'),calendar:path.resolve('scripts/test-calendar-regression.mjs'),camera:path.resolve('scripts/test-native-permissions.mjs'),settings:path.resolve('scripts/test-native-permissions.mjs'),channels:path.resolve('scripts/test-native-permissions.mjs')};
export function exercise(mode,kind='calendar'){
 const homePackage=mode==='google-home'?'com.google.android.apps.nexuslauncher':'com.android.launcher3';
 const restartCampaign=['inbox','notes','document'].includes(kind);
 const reminderCampaign=['one-off','recurrence'].includes(kind);
 const permissionCampaign=['camera','settings','channels'].includes(kind);
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'alpha-calendar-runner-')));
 try{
  const selectedClass={'one-off':'ReminderOneOffInstrumentedTest',recurrence:'ReminderRecurrenceInstrumentedTest',inbox:'InboxDraftInstrumentedTest',notes:'NotesDocumentInstrumentedTest',document:'SelectedDocumentInstrumentedTest',settings:'SettingsNativeInstrumentedTest',channels:'NotificationChannelsInstrumentedTest',agent:'CalendarAgentCrudInstrumentedTest',range:'CalendarRangeInstrumentedTest',truncation:'CalendarTruncationInstrumentedTest'}[kind]??'CalendarCreationRecoveryInstrumentedTest';
  const selectedMethod={'one-off':'actualOneOffAlarmSnoozeVisibleDoneHistoryAndReplaySafety',recurrence:'actualAlarmSnoozeAndVisibleDoneAdvanceOnceAndRejectOldOccurrence',inbox:'processPhase',notes:'documentProcessRestartPhase',document:'documentProcessRestartPhase',settings:'accountsHandoffAndLocationAccuracyReadback',channels:'blockedChannelReadbackUserRecoveryAndRealNotification',agent:'reviewedNativeCreateReadUpdateDeleteAndStaleRevision',camera:'denyingCameraAllowsExplicitRetryWithoutFakePreview',range:'distantDatesLoadRealRowsAndNewestNavigationWins',truncation:'realInstanceLimitCannotClaimAnUnreturnedDateIsFree'}[kind]??'creationRecovery';
  const pkg='ai.elizaresearch.alphaphone',apk=path.join(root,'artifacts/standalone-debug.apk'),testApk=path.join(root,'android/app/build/outputs/apk/androidTest/standalone/debug/app-standalone-debug-androidTest.apk');
  for(const [file,bytes] of [[apk,'app'],[testApk,'test']]){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
  const cameraTest=path.join(root,'artifacts/standalone-androidTest.apk');
  fs.copyFileSync(testApk,cameraTest);
  const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const manifest={'standalone-debug.apk':hash(apk),'standalone-androidTest.apk':hash(cameraTest)};
  for(const kind of ['debug','androidTest']){const name='launcher-'+kind+'.apk';fs.copyFileSync(kind==='debug'?apk:cameraTest,path.join(root,'artifacts',name));manifest[name]=hash(path.join(root,'artifacts',name));}
  fs.writeFileSync(path.join(root,'artifacts/apk-manifest.json'),JSON.stringify(manifest));
  const jdk=path.join(root,'jdk');fs.mkdirSync(jdk);fs.writeFileSync(path.join(jdk,'release'),'JAVA_VERSION="21.0.1"');
  if(mode==='archive-pin')fs.writeFileSync(cameraTest,'changed');
  if(mode==='companion-pin'){const file=path.join(root,'artifacts/calendar-external/ws.xsoh.etar_57.apk');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'unreviewed APK');}
  fs.writeFileSync(path.join(root,'app.config.json'),JSON.stringify({appId:pkg}));
  const adb=path.join(root,'platform-tools/adb'),aapt=path.join(root,'build-tools/36.0.0/aapt'),state=path.join(root,'state.json'),log=path.join(root,'commands.jsonl');
  fs.mkdirSync(path.dirname(adb),{recursive:true});fs.mkdirSync(path.dirname(aapt),{recursive:true});fs.writeFileSync(log,'');fs.writeFileSync(state,JSON.stringify({user:'0',created:false,files:mode==='existing'?{[pkg]:'unowned'}:{}}));
  fs.writeFileSync(aapt,`#!/usr/bin/env node
const args=process.argv.slice(2);if(args[1]==='badging')console.log("package: name='${pkg}"+(args[2].includes('androidTest')?'.test':'')+"'");else console.log('E: manifest\\n  E: instrumentation\\n    A: android:name="androidx.test.runner.AndroidJUnitRunner"\\n    A: android:targetPackage="${pkg}"\\n  E: instrumentation\\n    A: android:name="${pkg}.WorkflowNoticeProcessRunner"\\n    A: android:targetPackage="${pkg}"');
`,{mode:0o700});
  fs.writeFileSync(adb,`#!/usr/bin/env node
const fs=require('node:fs'),a=process.argv.slice(4),file=${JSON.stringify(state)},s=JSON.parse(fs.readFileSync(file)),pkg=${JSON.stringify(pkg)},mode=${JSON.stringify(mode)};const save=()=>fs.writeFileSync(file,JSON.stringify(s));fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(a)+'\\n');
if(a[0]==='emu')console.log('calendar-fixture\\nOK');
else if(a.includes('ro.build.version.sdk'))console.log('35');
else if(a.includes('ro.kernel.qemu'))console.log('1');
else if(a.includes('ro.product.cpu.abi'))console.log('x86_64');
else if(a.includes('getenforce'))console.log('Enforcing');
else if(a.includes('get-current-user'))console.log(s.user);
else if(a.includes('create-user')){s.created=true;save();console.log('Success: created user id 10');}
else if(a.includes('switch-user')){s.user=a.at(-1);save();}
else if(a.includes('remove-user')){s.created=false;save();console.log('Success');}
else if(a.includes('is-user-stopped'))console.log('true');
else if(a.includes('users'))console.log('UserInfo{0:Owner:13}'+(s.created?'\\nUserInfo{10:Fixture:10}':''));
else if(a.includes('packages')){if(mode==='archive-race')fs.writeFileSync(${JSON.stringify(apk)},'replaced after archive admission');console.log(Object.keys(s.files).map(p=>'package:'+p).join('\\n'));}
else if(a.includes('resolve-activity'))console.log('${homePackage}/.Launcher');
else if(a.includes('set-home-activity'))console.log('Success');
else if(a.includes('activities'))console.log('topResumedActivity=ActivityRecord u'+s.user+' ${homePackage}/.Launcher');
else if(a[0]==='install'){const source=a.at(-1),id=source.includes('androidTest')?pkg+'.test':pkg,dest=file+'.'+id+'.apk';fs.copyFileSync(source,dest);s.files[id]=dest;save();console.log('Success');}
else if(a.slice(0,3).join(' ')==='shell pm path')console.log('package:/data/'+a.at(-1)+'.apk');
else if(a[0]==='pull')fs.copyFileSync(s.files[a[1].slice(6,-4)],a[2]);
else if(a[0]==='uninstall'){delete s.files[a[1]];save();console.log('Success');}
else if(a.includes('force-stop')){if(mode==='stop-failure')process.exit(1);}
else if(a.includes('instrument')){
 const selector=a[a.indexOf('class')+1],cls=${kind==='workflow'?"selector.split('#')[0]":"pkg+"+JSON.stringify(kind==='camera'?'.CameraFlowInstrumentedTest':'.'+selectedClass)},method=${kind==='workflow'?"selector.split('#')[1]":JSON.stringify(selectedMethod)},block=code=>'INSTRUMENTATION_STATUS: class='+cls+'\\nINSTRUMENTATION_STATUS: test='+method+'\\nINSTRUMENTATION_STATUS: numtests=${kind==='recurrence'?2:1}\\nINSTRUMENTATION_STATUS_CODE: '+code+'\\n';
 if(mode==='timeout'||mode==='stop-failure'){console.log(block(1));console.error('fixture transport');process.exit(1);}
 const phase=a.includes('inboxPhase')?a[a.indexOf('inboxPhase')+1]:a.includes('notesDocumentPhase')?a[a.indexOf('notesDocumentPhase')+1]:a.includes('documentPhase')?a[a.indexOf('documentPhase')+1]:null;
 let output=block(1)+block(0)+'OK (1 test)\\nINSTRUMENTATION_CODE: -1\\n';
 if(${kind==='recurrence'})output=block(1)+block(0)+(block(1)+block(0)).replaceAll('test='+method,'test=civilScheduleSkipsWeekendHandlesGapAndEditInvalidatesOldDecisions')+'OK (2 tests)\\nINSTRUMENTATION_CODE: -1\\n';
 if(phase){output+='INSTRUMENTATION_RESULT: inboxFixturePid='+(mode==='same-pid'||phase==='prepare'?100:200)+'\\nINSTRUMENTATION_RESULT: notesDocumentPid='+(mode==='same-pid'||phase==='prepare'?100:200)+'\\n';if(mode==='missing-pid')output=output.replace(/(?:inboxFixturePid|notesDocumentPid)=.*\\n/g,'');if(mode==='duplicate-pid')output+='INSTRUMENTATION_RESULT: inboxFixturePid=300\\nINSTRUMENTATION_RESULT: notesDocumentPid=300\\n';}
 if(mode==='prepare-failure'&&phase==='prepare')output='OK (1 test)\\n';
 if(mode==='summary-only')output='OK (1 test)\\n';
 if(mode==='missing-start')output=block(0)+'OK (1 test)\\nINSTRUMENTATION_CODE: -1\\n';
 if(mode==='wrong-method')output=output.replaceAll('test='+method,'test=unrequestedMethod');
 if(mode==='wrong-class')output=output.replaceAll(cls,pkg+'.WrongTest');
 if(mode==='wrong-terminal')output=output.replace('INSTRUMENTATION_CODE: -1','INSTRUMENTATION_CODE: 0');
 if(mode==='duplicate')output=block(1)+block(0)+output;
 if(mode==='skipped')output=block(1)+block(-4)+'OK (1 test)\\nINSTRUMENTATION_CODE: -1\\n';console.log(output);
}else if(a.includes('start-user')||a.includes('stop-user')||a.includes('grant')||a.includes('revoke')||a.includes('clear-permission-flags')||a[1]==='input'||a[1]==='wm'){}
else{console.error('Unexpected command '+JSON.stringify(a));process.exit(1);}
`,{mode:0o700});
  const testClass=mode==='companion-pin'?'CalendarExternalEditorInstrumentedTest':selectedClass;
  const run=spawnSync(process.execPath,[restartCampaign?path.resolve('scripts/test-native-restart.mjs'):scripts[kind]??scripts.calendar,...(kind==='workflow'?[]:permissionCampaign||restartCampaign?[kind,apk,cameraTest,path.join(root,'output')]:reminderCampaign?[apk,cameraTest,path.join(root,'output')]:[`--case=${testClass}`,'--variant=standalone',...(mode==='companion-pin'?['--external']:[])])],{cwd:root,env:{...process.env,ALPHA_CALENDAR_TEST_ROOT:root,ALPHA_CALENDAR_TEST_SERIAL:'emulator-5580',ALPHA_CALENDAR_TEST_AVD:'calendar-fixture',ALPHA_CALENDAR_TEST_ABI:'x86_64',ANDROID_HOME:root,ANDROID_SDK_ROOT:root,JAVA_HOME:jdk,ANDROID_SERIAL:'emulator-5580',ALPHA_TEST_HOME_PACKAGE:homePackage,ALPHA_NATIVE_TEST_AVD:'calendar-fixture',ALPHA_NATIVE_TEST_ABI:'x86_64',ALPHA_BUILD_ARCHIVE:path.join(root,'artifacts'),ALPHA_CAMPAIGN_OUTPUT:path.join(root,'test-results/workflow'),ALPHA_WORKFLOW_TEST_AVD:'calendar-fixture',ALPHA_WORKFLOW_TEST_ABI:'x86_64',ELIZA_DEVICE_LEASE_DIR:path.join(root,'leases')},encoding:'utf8',timeout:120000});
  // Source authentication alone can exceed the old whole-fixture deadline.
  // Surface process failures before reading output that may never have been created.
  assert.ifError(run.error);
  const directory=kind==='workflow'?path.join(root,'test-results/workflow'):permissionCampaign||restartCampaign||reminderCampaign?path.join(root,'output'):path.join(root,'test-results',fs.readdirSync(path.join(root,'test-results'))[0],`standalone-${testClass}`);
  return {code:run.status,stderr:run.stderr,record:fs.existsSync(path.join(directory,'result.json'))?JSON.parse(fs.readFileSync(path.join(directory,'result.json'),'utf8')):null,state:JSON.parse(fs.readFileSync(state)),commands:fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse),log:kind==='workflow'&&fs.existsSync(path.join(directory,'standalone-privateReadResultSurvivesRecreationButNeverExpandsPassiveHistory/standalone.log'))?fs.readFileSync(path.join(directory,'standalone-privateReadResultSurvivesRecreationButNeverExpandsPassiveHistory/standalone.log'),'utf8'):fs.existsSync(path.join(directory,'standalone.log'))?fs.readFileSync(path.join(directory,'standalone.log'),'utf8'):''};
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
