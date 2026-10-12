import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const sha=value=>createHash('sha256').update(value).digest('hex');
const hash=file=>sha(fs.readFileSync(file));
const names=['libelizainference.so','libelizavoicejni.so','libc++_shared.so'];
const model={path:'android/app/src/main/assets/agent/models/bge-small-en-v1.5-f16.gguf',sha256:'f0b2fef971e8366438bfd2d9aefea1b0115919389448806d290237f638bae999',dimensions:384};
const forkPath='plugins/plugin-local-inference/native/llama.cpp';
const inputPaths=['packages/app/scripts/stage-elizavoice-lib.ts','packages/app/scripts/build-helpers/arm64-simd.ts','packages/app/scripts/build-helpers/verify-fused-symbols.ts','packages/app/platforms/android/app/src/main/elizavoice-jni/CMakeLists.txt','packages/app/platforms/android/app/src/main/elizavoice-jni/elizavoice-jni.cpp'];
const isCommit=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value)&&value!=='0'.repeat(40);
/** A new runtime pin may reuse reviewed binaries only when every native build input is exact. */
export function verifyEmbeddingInputs(productRoot,qualification) {
 const pin=JSON.parse(fs.readFileSync(path.join(productRoot,'upstream.lock.json'),'utf8')).commit;
 const identity=JSON.parse(fs.readFileSync(path.join(productRoot,'app.config.json'),'utf8')).appId;
 if(!isCommit(pin)||!isCommit(qualification.pin)||!isCommit(qualification.forkPin)||qualification.identity!==identity||qualification.abi!=='arm64-v8a')throw Error('Embedding host source or identity admission changed');
 const inputs=qualification.inputs;
 if(!Array.isArray(inputs)||inputs.length!==inputPaths.length||new Set(inputs.map(row=>row?.path)).size!==inputPaths.length||inputs.some(row=>!inputPaths.includes(row?.path)||!/^[a-f0-9]{64}$/.test(row.sourceSha256)||!/^[a-f0-9]{64}$/.test(row.generatedSha256)))throw Error('Embedding host build input qualification missing or changed');
 const vendor=path.join(productRoot,'vendor/eliza');
 const git=(...args)=>execFileSync('git',['-C',vendor,...args],{maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']});
 try {
  if(git('rev-parse','HEAD').toString().trim()!==pin)throw Error('Locked vendor pin is not checked out');
  git('diff','--quiet','HEAD','--',...inputPaths,forkPath);
  const fork=git('ls-tree',pin,forkPath).toString().match(/^160000 commit ([a-f0-9]{40})\t/)?.[1];
  if(fork!==qualification.forkPin)throw Error('Native engine gitlink changed');
  for(const row of inputs){
   const source=git('show',pin+':'+row.path);
   const generated=row.path.endsWith('.cpp')?source.toString('utf8').replaceAll('Java_ai_elizaos_app_','Java_'+identity.replaceAll('.','_')+'_').replaceAll('ai/elizaos/app/',identity.replaceAll('.','/')+'/'):source;
   if(sha(source)!==row.sourceSha256||sha(generated)!==row.generatedSha256)throw Error('Native build input changed: '+row.path);
  }
 } catch(error){throw Error('Embedding host source admission changed: '+error.message,{cause:error});}
}
/** Build admission reads exact staged bytes; it never downloads or repairs a missing artifact. */
export function verifyEmbeddingHost(productRoot,{allowAbsentRuntime=false}={}) {
 // The explicit unpackaged developer build has no agent to use this host. Never
 // admit a partial resident payload or a partially staged native host this way.
 if(allowAbsentRuntime){
  const runtime=['alpha-source.json','agent-bundle.js','workflow-worker/manifest.json'];
  // x86_64 engine bytes admitted by the voice host (debug/emulator only) are not resident payload.
  const voiceOwned=file=>{try{const row=readVoiceHost(productRoot).abis.find(entry=>entry.abi==='x86_64');const library=row?.voiceSymbolsVerified&&row.libraries.find(item=>file.endsWith('/x86_64/'+item.name));return Boolean(library)&&hash(path.join(productRoot,file))===library.sha256;}catch{return false;}};
  const native=names.flatMap(name=>['arm64-v8a','x86_64'].map(abi=>'android/app/src/main/jniLibs/'+abi+'/'+name));
  const files=[...runtime.map(name=>'android/app/src/main/assets/agent/'+name),...native.filter(file=>!(fs.existsSync(path.join(productRoot,file))&&voiceOwned(file)))];
  if(files.every(file=>!fs.existsSync(path.join(productRoot,file))))return {status:'not-packaged',distributable:false};
 }

 const manifest=JSON.parse(fs.readFileSync(path.join(productRoot,'android/embedding-host/qualified-host.json'),'utf8'));
 if(!/^[a-f0-9]{64}$/.test(manifest.qualificationReceiptSha256)||manifest.jniIdentityRelocated!==true)throw Error('Embedding host qualification missing or changed');
 verifyEmbeddingInputs(productRoot,manifest);
 if(manifest.model?.sha256!==model.sha256||manifest.model?.path!==model.path||manifest.model?.dimensions!==384)throw Error('Embedding host model admission changed');
 if(!Array.isArray(manifest.libraries)||manifest.libraries.length!==names.length||new Set(manifest.libraries.map(row=>row.name)).size!==names.length)throw Error('Incomplete embedding host library set');
 for(const row of manifest.libraries){
  if(!names.includes(row.name)||!/^[a-f0-9]{64}$/.test(row.sha256)||!Number.isSafeInteger(row.bytes)||row.bytes<=0||row.alignment16KiB!==true)throw Error('Invalid qualified embedding library');
  const file=path.join(productRoot,'android/app/src/main/jniLibs',manifest.abi,row.name);
  if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size!==row.bytes||hash(file)!==row.sha256)throw Error('Qualified embedding host library missing or changed: '+row.name);
 }
 const file=path.join(productRoot,model.path);
 if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink()||hash(file)!==model.sha256)throw Error('Pinned BGE384 model missing or changed');
 return manifest;
}

