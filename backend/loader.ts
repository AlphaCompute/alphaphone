
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createConsumerSourceResolver } from '../vendor/eliza/packages/app/scripts/lib/consumer-source-resolver.mjs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const root=resolve(import.meta.dir,'../vendor/eliza');
const expected=JSON.parse(readFileSync(resolve(import.meta.dir,'../upstream.lock.json'),'utf8'));
const head=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
const pinned=expected.commit===head;
if(!pinned)throw new Error('Vendor source does not match upstream.lock.json');
const {plugin:sourceResolver,resolvedSources}=createConsumerSourceResolver({sourceRoot:root,consumerRoots:[import.meta.dir]});
export async function loadPinnedRuntime() {
const built=await Bun.build({entrypoints:[resolve(import.meta.dir,'runtime.ts')],outdir:resolve(import.meta.dir,'.generated'),target:'bun',plugins:[sourceResolver]});
if(!built.success){for(const log of built.logs)console.error(log);throw new Error('Pinned runtime build failed');}
writeFileSync(resolve(import.meta.dir,'.generated/source-map.json'),JSON.stringify({commit:head,modules:Object.fromEntries([...resolvedSources].sort())},null,2));
const state=process.env.ALPHA_ELIZA_DATA_DIR||resolve(import.meta.dir,'state');mkdirSync(state,{recursive:true,mode:0o700});const saltFile=join(state,'secret-salt');if(!existsSync(saltFile))writeFileSync(saltFile,randomBytes(32).toString('hex'),{mode:0o600,flag:'wx'});process.env.SECRET_SALT=readFileSync(saltFile,'utf8');
return { module: await import('./.generated/runtime.js'), head, dataDir: state };
}
