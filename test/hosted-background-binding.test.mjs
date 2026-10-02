import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function harness(native){
 const source=readFileSync(new URL('../apps/app/src/runtime/hosted-background.ts',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace(/export /g,'');
 const context={registerPlugin:()=>native,isAndroid:true,AbortController,crypto:globalThis.crypto,parseDigestResult:x=>x};
 vm.runInNewContext(stripTypeScriptTypes(source,{mode:'transform'})+'\nglobalThis.api={configureHostedBackground,pauseHostedBackground};',context);
 return context.api;
}
test('retiring a session while native begin is pending cancels before configure',async()=>{
 const begun=deferred(),calls=[];
 const api=harness({beginBackground:()=>begun.promise,cancelBackground:async()=>calls.push('cancel'),configureBackground:async()=>calls.push('configure'),disableBackground:async()=>calls.push('disable')});
 const pending=api.configureHostedBackground({sessionId:'old'},new AbortController().signal);
 const rejected=assert.rejects(pending,{name:'AbortError'});
 await api.pauseHostedBackground('old');begun.resolve();await rejected;
 assert.ok(calls.includes('cancel'));assert.ok(!calls.includes('configure'));
});
test('late configure success after disconnect is cancelled; retiring another session does not abort current setup',async()=>{
 const configured=deferred(),entered=deferred(),calls=[];
 const api=harness({beginBackground:async()=>{},cancelBackground:async()=>calls.push('cancel'),configureBackground:async()=>{entered.resolve();await configured.promise;},disableBackground:async({sessionId})=>calls.push(sessionId)});
 const pending=api.configureHostedBackground({sessionId:'current'},new AbortController().signal);
 await entered.promise;await api.pauseHostedBackground('old');
 assert.ok(!calls.includes('cancel'));
 const rejected=assert.rejects(pending,{name:'AbortError'});
 await api.pauseHostedBackground('current');configured.resolve();await rejected;
 assert.ok(calls.includes('cancel'));
});
test('failed configuration retires its reservation before allowing foreground fallback',async()=>{
 const calls=[],cancelled=deferred();
 const api=harness({beginBackground:async()=>{},configureBackground:async()=>{throw Error('unavailable');},cancelBackground:async()=>{calls.push('cancel');await cancelled.promise;}});
 let finished=false;const pending=api.configureHostedBackground({sessionId:'current'},new AbortController().signal).then(value=>{finished=true;return value;});
 await new Promise(r=>setImmediate(r));assert.equal(finished,false);assert.deepEqual(calls,['cancel']);
 cancelled.resolve();assert.equal(await pending,false);
});
