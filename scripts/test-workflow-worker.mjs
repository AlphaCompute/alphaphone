import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,cpSync,rmSync,readdirSync,lstatSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const artifact=resolve(process.env.ALPHA_WORKFLOW_WORKER_OUTPUT||'artifacts/mobile-workflow-worker');
const manifest=JSON.parse(readFileSync(join(artifact,'manifest.json'),'utf8'));
assert.equal(manifest.version,1);
const seen=new Set();function verify(dir){for(const name of readdirSync(dir)){const file=join(dir,name),stat=lstatSync(file);assert.ok(!stat.isSymbolicLink(),'Artifact must not depend on external symlinks');if(stat.isDirectory())verify(file);else{assert.ok(stat.isFile(),'Only regular artifact files are supported');const rel=relative(artifact,file);if(rel==='manifest.json')continue;assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),manifest.files[rel],rel);seen.add(rel);}}}verify(artifact);assert.equal(seen.size,Object.keys(manifest.files).length);
const dependencies=JSON.parse(readFileSync(join(artifact,'dependencies.json'),'utf8'));
for(const name of ['smthrs','@smthrs/engine','effect','zod','react','drizzle-orm'])assert.ok(dependencies.some(pkg=>pkg.name===name&&typeof pkg.version==='string'),`Missing provenance for ${name}`);
const temporary=mkdtempSync(join(tmpdir(),'alpha-workflow-worker-'));
try {
 cpSync(artifact,temporary,{recursive:true});
 writeFileSync(join(temporary,'workflow.tsx'),`/** @jsxImportSource smthrs */
import {createSmithers} from 'smthrs/create';
import {z} from 'zod';
import {appendFileSync} from 'node:fs';
const {Workflow,Task,smithers,outputs}=createSmithers({output:z.object({text:z.string()})},{dbPath:process.env.ELIZA_SMTHRS_DB_PATH});
export default smithers(()=><Workflow name="isolated-phone-worker"><Task id="supplied-text" output={outputs.output} noRetry>{async()=>{appendFileSync('executions.txt','ran\\n');return {text:'Synthetic reviewed task completed'};}}</Task></Workflow>);
`);
 writeFileSync(join(temporary,'verify.ts'),`import {Effect} from 'effect';
import {runWorkflow,approveNode,denyNode,signalRun} from 'smthrs';
import {cancelRunSubtree} from '@smthrs/engine/cancel-subtree';
import {openSmithersStore} from 'smthrs/openSmithersStore';
import workflow from './workflow.tsx';
if([approveNode,denyNode,signalRun,cancelRunSubtree,openSmithersStore].some(value=>typeof value!=='function'))throw Error('Missing control export');
const result=await Effect.runPromise(runWorkflow(workflow,{runId:process.env.RUN_ID,input:{},workflowPath:process.cwd()+'/workflow.tsx',rootDir:process.cwd(),onProgress:()=>{}}));
console.log('ALPHA_WORKER_RESULT '+JSON.stringify(result));process.exit(result.status==='finished'?0:1);
`);
 const runId=randomUUID();
 const env={PATH:process.env.PATH,HOME:temporary,TMPDIR:temporary,RUN_ID:runId,ELIZA_SMTHRS_DB_PATH:join(temporary,'runs.sqlite'),MSGPACKR_NATIVE_ACCELERATION_DISABLED:'true'};
 const invoke=()=>{const stdout=execFileSync(process.env.ALPHA_BUN||'bun',['--no-install','verify.ts'],{cwd:temporary,env,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});const line=stdout.split('\n').find(line=>line.startsWith('ALPHA_WORKER_RESULT '));assert.ok(line,'Missing terminal result');return JSON.parse(line.slice('ALPHA_WORKER_RESULT '.length));};
 const first=invoke(),second=invoke();
 assert.equal(first.status,'finished');assert.equal(second.status,'finished');
 assert.equal(readFileSync(join(temporary,'executions.txt'),'utf8'),'ran\n');
 console.log(JSON.stringify({artifact,files:seen.size,isolatedDirectory:true,completedRuns:2,taskExecutions:1,nativeAcceptance:false}));
} finally {rmSync(temporary,{recursive:true,force:true});}
