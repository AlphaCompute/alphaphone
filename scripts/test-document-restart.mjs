import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {androidEnv} from './toolchain.mjs';

// Explicit APK pair required: pass artifacts archived from the same build.
const [appApk, testApk, output = 'test-results/document-restart'] = process.argv.slice(2);
const serial = process.env.ANDROID_SERIAL;
if (!appApk || !testApk || !serial?.startsWith('emulator-')) throw Error('Usage: ANDROID_SERIAL=emulator-N node scripts/test-document-restart.mjs APP.apk MATCHING_TEST.apk [OUTPUT]');
const env = androidEnv();
const adb = path.join(env.ANDROID_HOME, 'platform-tools/adb');
const appId = JSON.parse(fs.readFileSync('app.config.json')).appId;
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const evidence = {appApk:path.resolve(appApk),appSha256:digest(appApk),testApk:path.resolve(testApk),testSha256:digest(testApk),serial,phases:[],passed:false};
fs.mkdirSync(output,{recursive:true});
const run = (...args) => execFileSync(adb,['-s',serial,...args],{env,encoding:'utf8',timeout:args.includes('instrument')?180000:120000});
const phase = name => {
 const log = run('shell','am','instrument','-w','-r','-e','class',`${appId}.SelectedDocumentInstrumentedTest#documentProcessRestartPhase`,'-e','documentPhase',name,`${appId}.test/androidx.test.runner.AndroidJUnitRunner`);
 fs.writeFileSync(path.join(output,`${name}.txt`),log);
 const passed=/OK \(1 test\)/.test(log)&&!/FAILURES|INSTRUMENTATION_FAILED|Process crashed/.test(log);
 evidence.phases.push({name,passed});if(!passed)throw Error(`Document ${name} phase failed; see saved instrumentation output`);
};
let failure;
try {
 run('install','-r',appApk);run('install','-r',testApk);
 phase('prepare');
 run('shell','am','force-stop',appId);
 phase('verify');
 evidence.passed=true;
} catch(error){failure=error;evidence.error=error.message;}
finally {
 try{phase('cleanup');}catch(error){evidence.passed=false;failure??=error;evidence.cleanupError=error.message;}
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(evidence,null,2));
}
if(failure)throw failure;
console.log('PASS real picker selection restored in a new process; revoked grant rejected; fixture cleaned.');
