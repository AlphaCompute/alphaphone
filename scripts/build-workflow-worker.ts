#!/usr/bin/env bun
/** Product preparation/provenance wrapper. Runtime owns bundling and compiler resources. */
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {preparedSourceEnv,sourceDirectory,workerArtifactDirectory} from './local-agent-source.mjs';
import {ensurePreparedWorkflowWorker} from './prepared-workflow-worker.mjs';
// The producer runs in this process; drop agent-detection variables before it can
// start turbo in the prepared source (see preparedSourceEnv).
const env=preparedSourceEnv(process.env);
for(const name of Object.keys(process.env))if(!(name in env))delete process.env[name];
const root=resolve(import.meta.dir,'..'),source=sourceDirectory(root),output=workerArtifactDirectory(root);
execFileSync(process.env.ALPHA_NODE||'node',[join(root,'scripts/prepare-local-agent.mjs'),'--source-only'],{cwd:root,stdio:'inherit'});
const result=await ensurePreparedWorkflowWorker(root,source,output);
console.log(`${result.reused?'Reused verified':'Built'} worker dependency artifact: ${output}`);
