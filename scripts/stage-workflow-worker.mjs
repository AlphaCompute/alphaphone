import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {sourceDirectory} from './local-agent-source.mjs';
import {stageWorkerArtifact,workerHash} from './workflow-worker-artifact.mjs';
const root=resolve(import.meta.dirname,'..'),source=sourceDirectory(root);
execFileSync(process.execPath,[join(root,'scripts/prepare-local-agent.mjs'),'--source-only'],{cwd:root,stdio:'inherit'});
const artifact=resolve(process.env.ALPHA_WORKFLOW_WORKER_OUTPUT||join(root,'artifacts/mobile-workflow-worker'));
const result=stageWorkerArtifact(artifact,join(root,'android/app/src/main/assets/agent/workflow-worker'),{
 sourceStampSha256:workerHash(readFileSync(join(source,'.alpha-runtime-source.json'))),
 lockSha256:workerHash(readFileSync(join(source,'bun.lock'))),
});
console.log(JSON.stringify({stagedWorker:result,androidExecution:false}));
