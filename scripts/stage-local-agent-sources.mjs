import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {sourceDirectory, verifySource} from './local-agent-source.mjs';
import {applyNativeRuntimePatch} from './native-runtime-patch.mjs';
const root=path.resolve(import.meta.dirname,'..');
const upstream=path.join(root,'vendor/eliza');
const pin=JSON.parse(fs.readFileSync(path.join(root,'upstream.lock.json'),'utf8')).commit;
if(execFileSync('git',['-C',upstream,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==pin)throw Error('Unexpected native runtime source pin');
const identity=JSON.parse(fs.readFileSync(path.join(root,'app.config.json'),'utf8')).appId;
if(!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(identity))throw Error('Invalid application identity');
// Apply the reviewed compatibility patch only in a disposable source tree, never vendor/eliza.
const digest=value=>createHash('sha256').update(value).digest('hex');
const provenance=JSON.parse(fs.readFileSync(path.join(root,'patches/eliza/android-secure-store-api29-source.json'),'utf8'));
const patchPath=path.join(root,'patches/eliza',provenance.patch);
if(provenance.baseCommit!==pin||digest(fs.readFileSync(patchPath))!==provenance.patchSha256)throw Error('Unexpected secure-store compatibility patch provenance');
const patchedInputs=new Map();
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-native-source-'));
try {
  for(const [relative,hashes] of Object.entries(provenance.files)) {
    if(hashes.sourceSha256===null) {
      if(fs.existsSync(path.join(upstream,relative)))throw Error('Unexpected existing compatibility helper');
      continue;
    }
    const input=fs.readFileSync(path.join(upstream,relative));
    if(digest(input)!==hashes.sourceSha256)throw Error('Native compatibility source drift');
    const destination=path.join(scratch,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,input);
  }
  execFileSync('git',['apply','--check',patchPath],{cwd:scratch,stdio:'pipe',timeout:20000});
  execFileSync('git',['apply',patchPath],{cwd:scratch,stdio:'pipe',timeout:20000});
  for(const [relative,hashes] of Object.entries(provenance.files)) {
    const input=fs.readFileSync(path.join(scratch,relative),'utf8');
    if(digest(input)!==hashes.patchedSha256)throw Error('Native compatibility patch output drift');
    patchedInputs.set(relative,input);
  }
} finally { fs.rmSync(scratch,{recursive:true,force:true}); }
// Service and lifecycle helpers now come from the reviewed runtime commit.
// The old vendor-based stream/private IPC overlays must not be replayed.
const nativeSource=JSON.parse(fs.readFileSync(path.join(root,'patches/eliza/android-native-runtime-source.json'),'utf8'));
const runtimeManifest=JSON.parse(fs.readFileSync(path.join(root,'patches/eliza/mvp-source-base.json'),'utf8'));
const consumerManifest=JSON.parse(fs.readFileSync(path.join(root,'patches/eliza/android-local-runtime-source.json'),'utf8'));
if(!/^[a-f0-9]{40}$/.test(nativeSource.commit)||nativeSource.commit!==runtimeManifest.baseCommit||consumerManifest.baseCommit!==nativeSource.commit)throw Error('Native runtime commit is not admitted');
const runtimeSource=sourceDirectory(root);
verifySource(runtimeSource,runtimeManifest,consumerManifest);
const expectedClasses=['ElizaAgentService','IpcStartupRecovery','WorkflowSurvivorInventory'];
const expectedPaths=expectedClasses.map(name=>`packages/app/platforms/android/app/src/main/java/ai/elizaos/app/${name}.java`);
if(JSON.stringify(Object.keys(nativeSource.files).sort())!==JSON.stringify(expectedPaths.sort()))throw Error('Native source registration changed');
for(const [relative,hash] of Object.entries(nativeSource.files)){
 if(patchedInputs.has(relative)||Object.hasOwn(consumerManifest.files,relative)||Object.hasOwn(runtimeManifest.candidateFiles,relative))throw Error('Native runtime source must come directly from the admitted upstream commit');
 const file=path.join(runtimeSource,relative);
 if(fs.lstatSync(file).isSymbolicLink())throw Error('Native runtime source must be a regular file');
 const input=fs.readFileSync(file,'utf8');
 if(digest(input)!==hash)throw Error('Native runtime source hash drift');
 patchedInputs.set(relative,input);
}
applyNativeRuntimePatch(root, nativeSource, patchedInputs);
const classes=['SecureStoreFrameInput','AgentSecureStore','DeviceRamTierPolicy','ElizaAgentService','IpcStartupRecovery','WorkflowSurvivorInventory','ElizaAgentWatchdogPolicy','ElizaAssetExtractionPolicy','ElizaBionicInferenceServer','ElizaStartupTrace','ElizaWorkScheduler','ElizaTasksWorker','InferenceMemoryPolicy','RuntimeInstallationIdentity','ChromiumBrowserConnection','BionicDecodeLoop','ElizaVoiceNative','BgeEmbeddingSession'];
const output=path.join(root,'android/app/build/generated/local-agent/java');
const target=path.join(output,...identity.split('.'));fs.mkdirSync(target,{recursive:true});
const manifest={pin,identity,runtimeSource:nativeSource,patches:[provenance,nativeSource.compatibilityPatch],files:[]};
for(const name of classes){
  const relative=`packages/app/platforms/android/app/src/main/java/ai/elizaos/app/${name}.java`;
  const input=patchedInputs.get(relative)??fs.readFileSync(path.join(upstream,relative),'utf8');
  let value=input.replaceAll('ai.elizaos.app',identity).replaceAll('R.mipmap.ic_launcher','R.drawable.app_icon');
  // Abstract sockets are device-global. Give the consumer its own namespace.
  value=value.replaceAll('"eliza_local_agent_v1"',`"${identity}.agent.v1"`).replaceAll('"eliza_bionic_infer_v1"',`"${identity}.inference.v1"`);
  if(name==='ElizaAgentService'){
    const anchor='agentEnv.put("ELIZA_LOCAL_AGENT_SOCKET_PATH",privateSocketPath);';
    if(value.split(anchor).length!==2)throw Error('Native runtime environment insertion point changed');
    value=value.replace(anchor,anchor+`\n            agentEnv.put("ELIZA_ANDROID_SECURE_STORE_SOCKET", "${identity}.secure-store");\n            try { AlphaLocalAgentPlugin.configureEnvironment(this, agentEnv); } catch (java.io.IOException unavailable) { currentStatus = "provider-unavailable"; updateNotification(); return; }`);
  }
  fs.writeFileSync(path.join(target,name+'.java'),value);
  manifest.files.push({path:relative,sourceSha256:nativeSource.files[relative]??provenance.files[relative]?.sourceSha256??(patchedInputs.has(relative)?null:digest(input)),sha256:digest(input),generatedSha256:createHash('sha256').update(value).digest('hex')});
}
const identitySource='plugins/plugin-native-browser-surface/android/src/main/java/ai/eliza/plugins/browsersurface/ChromiumBrowserIdentity.java';
const browserTarget=path.join(output,'ai/eliza/plugins/browsersurface');fs.mkdirSync(browserTarget,{recursive:true});
fs.copyFileSync(path.join(upstream,identitySource),path.join(browserTarget,'ChromiumBrowserIdentity.java'));
manifest.files.push({path:identitySource,sha256:createHash('sha256').update(fs.readFileSync(path.join(upstream,identitySource))).digest('hex')});
fs.writeFileSync(path.join(root,'android/app/build/generated/local-agent/source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Generated ${manifest.files.length} pinned local-agent sources for ${identity}`);
