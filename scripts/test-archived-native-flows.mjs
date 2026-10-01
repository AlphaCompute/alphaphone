/** Run explicit native flow classes against immutable archived app/test APKs. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {androidEnv} from './toolchain.mjs';
const [archive,output,...groups]=process.argv.slice(2),serial=process.env.ANDROID_SERIAL;
assert.match(serial||'',/^emulator-\d+$/);assert.ok(archive&&output&&groups.length,'Usage: ARCHIVE OUTPUT ClassName:expectedCount ...');
const cases=groups.map(value=>{const match=/^([A-Za-z][A-Za-z0-9]*(?:#[A-Za-z][A-Za-z0-9]*)?):([1-9]\d*)$/.exec(value);assert.ok(match,'Explicit class/method and count required');return {name:match[1],count:Number(match[2])};});
const env=androidEnv(),adb=path.join(env.ANDROID_HOME,'platform-tools/adb'),app=JSON.parse(fs.readFileSync('app.config.json')).appId;
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(archive,'apk-manifest.json')));
const run=(...args)=>execFileSync(adb,['-s',serial,...args],{env,encoding:'utf8',timeout:args.includes('instrument')?600000:60000,maxBuffer:16*1024*1024});
const flags=JSON.parse(process.env.ALPHA_INSTRUMENTATION_ARGS||'{}');
assert.ok(flags&&typeof flags==='object'&&!Array.isArray(flags));
const extra=[];for(const [key,value] of Object.entries(flags)){assert.match(key,/^[A-Za-z][A-Za-z0-9]*$/);assert.ok(!['class','package','size','annotation','notAnnotation','log','debug'].includes(key),'Only fixture opt-in arguments are supported');assert.equal(typeof value,'string');assert.ok(value.length<=256);extra.push('-e',key,value);}
const results=[];assert.ok(!fs.existsSync(output),'Preserve earlier evidence; use a new output folder');fs.mkdirSync(output,{recursive:true});
for(const variant of ['standalone','launcher']){
 const apk=path.join(archive,variant+'-debug.apk'),test=path.join(archive,variant+'-androidTest.apk');
 const appSha256=hash(apk),testSha256=hash(test);assert.equal(appSha256,manifest[variant+'-debug.apk']);assert.equal(testSha256,manifest[variant+'-androidTest.apk']);
 run('install','--no-incremental','-r',apk);run('install','--no-incremental','-r',test);
 for(const flow of cases){let log='',passed=false,error,skipped=0,started=0,completed=0;
  try{run('shell','am','force-stop',app);log=run('shell','am','instrument','-w','-r',...extra,'-e','class',app+'.'+flow.name,app+'.test/androidx.test.runner.AndroidJUnitRunner');skipped=(log.match(/INSTRUMENTATION_STATUS_CODE: -(?:3|4)\b/g)||[]).length;started=(log.match(/INSTRUMENTATION_STATUS_CODE: 1\b/g)||[]).length;completed=(log.match(/INSTRUMENTATION_STATUS_CODE: 0\b/g)||[]).length;passed=completed===flow.count&&started===flow.count+skipped&&new RegExp('OK \\(\\d+ tests?\\)').test(log)&&!/FAILURES|INSTRUMENTATION_FAILED|Process crashed|INSTRUMENTATION_STATUS_CODE: -(?:1|2)\b/.test(log);}
  catch(failure){log=String(failure.stdout||'');error='Instrumentation command failed or timed out';}
  fs.writeFileSync(path.join(output,variant+'-'+flow.name.replace('#','-')+'.txt'),log);
  results.push({variant,flow:flow.name,expectedExecutedTests:flow.count,skippedTests:skipped,startedTests:started,completedTests:completed,appSha256,testSha256,passed,error});
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({serial,archive,scope:'Explicit native fixture flows; gated integrations require their dedicated runners',results},null,2));
  console.log(variant+' '+flow.name+': '+(passed?'passed':'failed'));
 }
}
if(results.some(r=>!r.passed))process.exitCode=1;
