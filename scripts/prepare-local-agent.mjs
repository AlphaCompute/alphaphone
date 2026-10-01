#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const directory=path.join(root,'artifacts/local-agent-source');
const patches=path.join(root,'patches/eliza');
const manifest=JSON.parse(fs.readFileSync(path.join(patches,'mvp-source-base.json'),'utf8'));
const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const extras=['android-secure-store-socket.patch'];
const stamp={base:manifest.baseCommit,patches:[...manifest.patches.map(p=>({file:p.file,sha256:p.sha256})),...extras.map(file=>({file,sha256:digest(path.join(patches,file))}))]};
const run=(command,args,cwd=directory)=>execFileSync(command,args,{cwd,stdio:'inherit',env:{...process.env,ELIZA_SKIP_FUSED_INFERENCE_SETUP:'1'}});
for(const patch of stamp.patches)if(digest(path.join(patches,patch.file))!==patch.sha256)throw Error(`Patch hash mismatch: ${patch.file}`);
const stampFile=path.join(directory,'.alpha-runtime-source.json');
if(fs.existsSync(directory)){
 if(!fs.existsSync(stampFile)||fs.readFileSync(stampFile,'utf8')!==JSON.stringify(stamp,null,2)+'\n')throw Error('Prepared runtime differs or preparation was interrupted. Preserve it and choose a fresh artifacts/local-agent-source directory.');
} else {
 fs.mkdirSync(directory,{recursive:true});
 run('git',['init','--quiet']);
 run('git',['fetch','--depth=1',process.env.ALPHA_RUNTIME_GIT_CACHE||manifest.repository,manifest.baseCommit]);
 run('git',['checkout','--detach','FETCH_HEAD']);
 for(const patch of manifest.patches){run('git',['apply','--check',path.join(patches,patch.file)]);run('git',['apply',path.join(patches,patch.file)]);}
 for(const [file,hash] of Object.entries(manifest.candidateFiles))if(digest(path.join(directory,file))!==hash)throw Error(`Composed source mismatch: ${file}`);
 for(const extra of extras){run('git',['apply','--check',path.join(patches,extra)]);run('git',['apply',path.join(patches,extra)]);}
 fs.writeFileSync(stampFile,JSON.stringify(stamp,null,2)+'\n');
}
// Recheck generated source on every invocation, including cached preparations.
if(execFileSync('git',['rev-parse','HEAD'],{cwd:directory,encoding:'utf8'}).trim()!==manifest.baseCommit)throw Error('Prepared runtime base commit changed');
const extraManifest=JSON.parse(fs.readFileSync(path.join(patches,'android-local-runtime-source.json'),'utf8'));
const expectedFiles={...manifest.candidateFiles,...extraManifest.files};
for(const [file,hash] of Object.entries(expectedFiles))if(digest(path.join(directory,file))!==hash)throw Error(`Prepared source changed: ${file}`);
const modified=execFileSync('git',['diff','--name-only','HEAD'],{cwd:directory,encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const file of modified)if(!Object.hasOwn(expectedFiles,file))throw Error(`Unexpected runtime source change: ${file}`);
if(!process.argv.includes('--source-only'))run(process.env.ALPHA_BUN||'bun',['install','--frozen-lockfile']);
console.log(`Prepared local runtime: ${directory}`);
