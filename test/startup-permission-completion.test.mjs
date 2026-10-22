/** Actual permission component + flow; synthetic native ports, no OS grant or browser. */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {JSDOM} from 'jsdom';
import {registerHooks} from 'node:module';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {tsImport} from 'tsx/esm/api';
const bridgeSource=`export const Capacitor={getPlatform:()=>globalThis.__alphaStartupPlatform||'android'};export function registerPlugin(name){return new Proxy({}, {get:(_target,method)=>(...args)=>globalThis.__alphaStartupPermissionPorts[name][method](...args)});}`;
const shim=await mkdtemp(path.join(tmpdir(),'alpha-permission-boundary-'));const bridgeURL=pathToFileURL(path.join(shim,'capacitor.mjs')).href,styleURL=pathToFileURL(path.join(shim,'style.mjs')).href;await writeFile(new URL(bridgeURL),bridgeSource);await writeFile(new URL(styleURL),'export{}');
const connectionsURL=pathToFileURL(path.join(shim,'connections.mjs')).href;await writeFile(new URL(connectionsURL),`const session={sessionId:'fixture-session',credentialId:'fixture-credential',client:{}};const snapshot={cloudAccount:{credentialId:'fixture-credential'},open:false};export const connectionController={subscribe:()=>()=>{},getSnapshot:()=>snapshot,getCloudClient:()=>session};export const googleConnectionController={subscribe:()=>()=>{},getSnapshot:()=>false,open(){}};export function createGoogleAccounts(){return {async list(){return [{connected:true,connectionId:'fixture-google',grantedCapabilities:['google.gmail.triage','google.calendar.read']}]}};}export const GOOGLE_ACCOUNTS_CHANGED='fixture-google-changed',GMAIL_ACCOUNTS_CHANGED='fixture-gmail-changed';`);test.after(()=>rm(shim,{recursive:true,force:true}));
const hooks=registerHooks({resolve(specifier,context,next){
 if(/(?:^|\/)(?:connection-ui|google-connection-ui|google-accounts|gmail-mailbox)(?:\.tsx?)?(?:\?.*)?$/.test(specifier))return {url:connectionsURL,shortCircuit:true};
 if(specifier==='@capacitor/core'||specifier==='./platform-plugins')return {url:bridgeURL,shortCircuit:true};
 if(specifier.split('?')[0].endsWith('startup-permissions.css'))return {url:styleURL,shortCircuit:true};
 return next(specifier,context);
}});
const config={parentURL:import.meta.url,tsconfig:new URL('../tsconfig.json',import.meta.url).pathname};
const {StartupPermissions}=await tsImport(process.env.STARTUP_SOURCE||new URL('../apps/app/src/startup-permissions.tsx',import.meta.url).href,config);
const {reopenStartupPermissions,STARTUP_PERMISSIONS_KEY}=await tsImport(process.env.STARTUP_FLOW_SOURCE||new URL('../apps/app/src/startup-permission-flow.ts',import.meta.url).href,config);
hooks.deregister();
async function fixture(t,{notifications=false,microphone=false,holdMicrophone=false,platform='android',dismissed=false,active=true}={}){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://permission-qa.invalid',pretendToBeVisual:true});const old={};
 for(const key of ['window','document','localStorage','Event','dispatchEvent','IS_REACT_ACT_ENVIRONMENT','__alphaStartupPermissionPorts','__alphaStartupPlatform','navigator','Notification'])old[key]=Object.getOwnPropertyDescriptor(globalThis,key);
 const values={window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,Event:dom.window.Event,dispatchEvent:event=>dom.window.dispatchEvent(event),IS_REACT_ACT_ENVIRONMENT:true};
 for(const[key,value]of Object.entries(values))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 globalThis.__alphaStartupPlatform=platform;
 if(dismissed)dom.window.localStorage.setItem(STARTUP_PERMISSIONS_KEY,JSON.stringify({dismissed:true,attempted:{}}));
 const state={notifications,microphone},requests=[];
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:'Alpha permission QA',permissions:{async query(){return {state:state.microphone?'granted':'prompt'};}},mediaDevices:{async getUserMedia(options){requests.push({port:'browsermicrophone',input:options});state.microphone=true;return {getAudioTracks:()=>[{readyState:'live'}],getTracks:()=>[{stop(){requests.push({port:'stop'});}}]};}}}});
 Object.defineProperty(globalThis,'Notification',{configurable:true,value:{get permission(){return state.notifications?'granted':'default';},async requestPermission(){requests.push({port:'browsernotifications'});state.notifications=true;return 'granted';}}});let resume,release;
 globalThis.__alphaStartupPermissionPorts={
  AlphaNotifications:{async status(){return {permissionGranted:state.notifications,appEnabled:state.notifications};}},
  DailyApps:{async requestPermissions(input){requests.push({port:'notifications',input});state.notifications=true;},async addListener(_event,callback){resume=callback;return {async remove(){}};}},
  AlphaVoiceCloud:{async checkPermissions(){return {microphone:state.microphone?'granted':'prompt'};},async requestPermissions(input){requests.push({port:'microphone',input});if(holdMicrophone)await new Promise(resolve=>{release=resolve;});state.microphone=true;return {microphone:'granted'};}},
  ElizaCamera:{async checkPermissions(){return {camera:'granted'};}},AlphaPhotoLibrary:{async scope(){return {scope:'full',locked:false};}},ElizaLocation:{async checkPermissions(){return {location:'granted',accuracy:'precise'};}},AlphaCalendar:{async checkPermissions(){return {calendar:'granted'};}},
  AlphaDevice:{async openSettings(input){requests.push({port:'settings',input});}},
 };
 const{createRoot}=await import('react-dom/client');const root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{await React.act(async()=>root.unmount());dom.window.close();for(const[key,descriptor]of Object.entries(old)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 await React.act(async()=>root.render(React.createElement(StartupPermissions,{active})));
 const button=name=>{const found=[...dom.window.document.querySelectorAll('button')].find(x=>x.textContent===name||x.getAttribute('aria-label')===name);assert(found,`Missing ${name}`);return found;};
 return {document:dom.window.document,state,requests,button,memory:()=>JSON.parse(dom.window.localStorage.getItem(STARTUP_PERMISSIONS_KEY)||'null'),click:async name=>React.act(async()=>button(name).click()),release:async()=>React.act(async()=>release()),resume:async()=>React.act(async()=>resume()),reopen:async()=>React.act(async()=>reopenStartupPermissions())};
}
test('already allowed access shows the final card and waits for Start',async t=>{
 const f=await fixture(t,{notifications:true,microphone:true});assert.equal(f.document.querySelector('h2').textContent,'You’re all set');assert.equal(f.memory()?.dismissed??false,false);assert.equal(f.requests.length,0);await f.click('Go to Alpha');assert.equal(f.document.querySelector('dialog'),null);assert.equal(f.memory().dismissed,true);
});
test('allowing the last permission reaches final without silently dismissing',async t=>{
 const f=await fixture(t,{notifications:true});assert.equal(f.document.querySelector('h2').textContent,'Set up Alpha access');await f.click('Enable microphone');assert.equal(f.document.querySelector('h2').textContent,'You’re all set');assert.equal(f.memory()?.dismissed??false,false);assert.equal(f.requests.length,1);assert.equal(f.requests[0].port,'microphone');await f.click('Go to Alpha');assert.equal(f.memory().dismissed,true);
});
test('Not now reaches final and records dismissal only after Start',async t=>{
 const f=await fixture(t);await f.click('Not now');assert.equal(f.document.querySelector('h2').textContent,'You’re all set');assert.match(f.document.querySelector('p').textContent,/skipped permissions/);assert.equal(f.requests.length,0);assert.equal(f.memory()?.dismissed??false,false);await f.click('Go to Alpha');assert.equal(f.memory().dismissed,true);
});
test('Settings reopens current access after completion without requesting again',async t=>{
 const f=await fixture(t,{notifications:true,microphone:true});await f.click('Go to Alpha');await f.reopen();assert.equal(f.document.querySelector('h2').textContent,'Set up Alpha access');assert(f.document.querySelectorAll('[role=status]').length>=2);assert.equal(f.requests.length,0);await f.click('Continue');assert.equal(f.document.querySelector('h2').textContent,'You’re all set');await f.click('Go to Alpha');assert.equal(f.memory().dismissed,true);
});
test('an outstanding OS prompt cannot be skipped or dismissed through Cancel',async t=>{
 const f=await fixture(t,{notifications:true,holdMicrophone:true});await f.click('Enable microphone');assert.equal(f.button('Not now').disabled,true);await React.act(async()=>f.document.querySelector('dialog').dispatchEvent(new f.document.defaultView.Event('cancel',{cancelable:true})));assert.equal(f.document.querySelector('h2').textContent,'Set up Alpha access');assert.equal(f.memory()?.dismissed??false,false);await f.release();assert.equal(f.document.querySelector('h2').textContent,'You’re all set');assert.equal(f.memory()?.dismissed??false,false);
});

test('browser setup reads access without capturing and stops its explicit consent stream',async t=>{
 const f=await fixture(t,{platform:'web',notifications:true});assert.equal(f.requests.length,0);await f.click('Enable microphone');assert.deepEqual(f.requests,[{port:'browsermicrophone',input:{audio:true}},{port:'stop'}]);assert.equal(f.document.querySelector('h2').textContent,'You’re all set');let homes=0;f.document.defaultView.addEventListener('launcher-home',()=>homes++);await f.click('Go to Alpha');assert.equal(homes,1);assert.equal(f.memory().dismissed,true);
});
test('completed browser setup stays dismissed until Settings explicitly reopens it',async t=>{
 const f=await fixture(t,{platform:'web',dismissed:true});assert.equal(f.document.querySelector('dialog'),null);assert.equal(f.requests.length,0);await f.reopen();assert.equal(f.document.querySelector('h2').textContent,'Set up Alpha access');await f.click('Not now');let homes=0;f.document.defaultView.addEventListener('launcher-home',()=>homes++);await f.click('Go to Alpha');assert.equal(homes,0);assert.equal(f.requests.length,0);
});

test('Settings can explicitly reopen browser access while signed out without requesting permissions',async t=>{const f=await fixture(t,{platform:'web',active:false});assert.equal(f.document.querySelector('dialog'),null);await f.reopen();assert.equal(f.document.querySelector('h2').textContent,'Set up Alpha access');assert.equal(f.requests.length,0);});
