import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {androidEnv} from './toolchain.mjs';

const [archiveArg,outputArg]=process.argv.slice(2),serial=process.env.ANDROID_SERIAL;
if(!archiveArg||!outputArg||!/^emulator-\d+$/.test(serial||''))throw Error('Usage: ANDROID_SERIAL=emulator-N node scripts/android-photo-browser-batch-smoke.mjs IMMUTABLE_ARCHIVE NEW_OUTPUT');
const archive=path.resolve(archiveArg),output=path.resolve(outputArg),env=androidEnv(),adb=path.join(env.ANDROID_HOME,'platform-tools/adb');
const app=JSON.parse(fs.readFileSync('app.config.json','utf8')).appId;
const manifest=JSON.parse(fs.readFileSync(path.join(archive,'apk-manifest.json'),'utf8'));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const cases=[{name:'PhotosBatch',class:'PhotosBatchInstrumentedTest#selectedFavoritePartialTrashUndoAndRecreatedRecoveryPreserveOwnedBytes',gate:'photosBatch'},{name:'BrowserShare',class:'BrowserShareInstrumentedTest#exactCurrentPageChooserCancellationAndStalePageRejection',gate:'browserShareLive'}];
const pairs=['standalone','launcher'].map(variant=>{
 const appName=`${variant}-debug.apk`,testName=`${variant}-androidTest.apk`,appApk=path.join(archive,appName),testApk=path.join(archive,testName);
 const appSha256=hash(appApk),testSha256=hash(testApk);
 if(manifest[appName]!==appSha256||manifest[testName]!==testSha256)throw Error('Archived matching app/test hash mismatch');
 return {variant,appApk,testApk,appSha256,testSha256};
});
if(fs.existsSync(output))throw Error('Use a new output directory; prior failures must remain intact');
fs.mkdirSync(output,{recursive:true});fs.copyFileSync(new URL(import.meta.url),path.join(output,'runner-source.mjs'));
const result={serial,archive,runnerSha256:hash(new URL(import.meta.url)),expectedMethodsPerVariant:2,expectedTotalMethods:4,expectedAssumptions:0,homeRoleTested:false,permissionsMutated:false,passed:false,variants:pairs.map(pair=>({...pair,tests:cases.map(c=>({name:c.name,gate:c.gate,status:'unexecuted',cleanupVerified:false}))}))};
const save=()=>fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');save();
const run=args=>execFileSync(adb,['-s',serial,...args],{env,encoding:'utf8',timeout:args.includes('instrument')?360000:120000,maxBuffer:8*1024*1024});
let failure;
try{
 for(const variant of result.variants){
  if(hash(variant.appApk)!==variant.appSha256||hash(variant.testApk)!==variant.testSha256)throw Error('Archive changed before install');
  fs.writeFileSync(path.join(output,`${variant.variant}-install.txt`),run(['install','-r',variant.appApk])+run(['install','-r',variant.testApk]));
  for(let i=0;i<cases.length;i++){
   const selected=cases[i],record=variant.tests[i];record.status='running';save();let log='';
   try{log=run(['shell','am','instrument','-w','-r','-e','class',`${app}.${selected.class}`,'-e',selected.gate,'1',`${app}.test/androidx.test.runner.AndroidJUnitRunner`]);}
   catch(error){log=String(error.stdout||'')+String(error.stderr||'');record.executionError=error.code||error.signal||'command-failed';}
   fs.writeFileSync(path.join(output,`${variant.variant}-${selected.name}.txt`),log);
   record.completedMethods=(log.match(/^INSTRUMENTATION_STATUS_CODE: 0\s*$/gm)||[]).length;
   record.assumptions=(log.match(/^INSTRUMENTATION_STATUS_CODE: -(?:3|4)\s*$/gm)||[]).length;
   record.passed=!record.executionError&&/OK \(1 test\)/.test(log)&&record.completedMethods===1&&record.assumptions===0&&!/FAILURES|INSTRUMENTATION_FAILED|Process crashed|AssumptionViolated|INSTRUMENTATION_STATUS_CODE: -(?:1|2)/.test(log);
   record.status=record.passed?'passed':'failed';record.cleanupVerified=record.passed;record.cleanupScope=selected.name==='PhotosBatch'?'Exact three test-created URI/revision fixtures, native finally; no broad media deletion':'Test Activity/monitor/bridge interception finally; no recipient selected';save();
   if(!record.passed)throw Error(`${variant.variant} ${selected.name} failed; later cases remain unexecuted, inspect retained log and scoped fixtures before retrying`);
  }
 }
 result.passed=result.variants.every(v=>v.tests.every(t=>t.passed));
}catch(error){failure=error;result.error=error.message;}
finally{save();}
if(failure)throw failure;
console.log('PASS: four executed methods, zero assumptions; both archived distributions. HOME-role and physical-device acceptance not tested.');
