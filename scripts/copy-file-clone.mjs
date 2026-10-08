import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

/** One clone attempt per file; normal copy is the portable fallback.
 * Node's reflink hint is ENOSYS on the pinned Darwin runtime, so use the
 * existing APFS copy behavior there. No hard links or shared file identities.
 */
export function copyFileClone(source,destination,{exclusive=false}={}) {
 const flags=exclusive?fs.constants.COPYFILE_EXCL:0;
 if(process.platform==='darwin'){
  if(exclusive){try{fs.lstatSync(destination);throw Object.assign(Error('Clone destination already exists'),{code:'EEXIST'});}catch(error){if(error.code!=='ENOENT')throw error;}}
  try{execFileSync('/bin/cp',['-c',...(exclusive?['-n']:[]),source,destination],{stdio:'inherit'});}
  catch(error){
   // A partial exclusive clone must remain evidence of interrupted preparation.
   if(exclusive&&fs.existsSync(destination))throw error;
   fs.copyFileSync(source,destination,flags);
  }
 }else fs.copyFileSync(source,destination,flags|fs.constants.COPYFILE_FICLONE);
}
