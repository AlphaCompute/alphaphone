import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {prepareElizaPatches, readPatchManifests} from '../scripts/prepare-eliza-patches.mjs';

const root=path.resolve(import.meta.dirname,'..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(run){
 const directory=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'alpha-eliza-patch-')));
 try{
  fs.copyFileSync(path.join(root,'upstream.lock.json'),path.join(directory,'upstream.lock.json'));
  fs.cpSync(path.join(root,'patches'),path.join(directory,'patches'),{recursive:true});
  fs.mkdirSync(path.join(directory,'vendor'));
  // The base is read through the same pin/clean admission as native staging.
  fs.symlinkSync(fs.realpathSync(path.join(root,'vendor/eliza')),path.join(directory,'vendor/eliza'));
  return run(directory);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}

test('patch manifests bind each reviewed patch to the pin, its hash and every output file',()=>{
 const manifests=readPatchManifests(root);
 assert.ok(manifests.length>=1);
 const pin=JSON.parse(fs.readFileSync(path.join(root,'upstream.lock.json'))).commit;
 for(const {manifest} of manifests){
  assert.equal(manifest.baseCommit,pin);
  assert.equal(hash(fs.readFileSync(path.join(root,'patches/eliza',manifest.patch))),manifest.sha256);
  for(const file of manifest.changed)assert.ok(file in manifest.files,file);
 }
 // The upstream candidate is additive to the secure store and adds the passwords plugin.
 const password=manifests.find(item=>item.manifest.patch==='0038-password-manager.patch').manifest;
 assert.deepEqual(password.addedPaths,['plugins/plugin-native-passwords']);
 assert.ok(password.basePaths.includes('plugins/plugin-native-secure-store'));
});

test('prepared patched source is exact, reused, repaired and never touches vendor/eliza',()=>fixture(directory=>{
 const before=execFileSync('git',['-C',path.join(root,'vendor/eliza'),'status','--porcelain']).toString();
 const output=prepareElizaPatches({root:directory});
 const stamp=JSON.parse(fs.readFileSync(path.join(output,'.source.json')));
 const [{manifest}]=readPatchManifests(directory);
 assert.equal(stamp.baseCommit,manifest.baseCommit);
 for(const [file,digest] of Object.entries(manifest.files))assert.equal(hash(fs.readFileSync(path.join(output,file))),digest,file);
 // Unchanged upstream files are byte-identical to the pin (e.g. the staged credential slots helper).
 const slots='plugins/plugin-native-secure-store/android/src/main/java/ai/eliza/plugins/securestore/nativeonly/JsonCredentialSlots.java';
 assert.deepEqual(fs.readFileSync(path.join(output,slots)),execFileSync('git',['-C',path.join(root,'vendor/eliza'),'show',`${manifest.baseCommit}:${slots}`]));
 // Gradle build state inside module directories does not invalidate the reviewed source.
 const build=path.join(output,'plugins/plugin-native-passwords/android/build/intermediates');fs.mkdirSync(build,{recursive:true});fs.writeFileSync(path.join(build,'x'),'gradle');
 assert.equal(prepareElizaPatches({root:directory}),output);assert.ok(fs.existsSync(path.join(build,'x')));
 const changed=path.join(output,manifest.changed.find(file=>file.endsWith('PasswordVaultStore.java')));
 fs.writeFileSync(changed,'tampered');fs.writeFileSync(path.join(output,'plugins/unexpected.java'),'unreviewed');
 prepareElizaPatches({root:directory});
 assert.equal(hash(fs.readFileSync(changed)),manifest.files[path.relative(output,changed)]);
 assert.equal(fs.existsSync(path.join(output,'plugins/unexpected.java')),false);
 assert.equal(execFileSync('git',['-C',path.join(root,'vendor/eliza'),'status','--porcelain']).toString(),before);
}));

test('pin, patch and manifest tampering are refused without replacing the prepared source',()=>fixture(directory=>{
 const output=prepareElizaPatches({root:directory}),stamp=fs.readFileSync(path.join(output,'.source.json'));
 const lock=path.join(directory,'upstream.lock.json'),pin=fs.readFileSync(lock);
 fs.writeFileSync(lock,JSON.stringify({commit:'0'.repeat(40)}));
 assert.throws(()=>prepareElizaPatches({root:directory}),/Requalify/);
 fs.writeFileSync(lock,pin);
 const patch=path.join(directory,'patches/eliza/0038-password-manager.patch');fs.appendFileSync(patch,'\n');
 assert.throws(()=>prepareElizaPatches({root:directory}),/hash mismatch/);
 assert.deepEqual(fs.readFileSync(path.join(output,'.source.json')),stamp);
 const manifestFile=path.join(directory,'patches/eliza/password-manager-source.json'),manifest=JSON.parse(fs.readFileSync(manifestFile));
 manifest.files['plugins/plugin-native-passwords/../../escape.txt']='0'.repeat(64);fs.writeFileSync(manifestFile,JSON.stringify(manifest));
 assert.throws(()=>prepareElizaPatches({root:directory}),/Invalid Eliza patch manifest/);
}));

test('unknown output directories and symlinks are refused',()=>fixture(directory=>{
 const output=path.join(directory,'.eliza/patched');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'keep'),'owned elsewhere');
 assert.throws(()=>prepareElizaPatches({root:directory}),/unrecognized/);
 assert.equal(fs.readFileSync(path.join(output,'keep'),'utf8'),'owned elsewhere');
 fs.rmSync(output,{recursive:true});prepareElizaPatches({root:directory});
 fs.symlinkSync(path.join(directory,'upstream.lock.json'),path.join(output,'link'));
 assert.throws(()=>prepareElizaPatches({root:directory}),/Symlink/);
}));

test('numbered series: reference-only patches are ignored, unnumbered or duplicate numbers are refused',()=>fixture(directory=>{
 const eliza=path.join(directory,'patches/eliza');
 // A reference-only patch (qualified in isolated upstream worktrees) never enters .eliza/patched.
 fs.writeFileSync(path.join(eliza,'0037-reference-only.patch'),'not applied\n');
 fs.writeFileSync(path.join(eliza,'reference-only-source-base.json'),JSON.stringify({baseCommit:'0'.repeat(40),patch:'0037-reference-only.patch'}));
 assert.deepEqual(readPatchManifests(directory).map(item=>item.manifest.patch),['0038-password-manager.patch']);
 const output=prepareElizaPatches({root:directory});
 assert.equal(JSON.parse(fs.readFileSync(path.join(output,'.source.json'))).patches.length,1);
 fs.writeFileSync(path.join(eliza,'0038-duplicate.patch'),'x\n');
 assert.throws(()=>readPatchManifests(directory),/Duplicate Eliza patch series number/);
 fs.rmSync(path.join(eliza,'0038-duplicate.patch'));
 const manifestFile=path.join(eliza,'password-manager-source.json'),manifest=JSON.parse(fs.readFileSync(manifestFile));
 fs.writeFileSync(manifestFile,JSON.stringify({...manifest,patch:'password-manager.patch'}));
 assert.throws(()=>readPatchManifests(directory),/Invalid Eliza patch manifest/);
}));