// ── On-device voice host (fused libelizainference ASR, Kokoro TTS and Silero VAD) ─────────────
// The voice host reuses the embedding host's native pair; android/voice-host/qualified-voice-host.json
// records which ABIs were checked for the voice symbols and which model bytes may be packaged.
export const VOICE_HOST_MANIFEST='android/voice-host/qualified-voice-host.json';
export const VOICE_ASSET_ROOT='android/app/src/main/assets/voice/v1';
export const VOICE_BUNDLE_FORMAT='alpha-voice-bundle-v1';
export const VOICE_ABI_VERSION_MIN=16;
export const VOICE_ROLES=['asr-model','asr-mmproj','tts-model','tts-voice','vad-model','lexicon'];
/** Roles a packaged bundle must carry. ASR is optional until a qualified pair exists, but only as a pair. */
export const VOICE_REQUIRED_ROLES=['tts-model','tts-voice','vad-model','lexicon'];
export const VOICE_FUSED_SYMBOLS=['eliza_inference_abi_version','eliza_inference_create','eliza_inference_destroy','eliza_inference_mmap_acquire','eliza_inference_asr_transcribe','eliza_inference_kokoro_load','eliza_inference_kokoro_synthesize_ipa_alloc','eliza_inference_kokoro_sample_rate','eliza_inference_free_pcm','eliza_inference_vad_supported','eliza_inference_vad_open','eliza_inference_vad_process','eliza_inference_vad_reset','eliza_inference_vad_close'];
export const VOICE_JNI_METHODS=['nativeContextCreateUtf8','nativeContextDestroy','nativeVoiceAbiVersion','nativeAsrTranscribe','nativeKokoroSynthesizeIpa','nativeKokoroSampleRate','nativeVadSupported','nativeVadOpen','nativeVadProcessBatch','nativeVadReset','nativeVadClose'];
export const voiceJniSymbols=identity=>VOICE_JNI_METHODS.map(name=>'Java_'+identity.replaceAll('.','_')+'_ElizaVoiceNative_'+name);
/** Required names absent from `llvm-nm -D --defined-only` output (exact symbol match per line). */
export function missingSymbols(nmOutput,required){
 const defined=new Set(String(nmOutput).split('\n').map(line=>line.trim().split(/\s+/).at(-1)).filter(Boolean));
 return required.filter(symbol=>!defined.has(symbol));
}
const VOICE_PATH=/^(?:asr|tts\/kokoro|vad|g2p)\/[a-z0-9][a-z0-9_.-]{0,95}$/;
const isSha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const isBytes=value=>Number.isSafeInteger(value)&&value>0;
/** Schema admission of qualified-voice-host.json; returns the parsed record. */
export function readVoiceHost(productRoot){
 const file=path.join(productRoot,VOICE_HOST_MANIFEST);
 const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 const pin=JSON.parse(fs.readFileSync(path.join(productRoot,'upstream.lock.json'),'utf8')).commit;
 const identity=JSON.parse(fs.readFileSync(path.join(productRoot,'app.config.json'),'utf8')).appId;
 if(manifest.schemaVersion!==1||manifest.pin!==pin||!isCommit(manifest.forkPin)||manifest.identity!==identity||manifest.provider!=='libelizainference-cpu')throw Error('Voice host qualification source or identity changed');
 if(manifest.bundle?.format!==VOICE_BUNDLE_FORMAT||manifest.bundle?.assetRoot!==VOICE_ASSET_ROOT)throw Error('Voice bundle layout changed');
 if(!Array.isArray(manifest.abis)||manifest.abis.map(row=>row?.abi).join()!=='arm64-v8a,x86_64')throw Error('Voice host must record arm64-v8a and x86_64');
 for(const row of manifest.abis){
  if(row.abiVersionMin!==VOICE_ABI_VERSION_MIN||row.alignment16KiB!==true||JSON.stringify(row.requiredFusedSymbols)!==JSON.stringify(VOICE_FUSED_SYMBOLS)||JSON.stringify(row.requiredJniSymbols)!==JSON.stringify(voiceJniSymbols(identity)))throw Error('Voice host symbol or ABI requirements changed for '+row.abi);
  if(typeof row.voiceSymbolsVerified!=='boolean'||!Array.isArray(row.libraries))throw Error('Voice host library record malformed for '+row.abi);
  if(row.voiceSymbolsVerified&&(!isSha(row.voiceQualificationReceiptSha256)||row.libraries.length!==names.length||row.libraries.some(lib=>!names.includes(lib.name)||!isSha(lib.sha256)||!isBytes(lib.bytes)||lib.alignment16KiB!==true)))throw Error('Voice host qualification incomplete for '+row.abi);
 }
 if(!Array.isArray(manifest.models)||new Set(manifest.models.map(row=>row?.path)).size!==manifest.models.length)throw Error('Voice model rows malformed');
 for(const row of manifest.models){
  if(!VOICE_PATH.test(row.path)||!VOICE_ROLES.includes(row.role)||row.role==='lexicon')throw Error('Invalid voice model row '+row.path);
  if(row.sha256!==null&&(!isSha(row.sha256)||!isBytes(row.bytes)||typeof row.license!=='string'||typeof row.source!=='string'))throw Error('Pinned voice model row incomplete: '+row.path);
 }
 const lexicon=manifest.lexicon;
 if(!lexicon||!VOICE_PATH.test(lexicon.path)||!isSha(lexicon.source?.sha256)||!isBytes(lexicon.source?.bytes)||(lexicon.sha256!==null&&(!isSha(lexicon.sha256)||!isBytes(lexicon.bytes))))throw Error('Voice lexicon row malformed');
 if(!manifest.evidence||typeof manifest.evidence.emulatorDeviceExecuted!=='boolean'||typeof manifest.evidence.deviceExecuted!=='boolean')throw Error('Voice evidence record malformed');
 return manifest;
}
/** Pinned rows that may be staged: models with recorded bytes plus the recorded lexicon. */
export function pinnedVoiceFiles(manifest){
 const rows=manifest.models.filter(row=>row.sha256!==null).map(row=>({path:row.path,role:row.role,sha256:row.sha256,bytes:row.bytes}));
 if(manifest.lexicon.sha256!==null)rows.push({path:manifest.lexicon.path,role:'lexicon',sha256:manifest.lexicon.sha256,bytes:manifest.lexicon.bytes});
 return rows;
}
function listFiles(directory){
 const out=[];
 const walk=current=>{for(const entry of fs.readdirSync(current,{withFileTypes:true})){const file=path.join(current,entry.name);if(entry.isSymbolicLink())throw Error('Voice bundle must not contain links: '+path.relative(directory,file));if(entry.isDirectory())walk(file);else out.push(path.relative(directory,file).split(path.sep).join('/'));}};
 walk(directory);return out.sort();
}
/**
 * Build admission for the on-device voice bundle. No bundle is valid (local speech then reports
 * unavailable and the product stays on Cloud). A staged bundle must be complete, byte-exact, and
 * backed by a voice-symbol qualification of every packaged ABI. Never downloads or repairs.
 */
