// Source-level checks of the ELIZA_DEV_ALLOW_TEST_MOCKS gates for developer and
// simulation surfaces. Modules are loaded through Vite's SSR transform so that
// import.meta.env carries the flag exactly as the renderer build does; production
// bundle contents are audited separately by scripts/audit-production-bundle.mjs.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {createServer} from 'vite';

const root=new URL('..',import.meta.url);
const servers={};
async function server(flag){
 // Vite exposes VITE_* from the process environment when the server starts.
 if(flag)process.env.VITE_ELIZA_DEV_ALLOW_TEST_MOCKS='1';else delete process.env.VITE_ELIZA_DEV_ALLOW_TEST_MOCKS;
 try{return await createServer({configFile:false,root:root.pathname,logLevel:'silent',appType:'custom',server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,include:[]}});}
 finally{delete process.env.VITE_ELIZA_DEV_ALLOW_TEST_MOCKS;}
}
before(async()=>{servers.on=await server(true);servers.off=await server(false);});
after(async()=>{await Promise.all(Object.values(servers).map(s=>s.close()));});
const load=(flag,path)=>servers[flag?'on':'off'].ssrLoadModule('/apps/app/src/'+path);

test('build flags are off unless ELIZA_DEV_ALLOW_TEST_MOCKS is exactly 1',async()=>{
 const on=await load(true,'build-flags.ts'),off=await load(false,'build-flags.ts');
 assert.equal(on.testMocksEnabled,true);assert.equal(on.devSurfacesEnabled,true);
 assert.equal(off.testMocksEnabled,false);assert.equal(off.devSurfacesEnabled,false);
});

test('remote agents accept plain-HTTP loopback development origins only with test mocks',async()=>{
 for(const flag of [true,false]){
  const {normalizeRemoteOrigin}=await load(flag,'runtime/remote-protocol.ts');
  for(const origin of ['http://127.0.0.1:31337','http://10.0.2.2:31337','http://localhost:31337']){
   if(flag)assert.equal(normalizeRemoteOrigin(origin,[origin]),origin);
   else assert.throws(()=>normalizeRemoteOrigin(origin,[origin]),error=>error.code==='https_required');
   // Undeclared development origins are always rejected.
   assert.throws(()=>normalizeRemoteOrigin(origin,[]),error=>error.code==='https_required');
  }
  assert.equal(normalizeRemoteOrigin('https://agent.example/'),'https://agent.example');
  // A caller cannot re-enable loopback HTTP in a flag-off build.
  if(!flag)assert.throws(()=>normalizeRemoteOrigin('http://127.0.0.1:31337',['http://127.0.0.1:31337'],true),error=>error.code==='https_required');
  assert.throws(()=>normalizeRemoteOrigin('http://agent.example/',['http://agent.example']),error=>error.code==='https_required');
 }
});

test('verified sessions accept plain-HTTP loopback origins only with test mocks',async()=>{
 for(const flag of [true,false]){
  const {AlphaClient,developmentSessionOrigin}=await load(flag,'runtime/alpha-client.ts');
  const origin='http://127.0.0.1:31337',session={ownerId:'owner',agentId:'agent',sessionId:'session',origin};
  assert.equal(developmentSessionOrigin(new URL(origin),origin),flag);
  assert.equal(developmentSessionOrigin(new URL(origin),undefined),false);
  assert.equal(developmentSessionOrigin(new URL(origin),origin,true),flag,'flag-off builds have no development hosts');
  const client=new AlphaClient(),transport={session,send:async()=>({text:''})};
  if(flag)client.attachVerifiedTransport(transport,{developmentOrigin:origin});
  else assert.throws(()=>client.attachVerifiedTransport(transport,{developmentOrigin:origin}),/Invalid verified session metadata/);
  new AlphaClient().attachVerifiedTransport({...transport,session:{...session,origin:'https://agent.example'}});
 }
});

