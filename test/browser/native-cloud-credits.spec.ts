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
  const names={AlphaConnection:['secureRead','secureWrite','secureRemove','request','cancel','openExternal'],Agent:['stop','getStatus','configureCloudProvider','start','request'],DailyApps:['addListener','removeListener'],AlphaNotifications:['status'],AlphaVoiceCloud:['checkPermissions']};
  w.Capacitor={PluginHeaders:Object.entries(names).map(([name,methods])=>({name,methods:methods.map(name=>({name,rtype:'promise'}))})),nativePromise:async(plugin:string,method:string,input:any)=>{
   f.calls.push({plugin,method,path:input?.url?new URL(input.url).pathname:undefined});
   if(plugin==='Agent'){
    if(method==='getStatus')return {packaged:true,state:'stopped',serviceActive:false,socketListening:false};
    if(method==='configureCloudProvider'){await new Promise<void>(resolve=>f.releaseProvider=resolve);return {};}
    // P-11: the resident always starts; this runtime answers its owner and agent reads.
    if(method==='request'){const id='9f1dc45a-4011-4e44-947a-30d999d24fa5';const body=input.path==='/api/auth/me'?{identity:{id,kind:'owner'},access:{role:'OWNER',mode:'local'}}:input.path==='/api/agents'?{agents:[{id,name:'Alpha',status:'running'}]}:input.path==='/api/conversations'?{conversations:[]}:{};return {status:200,body:JSON.stringify(body)};}
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
/** P-11: the resident starts by itself and no dialog opens; Settings › Agent connection opens "Your agent". */
async function openAgent(page:Page){
 // No connection gate opens by itself (the startup permission panel may).
 await expect(page.locator('.alpha-connection-scrim')).toHaveCount(0);
 await page.evaluate(()=>(window as any).creditController.open());
 const dialog=page.getByRole('dialog',{name:'Your agent',exact:true});await expect(dialog).toBeVisible();return dialog;
}
async function fixture(page:Page){
 await boot(page);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).creditController.getSnapshot().session)).toBe(true);
 await openAgent(page);
 await expect(page.getByText('Add credits to continue',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Add credits in Eliza Cloud',exact:true})).toBeVisible();
}
const agentStarted=(page:Page)=>page.evaluate(()=>(window as any).creditFixture.calls.some((c:any)=>c.plugin==='Agent'&&c.method==='start'));

for(const failure of ['503','offline','malformed'])test(`zero then ${failure} is unavailable, never a stale top-up gate`,async({page})=>{
 await fixture(page);await page.evaluate(mode=>(window as any).creditFixture.mode=mode,failure);
 await page.getByRole('button',{name:'Check credits again',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>typeof(window as any).creditFixture.releaseCredit)).toBe('function');
 await expect(page.getByText('Checking credits…',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Add credits in Eliza Cloud',exact:true})).toHaveCount(0);
 await page.evaluate(()=>(window as any).creditFixture.releaseCredit());
 await expect(page.getByText('Credits unavailable. Try again.',{exact:true})).toBeVisible();
 await expect(page.getByText('Add credits to continue',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Add credits in Eliza Cloud',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Check credits again',exact:true})).toBeEnabled();
 // The agent keeps running; only inference is unavailable.
 await expect(page.getByText('Running on this device',{exact:true})).toBeVisible();
 const result=await page.evaluate(()=>{const w=window as any;return {balance:w.creditController.getSnapshot().residentBalance,session:w.creditController.getSnapshot().session,calls:w.creditFixture.calls};});
 expect(result.balance).toBeNull();expect(result.session).not.toBeNull();expect(result.calls.some((c:any)=>c.plugin==='Agent'&&c.method==='configureCloudProvider')).toBe(false);
 expect(result.calls.some((c:any)=>c.method==='openExternal'||c.path?.includes('/personal')||c.path?.includes('/agents'))).toBe(false);
 await expect(page.getByRole('dialog',{name:'Set up Alpha access'})).toHaveCount(0);
});

test('a saved sign-in is restored in the background: no gate, no sign-in request, the dialog shows the agent starting',async({page})=>{
 await page.setViewportSize({width:320,height:640});await boot(page,{mode:'positive',holdIdentity:true});
 const dialog=await openAgent(page);
 await expect(dialog.getByText('Starting…',{exact:true})).toBeVisible();await expect(dialog).toHaveAttribute('aria-busy','true');
 // A start in progress never traps the owner: the dialog closes and the start continues.
 await expect(page.getByRole('button',{name:'Close connection settings',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'Cancel',exact:true})).toHaveCount(0);
 expect(await dialog.evaluate(element=>element.scrollWidth-element.clientWidth)).toBe(0);
 await page.evaluate(()=>(window as any).creditFixture.releaseIdentity());await expect.poll(()=>page.evaluate(()=>typeof(window as any).creditFixture.releaseProvider)).toBe('function');await expect(page.getByText('Credits available',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).creditFixture.calls.some((call:any)=>call.method==='openExternal'||call.path?.includes('/personal')||call.path?.includes('/agents')))).toBe(false);await expect(page.getByRole('dialog',{name:'Set up Alpha access'})).toHaveCount(0);
 await page.getByRole('button',{name:'Close connection settings',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.evaluate(()=>(window as any).creditFixture.releaseProvider());await expect.poll(()=>agentStarted(page)).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).creditController.getSnapshot().busy)).toBe(false);
});

test('an expired saved sign-in exposes the real sign-in action without a credit or permission bypass; the agent runs',async({page},info)=>{
 await boot(page,{mode:'401'});await expect.poll(()=>agentStarted(page)).toBe(true);const dialog=await openAgent(page);
 await expect(dialog.getByRole('button',{name:'Sign in with Eliza Cloud',exact:true})).toBeEnabled();await expect(dialog.getByText('Your saved Cloud sign-in is no longer valid.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Retry saved connection',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Add credits in Eliza Cloud',exact:true})).toHaveCount(0);await expect(page.getByRole('dialog',{name:'Set up Alpha access'})).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).creditFixture.calls.some((call:any)=>call.method==='configureCloudProvider'||call.method==='openExternal'))).toBe(false);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:info.outputPath('expired-saved-sign-in.png'),animations:'disabled'});
});

test('a missing saved credential starts the agent with AI off and offers sign-in without a gate',async({page})=>{
 await boot(page,{saved:false});await expect.poll(()=>agentStarted(page)).toBe(true);const dialog=await openAgent(page);
 await expect(dialog.getByRole('button',{name:'Sign in with Eliza Cloud',exact:true})).toBeEnabled();await expect(dialog.getByText('AI is off. Sign in to Eliza Cloud to use your credits for AI.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Use local apps without AI',exact:true})).toHaveCount(0);await expect(page.getByRole('dialog',{name:'Set up Alpha access'})).toHaveCount(0);expect(await page.evaluate(()=>(window as any).creditFixture.calls.some((call:any)=>(call.plugin==='AlphaConnection'&&call.method==='request')||call.method==='configureCloudProvider'||call.method==='openExternal'))).toBe(false);
});

test('401 after a prior account check replaces stale account copy with sign-in',async({page})=>{
 await fixture(page);await page.evaluate(()=>(window as any).creditFixture.mode='401');await page.getByRole('button',{name:'Check credits again',exact:true}).click();await expect(page.getByText('Your saved Cloud sign-in is no longer valid.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Sign in with Eliza Cloud',exact:true})).toBeEnabled();await expect(page.getByText('Add credits to continue',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Add credits in Eliza Cloud',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>(window as any).creditFixture.calls.some((call:any)=>call.method==='configureCloudProvider'))).toBe(false);
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
