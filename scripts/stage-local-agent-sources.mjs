import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {sourceDirectory, verifySource} from './local-agent-source.mjs';
const root=path.resolve(import.meta.dirname,'..');
const upstream=path.join(root,'vendor/eliza');
const pin=JSON.parse(fs.readFileSync(path.join(root,'upstream.lock.json'),'utf8')).commit;
if(execFileSync('git',['-C',upstream,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==pin)throw Error('Unexpected native runtime source pin');
const identity=JSON.parse(fs.readFileSync(path.join(root,'app.config.json'),'utf8')).appId;
if(!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(identity))throw Error('Invalid application identity');
// All shared native code comes directly from the same reviewed upstream commit.
const digest=value=>createHash('sha256').update(value).digest('hex');
const runtimeSource=sourceDirectory(root);
verifySource(runtimeSource,{baseCommit:pin,candidateFiles:{}},{files:{}});
const classes=['SecureStoreFrameInput','AgentSecureStore','DeviceRamTierPolicy','ElizaAgentService','IpcStartupRecovery','WorkflowSurvivorInventory','ElizaAgentWatchdogPolicy','ElizaAssetExtractionPolicy','ElizaBionicInferenceServer','ElizaStartupTrace','ElizaWorkScheduler','ElizaTasksWorker','InferenceMemoryPolicy','RuntimeInstallationIdentity','BionicDecodeLoop','ElizaVoiceNative','BgeEmbeddingSession'];
const output=path.join(root,'android/app/build/generated/local-agent/java');
fs.rmSync(output,{recursive:true,force:true});
const target=path.join(output,...identity.split('.'));fs.mkdirSync(target,{recursive:true});
const manifest={pin,identity,runtimeSource:{commit:pin},patches:[],files:[]};
for(const name of classes){
  const relative=`packages/app/platforms/android/app/src/main/java/ai/elizaos/app/${name}.java`;
  const input=fs.readFileSync(path.join(runtimeSource,relative),'utf8');
  let value=input.replaceAll('ai.elizaos.app',identity).replaceAll('R.mipmap.ic_launcher','R.drawable.app_icon');
  // Abstract sockets are device-global. Give the consumer its own namespace.
  value=value.replaceAll('"eliza_local_agent_v1"',`"${identity}.agent.v1"`).replaceAll('"eliza_bionic_infer_v1"',`"${identity}.inference.v1"`);
  if(name==='ElizaAgentService'){
    const anchor='agentEnv.put("ELIZA_LOCAL_AGENT_SOCKET_PATH",privateSocketPath);';
    if(value.split(anchor).length!==2)throw Error('Native runtime environment insertion point changed');
    value=value.replace(anchor,anchor+`\n            agentEnv.put("ELIZA_ANDROID_SECURE_STORE_SOCKET", "${identity}.secure-store");\n            try { AlphaLocalAgentPlugin.configureEnvironment(this, agentEnv); } catch (java.io.IOException unavailable) { currentStatus = "provider-unavailable"; updateNotification(); return; }`);
  }
  fs.writeFileSync(path.join(target,name+'.java'),value);
  manifest.files.push({path:relative,generatedPath:path.relative(root,path.join(target,name+'.java')),sourceSha256:digest(input),sha256:digest(input),generatedSha256:createHash('sha256').update(value).digest('hex')});
}
// The canonical service delegates child termination to this upstream helper.
// Keep its package and implementation intact, with the same source provenance.
const supervisorRelative='plugins/plugin-native-agent/android/src/main/java/ai/eliza/plugins/agent/runtime/NativeProcessSupervisor.java';
const supervisorInput=fs.readFileSync(path.join(runtimeSource,supervisorRelative),'utf8');
const supervisorTarget=path.join(output,'ai/eliza/plugins/agent/runtime/NativeProcessSupervisor.java');
fs.mkdirSync(path.dirname(supervisorTarget),{recursive:true});
fs.writeFileSync(supervisorTarget,supervisorInput);
manifest.files.push({path:supervisorRelative,generatedPath:path.relative(root,supervisorTarget),sourceSha256:digest(supervisorInput),sha256:digest(supervisorInput),generatedSha256:digest(supervisorInput)});
const browserTarget=path.join(output,'ai/eliza/plugins/browsersurface');fs.mkdirSync(browserTarget,{recursive:true});
for(const name of ['ChromiumBrowserIdentity','ChromiumBrowserConnection']){
 const relative=`plugins/plugin-native-browser-surface/android/src/main/java/ai/eliza/plugins/browsersurface/${name}.java`;
 const input=fs.readFileSync(path.join(runtimeSource,relative),'utf8');
 const value=name==='ChromiumBrowserConnection'?input.replace('package ai.eliza.plugins.browsersurface;',`package ai.eliza.plugins.browsersurface;\nimport ${identity}.BuildConfig;`):input;
 const generated=path.join(browserTarget,name+'.java');fs.writeFileSync(generated,value);
 manifest.files.push({path:relative,generatedPath:path.relative(root,generated),sourceSha256:digest(input),sha256:digest(input),generatedSha256:digest(value)});
}
fs.writeFileSync(path.join(root,'android/app/build/generated/local-agent/source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Generated ${manifest.files.length} pinned local-agent sources for ${identity}`);
