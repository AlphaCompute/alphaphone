import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const PARADEE_SOURCE='vendor/eliza/packages/app/platforms/android/paradee-voice';
export const PARADEE_NATIVE='.eliza/paradee-voice/native';
export const usesParadee=root=>fs.existsSync(path.join(root,PARADEE_SOURCE,'consumer.gradle'));
const digest=value=>createHash('sha256').update(value).digest('hex');
function checkedFile(root,entry){
 if(!entry||typeof entry.path!=='string'||!entry.path||path.isAbsolute(entry.path)||entry.path.split(/[\\/]/).some(part=>!part||part==='.'||part==='..')||!Number.isSafeInteger(entry.bytes)||entry.bytes<=0||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('Invalid Paradee build record entry');
 const file=path.join(root,entry.path);let cursor=root;
 for(const part of entry.path.split('/')){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())throw Error('Paradee input must not traverse a symbolic link');}
 if(!fs.statSync(file).isFile()||fs.statSync(file).size!==entry.bytes||digest(fs.readFileSync(file))!==entry.sha256)throw Error('Paradee input changed: '+entry.path);
 return file;
}
/** Gradle compiles JNI against this exact nested source even when engine binaries are staged. */
export function verifyParadeeFfi(root){
 const vendor=path.join(root,'vendor/eliza'),relative='plugins/plugin-local-inference/native/llama.cpp',fork=path.join(vendor,relative),header='tools/omnivoice/include/eliza-inference-ffi.h';
 const guidance='Initialize the pinned FFI source: git -C vendor/eliza submodule update --init plugins/plugin-local-inference/native/llama.cpp';
 const git=(directory,...args)=>execFileSync('git',['-C',directory,...args],{stdio:['ignore','pipe','pipe'],maxBuffer:4*1024*1024});
 try{
  const pin=JSON.parse(fs.readFileSync(path.join(root,'upstream.lock.json'),'utf8')).commit;
  if(!/^[a-f0-9]{40}$/.test(pin)||git(vendor,'rev-parse','HEAD').toString().trim()!==pin)throw Error('Unexpected parent source pin');
  const expected=git(vendor,'ls-tree',pin,'--',relative).toString().match(/^160000 commit ([a-f0-9]{40})\t/)?.[1];
  if(!expected)throw Error('Missing pinned FFI gitlink');
  let cursor=vendor;for(const part of relative.split('/')){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())throw Error('Linked FFI checkout');}
  if(git(fork,'rev-parse','HEAD').toString().trim()!==expected||git(fork,'status','--porcelain','--untracked-files=normal').length)throw Error('FFI checkout must be clean at its exact pin');
  const bytes=git(fork,'show',expected+':'+header);cursor=fork;
  for(const part of header.split('/')){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())throw Error('Linked FFI header');}
  if(!fs.statSync(cursor).isFile()||!fs.readFileSync(cursor).equals(bytes))throw Error('FFI header changed');
  return {forkPin:expected,headerSha256:digest(bytes)};
 }catch(error){throw Error('Paradee FFI source unavailable or changed. '+guidance,{cause:error});}
}
/** Integrity only. This never establishes functional, device or release qualification. */
export function verifyParadeeRuntime(root,{allowAbsent=false}={}){
 const native=path.join(root,PARADEE_NATIVE);
 if(allowAbsent&&!fs.existsSync(native))return {packaged:false,qualified:false};
 if(!fs.existsSync(path.join(native,'build-record.json')))throw Error('Paradee native build record is missing. Build pinned paradee-voice outputs outside vendor, then stage a reviewed ASR model pair.');
 if(fs.lstatSync(native).isSymbolicLink())throw Error('Paradee native output must not be a symbolic link');
 verifyParadeeFfi(root);
 const record=JSON.parse(fs.readFileSync(path.join(native,'build-record.json'),'utf8'));
 const inputs=JSON.parse(fs.readFileSync(path.join(root,PARADEE_SOURCE,'inputs.json'),'utf8'));
 if(JSON.stringify(record.inputs)!==JSON.stringify(inputs))throw Error('Paradee inputs do not match the pinned upstream source');
 if(!Array.isArray(record.abis)||!['arm64-v8a','x86_64'].every(abi=>record.abis.includes(abi)))throw Error('Paradee requires both Android ABIs');
 if(!Array.isArray(record.files)||!record.files.length||new Set(record.files.map(row=>row.path)).size!==record.files.length)throw Error('Paradee build record is incomplete');
 for(const entry of record.files)checkedFile(native,entry);
 const names=new Set(record.files.map(row=>row.path)),bundle='assets/paradee-voice/v1/';
 const walk=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name),relative=path.relative(native,file);if(entry.isSymbolicLink())throw Error('Paradee output contains a symbolic link');if(entry.isDirectory())walk(file);else if(!entry.isFile()||(relative!=='build-record.json'&&!names.has(relative)))throw Error('Unrecorded Paradee output: '+relative);}};walk(native);
 for(const name of ['arm64-v8a','x86_64'].map(abi=>`jniLibs/${abi}/libelizainference.so`).concat(bundle+'manifest.json'))if(!names.has(name))throw Error('Paradee build record missing '+name);
 const manifest=JSON.parse(fs.readFileSync(path.join(native,bundle,'manifest.json'),'utf8'));
 if(manifest.format!=='eliza-paradee-voice-v1'||manifest.model!==inputs.paradee.path||manifest.lexicon!==inputs.lexicon.path||!Array.isArray(manifest.files))throw Error('Paradee voice manifest changed');
 for(const entry of manifest.files){checkedFile(path.join(native,bundle),entry);const recorded=record.files.find(row=>row.path===bundle+entry.path);if(!recorded||recorded.sha256!==entry.sha256||recorded.bytes!==entry.bytes)throw Error('Voice manifest differs from build record');}
 for(const pin of [inputs.paradee,inputs.lexicon]){const entry=manifest.files.find(row=>row.path===pin.path);if(!entry||entry.sha256!==pin.sha256||entry.bytes!==pin.bytes)throw Error('Pinned speech model or lexicon changed');}
 // The upstream builder currently produces TTS only. Never call that complete local speech.
 const asrPin=path.join(root,'android/paradee-voice/asr-inputs.json');
 if(!fs.existsSync(asrPin))throw Error('Reviewed ASR model/projector pins are missing; TTS-only output is not complete local speech.');
 const asr=JSON.parse(fs.readFileSync(asrPin,'utf8'));
 if(!Array.isArray(asr.files)||asr.files.length!==2||new Set(asr.files.map(row=>row.path)).size!==2)throw Error('ASR model/projector pins are incomplete');
 for(const pin of asr.files){if(!pin.path?.startsWith('asr/')||!pin.path.endsWith('.gguf'))throw Error('Invalid ASR pin');checkedFile(path.join(native,bundle),pin);const entry=manifest.files.find(row=>row.path===pin.path);if(!entry||entry.sha256!==pin.sha256||entry.bytes!==pin.bytes)throw Error('Reviewed ASR model/projector changed');}
 return {packaged:true,qualified:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);if(args.some(arg=>arg!=='--allow-absent'))throw Error('Unknown Paradee verification option');
 console.log(JSON.stringify(verifyParadeeRuntime(path.resolve(import.meta.dirname,'..'),{allowAbsent:args.includes('--allow-absent')})));
}
