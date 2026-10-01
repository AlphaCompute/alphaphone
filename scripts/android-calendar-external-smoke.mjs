/** Installed pinned Etar + archived Alpha APK pair; no download, forced component or intent interception. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {androidEnv} from './toolchain.mjs';
const env=androidEnv(),serial=process.env.ANDROID_SERIAL,archive=process.env.ALPHA_BUILD_ARCHIVE;
assert.match(serial||'',/^emulator-\d+$/,'Explicit disposable Pixel emulator required');assert.ok(archive,'ALPHA_BUILD_ARCHIVE required');
const etar='ws.xsoh.etar',etarSha='dae01d93c8920aa63845868db2190bcc4aa6ff8410b1289de1ce27b1bb89c599';
const adb=path.join(env.ANDROID_HOME,'platform-tools/adb'),appId=JSON.parse(fs.readFileSync('app.config.json')).appId;
const manifest=JSON.parse(fs.readFileSync(path.join(archive,'apk-manifest.json'))),out=process.env.ALPHA_CALENDAR_EXTERNAL_RESULTS||path.join(archive,'external-calendar');fs.mkdirSync(out,{recursive:true});
const run=(args,encoding='utf8')=>execFileSync(adb,['-s',serial,...args],{env,encoding,timeout:300000,maxBuffer:24*1024*1024});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const packagePaths=run(['shell','pm','path',etar]).trim().split(/\r?\n/);assert.equal(packagePaths.length,1,'Pinned universal APK only');assert.match(packagePaths[0],/^package:\/data\/app\/[A-Za-z0-9_/.=+~-]+\/base\.apk$/);
const installedSha=hash(run(['exec-out','cat',packagePaths[0].slice(8)],null));assert.equal(installedSha,etarSha,'Installed Etar bytes must match official F-Droid pin');
const results=[];
for(const variant of ['standalone','launcher']){
 const apk=path.join(archive,variant+'-debug.apk'),testApk=path.join(archive,variant+'-androidTest.apk');const sha256=hash(fs.readFileSync(apk)),testSha256=hash(fs.readFileSync(testApk));
 assert.equal(sha256,manifest[variant+'-debug.apk']);assert.equal(testSha256,manifest[variant+'-androidTest.apk']);
 run(['install','--no-incremental','-r',apk]);run(['install','--no-incremental','-r',testApk]);run(['shell','am','force-stop',appId]);
 const permissions=[];
 for(const pkg of [appId,etar]){
  const dump=run(['shell','dumpsys','package',pkg]);
  for(const permission of ['android.permission.READ_CALENDAR','android.permission.WRITE_CALENDAR']){
   const match=dump.match(new RegExp(permission.replaceAll('.','\\.')+': granted=(true|false)'));
   assert.ok(match,'Known Calendar permission state required');permissions.push({pkg,permission,granted:match[1]==='true'});
  }
 }
 let passed=false,output='',receipt=null,failure;
 try{
  for(const p of permissions)if(!p.granted)run(['shell','pm','grant',p.pkg,p.permission]);
  run(['shell','run-as',appId,'rm','-f','files/external-calendar-result.json']);
  output=run(['shell','am','instrument','-w','-r','-e','externalCalendar','true','-e','class',`${appId}.CalendarExternalEditorInstrumentedTest`,`${appId}.test/androidx.test.runner.AndroidJUnitRunner`]);
  assert.match(output,/OK \(1 test\)/);assert.doesNotMatch(output,/FAILURES|INSTRUMENTATION_FAILED|Process crashed/);
  receipt=JSON.parse(run(['shell','run-as',appId,'cat','files/external-calendar-result.json']));
  for(const field of ['implicitHandoff','cancelUnchanged','saveSameRowAndEpochs','returnedToAlpha','fixtureCleaned','timezoneUnchanged'])assert.equal(receipt[field],true,field);
  assert.equal(receipt.etarVersion,57);assert.equal(receipt.signerSha256,'3f3176c3ce189c98054ff9e1d32daecf00a41572f4c7bd2b2f80607252ddb06e');passed=true;
 }catch(error){failure=String(error.message);output ||=String(error.stdout||'');}
 finally{for(const p of permissions)if(!p.granted)try{run(['shell','pm','revoke',p.pkg,p.permission]);}catch{passed=false;failure='Permission restoration failed';}}
 fs.writeFileSync(path.join(out,variant+'.txt'),output);results.push({variant,sha256,testSha256,passed,failure,receipt});
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({createdAt:new Date().toISOString(),serial,archive,etarInstalledSha256:installedSha,scope:'Real implicit external Etar VIEW/edit/cancel/save and provider identity/epoch readback; overnight fixture, not recurrence/DST fold, Cloud sync or HOME role acceptance',results},null,2)+'\n');
 console.log(`${variant}: ${passed?'passed':'failed'}`);
}
if(results.some(r=>!r.passed))process.exitCode=1;
