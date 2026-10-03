#!/usr/bin/env bun
/** Product preparation/provenance wrapper. Runtime owns bundling and compiler resources. */
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {sourceDirectory,workerArtifactDirectory} from './local-agent-source.mjs';
import {buildPreparedWorkflowWorker} from './prepared-workflow-worker.mjs';
const root=resolve(import.meta.dir,'..'),source=sourceDirectory(root),output=workerArtifactDirectory(root);
execFileSync(process.env.ALPHA_NODE||'node',[join(root,'scripts/prepare-local-agent.mjs'),'--source-only'],{cwd:root,stdio:'inherit'});
await buildPreparedWorkflowWorker(root,source,output);
console.log(`Worker dependency artifact: ${output}`);
