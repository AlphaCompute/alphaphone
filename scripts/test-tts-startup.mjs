import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

// Execute the shipped patch, with no native assets or provider credentials.
const patch=fs.readFileSync(new URL('../patches/eliza/standalone-kokoro-host.patch',import.meta.url),'utf8');
const section=patch.split('+++ b/packages/app/src/api/standalone-kokoro-routes.ts\n')[1].split('\ndiff --git ')[0];
const source=section.split('\n').filter(line=>line.startsWith('+')).map(line=>line.slice(1)).join('\n');
for(const enabled of [false,true])for(const failure of [false,true]){
 let calls=0,ready=false,warnings=0,exitHandler,release;
 const boot=new Promise((resolve,reject)=>{release=()=>failure?reject(Error('synthetic cold failure')):resolve();});
 class Service{
  get initialized(){return ready;}
  initialize(){calls++;return calls===1?boot.then(()=>{ready=true;}):Promise.resolve().then(()=>{ready=true;});}
  stop(){ready=false;}
 }
 const context=vm.createContext({URL,Map,Date,process:{env:{ELIZA_KOKORO_ENABLED:enabled?'1':'0'},once:(event,fn)=>{assert.equal(event,'exit');exitHandler=fn;}},console:{warn:()=>warnings++}});
 const dependencies=new Map([
  ['./standalone-kokoro-service',{StandaloneKokoroService:Service}],
  ['./auth',{resolveAuthorizedRouteRole:async()=>({ok:true,role:'OWNER',identityId:'synthetic-owner'})}],
  ['./response',{sendJson:(res,status,body)=>Object.assign(res,{status,body})}],
  ['@elizaos/plugin-local-inference/routes/local-inference-tts-route',{sanitizeLocalInferenceSpeechText:value=>value}],
 ]);
 let sanitizerImports=0;
 const module=new vm.SourceTextModule(stripTypeScriptTypes(source),{context,importModuleDynamically:async name=>{
  assert.equal(name,'@elizaos/plugin-local-inference/routes/local-inference-tts-route');sanitizerImports++;
  const helper=new vm.SyntheticModule(['sanitizeLocalInferenceSpeechText'],function(){this.setExport('sanitizeLocalInferenceSpeechText',value=>value);},{context});
  await helper.link(()=>{});await helper.evaluate();return helper;
 }});
 await module.link(name=>{const exports=dependencies.get(name);assert.ok(exports,`Unexpected dependency ${name}`);return new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value]of Object.entries(exports))this.setExport(key,value);},{context});});
 await module.evaluate();
 assert.equal(calls,enabled?1:0,'Only configured hosts warm before any request');
 assert.equal(sanitizerImports,enabled?1:0,'Configured speech preloads its sanitizer without burdening disabled hosts');
 assert.equal(ready,false,'Cold warmup is not already ready');
 if(enabled){release();await new Promise(resolve=>setImmediate(resolve));assert.equal(ready,!failure);assert.equal(warnings,failure?1:0);}
 const res={};
 await module.namespace.handleStandaloneKokoroRoute({method:'GET',url:'/api/tts/kokoro/status'},res,{});
 assert.equal(res.status,200);assert.equal(res.body.ready,enabled);
 assert.equal(calls,enabled?2:0,'Failed startup remains retryable; disabled speech stays unloaded');
 exitHandler();assert.equal(ready,false);
}
console.log('Kokoro warms before requests, reports real readiness, retries failures, and stays unloaded when disabled.');
