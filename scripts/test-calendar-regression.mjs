import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {requireInstrumentationSuccess} from './instrumentation-result.mjs';

const root=process.env.ALPHA_CALENDAR_TEST_ROOT??path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const serial=process.env.ALPHA_CALENDAR_TEST_SERIAL;
const expected=process.env.ALPHA_CALENDAR_TEST_AVD;
const external=process.argv.includes('--external');
const companion={pkg:'ws.xsoh.etar',file:path.join(root,'artifacts/calendar-external/ws.xsoh.etar_57.apk'),sha:'dae01d93c8920aa63845868db2190bcc4aa6ff8410b1289de1ce27b1bb89c599'};
if(!serial||!/^emulator-[0-9]+$/.test(serial)||!expected)throw Error('Explicit owned emulator serial and exact AVD name required');
const identity=JSON.parse(fs.readFileSync(path.join(root,'app.config.json'),'utf8'));
const pkg=identity.appId,testPkg=`${pkg}.test`;
if(pkg!=='ai.elizaresearch.alphaphone')throw Error('Unexpected Alpha package identity');
const adb=path.join(process.env.ANDROID_HOME??path.join(process.env.HOME,'Library/Android/sdk'),'platform-tools/adb');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if(external&&hash(companion.file)!==companion.sha)throw Error('External editor APK differs from pinned F-Droid artifact');
const call=args=>execFileSync(adb,['-s',serial,...args],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
const wait=(predicate,message,timeoutMs=15000)=>{const until=Date.now()+timeoutMs;while(Date.now()<until){if(predicate())return;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150);}throw Error(message);};
const avd=call(['emu','avd','name']).split(/\r?\n/)[0].trim();if(avd!==expected)throw Error('Owned AVD identity mismatch');
if(call(['shell','am','get-current-user']).trim()!=='0')throw Error('Original user must be owner 0');
const users=()=>{const ids=[...call(['shell','pm','list','users']).matchAll(/UserInfo\{([0-9]+):/g)].map(m=>m[1]);if(!ids.includes('0'))throw Error('User inventory unavailable');return ids;};
function absentPackages(){for(const id of users())for(const name of [pkg,testPkg,...(external?[companion.pkg]:[])])if(call(['shell','pm','list','packages','-u','--user',id,name]).trim())throw Error(`Existing package registration ${name} in user ${id}; refusing global code replacement`);}
absentPackages();
const cases=external?[['CalendarExternalEditorInstrumentedTest','externalCalendar',1]]:[
 ['CalendarCreationRecoveryInstrumentedTest','calendarCreationRecovery',1],
 ['CalendarFlowInstrumentedTest','calendarFlow',5],
 ['CalendarCrudInstrumentedTest','calendarCrud',2],
 ['CalendarRangeInstrumentedTest','calendarRange',1],
 ['CalendarTruncationInstrumentedTest','calendarRange',1]
];
const requestedCase=process.argv.find(v=>v.startsWith('--case='))?.slice(7);
const requestedVariant=process.argv.find(v=>v.startsWith('--variant='))?.slice(10);
if(requestedCase&&!cases.some(c=>c[0]===requestedCase))throw Error('Unknown Calendar case');
if(requestedVariant&&!['standalone','launcher'].includes(requestedVariant))throw Error('Unknown variant');
const inputs=['standalone','launcher'].filter(v=>!requestedVariant||v===requestedVariant).flatMap(variant=>cases.filter(c=>!requestedCase||c[0]===requestedCase).map(([testClass,flag,count])=>{
 const files={candidate:path.join(root,'artifacts',`${variant}-debug.apk`),test:path.join(root,'android/app/build/outputs/apk/androidTest',variant,'debug',`app-${variant}-debug-androidTest.apk`)};
 const hashes=Object.fromEntries(Object.entries(files).map(([k,v])=>[k,hash(v)]));return {variant,files,hashes,testClass,flag,count};
}));
const output=path.join(root,'test-results',`calendar-regression-${Date.now()}`);fs.mkdirSync(output,{recursive:true});
for(const input of inputs){
 absentPackages();
 const {variant,files,hashes,testClass,flag,count}=input,dir=path.join(output,`${variant}-${testClass}`);fs.mkdirSync(dir);
 const record={serial,avd,variant,testClass,files,hashes,phases:{},cleanup:[],passed:false};let user,primary,instrumentationTransportUncertain=false;
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
  const observed=installedHash(label==='test'?testPkg:label==='companion'?companion.pkg:pkg,label);if(observed!==expectedHash)throw Error(`${label} installed APK hash mismatch`);record.phases[label]={installedHash:observed};persist();
 }

 try{
  const created=call(['shell','pm','create-user',`calendar-upgrade-${variant}-${Date.now()}`]);log('create-user.log',created);user=created.match(/Success: created user id (\d+)/)?.[1];if(!user||user==='0')throw Error('No owned secondary user');record.user=user;persist();
  install(files.candidate,hashes.candidate,'candidate');install(files.test,hashes.test,'test');
  if(external)install(companion.file,companion.sha,'companion');
  call(['shell','am','start-user','-w',user]);
  // Keep disposable-user setup on stock HOME; Alpha launcher is opened by instrumentation.
  // Resolve its installed component rather than assuming an OEM activity name.
  const home=call(['shell','cmd','package','resolve-activity','--brief','--user','0','-a','android.intent.action.MAIN','-c','android.intent.category.HOME','-p','com.android.launcher3']).trim().split(/\r?\n/).at(-1);
  if(!/^com\.android\.launcher3\/[A-Za-z0-9_.$]+$/.test(home))throw Error('Stock HOME unavailable for disposable user');
  const selected=call(['shell','cmd','package','set-home-activity','--user',user,home]);
  if(!/Success/.test(selected))throw Error('Disposable user HOME selection failed');
  call(['shell','am','switch-user',user]);wait(()=>call(['shell','am','get-current-user']).trim()===user,'Owned user not foreground');
  call(['shell','input','keyevent','KEYCODE_WAKEUP']);call(['shell','wm','dismiss-keyguard']);
  // A newly created user's setup HOME can finish after switch-user returns and steal focus.
  wait(()=>new RegExp('topResumedActivity=.*\\bu'+user+'\\b.*com\\.android\\.launcher3').test(call(['shell','dumpsys','activity','activities'])),'Owned user launcher did not finish initial startup',60000);
  for(const permission of ['READ_CALENDAR','WRITE_CALENDAR'])call(['shell','pm','grant','--user',user,pkg,`android.permission.${permission}`]);
  if(external)for(const permission of ['READ_CALENDAR','WRITE_CALENDAR'])call(['shell','pm','grant','--user',user,companion.pkg,`android.permission.${permission}`]);
  let result;
  try{result=call(['shell','am','instrument','-r','--user',user,'-w','-e',flag,external?'true':'1','-e','class',`${pkg}.${testClass}`,`${testPkg}/androidx.test.runner.AndroidJUnitRunner`]);}
  catch(error){instrumentationTransportUncertain=true;log('instrumentation.log',`${error.stdout??''}\n${error.stderr??''}\n${error.message}`);throw error;}
  log('instrumentation.log',result);
  const evidence=requireInstrumentationSuccess(result,[`${pkg}.${testClass}`]);
  if(evidence.totalTests!==count)throw Error(`${testClass} did not pass all ${count} tests`);
  record.phases.instrumentation={passed:true,count,evidence};persist();
 }catch(error){primary=error;record.error=error.message;}
 finally{
  if(instrumentationTransportUncertain)record.cleanup.push("Deferred: confirm prior instrumentation terminated and recover this owned user before cleanup");
  else {
  try{call(['shell','am','switch-user','0']);wait(()=>call(['shell','am','get-current-user']).trim()==='0','Owner user not restored');wait(()=>/topResumedActivity=.*\bu0\b/.test(call(['shell','dumpsys','activity','activities'])),'Owner Activity not resumed');record.cleanup.push('Owner user restored and resumed');}catch(error){primary??=error;record.cleanup.push(error.message);}
  // Uninstall only freshly introduced packages, while owned user still permits exact APK identity checks.
  if(user&&user!=='0')for(const name of [testPkg,pkg,...(external?[companion.pkg]:[])])try{
   if(call(['shell','pm','list','packages','-u','--user',user,name]).trim()){
    const observed=installedHash(name,`cleanup-${name}`),allowed=name===testPkg?[hashes.test]:name===companion.pkg?[companion.sha]:[hashes.candidate];if(!allowed.includes(observed))throw Error(`Refusing to uninstall changed package ${name}`);
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
