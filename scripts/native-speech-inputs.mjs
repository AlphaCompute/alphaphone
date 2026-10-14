import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const NATIVE_VOICE_RECORD='artifacts/native-voice/build-record.json';
export const NATIVE_VOICE_QUALIFICATION='android/local-speech/native-qualification.json';
export function fileDigest(file){const h=createHash('sha256'),buffer=Buffer.alloc(65536),fd=fs.openSync(file,'r');try{let n;while((n=fs.readSync(fd,buffer,0,buffer.length,null)))h.update(buffer.subarray(0,n));return h.digest('hex');}finally{fs.closeSync(fd);}}
/** Build evidence only. Functional and release qualification are separate records. */
export function nativeSpeechInputs(root){
 const problems=[];let record;
 try{
  const pin=JSON.parse(fs.readFileSync(path.join(root,'upstream.lock.json'))).commit;
  record=JSON.parse(fs.readFileSync(path.join(root,NATIVE_VOICE_RECORD)));
  if(record.sourceCommit!==pin)throw Error('Native voice build uses another Eliza revision');
  if(!Array.isArray(record.abis)||!['arm64-v8a','x86_64'].every(abi=>record.abis.includes(abi)))throw Error('Native voice build must contain both shipped ABIs');
  if(!Array.isArray(record.files)||!record.files.length)throw Error('Native voice build inventory is empty');
  const names=new Set();
  for(const row of record.files){
   if(typeof row.path!=='string'||row.path.includes('\\')||row.path.split('/').some(part=>!part||part==='.'||part==='..')||names.has(row.path)||!/^[a-f0-9]{64}$/.test(row.sha256))throw Error('Invalid native voice inventory');
   names.add(row.path);const file=path.join(root,'artifacts/native-voice',row.path);
   for(let current=file;current!==root;current=path.dirname(current))if(fs.lstatSync(current).isSymbolicLink())throw Error('Native voice input is a symlink');
   if(!fs.statSync(file).isFile()||fs.statSync(file).size!==row.bytes||fileDigest(file)!==row.sha256)throw Error('Native voice input differs: '+row.path);
  }
  if(!names.has('assets/paradee-voice/v1/manifest.json')||![...names].some(name=>name.startsWith('assets/paradee-voice/v1/asr/')))throw Error('Native voice bundle has no ASR model');
  for(const abi of ['arm64-v8a','x86_64'])if(!names.has(`jniLibs/${abi}/libelizainference.so`))throw Error('Native voice library missing: '+abi);
 }catch(error){problems.push(error.code==='ENOENT'?'Native voice build inputs are missing':error.message);}
 return {ready:problems.length===0,problems,record};
}
