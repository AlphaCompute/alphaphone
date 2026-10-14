import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {verifyPinnedUpstream} from './pinned-upstream-source.mjs';
const root=path.resolve(import.meta.dirname,'..');
verifyPinnedUpstream(root);
const source=path.join(root,'vendor/eliza');
const {selectHostAsrAssets,QWEN3_ASR_ASSETS}=await import(pathToFileURL(path.join(source,'plugins/plugin-local-inference/src/host-asr-assets.ts')));
let asrRoot=process.env.ALPHA_ASR_MODEL_DIR;
if(!asrRoot){
 const cache=path.join(os.homedir(),'.cache/eliza/android-smoke-models/aux');
 asrRoot=path.join(root,'.eliza/native-asr-inputs/qwen3-pinned');
 for(const item of QWEN3_ASR_ASSETS){const input=path.join(cache,item.path);if(fs.statSync(input).size!==item.bytes||await hash(input)!==item.sha256)throw Error(`Cached ASR input differs: ${item.path}`);const target=path.join(asrRoot,item.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(input,target,fs.constants.COPYFILE_FICLONE);}
}
asrRoot=path.resolve(asrRoot);
const selected=selectHostAsrAssets(asrRoot);
async function hash(file){const h=createHash('sha256');for await(const bytes of fs.createReadStream(file))h.update(bytes);return h.digest('hex');}
for(const item of selected.assets){const file=path.join(asrRoot,item.path);if(fs.statSync(file).size!==item.bytes||await hash(file)!==item.sha256)throw Error(`ASR asset differs from upstream pin: ${item.path}`);}
const output=path.join(root,'artifacts/native-voice');
execFileSync(process.execPath,[path.join(source,'packages/app/scripts/paradee-voice/build-native.ts'),'--workspace',path.join(root,'.eliza/native-voice-build'),'--out',output],{stdio:'inherit'});
const bundle=path.join(output,'assets/paradee-voice/v1');
const manifestPath=path.join(bundle,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath));
for(const item of selected.assets){const target=path.join(bundle,item.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(asrRoot,item.path),target,fs.constants.COPYFILE_FICLONE);if(await hash(target)!==item.sha256)throw Error('Staged ASR asset changed');manifest.files.push(item);}
const noticeFiles=selected.backend==='parakeet'
 ? ['native-speech/phonon-2-NOTICE','native-speech/phonon-2-LICENSE-WEIGHTS-CC-BY-4.0.txt']
 : ['Apache-2.0.txt'];
const addedNotices=[];
for(const name of noticeFiles){
 const relative='notices/asr/'+path.basename(name),target=path.join(bundle,relative);
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,'licenses',name),target);
 const item={path:relative,bytes:fs.statSync(target).size,sha256:await hash(target)};
 manifest.files.push(item);addedNotices.push(item);
}
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const recordPath=path.join(output,'build-record.json'),record=JSON.parse(fs.readFileSync(recordPath));
record.sourceCommit=JSON.parse(fs.readFileSync(path.join(root,'upstream.lock.json'))).commit;
record.asrBackend=selected.backend;
for(const item of [...selected.assets,...addedNotices,{path:'manifest.json'}]){
 const relative='assets/paradee-voice/v1/'+item.path,file=path.join(output,relative);
 record.files=record.files.filter(row=>row.path!==relative);
 record.files.push({path:relative,bytes:fs.statSync(file).size,sha256:await hash(file)});
}
fs.writeFileSync(recordPath,JSON.stringify(record,null,2)+'\n');
console.log('Native voice build and pinned model staging complete; device qualification remains separate.');
