import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {androidEnv} from './toolchain.mjs';
const [appApk,testApk,output='test-results/calendar-crud']=process.argv.slice(2),serial=process.env.ANDROID_SERIAL;
if(!appApk||!testApk||!/^emulator-\d+$/.test(serial||''))throw Error('Explicit emulator serial and matching app/test APK pair required');
const env=androidEnv(),adb=path.join(env.ANDROID_HOME,'platform-tools/adb'),app=JSON.parse(fs.readFileSync('app.config.json')).appId;
const run=(...args)=>execFileSync(adb,['-s',serial,...args],{env,encoding:'utf8',timeout:args.includes('instrument')?240000:120000});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const evidence={appSha256:hash(appApk),testSha256:hash(testApk),serial,passed:false,permissionsRestored:false};fs.mkdirSync(output,{recursive:true});
run('install','-r',appApk);run('install','-r',testApk);
const dump=run('shell','dumpsys','package',app);
const previous=['android.permission.READ_CALENDAR','android.permission.WRITE_CALENDAR'].map(permission=>{
 const line=dump.split('\n').find(l=>l.includes(permission+': granted='));if(!line)throw Error('Missing calendar permission snapshot');
 if(/SYSTEM_FIXED|POLICY_FIXED|ONE_TIME/.test(line))throw Error('Fixture refuses fixed or one-time permission state');
 return {permission,granted:line.includes('granted=true'),flags:['USER_SET','USER_FIXED'].filter(f=>line.includes(f)).map(f=>f.toLowerCase().replace('_','-'))};
});
let failure;
try{
 for(const {permission} of previous)run('shell','pm','grant',app,permission);
 const log=run('shell','am','instrument','-w','-r','-e','class',app+'.CalendarCrudInstrumentedTest','-e','calendarCrud','1',app+'.test/androidx.test.runner.AndroidJUnitRunner');
 fs.writeFileSync(path.join(output,'instrumentation.txt'),log);evidence.completedMethods=(log.match(/^INSTRUMENTATION_STATUS_CODE: 0$/gm)||[]).length;evidence.assumptions=(log.match(/^INSTRUMENTATION_STATUS_CODE: -(?:3|4)$/gm)||[]).length;evidence.passed=/OK \(2 tests\)/.test(log)&&evidence.completedMethods===2&&evidence.assumptions===0&&!/FAILURES|INSTRUMENTATION_FAILED|Process crashed|INSTRUMENTATION_STATUS_CODE: -(?:1|2)/.test(log);if(!evidence.passed)throw Error('Calendar CRUD flow failed; see instrumentation.txt');
}catch(error){failure=error;evidence.error=error.message;}
finally{
 try{
  for(const {permission,granted,flags} of previous){run('shell','pm',granted?'grant':'revoke',app,permission);run('shell','pm','clear-permission-flags',app,permission,'user-set','user-fixed');if(flags.length)run('shell','pm','set-permission-flags',app,permission,...flags);}
  const restored=run('shell','dumpsys','package',app);
  for(const {permission,granted,flags} of previous){const line=restored.split('\n').find(l=>l.includes(permission+': granted='));if(!line||line.includes('granted=true')!==granted||['user-set','user-fixed'].some(flag=>line.includes(flag.toUpperCase().replace('-','_'))!==flags.includes(flag)))throw Error('Calendar permission restoration mismatch');}
  evidence.permissionsRestored=true;
 }catch(error){failure??=error;evidence.passed=false;evidence.restoreError=error.message;}
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(evidence,null,2));
}
if(failure)throw failure;console.log('PASS actual CalendarProvider CRUD, stale snapshot and revoked calendar ACL; permissions restored');
