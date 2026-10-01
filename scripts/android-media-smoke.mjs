/** Real Pixel-emulator media/picker flows; only disposable recordings and selected fixtures. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {androidEnv} from './toolchain.mjs';
const env=androidEnv(), serial=process.env.ANDROID_SERIAL;
if(!/^emulator-\d+$/.test(serial||''))throw Error('Set ANDROID_SERIAL to the disposable phone emulator.');
const adb=path.join(env.ANDROID_HOME,'platform-tools/adb');
const appId=JSON.parse(fs.readFileSync('app.config.json')).appId;
const out=process.env.ALPHA_MEDIA_RESULTS||'test-results/android-media';
fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync('artifacts/apk-manifest.json'));
const groups=[['NoteAudioInstrumentedTest',3],['VideoInstrumentedTest',2],['CameraFlowInstrumentedTest#photoCapturePublishesReadableImageAndShowsRealViewer',1],['BrowserFlowInstrumentedTest#selectedDocumentUploadsExactBytesWithoutAppBridge',1]];
const run=(...args)=>execFileSync(adb,['-s',serial,...args],{env,encoding:'utf8',timeout:300000});
const results=[];
for(const variant of ['standalone','launcher']){
 const apk=`artifacts/${variant}-debug.apk`,sha256=crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex');
 if(!manifest.results.some(row=>row.file===apk&&row.sha256===sha256))throw Error('APK differs from manifest');
 run('install','--no-incremental','-r',apk);
 run('install','--no-incremental','-r',`android/app/build/outputs/apk/androidTest/${variant}/debug/app-${variant}-debug-androidTest.apk`);
 for(const [name,count] of groups){
  let passed=false,output='';
  try{output=run('shell','am','instrument','-w','-e','class',`${appId}.${name}`,`${appId}.test/androidx.test.runner.AndroidJUnitRunner`);passed=new RegExp(`OK \\(${count} tests?\\)`).test(output)&&!/FAILURES|INSTRUMENTATION_FAILED|Process crashed/.test(output);}
  catch(error){output=String(error.stdout||'Instrumentation failed or timed out.');}
  fs.writeFileSync(path.join(out,`${variant}-${name.split('#')[0]}.txt`),output);
  results.push({variant,sha256,flow:name,expectedTests:count,passed});
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({serial,createdAt:new Date().toISOString(),scope:'Real private audio storage/playback, CameraX video and photo, native browser selected file/cancellation. No live transcription provider or physical-device acceptance.',results},null,2)+'\n');
  console.log(`${variant} ${name}: ${passed?'passed':'failed'}`);
 }
}
if(results.some(row=>!row.passed))process.exitCode=1;
