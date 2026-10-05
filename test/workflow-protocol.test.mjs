import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';
// Bundle the real protocol module; only the browser dev-profile switch is replaced so Node can load it.
const bundle=await build({entryPoints:['apps/app/src/runtime/workflow-protocol.ts'],bundle:true,write:false,format:'esm',platform:'neutral',logLevel:'silent',plugins:[{name:'node-shims',setup(b){b.onResolve({filter:/browser\/dev-profile$/},()=>({path:'dev-profile',namespace:'shim'}));b.onLoad({filter:/.*/,namespace:'shim'},()=>({contents:'export const browserDevProfile=false;export const developmentAgentWorkflows=false;',loader:'js'}));}}]});
const {WorkflowProtocol,runOutcomeUnknown,runWorkerRunning,readOnlyDigestWorkflow}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const signal=new AbortController().signal;
const execution=(extra={})=>({id:'run-1',workflowId:'flow-1',workflowVersionId:'v1',status:'running',startedAt:'2026-10-04T10:00:00Z',finished:false,events:[],...extra});
const receipt=async(value)=>new WorkflowProtocol(async path=>{assert.equal(path,'/api/workflow/executions/run-1');return {execution:value};}).receipt('run-1','flow-1',signal);

test('outcome-unknown and worker-running reconciliation survive parsing without inventing a result',async()=>{
 const unknown=await receipt(execution({stoppedAt:null,error:{message:'Worker exited; outcome unknown'},reconciliation:{state:'outcome-unknown',message:'Worker exited; outcome unknown'}}));
 assert.deepEqual(unknown.reconciliation,{state:'outcome-unknown',message:'Worker exited; outcome unknown'});
 assert.equal(unknown.finished,false);assert.equal(unknown.output,undefined);assert.equal(runOutcomeUnknown(unknown),true);assert.equal(runWorkerRunning(unknown),false);
 const running=await receipt(execution({reconciliation:{state:'worker-running',message:'Worker still running'}}));
 assert.equal(running.reconciliation.state,'worker-running');assert.equal(runWorkerRunning(running),true);assert.equal(runOutcomeUnknown(running),false);
 const plain=await receipt(execution());assert.equal('reconciliation' in plain,false);assert.equal(runOutcomeUnknown(plain),false);
 const nulled=await receipt(execution({reconciliation:null}));assert.equal('reconciliation' in nulled,false);
 const cancelled=await receipt(execution({status:'cancelled',finished:true,reconciliation:{state:'outcome-unknown',message:'x'}}));
 assert.equal(runOutcomeUnknown(cancelled),false,'an explicitly cancelled run is no longer unresolved');
 const long=await receipt(execution({reconciliation:{state:'outcome-unknown',message:'m'.repeat(5000)}}));assert.equal(long.reconciliation.message.length,2000);
});

test('malformed reconciliation is rejected rather than shown as a known state',async()=>{
 for(const reconciliation of [{state:'replayed',message:'x'},{state:'outcome-unknown'},{state:'outcome-unknown',message:7},'outcome-unknown',[]])
  await assert.rejects(receipt(execution({reconciliation})),/reconciliation/);
});

test('execution history keeps per-run reconciliation and identity checks',async()=>{
 const client=new WorkflowProtocol(async()=>({executions:[execution({reconciliation:{state:'outcome-unknown',message:'lost'}}),execution({id:'run-2',status:'finished',finished:true})]}));
 const runs=await client.executions('flow-1',signal);assert.deepEqual(runs.map(runOutcomeUnknown),[true,false]);
 const other=new WorkflowProtocol(async()=>({executions:[execution({workflowId:'flow-2'})]}));await assert.rejects(other.executions('flow-1',signal),/identity/);
});

test('only manual typed workflows whose steps read or draft text are read-only digests',async()=>{
 const flow=(spec,metadata={})=>new WorkflowProtocol(async()=>({id:'flow-1',name:'Flow',active:false,versionId:'v1',steps:[],metadata:{...(spec?{elizaPhoneWorkflowSpec:JSON.stringify(spec)}:{}),...metadata}})).detail('flow-1',signal);
 const spec=(...operations)=>({version:1,trigger:{kind:'manual'},steps:operations.map((operation,i)=>({id:'s'+i,operation}))});
 assert.equal(readOnlyDigestWorkflow(await flow(spec('selected_notes','calendar_range','model_draft','compose_draft','contains','supplied_text'))),true);
 for(const effect of ['save_note','app_notification','read_aloud','unknown_future_op'])assert.equal(readOnlyDigestWorkflow(await flow(spec('selected_notes',effect))),false,effect);
 assert.equal(readOnlyDigestWorkflow(await flow(spec())),false);
 assert.equal(readOnlyDigestWorkflow(await flow({...spec('selected_notes'),trigger:{kind:'schedule'}})),false);
 assert.equal(readOnlyDigestWorkflow(await flow(undefined)),false,'agent-authored workflows without a typed spec are never assumed read-only');
 const hosted=await flow(spec('model_draft'),{elizaHostedDigestV1:JSON.stringify({version:1})});
 assert.equal(hosted.hostedDigest,true);assert.equal(readOnlyDigestWorkflow(hosted),false,'hosted digests run only at their scheduled occurrence upstream');
 assert.equal(readOnlyDigestWorkflow({...(await flow(spec('model_draft'))),removed:true}),false);
});
