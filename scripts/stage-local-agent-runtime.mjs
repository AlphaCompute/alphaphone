#!/usr/bin/env node
import {preparedSourceEnv,sourceDirectory,workerArtifactDirectory} from './local-agent-source.mjs';
import {verifyWorkerArtifact,workerHash} from './workflow-worker-artifact.mjs';
import {prepareElizaPatches} from './prepare-eliza-patches.mjs';
import {overlayIdentity,readOverlayRecord,sameOverlay,serverSideOverlay,withPatchOverlay,writeOverlayRecord} from './eliza-patch-overlay.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const source=sourceDirectory(root);
if(!fs.existsSync(path.join(source,'.alpha-runtime-source.json')))throw Error('Run npm run agent:prepare first.');
execFileSync(process.execPath,[path.join(root,'scripts/prepare-local-agent.mjs'),'--source-only'],{cwd:root,stdio:'inherit'});
verifyWorkerArtifact(workerArtifactDirectory(root),
 {sourceStampSha256:workerHash(fs.readFileSync(path.join(source,'.alpha-runtime-source.json'))),lockSha256:workerHash(fs.readFileSync(path.join(source,'bun.lock')))});
// Applied server-side patches (plugin-assistant, plugin-workflow, contracts) are
// overlaid from the authenticated .eliza/patched only while the agent bundle builds.
prepareElizaPatches({root});
const expectedOverlay=overlayIdentity(serverSideOverlay(root));
if(!sameOverlay(readOverlayRecord(workerArtifactDirectory(root)),expectedOverlay))
 throw Error('The workflow-worker artifact was built with a different set of server-side Eliza patches; rerun npm run agent:build-workflow-worker into a fresh ALPHA_WORKFLOW_WORKER_OUTPUT.');
// Children run inside the immutable prepared source; keep turbo from editing its AGENTS.md.
const env=preparedSourceEnv(process.env,{ELIZA_ANDROID_TARGET_ABIS:'arm64-v8a,x86_64'});
const {overlay}=await withPatchOverlay(root,source,()=>execFileSync(process.env.ALPHA_BUN||'bun',['run','--cwd','packages/agent','build:mobile','--target=android'],{cwd:source,env,stdio:'inherit'}));
if(overlay)console.log(`Agent bundle built with server-side Eliza patches: ${overlay.patches.map(row=>row.patch).join(', ')}`);
// The overlay is restored; the prepared source must again be the exact pinned commit.
execFileSync(process.execPath,[path.join(root,'scripts/prepare-local-agent.mjs'),'--source-only'],{cwd:root,stdio:'inherit'});
// Bun supplies the upstream TypeScript staging module's runtime semantics.
const runner=path.join(source,'.alpha-stage-runtime.ts');
fs.writeFileSync(runner,`import {stageAndroidAgentRuntime} from './packages/app/scripts/lib/stage-android-agent.ts';\nawait stageAndroidAgentRuntime({androidDir:${JSON.stringify(path.join(root,'android'))},spikeDir:${JSON.stringify(path.join(source,'packages/app/scripts'))}});\n`);
try{execFileSync(process.env.ALPHA_BUN||'bun',[runner],{cwd:source,env,stdio:'inherit'});}finally{fs.unlinkSync(runner);}
fs.copyFileSync(path.join(source,'.alpha-runtime-source.json'),path.join(root,'android/app/src/main/assets/agent/alpha-source.json'));
// Patch provenance of this staging, beside the product artifacts (not inside the APK).
writeOverlayRecord(path.join(root,'artifacts/staged-agent-runtime'),overlay);
execFileSync(process.execPath,[path.join(root,'scripts/stage-workflow-worker.mjs')],{cwd:root,env:process.env,stdio:'inherit'});
console.log('Android runtime payload staged for ARM64 and x86_64. This is not device execution evidence.');
