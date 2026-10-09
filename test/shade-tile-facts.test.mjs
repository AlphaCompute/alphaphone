import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
// The dependency-free tile region of the native adapter, evaluated without the renderer.
const source=readFileSync('apps/app/src/prototype/native-adapter.ts','utf8');
const region=source.slice(source.indexOf('// tile-facts:begin'),source.indexOf('// tile-facts:end'));
assert.ok(region.length>100,'tile-facts region is present');
const m=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(region,{mode:'transform'})).toString('base64'));
const labels=['Wi-Fi','Bluetooth','Do not disturb','Agent can listen','Location','Airplane mode','Enclave lock','Flashlight'];
// Model tiles may carry stale prototype state; only native facts may become on/off.
const modelTiles=()=>labels.map(label=>({label,on:true,css:'background:var(--acc);color:#fff',toggle:()=>{}}));
test('no tile shows on or off without a native fact',()=>{
 for(const snapshot of [null,{},{wifiActive:false},{wifiActive:'true'},{permissions:{Microphone:true,Location:true},locationAccess:'precise',bluetooth:true}]){
  const tiles=m.honestTiles(modelTiles(),m.tileFactsFromSnapshot(snapshot),{flashlight:true,act:()=>{}});
  for(const tile of tiles){assert.equal(tile.on,undefined,`${tile.label} has no native fact for ${JSON.stringify(snapshot)}`);assert.doesNotMatch(tile.css,/--acc/);}
 }
});
test('an active Wi-Fi transport is the only snapshot fact; it never reports off',()=>{
 assert.deepEqual(m.tileFactsFromSnapshot({wifiActive:true,cellularActive:true}),{wifi:true});
 assert.deepEqual(m.tileFactsFromSnapshot({wifiActive:false}),{});
 const tiles=m.honestTiles(modelTiles(),m.tileFactsFromSnapshot({wifiActive:true}),{flashlight:true,act:()=>{}});
 assert.deepEqual(tiles.filter(t=>t.on!==undefined).map(t=>[t.label,t.on]),[['Wi-Fi',true]]);
});
test('the flashlight shows only its confirmed native result and is hidden without a control',()=>{
 assert.deepEqual(m.honestTiles(modelTiles(),m.tileFactsFromSnapshot(null,false),{flashlight:true,act:()=>{}}).find(t=>t.label==='Flashlight').on,false);
 assert.equal(m.honestTiles(modelTiles(),{},{flashlight:true,act:()=>{}}).find(t=>t.label==='Flashlight').on,undefined);
 assert.equal(m.honestTiles(modelTiles(),{torch:true},{flashlight:false,act:()=>{}}).some(t=>t.label==='Flashlight'),false);
});
test('each tile hands off to its own settings page',()=>{
 const calls=[];const tiles=m.honestTiles(modelTiles(),{},{flashlight:true,act:(key)=>calls.push(key)});
 for(const tile of tiles)tile.toggle();
 assert.deepEqual(calls,['wifi','bt','dnd','mic','loc','plane',null,'torch']);
 assert.deepEqual([m.tileSettingsPages.wifi,m.tileSettingsPages.bt,m.tileSettingsPages.dnd],['wifi','bluetooth','dnd']);
 assert.equal(m.tileSettingsPages.torch,undefined);
});
test('a brightness change triggers at most one settings handoff',()=>{
 let now=1000;const gate=m.handoffGate(2000,()=>now);let handoffs=0;
 // One drag fires many change events while the first handoff is in flight and just after it.
 for(let i=0;i<25;i++){if(gate.begin())handoffs++;now+=10;}
 gate.end();for(let i=0;i<25;i++){if(gate.begin())handoffs++;now+=10;}
 assert.equal(handoffs,1);
 now+=5000;assert.equal(gate.begin(),true,'a later, separate gesture may hand off again');
});
