#!/usr/bin/env bun
/** Product preparation/provenance wrapper. Runtime owns bundling and compiler resources. */
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {preparedSourceEnv,sourceDirectory,workerArtifactDirectory} from './local-agent-source.mjs';
import {ensurePreparedWorkflowWorker} from './prepared-workflow-worker.mjs';
import {existsSync} from 'node:fs';
import {prepareElizaPatches} from './prepare-eliza-patches.mjs';
import {overlayIdentity,readOverlayRecord,sameOverlay,serverSideOverlay,withPatchOverlay,writeOverlayRecord} from './eliza-patch-overlay.mjs';
// The producer runs in this process; drop agent-detection variables before it can
// start turbo in the prepared source (see preparedSourceEnv).
const env=preparedSourceEnv(process.env);
for(const name of Object.keys(process.env))if(!(name in env))delete process.env[name];
const root=resolve(import.meta.dir,'..'),source=sourceDirectory(root),output=workerArtifactDirectory(root);
execFileSync(process.env.ALPHA_NODE||'node',[join(root,'scripts/prepare-local-agent.mjs'),'--source-only'],{cwd:root,stdio:'inherit'});
// Applied server-side patches (plugin-workflow, contracts, ...) are overlaid from the
// authenticated .eliza/patched only while the worker builds; reuse needs the same set.
prepareElizaPatches({root});
const expected=overlayIdentity(serverSideOverlay(root));
if(existsSync(output)&&!sameOverlay(readOverlayRecord(output),expected))
 throw Error(`Existing worker artifact ${output} was built with a different set of server-side Eliza patches. Move it aside, or set ALPHA_WORKFLOW_WORKER_OUTPUT to a fresh directory under artifacts.`);
const {overlay,result}=await withPatchOverlay(root,source,()=>ensurePreparedWorkflowWorker(root,source,output));
if(!result.reused)writeOverlayRecord(output,overlay);
// The overlay is restored; the prepared source must again be the exact pinned commit.
execFileSync(process.env.ALPHA_NODE||'node',[join(root,'scripts/prepare-local-agent.mjs'),'--source-only'],{cwd:root,stdio:'inherit'});
console.log(`${result.reused?'Reused verified':'Built'} worker dependency artifact: ${output}${overlay?` (server-side patches ${overlay.patches.map(row=>row.patch).join(', ')})`:''}`);
