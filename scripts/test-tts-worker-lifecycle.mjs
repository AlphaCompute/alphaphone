// Exercise the exact patched service with synthetic pipes, without loading native
// assets, starting a provider, or importing the host's credential-bearing entrypoint.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {fileURLToPath} from 'node:url';

const patch=fs.readFileSync(new URL('../patches/eliza/standalone-kokoro-host.patch',import.meta.url),'utf8');
const section=patch.split('+++ b/packages/app/src/api/standalone-kokoro-service.ts\n')[1].split('\ndiff --git ')[0];
const source=section.split('\n').filter(line=>line.startsWith('+')).map(line=>line.slice(1)).join('\n')+'\n';
const children=[];
const imports=new Map([
 ['node:child_process',new vm.SyntheticModule(['spawn'],function(){this.setExport('spawn',()=>{
  const child=new EventEmitter();child.stdin=new PassThrough();child.stdio=[child.stdin,null,null,new PassThrough()];child.killed=false;
  child.kill=signal=>{assert.equal(signal,'SIGKILL');child.killed=true;return true;};children.push(child);return child;
 });})],
 ['node:url',new vm.SyntheticModule(['fileURLToPath'],function(){this.setExport('fileURLToPath',fileURLToPath);})],
]);
const module=new vm.SourceTextModule(stripTypeScriptTypes(source),{initializeImportMeta:meta=>{meta.resolve=()=> 'file:///synthetic-worker.ts';}});
await module.link(name=>{assert.ok(imports.has(name),`Unexpected service import: ${name}`);return imports.get(name);});await module.evaluate();
const Service=module.namespace.StandaloneKokoroService;
const ready=child=>child.stdio[3].emit('data',Buffer.from('{"ready":true}\n'));
const id='00000000-0000-0000-0000-000000000001';

for(const phase of ['boot','synthesis'])for(const stream of ['input','output']){
 const service=new Service();
 try{
  let pending=service.initialize();const child=children.at(-1);
  if(phase==='synthesis'){
   ready(child);await pending;pending=service.synthesize(id,'Synthetic speech',new AbortController().signal);await Promise.resolve();
   assert.equal(service.busy,true);
  }
  const rejected=assert.rejects(pending,/stopped/);
  assert.doesNotThrow(()=>(stream==='input'?child.stdin:child.stdio[3]).emit('error',Error('EPIPE')));
  await rejected;assert.equal(service.initialized,false);assert.equal(service.busy,false);assert.equal(child.killed,true);
  // A late error from the old generation must not retire a newly initialized worker.
  const reboot=service.initialize(),replacement=children.at(-1);assert.notEqual(replacement,child);ready(replacement);await reboot;
  child.stdin.emit('error',Error('late EPIPE'));assert.equal(service.initialized,true);assert.equal(replacement.killed,false);
 }finally{service.stop();}
}
{
 const service=new Service();
 try{
  const boot=service.initialize(),child=children.at(-1);ready(child);await boot;
  const controller=new AbortController(),pending=service.synthesize(id,'Synthetic speech',controller.signal);await Promise.resolve();
  const rejected=assert.rejects(pending,/stopped/);controller.abort();await rejected;
  assert.equal(child.killed,true);assert.equal(service.initialized,false);assert.equal(service.busy,false);
 }finally{service.stop();}
}
{
 const service=new Service();
 try{
  const before=children.length,boot=service.initialize(),child=children.at(-1);
  const controller=new AbortController();
  const speech=service.synthesize(id,'First phrase while startup is warming',controller.signal);
  const rejected=assert.rejects(speech,/stopped/);
  await Promise.resolve();assert.equal(children.length,before+1,'First request shares the cold startup worker');
  assert.equal(service.initialized,false);assert.equal(service.busy,false);
  ready(child);await boot;await Promise.resolve();
  assert.equal(service.initialized,true);assert.equal(service.busy,true);
  controller.abort();await rejected;assert.equal(child.killed,true);
 }finally{service.stop();}
}
console.log('TTS worker boot/synthesis pipe failures, generation fencing and cancellation passed.');
