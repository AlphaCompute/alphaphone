import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
// Execute the real operation boundary; infrastructure state is injected, no network/storage/media.
const source=await readFile(new URL('../apps/app/src/runtime/connection-ui.tsx',import.meta.url),'utf8');
const begin=source.indexOf('async function work('),end=source.indexOf('\nfunction activate(',begin);
assert.ok(begin>=0&&end>begin);
const code=stripTypeScriptTypes(source.slice(begin,end),{mode:'transform'});
function fixture(){
 const state={open:false,busy:false,purpose:'agent',message:'',error:''},updates=[];
 const context=vm.createContext({AbortController,state,operation:null,active:null,cloud:{},expired:()=>false,errorMessage:e=>e.message,update:next=>{Object.assign(state,next);updates.push({...state});}});
 vm.runInContext(code,context);return {state,updates,context,run:(...args)=>context.work(...args)};
}
test('background account restore never opens the chooser and clears its loading status',async()=>{
 const f=fixture();let finish;const pending=f.run('Checking your Cloud account…',()=>new Promise(resolve=>finish=resolve),false);
 assert.equal(f.state.busy,true);assert.equal(f.state.open,false);finish();await pending;
 assert.equal(f.state.busy,false);assert.equal(f.state.open,false);assert.equal(f.state.message,'');assert.equal(f.state.error,'');assert.ok(f.updates.every(row=>!row.open));
});
test('failed background restore opens compact Cloud account recovery',async()=>{
 const f=fixture();await f.run('Checking your Cloud account…',async()=>{throw Error('Account temporarily unavailable');},false);
 assert.equal(f.state.open,true);assert.equal(f.state.purpose,'cloud-account');assert.equal(f.state.error,'Account temporarily unavailable');assert.equal(f.state.busy,false);
});
test('explicitly opened settings remain open when background restore finishes',async()=>{
 const f=fixture();let finish;const pending=f.run('Checking your Cloud account…',()=>new Promise(resolve=>finish=resolve),false);f.state.open=true;f.state.purpose='cloud-account';finish();await pending;
 assert.equal(f.state.open,true);assert.equal(f.state.purpose,'cloud-account');assert.equal(f.state.busy,false);
});
test('cancelled background restore does not reopen a dismissed panel',async()=>{
 const f=fixture();await f.run('Checking your Cloud account…',async signal=>{f.context.operation.abort();signal.throwIfAborted();},false);
 assert.equal(f.state.open,false);assert.equal(f.state.error,'');assert.equal(f.state.busy,false);
});
test('explicit connection operations retain their visible dialog',async()=>{
 const f=fixture();await f.run('Signing in…',async()=>{});assert.equal(f.state.open,true);assert.equal(f.state.purpose,'agent');assert.equal(f.state.busy,false);
});
