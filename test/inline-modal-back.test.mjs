import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
function fixture(mode){
 const source=fs.readFileSync('apps/app/src/prototype/agent-adapter.ts','utf8'),start=source.indexOf('    this.backHandler ='),end=source.indexOf('    this.homeHandler =',start),window=new EventTarget(),f={shellBack:0,cancelled:0,modalBack:0,nativeClose:0};
 const modal={closest:()=>mode==='inert'?{}:null,getAttribute:()=>mode==='aria-hidden'?'true':null,getClientRects:()=>mode==='no-rects'?[]:[{}]};
 const native=new EventTarget();native.close=()=>f.nativeClose++;
 const document={querySelector:selector=>selector==='dialog[open]'&&mode==='native'?native:null,querySelectorAll:selector=>{if(selector==='dialog[open]')return mode==='native'?[native]:[];assert.ok(selector.startsWith('.os '));return mode==='none'?[]:[modal];}};
 const shell={back(){f.shellBack++;}},box={window,document,Event,getComputedStyle:()=>({visibility:mode==='hidden'?'hidden':'visible'}),connectionController:{cancelViewNavigation(){f.cancelled++;}},alphaClient:{cancel(){f.cancelled++;}}};
 vm.runInNewContext(stripTypeScriptTypes('(function(){'+source.slice(start,end)+'}).call(shell);',{mode:'transform'}),{...box,shell});
 // A window-targeted native event reaches the existing shell handler before
 // the subsequently registered inline owner on this target.
 window.addEventListener('alpha-back',event=>{if(mode==='visible'){f.modalBack++;event.preventDefault();event.stopImmediatePropagation();}});
 f.run=()=>window.dispatchEvent(new Event('alpha-back',{cancelable:true}));return f;
}
test('visible own inline modal retains native Back for its owner without cancelling or navigating the shell',()=>{const f=fixture('visible');f.run();assert.equal(f.modalBack,1);assert.equal(f.shellBack,0);assert.equal(f.cancelled,0);});
for(const mode of ['none','inert','hidden','aria-hidden','no-rects'])test(`${mode} inline modal cannot steal ordinary shell Back`,()=>{const f=fixture(mode);f.run();assert.equal(f.shellBack,1);assert.equal(f.cancelled,2);assert.equal(f.modalBack,0);});
test('top native HTML dialog still owns Back ahead of an inline modal',()=>{const f=fixture('native');f.run();assert.equal(f.nativeClose,1);assert.equal(f.shellBack,0);assert.equal(f.modalBack,0);});
