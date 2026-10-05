import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';

function exercise(kind,mode='pass',bridge=false){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-upgrade-'));
 try{
  const pkg='ai.elizaresearch.alphaphone',host=kind==='calendar'?'com.android.launcher3':'com.google.android.apps.nexuslauncher';
  fs.writeFileSync(path.join(root,'app.config.json'),JSON.stringify({appId:pkg}));
  for(const variant of ['standalone','launcher'])for(const [file,bytes] of [
   [`baseline/${variant}-debug.apk`,'baseline'],[`baseline/${variant}-test.apk`,'baseline-test'],[`artifacts/${variant}-debug.apk`,'candidate'],[`android/app/build/outputs/apk/androidTest/${variant}/debug/app-${variant}-debug-androidTest.apk`,'candidate-test']
  ]){const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
  const adb=path.join(root,'platform-tools/adb'),aapt=path.join(root,'build-tools/36.0.0/aapt'),state=path.join(root,'state.json'),log=path.join(root,'commands.jsonl');
  fs.mkdirSync(path.dirname(adb),{recursive:true});fs.mkdirSync(path.dirname(aapt),{recursive:true});
  fs.writeFileSync(state,JSON.stringify({user:'0',exists:false,files:mode==='existing'?{[pkg]:'unowned'}:{}}));fs.writeFileSync(log,'');
  fs.writeFileSync(aapt,`#!/usr/bin/env node
const args=process.argv.slice(2),test=/androidTest|test.apk/.test(args[2]);
const extra=args[2].includes('androidTest')?${JSON.stringify(mode)}!=='candidate-missing-runner':['baseline-process','baseline-undeclared'].includes(${JSON.stringify(mode)});
if(args[1]==='badging')console.log("package: name='${pkg}"+(test?'.test':'')+"'");
else {
 console.log('E: manifest\\n  E: instrumentation\\n    A: android:name="androidx.test.runner.AndroidJUnitRunner"\\n    A: android:targetPackage="${pkg}"');
 if(extra)console.log('  E: instrumentation\\n    A: android:name="${pkg}.WorkflowNoticeProcessRunner"\\n    A: android:targetPackage="${pkg}"');
}
`,{mode:0o700});
  fs.writeFileSync(adb,`#!/usr/bin/env node
const fs=require('node:fs'),a=process.argv.slice(4),stateFile=${JSON.stringify(state)},s=JSON.parse(fs.readFileSync(stateFile)),pkg=${JSON.stringify(pkg)},mode=${JSON.stringify(mode)},host=${JSON.stringify(host)};
fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(a)+'\\n');const save=()=>fs.writeFileSync(stateFile,JSON.stringify(s));
if(a[0]==='emu')console.log('owned-fixture\\nOK');
else if(a.includes('ro.kernel.qemu'))console.log('1');
else if(a.includes('ro.product.cpu.abi'))console.log('x86_64');
else if(a.includes('getenforce'))console.log('Enforcing');
else if(a.includes('get-current-user'))console.log(s.user);
else if(a.includes('create-user')){s.exists=true;save();console.log('Success: created user id 10');}
else if(a.includes('switch-user')){if(mode==='restore-failure'&&a.at(-1)==='0')process.exit(1);s.user=a.at(-1);save();}
else if(a.includes('remove-user')){s.exists=false;save();console.log('Success');}
else if(a.includes('is-user-stopped'))console.log('true');
else if(a.includes('users'))console.log('UserInfo{0:Owner:13}'+(s.exists?'\\nUserInfo{10:Fixture:10}':''));
else if(a.includes('packages'))console.log(Object.keys(s.files).map(p=>'package:'+p).join('\\n'));
else if(a.includes('resolve-activity'))console.log(host+'/.Launcher');
else if(a.includes('set-home-activity'))console.log('Success');
else if(a.includes('activities'))console.log('topResumedActivity=ActivityRecord u'+s.user+' '+host+'/.Launcher');
else if(a.includes('intents'))for(const route of ['alpha-reminder:upgrade_future/a','alpha-reminder:upgrade_repeat/b','alpha-reminder-tap:c'])console.log('requestIntent=Intent dat='+route+(mode==='changed-intents'&&s.candidate?'changed':'')+' cmp='+pkg+'/.Receiver');
else if(a[0]==='install'){const file=a.at(-1),id=/androidTest|test.apk/.test(file)?pkg+'.test':pkg,dest=stateFile+'.'+id+'.apk';fs.copyFileSync(file,dest);s.files[id]=dest;if(id===pkg)s.candidate=file.includes('/artifacts/');save();console.log('Success');}
else if(a.slice(0,3).join(' ')==='shell pm path')console.log('package:/data/'+a.at(-1)+'.apk');
else if(a[0]==='pull')fs.copyFileSync(s.files[a[1].slice(6,-4)],a[2]);
else if(a[0]==='uninstall'){delete s.files[a[1]];save();console.log('Success');}
else if(a.includes('force-stop')){if(mode==='stop-failure')process.exit(1);}
else if(a.includes('instrument')){const selector=a[a.indexOf('class')+1],parts=selector.split('#'),cls=parts[0],method=parts[1]||'reviewedNativeCreateReadUpdateDeleteAndStaleRevision';for(const code of mode==='stop-failure'?[1]:[1,0])console.log('INSTRUMENTATION_STATUS: class='+cls+'\\nINSTRUMENTATION_STATUS: test='+method+'\\nINSTRUMENTATION_STATUS: numtests=1\\nINSTRUMENTATION_STATUS_CODE: '+code);console.log('OK (1 test)\\nINSTRUMENTATION_CODE: -1');}
else if(a.includes('start-user')||a.includes('stop-user')||a.includes('grant')||a[1]==='input'||a[1]==='wm'){}
else {console.error('Unexpected command '+JSON.stringify(a));process.exit(1);}
`,{mode:0o700});
  const prefix=`ALPHA_${kind.toUpperCase()}`,run=spawnSync(process.execPath,[path.resolve(`scripts/test-${kind}-upgrade.mjs`),...(bridge?['--bridge']:[]),...(mode==='baseline-process'?['--baseline-process-runner']:[])],{encoding:'utf8',timeout:120000,env:{...process.env,ANDROID_HOME:root,ELIZA_DEVICE_LEASE_DIR:path.join(root,'leases'),[`${prefix}_TEST_ROOT`]:root,[`${prefix}_BASELINE_DIR`]:path.join(root,'baseline'),[`${prefix}_TEST_SERIAL`]:'emulator-5596',[`${prefix}_TEST_AVD`]:'owned-fixture',[`${prefix}_TEST_ABI`]:'x86_64'}});
  // Source authentication alone can exceed the old whole-fixture deadline.
  // Surface process failures before reading output that may never have been created.
  assert.ifError(run.error);
  const reports=fs.existsSync(path.join(root,'test-results'))?fs.readdirSync(path.join(root,'test-results')).flatMap(dir=>fs.readdirSync(path.join(root,'test-results',dir)).flatMap(variant=>{const file=path.join(root,'test-results',dir,variant,'result.json');return fs.existsSync(file)?[JSON.parse(fs.readFileSync(file,'utf8'))]:[];})):[];
  return {status:run.status,stderr:run.stderr,commands:fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse),state:JSON.parse(fs.readFileSync(state,'utf8')),reports};
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
for(const kind of ['calendar','reminder'])test(`${kind} upgrade delegates both variants and restores its owned fixture`,()=>{
 const r=exercise(kind,'pass',kind==='calendar');assert.equal(r.status,0,r.stderr);assert.equal(r.reports.length,2);assert.ok(r.reports.every(p=>p.passed&&p.ownerRestored&&!p.cleanupDeferred));assert.deepEqual(r.state.files,{});assert.equal(r.state.exists,false);assert.equal(r.state.user,'0');
 assert.equal(r.commands.filter(a=>a.includes('instrument')).length,kind==='calendar'?6:4);
 if(kind==='reminder')assert.ok(r.reports.every(p=>p.intentPreservation.passed&&p.intentPreservation.routes===3));else assert.ok(r.reports.every(p=>p.bridge.totalTests===1));
});
test('changed reminder intent routes fail without running candidate acceptance',()=>{
 const r=exercise('reminder','changed-intents');assert.notEqual(r.status,0);assert.match(r.stderr,/intent routes/);assert.equal(r.commands.filter(a=>a.includes('instrument')).length,1);assert.equal(r.state.exists,false);assert.deepEqual(r.state.files,{});
});
test('uncertain process termination preserves both APKs and the owned secondary user',()=>{
 const r=exercise('calendar','stop-failure');assert.notEqual(r.status,0);assert.equal(r.state.exists,true);assert.equal(Object.keys(r.state.files).length,2);assert.equal(r.state.user,'0');assert.equal(r.reports[0].cleanupDeferred,true);assert.ok(!r.commands.some(a=>a[0]==='uninstall'||a.includes('remove-user')));
});
test('existing product registration is rejected before a user or installation is created',()=>{
 const r=exercise('calendar','existing');assert.notEqual(r.status,0);assert.match(r.stderr,/Existing package registration/);assert.ok(!r.commands.some(a=>a[0]==='install'||a.includes('create-user')||a[0]==='uninstall'));
});

test('failed owner restoration retains the secondary user for recovery',()=>{
 const r=exercise('calendar','restore-failure');assert.notEqual(r.status,0);assert.equal(r.state.exists,true);assert.equal(r.reports[0].cleanupDeferred,true);assert.ok(!r.commands.some(a=>a.includes('remove-user')));
});

test('reminder can explicitly admit the known process runner in a newer baseline',()=>{
 const r=exercise('reminder','baseline-process');assert.equal(r.status,0,r.stderr);assert.equal(r.reports.length,2);
});
for(const mode of ['baseline-undeclared','candidate-missing-runner'])test(`reminder rejects ${mode} before installing any APK`,()=>{
 const r=exercise('reminder',mode);assert.notEqual(r.status,0);assert.ok(!r.commands.some(a=>a[0]==='install'));assert.deepEqual(r.state.files,{});assert.equal(r.reports[0].cleanupDeferred,true);
});
