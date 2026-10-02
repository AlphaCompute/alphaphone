#!/usr/bin/env bun
/** Build the reviewed phone workflow worker's dependency surface. No APK is built. */
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {resolve,join,relative,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {sourceDirectory} from './local-agent-source.mjs';
const root=resolve(import.meta.dir,'..'),source=sourceDirectory(root);
execFileSync(process.env.ALPHA_NODE||'node',[join(root,'scripts/prepare-local-agent.mjs'),'--source-only'],{cwd:root,stdio:'inherit'});
const output=resolve(process.env.ALPHA_WORKFLOW_WORKER_OUTPUT||join(root,'artifacts/mobile-workflow-worker'));
if(!output.startsWith(join(root,'artifacts')+'/')||existsSync(output))throw Error('Choose a fresh worker output directory under artifacts');
mkdirSync(output,{recursive:true});
const staging=mkdtempSync(join(root,'artifacts/workflow-worker-input-'));
const require=createRequire(join(source,'plugins/plugin-workflow/package.json'));
const smthrs=createRequire(require.resolve('smthrs'));
const engine=createRequire(require.resolve('@smthrs/engine/cancel-subtree'));
const reactFacade=(specifier:string)=>{
 const entry=engine.resolve(specifier);
 const names=Object.keys(engine(specifier)).filter(name=>name!=='default'&&/^[A-Za-z_$][\w$]*$/.test(name));
 return `export {${names.join(',')}} from ${JSON.stringify(entry)}; export {default} from ${JSON.stringify(entry)};`;
};
// Compiled phone workflows use named ESM exports. require.resolve selects
// Zod's CommonJS condition, whose export-star facade loses those names.
const zodPackage=require.resolve('zod/package.json');
const zodMetadata=JSON.parse(readFileSync(zodPackage,'utf8'));
const zodEntry=resolve(dirname(zodPackage),zodMetadata.exports['.'].import);
const entries:Record<string,string>={
 'smthrs':`export {runWorkflow,approveNode,denyNode,signalRun} from ${JSON.stringify(require.resolve('smthrs'))};`,
 'create':`export * from ${JSON.stringify(require.resolve('smthrs/create'))};`,
 'store':`export * from ${JSON.stringify(require.resolve('smthrs/openSmithersStore'))};`,
 'jsx-runtime':`export * from ${JSON.stringify(require.resolve('smthrs/jsx-runtime'))};`,
 'cancel-subtree':`export * from ${JSON.stringify(require.resolve('@smthrs/engine/cancel-subtree'))};`,
 'effect':`export * from ${JSON.stringify(smthrs.resolve('effect'))};`,
 'zod':`export * from ${JSON.stringify(zodEntry)};`,
 'react':reactFacade('react'),
 'react-jsx-runtime':reactFacade('react/jsx-runtime'),
 'react-jsx-dev-runtime':reactFacade('react/jsx-dev-runtime'),
 'components':`export * from ${JSON.stringify(engine.resolve('@smthrs/components'))};`,
 'graph':`export * from ${JSON.stringify(engine.resolve('@smthrs/graph'))};`,
 'scheduler':`export * from ${JSON.stringify(engine.resolve('@smthrs/scheduler'))};`,
 'drizzle-bun-sqlite':`export {drizzle} from ${JSON.stringify(engine.resolve('drizzle-orm/bun-sqlite'))};`,
};
for(const [name,body]of Object.entries(entries))writeFileSync(join(staging,name+'.ts'),body);
const result=await Bun.build({entrypoints:Object.keys(entries).map(name=>join(staging,name+'.ts')),outdir:join(output,'lib'),target:'bun',format:'esm',splitting:true,naming:{entry:'[name].js',chunk:'chunk-[hash].js'},minify:false,metafile:true});
if(!result.success){for(const log of result.logs)console.error(log);throw Error('Worker dependency bundle failed; incomplete output is retained for diagnosis');}
function pkg(name:string,exports:Record<string,string>,hasDefault=false){const directory=join(output,'node_modules',name);mkdirSync(directory,{recursive:true});const mapped=Object.fromEntries(Object.entries(exports).map(([key,file])=>[key,'./'+file]));writeFileSync(join(directory,'package.json'),JSON.stringify({name,type:'module',exports:{...mapped,'./package.json':'./package.json'}},null,2));for(const file of new Set(Object.values(exports))){const target=relative(directory,join(output,'lib',file)).replaceAll('\\','/');const specifier=JSON.stringify(target.startsWith('.')?target:'./'+target);writeFileSync(join(directory,file),`export * from ${specifier};\n${hasDefault?`export {default} from ${specifier};\n`:''}`);}}
pkg('smthrs',{'.':'smthrs.js','./create':'create.js','./openSmithersStore':'store.js','./jsx-runtime':'jsx-runtime.js','./jsx-dev-runtime':'jsx-runtime.js'});
pkg('@smthrs/engine',{'./cancel-subtree':'cancel-subtree.js'});pkg('effect',{'.':'effect.js'});pkg('zod',{'.':'zod.js'});
pkg('react',{'.':'react.js','./jsx-runtime':'react-jsx-runtime.js','./jsx-dev-runtime':'react-jsx-dev-runtime.js'},true);
pkg('@smthrs/components',{'.':'components.js'});
pkg('@smthrs/graph',{'.':'graph.js'});
pkg('@smthrs/scheduler',{'.':'scheduler.js'});
pkg('drizzle-orm',{'./bun-sqlite':'drizzle-bun-sqlite.js'});
const hash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
// Retain the actual bundled dependency provenance and available license notices.
// The artifact is not a complete general-purpose Smithers distribution.
const meta=typeof result.metafile==='string'?JSON.parse(result.metafile):result.metafile;
if(!meta?.inputs)throw Error('Missing bundle input provenance');
const packages=new Map<string,unknown>();
for(const input of Object.keys(meta.inputs)){
 let directory=dirname(resolve(root,input));
 while(directory.startsWith(source+'/')){
  const manifest=join(directory,'package.json');
  if(existsSync(manifest)){
   if(packages.has(directory))break;
   const data=JSON.parse(readFileSync(manifest,'utf8'));
   if(typeof data.name!=='string'||typeof data.version!=='string'){directory=dirname(directory);continue;}
   const id=createHash('sha256').update(relative(source,directory)).digest('hex').slice(0,16);
   const notices:string[]=[];
   for(const name of readdirSync(directory).filter(name=>/^(license|licence|copying|notice)([._-]|$)/i.test(name))){
    const file=join(directory,name);if(!statSync(file).isFile())continue;
    const destination=join('licenses',id,name);mkdirSync(dirname(join(output,destination)),{recursive:true});
    writeFileSync(join(output,destination),readFileSync(file));notices.push(destination);
   }
   packages.set(directory,{name:data.name,version:data.version,license:data.license??null,sourcePath:relative(source,directory),packageSha256:hash(manifest),notices});break;
  }
  directory=dirname(directory);
 }
}
writeFileSync(join(output,'dependencies.json'),JSON.stringify([...packages.values()],null,2)+'\n');
const files:Record<string,string>={};function inventory(dir:string){for(const name of readdirSync(dir)){const p=join(dir,name);if(statSync(p).isDirectory())inventory(p);else files[relative(output,p)]=hash(p);}}inventory(output);
writeFileSync(join(output,'manifest.json'),JSON.stringify({version:1,purpose:'Reviewed phone workflow worker dependencies; not a general smthrs distribution',sourceStampSha256:hash(join(source,'.alpha-runtime-source.json')),lockSha256:hash(join(source,'bun.lock')),files},null,2)+'\n');
console.log(`Worker dependency artifact: ${output}`);
