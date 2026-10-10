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
 fs.writeFileSync(path.join(eliza,'9999-reference-only.patch'),'not applied\n');
 fs.writeFileSync(path.join(eliza,'reference-only-source-base.json'),JSON.stringify({baseCommit:'0'.repeat(40),patch:'9999-reference-only.patch'}));
 // Every applied manifest (and only those) enters the series, in series-number order.
 const applied=fs.readdirSync(eliza).filter(name=>name.endsWith('-source.json')).map(name=>JSON.parse(fs.readFileSync(path.join(eliza,name))).patch).sort();
 assert.ok(applied.includes('0038-password-manager.patch'));assert.ok(!applied.includes('9999-reference-only.patch'));
 assert.deepEqual(readPatchManifests(directory).map(item=>item.manifest.patch),applied);
 const output=prepareElizaPatches({root:directory});
 assert.equal(JSON.parse(fs.readFileSync(path.join(output,'.source.json'))).patches.length,applied.length);
 fs.writeFileSync(path.join(eliza,'0038-duplicate.patch'),'x\n');
 assert.throws(()=>readPatchManifests(directory),/Duplicate Eliza patch series number/);
 fs.rmSync(path.join(eliza,'0038-duplicate.patch'));
 const manifestFile=path.join(eliza,'password-manager-source.json'),manifest=JSON.parse(fs.readFileSync(manifestFile));
 fs.writeFileSync(manifestFile,JSON.stringify({...manifest,patch:'password-manager.patch'}));
 assert.throws(()=>readPatchManifests(directory),/Invalid Eliza patch manifest/);
}));

// Server-side patch overlay used while the agent bundle and workflow worker build.
async function overlayFixture(run){
 const directory=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'alpha-eliza-overlay-')));
 try{
  const pin='a'.repeat(40);
  const write=(file,text)=>{fs.mkdirSync(path.dirname(path.join(directory,file)),{recursive:true});fs.writeFileSync(path.join(directory,file),text);};
  write('upstream.lock.json',JSON.stringify({commit:pin}));
  write('patches/eliza/0045-assistant-ranges.patch','synthetic');
  write('patches/eliza/0038-password-manager.patch','synthetic');
  const files={'plugins/plugin-assistant/src/a.ts':hash('patched a'),'plugins/plugin-assistant/src/new/b.ts':hash('added b')};
  write('patches/eliza/assistant-ranges-source.json',JSON.stringify({baseCommit:pin,patch:'0045-assistant-ranges.patch',sha256:'b'.repeat(64),basePaths:['plugins/plugin-assistant'],addedPaths:[],changed:Object.keys(files),files}));
  write('patches/eliza/password-manager-source.json',JSON.stringify({baseCommit:pin,patch:'0038-password-manager.patch',sha256:'c'.repeat(64),basePaths:['plugins/plugin-native-secure-store'],addedPaths:[],changed:['plugins/plugin-native-secure-store/x.java'],files:{'plugins/plugin-native-secure-store/x.java':hash('native')}}));
  write('.eliza/patched/plugins/plugin-assistant/src/a.ts','patched a');
  write('.eliza/patched/plugins/plugin-assistant/src/new/b.ts','added b');
  write('.eliza/patched/plugins/plugin-native-secure-store/x.java','native');
  write('.eliza/patched/.source.json',JSON.stringify({baseCommit:pin,files:{...files,'plugins/plugin-native-secure-store/x.java':hash('native')}}));
  const source=path.join(directory,'artifacts/local-agent-resident-'+pin);
  write(path.relative(directory,path.join(source,'plugins/plugin-assistant/src/a.ts')),'original a');
  write(path.relative(directory,path.join(source,'plugins/plugin-assistant/src/deleted.ts')),'deleted by patch');
  write(path.relative(directory,path.join(source,'plugins/plugin-assistant/dist/out.js')),'build output');
  write(path.relative(directory,path.join(source,'plugins/plugin-native-secure-store/x.java')),'unpatched native');
  return await run({directory,source,read:file=>fs.existsSync(path.join(source,file))?fs.readFileSync(path.join(source,file),'utf8'):null});
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}

