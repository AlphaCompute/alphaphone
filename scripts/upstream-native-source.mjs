import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
// A batch is bounded by the same 64 MiB subprocess limit as individual reads.
// Decode framing as ASCII only; blob payloads remain byte-exact, including NULs.
export function parseNativeBlobBatch(output, oids) {
 if(!Buffer.isBuffer(output)||output.length>64*1024*1024)throw Error('Invalid native blob batch');
 const result=[];let offset=0;
 for(const oid of oids){
  if(!/^[a-f0-9]{40}$/.test(oid))throw Error('Invalid native blob identity');
  const newline=output.indexOf(10,offset);
  if(newline<0||newline-offset>100)throw Error('Invalid native blob header');
  const headerBytes=output.subarray(offset,newline);
  if(headerBytes.some(byte=>byte>127))throw Error('Invalid native blob header encoding');
  const header=headerBytes.toString('ascii');
  const match=header.match(/^([a-f0-9]{40}) blob (0|[1-9][0-9]*)$/);
  if(!match||match[1]!==oid)throw Error('Unexpected native blob identity or type');
  const size=Number(match[2]);offset=newline+1;
  if(!Number.isSafeInteger(size)||size>64*1024*1024||size>output.length-offset-1||output[offset+size]!==10)throw Error('Invalid native blob size or terminator');
  result.push(output.subarray(offset,offset+size));offset+=size+1;
 }
 if(offset!==output.length)throw Error('Unexpected native blob trailing bytes');
 return result;
}
export function upstreamNativeSource(root) {
 const pin=JSON.parse(fs.readFileSync(path.join(root,'upstream.lock.json'),'utf8')).commit;
 if(!/^[a-f0-9]{40}$/.test(pin))throw Error('Invalid upstream commit');
 const directory=path.join(root,'vendor/eliza');
 const git=args=>execFileSync('git',['-C',directory,...args],{maxBuffer:64*1024*1024});
 if(git(['rev-parse','HEAD']).toString().trim()!==pin)throw Error('Unexpected upstream source pin');
 if(git(['status','--porcelain','--untracked-files=normal']).toString().trim())throw Error('Upstream source checkout is dirty');
 function read(prefix) {
  if(!prefix||prefix.startsWith('/')||prefix.split('/').includes('..'))throw Error('Invalid upstream source path');
  const entries=git(['ls-tree','-r','-z',pin,'--',prefix]).toString().split('\0').filter(Boolean);
  if(!entries.length)throw Error(`Missing upstream source: ${prefix}`);
  const inventory=entries.map(entry=>{
   const match=entry.match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/);
   if(!match)throw Error('Nonregular upstream source');
   return match;
  });
  const oids=inventory.map(match=>match[2]);
  const blobs=parseNativeBlobBatch(execFileSync('git',['-C',directory,'cat-file','--batch'],{input:oids.join('\n')+'\n',maxBuffer:64*1024*1024}),oids);
  const files=new Map();
  for(const [index,match] of inventory.entries()){
   if(!match)throw Error('Nonregular upstream source');
   const [,mode,,name]=match;
   if(name!==prefix&&!name.startsWith(prefix.replace(/\/$/,'')+'/'))throw Error('Unexpected upstream source inventory');
   const filename=path.join(directory,name);
   for(let current=filename;current!==directory;current=path.dirname(current))if(fs.lstatSync(current).isSymbolicLink())throw Error('Symlink in upstream source path');
   const stat=fs.lstatSync(filename),bytes=blobs[index];
   if(!stat.isFile()||(stat.mode&0o111)!==(mode==='100755'?0o111:0)||!fs.readFileSync(filename).equals(bytes))throw Error(`Upstream source drift: ${name}`);
   files.set(name,{bytes,mode,sha256:sha(bytes)});
  }
  return files;
 }
 return {pin,directory,read};
}
export function stageNativePlugin(root,name) {
 const source=upstreamNativeSource(root),prefix=`plugins/plugin-native-${name}/android`;
 const files=source.read(prefix),output=path.join(root,`artifacts/native-${name}`);
 const identity=sha(JSON.stringify({commit:source.pin,files:[...files].map(([name,file])=>[name,file.mode,file.sha256])}));
 for(let current=output;current!==root;current=path.dirname(current))if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('Symlink in native artifact path');
 const marker=path.join(output,'.source-sha256');
 if(!fs.existsSync(marker)||fs.readFileSync(marker,'utf8')!==identity){
  fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output,{recursive:true});
  for(const [name,file] of files){const target=path.join(output,path.relative(prefix,name));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,file.bytes,{mode:parseInt(file.mode,8)});}
  fs.writeFileSync(marker,identity);
 }else{
  const actual=[];
  function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){if(directory===output&&['build','.gradle','.source-sha256'].includes(entry.name))continue;const target=path.join(directory,entry.name);if(entry.isDirectory())walk(target);else if(entry.isFile())actual.push(path.relative(output,target));else throw Error('Nonregular staged native source');}}
  walk(output);
  if(actual.sort().join('\n')!==[...files.keys()].map(name=>path.relative(prefix,name)).sort().join('\n'))throw Error('Unexpected staged native source inventory');
  for(const [name,file] of files){const target=path.join(output,path.relative(prefix,name));if(sha(fs.readFileSync(target))!==file.sha256||(fs.statSync(target).mode&0o111)!==(file.mode==='100755'?0o111:0))throw Error('Staged native source drift');}
 }
 console.log(`Native ${name} staged from ${source.pin} (${files.size} authenticated files)`);
}
