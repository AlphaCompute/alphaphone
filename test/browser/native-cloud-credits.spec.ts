import {test,expect,type Page} from '@playwright/test';
import {createServer,type ViteDevServer} from 'vite';
import {resolve} from 'node:path';

// Actual normal Android chooser/controller composition; only native ports are synthetic.
// No device, account, provider, billing purchase, microphone or playback is used.
let server:ViteDevServer,origin:string;
test.beforeAll(async()=>{
 const previous=process.env.ELIZA_DEV_ALLOW_TEST_MOCKS;process.env.ELIZA_DEV_ALLOW_TEST_MOCKS='';
 try{server=await createServer({configFile:resolve('vite.config.ts'),configLoader:'native',cacheDir:resolve('test-results/native-cloud-credits/vite-cache'),server:{host:'127.0.0.1',port:0},define:{'import.meta.env.VITE_ELIZA_DEV_ALLOW_TEST_MOCKS':JSON.stringify('')},plugins:[{name:'native-credit-composition',resolveId(id){if(id==='/credit-entry.tsx')return '\0credit-entry';},load(id){if(id==='\0credit-entry')return `
 import React,{useSyncExternalStore} from 'react';
 import {createRoot} from 'react-dom/client';
 import '/src/prototype/prototype.css';
 import {Capacitor} from '@capacitor/core';
 Capacitor.getPlatform=()=> 'android';Capacitor.isNativePlatform=()=>true;
 const {ConnectionChooser,connectionController}=await import('/src/runtime/connection-ui.tsx');
 const {StartupPermissions}=await import('/src/startup-permissions.tsx');
 const flags=await import('/src/build-flags.ts');window.creditFlags={native:Capacitor.getPlatform(),mocks:flags.testMocksEnabled};
 window.creditController=connectionController;
 document.body.insertAdjacentHTML('afterbegin','<div class="os" style="position:fixed;inset:0;background:var(--bg)" aria-hidden="true"></div>');
 function Composition(){const state=useSyncExternalStore(connectionController.subscribe,connectionController.getSnapshot);return React.createElement(React.Fragment,null,React.createElement(ConnectionChooser),!state.open&&React.createElement(StartupPermissions));}
 createRoot(document.getElementById('root')).render(React.createElement(Composition));
 `;},configureServer(s){s.middlewares.use('/credit-composition',async(_request,response)=>{response.setHeader('Content-Type','text/html');response.end(await s.transformIndexHtml('/credit-composition','<div id="root"></div><script type="module" src="/credit-entry.tsx"></script>'));});}}]});}finally{if(previous===undefined)delete process.env.ELIZA_DEV_ALLOW_TEST_MOCKS;else process.env.ELIZA_DEV_ALLOW_TEST_MOCKS=previous;}
 await server.listen();origin=`http://127.0.0.1:${(server.httpServer!.address()as {port:number}).port}`;
});
test.afterAll(async()=>{await server?.close();});

