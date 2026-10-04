import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'alpha-source-publication-')));
after(()=>fs.rm(root,{recursive:true,force:true}));
const helper='plugins/plugin-workflow/src/services/workflow-source-publication.ts';
const sourceRoot=fileURLToPath(new URL('../vendor/eliza/',import.meta.url));
const pin=JSON.parse(await fs.readFile(new URL('../upstream.lock.json',import.meta.url),'utf8')).commit;
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim(),pin);
const committed=execFileSync('git',['show',pin+':'+helper],{cwd:sourceRoot});
assert.deepEqual(await fs.readFile(path.join(sourceRoot,helper)),committed);
await fs.mkdir(path.dirname(path.join(root,helper)),{recursive:true});
await fs.writeFile(path.join(root,helper),committed);
const {publishAndroidWorkflowSource:publish}=await import(pathToFileURL(path.join(root,helper)).href);
async function fixture(){const dir=await fs.mkdtemp(path.join(root,'state-'));return {dir,target:path.join(dir,'version.hash.tsx')};}
test('Android source publication publishes complete bytes across concurrent writers and retains importer inode',async()=>{
 const {dir,target}=await fixture(),source='export default '+JSON.stringify('x'.repeat(100000))+';';
 await Promise.all(Array.from({length:16},()=>publish(target,source)));
 const handle=await fs.open(target,'r');try{const initial=await handle.stat();await Promise.all(Array.from({length:16},()=>publish(target,source)));assert.equal((await fs.stat(target)).ino,initial.ino);assert.equal(await handle.readFile('utf8'),source);}finally{await handle.close();}
 assert.deepEqual(await fs.readdir(dir),[path.basename(target)]);
 await assert.rejects(publish(target,'different'),/identity mismatch/);assert.equal(await fs.readFile(target,'utf8'),source);
});
test('Android publication refuses existing symlinks and permissive files without replacing them',async()=>{
 const {dir,target}=await fixture(),other=path.join(dir,'other');await fs.writeFile(other,'private',{mode:0o600});await fs.symlink(other,target);
 await assert.rejects(publish(target,'new'));assert.equal(await fs.readlink(target),other);assert.equal(await fs.readFile(other,'utf8'),'private');
 await fs.unlink(target);await fs.writeFile(target,'new',{mode:0o644});await assert.rejects(publish(target,'new'),/identity mismatch/);assert.equal((await fs.stat(target)).mode&0o777,0o644);
});
test('Android publication preserves abandoned reservations and never steals their source path',async()=>{
 const {dir,target}=await fixture(),reservation=target+'.publication';await fs.mkdir(reservation,{mode:0o700});const initial=await fs.stat(reservation);
 await assert.rejects(publish(target,'new'),/unresolved; preserve reservation/);assert.equal((await fs.stat(reservation)).ino,initial.ino);await assert.rejects(fs.stat(target),{code:'ENOENT'});assert.deepEqual(await fs.readdir(dir),[path.basename(reservation)]);
});
test('Android publication refuses nonprivate reservations and writable parent directories',async()=>{
 const {dir,target}=await fixture();await fs.mkdir(target+'.publication',{mode:0o755});await assert.rejects(publish(target,'new'),/Untrusted workflow source reservation/);await fs.rmdir(target+'.publication');await fs.chmod(dir,0o777);await assert.rejects(publish(target,'new'),/Untrusted workflow source directory/);await assert.rejects(fs.stat(target),{code:'ENOENT'});
});
