/** Real isolated Eliza app-host -> native phone connection chooser, both distributions. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {androidEnv} from './toolchain.mjs';
const env=androidEnv(),serial=process.env.ANDROID_SERIAL;
if(!/^emulator-\d+$/.test(serial||''))throw Error('Set ANDROID_SERIAL to the disposable phone emulator.');
const adb=path.join(env.ANDROID_HOME,'platform-tools/adb'),appId=JSON.parse(fs.readFileSync('app.config.json')).appId;
const out=process.env.ALPHA_REMOTE_RESULTS||'test-results/android-local-remote';fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync('artifacts/apk-manifest.json'));
const run=(args,input)=>execFileSync(adb,['-s',serial,...args],{env,encoding:'utf8',timeout:300000,input});
const results=[];
for(const variant of ['standalone','launcher']){
 const apk=`artifacts/${variant}-debug.apk`,sha256=crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex');
 if(!manifest.results.some(row=>row.file===apk&&row.sha256===sha256))throw Error('APK differs from manifest');
 let passed=false;
 try{
  run(['install','--no-incremental','-r',apk]);
  run(['install','--no-incremental','-r',`android/app/build/outputs/apk/androidTest/${variant}/debug/app-${variant}-debug-androidTest.apk`]);
  const response=await fetch('http://127.0.0.1:47839/api/auth/pair-code',{redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Private pairing material unavailable');
  const pairing=await response.json();if(typeof pairing.code!=='string'||!pairing.code)throw Error('Pairing response invalid');
  run(['shell',`run-as ${appId} sh -c 'umask 077; mkdir -p files; cat > files/local-remote-pairing.json'`],JSON.stringify({code:pairing.code,origin:'http://10.0.2.2:47839'}));
  const output=run(['shell','am','instrument','-w','-e','localRemote','true','-e','class',`${appId}.RemoteAgentInstrumentedTest`,`${appId}.test/androidx.test.runner.AndroidJUnitRunner`]);
  fs.writeFileSync(path.join(out,`${variant}.txt`),output);
  passed=/OK \(1 test\)/.test(output)&&!/FAILURES|INSTRUMENTATION_FAILED|Process crashed/.test(output);
 }catch{ /* No exception dump: private pairing request inputs must not leak. */ }
 results.push({variant,sha256,passed});fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({serial,emulatorMode:process.env.ALPHA_EMULATOR_MODE||'unspecified',createdAt:new Date().toISOString(),scope:'Actual loopback Eliza app-host, Cerebras and Android chooser/chat/recreation; not Cloud or enclave acceptance',results},null,2)+'\n');
 console.log(`${variant}: ${passed?'passed':'failed'}`);
}
if(results.some(row=>!row.passed))process.exitCode=1;
