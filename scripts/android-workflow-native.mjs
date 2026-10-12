/** Archived workflow scenarios; upstream owns leased APK and disposable-user lifecycles.
 * Phases: `workflow` (phone-step reads and drafts) and `approval-notice` (phone-step approval
 * notice builders, OS posting, tap route and withdrawal, and the tap fenced after an account change). Every case runs on both distributions
 * from one hash-admitted archive pair; any failed, skipped or missing case fails the campaign.
 * `--variant=standalone|launcher` and `--phase=workflow|approval-notice` run part of it, for the
 * cases left after a failure stopped an earlier run: the report then carries `selection` and
 * `selectionPassed`, and `passed` (the whole campaign) stays false.
 * The archive is `node scripts/build-archive.mjs` output, or for developer APKs the folder
 * `node scripts/developer-archive.mjs` assembles from a verified `artifacts/` build.
 * Emulator-class evidence only: no paired host, live workflow, account or device acceptance. */
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
const options=process.argv.slice(2);
assert.ok(options.every(arg=>/^--(?:variant|phase)=.+$/.test(arg)),'Unknown workflow campaign option');assert.equal(new Set(options.map(arg=>arg.split('=')[0])).size,options.length,'Duplicate workflow campaign option');
const requestedVariant=options.find(arg=>arg.startsWith('--variant='))?.slice(10),requestedPhase=options.find(arg=>arg.startsWith('--phase='))?.slice(8);
assert.ok(!requestedVariant||['standalone','launcher'].includes(requestedVariant),'Unknown variant');assert.ok(!requestedPhase||['workflow','approval-notice'].includes(requestedPhase),'Unknown phase');
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
const cases=[{class:'WorkflowPhoneNativeInstrumentedTest',method:'privateReadResultSurvivesRecreationButNeverExpandsPassiveHistory',gate:'workflowPhoneNative',grant:true}, {class:'WorkflowPhoneNativeInstrumentedTest',method:'selectedCalendarQueryExcludesOtherAccountsAndRefusesOverflow',gate:'workflowPhoneNative',grant:true}, {class:'WorkflowPhoneNativeInstrumentedTest',method:'morningAndEveningShareOneCalendarSourceWithDistinctWindows',gate:'workflowPhoneNative',grant:true}, {class:'WorkflowPhoneNativeInstrumentedTest',method:'deniedCalendarGrantReturnsNoEvents',gate:'workflowPhoneDenied',grant:false}, {class:'WorkflowDraftNativeInstrumentedTest',method:'encryptedDraftIsAtomicAndSurvivesRecreation',gate:'workflowDraftNative',grant:false},
 {class:'WorkflowApprovalNoticeInstrumentedTest',method:'approvalAndStepBuildersAreRedactedAndExpire',gate:'workflowApprovalNotice',grant:false,phase:'approval-notice'},
 // The OS post and tap need the runtime notification permission in the owned secondary user.
 {class:'WorkflowApprovalNoticeInstrumentedTest',method:'approvalNoticeOpensItsRunOnceAndIsWithdrawnOnDecision',gate:'workflowApprovalNotice',grant:false,notifications:true,phase:'approval-notice'},
 // MVP-18: a tap after the account changed is fenced to the other-account state; no stale approval opens.
 // Its process-death counterpart needs the separate runner process: scripts/ci/pending-recovery-ui.py
 // phase workflow-approval-process-death (WorkflowNoticeProcessDeathInstrumentedTest).
 {class:'WorkflowApprovalNoticeInstrumentedTest',method:'approvalNoticeTapAfterAccountChangeIsFencedWithoutAStaleApproval',gate:'workflowApprovalNotice',grant:false,notifications:true,phase:'approval-notice'}];
