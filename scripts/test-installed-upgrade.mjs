import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {verifyPinnedUpstream} from './pinned-upstream-source.mjs';

/** Alpha's fixture policy and scenarios; shared upstream code owns APK lifecycle. */
export async function testInstalledUpgrade(kind){
 assert.ok(['calendar','reminder'].includes(kind));
 const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 verifyPinnedUpstream(repository);
 const {runIsolatedAndroidTest}=await import('../vendor/eliza/packages/app/scripts/lib/isolated-android-test.mjs');
 const {withIsolatedAndroidUser}=await import('../vendor/eliza/packages/app/scripts/lib/isolated-android-user.mjs');
 const {acquireDeviceLease}=await import('../vendor/eliza/packages/app/scripts/lib/device-lease.ts');
 const {requireInstrumentationSuccess}=await import('./instrumentation-result.mjs');
 const prefix=`ALPHA_${kind.toUpperCase()}`,root=process.env[`${prefix}_TEST_ROOT`]??repository;
 const baseline=process.env[`${prefix}_BASELINE_DIR`],serial=process.env[`${prefix}_TEST_SERIAL`],avd=process.env[`${prefix}_TEST_AVD`],abi=process.env[`${prefix}_TEST_ABI`];
 assert.ok(baseline&&path.isAbsolute(baseline),'Provide an absolute baseline directory');
 assert.match(serial??'',/^emulator-\d+$/);assert.match(avd??'',/^[A-Za-z0-9_.-]+$/);
 assert.ok(['arm64-v8a','x86_64'].includes(abi),'Explicit owned fixture ABI required');
 const sdk=process.env.ANDROID_HOME??process.env.ANDROID_SDK_ROOT;
 assert.ok(sdk&&path.isAbsolute(sdk),'Provide absolute ANDROID_HOME or ANDROID_SDK_ROOT');
 const adb=path.join(sdk,'platform-tools/adb'),aapt=path.join(sdk,'build-tools/36.0.0/aapt');
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'app.config.json'),'utf8')).appId,testPkg=`${pkg}.test`;
 assert.equal(pkg,'ai.elizaresearch.alphaphone');
 const bridge=process.argv.includes('--bridge');
 assert.ok(process.argv.slice(2).every(arg=>kind==='calendar'&&arg==='--bridge'),'Unknown upgrade option');
 const cancellation=new AbortController(),cancel=()=>cancellation.abort();
 const call=(...args)=>execFileSync(adb,['-s',serial,...args],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024}).trim();
 const host=kind==='calendar'?'com.android.launcher3':'com.google.android.apps.nexuslauncher';
 const testClass=kind==='calendar'?'CalendarUpgradeInstrumentedTest':'ReminderUpgradeInstrumentedTest';
 const testMethod=kind==='calendar'?'baselineToCandidatePreservesCalendarIdentity':'installedUpgradePreservesIdentityAndReceipts';
 const flag=kind==='calendar'?'calendarUpgradePhase':'reminderUpgrade';
 const output=path.join(root,'test-results',`${kind}-upgrade-${Date.now()}-${process.pid}`);
 const lease=await acquireDeviceLease(`android:${serial}`,{waitMs:0,ttlMs:Number.MAX_SAFE_INTEGER});
 process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
 try{
  fs.mkdirSync(output,{recursive:true});
  for(const variant of ['standalone','launcher']){
   cancellation.signal.throwIfAborted();
   const installed=call('shell','pm','list','packages','-u','--user','all').split(/\r?\n/);
   assert.ok(![pkg,testPkg].some(name=>installed.includes(`package:${name}`)),'Existing package registration; refusing replacement');
   const directory=path.join(output,variant);fs.mkdirSync(directory);
   const candidateTest=path.join(root,'android/app/build/outputs/apk/androidTest',variant,'debug',`app-${variant}-debug-androidTest.apk`);
   const receipt={variant,serial,avd,abi,passed:false};let failure,before;
   const log=(name,value)=>fs.writeFileSync(path.join(directory,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
   const routes=()=>call('shell','dumpsys','activity','intents').split(/\r?\n/).map(line=>line.trim()).filter(line=>line.startsWith('requestIntent=')&&line.includes('cmp='+pkg+'/')&&/dat=alpha-reminder-tap:|dat=alpha-reminder:[^ /]+\//.test(line)).sort();
   try{
    await withIsolatedAndroidUser({serial,deviceLease:lease,expectedAvdName:avd,homePackage:host,name:`${kind}-upgrade-${variant}-${Date.now()}`,signal:cancellation.signal,
     execute:args=>call(...args),record:state=>{receipt.userLifecycle=state;receipt.ownerRestored=state.ownerRestored;receipt.cleanupDeferred=state.cleanupDeferred;log('result.json',receipt);},
     run:async({user})=>{
      receipt.user=user;
      try{
    receipt.result=await runIsolatedAndroidTest({serial,adb,aapt,packageName:pkg,testClass:`${pkg}.${testClass}`,testMethod,requiredAbi:abi,expectedAvdName:avd,androidUser:user,deviceLease:lease,directory,signal:cancellation.signal,commandTimeoutMs:120000,instrumentationTimeoutMs:120000,cleanupTimeoutMs:120000,
     evidence:`Alpha ${kind} installed upgrade in a fresh owned secondary user. No live account acceptance.`,
     variants:[{name:variant,apk:path.join(baseline,`${variant}-debug.apk`),testApk:kind==='reminder'?path.join(baseline,`${variant}-test.apk`):candidateTest,upgrade:{apk:path.join(root,'artifacts',`${variant}-debug.apk`),testApk:candidateTest}}],runnerArgs:['-e',flag,'seed'],upgradeRunnerArgs:['-e',flag,'verify'],
     prepareVariant:()=>{for(const permission of kind==='calendar'?['READ_CALENDAR','WRITE_CALENDAR']:['POST_NOTIFICATIONS'])call('shell','pm','grant','--user',String(user),pkg,`android.permission.${permission}`);},
     beforeUpgrade:()=>{if(kind==='calendar')call('shell','am','force-stop','--user',String(user),pkg);else {before=routes();log('baseline-intents.json',before);assert.ok(before.some(line=>line.includes('dat=alpha-reminder:upgrade_future/'))&&before.some(line=>line.includes('dat=alpha-reminder:upgrade_repeat/'))&&before.some(line=>line.includes('dat=alpha-reminder-tap:')),'Baseline native intent inventory missing');}},
     afterUpgrade:()=>{if(kind==='reminder'){const after=routes();log('candidate-intents.json',after);assert.deepEqual(after,before,'Installed update changed native reminder intent routes');receipt.intentPreservation={passed:true,routes:before.length};}},
     collectVariant:()=>{if(bridge){const cls=`${pkg}.CalendarAgentCrudInstrumentedTest`;let raw;try{raw=call('shell','am','instrument','-r','--user',String(user),'-w','-e','calendarAgent','1','-e','class',cls,`${testPkg}/androidx.test.runner.AndroidJUnitRunner`);}catch(error){log('bridge.log',`${error.stdout??''}\n${error.stderr??''}`);throw error;}log('bridge.log',raw);const result=requireInstrumentationSuccess(raw,[cls]);assert.deepEqual(result.cases,[`${cls}#reviewedNativeCreateReadUpdateDeleteAndStaleRevision`]);assert.equal(result.totalTests,1);receipt.bridge=result;}},
    });
      }catch(error){failure=error;receipt.error=error.message;}
      const proofFile=path.join(directory,'verification.json');let proof;
      try{if(fs.existsSync(proofFile))proof=JSON.parse(fs.readFileSync(proofFile,'utf8'));}catch(error){failure??=error;}
      return {cleaned:proof?.cleaned===true,cleanupDeferred:proof?.cleanupDeferred===true};
     },
    });
   }catch(error){failure??=error;receipt.error=failure.message;}
   finally{receipt.passed=!failure;log('result.json',receipt);}
   if(failure)throw failure;
  }
  console.log(output);
 }finally{process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);lease.release();}
}
