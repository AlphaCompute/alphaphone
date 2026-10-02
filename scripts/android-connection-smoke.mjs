/** Scoped native calendar/credential transport flows; all peers and records are synthetic. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {androidEnv} from './toolchain.mjs';
import {requireInstrumentationSuccess} from './instrumentation-result.mjs';
const env=androidEnv(), serial=process.env.ANDROID_SERIAL;
if(!/^emulator-\d+$/.test(serial||''))throw Error('Set ANDROID_SERIAL to the disposable phone emulator.');
const adb=path.join(env.ANDROID_HOME,'platform-tools/adb');
const appId=JSON.parse(fs.readFileSync('app.config.json')).appId;
const out=process.env.ALPHA_CONNECTION_RESULTS||'test-results/android-connection';
fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync('artifacts/apk-manifest.json'));
const classes=['CalendarFlowInstrumentedTest','ConnectionInstrumentedTest','ConnectionChooserInstrumentedTest','CloudVoiceInstrumentedTest','ActionJournalInstrumentedTest'].map(name=>`${appId}.${name}`);
const isolated=process.env.ALPHA_ISOLATE_FLOWS==='1';
const run=(...args)=>execFileSync(adb,['-s',serial,...args],{env,encoding:'utf8',timeout:300000});
const results=[];
for(const variant of ['standalone','launcher']){
 const apk=`artifacts/${variant}-debug.apk`, sha256=crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex');
 if(!manifest.results.some(row=>row.file===apk&&row.sha256===sha256))throw Error('APK differs from manifest');
 let passed=false,error;
 try{
  run('install','--no-incremental','-r',apk);
  run('install','--no-incremental','-r',`android/app/build/outputs/apk/androidTest/${variant}/debug/app-${variant}-debug-androidTest.apk`);
  const groups=isolated?classes.map(name=>[name]):[classes];
  const outputs=[];passed=true;
  for(const group of groups){
   const output=run('shell','am','instrument','-w','-r','-e','class',group.join(','),`${appId}.test/androidx.test.runner.AndroidJUnitRunner`);
   outputs.push(output);
   fs.writeFileSync(path.join(out,`${variant}.txt`),outputs.join('\n'));
   if(isolated)fs.writeFileSync(path.join(out,`${variant}-${group[0].split('.').at(-1)}.txt`),output);
   requireInstrumentationSuccess(output,group);
  }
  fs.writeFileSync(path.join(out,`${variant}.txt`),outputs.join('\n'));

  if(!passed)error='Scoped native instrumentation failed.';
 }catch{passed=false;error='Install or instrumentation failed or timed out.';}
 results.push({variant,sha256,passed,...(error?{error}:{})});
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({serial,isolatedProcesses:isolated,emulatorMode:process.env.ALPHA_EMULATOR_MODE||'unspecified',createdAt:new Date().toISOString(),scope:'Synthetic calendar, encrypted credentials/HTTP, chooser/mock lifecycle, Cloud audio transport and durable native action journal; not live Cloud or enclave acceptance',results},null,2)+'\n');
 console.log(`${variant}: ${passed?'passed':'failed'}`);
}
if(results.some(row=>!row.passed))process.exitCode=1;
