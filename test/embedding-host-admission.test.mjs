import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {verifyEmbeddingHost} from '../scripts/stage-embedding-host.mjs';
const root=path.resolve(import.meta.dirname,'..');
const qualified=JSON.parse(fs.readFileSync(path.join(root,'android/embedding-host/qualified-host.json'),'utf8'));
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-embed-admission-'));
 for(const name of ['upstream.lock.json','app.config.json','android/embedding-host/qualified-host.json']){fs.mkdirSync(path.dirname(path.join(dir,name)),{recursive:true});fs.copyFileSync(path.join(root,name),path.join(dir,name));}
 // Tiny content fixtures retain the production manifest shape; the known BGE hash is checked last.
 for(const row of qualified.libraries){const file=path.join(dir,'android/app/src/main/jniLibs/arm64-v8a',row.name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'fixture-'+row.name);}
 const manifest=structuredClone(qualified);for(const row of manifest.libraries)row.sha256=createHash('sha256').update('fixture-'+row.name).digest('hex');
 fs.writeFileSync(path.join(dir,'android/embedding-host/qualified-host.json'),JSON.stringify(manifest));
 return {dir,manifest,write(){fs.writeFileSync(path.join(dir,'android/embedding-host/qualified-host.json'),JSON.stringify(manifest));},close(){fs.rmSync(dir,{recursive:true,force:true});}};
}
test('missing and corrupted native host bytes fail before APK packaging',()=>{
 for(const name of qualified.libraries.map(row=>row.name)){
  const f=fixture();try{const file=path.join(f.dir,'android/app/src/main/jniLibs/arm64-v8a',name);fs.unlinkSync(file);assert.throws(()=>verifyEmbeddingHost(f.dir),/missing or changed/);fs.writeFileSync(file,'tampered');assert.throws(()=>verifyEmbeddingHost(f.dir),/missing or changed/);}finally{f.close();}
 }
});
test('partial native set, changed identity and wrong model dimensions are refused',()=>{
 for(const mutation of [m=>m.libraries.pop(),m=>m.identity='other.product',m=>m.model.dimensions=1536,m=>m.pin='0'.repeat(40)]){
  const f=fixture();try{mutation(f.manifest);f.write();assert.throws(()=>verifyEmbeddingHost(f.dir),/admission changed|Incomplete/);}finally{f.close();}
 }
});
test('a valid native set does not bypass the pinned local model admission',()=>{
 const f=fixture();try{assert.throws(()=>verifyEmbeddingHost(f.dir),/BGE384 model missing/);const model=path.join(f.dir,qualified.model.path);fs.mkdirSync(path.dirname(model),{recursive:true});fs.writeFileSync(model,'incorrect model');assert.throws(()=>verifyEmbeddingHost(f.dir),/BGE384 model missing or changed/);}finally{f.close();}
});
