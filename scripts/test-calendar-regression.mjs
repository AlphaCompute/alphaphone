/** Alpha Calendar scenarios; upstream owns leased APK and disposable-user lifecycles.
 * Each case is one class, or one exact method of it, run in a fresh secondary user that is granted
 * READ_CALENDAR and WRITE_CALENDAR. `--case=` takes a class name (every case of that class) or
 * `Class#method`; `--variant=` takes standalone or launcher. A class listed with two methods keeps
 * the class-named result folder for its first case and adds `-<method>` for the others.
 * Emulator-class evidence only: no synced account, no live calendar and no device acceptance. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {verifyPinnedUpstream} from './pinned-upstream-source.mjs';
const repository=path.resolve(import.meta.dirname,'..');
verifyPinnedUpstream(repository);
const {runIsolatedAndroidTest}=await import('../vendor/eliza/packages/app/scripts/lib/isolated-android-test.mjs');
const {withIsolatedAndroidUser}=await import('../vendor/eliza/packages/app/scripts/lib/isolated-android-user.mjs');
const {acquireDeviceLease}=await import('../vendor/eliza/packages/app/scripts/lib/device-lease.ts');
const root=process.env.ALPHA_CALENDAR_TEST_ROOT??repository,serial=process.env.ALPHA_CALENDAR_TEST_SERIAL,avd=process.env.ALPHA_CALENDAR_TEST_AVD,abi=process.env.ALPHA_CALENDAR_TEST_ABI;
assert.match(serial??'',/^emulator-\d+$/);assert.match(avd??'',/^[A-Za-z0-9_.-]+$/);assert.ok(['x86_64','arm64-v8a'].includes(abi),'Explicit owned fixture ABI required');
const sdk=process.env.ANDROID_HOME??process.env.ANDROID_SDK_ROOT;assert.ok(sdk&&path.isAbsolute(sdk),'Provide an absolute Android SDK path');
const adb=path.join(sdk,'platform-tools/adb'),aapt=path.join(sdk,'build-tools/36.0.0/aapt');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'app.config.json'),'utf8')).appId;assert.equal(pkg,'ai.elizaresearch.alphaphone');
const args=process.argv.slice(2),external=args.includes('--external');
assert.ok(args.every(arg=>arg==='--external'||/^--(?:case|variant)=.+$/.test(arg)),'Unknown Calendar option');
assert.equal(new Set(args.map(arg=>arg.split('=')[0])).size,args.length,'Duplicate Calendar option');
const companion={packageName:'ws.xsoh.etar',apk:path.join(root,'artifacts/calendar-external/ws.xsoh.etar_57.apk'),sha256:'dae01d93c8920aa63845868db2190bcc4aa6ff8410b1289de1ce27b1bb89c599'};
const cases=external?[['CalendarExternalEditorInstrumentedTest','externalCalendar',1,'complexExistingEventOpensEtarCancelsAndSavesSameProviderRow']]:[['CalendarCreationRecoveryInstrumentedTest','calendarCreationRecovery',1],['CalendarFlowInstrumentedTest','calendarFlow',5],['CalendarCrudInstrumentedTest','calendarCrud',2],['CalendarAgentCrudInstrumentedTest','calendarAgent',1,'reviewedNativeCreateReadUpdateDeleteAndStaleRevision'],
 // J01-6: an all-day, a chosen-zone and a repeating direct save, each read back from the provider.
 ['CalendarAgentCrudInstrumentedTest','calendarOptions',1,'directSaveReadsBackAllDayChosenZoneAndRrule'],
 // The free/busy reader beneath the reviewed availability check. It has no opt-in argument: it skips
 // unless both calendar permissions are granted, which this runner does before every case.
 ['CalendarAvailabilityInstrumentedTest','calendarAvailability',4],
 ['CalendarRangeInstrumentedTest','calendarRange',1,'distantDatesLoadRealRowsAndNewestNavigationWins'],['CalendarTruncationInstrumentedTest','calendarRange',1,'realInstanceLimitCannotClaimAnUnreturnedDateIsFree']];
const requestedCase=args.find(arg=>arg.startsWith('--case='))?.slice(7),requestedVariant=args.find(arg=>arg.startsWith('--variant='))?.slice(10);
const selects=([name,,,method])=>!requestedCase||name===requestedCase||`${name}#${method}`===requestedCase;
const folder=([name,,,method])=>cases.find(([first])=>first===name)[3]===method?name:`${name}-${method}`;
assert.ok(!requestedCase||cases.some(selects),'Unknown Calendar case');assert.ok(!requestedVariant||['standalone','launcher'].includes(requestedVariant),'Unknown variant');
const output=path.join(root,'test-results',`calendar-regression-${Date.now()}-${process.pid}`),cancellation=new AbortController(),cancel=()=>cancellation.abort();
const call=(...args)=>execFileSync(adb,['-s',serial,...args],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024}).trim();
const lease=await acquireDeviceLease(`android:${serial}`,{waitMs:0,ttlMs:Number.MAX_SAFE_INTEGER});
process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
try{
 fs.mkdirSync(output,{recursive:true});
 for(const variant of ['standalone','launcher'].filter(v=>!requestedVariant||v===requestedVariant))for(const [testClass,flag,count,testMethod]of cases.filter(selects)){
  cancellation.signal.throwIfAborted();
  const directory=path.join(output,`${variant}-${folder([testClass,flag,count,testMethod])}`);fs.mkdirSync(directory);
  const record={serial,avd,abi,variant,testClass,...(testMethod?{testMethod}:{}),gate:flag,expectedTests:count,passed:false};let failure;
  const persist=()=>fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify(record,null,2)+'\n');
  try{
   const installed=call('shell','pm','list','packages','-u','--user','all').split(/\r?\n/);
   assert.ok(![pkg,`${pkg}.test`,...(external?[companion.packageName]:[])].some(name=>installed.includes(`package:${name}`)),'Existing package registration; refusing replacement');
   await withIsolatedAndroidUser({serial,deviceLease:lease,expectedAvdName:avd,homePackage:process.env.ALPHA_TEST_HOME_PACKAGE??'com.android.launcher3',name:`calendar-${variant}-${Date.now()}`,signal:cancellation.signal,execute:args=>call(...args),record:state=>{record.userLifecycle=state;persist();},run:async({user})=>{
    record.user=user;
    try{
     record.result=await runIsolatedAndroidTest({serial,adb,aapt,packageName:pkg,additionalInstrumentationRunners:[pkg+'.WorkflowNoticeProcessRunner'],testClass:`${pkg}.${testClass}`,testMethod,expectedTests:count,requiredAbi:abi,expectedAvdName:avd,androidUser:user,deviceLease:lease,directory,signal:cancellation.signal,commandTimeoutMs:120000,instrumentationTimeoutMs:external?300000:['calendarRange','calendarCrud','calendarAgent','calendarOptions','calendarAvailability'].includes(flag)?240000:120000,cleanupTimeoutMs:120000,
      variants:[{name:variant,apk:path.join(root,'artifacts',`${variant}-debug.apk`),testApk:path.join(root,'android/app/build/outputs/apk/androidTest',variant,'debug',`app-${variant}-debug-androidTest.apk`)}],companionApks:external?[companion]:[],runnerArgs:['-e',flag,external?'true':'1'],
      evidence:'Alpha Calendar regression in an owned secondary emulator user. No live account acceptance.',
      collectVariant:external?()=>{
       const receipt=JSON.parse(call('shell','run-as',pkg,'--user',String(user),'cat','files/external-calendar-result.json'));
       for(const field of ['implicitHandoff','cancelUnchanged','saveSameRowAndEpochs','returnedToAlpha','fixtureCleaned','timezoneUnchanged'])assert.equal(receipt[field],true,field);
       assert.equal(receipt.etarVersion,57);assert.equal(receipt.signerSha256,'3f3176c3ce189c98054ff9e1d32daecf00a41572f4c7bd2b2f80607252ddb06e');
       record.externalEditorReceipt=receipt;persist();
      }:undefined,
      prepareVariant:()=>{for(const name of [pkg,...(external?[companion.packageName]:[])])for(const permission of ['READ_CALENDAR','WRITE_CALENDAR'])call('shell','pm','grant','--user',String(user),name,`android.permission.${permission}`);},
     });
    }catch(error){failure=error;record.error=error.message;}
    let proof;try{proof=JSON.parse(fs.readFileSync(path.join(directory,'verification.json'),'utf8'));}catch{/* Missing cleanup evidence preserves the owned user. */}
    return {cleaned:proof?.cleaned===true,cleanupDeferred:proof?.cleanupDeferred===true};
   }});
  }catch(error){failure??=error;record.error=failure.message;}
  finally{record.passed=!failure;persist();}
  if(failure)throw failure;
 }
 console.log(output);
}finally{process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);lease.release();}
