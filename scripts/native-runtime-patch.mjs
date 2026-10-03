import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const prefix='packages/app/platforms/android/app/src/main/java/ai/elizaos/app/';
const expected=['ElizaAgentService','WorkflowSurvivorInventory'].map(name=>prefix+name+'.java').sort();
const sha=value=>createHash('sha256').update(value).digest('hex');
function require(value,message){if(!value)throw Error(message);}
export function applyNativeRuntimePatch(root,nativeSource,inputs){
  const proof=nativeSource.compatibilityPatch;
  require(proof?.patch==='android-resident-exact-stop.patch'&&/^[a-f0-9]{64}$/.test(proof.patchSha256),'Unrecognized native compatibility patch');
  require(JSON.stringify(Object.keys(proof.files??{}).sort())===JSON.stringify(expected),'Unexpected native compatibility targets');
  const file=path.join(root,'patches/eliza',proof.patch);
  require(fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink(),'Native compatibility patch is not a regular file');
  require(sha(fs.readFileSync(file))===proof.patchSha256,'Native compatibility patch hash drift');
  const output=new Map();
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-resident-source-'));
  try{
    for(const relative of expected){
      const hashes=proof.files[relative],input=inputs.get(relative);
      require(typeof input==='string'&&hashes.sourceSha256===nativeSource.files[relative]&&sha(input)===hashes.sourceSha256,'Native compatibility original source drift');
      require(/^[a-f0-9]{64}$/.test(hashes.patchedSha256),'Invalid native compatibility output hash');
      const target=path.join(scratch,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,input);
    }
    const touched=execFileSync('git',['apply','--numstat',file],{cwd:scratch,encoding:'utf8',timeout:20000,maxBuffer:65536}).trim().split('\n').map(line=>line.split('\t')[2]).sort();
    require(JSON.stringify(touched)===JSON.stringify(expected),'Native compatibility patch changes unexpected files');
    execFileSync('git',['apply','--check',file],{cwd:scratch,stdio:'pipe',timeout:20000});
    execFileSync('git',['apply',file],{cwd:scratch,stdio:'pipe',timeout:20000});
    for(const relative of expected){
      const target=path.join(scratch,relative),stat=fs.lstatSync(target);
      require(stat.isFile()&&!stat.isSymbolicLink(),'Native compatibility output is not regular');
      const value=fs.readFileSync(target,'utf8');require(sha(value)===proof.files[relative].patchedSha256,'Native compatibility output drift');output.set(relative,value);
    }
    // Do not partially publish outputs if any source, patch or result fails admission.
    for(const [relative,value] of output)inputs.set(relative,value);
  }finally{fs.rmSync(scratch,{recursive:true,force:true});}
}