export function verifyVoiceHost(productRoot,{allowAbsentRuntime=false}={}){
 const assets=path.join(productRoot,VOICE_ASSET_ROOT);
 if(!fs.existsSync(path.join(productRoot,'android/app/src/main/assets/voice')))return {status:'not-packaged'};
 if(fs.lstatSync(path.join(productRoot,'android/app/src/main/assets/voice')).isSymbolicLink()||!fs.existsSync(assets)||fs.lstatSync(assets).isSymbolicLink())throw Error('Voice bundle directory is incomplete or linked');
 const manifest=readVoiceHost(productRoot);
 const allowed=new Map(pinnedVoiceFiles(manifest).map(row=>[row.path,row]));
 const staged=listFiles(assets);
 if(!staged.includes('manifest.json'))throw Error('Voice bundle manifest.json missing');
 const bundle=JSON.parse(fs.readFileSync(path.join(assets,'manifest.json'),'utf8'));
 if(bundle.format!==VOICE_BUNDLE_FORMAT||!Array.isArray(bundle.files))throw Error('Voice bundle manifest format changed');
 const listed=new Map();
 for(const row of bundle.files){
  const pinned=allowed.get(row?.path);
  if(!pinned||row.role!==pinned.role||row.sha256!==pinned.sha256||row.bytes!==pinned.bytes||listed.has(row.path))throw Error('Voice bundle lists an unqualified file: '+row?.path);
  listed.set(row.path,row);
 }
 for(const name of staged)if(name!=='manifest.json'&&!listed.has(name))throw Error('Voice bundle contains an unlisted file: '+name);
 for(const row of listed.values()){
  const file=path.join(assets,row.path);
  if(!fs.existsSync(file)||fs.statSync(file).size!==row.bytes||hash(file)!==row.sha256)throw Error('Voice bundle file missing or changed: '+row.path);
 }
 const roles=new Set([...listed.values()].map(row=>row.role));
 for(const role of VOICE_REQUIRED_ROLES)if(!roles.has(role))throw Error('Voice bundle lacks '+role);
 if(roles.has('asr-model')!==roles.has('asr-mmproj'))throw Error('Voice bundle ASR must be a model and mmproj pair');
 // Every ABI whose native engine is packaged must be qualified for the voice symbols, byte for byte.
 const packagedAbis=['arm64-v8a','x86_64'].filter(abi=>fs.existsSync(path.join(productRoot,'android/app/src/main/jniLibs',abi,'libelizainference.so')));
 if(!packagedAbis.length&&!allowAbsentRuntime)throw Error('Voice bundle staged without the fused native engine');
 for(const abi of packagedAbis){
  const row=manifest.abis.find(entry=>entry.abi===abi);
  if(!row.voiceSymbolsVerified)throw Error('Native engine for '+abi+' has no voice-symbol qualification');
  for(const library of row.libraries){
   const file=path.join(productRoot,'android/app/src/main/jniLibs',abi,library.name);
   if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size!==library.bytes||hash(file)!==library.sha256)throw Error('Voice-qualified library missing or changed: '+abi+'/'+library.name);
  }
 }
 return {status:'packaged',roles:[...roles].sort(),asr:roles.has('asr-model'),abis:packagedAbis};
}
/** Admits a prepare-embedding-host receipt whose libraries export every voice symbol. */
export function voiceReceiptRow(productRoot,receipt,receiptFile){
 const identity=JSON.parse(fs.readFileSync(path.join(productRoot,'app.config.json'),'utf8')).appId;
 if(receipt.built!==true||!receipt.qualifiedAt||!['arm64-v8a','x86_64'].includes(receipt.abi)||!Array.isArray(receipt.libraries)||receipt.libraries.length!==3)throw Error('Exact qualified voice receipt required');
 verifyEmbeddingInputs(productRoot,{...receipt,abi:'arm64-v8a'});
 const voice=receipt.voiceSymbols;
 if(voice?.verified!==true||JSON.stringify(voice.fused)!==JSON.stringify(VOICE_FUSED_SYMBOLS)||JSON.stringify(voice.jni)!==JSON.stringify(voiceJniSymbols(identity))||(voice.missing??[]).length)throw Error('Receipt does not prove the voice symbols');
 return names.map(name=>{
  const matches=receipt.libraries.filter(row=>path.basename(row.path)===name);
  if(matches.length!==1)throw Error('Incomplete voice host receipt');
  const row=matches[0];
  if(!isBytes(row.bytes)||fs.statSync(row.path).size!==row.bytes||row.alignment16KiB!==true||hash(row.path)!==row.sha256)throw Error('Qualified library bytes changed');
  return {name,sha256:row.sha256,bytes:row.bytes,alignment16KiB:true,source:row.path};
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args[0]==='--verify-voice'&&(args.length===1||args.length===2&&args[1]==='--allow-unpackaged-runtime')){
  const result=verifyVoiceHost(root,{allowAbsentRuntime:args.includes('--allow-unpackaged-runtime')});
  console.log(result.status==='not-packaged'?'No on-device voice bundle packaged; local speech reports unavailable and Cloud voice is unchanged.':`On-device voice bundle verified (${result.roles.join(', ')}; ABIs ${result.abis.join(', ')||'none'}). APK-build admission only; no emulator or device execution claimed.`);
 }
 else if(args.length===2&&args[0]==='--receipt-voice'){
  const receipt=JSON.parse(fs.readFileSync(args[1],'utf8'));
  const manifest=readVoiceHost(root);
  if(receipt.forkPin!==manifest.forkPin)throw Error('Voice receipt engine gitlink differs from the voice host record');
  const libraries=voiceReceiptRow(root,receipt,args[1]);
  const row=manifest.abis.find(entry=>entry.abi===receipt.abi);
  if(receipt.abi==='arm64-v8a'){
   // ARM64 shares the reviewed embedding host bytes; a different build needs that review first.
   const embedding=JSON.parse(fs.readFileSync(path.join(root,'android/embedding-host/qualified-host.json'),'utf8'));
   for(const library of libraries){const reviewed=embedding.libraries.find(item=>item.name===library.name);if(!reviewed||reviewed.sha256!==library.sha256)throw Error('ARM64 voice libraries must be the qualified embedding host bytes: '+library.name);}
  }
  if(row.voiceSymbolsVerified&&JSON.stringify(row.libraries)!==JSON.stringify(libraries.map(({source,...rest})=>rest)))throw Error('Existing voice qualification for '+receipt.abi+' differs; review before replacing');
  for(const library of libraries){
   const target=path.join(root,'android/app/src/main/jniLibs',receipt.abi,library.name);
   if(fs.existsSync(target)&&(fs.lstatSync(target).isSymbolicLink()||hash(target)!==library.sha256))throw Error('Existing native library differs; review ownership before replacing '+library.name);
   fs.mkdirSync(path.dirname(target),{recursive:true});if(!fs.existsSync(target))fs.copyFileSync(library.source,target,fs.constants.COPYFILE_EXCL);
  }
  Object.assign(row,{libraries:libraries.map(({source,...rest})=>rest),voiceSymbolsVerified:true,voiceQualificationReceiptSha256:hash(args[1])});
  manifest.evidence.buildReceipt={...(manifest.evidence.buildReceipt||{}),[receipt.abi]:hash(args[1])};
  fs.writeFileSync(path.join(root,VOICE_HOST_MANIFEST),JSON.stringify(manifest,null,2)+'\n');
  readVoiceHost(root);console.log(`Voice-qualified ${receipt.abi} native host staged. Build-receipt evidence only; no emulator or device execution claimed.`);
 }
 else if(args[0]==='--verify'&&(args.length===1||args.length===2&&args[1]==='--allow-unpackaged-runtime')){const result=verifyEmbeddingHost(root,{allowAbsentRuntime:args.includes('--allow-unpackaged-runtime')});console.log(result.status==='not-packaged'?'No resident embedding host packaged; developer APK only.':'Qualified ARM64 embedding host and BGE384 bytes verified. No device execution claimed.');}
 else if(args.length===2&&args[0]==='--receipt'){
  const receipt=JSON.parse(fs.readFileSync(args[1],'utf8'));
  const identity=JSON.parse(fs.readFileSync(path.join(root,'app.config.json'),'utf8')).appId;
  if(receipt.built!==true||!receipt.qualifiedAt||!Array.isArray(receipt.libraries)||receipt.libraries.length!==3)throw Error('Exact qualified ARM64 receipt required');
  verifyEmbeddingInputs(root,receipt);
  const libraries=names.map(name=>{
   const matches=receipt.libraries.filter(row=>path.basename(row.path)===name);
   if(matches.length!==1)throw Error('Incomplete embedding host receipt');
   const row=matches[0];if(!Number.isSafeInteger(row.bytes)||row.bytes<=0||fs.statSync(row.path).size!==row.bytes||row.alignment16KiB!==true||hash(row.path)!==row.sha256)throw Error('Qualified library bytes changed');
   const target=path.join(root,'android/app/src/main/jniLibs',receipt.abi,name);
   if(fs.existsSync(target)&&(fs.lstatSync(target).isSymbolicLink()||hash(target)!==row.sha256))throw Error('Existing native library differs; review ownership before replacing '+name);
   return {name,sha256:row.sha256,bytes:row.bytes,alignment16KiB:true,source:row.path,target};
  });
  if(hash(path.join(root,model.path))!==model.sha256)throw Error('Pinned BGE model bytes changed');
  const manifest={pin:receipt.pin,forkPin:receipt.forkPin,identity,abi:receipt.abi,model,libraries:libraries.map(({source,target,...row})=>row),qualificationReceiptSha256:hash(args[1]),jniIdentityRelocated:true,inputs:receipt.inputs};
  const manifestFile=path.join(root,'android/embedding-host/qualified-host.json');
  if(fs.existsSync(manifestFile)&&fs.readFileSync(manifestFile,'utf8')!==JSON.stringify(manifest,null,2)+'\n')throw Error('Existing embedding qualification differs; review before replacing');
  for(const row of libraries){fs.mkdirSync(path.dirname(row.target),{recursive:true});if(!fs.existsSync(row.target))fs.copyFileSync(row.source,row.target,fs.constants.COPYFILE_EXCL);}
  fs.mkdirSync(path.dirname(manifestFile),{recursive:true});fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
  verifyEmbeddingHost(root);console.log('Qualified ARM64 embedding host staged. Runtime policy and Cloud text/speech unchanged.');
 }else throw Error('Usage: node scripts/stage-embedding-host.mjs --receipt <QUALIFICATION.json> | --verify | --receipt-voice <QUALIFICATION.json> | --verify-voice [--allow-unpackaged-runtime]');
}
