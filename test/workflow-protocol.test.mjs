import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';
// Bundle the real protocol module; only the browser dev-profile switch is replaced so Node can load it.
const bundle=await build({entryPoints:['apps/app/src/runtime/workflow-protocol.ts'],bundle:true,write:false,format:'esm',platform:'neutral',logLevel:'silent',plugins:[{name:'node-shims',setup(b){b.onResolve({filter:/browser\/dev-profile$/},()=>({path:'dev-profile',namespace:'shim'}));b.onLoad({filter:/.*/,namespace:'shim'},()=>({contents:'export const browserDevProfile=false;export const developmentAgentWorkflows=false;',loader:'js'}));}}]});
const {WorkflowProtocol}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const signal=new AbortController().signal;
const execution=(extra={})=>({id:'run-1',workflowId:'flow-1',workflowVersionId:'v1',status:'running',startedAt:'2026-10-04T10:00:00Z',finished:false,events:[],...extra});
const receipt=async(value)=>new WorkflowProtocol(async path=>{assert.equal(path,'/api/workflow/executions/run-1');return {execution:value};}).receipt('run-1','flow-1',signal);

test('outcome-unknown and worker-running reconciliation survive parsing without inventing a result',async()=>{
 const unknown=await receipt(execution({stoppedAt:null,error:{message:'Worker exited; outcome unknown'},reconciliation:{state:'outcome-unknown',message:'Worker exited; outcome unknown'}}));
 assert.deepEqual(unknown.reconciliation,{state:'outcome-unknown',message:'Worker exited; outcome unknown'});
 assert.equal(unknown.finished,false);assert.equal(unknown.output,undefined);assert.equal(unknown.stoppedAt,undefined);
 const running=await receipt(execution({reconciliation:{state:'worker-running',message:'Worker still running'}}));
 assert.deepEqual(running.reconciliation,{state:'worker-running',message:'Worker still running'});assert.equal(running.finished,false);
 const plain=await receipt(execution());assert.equal('reconciliation' in plain,false);
 const nulled=await receipt(execution({reconciliation:null}));assert.equal('reconciliation' in nulled,false);
 const cancelled=await receipt(execution({status:'cancelled',finished:true,reconciliation:{state:'outcome-unknown',message:'x'}}));
 assert.equal(cancelled.finished,true);assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.reconciliation.state,'outcome-unknown','history keeps that the earlier outcome was unknown');
 const long=await receipt(execution({reconciliation:{state:'outcome-unknown',message:'m'.repeat(5000)}}));assert.equal(long.reconciliation.message.length,2000);
});

test('malformed reconciliation is rejected rather than shown as a known state',async()=>{
 for(const reconciliation of [{state:'replayed',message:'x'},{state:'outcome-unknown'},{state:'outcome-unknown',message:7},'outcome-unknown',[]])
  await assert.rejects(receipt(execution({reconciliation})),/reconciliation/);
});

test('execution history keeps per-run reconciliation and identity checks',async()=>{
 const client=new WorkflowProtocol(async()=>({executions:[execution({reconciliation:{state:'outcome-unknown',message:'lost'}}),execution({id:'run-2',status:'finished',finished:true})]}));
 const runs=await client.executions('flow-1',signal);assert.deepEqual(runs.map(r=>r.reconciliation?.state??null),['outcome-unknown',null]);
 const other=new WorkflowProtocol(async()=>({executions:[execution({workflowId:'flow-2'})]}));await assert.rejects(other.executions('flow-1',signal),/identity/);
});

test('hosted digests and typed phone specs are identified from workflow metadata',async()=>{
 const flow=metadata=>new WorkflowProtocol(async()=>({id:'flow-1',name:'Flow',active:false,versionId:'v1',steps:[],metadata})).detail('flow-1',signal);
 const typed=await flow({elizaPhoneWorkflowSpec:JSON.stringify({version:1,trigger:{kind:'manual'},steps:[{id:'s',operation:'selected_notes'}]})});
 assert.deepEqual(typed.phoneSpec.steps.map(s=>s.operation),['selected_notes']);assert.equal(typed.hostedDigest,undefined);
 const hosted=await flow({elizaHostedDigestV1:JSON.stringify({version:1})});assert.equal(hosted.hostedDigest,true);
 assert.equal((await flow(undefined)).hostedDigest,undefined);
});
