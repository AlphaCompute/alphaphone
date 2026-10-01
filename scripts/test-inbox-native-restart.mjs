import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {androidEnv} from './toolchain.mjs';
const [appApk,testApk,output='test-results/inbox-native-restart']=process.argv.slice(2),serial=process.env.ANDROID_SERIAL;
if(!appApk||!testApk||!serial?.startsWith('emulator-'))throw Error('Usage: ANDROID_SERIAL=emulator-N node scripts/test-inbox-native-restart.mjs ARCHIVED_APP.apk MATCHING_TEST.apk [OUTPUT]');
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const appHash=digest(appApk),testHash=digest(testApk),archive=path.join(path.dirname(path.resolve(appApk)),'apk-manifest.json');
const manifest=JSON.parse(fs.readFileSync(archive,'utf8'));
if(path.dirname(path.resolve(appApk))!==path.dirname(path.resolve(testApk))||manifest[path.basename(appApk)]!==appHash||manifest[path.basename(testApk)]!==testHash)throw Error('Exact app/test hashes must match the same immutable archive manifest');
const variant=path.basename(appApk).match(/^(standalone|launcher)-debug\.apk$/)?.[1];if(!variant||path.basename(testApk)!==`${variant}-androidTest.apk`)throw Error('Matching debug distribution required');
const env=androidEnv(),adb=path.join(env.ANDROID_HOME,'platform-tools/adb'),appId=JSON.parse(fs.readFileSync('app.config.json')).appId,runId=crypto.randomUUID();
const evidence={variant,appSha256:appHash,testSha256:testHash,archive:path.resolve(archive),serial,runId,phases:[],passed:false,scope:'Real Inbox UI and encrypted store, synthetic test-only Cloud protocol; no provider network or mail sends'};
fs.mkdirSync(output,{recursive:true});
const run=(...args)=>execFileSync(adb,['-s',serial,...args],{env,encoding:'utf8',timeout:args.includes('instrument')?240000:120000});
const phase=name=>{
 let log='';try{log=run('shell','am','instrument','-w','-r','-e','class',`${appId}.InboxDraftInstrumentedTest#processPhase`,'-e','inboxPhase',name,'-e','inboxRunId',runId,`${appId}.test/androidx.test.runner.AndroidJUnitRunner`);}catch(error){log=String(error.stdout||'')+String(error.stderr||'');fs.writeFileSync(path.join(output,`${name}.txt`),log);throw error;}
 fs.writeFileSync(path.join(output,`${name}.txt`),log);const passed=/OK \(1 test\)/.test(log)&&!/FAILURES|INSTRUMENTATION_FAILED|Process crashed/.test(log);const pid=Number(log.match(/inboxFixturePid=(\d+)/)?.[1]);evidence.phases.push({name,passed,pid});if(!passed||!Number.isSafeInteger(pid)||pid<=0)throw Error(`Inbox ${name} failed; see phase log`);
};
let failure;
try{
 run('install','-r',appApk);run('install','-r',testApk);phase('prepare');run('shell','am','force-stop',appId);phase('restore');
 if(evidence.phases[0].pid===evidence.phases[1].pid)throw Error('Process restart not proven');evidence.passed=true;
}catch(error){failure=error;evidence.error=error.message;}
finally{
 try{run('shell','am','force-stop',appId);phase('cleanup');}catch(error){failure??=error;evidence.cleanupError=error.message;evidence.passed=false;}
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(evidence,null,2));
}
if(failure)throw failure;
console.log('PASS native Inbox encrypted save, different-PID restore, exact bytes, reply identity, account isolation, discard and fixture cleanup. Synthetic provider only; no real email.');
