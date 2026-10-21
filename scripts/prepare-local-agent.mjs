#!/usr/bin/env node
/** Prepare one immutable upstream commit without consumer source overlays. */
import fs from 'node:fs';
import path from 'node:path';
import {digest, preparedSourceEnv, sourceDirectory, verifySource, seedCommittedCache} from './local-agent-source.mjs';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const directory=sourceDirectory(root);
const lock=JSON.parse(fs.readFileSync(path.join(root,'upstream.lock.json'),'utf8'));
const stamp={lockSha256:digest(path.join(root,'upstream.lock.json')),preparerSha256:digest(path.join(root,'scripts/prepare-local-agent.mjs')),guardSha256:digest(path.join(root,'scripts/local-agent-source.mjs')),copySha256:digest(path.join(root,'scripts/copy-file-clone.mjs')),base:lock.commit,patches:[]};
// Agent-detection variables are removed so turbo cannot rewrite the checkout's AGENTS.md.
const run=(command,args,cwd=directory,extra={})=>execFileSync(command,args,{cwd,stdio:'inherit',env:preparedSourceEnv(process.env,{ELIZA_SKIP_FUSED_INFERENCE_SETUP:'1',...extra})});
const stampFile=path.join(directory,'.alpha-runtime-source.json');
if(fs.existsSync(directory)){
 if(!fs.existsSync(stampFile)||fs.readFileSync(stampFile,'utf8')!==JSON.stringify(stamp,null,2)+'\n')throw Error('Prepared runtime differs or preparation was interrupted. Preserve it and choose a fresh artifacts/local-agent-source directory.');
} else {
 fs.mkdirSync(directory,{recursive:true});
 run('git',['init','--quiet']);
 run('git',['fetch','--depth=1',process.env.ALPHA_RUNTIME_GIT_CACHE||lock.url,lock.commit]);
 if(seedCommittedCache(process.env.ALPHA_RUNTIME_GIT_CACHE,directory,lock.commit)){
  // Populate independent metadata without rewriting the authenticated cloned files.
  run('git',['update-ref','--no-deref','HEAD',lock.commit]);
  run('git',['read-tree','HEAD']);
 }else run('git',['checkout','--detach','FETCH_HEAD']);
 verifySource(directory,lock.commit);
 fs.writeFileSync(stampFile,JSON.stringify(stamp,null,2)+'\n');
}
verifySource(directory,lock.commit);
const scriptRunner=process.env.npm_execpath;
const bun=process.env.ALPHA_BUN||(scriptRunner&&/^bun(?:\.exe)?$/.test(path.basename(scriptRunner))?scriptRunner:'bun');
// Postinstall/turbo spawn `bun` by name: keep them on the selected toolchain too.
// A bare command must retain PATH lookup, never add dirname('bun') == '.'.
const installEnv=path.isAbsolute(bun)?{PATH:[path.dirname(bun),process.env.PATH].filter(Boolean).join(path.delimiter)}:{};
if(!process.argv.includes('--source-only'))run(bun,['install','--frozen-lockfile'],directory,installEnv);
verifySource(directory,lock.commit);
console.log(`Prepared local runtime: ${directory}`);
