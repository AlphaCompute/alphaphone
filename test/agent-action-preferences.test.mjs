import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const src=readFileSync('apps/app/src/runtime/device-actions.ts','utf8');
const start=src.indexOf('  async performRequested('),end=src.indexOf('  /** Notice restoration',start);
const method=stripTypeScriptTypes('class Fixture {'+src.slice(start,end)+'}',{mode:'transform'})+'; globalThis.Fixture=Fixture;';
const context=vm.createContext({});vm.runInContext(method,context);
function fixture(rows,status='succeeded'){const f=new context.Fixture();f.proposals=new Map(rows.map(([id,source,workflow])=>[id,{proposal:{requestMessageId:source,workflow}}]));f.calls=[];f.approve=async id=>{f.calls.push(id);return {proposalId:id,status,summary:'Test result'};};return f;}
test('only current-request proposals execute; old, unbound and workflow stay pending',async()=>{const f=fixture([['old','previous'],['unbound',undefined],['current','request'],['workflow','request',{}]]);await f.performRequested('request',{},new AbortController().signal,async()=>true);assert.deepEqual(f.calls,['current']);});
test('ask-first preference executes nothing',async()=>{const f=fixture([['current','request']]);await f.performRequested('request',{},new AbortController().signal,async()=>false);assert.deepEqual(f.calls,[]);});
test('preference is rechecked before each action',async()=>{const f=fixture([['one','request'],['two','request']]);let n=0;await f.performRequested('request',{},new AbortController().signal,async()=>++n===1);assert.deepEqual(f.calls,['one']);});
test('uncertain outcome stops the batch without retrying',async()=>{const f=fixture([['one','request'],['two','request']],'unknown');await f.performRequested('request',{},new AbortController().signal,async()=>true);assert.deepEqual(f.calls,['one']);});
test('cancelled request dispatches nothing',async()=>{const f=fixture([['one','request']]);const c=new AbortController();c.abort();await assert.rejects(f.performRequested('request',{},c.signal,async()=>true));assert.deepEqual(f.calls,[]);});
test('action preference defaults to direct requests and persists old preferences compatibly',()=>{const source=readFileSync('apps/app/src/browser/device-preferences.ts','utf8');const first=source.slice(source.indexOf('export const initialDevicePreferences'),source.indexOf('let cached:')).replace(/export /g,'');const stripped=stripTypeScriptTypes(first,{mode:'transform'});const c=vm.createContext({});vm.runInContext(stripped+';globalThis.initial=initialDevicePreferences;globalThis.validatePreferences=validate;',c);assert.equal(c.initial().askBeforeAgentActions,false);assert.equal(c.validatePreferences({}).askBeforeAgentActions,false);assert.equal(c.validatePreferences({askBeforeAgentActions:true}).askBeforeAgentActions,true);assert.throws(()=>c.validatePreferences({askBeforeAgentActions:'yes'}));});

test('Home native destinations remain discoverable before optional domain plugins load',()=>{const rows=JSON.parse(readFileSync('config/native-view-declarations.json','utf8'));for(const id of ['camera','maps','photos','notes','calendar','inbox']){const row=rows.find(row=>row.id===id);assert.equal(row.path,'/'+id);assert.ok(row.fallbackFor);assert.equal(row.capabilities,undefined,'Navigation declaration must not invent device capabilities');}assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);});
