import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {applyNativeRuntimePatch} from '../../scripts/native-runtime-patch.mjs';
export function checkNativeRuntimePatch(root, runtimeSource) {
const manifest=JSON.parse(fs.readFileSync(path.join(root,'patches/eliza/android-native-runtime-source.json')));
const original=new Map(Object.keys(manifest.compatibilityPatch.files).map(relative=>[relative,fs.readFileSync(path.join(runtimeSource,relative),'utf8')]));
const sha=value=>createHash('sha256').update(value).digest('hex');
function fixture(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-native-patch-test-'));fs.mkdirSync(path.join(directory,'patches/eliza'),{recursive:true});
 const file=path.join(directory,'patches/eliza',manifest.compatibilityPatch.patch);fs.copyFileSync(path.join(root,'patches/eliza',manifest.compatibilityPatch.patch),file);
 return {directory,file,proof:structuredClone(manifest),inputs:new Map(original),close:()=>fs.rmSync(directory,{recursive:true,force:true})};
}
{
 const f=fixture();try{applyNativeRuntimePatch(f.directory,f.proof,f.inputs);for(const [relative,input] of f.inputs){assert.equal(sha(original.get(relative)),manifest.files[relative]);assert.equal(sha(input),manifest.compatibilityPatch.files[relative].patchedSha256);}}finally{f.close();}
}
{
 const key=Object.keys(manifest.compatibilityPatch.files)[0];
 for(const mutate of [
  f=>f.proof.compatibilityPatch.patch='../other.patch',
  f=>f.proof.compatibilityPatch.patchSha256='0'.repeat(64),
  f=>delete f.proof.compatibilityPatch.files[key],
  f=>f.proof.compatibilityPatch.files['extra.java']={},
  f=>f.proof.compatibilityPatch.files[key].sourceSha256='0'.repeat(64),
  f=>f.proof.files[key]='0'.repeat(64),
  f=>f.proof.compatibilityPatch.files[key].patchedSha256='0'.repeat(64),
  f=>f.inputs.set(key,f.inputs.get(key)+'\n'),
  f=>fs.appendFileSync(f.file,'corrupt'),
  f=>{const target=f.file+'.real';fs.renameSync(f.file,target);fs.symlinkSync(target,f.file);},
  f=>{fs.appendFileSync(f.file,'--- /dev/null\n+++ b/unexpected.txt\n@@ -0,0 +1 @@\n+unexpected\n');f.proof.compatibilityPatch.patchSha256=sha(fs.readFileSync(f.file));},
 ]){const f=fixture();try{mutate(f);const before=[...f.inputs];assert.throws(()=>applyNativeRuntimePatch(f.directory,f.proof,f.inputs));assert.deepEqual([...f.inputs],before);}finally{f.close();}}
}

}
