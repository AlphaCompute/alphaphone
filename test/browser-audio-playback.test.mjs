import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
 let source=readFileSync(new URL('../apps/app/src/browser/voice.ts',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace('export class','class');
 source=source.slice(0,source.indexOf('let database:'))+source.slice(source.indexOf('function playbackWait'));
 const reads=[],audio=[],revoked=[],events=[],spoken=[],timers=new Map();let id=0;
 const document=Object.assign(new EventTarget(),{hidden:false,querySelector:()=>null});
 const engine=Object.assign(new EventTarget(),{voices:[{localService:true,lang:'en-US'}],getVoices(){return this.voices;},cancel(){},speak(value){spoken.push(value);}});
 class Audio{paused=true;ended=false;currentTime=0;constructor(src){this.src=src;this.pending=deferred();audio.push(this);}play(){return this.pending.promise.then(()=>{this.paused=false;});}pause(){this.paused=true;}removeAttribute(){this.src='';}load(){}}
 class WebPlugin{notifyListeners(name,value){events.push({name,...value});return Promise.resolve();}}
 const context={BrowserAudioCapture:class{},WebPlugin,Audio,document,window:Object.assign(new EventTarget(),{speechSynthesis:engine}),navigator:{language:'en-US'},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},AbortController,DOMException,Error,crypto:globalThis.crypto,
  URL:{createObjectURL:()=>`blob:${++id}`,revokeObjectURL:url=>revoked.push(url)},setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),audioRecord:()=>{const request=deferred();reads.push(request);return request.promise;}};
 vm.runInNewContext(stripTypeScriptTypes(source,{mode:'transform'})+'\nglobalThis.Voice=BrowserVoice;',context);
 const voice=new context.Voice();return {voice,reads,audio,revoked,events,spoken,engine,timers,context,async prepare(name='clip'){const playing=voice.play({audioId:name});reads.at(-1).resolve({blob:{}});await tick();return {playing,element:audio.at(-1)};}};
}
test('cancel settles a held database read immediately; late bytes cannot start audio',async()=>{
 const h=harness(),p=h.voice.play({audioId:'old'}),rejected=assert.rejects(p,{name:'AbortError'});await h.voice.stopPlayback();await rejected;h.reads[0].resolve({blob:{}});await tick();assert.equal(h.audio.length,0);assert.equal(h.timers.size,0);
});
test('cancel a held play then start another clip; old resolution cannot resume or clear it',async()=>{
 const h=harness(),first=await h.prepare('old'),rejected=assert.rejects(first.playing,{name:'AbortError'});await h.voice.stopPlayback();await rejected;
 const second=await h.prepare('new');second.element.pending.resolve();await second.playing;first.element.pending.resolve();await tick();
 assert.equal(first.element.paused,true);assert.equal((await h.voice.state()).audioId,'new');assert.equal((await h.voice.state()).playing,true);assert.deepEqual(h.revoked,['blob:2']);await h.voice.stopPlayback();
});
test('autoplay rejection and media end/error release object URLs and retain correct state',async()=>{
 for(const reason of ['reject','end','error']){const h=harness(),item=await h.prepare();
  if(reason==='reject'){const rejected=assert.rejects(item.playing,/Blocked/);item.element.pending.reject(Error('Blocked'));await rejected;}
  else{item.element.pending.resolve();await item.playing;if(reason==='end')item.element.onended();else item.element.onerror();assert.equal(h.events[0].name,reason==='end'?'playbackEnded':'playbackFailed');}
  assert.equal((await h.voice.state()).playing,false);assert.equal(h.revoked.length,1);assert.equal(item.element.src,'');assert.equal(h.timers.size,0);
 }
});
test('late events from a replaced player cannot stop or announce completion for the new player',async()=>{
 const h=harness(),old=await h.prepare();old.element.pending.resolve();await old.playing;const ended=old.element.onended;
 const next=await h.prepare('next');next.element.pending.resolve();await next.playing;ended();assert.equal(h.events.length,0);assert.equal((await h.voice.state()).audioId,'next');await h.voice.stopPlayback();
});
test('play startup timeout settles and cleans its player',async()=>{
 const h=harness(),item=await h.prepare(),rejected=assert.rejects(item.playing,/did not start/);[...h.timers.values()].find(t=>t.delay===5000).fn();await rejected;assert.equal(item.element.paused,true);assert.equal(h.revoked.length,1);assert.equal(h.timers.size,0);
});
test('speech selects a local voice and ignores stale speech events after replacement',async()=>{
 const h=harness();h.engine.voices.unshift({localService:false,lang:'en-US',default:true});const a=await h.voice.synthesizeLocal({text:'First'});await h.voice.play(a);assert.equal(h.spoken[0].voice.localService,true);const late=h.spoken[0].onend;
 const b=await h.voice.synthesizeLocal({text:'Second'});await h.voice.play(b);late();assert.equal(h.events.length,0);h.spoken[1].onend();assert.equal(h.events[0].playbackId,b.playbackId);
});
test('remote-only speech fails without speaking; cancellation removes voice loading listeners and timers',async()=>{
 const h=harness();h.engine.voices=[{localService:false,lang:'en-US'}];const prepared=await h.voice.synthesizeLocal({text:'Keep local'});
 const p=h.voice.play(prepared),rejected=assert.rejects(p,/No local browser voice/);[...h.timers.values()].find(t=>t.delay===1500).fn();await rejected;assert.equal(h.spoken.length,0);
 const waiting=h.voice.play(prepared),cancelled=assert.rejects(waiting,{name:'AbortError'});await h.voice.stopPlayback();await cancelled;assert.equal(h.timers.size,0);
});
