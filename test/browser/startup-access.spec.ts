import {test,expect} from '@playwright/test';
import {createServer,type ViteDevServer} from 'vite';
import {resolve} from 'node:path';
// Actual checklist + bundled CSS, synthetic native/account ports only. No device grants or Google consent.
let server:ViteDevServer,origin:string;
test.beforeAll(async()=>{
 server=await createServer({configFile:resolve('vite.config.ts'),configLoader:'native',cacheDir:resolve('test-results/startup-access/vite-cache'),server:{host:'127.0.0.1',port:0},plugins:[{name:'access-composition',enforce:'pre',resolveId(id,importer){if(id==='/access-entry.tsx')return '\0access-entry';if(importer?.endsWith('startup-permissions.tsx')&&id==='./runtime/connection-ui')return '\0access-connection';if(importer?.endsWith('startup-permissions.tsx')&&id==='./runtime/google-connection-ui')return '\0access-google';},load(id){
 if(id==='\0access-connection')return `const w=window;let state={open:false,cloudAccount:null};let listeners=new Set();const client={gmailAccounts:async()=>w.access.accounts};w.access.signin=()=>{state={open:false,cloudAccount:{id:'synthetic'}};listeners.forEach(fn=>fn())};export const connectionController={subscribe:fn=>(listeners.add(fn),()=>listeners.delete(fn)),getSnapshot:()=>state,getCloudClient:()=>state.cloudAccount?{client,sessionId:'synthetic-session',credentialId:'synthetic-credential'}:null};`;
 if(id==='\0access-google')return `export const googleConnectionController={subscribe:()=>()=>{},getSnapshot:()=>false,open:()=>window.access.googleOpens++};`;
 if(id==='\0access-entry')return `import React from 'react';import {createRoot} from 'react-dom/client';import '/src/prototype/prototype.css';import {Capacitor} from '@capacitor/core';Capacitor.getPlatform=()=> 'android';Capacitor.isNativePlatform=()=>true;const {StartupPermissions}=await import('/src/startup-permissions.tsx');const {reopenStartupPermissions}=await import('/src/startup-permission-flow.ts');window.access.reopen=reopenStartupPermissions;document.body.insertAdjacentHTML('afterbegin','<div class="os" aria-hidden="true"></div>');createRoot(document.getElementById('root')).render(React.createElement(StartupPermissions));`;
 },configureServer(s){s.middlewares.use('/access-composition',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/access-composition','<div id="root"></div><script type="module" src="/access-entry.tsx"></script>'));});}}]});
 await server.listen();origin=`http://127.0.0.1:${(server.httpServer!.address()as {port:number}).port}`;
});
test.afterAll(async()=>{await server?.close();});
test('post-sign-in checklist has real layout, explicit requests, honest limited photos and persistent skip',async({page})=>{
 await page.setViewportSize({width:360,height:740});
 await page.addInitScript(()=>{
 const w=window as any;w.access={calls:[],accounts:[{connected:true,connectionId:'synthetic',grantedCapabilities:[]}],googleOpens:0};
 const names={AlphaNotifications:['status'],AlphaVoiceCloud:['checkPermissions','requestPermissions'],ElizaCamera:['checkPermissions'],ElizaLocation:['checkPermissions','requestPermissions'],AlphaCalendar:['checkPermissions','requestPermissions'],AlphaPhotoLibrary:['scope','requestAccess'],DailyApps:['requestPermissions','addListener','removeListener'],AlphaDevice:['openSettings']};
 w.Capacitor={PluginHeaders:Object.entries(names).map(([name,methods])=>({name,methods:methods.map(name=>({name,rtype:'promise'}))})),nativePromise:async(plugin:string,method:string,input:any)=>{w.access.calls.push({plugin,method,input});if(plugin==='AlphaNotifications')return {permissionGranted:true,appEnabled:true};if(plugin==='AlphaVoiceCloud')return {microphone:'denied'};if(plugin==='ElizaCamera')return {camera:'denied'};if(plugin==='ElizaLocation')return {location:'granted',accuracy:'approximate'};if(plugin==='AlphaCalendar')return {calendar:'denied'};if(plugin==='AlphaPhotoLibrary')return {scope:'selected',locked:false};return {};}};
 });
 await page.goto(origin+'/access-composition');await expect.poll(()=>page.evaluate(()=>typeof (window as any).access.reopen)).toBe('function');
 const panel=page.getByRole('dialog',{name:'Set up Alpha access'});await expect(panel).toHaveCount(0);
 await page.evaluate(()=>(window as any).access.signin());await expect(panel).toBeVisible();
 await expect(panel.getByText('Approximate location allowed',{exact:true})).toBeVisible();
 await expect(panel.getByRole('heading',{name:'On-phone Calendar',exact:true})).toBeVisible();
 await expect(panel.getByText('Selected photos and videos only',{exact:true})).toBeVisible();
 await expect(panel.getByText('Gmail: Not connected')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).access.calls.filter((c:any)=>c.method==='requestPermissions'))).toEqual([]);
 await panel.getByRole('button',{name:'Enable camera',exact:true}).click();
 await expect(panel.getByRole('button',{name:'Manage camera in Android',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).access.calls.filter((c:any)=>c.method==='requestPermissions'))).toEqual([{plugin:'DailyApps',method:'requestPermissions',input:{permissions:['camera']}}]);
 await panel.getByRole('button',{name:'Enable calendar',exact:true}).click();
 await expect(panel.getByRole('button',{name:'Manage on-phone calendar in Android',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).access.calls.filter((c:any)=>c.method==='requestPermissions'))).toEqual([{plugin:'DailyApps',method:'requestPermissions',input:{permissions:['camera']}},{plugin:'AlphaCalendar',method:'requestPermissions',input:{permissions:['calendar']}}]);
 expect(await page.evaluate(()=>(window as any).access.calls.filter((c:any)=>['getCurrentPosition','watchPosition','list','sync','requestAccess'].includes(c.method)))).toEqual([]);
 await page.evaluate(()=>{(window as any).access.accounts=[{connected:true,connectionId:'synthetic',grantedCapabilities:['google.gmail.triage','google.calendar.read']}];window.dispatchEvent(new Event('alpha:google-accounts-changed'));});
 await expect(panel.getByText('Gmail: Connected with read access')).toBeVisible();
 await panel.getByRole('button',{name:'Review Google connections'}).click();expect(await page.evaluate(()=>(window as any).access.googleOpens)).toBe(1);
 const footer=panel.getByRole('button',{name:'Not now',exact:true});await footer.scrollIntoViewIfNeeded();const rect=await footer.boundingBox();expect(rect!.height).toBeGreaterThanOrEqual(44);expect(rect!.x).toBeGreaterThanOrEqual(0);expect(rect!.x+rect!.width).toBeLessThanOrEqual(360);
 await page.screenshot({path:'test-results/startup-access-360.png'});await footer.click();await expect(panel).toHaveCount(0);
 await page.reload();await expect.poll(()=>page.evaluate(()=>typeof (window as any).access.reopen)).toBe('function');await page.evaluate(()=>(window as any).access.signin());await expect(panel).toHaveCount(0);
 await page.evaluate(()=>(window as any).access.reopen());await expect(panel).toBeVisible();await expect(panel.getByRole('button',{name:'Manage camera in Android',exact:true})).toBeVisible();
});

test('reopening an allowed checklist starts at its heading without requesting access',async({page})=>{
 await page.setViewportSize({width:360,height:740});
 await page.addInitScript(()=>{
  const w=window as any;w.access={calls:[],accounts:[{connected:true,connectionId:'synthetic',grantedCapabilities:['google.gmail.triage','google.calendar.read']}],googleOpens:0};
  const names={AlphaNotifications:['status'],AlphaVoiceCloud:['checkPermissions','requestPermissions'],ElizaCamera:['checkPermissions'],ElizaLocation:['checkPermissions','requestPermissions'],AlphaCalendar:['checkPermissions','requestPermissions'],AlphaPhotoLibrary:['scope','requestAccess'],DailyApps:['requestPermissions','addListener','removeListener'],AlphaDevice:['openSettings']};
  w.Capacitor={PluginHeaders:Object.entries(names).map(([name,methods])=>({name,methods:methods.map(name=>({name,rtype:'promise'}))})),nativePromise:async(plugin:string,method:string,input:any)=>{
   w.access.calls.push({plugin,method,input});
   if(plugin==='AlphaNotifications')return {permissionGranted:true,appEnabled:true};
   if(plugin==='AlphaVoiceCloud')return {microphone:'granted'};
   if(plugin==='ElizaCamera')return {camera:'granted'};
   if(plugin==='ElizaLocation')return {location:'granted',accuracy:'approximate'};
   if(plugin==='AlphaCalendar')return {calendar:'granted'};
   if(plugin==='AlphaPhotoLibrary')return {scope:'full',locked:false};
   return {};
  }};
 });
 await page.goto(origin+'/access-composition');
 await expect.poll(()=>page.evaluate(()=>typeof (window as any).access.reopen)).toBe('function');
 await page.evaluate(()=>(window as any).access.signin());
 await page.evaluate(()=>(window as any).access.reopen());
 const panel=page.getByRole('dialog',{name:'Set up Alpha access'});
 await expect(panel.getByRole('button',{name:'Done',exact:true})).toBeAttached();
 const assertTop=async()=>{
  await expect(panel.getByRole('heading',{name:'Set up Alpha access',exact:true})).toBeFocused();
  expect(await panel.evaluate(element=>element.scrollTop)).toBe(0);
  const box=await panel.boundingBox(),heading=await panel.getByRole('heading',{name:'Set up Alpha access',exact:true}).boundingBox(),microphone=await panel.getByRole('heading',{name:'Microphone',exact:true}).boundingBox();
  expect(heading!.y).toBeGreaterThanOrEqual(box!.y);
  expect(microphone!.y+microphone!.height).toBeLessThan(box!.y+box!.height);
 };
 await assertTop();
 await page.keyboard.press('Tab');await expect(panel.getByRole('button',{name:'Manage photo access',exact:true})).toBeFocused();
 await panel.getByRole('button',{name:'Done',exact:true}).click();await expect(panel).toHaveCount(0);
 await page.evaluate(()=>(window as any).access.reopen());await assertTop();
 expect(await page.evaluate(()=>(window as any).access.calls.filter((c:any)=>['requestPermissions','requestAccess','openSettings'].includes(c.method)))).toEqual([]);
 await page.screenshot({path:'test-results/startup-access-reopen-top-360.png'});
});
