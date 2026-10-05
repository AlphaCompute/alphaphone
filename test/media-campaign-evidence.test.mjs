import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
const script=path.resolve('scripts/android-media-smoke.mjs');
function exercise(mode){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'alpha-media-evidence-')));
 try{
  const sdk=path.join(root,'sdk'),jdk=path.join(root,'jdk'),commands=path.join(root,'commands.jsonl');
  fs.mkdirSync(path.join(sdk,'platform-tools'),{recursive:true});fs.mkdirSync(jdk);fs.writeFileSync(path.join(jdk,'release'),'JAVA_VERSION="21.0.1"');fs.writeFileSync(commands,'');
  fs.writeFileSync(path.join(root,'app.config.json'),JSON.stringify({appId:'ai.elizaresearch.alphaphone'}));fs.mkdirSync(path.join(root,'artifacts'));
  const results=[];
  for(const variant of ['standalone','launcher']){const file=`artifacts/${variant}-debug.apk`,bytes=Buffer.from(variant);fs.writeFileSync(path.join(root,file),bytes);results.push({file,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}
  fs.writeFileSync(path.join(root,'artifacts/apk-manifest.json'),JSON.stringify({results}));
  fs.writeFileSync(path.join(sdk,'platform-tools/adb'),`#!${process.execPath}
const fs=require('node:fs'),a=process.argv.slice(4),mode=${JSON.stringify(mode)};fs.appendFileSync(${JSON.stringify(commands)},JSON.stringify(a)+'\\n');
if(a[0]==='install')console.log('Success');
else if(a.includes('instrument')){
 const selectors=a[a.indexOf('class')+1].split(','),n=selectors.length;
 const block=(selector,code)=>{const [cls,method]=selector.split('#');return 'INSTRUMENTATION_STATUS: class='+cls+'\\nINSTRUMENTATION_STATUS: test='+method+'\\nINSTRUMENTATION_STATUS: numtests='+n+'\\nINSTRUMENTATION_STATUS_CODE: '+code+'\\n';};
 let out=selectors.map(s=>block(s,1)+block(s,0)).join('')+'OK ('+n+' test'+(n===1?'':'s')+')\\nINSTRUMENTATION_CODE: -1\\n';
 if(mode==='summary')out='OK ('+n+' test'+(n===1?'':'s')+')\\n';
 if(mode==='method')out=out.replaceAll('test='+selectors[0].split('#')[1],'test=unrequestedMethod');
 if(mode==='class')out=out.replaceAll('class='+selectors[0].split('#')[0],'class=unrequested.Class');
 if(mode==='skip')out=out.replace('INSTRUMENTATION_STATUS_CODE: 0','INSTRUMENTATION_STATUS_CODE: -3');
 if(mode==='terminal')out=out.replace('INSTRUMENTATION_CODE: -1','INSTRUMENTATION_CODE: 0');
 if(mode==='duplicate')out=block(selectors[0],1)+block(selectors[0],0)+out;
 console.log(out);
}else process.exit(1);
`,{mode:0o700});
  const run=spawnSync(process.execPath,[script],{cwd:root,env:{...process.env,ANDROID_HOME:sdk,ANDROID_SDK_ROOT:sdk,JAVA_HOME:jdk,ANDROID_SERIAL:'emulator-9999',ALPHA_MEDIA_RESULTS:path.join(root,'output')},encoding:'utf8',timeout:30000});
  assert.ifError(run.error);assert.ok(fs.existsSync(path.join(root,'output/result.json')),run.stderr);
  return {code:run.status,stderr:run.stderr,evidence:JSON.parse(fs.readFileSync(path.join(root,'output/result.json'))),commands:fs.readFileSync(commands,'utf8').trim().split('\n').map(JSON.parse),logs:fs.readdirSync(path.join(root,'output')).filter(n=>n.endsWith('.txt')).map(n=>fs.readFileSync(path.join(root,'output',n),'utf8'))};
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('media campaign explicitly runs all audio cases and verifies exact raw methods on both distributions',()=>{
 const r=exercise('pass');assert.equal(r.code,0,r.stderr);assert.equal(r.evidence.results.length,8);assert.deepEqual(r.evidence.results.map(row=>row.expectedTests),[6,2,1,1,6,2,1,1]);
 assert.ok(r.evidence.results.every(row=>row.passed&&row.instrumentation.completed===row.expectedTests));
 const calls=r.commands.filter(a=>a.includes('instrument'));assert.equal(calls.length,8);assert.ok(calls.every(a=>a.includes('-r')));
 for(const a of calls.filter(a=>a[a.indexOf('class')+1].includes('NoteAudioInstrumentedTest'))){assert.equal(a[a.indexOf('audioFence')+1],'true');assert.ok(a[a.indexOf('class')+1].includes('#optInRetiredDeletionCannotArriveAfterReloadAndRestore'));}
});
for(const mode of ['summary','method','class','skip','terminal','duplicate'])test(`media campaign rejects ${mode} evidence and preserves its raw log`,()=>{
 const r=exercise(mode);assert.notEqual(r.code,0);assert.equal(r.evidence.results.length,8);assert.ok(r.evidence.results.every(row=>!row.passed&&!row.instrumentation));assert.equal(r.logs.length,8);assert.ok(r.logs.every(log=>log.includes('OK (')));
});
