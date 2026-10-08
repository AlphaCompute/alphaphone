import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {execFileSync} from 'node:child_process';
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const source=fs.readFileSync('apps/app/src/runtime/local-agent.ts','utf8');
 const method=source.slice(source.indexOf('  async connect(signal:AbortSignal)'),source.indexOf('  get browserSpeechAvailable'));
 const f={starts:[],cancels:[],requests:[],holdStart:false,holdIdentity:false};
 const bridge={start:async input=>{f.starts.push(input);if(f.holdStart)await new Promise(r=>f.started=r);},cancelStart:async input=>{f.cancels.push(input);}};
 const box={crypto,DOMException,record:v=>v,identifier:v=>v};
 vm.runInNewContext(stripTypeScriptTypes(`class Fixture{generation=0;origin='local';session=null;constructor(bridge){this.bridge=bridge;} ${method}};globalThis.Fixture=Fixture;`,{mode:'transform'}),box);
 f.client=new box.Fixture(bridge);f.client.request=async route=>{f.requests.push(route);if(route==='/api/auth/me'){if(f.holdIdentity)await new Promise(r=>f.identity=r);return{identity:{id:'owner',kind:'owner'},access:{role:'OWNER',mode:'local'}};}return {agents:[{id:'agent',name:'Fixture',status:'running'}]};};return f;
}
test('pre-aborted connect never starts, and a late startup result cannot enroll after cancel',async()=>{
 const f=fixture(),before=new AbortController();before.abort();await assert.rejects(f.client.connect(before.signal));assert.equal(f.starts.length,0);
 f.holdStart=true;const controller=new AbortController(),pending=f.client.connect(controller.signal);await tick();controller.abort();await assert.rejects(pending);assert.equal(f.cancels.length,1);assert.equal(f.cancels[0].requestId,f.starts[0].requestId);f.started();await tick();assert.equal(f.requests.length,0);
});
test('cancellation stays owned through identity checks, while successful connect removes its listener',async()=>{
 const f=fixture();f.holdIdentity=true;const controller=new AbortController(),pending=f.client.connect(controller.signal);await tick();controller.abort();f.identity();await assert.rejects(pending);assert.equal(f.cancels.length,1);
 const ready=fixture(),success=new AbortController();await ready.client.connect(success.signal);success.abort();await tick();assert.equal(ready.cancels.length,0);
});
test('superseded renderer connection cancels only its original startup request',async()=>{
 const f=fixture();f.holdStart=true;const pending=f.client.connect(new AbortController().signal);await tick();f.client.generation++;f.started();await assert.rejects(pending);assert.equal(f.cancels.length,1);assert.equal(f.cancels[0].requestId,f.starts[0].requestId);
});
test('native cancellation stops only current owned launch, preserving reused service and superseding epoch',()=>{
 const source=fs.readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java','utf8');
 const start=source.indexOf(' @PluginMethod public void cancelStart('),end=source.indexOf(' static String startupRefusalMessage',start);assert.ok(start>=0&&end>start);
 const method=source.slice(start,end).replace('@PluginMethod ','');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-start-owner-'));const home=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');const bin=name=>home?path.join(home,'bin',name):name;
 try{fs.writeFileSync(path.join(dir,'StartOwnerTest.java'),`public class StartOwnerTest {
 static final Object lifecycleLock=new Object();static String startRequestId;static long startRequestEpoch,lifecycleEpoch;static boolean startOwnsLaunch,accepting=true,stopping;static int invalidated;
 final java.util.Set<String> cancelledStarts=new java.util.HashSet<>();
 static class PluginCall{String id;int resolved,rejected;PluginCall(String id){this.id=id;}String getString(String key,String fallback){return id;}void reject(String message){rejected++;}void resolve(){resolved++;}}
 static class ElizaAgentService{static int stops;static void stop(Object context){stops++;}}
 Object getContext(){return null;}static void invalidateCalls(){invalidated++;}static void clearEnrollment(){}
 ${method}
 static final String A="72475cd0-e135-4c42-a9e2-fb5fe0820ada",B="d32f7f34-962b-47b7-8f0d-f2fe7f12610a";
 static void reset(String id,boolean owned){startRequestId=id;startRequestEpoch=lifecycleEpoch=10;startOwnsLaunch=owned;accepting=true;stopping=false;invalidated=0;ElizaAgentService.stops=0;}
 public static void main(String[] args){
  StartOwnerTest h=new StartOwnerTest();reset(null,false);h.cancelStart(new PluginCall(A));if(!h.cancelledStarts.remove(A)||ElizaAgentService.stops!=0)throw new AssertionError("Pre-admission cancel lost");
  reset(A,true);PluginCall cancelled=new PluginCall(A);h.cancelStart(cancelled);if(ElizaAgentService.stops!=1||!stopping||accepting||cancelled.resolved!=1||lifecycleEpoch!=11)throw new AssertionError("Owned launch survived");h.cancelStart(new PluginCall(A));if(ElizaAgentService.stops!=1)throw new AssertionError("Duplicate stop");
  reset(A,false);h.cancelStart(new PluginCall(A));if(ElizaAgentService.stops!=0||stopping||!accepting)throw new AssertionError("Reused service stopped");
  reset(B,true);h.cancelStart(new PluginCall(A));if(ElizaAgentService.stops!=0||!B.equals(startRequestId)||lifecycleEpoch!=10)throw new AssertionError("Newer launch stopped");
  reset(A,true);lifecycleEpoch=11;h.cancelStart(new PluginCall(A));if(ElizaAgentService.stops!=0||invalidated!=0)throw new AssertionError("Stale epoch stopped");
 }
}`);execFileSync(bin('javac'),['-d',dir,path.join(dir,'StartOwnerTest.java')],{timeout:15000});execFileSync(bin('java'),['-cp',dir,'StartOwnerTest'],{timeout:15000});}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
