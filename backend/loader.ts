
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { builtinModules } from 'node:module';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const root=resolve(import.meta.dir,'../vendor/eliza');
const expected=JSON.parse(readFileSync(resolve(import.meta.dir,'../upstream.lock.json'),'utf8'));
const head=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
const pinned=expected.commit===head;
if(!pinned)throw new Error('Vendor source does not match upstream.lock.json');
const registry=new Map<string,{dir:string;manifest:any}>();
for(const group of ['packages','plugins'])for(const entry of readdirSync(join(root,group),{withFileTypes:true})){
 if(!entry.isDirectory())continue;const dir=join(root,group,entry.name),file=join(dir,'package.json');if(!existsSync(file))continue;
 const manifest=JSON.parse(readFileSync(file,'utf8'));if(manifest.name)registry.set(manifest.name,{dir,manifest});
}
function sourceExport(value:any):string|null {
 if(typeof value==='string')return value;
 if(!value||typeof value!=='object')return null;
 for(const key of ['eliza-source','bun','import','default'])if(value[key]){const found=sourceExport(value[key]);if(found)return found;}
 return null;
}
const resolvedSources=new Map<string,string>();
const sourceResolver={name:'alpha-pinned-eliza-source',setup(build:any){
 build.onResolve({filter:/^@elizaos\//},args=>{
  const bits=args.path.split('/'),name=bits.slice(0,2).join('/'),sub=bits.length===2?'.':'./'+bits.slice(2).join('/');
  const pkg=registry.get(name);if(!pkg)throw new Error('Unknown pinned package '+name);
  if(Object.hasOwn(pkg.manifest.exports||{},sub)&&pkg.manifest.exports[sub]===null)throw new Error('Private source export '+args.path);
  let target=sourceExport(pkg.manifest.exports?.[sub]);
  if(!target)for(const [key,value] of Object.entries(pkg.manifest.exports||{})){
   if(!key.includes('*'))continue;const [start,end]=key.split('*');if(sub.startsWith(start)&&sub.endsWith(end)){
    const match=sub.slice(start.length,sub.length-end.length||undefined),template=sourceExport(value);if(template){target=template.replaceAll('*',match);break;}
   }
  }
  if(!target)throw new Error('No permitted pinned source export '+args.path);
  const path=resolve(pkg.dir,target);if(!path.startsWith(root+'/')||path.includes('/dist/'))throw new Error('Source-only resolver rejected '+args.path);
  resolvedSources.set(args.path,path.slice(root.length+1));
  return {path};
 });
 build.onResolve({filter:/^[^./]/},args=>{
  if(args.path.startsWith('@elizaos/')||args.path.includes(':')||builtinModules.includes(args.path))return;
  if(args.importer.startsWith(root)||args.importer.startsWith(import.meta.dir))return {path:args.path,external:true};
 });
}};
export async function loadPinnedRuntime() {
const built=await Bun.build({entrypoints:[resolve(import.meta.dir,'runtime.ts')],outdir:resolve(import.meta.dir,'.generated'),target:'bun',plugins:[sourceResolver]});
if(!built.success){for(const log of built.logs)console.error(log);throw new Error('Pinned runtime build failed');}
writeFileSync(resolve(import.meta.dir,'.generated/source-map.json'),JSON.stringify({commit:head,modules:Object.fromEntries([...resolvedSources].sort())},null,2));
const state=process.env.ALPHA_ELIZA_DATA_DIR||resolve(import.meta.dir,'state');mkdirSync(state,{recursive:true,mode:0o700});const saltFile=join(state,'secret-salt');if(!existsSync(saltFile))writeFileSync(saltFile,randomBytes(32).toString('hex'),{mode:0o600,flag:'wx'});process.env.SECRET_SALT=readFileSync(saltFile,'utf8');
return { module: await import('./.generated/runtime.js'), head, dataDir: state };
}
