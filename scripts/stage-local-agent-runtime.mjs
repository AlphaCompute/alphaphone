#!/usr/bin/env node
import {preparedSourceEnv,sourceDirectory,workerArtifactDirectory} from './local-agent-source.mjs';
import {verifyWorkerArtifact,workerHash} from './workflow-worker-artifact.mjs';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {nativeViewPolicyPath} from './native-view-policy.mjs';
import {verifyNativeGoogleHostArtifact} from './native-google-host-artifact.mjs';
const root=path.resolve(import.meta.dirname,'..');
const profile=process.argv.slice(2);
if(profile.some(arg=>arg!=='--runtime-profile=cloud'))throw Error('Unknown runtime profile');
const runtimeProfile=profile.includes('--runtime-profile=cloud')?'cloud':'native';
const source=sourceDirectory(root);
if(!fs.existsSync(path.join(source,'.alpha-runtime-source.json')))throw Error('Run npm run agent:prepare first.');
execFileSync(process.execPath,[path.join(root,'scripts/prepare-local-agent.mjs'),'--source-only'],{cwd:root,stdio:'inherit'});
verifyWorkerArtifact(workerArtifactDirectory(root),
 {sourceStampSha256:workerHash(fs.readFileSync(path.join(source,'.alpha-runtime-source.json'))),lockSha256:workerHash(fs.readFileSync(path.join(source,'bun.lock')))});
verifyNativeGoogleHostArtifact(root,workerArtifactDirectory(root));
// Children run inside the immutable prepared source; keep turbo from editing its AGENTS.md.
const env=preparedSourceEnv(process.env,{ELIZA_ANDROID_TARGET_ABIS:'arm64-v8a,x86_64'});
execFileSync(process.env.ALPHA_BUN||'bun',['run','--cwd','packages/agent','build:mobile','--target=android'],{cwd:source,env,stdio:'inherit'});
// The build must leave the prepared source at the exact pinned commit.
execFileSync(process.execPath,[path.join(root,'scripts/prepare-local-agent.mjs'),'--source-only'],{cwd:root,stdio:'inherit'});
// Bun supplies the upstream TypeScript staging module's runtime semantics.
const runner=path.join(source,'.alpha-stage-runtime.ts');
fs.writeFileSync(runner,`import {stageAndroidAgentRuntime} from './packages/app/scripts/lib/stage-android-agent.ts';\nawait stageAndroidAgentRuntime({androidDir:${JSON.stringify(path.join(root,'android'))},spikeDir:${JSON.stringify(path.join(source,'packages/app/scripts'))}});\n`);
try{execFileSync(process.env.ALPHA_BUN||'bun',[runner],{cwd:source,env,stdio:'inherit'});}finally{fs.unlinkSync(runner);}
fs.copyFileSync(path.join(source,'.alpha-runtime-source.json'),path.join(root,'android/app/src/main/assets/agent/alpha-source.json'));
// Host configuration is separate from the authenticated, unmodified producer source.
fs.copyFileSync(nativeViewPolicyPath,path.join(root,'android/app/src/main/assets/agent/native-view-declarations.json'));
execFileSync(process.execPath,[path.join(root,'scripts/stage-workflow-worker.mjs')],{cwd:root,env:process.env,stdio:'inherit'});
const omittedLocalModels=[];
if(runtimeProfile==='cloud'){
 const relative='assets/agent/models/bge-small-en-v1.5-f16.gguf',file=path.join(root,'android/app/src/main',relative);
 const sha256=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 if(sha256!=='f0b2fef971e8366438bfd2d9aefea1b0115919389448806d290237f638bae999')throw Error('Cloud projection refuses unrecognized local model');
 omittedLocalModels.push({path:relative,sha256});fs.unlinkSync(file);
}
// The original producer provenance remains unchanged; this explicit consumer projection
// records the exact local-only model deliberately omitted from the Cloud APK.
fs.writeFileSync(path.join(root,'android/app/src/main/assets/agent/alpha-runtime-profile.json'),JSON.stringify({version:1,runtimeProfile,...(runtimeProfile==='cloud'?{omittedLocalModels}:{})},null,2)+'\n');
console.log('Android runtime payload staged for ARM64 and x86_64. This is not device execution evidence.');
