import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const script=path.resolve('scripts/test-bookmark-restart.mjs');
function exercise(mode){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-bookmark-runner-'));
 try{
  fs.mkdirSync(path.join(root,'sdk'));fs.writeFileSync(path.join(root,'app.apk'),'fixture-app');fs.writeFileSync(path.join(root,'test.apk'),'fixture-test');fs.writeFileSync(path.join(root,'app.config.json'),JSON.stringify({appId:'ai.elizaresearch.alphaphone'}));
  const preload=path.join(root,'preload.mjs');fs.writeFileSync(preload,`
import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import fs from 'node:fs';
cp.execFileSync=(file,args,options)=>{
 fs.appendFileSync('commands.jsonl',JSON.stringify({args,timeout:options.timeout})+'\\n');
 if(!args.includes('instrument')){if(!args.includes('install')&&!args.includes('force-stop'))throw Error('Unexpected command');return '';}
 const phase=args[args.indexOf('bookmarkPhase')+1],mode=phase==='prepare'?${JSON.stringify(mode)}:'pass';
 const cls='ai.elizaresearch.alphaphone.BrowserContinuityInstrumentedTest';
 const block=(code,method='bookmarkProcessRestartPhase',count='1')=>'INSTRUMENTATION_STATUS: class='+cls+'\\nINSTRUMENTATION_STATUS: test='+method+'\\nINSTRUMENTATION_STATUS: numtests='+count+'\\nINSTRUMENTATION_STATUS_CODE: '+code+'\\n';
 if(mode==='timeout')throw Object.assign(Error('Fixture timeout'),{stdout:block(1),stderr:'bounded fixture diagnostic',status:null,signal:'SIGTERM',code:'ETIMEDOUT'});
 let text=block(1)+block(0)+'OK (1 test)\\nINSTRUMENTATION_CODE: -1\\n';
 if(mode==='skip')text=block(1)+block(-4)+'OK (1 test)\\nINSTRUMENTATION_CODE: -1\\n';
 if(mode==='wrong-method')text=text.replaceAll('bookmarkProcessRestartPhase','differentMethod');
 if(mode==='missing-start')text=block(0)+'OK (1 test)\\nINSTRUMENTATION_CODE: -1\\n';
 if(mode==='duplicate')text=block(1)+block(0)+text;
 if(mode==='wrong-terminal')text=text.replace('INSTRUMENTATION_CODE: -1','INSTRUMENTATION_CODE: 0');
 if(mode==='wrong-count')text=text.replaceAll('numtests=1','numtests=2');
 return text;
};syncBuiltinESMExports();`);
  const run=spawnSync(process.execPath,['--import',preload,script,path.join(root,'app.apk'),path.join(root,'test.apk'),'output'],{cwd:root,env:{...process.env,ANDROID_SERIAL:'emulator-fixture',ANDROID_HOME:path.join(root,'sdk'),JAVA_HOME:root},encoding:'utf8',timeout:15000});
  const result=JSON.parse(fs.readFileSync(path.join(root,'output/result.json'),'utf8'));const commands=fs.readFileSync(path.join(root,'commands.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(commands.every(c=>c.timeout===(c.args.includes('instrument')?180000:120000)));
  return {code:run.status,result,commands,partial:fs.readFileSync(path.join(root,'output/prepare.txt'),'utf8'),stderr:fs.existsSync(path.join(root,'output/prepare.stderr.txt'))?fs.readFileSync(path.join(root,'output/prepare.stderr.txt'),'utf8'):null};
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('bookmark runner requires exact method across real process-boundary command sequence',()=>{const r=exercise('pass');assert.equal(r.code,0);assert.equal(r.result.passed,true);assert.deepEqual(r.result.phases.map(p=>p.name),['prepare','verify','verifyRemoved','cleanup']);assert.equal(r.commands.filter(c=>c.args.includes('force-stop')).length,2);assert.ok(r.result.phases.every(p=>p.result.totalTests===1));});
for(const mode of ['skip','wrong-method','missing-start','duplicate','wrong-terminal','wrong-count','timeout'])test(`bookmark runner refuses ${mode} and retains cleanup evidence`,()=>{const r=exercise(mode);assert.notEqual(r.code,0);assert.equal(r.result.passed,false);assert.deepEqual(r.result.phases.map(p=>[p.name,p.passed]),mode==='timeout'?[['prepare',false]]:[['prepare',false],['cleanup',true]]);assert.equal(r.commands.filter(c=>c.args.includes('force-stop')).length,0);assert.ok(r.partial.includes('INSTRUMENTATION_STATUS'));if(mode==='timeout'){assert.equal(r.commands.filter(c=>c.args.includes('instrument')).length,1);assert.equal(r.result.cleanupDeferred.reason,'instrumentation-transport-uncertain');assert.equal(r.result.phases[0].transport.code,'ETIMEDOUT');assert.equal(r.stderr,'bounded fixture diagnostic');}});
