/** Explicit disposable local arithmetic-only Smithers execution. No agents/tools/network inside workflow. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
if(!process.execArgv.includes('tsx'))process.exit(spawnSync(process.execPath,['--import','tsx',process.argv[1]],{stdio:'inherit',env:process.env}).status??1);
const {WorkflowProtocol}=await import('../apps/app/src/runtime/workflow-protocol.ts');
const origin=process.env.ALPHA_WORKFLOW_ORIGIN||'http://127.0.0.1:47840';
const host=new URL(origin);
if(host.protocol!=='http:'||host.hostname!=='127.0.0.1'||host.origin!==origin)throw Error('Workflow fixture requires an exact loopback HTTP origin');
const file=process.env.ALPHA_DEVICE_SESSION_FILE;if(!file||(await fs.stat(file)).mode&0o077)throw Error('Owner-only local fixture session required');const {token}=JSON.parse(await fs.readFile(file,'utf8'));
const request=async(path,body,signal)=>{const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'X-Forwarded-For':'192.0.2.1','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal});if(!r.ok)throw Error(`Workflow fixture HTTP ${r.status}`);return r.json();};
const client=new WorkflowProtocol(request),signal=()=>AbortSignal.timeout(120000);
const source=`/** @jsxImportSource smthrs */
import {createSmithers} from "smthrs/create";
import {z} from "zod";
const {Workflow,Task,smithers,outputs}=createSmithers({answer:z.object({value:z.number()})},{dbPath:process.env.ELIZA_SMTHRS_DB_PATH});
export default smithers(()=><Workflow name="alpha-arithmetic"><Task id="answer" output={outputs.answer}>{{value:7*8}}</Task></Workflow>);`;
let workflowId,runId;
try{const created=await request('/api/workflow/workflows',{workflow:{name:'Alpha disposable arithmetic fixture '+Date.now(),description:'Only computes 7 × 8. No tools, agents, communications or private inputs.',source,language:'tsx',steps:[{id:'answer',label:'Compute 7 × 8',kind:'task'}]},activate:false},signal());workflowId=created.id;assert.equal(created.active,false);const flow=await client.detail(workflowId,signal());const run=await client.run(flow.id,flow.versionId,signal());runId=run.id;let receipt=run;for(let i=0;i<30&&!receipt.finished;i++){await new Promise(r=>setTimeout(r,1000));receipt=await client.receipt(runId,workflowId,signal());}assert.equal(receipt.status,'finished');await client.pause(workflowId,signal());console.log(JSON.stringify({passed:true,workflowId,runId,status:receipt.status,scope:'Actual local Smithers arithmetic execution; not phone triggers or provider workflows'}));}catch(e){console.log(JSON.stringify({passed:false,workflowId,runId,error:e instanceof Error?e.message:'failed'}));process.exitCode=1;}
