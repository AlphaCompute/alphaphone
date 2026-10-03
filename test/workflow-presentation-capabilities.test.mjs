import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const source=stripTypeScriptTypes(fs.readFileSync('apps/app/src/runtime/workflow-presentation.ts','utf8').replace(/^import .*;\n/m,'').replace('export async function','async function'));
function fixture(native,probe){let calls=0;const box={Capacitor:{isNativePlatform:()=>native},registerPlugin:name=>({workflowPresentationCapabilities:()=>{calls++;return probe(name);}}),setTimeout:(cb,ms)=>setTimeout(cb,Math.min(ms,20)),clearTimeout};vm.runInNewContext(source+'\nglobalThis.run=workflowPresentationProtocol;',box);return {run:box.run,calls:()=>calls};}
test('browser presentation needs no native bridge',async()=>{const f=fixture(false,()=>{throw Error();});assert.equal(await f.run(new AbortController().signal),2);assert.equal(f.calls(),0);});
test('both installed bridges must explicitly support protocol 2',async()=>{for(const result of [undefined,{}, {protocol:1},{protocol:'2'},{protocol:3},null]){const f=fixture(true,name=>Promise.resolve(name==='AlphaNotifications'?{protocol:2}:result));assert.equal(await f.run(new AbortController().signal),1);}const f=fixture(true,()=>Promise.resolve({protocol:2}));assert.equal(await f.run(new AbortController().signal),2);assert.equal(f.calls(),2);});
test('old missing and hung bridges fall back without granting presentation',async()=>{for(const probe of [()=>{throw Error('unimplemented');},()=>Promise.reject(Error('unavailable')),()=>new Promise(()=>{})])assert.equal(await fixture(true,probe).run(new AbortController().signal),1);});
test('cancelled negotiation never grants a late capability result',async()=>{let release;const f=fixture(true,()=>new Promise(r=>release=r)),controller=new AbortController();const pending=f.run(controller.signal);controller.abort();await assert.rejects(pending);release({protocol:2});await assert.rejects(f.run(controller.signal));});
