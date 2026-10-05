import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifyCommittedWorkspace} from '../vendor/eliza/packages/app/scripts/lib/immutable-workspace-source.mjs';
const present=file=>{try{fs.lstatSync(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
export const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function admittedCommit(root) {
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'upstream.lock.json'),'utf8'));
 if(!/^[a-f0-9]{40}$/.test(manifest.commit))throw Error('Exact admitted runtime commit required for default artifact selection');
 return manifest.commit;
}
// Stable defaults derive from the admitted commit; old physical trees are never relabeled.
export function workerArtifactDirectory(root, env=process.env) {
 const supplied=env.ALPHA_WORKFLOW_WORKER_OUTPUT;
 const directory=supplied?path.resolve(root,supplied):path.join(root,'artifacts',`mobile-workflow-worker-${admittedCommit(root)}`);
 const output=sourceDirectory(root,{ALPHA_LOCAL_AGENT_SOURCE_DIR:directory});
 assertWorkerOutputSeparation(sourceDirectory(root,env),output);
 return output;
}
// Reject before importing/invoking any producer, including historical admitted roots.
export function assertWorkerOutputSeparation(source,output) {
 const relative=path.relative(source,output);
 if(!relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw Error('Worker output must not be inside active prepared source');
 for(let current=output;;current=path.dirname(current)){
  if(present(path.join(current,'.alpha-runtime-source.json')))throw Error('Worker output must not be inside a prepared source tree');
  if(current===path.dirname(current))break;
 }
}
// Turborepo maintains a managed block in the repository-root AGENTS.md whenever it
// detects an AI coding agent, which would modify the immutable prepared checkout.
// Its documented opt-out (`"agentGuidance": false`) lives in the upstream turbo.json,
// which this product never edits, so children in the prepared source run without
// the variables turbo 2.11 detects (each one verified to trigger the update).
export const TURBO_AGENT_DETECTION_ENV=Object.freeze(['AI_AGENT','AUGMENT_AGENT','CLAUDECODE','CLAUDE_CODE','CODEX_SANDBOX','CURSOR_AGENT','CURSOR_TRACE_ID','GEMINI_CLI','OPENCODE','OPENCODE_CLIENT','REPL_ID']);
export function preparedSourceEnv(env=process.env, extra={}) {
 const result={...env,...extra};
 for(const name of TURBO_AGENT_DETECTION_ENV)delete result[name];
 return result;
}
export function sourceDirectory(root, env=process.env) {
 const supplied=env.ALPHA_LOCAL_AGENT_SOURCE_DIR;
 if(supplied&&!path.isAbsolute(supplied))throw Error('ALPHA_LOCAL_AGENT_SOURCE_DIR must be absolute');
 const directory=supplied||path.join(root,'artifacts',`local-agent-resident-${admittedCommit(root)}`);
 const relative=path.relative(path.join(root,'artifacts'),directory);
 if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Prepared runtime must be a child of product artifacts');
 for(let current=directory;current!==path.dirname(current);current=path.dirname(current)){
  let stat;try{stat=fs.lstatSync(current);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(stat?.isSymbolicLink())throw Error('Prepared runtime path must not contain symlinks');
 }
 return directory;
}
export function verifySource(directory, commit) {
 return verifyCommittedWorkspace(directory, commit, {
  generatedFiles: ['.alpha-runtime-source.json', '.alpha-stage-runtime.ts'],
  generatedDirectories: ['packages/agent/dist-mobile'],
 });
}
