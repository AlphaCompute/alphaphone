import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const upstream=path.join(root,'vendor/eliza');
const pin=JSON.parse(fs.readFileSync(path.join(root,'upstream.lock.json'),'utf8')).commit;
if(execFileSync('git',['-C',upstream,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==pin)throw Error('Unexpected native runtime source pin');
const identity=JSON.parse(fs.readFileSync(path.join(root,'app.config.json'),'utf8')).appId;
if(!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(identity))throw Error('Invalid application identity');
const classes=['AgentSecureStore','DeviceRamTierPolicy','ElizaAgentService','ElizaAgentWatchdogPolicy','ElizaAssetExtractionPolicy','ElizaBionicInferenceServer','ElizaStartupTrace','ElizaWorkScheduler','ElizaTasksWorker','InferenceMemoryPolicy','RuntimeInstallationIdentity','ChromiumBrowserConnection','BionicDecodeLoop','ElizaVoiceNative','BgeEmbeddingSession'];
const output=path.join(root,'android/app/build/generated/local-agent/java');
const target=path.join(output,...identity.split('.'));fs.mkdirSync(target,{recursive:true});
const manifest={pin,identity,files:[]};
for(const name of classes){
  const relative=`packages/app/platforms/android/app/src/main/java/ai/elizaos/app/${name}.java`;
  const input=fs.readFileSync(path.join(upstream,relative),'utf8');
  let value=input.replaceAll('ai.elizaos.app',identity).replaceAll('R.mipmap.ic_launcher','R.drawable.app_icon');
  // Abstract sockets are device-global. Give the consumer its own namespace.
  value=value.replaceAll('"eliza_local_agent_v1"',`"${identity}.agent.v1"`).replaceAll('"eliza_bionic_infer_v1"',`"${identity}.inference.v1"`);
  if(name==='ElizaAgentService'){
    const anchor='agentEnv.put("ELIZA_LOCAL_AGENT_SOCKET", LOCAL_AGENT_SOCKET_NAME);';
    if(value.split(anchor).length!==2)throw Error('Native runtime environment insertion point changed');
    value=value.replace(anchor,anchor+`\n            agentEnv.put("ELIZA_ANDROID_SECURE_STORE_SOCKET", "${identity}.secure-store");\n            try { AlphaLocalAgentPlugin.configureEnvironment(this, agentEnv); } catch (java.io.IOException unavailable) { currentStatus = "provider-unavailable"; updateNotification(); return; }`);
  }
  fs.writeFileSync(path.join(target,name+'.java'),value);
  manifest.files.push({path:relative,sha256:createHash('sha256').update(input).digest('hex'),generatedSha256:createHash('sha256').update(value).digest('hex')});
}
const identitySource='plugins/plugin-native-browser-surface/android/src/main/java/ai/eliza/plugins/browsersurface/ChromiumBrowserIdentity.java';
const browserTarget=path.join(output,'ai/eliza/plugins/browsersurface');fs.mkdirSync(browserTarget,{recursive:true});
fs.copyFileSync(path.join(upstream,identitySource),path.join(browserTarget,'ChromiumBrowserIdentity.java'));
manifest.files.push({path:identitySource,sha256:createHash('sha256').update(fs.readFileSync(path.join(upstream,identitySource))).digest('hex')});
fs.writeFileSync(path.join(root,'android/app/build/generated/local-agent/source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Generated ${manifest.files.length} pinned local-agent sources for ${identity}`);
