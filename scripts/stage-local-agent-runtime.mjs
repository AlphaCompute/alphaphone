#!/usr/bin/env node
import {sourceDirectory} from './local-agent-source.mjs';
import {verifyWorkerArtifact,workerHash} from './workflow-worker-artifact.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const source=sourceDirectory(root);
if(!fs.existsSync(path.join(source,'.alpha-runtime-source.json')))throw Error('Run npm run agent:prepare first.');
execFileSync(process.execPath,[path.join(root,'scripts/prepare-local-agent.mjs'),'--source-only'],{cwd:root,stdio:'inherit'});
verifyWorkerArtifact(path.resolve(process.env.ALPHA_WORKFLOW_WORKER_OUTPUT||path.join(root,'artifacts/mobile-workflow-worker')),
 {sourceStampSha256:workerHash(fs.readFileSync(path.join(source,'.alpha-runtime-source.json'))),lockSha256:workerHash(fs.readFileSync(path.join(source,'bun.lock')))});
const env={...process.env,ELIZA_ANDROID_TARGET_ABIS:'arm64-v8a,x86_64'};
execFileSync(process.env.ALPHA_BUN||'bun',['run','--cwd','packages/agent','build:mobile','--target=android'],{cwd:source,env,stdio:'inherit'});
execFileSync(process.execPath,[path.join(root,'scripts/prepare-local-agent.mjs'),'--source-only'],{cwd:root,stdio:'inherit'});
// Bun supplies the upstream TypeScript staging module's runtime semantics.
const runner=path.join(source,'.alpha-stage-runtime.ts');
fs.writeFileSync(runner,`import {stageAndroidAgentRuntime} from './packages/app/scripts/lib/stage-android-agent.ts';\nawait stageAndroidAgentRuntime({androidDir:${JSON.stringify(path.join(root,'android'))},spikeDir:${JSON.stringify(path.join(source,'packages/app/scripts'))}});\n`);
try{execFileSync(process.env.ALPHA_BUN||'bun',[runner],{cwd:source,env,stdio:'inherit'});}finally{fs.unlinkSync(runner);}
fs.copyFileSync(path.join(source,'.alpha-runtime-source.json'),path.join(root,'android/app/src/main/assets/agent/alpha-source.json'));
execFileSync(process.execPath,[path.join(root,'scripts/stage-workflow-worker.mjs')],{cwd:root,env:process.env,stdio:'inherit'});
console.log('Android runtime payload staged for ARM64 and x86_64. This is not device execution evidence.');
