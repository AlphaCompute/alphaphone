import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {androidEnv} from './toolchain.mjs';

// Destructive to emulator uptime only. Pass matching archived APKs; never a physical device.
const [appApk,testApk,output='test-results/reminder-recovery']=process.argv.slice(2);
const serial=process.env.ANDROID_SERIAL;
if(!appApk||!testApk||!/^emulator-\d+$/.test(serial||''))throw Error('Usage: ANDROID_SERIAL=emulator-N node scripts/test-reminder-recovery.mjs APP.apk MATCHING_TEST.apk [OUTPUT]');
const env=androidEnv(),adb=path.join(env.ANDROID_HOME,'platform-tools/adb'),appId=JSON.parse(fs.readFileSync('app.config.json')).appId;
const run=(...args)=>execFileSync(adb,['-s',serial,...args],{env,encoding:'utf8',timeout:args.includes('instrument')?180000:120000});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const evidence={appApk:path.resolve(appApk),appSha256:hash(appApk),testApk:path.resolve(testApk),testSha256:hash(testApk),serial,phases:[],passed:false};
fs.mkdirSync(output,{recursive:true});
const phase=name=>{const log=run('shell','am','instrument','-w','-r','-e','class',`${appId}.ReminderRecoveryInstrumentedTest#permissionAndRebootPhase`,'-e','reminderPhase',name,`${appId}.test/androidx.test.runner.AndroidJUnitRunner`);fs.writeFileSync(path.join(output,`${name}.txt`),log);const passed=/OK \(1 test\)/.test(log)&&!/FAILURES|INSTRUMENTATION_FAILED|Process crashed/.test(log);evidence.phases.push({name,passed});if(!passed)throw Error(`Reminder ${name} failed; see saved instrumentation output`);};
// Read only the two named fixture/store preferences; retain only the selected test
// record's status/timestamps. Never dump general app data or notification contents.
const xmlString=(file,key)=>{
 const xml=run('shell','run-as',appId,'cat',`shared_prefs/${file}.xml`);
 const escaped=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const match=xml.match(new RegExp(`<string name="${escaped}">([\\s\\S]*?)</string>`));
 if(!match)return null;
 return match[1].replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
};
const stopped=()=>{
 const state=run('shell','dumpsys','package',appId).split('\n').find(line=>/User 0:/.test(line));
 const match=state?.match(/\bstopped=(true|false)\b/);return match?match[1]==='true':null;
};
const witness=id=>{
 const raw=xmlString('alpha-local-reminders-v1',id),row=raw?JSON.parse(raw):null;
 const notification=run('shell','cmd','notification','list').split('\n').some(key=>{const fields=key.trim().split('|');return fields[1]===appId&&fields[2]==='0'&&fields[3]===id;});
 return {status:row?.status??'missing',at:row?.at??null,postedAt:row?.postedAt??null,notification,stopped:stopped()};
};
const permission='android.permission.POST_NOTIFICATIONS';
let failure,originalGranted;
try{
 run('install','--no-incremental','-r',appApk);run('install','--no-incremental','-r',testApk);
 if(Number(run('shell','getprop','ro.build.version.sdk').trim())<33)throw Error('Permission-revocation flow requires Android 13+');
 originalGranted=/android.permission.POST_NOTIFICATIONS: granted=true/.test(run('shell','dumpsys','package',appId));
 run('shell','pm','grant',appId,permission);phase('prepare');
 run('shell','pm','revoke',appId,permission);phase('denied');
 run('shell','pm','grant',appId,permission);phase('retry');phase('prepare-reboot');
 const fixtureId=xmlString('alpha-reminder-recovery-test','id');
 if(!/^recovery_[A-Za-z0-9_-]+$/.test(fixtureId||''))throw Error('Expected fixture ID is missing');
 evidence.fixtureId=fixtureId;evidence.beforeReboot=witness(fixtureId);
 if(evidence.beforeReboot.status!=='scheduled'||evidence.beforeReboot.notification||evidence.beforeReboot.stopped!==false)throw Error('Pre-reboot fixture must be scheduled, unposted, and package not stopped');
 evidence.bootBefore=run('shell','cat','/proc/sys/kernel/random/boot_id').trim();
 run('reboot');run('wait-for-device');
 const deadline=Date.now()+120000;
 while(run('shell','getprop','sys.boot_completed').trim()!=='1'){
  if(Date.now()>deadline)throw Error('Emulator did not finish reboot');
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 evidence.bootAfter=run('shell','cat','/proc/sys/kernel/random/boot_id').trim();
 if(evidence.bootBefore===evidence.bootAfter)throw Error('Actual reboot was not verified');
 run('shell','input','keyevent','82');
 // No instrumentation: Android's default startInstrumentation force-stops its
 // target and can cancel the very alarm this phase is meant to observe.
 const deliveryDeadline=Date.now()+90000;evidence.rebootObservations=[];
 while(true){
  const observed=witness(fixtureId);
  const previous=evidence.rebootObservations.at(-1);
  if(!previous||JSON.stringify(previous.state)!==JSON.stringify(observed))evidence.rebootObservations.push({elapsedMs:90000-(deliveryDeadline-Date.now()),state:observed});
  if(observed.status==='posted'&&observed.notification&&observed.postedAt>=observed.at)break;
  if(Date.now()>deliveryDeadline)throw Error('Reboot did not produce a stored posted receipt and exact fixture notification; see external observations');
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 if(xmlString('alpha-local-reminders-v1',fixtureId+'_damaged')!=='invalid-json')throw Error('Malformed fixture was unexpectedly erased');
 evidence.phases.push({name:'verify-reboot-external',passed:true});evidence.passed=true;
}catch(error){failure=error;evidence.error=error.message;}
finally{
 try{phase('cleanup');}catch(error){failure??=error;evidence.passed=false;evidence.cleanupError=error.message;}
 if(originalGranted===false)try{run('shell','pm','revoke',appId,permission);}catch(error){failure??=error;evidence.passed=false;}
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(evidence,null,2));
}
if(failure)throw failure;
console.log('PASS permission-revoked delivery remains visible; explicit UI retry preserves ID; actual reboot restores a real notification.');
