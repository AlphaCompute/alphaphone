import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function harness(){
 const streams=[],recorders=[],requests=[],events=[],timers=new Map();let token=0,fail='',held=false;
 const stream=()=>{const track={stopped:false,stop(){this.stopped=true;}};const value={getTracks:()=>[track],track};streams.push(value);return value;};
 class Recorder {
  static isTypeSupported(type){return type==='audio/webm;codecs=opus';}
  state='inactive';mimeType='audio/webm';
  constructor(){if(fail==='constructor')throw Error('Constructor failed');recorders.push(this);}
  start(){if(fail==='start')throw Error('Start failed');this.state='recording';}
  stop(){this.state='inactive';if(!held)this.finish();}
  finish(){this.ondataavailable?.({data:new Blob(['audio'])});this.onstop?.();}
 }
 const context={navigator:{mediaDevices:{getUserMedia:()=>{const d=deferred();requests.push(d);return d.promise;}}},document:{hidden:false},MediaRecorder:Recorder,Blob,crypto:globalThis.crypto,DOMException,Date,Error,setTimeout:(fn,delay)=>{timers.set(++token,{fn,delay});return token;},clearTimeout:id=>timers.delete(id)};
 context.BrowserMicrophone=class{open(){return context.navigator.mediaDevices.getUserMedia();}close(){}};
 const source=readFileSync(new URL('../apps/app/src/browser/audio-capture.ts',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace('export class','class');
 vm.runInNewContext(stripTypeScriptTypes(source,{mode:'transform'})+'\nglobalThis.Capture=BrowserAudioCapture;',context);
 const capture=new context.Capture(e=>events.push(e));
 return {capture,streams,recorders,requests,events,timers,context,stream,setFail:v=>fail=v,hold:v=>held=v,async start(){const p=capture.start();requests.at(-1).resolve(stream());return p;}};
}
test('overlapping permission requests release the older stream without disturbing the newer recording',async()=>{
 const h=harness(),old=h.capture.start(),rejected=assert.rejects(old,{name:'AbortError'}),fresh=h.capture.start();
 h.requests[1].resolve(h.stream());const current=await fresh;
 h.requests[0].resolve(h.stream());await rejected;
 assert.equal(h.streams[0].track.stopped,false);assert.equal(h.streams[1].track.stopped,true);
 const result=await h.capture.stop();assert.equal(result.recordingId,current.recordingId);assert.ok(h.capture.get(current.recordingId));assert.ok(h.streams.every(s=>s.track.stopped));
});
test('constructor and start failures release their microphone and permit a retry',async()=>{
 for(const failure of ['constructor','start']){const h=harness();h.setFail(failure);await assert.rejects(h.start(),/failed/);assert.ok(h.streams[0].track.stopped);h.setFail('');await h.start();await h.capture.stop();assert.equal(h.timers.size,0);}
});
test('cancel while stopping rejects the old clip; late stop cannot clear a new recording or its timer',async()=>{
 const h=harness();h.hold(true);const old=await h.start();const stop=h.capture.stop(),rejected=assert.rejects(stop,{name:'AbortError'});
 h.capture.cancel();await rejected;const fresh=await h.start();h.recorders[0].finish();assert.equal(h.capture.get(old.recordingId),undefined);
 assert.equal(h.streams[1].track.stopped,false);assert.equal(h.timers.size,1);
 h.hold(false);assert.equal((await h.capture.stop()).recordingId,fresh.recordingId);
});
test('duplicate stops share one result and automatic stop retains one usable clip',async()=>{
 const h=harness();h.hold(true);await h.start();const a=h.capture.stop(),b=h.capture.stop();h.recorders[0].finish();assert.deepEqual(await a,await b);
 h.hold(false);const fresh=await h.start();[...h.timers.values()][0].fn();await new Promise(r=>setImmediate(r));assert.equal(h.events.length,1);assert.equal(h.events[0].recordingId,fresh.recordingId);assert.ok(h.capture.get(fresh.recordingId));
});
test('hidden page or cancellation during permission releases late media',async()=>{
 for(const hide of [true,false]){const h=harness(),pending=h.capture.start(),rejected=assert.rejects(pending,{name:'AbortError'});if(hide)h.context.document.hidden=true;else h.capture.cancel();h.requests[0].resolve(h.stream());await rejected;assert.ok(h.streams[0].track.stopped);assert.equal(h.recorders.length,0);}
});
test('recorder error, oversized audio, and missing stop callback cannot retain microphone ownership',async()=>{
 for(const mode of ['error','size','timeout']){const h=harness();h.hold(true);const result=await h.start();
  if(mode==='error')h.recorders[0].onerror();
  if(mode==='size')h.recorders[0].ondataavailable({data:{size:16_000_001}});
  const stop=h.capture.stop(),rejected=assert.rejects(stop);
  if(mode==='timeout')[...h.timers.values()].find(t=>t.delay===5000).fn();
  await rejected;assert.ok(h.streams[0].track.stopped);assert.equal(h.capture.get(result.recordingId),undefined);assert.equal(h.timers.size,0);
 }
});
test('reject invalid capture limits before permission and bound retained clips',async()=>{
 const h=harness();for(const value of [0,-1,Infinity,NaN,59001])await assert.rejects(h.capture.start({maxDurationMs:value}));assert.equal(h.requests.length,0);
 const ids=[];for(let i=0;i<5;i++){ids.push((await h.start()).recordingId);await h.capture.stop();}
 assert.equal(h.capture.get(ids[0]),undefined);assert.ok(h.capture.get(ids[4]));h.capture.clear();assert.equal(h.capture.get(ids[4]),undefined);
});

test('a device-ended recording publishes its final clip without waiting for a manual stop',async()=>{
 const h=harness(),started=await h.start();h.recorders[0].state='inactive';h.recorders[0].finish();await new Promise(r=>setImmediate(r));
 assert.equal(h.events.length,1);assert.equal(h.events[0].recordingId,started.recordingId);assert.ok(h.capture.get(started.recordingId));assert.equal(h.timers.size,0);
});
