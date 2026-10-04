import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const blobHash = bytes => createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
const present=file=>{try{fs.lstatSync(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
export const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function admittedCommit(root) {
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'upstream/runtime-source.json'),'utf8'));
 if(!/^[a-f0-9]{40}$/.test(manifest.baseCommit))throw Error('Exact admitted runtime commit required for default artifact selection');
 return manifest.baseCommit;
}
// Stable defaults derive from the admitted commit; old physical trees are never relabeled.
export function workerArtifactDirectory(root, env=process.env) {
 const supplied=env.ALPHA_WORKFLOW_WORKER_OUTPUT;
 const directory=supplied?path.resolve(root,supplied):path.join(root,'artifacts',`mobile-workflow-worker-${admittedCommit(root)}`);
 const output=sourceDirectory(root,{ALPHA_LOCAL_AGENT_SOURCE_DIR:directory});
 assertWorkerOutputSeparation(sourceDirectory(root,env),output);
 return output;
}
// Reject before importing/invoking any producer, including historical admitted roots.
export function assertWorkerOutputSeparation(source,output) {
 const relative=path.relative(source,output);
 if(!relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw Error('Worker output must not be inside active prepared source');
 for(let current=output;;current=path.dirname(current)){
  if(present(path.join(current,'.alpha-runtime-source.json')))throw Error('Worker output must not be inside a prepared source tree');
  if(current===path.dirname(current))break;
 }
}
export function sourceDirectory(root, env=process.env) {
 const supplied=env.ALPHA_LOCAL_AGENT_SOURCE_DIR;
 if(supplied&&!path.isAbsolute(supplied))throw Error('ALPHA_LOCAL_AGENT_SOURCE_DIR must be absolute');
 const directory=supplied||path.join(root,'artifacts',`local-agent-resident-${admittedCommit(root)}`);
 const relative=path.relative(path.join(root,'artifacts'),directory);
 if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Prepared runtime must be a child of product artifacts');
 for(let current=directory;current!==path.dirname(current);current=path.dirname(current)){
  let stat;try{stat=fs.lstatSync(current);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(stat?.isSymbolicLink())throw Error('Prepared runtime path must not contain symlinks');
 }
 return directory;
}
export function verifySource(directory, manifest, extra) {
 const git=(args)=>execFileSync('git',args,{cwd:directory,encoding:'utf8',maxBuffer:64*1024*1024});
 if(git(['rev-parse','HEAD']).trim()!==manifest.baseCommit)throw Error('Prepared runtime base commit changed');
 const expected={...manifest.candidateFiles,...extra.files};
 const deleted=new Set(manifest.deletedFiles||[]);
 for(const file of deleted)if(present(path.join(directory,file)))throw Error(`Deleted runtime source reintroduced: ${file}`);
 for(const [file,hash]of Object.entries(expected)){
  const absolute=path.join(directory,file);
  if(!fs.existsSync(absolute)||fs.lstatSync(absolute).isSymbolicLink()||digest(absolute)!==hash)throw Error(`Prepared source changed: ${file}`);
 }
 for(const [file,mode] of Object.entries(manifest.candidateModes||{}))if((fs.statSync(path.join(directory,file)).mode & 0o111)!==(mode==='100755'?0o111:0))throw Error(`Runtime source mode changed: ${file}`);
 // Unchanged base files are also authenticated, including ignored tracked files.
 const entries=git(['ls-tree','-r','-z','HEAD']).split('\0').filter(Boolean);
 for(const entry of entries){const [meta,file]=entry.split('\t');if(Object.hasOwn(expected,file)||deleted.has(file))continue;
  const [mode,type,oid]=meta.split(' ');if(type==='commit')continue;
  const absolute=path.join(directory,file);
  if(mode==='120000') {if(!fs.existsSync(absolute)||!fs.lstatSync(absolute).isSymbolicLink()||blobHash(Buffer.from(fs.readlinkSync(absolute)))!==oid)throw Error(`Unsupported baseline symlink: ${file}`);continue;}
  if(!fs.existsSync(absolute)||fs.lstatSync(absolute).isSymbolicLink()||(fs.statSync(absolute).mode & 0o111)!==(mode==='100755'?0o111:0)||blobHash(fs.readFileSync(absolute))!==oid)throw Error(`Unexpected runtime source change: ${file}`);
 }
 for(const file of git(['diff','--name-only','HEAD']).trim().split('\n').filter(Boolean))if(!Object.hasOwn(expected,file)&&!deleted.has(file))throw Error(`Unexpected runtime source change: ${file}`);
 const packageFiles=new Set([...entries.map(entry=>entry.split('\t')[1]),...Object.keys(expected)]);
 const rootPackage=JSON.parse(fs.readFileSync(path.join(directory,'package.json'),'utf8'));
 const turbo=JSON.parse(fs.readFileSync(path.join(directory,'turbo.json'),'utf8'));
 const workspacePatterns=Array.isArray(rootPackage.workspaces)?rootPackage.workspaces:rootPackage.workspaces.packages;
 const workspaceRoots=[...packageFiles].filter(file=>file.endsWith('/package.json')).map(file=>file.slice(0,-'/package.json'.length)).filter(dir=>workspacePatterns.some(pattern=>path.matchesGlob(dir,pattern)));
 const generatedRoots=['node_modules/','.turbo/cache/','packages/agent/dist-mobile/'];
 const generatedLogs=new Set();
 for(const workspace of workspaceRoots){
  generatedRoots.push(workspace+'/node_modules/');
  const pkg=JSON.parse(fs.readFileSync(path.join(directory,workspace,'package.json'),'utf8'));
  for(const [task,definition]of Object.entries(turbo.tasks)){
   if(task.includes('#')&&!task.startsWith(pkg.name+'#'))continue;
   for(const output of definition.outputs||[]){
    // Only literal, workspace-relative directory declarations; never wildcard ancestors.
    if(!/^(?:[a-zA-Z0-9_.-]+\/)+\*\*$/.test(output)||output.split('/').includes('..'))continue;
    generatedRoots.push(workspace+'/'+output.slice(0,-2));
   }
   const name=task.includes('#')?task.split('#')[1]:task;
   if(/^[a-zA-Z0-9:_-]+$/.test(name))generatedLogs.add(workspace+'/.turbo/turbo-'+name.replaceAll(':','$colon$')+'.log');
  }
 }
 const allowedGenerated=file=>file==='.alpha-runtime-source.json'||file==='.alpha-stage-runtime.ts'||generatedLogs.has(file)||generatedRoots.some(prefix=>file.startsWith(prefix));
 // Include ignored files: .gitignore must not hide unexpected source additions.
 for(const file of git(['ls-files','--others','-z']).split('\0').filter(Boolean))if(!Object.hasOwn(expected,file)&&!allowedGenerated(file))throw Error(`Unexpected untracked runtime source: ${file}`);
}