async function boot(page:Page,initial:{mode?:string;holdIdentity?:boolean;saved?:boolean}={}){
 page.on('pageerror',(error:Error)=>console.error('Composition page error:',error.message));
 await page.route('https://**',route=>route.abort());
 await page.addInitScript(initial=>{
  const w=window as any;const f=w.creditFixture={mode:'zero',saved:true,holdIdentity:false,...initial,calls:[]as any[],releaseCredit:null as null|(()=>void),releaseProvider:null as null|(()=>void),releaseIdentity:null as null|(()=>void)};
  const credential={credentialId:'11111111-1111-4111-8111-111111111111',token:'synthetic-credit-token',expiresAt:Date.now()+600000};
  const names={AlphaConnection:['secureRead','secureWrite','secureRemove','request','cancel','openExternal'],Agent:['stop','getStatus','configureCloudProvider'],DailyApps:['addListener','removeListener'],AlphaNotifications:['status'],AlphaVoiceCloud:['checkPermissions']};
  w.Capacitor={PluginHeaders:Object.entries(names).map(([name,methods])=>({name,methods:methods.map(name=>({name,rtype:'promise'}))})),nativePromise:async(plugin:string,method:string,input:any)=>{
   f.calls.push({plugin,method,path:input?.url?new URL(input.url).pathname:undefined});
   if(plugin==='Agent'){
    if(method==='getStatus')return {packaged:true,state:'stopped',serviceActive:false,socketListening:false};
    if(method==='configureCloudProvider'){await new Promise<void>(resolve=>f.releaseProvider=resolve);return {};}
    return {};
   }
   if(plugin==='AlphaNotifications')return {permissionGranted:false,appEnabled:false};
   if(plugin==='AlphaVoiceCloud')return {microphone:'prompt'};
   if(plugin==='DailyApps')return {remove:async()=>{}};
   if(plugin!=='AlphaConnection')throw Error('Unexpected native credit fixture port');
   if(method==='secureRead')return {value:f.saved&&input.slot==='cloud:production'?JSON.stringify(credential):null};
   if(method!=='request')return {};
   const path=new URL(input.url).pathname;
   if(path==='/api/v1/user'){if(f.holdIdentity)await new Promise<void>(resolve=>f.releaseIdentity=resolve);return f.mode==='401'?{status:401,data:{}}:{status:200,data:{success:true,data:{id:'22222222-2222-4222-8222-222222222222',email:'synthetic-credit@example.invalid'}}};}
   if(path!=='/api/v1/credits/balance')throw Error('Unexpected Cloud route '+path);
   if(f.mode==='zero')return {status:200,data:{balance:0}};
   if(f.mode==='positive')return {status:200,data:{balance:4}};
   await new Promise<void>(resolve=>f.releaseCredit=resolve);
   if(f.mode==='offline')throw Error('Synthetic offline credit request');
   return f.mode==='503'?{status:503,data:{}}:{status:200,data:{balance:'invalid'}};
  }};
 },initial);
 await page.goto(origin+'/credit-composition');
 await expect.poll(()=>page.evaluate(()=>(window as any).creditFlags)).toEqual({native:'android',mocks:false});
}
async function fixture(page:Page){
 await boot(page);
 await expect(page.getByRole('dialog',{name:'Your Cloud account',exact:true})).toBeVisible();
 await expect(page.getByText('Add credits to continue',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Add credits in Eliza Cloud',exact:true})).toBeVisible();
}

for(const failure of ['503','offline','malformed'])test(`zero then ${failure} is unavailable, never a stale top-up gate`,async({page})=>{
 await fixture(page);await page.evaluate(mode=>(window as any).creditFixture.mode=mode,failure);
 await page.getByRole('button',{name:'Check credits again',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>typeof(window as any).creditFixture.releaseCredit)).toBe('function');
 await expect(page.getByText('Checking credits…',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Add credits in Eliza Cloud',exact:true})).toHaveCount(0);
 await page.evaluate(()=>(window as any).creditFixture.releaseCredit());
 await expect(page.getByRole('alert')).toBeVisible();
 await expect(page.getByText('Credits unavailable. Try again.',{exact:true})).toBeVisible();
 await expect(page.getByText('Add credits to continue',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Add credits in Eliza Cloud',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Check credits again',exact:true})).toBeEnabled();
 const result=await page.evaluate(()=>{const w=window as any;return {balance:w.creditController.getSnapshot().residentBalance,session:w.creditController.getSnapshot().session,calls:w.creditFixture.calls};});
 expect(result.balance).toBeNull();expect(result.session).toBeNull();expect(result.calls.some((c:any)=>c.plugin==='Agent'&&c.method==='configureCloudProvider')).toBe(false);
 expect(result.calls.some((c:any)=>c.method==='openExternal'||c.path?.includes('/personal')||c.path?.includes('/agents'))).toBe(false);
 await expect(page.getByRole('dialog',{name:'Set up Alpha access'})).toHaveCount(0);
});

test('saved sign-in restoration is compact and does not ask for another sign-in',async({page},info)=>{
 await page.setViewportSize({width:320,height:640});await boot(page,{mode:'positive',holdIdentity:true});
 const dialog=page.getByRole('dialog',{name:'Opening Alpha',exact:true});await expect(dialog).toBeVisible();await expect(dialog).toHaveAttribute('aria-busy','true');
 await expect(page.getByRole('button',{name:'Sign in with Eliza Cloud',exact:true})).toHaveCount(0);await expect(page.getByText('Welcome to Alpha',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Cancel',exact:true})).toBeEnabled();
 expect(await dialog.evaluate(element=>({font:parseFloat(getComputedStyle(element.querySelector('h1')!).fontSize),overflow:element.scrollWidth-element.clientWidth,height:element.getBoundingClientRect().height}))).toMatchObject({font:30,overflow:0});
 await page.evaluate(()=>(window as any).creditFixture.releaseIdentity());await expect.poll(()=>page.evaluate(()=>typeof(window as any).creditFixture.releaseProvider)).toBe('function');await expect(page.getByText('Credits available',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Continue',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Sign out',exact:true})).toHaveCount(0);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:info.outputPath('saved-account-resume.png'),animations:'disabled'});
 expect(await page.evaluate(()=>(window as any).creditFixture.calls.some((call:any)=>call.method==='openExternal'||call.path?.includes('/personal')||call.path?.includes('/agents')))).toBe(false);await expect(page.getByRole('dialog',{name:'Set up Alpha access'})).toHaveCount(0);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.evaluate(()=>(window as any).creditFixture.releaseProvider());await expect.poll(()=>page.evaluate(()=>(window as any).creditController.getSnapshot().busy)).toBe(false);
});

test('an expired saved sign-in exposes the real sign-in action without a credit or permission bypass',async({page},info)=>{
 await boot(page,{mode:'401'});await expect(page.getByRole('dialog',{name:'Sign in to Eliza Cloud',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Sign in with Eliza Cloud',exact:true})).toBeEnabled();await expect(page.getByRole('alert')).toContainText('no longer valid');
 await expect(page.getByRole('button',{name:'Retry saved connection',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Continue',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Add credits in Eliza Cloud',exact:true})).toHaveCount(0);await expect(page.getByRole('dialog',{name:'Set up Alpha access'})).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).creditFixture.calls.some((call:any)=>call.method==='configureCloudProvider'||call.method==='openExternal'))).toBe(false);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:info.outputPath('expired-saved-sign-in.png'),animations:'disabled'});
});

