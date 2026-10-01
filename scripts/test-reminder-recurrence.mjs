import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {androidEnv} from './toolchain.mjs';

const [appApk,testApk,output='test-results/reminder-recurrence']=process.argv.slice(2);
const serial=process.env.ANDROID_SERIAL;
if(!appApk||!testApk||!/^emulator-\d+$/.test(serial||''))throw Error('Usage: ANDROID_SERIAL=emulator-N node scripts/test-reminder-recurrence.mjs APP.apk MATCHING_TEST.apk [OUTPUT]');
const env=androidEnv(),adb=path.join(env.ANDROID_HOME,'platform-tools/adb'),appId=JSON.parse(fs.readFileSync('app.config.json')).appId;
const run=(...args)=>execFileSync(adb,['-s',serial,...args],{env,encoding:'utf8',timeout:args.includes('instrument')?960000:120000});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const evidence={appApk:path.resolve(appApk),appSha256:hash(appApk),testApk:path.resolve(testApk),testSha256:hash(testApk),serial,passed:false};
fs.mkdirSync(output,{recursive:true});
const permission='android.permission.POST_NOTIFICATIONS';let failure,originalGranted;
try{
 run('install','--no-incremental','-r',appApk);run('install','--no-incremental','-r',testApk);
 if(Number(run('shell','getprop','ro.build.version.sdk').trim())<33)throw Error('Scoped grant/restore runner requires Android 13+');
 originalGranted=/android.permission.POST_NOTIFICATIONS: granted=true/.test(run('shell','dumpsys','package',appId));evidence.originalGranted=originalGranted;
 if(!originalGranted)run('shell','pm','grant',appId,permission);
 const log=run('shell','am','instrument','-w','-r','-e','class',`${appId}.ReminderRecurrenceInstrumentedTest`,'-e','recurrenceAlarm','1',`${appId}.test/androidx.test.runner.AndroidJUnitRunner`);
 fs.writeFileSync(path.join(output,'instrumentation.txt'),log);
 if(!/OK \(2 tests\)/.test(log)||/FAILURES|INSTRUMENTATION_FAILED|Process crashed/.test(log))throw Error('Recurrence native tests failed; see instrumentation.txt');
 evidence.passed=true;
}catch(error){failure=error;evidence.error=error.message;}
finally{
 if(originalGranted===false)try{run('shell','pm','revoke',appId,permission);}catch(error){failure??=error;evidence.passed=false;evidence.restoreError=error.message;}
 if(originalGranted!==undefined)try{
  const restored=/android.permission.POST_NOTIFICATIONS: granted=true/.test(run('shell','dumpsys','package',appId));evidence.permissionRestored=restored===originalGranted;
  if(!evidence.permissionRestored)throw Error('Original notification permission was not restored');
 }catch(error){failure??=error;evidence.passed=false;evidence.restoreError=error.message;}
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(evidence,null,2));
}
if(failure)throw failure;
console.log('PASS two native recurrence flows; original notification permission restored externally.');
