/** Archived workflow scenarios; upstream owns leased APK and disposable-user lifecycles. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {androidEnv} from './toolchain.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {verifyPinnedUpstream} from './pinned-upstream-source.mjs';
const repository=path.resolve(import.meta.dirname,'..');
verifyPinnedUpstream(repository);
const {runIsolatedAndroidTest}=await import('../vendor/eliza/packages/app/scripts/lib/isolated-android-test.mjs');
const {withIsolatedAndroidUser}=await import('../vendor/eliza/packages/app/scripts/lib/isolated-android-user.mjs');
const {acquireDeviceLease}=await import('../vendor/eliza/packages/app/scripts/lib/device-lease.ts');
const serial=process.env.ANDROID_SERIAL,avd=process.env.ALPHA_WORKFLOW_TEST_AVD,abi=process.env.ALPHA_WORKFLOW_TEST_ABI;
assert.match(serial??'',/^emulator-\d+$/);assert.match(avd??'',/^[A-Za-z0-9_.-]+$/);assert.ok(['x86_64','arm64-v8a'].includes(abi),'Explicit owned emulator ABI required');
assert.ok(process.env.ALPHA_BUILD_ARCHIVE,'Set ALPHA_BUILD_ARCHIVE');
const archive=path.resolve(process.env.ALPHA_BUILD_ARCHIVE),output=path.resolve(process.env.ALPHA_CAMPAIGN_OUTPUT??path.join(archive,'workflow-native'));
assert.ok(output.startsWith(path.resolve('test-results')+path.sep),'Evidence must remain beneath test-results');assert.ok(!fs.existsSync(output),'Use a new evidence folder');
const env=androidEnv(),adb=path.join(env.ANDROID_HOME,'platform-tools/adb'),aapt=path.join(env.ANDROID_HOME,'build-tools/36.0.0/aapt');
const pkg=JSON.parse(fs.readFileSync('app.config.json')).appId;assert.equal(pkg,'ai.elizaresearch.alphaphone');
const manifest=JSON.parse(fs.readFileSync(path.join(archive,'apk-manifest.json')));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for(const variant of ['standalone','launcher'])for(const kind of ['debug','androidTest']){
 const name=`${variant}-${kind}.apk`;assert.equal(hash(path.join(archive,name)),manifest[name],'Immutable archive hash mismatch');
}
const cases=[{class:'WorkflowPhoneNativeInstrumentedTest',method:'privateReadResultSurvivesRecreationButNeverExpandsPassiveHistory',gate:'workflowPhoneNative',grant:true}, {class:'WorkflowPhoneNativeInstrumentedTest',method:'selectedCalendarQueryExcludesOtherAccountsAndRefusesOverflow',gate:'workflowPhoneNative',grant:true}, {class:'WorkflowPhoneNativeInstrumentedTest',method:'morningAndEveningShareOneCalendarSourceWithDistinctWindows',gate:'workflowPhoneNative',grant:true}, {class:'WorkflowPhoneNativeInstrumentedTest',method:'deniedCalendarGrantReturnsNoEvents',gate:'workflowPhoneDenied',grant:false}, {class:'WorkflowDraftNativeInstrumentedTest',method:'encryptedDraftIsAtomicAndSurvivesRecreation',gate:'workflowDraftNative',grant:false}];
const cancellation=new AbortController(),cancel=()=>cancellation.abort();
const execute=promisify(execFile);
const call=async(args,signal)=>String((await execute(adb,['-s',serial,...args],{env,encoding:'utf8',timeout:120000,killSignal:'SIGKILL',maxBuffer:4*1024*1024,signal})).stdout).trim();
const lease=await acquireDeviceLease(`android:${serial}`,{waitMs:0,ttlMs:Number.MAX_SAFE_INTEGER});
const report={serial,avd,abi,archive,nativeOnly:true,pairedHostTested:false,allWorkflowFlowsAccepted:false,results:[]};
const persist=()=>fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');
process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
try{
 fs.mkdirSync(output,{recursive:true});
 for(const variant of ['standalone','launcher'])for(const test of cases){
  cancellation.signal.throwIfAborted();
  const directory=path.join(output,variant+'-'+test.method);fs.mkdirSync(directory);
  const record={variant,method:test.class+'#'+test.method,passed:false};report.results.push(record);let failure;
  try{
   const installed=(await call(['shell','pm','list','packages','-u','--user','all'],cancellation.signal)).split(/\r?\n/);
   assert.ok(![pkg,pkg+'.test'].some(name=>installed.includes('package:'+name)),'Existing package registration; refusing replacement');
   await withIsolatedAndroidUser({serial,deviceLease:lease,expectedAvdName:avd,homePackage:process.env.ALPHA_TEST_HOME_PACKAGE??'com.android.launcher3',name:`workflow-${variant}-${Date.now()}`,signal:cancellation.signal,execute:(args,{signal})=>call(args,signal),record:state=>{record.userLifecycle=state;persist();},run:async({user})=>{
    record.user=user;
    try{
     record.result=await runIsolatedAndroidTest({serial,adb,aapt,env,packageName:pkg,additionalInstrumentationRunners:[pkg+'.WorkflowNoticeProcessRunner'],testClass:pkg+'.'+test.class,testMethod:test.method,expectedTests:1,requiredAbi:abi,expectedAvdName:avd,androidUser:user,deviceLease:lease,directory,signal:cancellation.signal,commandTimeoutMs:120000,instrumentationTimeoutMs:240000,cleanupTimeoutMs:120000,
      variants:[{name:variant,apk:path.join(archive,variant+'-debug.apk'),testApk:path.join(archive,variant+'-androidTest.apk')}],runnerArgs:['-e',test.gate,'1'],
      evidence:'Synthetic native workflow fixture in an owned secondary emulator user; no paired host or live workflow acceptance.',
      prepareVariant:async()=>{for(const permission of ['READ_CALENDAR','WRITE_CALENDAR']){await call(['shell','pm',test.grant?'grant':'revoke','--user',String(user),pkg,'android.permission.'+permission],cancellation.signal);await call(['shell','pm','clear-permission-flags','--user',String(user),pkg,'android.permission.'+permission,'user-set','user-fixed'],cancellation.signal);}},
     });
    }catch(error){failure=error;record.error=error.message;}
    let proof;try{proof=JSON.parse(fs.readFileSync(path.join(directory,'verification.json')));}catch{/* Retain the fixture if cleanup is unproven. */}
    return {cleaned:proof?.cleaned===true,cleanupDeferred:proof?.cleanupDeferred===true};
   }});
  }catch(error){failure??=error;record.error=failure.message;}
  finally{record.passed=!failure;persist();}
  if(failure)throw failure;
 }
 console.log(output);
}finally{process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);lease.release();}
