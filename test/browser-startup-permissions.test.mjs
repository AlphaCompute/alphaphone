import test from 'node:test';
import assert from 'node:assert/strict';
import {tsImport} from 'tsx/esm/api';
const {browserStartupPermissions}=await tsImport(new URL('../apps/app/src/browser-startup-permissions.ts',import.meta.url).href,{parentURL:import.meta.url});
const {createStartupPermissionFlow}=await tsImport(new URL('../apps/app/src/startup-permission-flow.ts',import.meta.url).href,{parentURL:import.meta.url});
test('denied browser access reads as Settings without retrying a blocked OS prompt',async()=>{
 let requests=0;const browser=browserStartupPermissions({navigator:{mediaDevices:{getUserMedia(){requests++;throw Error('must not capture');}},permissions:{async query(){return {state:'denied'};}}},Notification:{permission:'denied',requestPermission(){requests++;}}});
 for(const key of ['notifications','microphone']){const flow=createStartupPermissionFlow(browser[key],{store:null});assert.equal(await flow.refresh(),'settings');assert.equal(await flow.enable(),'settings');}assert.equal(requests,0);
});
test('unsupported browser APIs remain unavailable, never granted',async()=>{
 const browser=browserStartupPermissions({navigator:{}});for(const key of ['notifications','microphone'])assert.equal(await createStartupPermissionFlow(browser[key],{store:null}).refresh(),'unavailable');
});
test('browser without permission-query support only remembers a successful explicit live stream',async()=>{
 let requests=0,stops=0;const browser=browserStartupPermissions({navigator:{mediaDevices:{async getUserMedia(){requests++;return {getAudioTracks:()=>[{readyState:'ended'}],getTracks:()=>[{stop(){stops++;}}]};}}}});
 const flow=createStartupPermissionFlow(browser.microphone,{store:null});assert.equal(await flow.refresh(),'request');assert.equal(requests,0);assert.equal(await flow.enable(),'unavailable');assert.equal(stops,1);assert.equal(await flow.refresh(),'settings');
});
