import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const scripts={workflow:path.resolve('scripts/android-workflow-native.mjs'),calendar:path.resolve('scripts/test-calendar-range.mjs'),camera:path.resolve('scripts/test-camera-permission.mjs')};
function exercise(kind,mode) {
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'alpha-native-evidence-')));
  try {
    const app='ai.elizaresearch.alphaphone',archive=path.join(root,'test-results/archive'),out=path.join(root,'test-results/evidence'),sdk=path.join(root,'sdk'),jdk=path.join(root,'jdk'),state=path.join(root,'state.json'),commands=path.join(root,'commands.jsonl');
    fs.mkdirSync(archive,{recursive:true});fs.mkdirSync(path.join(sdk,'platform-tools'),{recursive:true});fs.mkdirSync(jdk);fs.writeFileSync(path.join(jdk,'release'),'JAVA_VERSION="21.0.1"');
    fs.writeFileSync(path.join(root,'app.config.json'),JSON.stringify({appId:app}));
    const original=Object.fromEntries(['CAMERA','READ_CALENDAR','WRITE_CALENDAR'].map((name,i)=>['android.permission.'+name,{granted:i!==2,flags:['USER_SET']}]));
    fs.writeFileSync(state,JSON.stringify(original));fs.writeFileSync(commands,'');
    const manifest={};
    for(const variant of ['standalone','launcher'])for(const suffix of ['debug','androidTest']){
      const name=`${variant}-${suffix}.apk`,bytes=Buffer.from(name);fs.writeFileSync(path.join(archive,name),bytes);manifest[name]=crypto.createHash('sha256').update(bytes).digest('hex');
    }
    fs.writeFileSync(path.join(archive,'apk-manifest.json'),JSON.stringify(manifest));
    fs.writeFileSync(path.join(sdk,'platform-tools/adb'),`#!${process.execPath}
const fs=require('node:fs'),args=process.argv.slice(4),state=${JSON.stringify(state)},log=${JSON.stringify(commands)},mode=${JSON.stringify(mode)};
const saved=JSON.parse(fs.readFileSync(state));fs.appendFileSync(log,JSON.stringify(args)+'\\n');
if(args.includes('dumpsys'))console.log(Object.entries(saved).map(([permission,row])=>permission+': granted='+row.granted+', flags=['+row.flags.join('|')+']').join('\\n'));
else if(args.includes('grant')||args.includes('revoke')){saved[args.at(-1)].granted=args.includes('grant');fs.writeFileSync(state,JSON.stringify(saved));}
else if(args.includes('clear-permission-flags')||args.includes('set-permission-flags')){
 const permission=args[4],flags=args.slice(5).map(f=>f.toUpperCase().replaceAll('-','_'));
 saved[permission].flags=args.includes('clear-permission-flags')?saved[permission].flags.filter(f=>!flags.includes(f)):[...new Set([...saved[permission].flags,...flags])].sort();fs.writeFileSync(state,JSON.stringify(saved));
}else if(args.includes('instrument')){
 const selectors=args[args.indexOf('class')+1].split(','),count=selectors.length;
 const block=(selector,code)=>{const [cls,method]=selector.split('#');return 'INSTRUMENTATION_STATUS: class='+cls+'\\nINSTRUMENTATION_STATUS: test='+method+'\\nINSTRUMENTATION_STATUS: numtests='+count+'\\nINSTRUMENTATION_STATUS_CODE: '+code+'\\n';};
 let output=selectors.map(s=>block(s,1)+block(s,0)).join('')+'OK ('+count+' test'+(count===1?'':'s')+')\\nINSTRUMENTATION_CODE: -1\\n';
 if(mode==='summary')output='OK ('+count+' test'+(count===1?'':'s')+')\\n';
 if(mode==='method')output=output.replaceAll('test='+selectors[0].split('#')[1],'test='+selectors[0].split('#')[1]+'Extra');
 if(mode==='class')output=output.replaceAll('class='+selectors[0].split('#')[0],'class=unexpected.Class');
 if(mode==='skip')output=output.replace('INSTRUMENTATION_STATUS_CODE: 0','INSTRUMENTATION_STATUS_CODE: -3');
 if(mode==='terminal')output=output.replace('INSTRUMENTATION_CODE: -1','INSTRUMENTATION_CODE: 0');
 if(mode==='duplicate')output=block(selectors[0],1)+block(selectors[0],0)+output;
 console.log(output);
}else if(args[0]==='install'||args.includes('force-stop'))console.log('Success');
else {console.error('Unexpected fixture command');process.exit(1);}
`,{mode:0o700});
    const args=kind==='workflow'?[]:[path.join(archive,'standalone-debug.apk'),path.join(archive,'standalone-androidTest.apk'),out];
    const run=spawnSync(process.execPath,[scripts[kind],...args],{cwd:root,env:{...process.env,ANDROID_SERIAL:'emulator-9999',ANDROID_HOME:sdk,ANDROID_SDK_ROOT:sdk,JAVA_HOME:jdk,ALPHA_BUILD_ARCHIVE:archive,ALPHA_CAMPAIGN_OUTPUT:out},encoding:'utf8',timeout:30000});
    assert.ifError(run.error);
    assert.ok(fs.existsSync(path.join(out,'result.json')),run.stderr || 'Campaign did not produce evidence');
    return {code:run.status,error:run.stderr,original,restored:JSON.parse(fs.readFileSync(state)),evidence:JSON.parse(fs.readFileSync(path.join(out,'result.json'))),commands:fs.readFileSync(commands,'utf8').trim().split('\n').map(JSON.parse),logs:fs.readdirSync(out).filter(n=>n.endsWith('.txt')).map(n=>fs.readFileSync(path.join(out,n),'utf8'))};
  } finally {fs.rmSync(root,{recursive:true,force:true});}
}
for(const kind of Object.keys(scripts)) {
  test(`${kind} campaign accepts exact raw cases and restores permissions`,()=>{
    const r=exercise(kind,'pass');assert.equal(r.code,0,r.error);assert.deepEqual(r.restored,r.original);
    const rows=kind==='workflow'?r.evidence.results:[r.evidence];
    assert.ok(rows.every(row=>row.passed&&row.permissionsRestored));
    const receipts=kind==='workflow'?rows.flatMap(row=>row.methods.map(m=>m.instrumentation)):[r.evidence.instrumentation];
    assert.ok(receipts.every(receipt=>receipt.completed===receipt.totalTests&&receipt.cases.length===receipt.totalTests));
    assert.ok(r.commands.filter(a=>a.includes('instrument')).every(a=>a.includes('-r')));
  });
  for(const mode of ['summary','method','class','skip','terminal','duplicate'])test(`${kind} rejects ${mode} evidence while restoring permissions`,()=>{
    const r=exercise(kind,mode);assert.notEqual(r.code,0);assert.deepEqual(r.restored,r.original);
    const rows=kind==='workflow'?r.evidence.results:[r.evidence];assert.ok(rows.every(row=>!row.passed&&row.permissionsRestored));
    assert.ok(r.logs.length>0&&r.logs.every(log=>log.includes('OK (')));
  });
}
