import fs from 'node:fs';
import assert from 'node:assert/strict';
import {requireInstrumentationSuccess} from './instrumentation-result.mjs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {androidEnv} from './toolchain.mjs';

// Explicit APK pair required: pass artifacts archived from the same build.
const [appApk, testApk, output = 'test-results/bookmark-restart'] = process.argv.slice(2);
const serial = process.env.ANDROID_SERIAL;
if (!appApk || !testApk || !serial?.startsWith('emulator-')) throw Error('Usage: ANDROID_SERIAL=emulator-N node scripts/test-bookmark-restart.mjs APP.apk MATCHING_TEST.apk [OUTPUT]');
const env = androidEnv();
const adb = path.join(env.ANDROID_HOME, 'platform-tools/adb');
const appId = JSON.parse(fs.readFileSync('app.config.json')).appId;
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const evidence = {appApk:path.resolve(appApk),appSha256:digest(appApk),testApk:path.resolve(testApk),testSha256:digest(testApk),serial,phases:[],passed:false};
fs.mkdirSync(output,{recursive:true});
const run = (...args) => execFileSync(adb,['-s',serial,...args],{env,encoding:'utf8',timeout:args.includes('instrument')?180000:120000});
let instrumentationTransportUncertain=false;
const phase = name => {
 const cls=`${appId}.BrowserContinuityInstrumentedTest`,selector=cls+'#bookmarkProcessRestartPhase';
 let log;
 try {log=run('shell','am','instrument','-w','-r','-e','class',selector,'-e','bookmarkPhase',name,`${appId}.test/androidx.test.runner.AndroidJUnitRunner`);}
 catch(error){
  instrumentationTransportUncertain=true;
  const bounded=value=>String(value??'').slice(-4*1024*1024);
  fs.writeFileSync(path.join(output,`${name}.txt`),bounded(error.stdout));
  fs.writeFileSync(path.join(output,`${name}.stderr.txt`),bounded(error.stderr));
  evidence.phases.push({name,passed:false,transport:{status:error.status??null,signal:error.signal??null,code:error.code??null}});
  throw error;
 }
 fs.writeFileSync(path.join(output,`${name}.txt`),log);
 try {
  const result=requireInstrumentationSuccess(log,[cls]);
  assert.equal(result.totalTests,1,'Require exactly one requested bookmark method');
  assert.deepEqual(result.cases,[selector],'Unexpected bookmark method');
  evidence.phases.push({name,passed:true,result});
 }catch(error){evidence.phases.push({name,passed:false});throw error;}
};

let failure;
try {
 run('install','-r',appApk);run('install','-r',testApk);
 phase('prepare');
 run('shell','am','force-stop',appId);
 phase('verify');
 run('shell','am','force-stop',appId);
 phase('verifyRemoved');
 evidence.passed=true;
} catch(error){failure=error;evidence.error=error.message;}
finally {
 if(instrumentationTransportUncertain){evidence.passed=false;evidence.cleanupDeferred={reason:'instrumentation-transport-uncertain',requires:'Explicit ownership recovery and confirmed prior instrumentation termination'};}
 else try{phase('cleanup');}catch(error){evidence.passed=false;failure??=error;evidence.cleanupError=error.message;if(instrumentationTransportUncertain)evidence.cleanupDeferred={reason:'cleanup-instrumentation-transport-uncertain',requires:'Explicit ownership recovery and confirmed prior instrumentation termination'};}
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(evidence,null,2));
}
if(failure)throw failure;
console.log('PASS real HTTPS bookmark restored in a new process; exact retired profile names absent after each real process restart; user removal persisted; fixture cleaned.');
