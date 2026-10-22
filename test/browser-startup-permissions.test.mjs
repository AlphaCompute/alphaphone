import test from 'node:test';
import assert from 'node:assert/strict';
import {tsImport} from 'tsx/esm/api';
const {browserStartupPermission}=await tsImport(new URL('../apps/app/src/startup-browser-permissions.ts',import.meta.url).href,{parentURL:import.meta.url});
const {createStartupPermissionFlow}=await tsImport(new URL('../apps/app/src/startup-permission-flow.ts',import.meta.url).href,{parentURL:import.meta.url});
test('denied browser access never retries a blocked OS prompt',async()=>{
 let requests=0;const ports={media:{getUserMedia(){requests++;throw Error('must not capture');}},permissions:{async query(){return {state:'denied'};}},notifications:{permission:'denied',requestPermission(){requests++;}}};
 for(const key of ['notifications','microphone','camera']){const flow=createStartupPermissionFlow(browserStartupPermission(key,ports),{store:null});assert.equal(await flow.refresh(),'settings');await flow.enable();}assert.equal(requests,0);
});
test('unsupported browser APIs remain unavailable, never granted',async()=>{
 for(const key of ['notifications','microphone','camera','location'])assert.equal(await createStartupPermissionFlow(browserStartupPermission(key,{}),{store:null}).refresh(),'unavailable');
});
test('browser without permission-query support rejects an ended stream and still stops every track',async()=>{
 let requests=0,stops=0;const browser=browserStartupPermission('microphone',{media:{async getUserMedia(){requests++;return {getTracks:()=>[{readyState:'ended',stop(){stops++;}}]};}}});
 const flow=createStartupPermissionFlow(browser,{store:null});assert.equal(await flow.refresh(),'request');assert.equal(requests,0);assert.equal(await flow.enable(),'unavailable');assert.equal(stops,1);assert.equal(await flow.refresh(),'unavailable');assert.equal(requests,1);
});