test('Eliza Cloud staging exists only with test mocks',async()=>{
 for(const flag of [true,false]){
  const {CloudProtocol,cloudEnvironmentAvailable}=await load(flag,'runtime/cloud-protocol.ts');
  assert.equal(cloudEnvironmentAvailable('production'),true);
  assert.equal(cloudEnvironmentAvailable('staging'),flag);
  const requests=[],client=new CloudProtocol('staging',async input=>{requests.push(input.url);return {status:200,data:{sessionId:'s',status:'pending',expiresAt:new Date(Date.now()+1000).toISOString()}};},{read:async()=>null,write:async()=>{},clear:async()=>{}},async()=>{});
  const login=client.login(AbortSignal.timeout(50)).catch(error=>error);
  const result=await login;
  if(flag)assert.ok(requests.every(url=>url.startsWith('https://api-staging.eliza.app/')),'staging routes to the staging authority');
  else{assert.equal(requests.length,0,'no staging request leaves a flag-off build');assert.match(String(result?.message),/unavailable in this build/);}
 }
});

test('the development profile and deferred apps need test mocks',async()=>{
 globalThis.location??={search:'?mode=dev',href:'http://127.0.0.1/?mode=dev'};
 const off={features:await load(false,'prototype/mvp-features.ts'),dev:await load(false,'browser/dev-profile.ts')};
 assert.equal(off.dev.browserDevProfile,false,'?mode=dev is ignored without the flag');
 for(const view of ['phone','messages','contacts','wallet'])assert.equal(off.features.isMvpView(view),false,view+' stays deferred');
 const on={features:await load(true,'prototype/mvp-features.ts'),dev:await load(true,'browser/dev-profile.ts')};
 assert.equal(on.dev.browserDevProfile,true);for(const view of ['phone','wallet'])assert.equal(on.features.isMvpView(view),true);
});

