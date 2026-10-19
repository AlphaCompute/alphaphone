import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {preparePatchedNative} from '../scripts/prepare-patched-native.mjs';
import {sha} from '../scripts/upstream-native-source.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const file='resident-native-manifest.json';
function fixture(run){
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-resident-patch-'));
 try{
  fs.mkdirSync(path.join(temporary,'vendor'));fs.symlinkSync(fs.realpathSync(path.join(root,'vendor/eliza')),path.join(temporary,'vendor/eliza'),'dir');
  fs.copyFileSync(path.join(root,'upstream.lock.json'),path.join(temporary,'upstream.lock.json'));
  fs.mkdirSync(path.join(temporary,'patches/eliza'),{recursive:true});
  for(const name of [file,'resident-ipc-recovery.patch'])fs.copyFileSync(path.join(root,'patches/eliza',name),path.join(temporary,'patches/eliza',name));
  const manifest=()=>JSON.parse(fs.readFileSync(path.join(temporary,'patches/eliza',file),'utf8'));
  const change=mutate=>{const value=manifest();mutate(value);fs.writeFileSync(path.join(temporary,'patches/eliza',file),JSON.stringify(value));};
  run({temporary,manifest,change,produce:()=>preparePatchedNative({root:temporary,manifestFile:file})});
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
test('resident producer patches exactly the two pinned SDK sources and retains their provenance',()=>fixture(({produce,manifest})=>{
 const expected=manifest(),before=expected.patches[0].targets.map(row=>sha(fs.readFileSync(path.join(root,'vendor/eliza',row.path))));
 const result=produce();
 assert.deepEqual(Object.keys(result.files).sort(),expected.patches[0].targets.map(row=>row.path).sort());
 assert.equal(result.baseCommit,expected.baseCommit);assert.equal(result.upstreamCandidateCommit,expected.upstreamCandidateCommit);
 for(const [index,row] of expected.patches[0].targets.entries()){
  assert.equal(sha(fs.readFileSync(path.join(result.root,row.path))),row.afterSha256);
  assert.equal(sha(fs.readFileSync(path.join(root,'vendor/eliza',row.path))),before[index],'vendor bytes never change');
 }
 assert.deepEqual(produce(),result,'same inputs revalidate identical staged bytes');
}));
for(const [label,mutate,error] of [
 ['wrong source',m=>m.patches[0].targets[0].beforeSha256='0'.repeat(64),/source/],
 ['wrong output',m=>m.patches[0].targets[0].afterSha256='0'.repeat(64),/output/],
 ['wrong pin',m=>m.baseCommit='0'.repeat(40),/pin/],
 ['undeclared SDK target',m=>m.patches[0].targets.push({...m.patches[0].targets[0],path:'packages/app/platforms/android/app/src/main/java/ai/elizaos/app/Other.java'}),/exactly/],
 ['invalid upstream candidate',m=>m.upstreamCandidateCommit='../unreviewed',/exactly/],
])test(`resident producer refuses ${label}`,()=>fixture(({produce,change})=>{change(mutate);assert.throws(produce,error);}));
test('resident producer refuses changed patch bytes before publication',()=>fixture(({produce,temporary})=>{
 fs.appendFileSync(path.join(temporary,'patches/eliza/resident-ipc-recovery.patch'),'unreviewed bytes\n');assert.throws(produce,/digest/);
 assert.equal(fs.existsSync(path.join(temporary,'.eliza/patched-native')),false);
}));
test('resident producer rejects stale cached output without silently repairing it',()=>fixture(({produce,manifest})=>{
 const prepared=produce(),target=path.join(prepared.root,manifest().patches[0].targets[0].path);
 fs.appendFileSync(target,'\n// stale generated output\n');const changed=fs.readFileSync(target);
 assert.throws(produce,/drift/);assert.deepEqual(fs.readFileSync(target),changed);
}));
test('resident source cannot enter the generic plugin slot',()=>fixture(({temporary,manifest})=>{
 fs.writeFileSync(path.join(temporary,'patches/eliza/native-manifest.json'),JSON.stringify(manifest()));
 assert.throws(()=>preparePatchedNative({root:temporary}),/explicit native patch slot/);
 assert.throws(()=>preparePatchedNative({root:temporary,manifestFile:'../other.json'}),/Unknown native patch slot/);
}));