test('a missing saved credential keeps the original first-run sign-in gate',async({page})=>{
 await boot(page,{saved:false});await expect(page.getByRole('dialog',{name:'Welcome to Alpha',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Sign in with Eliza Cloud',exact:true})).toBeEnabled();await expect(page.getByText('Your agent runs on this phone. Sign in to Eliza Cloud to use your account credits for AI.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Sign in with Eliza Cloud',exact:true})).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
 await expect(page.getByRole('button',{name:'Continue',exact:true})).toHaveCount(0);await expect(page.getByRole('dialog',{name:'Set up Alpha access'})).toHaveCount(0);expect(await page.evaluate(()=>(window as any).creditFixture.calls.some((call:any)=>call.method==='request'||call.method==='configureCloudProvider'||call.method==='openExternal'))).toBe(false);
});

test('401 after a prior account check replaces stale account copy with sign-in',async({page})=>{
 await fixture(page);await page.evaluate(()=>(window as any).creditFixture.mode='401');await page.getByRole('button',{name:'Check credits again',exact:true}).click();await expect(page.getByRole('dialog',{name:'Sign in to Eliza Cloud',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Sign in with Eliza Cloud',exact:true})).toBeEnabled();await expect(page.getByText('Add credits to continue',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Add credits in Eliza Cloud',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>(window as any).creditFixture.calls.some((call:any)=>call.method==='configureCloudProvider'))).toBe(false);
});

test('legitimate zero stays gated and a positive retry retains verified credit',async({page})=>{
 await fixture(page);await page.getByRole('button',{name:'Check credits again',exact:true}).click();
 await expect(page.getByRole('button',{name:'Check credits again',exact:true})).toBeEnabled();
 await expect(page.getByText('Add credits to continue',{exact:true})).toBeVisible();
 await page.evaluate(()=>(window as any).creditFixture.mode='positive');
 await page.getByRole('button',{name:'Check credits again',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>typeof(window as any).creditFixture.releaseProvider)).toBe('function');
 await expect(page.getByText('Credits available',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).creditController.getSnapshot().residentBalance)).toBe(4);
 await expect(page.getByText('Credits unavailable. Try again.',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Add credits in Eliza Cloud',exact:true})).toHaveCount(0);
 await expect(page.getByRole('dialog',{name:'Set up Alpha access'})).toHaveCount(0);
 await page.evaluate(()=>{const w=window as any;w.creditController.cancel();w.creditFixture.releaseProvider();});
 await expect.poll(()=>page.evaluate(()=>(window as any).creditController.getSnapshot().busy)).toBe(false);
});
