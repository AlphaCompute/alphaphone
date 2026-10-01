/** Explicit real patched-backend/Android UI run. Run only on a disposable emulator. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { androidEnv } from './toolchain.mjs';
const env=androidEnv(), serial=process.env.ANDROID_SERIAL;
if(!/^emulator-\d+$/.test(serial||''))throw new Error('Set ANDROID_SERIAL to the disposable phone emulator');
const origin='http://127.0.0.1:47840';
const sessionFile=process.env.ALPHA_DEVICE_SESSION_FILE||path.join(os.homedir(),'.local/share/alphaphone/local-device-actions/paired-session.json');
if((fs.statSync(sessionFile).mode&0o077)!==0)throw new Error('Owner-only session file required');
const session=JSON.parse(fs.readFileSync(sessionFile,'utf8'));
const headers={Authorization:`Bearer ${session.token}`,'X-Forwarded-For':'192.0.2.1'};
const request=async(endpoint,authenticated=false)=>{const response=await fetch(origin+endpoint,{headers:authenticated?headers:undefined,redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Private fixture setup HTTP '+response.status);return response.json();};
const me=await request('/api/auth/me',true), agents=await request('/api/agents',true);
if(me.access?.role!=='OWNER'||me.access?.mode!=='session'||agents.agents?.length!==1)throw new Error('Verified owner and one running agent required');
const adb=path.join(env.ANDROID_HOME,'platform-tools/adb'),appId=JSON.parse(fs.readFileSync('app.config.json')).appId;
const out=process.env.ALPHA_DEVICE_RESULTS||'test-results/android-device-actions';fs.mkdirSync(out,{recursive:true});
const archive=process.env.ALPHA_BUILD_ARCHIVE;
const manifest=JSON.parse(fs.readFileSync(archive?path.join(archive,'apk-manifest.json'):'artifacts/apk-manifest.json'));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run=(args,input)=>execFileSync(adb,['-s',serial,...args],{env,encoding:'utf8',timeout:720000,input});
const results=[];
for(const variant of ['standalone','launcher']) {
 const apk=archive?path.join(archive,`${variant}-debug.apk`):`artifacts/${variant}-debug.apk`,sha256=hash(apk);
 const testApk=archive?path.join(archive,`${variant}-androidTest.apk`):`android/app/build/outputs/apk/androidTest/${variant}/debug/app-${variant}-debug-androidTest.apk`,testSha256=hash(testApk);
 if(archive ? manifest[`${variant}-debug.apk`]!==sha256||manifest[`${variant}-androidTest.apk`]!==testSha256 : !manifest.results.some(row=>row.file===apk&&row.sha256===sha256))throw new Error('APK differs from manifest');
 let passed=false,stage="install",failureStage,failureCode;
 try {
  run(['install','--no-incremental','-r',apk]);
  run(['install','--no-incremental','-r',testApk]);
  run(['shell','am','force-stop',appId]);
  stage='pairing-fixture';
  const pairing=await request('/api/auth/pair-code');if(typeof pairing.code!=='string')throw new Error('Pairing code unavailable');
  const title=`Alpha native fixture ${variant} ${Date.now()}`;
  run(['shell',`run-as ${appId} sh -c 'umask 077; mkdir -p files; cat > files/device-action-pairing.json'`],JSON.stringify({code:pairing.code,origin:'http://10.0.2.2:47840',ownerId:me.identity.id,agentId:agents.agents[0].id,title}));
  stage='instrumentation';
  const output=run(['shell','am','instrument','-w','-e','deviceActions','true','-e','class',`${appId}.DeviceActionInstrumentedTest`,`${appId}.test/androidx.test.runner.AndroidJUnitRunner`]);
  fs.writeFileSync(path.join(out,`${variant}.txt`),output);
  passed=/OK \(1 test\)/.test(output)&&!/FAILURES|INSTRUMENTATION_FAILED|Process crashed/.test(output);
 }catch(error) { failureStage=stage; failureCode=/^Private fixture setup HTTP \d{3}$/.test(error.message)?error.message:(error.name==='TimeoutError'?'request-timeout':typeof error.code==='string'?error.code:'stage-failed'); /* Never dump commands, private input, response bodies or credentials. */ }
 results.push({variant,sha256,testSha256,passed,...(failureStage?{failureStage,failureCode}:{})});
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({serial,createdAt:new Date().toISOString(),scope:'Real patched backend/model, rendered approval, Android note, native reminder, real view/browser navigation and encrypted terminal journal recreation; not Cloud or enclave',results},null,2)+'\n');
 console.log(`${variant}: ${passed?'passed':'failed'}`);
}
if(results.some(row=>!row.passed))process.exitCode=1;