const phaseOf=test=>test.phase??'workflow';
const cancellation=new AbortController(),cancel=()=>cancellation.abort();
const execute=promisify(execFile);
const call=async(args,signal)=>String((await execute(adb,['-s',serial,...args],{env,encoding:'utf8',timeout:120000,killSignal:'SIGKILL',maxBuffer:4*1024*1024,signal})).stdout).trim();
const lease=await acquireDeviceLease(`android:${serial}`,{waitMs:0,ttlMs:Number.MAX_SAFE_INTEGER});
const variants=['standalone','launcher'];
// The exact pair every case installs: each case's preflight binds upstream's pinned bytes to these
// hashes, and upstream re-checks the installed bytes before each instrumentation.
const apks=Object.fromEntries(variants.map(variant=>[variant,{appSha256:manifest[`${variant}-debug.apk`],testSha256:manifest[`${variant}-androidTest.apk`]}]));
// A selection runs fewer cases; the report always lists the whole campaign, so the rest read not-run.
const selectedVariants=variants.filter(variant=>!requestedVariant||variant===requestedVariant),selectedCases=cases.filter(test=>!requestedPhase||phaseOf(test)===requestedPhase);
const selection=requestedVariant||requestedPhase?{variants:selectedVariants,phases:[...new Set(selectedCases.map(phaseOf))]}:null;
const report={serial,avd,abi,archive,apks,nativeOnly:true,pairedHostTested:false,allWorkflowFlowsAccepted:false,passed:false,...(selection?{selection,selectionPassed:false}:{}),phases:{},results:[]};
const summarize=()=>{report.phases={};for(const test of cases){const name=phaseOf(test),phase=report.phases[name]??={expected:0,passed:0,cases:[]};for(const variant of variants){const method=test.class+'#'+test.method,row=report.results.find(item=>item.variant===variant&&item.method===method);phase.expected++;if(row?.passed)phase.passed++;phase.cases.push({variant,method,status:row?(row.passed?'passed':'failed'):'not-run'});}}for(const phase of Object.values(report.phases))phase.complete=phase.passed===phase.expected;report.passed=Object.values(report.phases).every(phase=>phase.complete);};
const persist=()=>{summarize();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');};
process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
try{
 fs.mkdirSync(output,{recursive:true});
 for(const variant of selectedVariants)for(const test of selectedCases){
  cancellation.signal.throwIfAborted();
  const directory=path.join(output,variant+'-'+test.method);fs.mkdirSync(directory);
  const record={variant,phase:phaseOf(test),method:test.class+'#'+test.method,...apks[variant],passed:false};report.results.push(record);let failure;
  try{
   const installed=(await call(['shell','pm','list','packages','-u','--user','all'],cancellation.signal)).split(/\r?\n/);
   assert.ok(![pkg,pkg+'.test'].some(name=>installed.includes('package:'+name)),'Existing package registration; refusing replacement');
   await withIsolatedAndroidUser({serial,deviceLease:lease,expectedAvdName:avd,homePackage:process.env.ALPHA_TEST_HOME_PACKAGE??'com.android.launcher3',name:`workflow-${variant}-${Date.now()}`,signal:cancellation.signal,execute:(args,{signal})=>call(args,signal),record:state=>{record.userLifecycle=state;persist();},run:async({user})=>{
    record.user=user;
    try{
     record.result=await runIsolatedAndroidTest({serial,adb,aapt,env,packageName:pkg,additionalInstrumentationRunners:[pkg+'.WorkflowNoticeProcessRunner'],testClass:pkg+'.'+test.class,testMethod:test.method,expectedTests:1,requiredAbi:abi,expectedAvdName:avd,androidUser:user,deviceLease:lease,directory,signal:cancellation.signal,commandTimeoutMs:120000,instrumentationTimeoutMs:240000,cleanupTimeoutMs:120000,
      variants:[{name:variant,apk:path.join(archive,variant+'-debug.apk'),testApk:path.join(archive,variant+'-androidTest.apk')}],runnerArgs:['-e',test.gate,'1'],
      evidence:'Synthetic native workflow fixture in an owned secondary emulator user; no paired host or live workflow acceptance.',
      // The bytes upstream pins and installs are the manifest pair this report records, checked before any install.
      preflightVariant:({record:pinned})=>{assert.equal(pinned.appSha256,apks[variant].appSha256,'App changed after archive admission');assert.equal(pinned.testSha256,apks[variant].testSha256,'Test APK changed after archive admission');},
      prepareVariant:async()=>{for(const permission of ['READ_CALENDAR','WRITE_CALENDAR']){await call(['shell','pm',test.grant?'grant':'revoke','--user',String(user),pkg,'android.permission.'+permission],cancellation.signal);await call(['shell','pm','clear-permission-flags','--user',String(user),pkg,'android.permission.'+permission,'user-set','user-fixed'],cancellation.signal);}
       if(test.notifications!==undefined){await call(['shell','pm',test.notifications?'grant':'revoke','--user',String(user),pkg,'android.permission.POST_NOTIFICATIONS'],cancellation.signal);await call(['shell','pm','clear-permission-flags','--user',String(user),pkg,'android.permission.POST_NOTIFICATIONS','user-set','user-fixed'],cancellation.signal);}},
     });
    }catch(error){failure=error;record.error=error.message;}
    let proof;try{proof=JSON.parse(fs.readFileSync(path.join(directory,'verification.json')));}catch{/* Retain the fixture if cleanup is unproven. */}
    return {cleaned:proof?.cleaned===true,cleanupDeferred:proof?.cleanupDeferred===true};
   }});
  }catch(error){failure??=error;record.error=failure.message;}
  finally{record.passed=!failure;persist();}
  // Explicit propagation: the first failed case stops the campaign, is named in the report and fails the process.
  if(failure){report.failure={variant,phase:record.phase,method:record.method,message:failure.message};persist();process.exitCode=1;throw failure;}
 }
 summarize();
 // A campaign that returns without every case of every phase on both distributions is not a pass.
 if(selection){report.selectionPassed=report.results.length===selectedVariants.length*selectedCases.length&&report.results.every(row=>row.passed);persist();assert.ok(report.selectionPassed,'Selected workflow native cases are incomplete');}
 else assert.ok(report.passed&&report.results.length===variants.length*cases.length,'Workflow native campaign is incomplete');
 persist();
 console.log(output);
}finally{process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);lease.release();}
