import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const source=stripTypeScriptTypes(fs.readFileSync('apps/app/src/prototype/workflow-authoring.ts','utf8').replace(/^import .*;\n/gm,'').replace('export function','function'),{mode:'transform'});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
async function harness(){
 const records=new Map(),gate=deferred(),entered=deferred();let held=false,fail=false;
 let session={origin:'owned-origin',ownerId:'owner-a',agentId:'agent-a'},binding={sessionId:'session-a',client:{async phoneCatalog(){return {palette:[],triggers:[]};}}};
 const storage={async secureRead({slot}){return {value:records.get(slot)??null};},async secureCompareExchange(input){if(held){entered.resolve();await gate.promise;}if(fail)throw Error('Synthetic write unavailable');if((records.get(input.slot)??null)!==input.expectedValue)return {status:'conflict'};records.set(input.slot,input.value);return {status:'saved'};}};
 const ctx=vm.createContext({AbortController,TextEncoder,document:{hidden:false},browserLocalAgentEnabled:true,browserDevProfile:false,developmentWorkflowDraftStore:storage,registerPlugin:()=>({}),workflowSha:async values=>JSON.stringify(values),connectionController:{getWorkflowClient:()=>binding,getSnapshot:()=>({session,open:false})},WORKFLOW_OPERATION_LABELS:{}});
 vm.runInContext(source+';globalThis.create=createWorkflowAuthoring',ctx);
 const authoring=ctx.create(()=>({toast(){}}),()=>{},async()=>{}),api={ic:{},get:()=>({})};
 await authoring.open();for(let i=0;i<5;i++)await Promise.resolve();
 return {authoring,render:()=>authoring.render(api),records,
  async editHeld(name){held=true;authoring.render(api).onName({target:{value:name}});await entered.promise;},
  release(){held=false;gate.resolve();},failWrite(){fail=true;},
  changeOwner(){session={origin:'other-origin',ownerId:'owner-b',agentId:'agent-b'};binding={...binding,sessionId:'session-b'};},
 };
}
test('closing and reopening waits for the prior draft commit and restores the latest unsent name',async()=>{
 const h=await harness();await h.editHeld('Latest owned unsent name');h.authoring.close();
 const reopening=h.authoring.open();for(let i=0;i<5;i++)await Promise.resolve();h.release();await reopening;
 assert.equal(h.render().name,'Latest owned unsent name');
 assert.equal(h.records.size,1,'only the original private draft slot was used');h.authoring.close();
});
test('cancelling a reopen while the prior save is held cannot reopen or publish the draft later',async()=>{
 const h=await harness();await h.editHeld('Owned retained name');h.authoring.close();
 const reopening=h.authoring.open();for(let i=0;i<5;i++)await Promise.resolve();h.authoring.close();h.release();await reopening;
 assert.equal(h.authoring.active,false);await h.authoring.open();assert.equal(h.render().name,'Owned retained name');h.authoring.close();
});
test('reopening under another owner never carries the earlier owner’s pending draft',async()=>{
 const h=await harness();await h.editHeld('Owner A private draft');h.authoring.close();h.changeOwner();
 const reopening=h.authoring.open();for(let i=0;i<5;i++)await Promise.resolve();h.release();await reopening;
 assert.equal(h.render().name,'New workflow');for(let i=0;i<5;i++)await Promise.resolve();
 assert.equal(h.records.size,2);assert.ok([...h.records.values()].some(raw=>JSON.parse(raw).spec.name==='Owner A private draft'));h.authoring.close();
});

test('a second reopen after cancellation still waits for the original held commit',async()=>{const h=await harness();await h.editHeld('Newest held name');h.authoring.close();const first=h.authoring.open();for(let i=0;i<5;i++)await Promise.resolve();h.authoring.close();const second=h.authoring.open();for(let i=0;i<5;i++)await Promise.resolve();h.release();await Promise.all([first,second]);assert.equal(h.render().name,'Newest held name');h.authoring.close();});

test('failed pending persistence preserves latest unsent draft instead of restoring older bytes',async()=>{const h=await harness();await h.editHeld('Latest unsaved name');h.authoring.close();const opening=h.authoring.open();h.failWrite();h.release();await opening;assert.equal(h.render().name,'Latest unsaved name');assert.match(h.render().typedStatus,/failed|retained/);h.authoring.close();});