test('server-side patches overlay the prepared source only during the build and restore it exactly',async()=>{
 const {serverSideOverlay,withPatchOverlay,overlayIdentity,writeOverlayRecord,readOverlayRecord,sameOverlay,journalPath}=await import('../scripts/eliza-patch-overlay.mjs');
 await overlayFixture(async({directory,source,read})=>{
  const overlay=serverSideOverlay(directory);
  assert.deepEqual(overlay.patches.map(row=>row.patch),['0045-assistant-ranges.patch'],'native-only patches are not server-side');
  assert.deepEqual(overlay.roots,['plugins/plugin-assistant']);
  const seen={};
  const result=await withPatchOverlay(directory,source,()=>{
   for(const file of ['plugins/plugin-assistant/src/a.ts','plugins/plugin-assistant/src/new/b.ts','plugins/plugin-assistant/src/deleted.ts','plugins/plugin-assistant/dist/out.js','plugins/plugin-native-secure-store/x.java'])seen[file]=read(file);
   assert.ok(fs.existsSync(journalPath(directory,source)),'journalled before any change');
   return 'built';
  });
  assert.equal(result.result,'built');
  assert.deepEqual(seen,{'plugins/plugin-assistant/src/a.ts':'patched a','plugins/plugin-assistant/src/new/b.ts':'added b','plugins/plugin-assistant/src/deleted.ts':null,
   'plugins/plugin-assistant/dist/out.js':'build output','plugins/plugin-native-secure-store/x.java':'unpatched native'});
  assert.equal(read('plugins/plugin-assistant/src/a.ts'),'original a');
  assert.equal(read('plugins/plugin-assistant/src/deleted.ts'),'deleted by patch');
  assert.equal(read('plugins/plugin-assistant/src/new/b.ts'),null);
  assert.equal(fs.existsSync(path.join(source,'plugins/plugin-assistant/src/new')),false,'created directories are removed');
  assert.equal(fs.existsSync(journalPath(directory,source)),false);
  // A failing build still restores the source.
  await assert.rejects(withPatchOverlay(directory,source,()=>{throw Error('build failed');}),/build failed/);
  assert.equal(read('plugins/plugin-assistant/src/a.ts'),'original a');
  // Output records bind reuse to the same overlay.
  const output=path.join(directory,'artifacts/worker');
  writeOverlayRecord(output,overlay);
  assert.ok(sameOverlay(readOverlayRecord(output),overlayIdentity(overlay)));
  assert.ok(!sameOverlay(readOverlayRecord(output),null));
  assert.equal(readOverlayRecord(path.join(directory,'artifacts/none')),null);
 });
});

test('the overlay refuses tampered patched bytes, a stale pin and an interrupted journal, and recovers',async()=>{
 const {withPatchOverlay,restoreOverlay,journalPath}=await import('../scripts/eliza-patch-overlay.mjs');
 await overlayFixture(async({directory,source,read})=>{
  fs.writeFileSync(path.join(directory,'.eliza/patched/plugins/plugin-assistant/src/a.ts'),'tampered');
  await assert.rejects(withPatchOverlay(directory,source,()=>assert.fail('must not build')),/changed after preparation/);
  assert.equal(read('plugins/plugin-assistant/src/a.ts'),'original a');
  fs.writeFileSync(path.join(directory,'.eliza/patched/plugins/plugin-assistant/src/a.ts'),'patched a');
  // Simulate a crash mid-build: the journal remains and blocks the next build until restored.
  await assert.rejects(withPatchOverlay(directory,source,()=>{
   const journal=journalPath(directory,source);fs.copyFileSync(journal,journal+'.keep');fs.cpSync(journal+'.d',journal+'.d.keep',{recursive:true});
   throw Error('crash');
  }),/crash/);
  const journal=journalPath(directory,source);
  fs.renameSync(journal+'.keep',journal);fs.renameSync(journal+'.d.keep',journal+'.d');
  fs.writeFileSync(path.join(source,'plugins/plugin-assistant/src/a.ts'),'patched a');fs.rmSync(path.join(source,'plugins/plugin-assistant/src/deleted.ts'));
  await assert.rejects(withPatchOverlay(directory,source,()=>assert.fail('must not build')),/interrupted patch overlay/);
  assert.equal(restoreOverlay(directory,source),true);
  assert.equal(read('plugins/plugin-assistant/src/a.ts'),'original a');
  assert.equal(read('plugins/plugin-assistant/src/deleted.ts'),'deleted by patch');
  fs.writeFileSync(path.join(directory,'upstream.lock.json'),JSON.stringify({commit:'d'.repeat(40)}));
  await assert.rejects(withPatchOverlay(directory,source,()=>assert.fail('must not build')),/Requalify/);
 });
});

test('agent staging and the worker build run inside the overlay and bind worker reuse to it',()=>{
 const stage=fs.readFileSync(path.join(root,'scripts/stage-local-agent-runtime.mjs'),'utf8');
 assert.match(stage,/withPatchOverlay\(root,source,\(\)=>execFileSync\(process\.env\.ALPHA_BUN\|\|'bun',\['run','--cwd','packages\/agent','build:mobile'/);
 assert.match(stage,/sameOverlay\(readOverlayRecord\(workerArtifactDirectory\(root\)\),expectedOverlay\)/);
 const worker=fs.readFileSync(path.join(root,'scripts/build-workflow-worker.ts'),'utf8');
 assert.match(worker,/withPatchOverlay\(root,source,\(\)=>ensurePreparedWorkflowWorker\(root,source,output\)\)/);
 assert.match(worker,/different set of server-side Eliza patches/);
});
