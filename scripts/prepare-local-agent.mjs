#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {digest, sourceDirectory, verifySource} from './local-agent-source.mjs';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const directory=sourceDirectory(root);
const patches=path.join(root,'patches/eliza');
const manifest=JSON.parse(fs.readFileSync(path.join(patches,'mvp-source-base.json'),'utf8'));
const extraManifest=JSON.parse(fs.readFileSync(path.join(patches,'android-local-runtime-source.json'),'utf8'));
const extras=extraManifest.patches;
const stamp={manifestSha256:digest(path.join(patches,'mvp-source-base.json')),consumerManifestSha256:digest(path.join(patches,'android-local-runtime-source.json')),preparerSha256:digest(path.join(root,'scripts/prepare-local-agent.mjs')),guardSha256:digest(path.join(root,'scripts/local-agent-source.mjs')),base:manifest.baseCommit,patches:[...manifest.patches.map(p=>({file:p.file,sha256:p.sha256})),...extras.map(file=>({file,sha256:digest(path.join(patches,file))}))]};
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
 verifySource(directory,manifest,extraManifest);
 fs.writeFileSync(stampFile,JSON.stringify(stamp,null,2)+'\n');
}
// Recheck generated source on every invocation, including cached preparations.
verifySource(directory,manifest,extraManifest);
if(!process.argv.includes('--source-only'))run(process.env.ALPHA_BUN||'bun',['install','--frozen-lockfile']);
verifySource(directory,manifest,extraManifest);
console.log(`Prepared local runtime: ${directory}`);
