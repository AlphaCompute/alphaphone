import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

// Leave space below Darwin ARG_MAX for the environment and argument pointers.
const CLONE_ARGUMENT_BYTES=64*1024;

/** Same-name files share one directory/bounded-argv native clone attempt.
 * Renamed APKs keep the single-file path. Normal copy is the portable fallback;
 * no hard links or shared file identities are introduced.
 */
export function copyFilesClone(files,{exclusive=false}={}) {
 const flags=exclusive?fs.constants.COPYFILE_EXCL:0;
 if(exclusive)for(const file of files){try{fs.lstatSync(file.destination);throw Object.assign(Error('Clone destination already exists'),{code:'EEXIST'});}catch(error){if(error.code!=='ENOENT')throw error;}}
 function cloneBatch(batch,target){
  if(process.platform==='darwin'){
   try{execFileSync('/bin/cp',['-c',...(exclusive?['-n']:[]),...batch.map(file=>file.source),target],{stdio:'inherit'});return;}
   catch(error){
    // Partial exclusive batches remain evidence; never overwrite their files.
    if(exclusive&&batch.some(file=>fs.existsSync(file.destination)))throw error;
   }
  }
  for(const file of batch)fs.copyFileSync(file.source,file.destination,flags|(process.platform==='darwin'?0:fs.constants.COPYFILE_FICLONE));
 }
 if(process.platform!=='darwin'){cloneBatch(files);return;}
 const directories=new Map();
 for(const file of files){
  if(path.basename(file.source)!==path.basename(file.destination)){cloneBatch([file],file.destination);continue;}
  const directory=path.dirname(file.destination);
  if(!directories.has(directory)){if(!fs.statSync(directory).isDirectory())throw Error('Clone target must be a directory');directories.set(directory,[]);}
  directories.get(directory).push(file);
 }
 for(const [directory,entries] of directories){
  const overhead=['/bin/cp','-c',...(exclusive?['-n']:[]),directory].reduce((sum,arg)=>sum+Buffer.byteLength(arg)+16,0);
  let batch=[],bytes=overhead;
  for(const file of entries){
   const size=Buffer.byteLength(file.source)+16;
   if(batch.length&&bytes+size>CLONE_ARGUMENT_BYTES){cloneBatch(batch,directory);batch=[];bytes=overhead;}
   batch.push(file);bytes+=size;
  }
  if(batch.length)cloneBatch(batch,directory);
 }
}
