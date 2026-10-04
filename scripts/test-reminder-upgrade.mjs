import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {requireInstrumentationSuccess} from './instrumentation-result.mjs';

const root=process.env.ALPHA_REMINDER_TEST_ROOT??path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseline=process.env.ALPHA_REMINDER_BASELINE_DIR;
const serial=process.env.ALPHA_REMINDER_TEST_SERIAL;
const expected=process.env.ALPHA_REMINDER_TEST_AVD;
if(!baseline||!path.isAbsolute(baseline))throw Error('Provide absolute ALPHA_REMINDER_BASELINE_DIR containing both preserved baseline APKs');
if(!serial||!/^emulator-[0-9]+$/.test(serial)||!expected)throw Error('Explicit owned emulator serial and exact AVD name required');
const identity=JSON.parse(fs.readFileSync(path.join(root,'app.config.json'),'utf8'));
const pkg=identity.appId,testPkg=`${pkg}.test`;
if(pkg!=='ai.elizaresearch.alphaphone')throw Error('Unexpected Alpha package identity');
const adb=path.join(process.env.ANDROID_HOME??path.join(process.env.HOME,'Library/Android/sdk'),'platform-tools/adb');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const call=args=>execFileSync(adb,['-s',serial,...args],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
const wait=(predicate,message,timeoutMs=15000)=>{const until=Date.now()+timeoutMs;while(Date.now()<until){if(predicate())return;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150);}throw Error(message);};
// Reuse upstream's raw protocol parser; require the selected method, not just an OK count.
function requireOneTest(result,label,testClass='ReminderUpgradeInstrumentedTest',method='installedUpgradePreservesIdentityAndReceipts'){
 const expected=`${pkg}.${testClass}`;
 const evidence=requireInstrumentationSuccess(result,[expected]);
 if(evidence.totalTests!==1||evidence.cases[0]!==`${expected}#${method}`)
  throw Error(`${label} did not pass the selected test exactly once`);
}
const avd=call(['emu','avd','name']).split(/\r?\n/)[0].trim();if(avd!==expected)throw Error('Owned AVD identity mismatch');
if(call(['shell','am','get-current-user']).trim()!=='0')throw Error('Original user must be owner 0');
const users=()=>{const ids=[...call(['shell','pm','list','users']).matchAll(/UserInfo\{([0-9]+):/g)].map(m=>m[1]);if(!ids.includes('0'))throw Error('User inventory unavailable');return ids;};
function absentPackages(){for(const id of users())for(const name of [pkg,testPkg])if(call(['shell','pm','list','packages','-u','--user',id,name]).trim())throw Error(`Existing package registration ${name} in user ${id}; refusing global code replacement`);}
absentPackages();
const inputs=['standalone','launcher'].map(variant=>{
 const files={baseline:path.join(baseline,`${variant}-debug.apk`),baselineTest:path.join(baseline,`${variant}-test.apk`),candidate:path.join(root,'artifacts',`${variant}-debug.apk`),test:path.join(root,'android/app/build/outputs/apk/androidTest',variant,'debug',`app-${variant}-debug-androidTest.apk`)};
 const hashes=Object.fromEntries(Object.entries(files).map(([k,v])=>[k,hash(v)]));if(hashes.baseline===hashes.candidate)throw Error(`${variant}: baseline and candidate are identical`);return {variant,files,hashes};
});
const output=path.join(root,'test-results',`reminder-upgrade-${Date.now()}`);fs.mkdirSync(output,{recursive:true});
for(const input of inputs){
 absentPackages();
 const {variant,files,hashes}=input,dir=path.join(output,variant);fs.mkdirSync(dir);
 const record={serial,avd,variant,files,hashes,phases:{},cleanup:[],passed:false};let user,primary,instrumentationTransportUncertain=false;
 const log=(name,value)=>fs.writeFileSync(path.join(dir,name),value);
 const persist=()=>log('result.json',JSON.stringify(record,null,2)+'\n');
 function installedHash(name,label){
  const lines=call(['shell','pm','path','--user',user,name]).trim().split(/\r?\n/).filter(Boolean);
  if(lines.length!==1||!lines[0].startsWith('package:/'))throw Error(`Expected one installed APK for ${name}: ${lines}`);
  const remote=lines[0].slice(8),local=path.join(dir,`${label}-installed.apk`);call(['pull',remote,local]);const value=hash(local);fs.unlinkSync(local);return value;
 }
 function install(file,expectedHash,label,replace=false){
  if(hash(file)!==expectedHash)throw Error('Input APK changed during campaign');
  const result=call(['install',...(replace?['-r']:[]),'--user',user,'-t',file]);log(`${label}-install.log`,result);if(!/^Success\s*$/m.test(result))throw Error(`${label} installation failed`);
  const observed=installedHash(label.includes('test')?testPkg:pkg,label);if(observed!==expectedHash)throw Error(`${label} installed APK hash mismatch`);record.phases[label]={installedHash:observed};persist();
 }
 function phase(name){
  let result;try{result=call(['shell','am','instrument','-r','--user',user,'-w','-e','reminderUpgrade',name,'-e','class',`${pkg}.ReminderUpgradeInstrumentedTest#installedUpgradePreservesIdentityAndReceipts`,`${testPkg}/androidx.test.runner.AndroidJUnitRunner`]);}
  catch(error){instrumentationTransportUncertain=true;log(`${name}.log`,`${error.stdout??''}\n${error.stderr??''}\n${error.message}`);throw error;}
  log(`${name}.log`,result);requireOneTest(result,name);record.phases[name]={passed:true};persist();
 }
 try{
  const created=call(['shell','pm','create-user',`reminder-upgrade-${variant}-${Date.now()}`]);log('create-user.log',created);user=created.match(/Success: created user id (\d+)/)?.[1];if(!user||user==='0')throw Error('No owned secondary user');record.user=user;persist();
  install(files.baseline,hashes.baseline,'baseline');install(files.baselineTest,hashes.baselineTest,'baseline-test');
  call(['shell','am','start-user','-w',user]);
  // Resolve stock HOME in owner 0, but modify only this campaign's disposable user.
  const home=call(['shell','cmd','package','resolve-activity','--brief','--user','0','-a','android.intent.action.MAIN','-c','android.intent.category.HOME','-p','com.google.android.apps.nexuslauncher']).trim().split(/\r?\n/).at(-1);
  if(!/^com\.google\.android\.apps\.nexuslauncher\/[A-Za-z0-9_.$]+$/.test(home))throw Error('Stock HOME unavailable for disposable user');
  if(!/Success/.test(call(['shell','cmd','package','set-home-activity','--user',user,home])))throw Error('Disposable user HOME selection failed');
  call(['shell','am','switch-user',user]);wait(()=>call(['shell','am','get-current-user']).trim()===user,'Owned user not foreground');
  call(['shell','input','keyevent','KEYCODE_WAKEUP']);call(['shell','wm','dismiss-keyguard']);
  wait(()=>new RegExp('topResumedActivity=.*\\bu'+user+'\\b.*com\\.google\\.android\\.apps\\.nexuslauncher').test(call(['shell','dumpsys','activity','activities'])),'Owned user launcher did not finish initial startup',60000);
  for(const permission of ['POST_NOTIFICATIONS'])call(['shell','pm','grant','--user',user,pkg,`android.permission.${permission}`]);
  phase('seed');
  const routes=()=>call(['shell','dumpsys','activity','intents']).split(/\r?\n/).map(line=>line.trim()).filter(line=>line.startsWith('requestIntent=')&&line.includes('cmp='+pkg+'/')&&/dat=alpha-reminder-tap:|dat=alpha-reminder:[^ /]+\//.test(line)).sort();
  const before=routes();log('baseline-intents.json',JSON.stringify(before,null,2));
  if(!before.some(line=>line.includes('dat=alpha-reminder:upgrade_future/'))||!before.some(line=>line.includes('dat=alpha-reminder:upgrade_repeat/'))||!before.some(line=>line.includes('dat=alpha-reminder-tap:')))throw Error('Baseline native intent inventory missing');
  install(files.candidate,hashes.candidate,'candidate',true);
  const after=routes();log('candidate-intents.json',JSON.stringify(after,null,2));
  if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Installed update changed native reminder intent routes');
  record.phases.intentPreservation={passed:true,routes:before.length};persist();
  install(files.test,hashes.test,'test',true);phase('verify');


 }catch(error){primary=error;record.error=error.message;}
 finally{
  if(instrumentationTransportUncertain)record.cleanup.push("Deferred: confirm prior instrumentation terminated and recover this owned user before cleanup");
  else {
  try{call(['shell','am','switch-user','0']);wait(()=>call(['shell','am','get-current-user']).trim()==='0','Owner user not restored');wait(()=>/topResumedActivity=.*\bu0\b/.test(call(['shell','dumpsys','activity','activities'])),'Owner Activity not resumed');record.cleanup.push('Owner user restored and resumed');}catch(error){primary??=error;record.cleanup.push(error.message);}
  // Uninstall only freshly introduced packages, while owned user still permits exact APK identity checks.
  if(user&&user!=='0')for(const name of [testPkg,pkg])try{
   if(call(['shell','pm','list','packages','-u','--user',user,name]).trim()){
    const observed=installedHash(name,`cleanup-${name}`),allowed=name===testPkg?[hashes.test,hashes.baselineTest]:[hashes.baseline,hashes.candidate];if(!allowed.includes(observed))throw Error(`Refusing to uninstall changed package ${name}`);
    const result=call(['uninstall',name]);record.cleanup.push(result.trim());if(!/^Success\s*$/m.test(result))throw Error(`Uninstall failed: ${name}`);
   }
  }catch(error){primary??=error;record.cleanup.push(error.message);}
  if(user&&user!=='0')try{if(users().includes(user)){call(['shell','am','stop-user','-w',user]);wait(()=>call(['shell','am','is-user-stopped',user]).trim()==='true','Owned user did not stop');record.cleanup.push(call(['shell','pm','remove-user','--wait',user]).trim());}if(users().includes(user))throw Error('Owned user still exists');}catch(error){primary??=error;record.cleanup.push(error.message);}
  try{absentPackages();}catch(error){primary??=error;record.cleanup.push(error.message);}
  }
  record.passed=!primary;if(primary)record.error=primary.message;persist();
 }
 if(primary)throw primary;
}
console.log(output);