test('a flag-off production build folds developer and simulation surfaces out',async()=>{
 const {build}=await import('vite'),{mkdtempSync,rmSync,readdirSync,readFileSync}=fs,{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const outDir=mkdtempSync(join(tmpdir(),'alpha-dev-gates-'));delete process.env.VITE_ELIZA_DEV_ALLOW_TEST_MOCKS;delete process.env.ELIZA_DEV_ALLOW_TEST_MOCKS;
 try{
  // Vite dev servers above default NODE_ENV to development; a release build is production.
  const nodeEnv=process.env.NODE_ENV;process.env.NODE_ENV='production';
  try{await build({configFile:new URL('vite.config.ts',root).pathname,logLevel:'silent',build:{outDir,emptyOutDir:true}});}finally{if(nodeEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=nodeEnv;}
  const assets=join(outDir,'assets'),bundle=readdirSync(assets).filter(name=>name.endsWith('.js')).map(name=>readFileSync(join(assets,name),'utf8')).join('\n');
  // Strings owned by this package's modules; connection-ui and main.tsx are gated separately.
  for(const marker of ['alpha-dev-tools','Device controls','Browser development device','__alpha-local-agent','emulator development agent','Simulate Clock request','api-staging.eliza.app','10.0.2.2:47850','Pick up phone','Saved development apps','Development card','alpha.dev.location.v1','Development device storage unavailable'])
   assert.equal(bundle.includes(marker),false,marker+' must not ship without ELIZA_DEV_ALLOW_TEST_MOCKS');
 }finally{rmSync(outDir,{recursive:true,force:true});}
});

test('the local agent host bridge is unavailable without test mocks',async()=>{
 const calls=[];const fetch=globalThis.fetch;globalThis.fetch=async url=>{calls.push(String(url));return new Response('{}');};
 try{
  const local=await load(false,'runtime/local-agent.ts'),storage=await load(false,'runtime/local-agent-storage.ts');
  assert.equal(local.browserLocalAgentEnabled,false);
  await assert.rejects(new local.LocalAgentProtocol().connect(new AbortController().signal),/unavailable in this browser/);
  await assert.rejects(storage.developmentDeviceStore.read('slot'),/unavailable in this browser/);
  assert.deepEqual(calls,[],'no request reaches /__alpha-local-agent');
 }finally{globalThis.fetch=fetch;}
});

// regional-provider composes the upstream provider at module load; evaluate it
// with explicit flag bindings and a synthetic transport.
async function regional({testMocks,devSurfaces,baseUrl,native=false,developmentBuild=true}){
 const {createRegionalMaps}=await servers.off.ssrLoadModule('/.eliza/client-features/plugins/plugin-maps/src/client/regional-provider.ts');
 const source=fs.readFileSync(new URL('apps/app/src/maps/regional-provider.ts',root),'utf8')
  .replace(/^import [\s\S]*?;\n/gm,'').replace(/^export type \{[^}]*\} from .*;\n/gm,'')
  .replaceAll('import.meta.env.VITE_MAPS_BASE_URL','__env.VITE_MAPS_BASE_URL')
  .replace(/^export (const|function|interface)/gm,'$1');
 const fetched=[],configured=[];
 const context={createRegionalMaps,testMocksEnabled:testMocks,devSurfacesEnabled:devSurfaces,__env:{VITE_MAPS_BASE_URL:baseUrl},
  Capacitor:{isNativePlatform:()=>native},DailyApps:{surfaceInfo:async()=>({developmentBuild})},
  registerPlugin:()=>({request:async()=>{throw Error('native transport not expected');},cancel:async()=>{}}),
  configureMapsProvider:config=>configured.push(config),
  fetch:async url=>{fetched.push(String(url));throw Error('offline');},URL,TextDecoder,Uint8Array,JSON,Error,Number,Array,Object,crypto,atob};
 vm.runInNewContext(stripTypeScriptTypes(source,{mode:'transform'})+'\nglobalThis.result={regionalDataset,regionalDiagnostics,initializeRegionalMaps};',context);
 // The upstream provider runs in this realm and uses the global fetch.
 const realFetch=globalThis.fetch;globalThis.fetch=context.fetch;
 try{await context.result.initializeRegionalMaps();}finally{globalThis.fetch=realFetch;}
 return {...context.result,diagnostic:context.result.regionalDiagnostics(),fetched,configured};
}

test('regional Maps accepts loopback HTTP and the emulator gateway only with test mocks',async()=>{
 const source=fs.readFileSync(new URL('apps/app/src/maps/regional-provider.ts',root),'utf8');
 assert.equal((source.match(/alpha-osm-monaco/g)||[]).length,1,'provider id is declared once as dataset data');
 const unset=await regional({testMocks:false,devSurfaces:false,baseUrl:undefined});
 assert.equal(unset.diagnostic.stage,'no-configuration');assert.equal(unset.diagnostic.configured,false);assert.deepEqual(unset.fetched,[]);
 assert.equal(unset.regionalDataset.providerId,'alpha-osm-monaco');assert.equal(unset.regionalDataset.coverage.region,'Monaco');
 for(const baseUrl of ['http://127.0.0.1:47850','http://10.0.2.2:47850']){
  const off=await regional({testMocks:false,devSurfaces:false,baseUrl});
  assert.equal(off.diagnostic.error!==''||off.diagnostic.stage!=='ready',true);assert.deepEqual(off.fetched,[],'flag-off builds reject loopback HTTP before any request');
  const nativeOff=await regional({testMocks:false,devSurfaces:false,baseUrl,native:true});assert.deepEqual(nativeOff.fetched,[]);
 }
 const devWeb=await regional({testMocks:true,devSurfaces:true,baseUrl:'http://127.0.0.1:47850'});
 assert.deepEqual(devWeb.fetched,['http://127.0.0.1:47850/capabilities'],'development server may use the loopback gateway');
 const releaseNative=await regional({testMocks:true,devSurfaces:false,baseUrl:'http://10.0.2.2:47850',native:true,developmentBuild:false});
 assert.deepEqual(releaseNative.fetched,[],'a non-development native build never uses the emulator gateway');
 const https=await regional({testMocks:false,devSurfaces:false,baseUrl:'https://maps.example/'});
 assert.deepEqual(https.fetched,['https://maps.example/capabilities']);
});
