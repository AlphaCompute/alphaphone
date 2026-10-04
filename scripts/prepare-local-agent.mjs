#!/usr/bin/env node
/** Prepare one immutable upstream commit without consumer source overlays. */
import fs from 'node:fs';
import path from 'node:path';
import {digest, sourceDirectory, verifySource} from './local-agent-source.mjs';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const directory=sourceDirectory(root);
const lock=JSON.parse(fs.readFileSync(path.join(root,'upstream.lock.json'),'utf8'));
const stamp={lockSha256:digest(path.join(root,'upstream.lock.json')),preparerSha256:digest(path.join(root,'scripts/prepare-local-agent.mjs')),guardSha256:digest(path.join(root,'scripts/local-agent-source.mjs')),base:lock.commit,patches:[]};
const run=(command,args,cwd=directory)=>execFileSync(command,args,{cwd,stdio:'inherit',env:{...process.env,ELIZA_SKIP_FUSED_INFERENCE_SETUP:'1'}});
const stampFile=path.join(directory,'.alpha-runtime-source.json');
if(fs.existsSync(directory)){
 if(!fs.existsSync(stampFile)||fs.readFileSync(stampFile,'utf8')!==JSON.stringify(stamp,null,2)+'\n')throw Error('Prepared runtime differs or preparation was interrupted. Preserve it and choose a fresh artifacts/local-agent-source directory.');
} else {
 fs.mkdirSync(directory,{recursive:true});
 run('git',['init','--quiet']);
 run('git',['fetch','--depth=1',process.env.ALPHA_RUNTIME_GIT_CACHE||lock.url,lock.commit]);
 run('git',['checkout','--detach','FETCH_HEAD']);
 verifySource(directory,lock.commit);
 fs.writeFileSync(stampFile,JSON.stringify(stamp,null,2)+'\n');
}
verifySource(directory,lock.commit);
if(!process.argv.includes('--source-only'))run(process.env.ALPHA_BUN||'bun',['install','--frozen-lockfile']);
verifySource(directory,lock.commit);
console.log(`Prepared local runtime: ${directory}`);
