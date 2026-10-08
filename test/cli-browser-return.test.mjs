import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {execFileSync} from 'node:child_process';

test('native browser handoff resolves once only after its launch, pause and return',()=>{
 const source=fs.readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaConnectionPlugin.java','utf8');
 const start=source.indexOf(' private static final class Pending'),end=source.indexOf(' private static String required',start);
 assert.ok(start>=0&&end>start);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-browser-return-'));
 const home=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');const bin=name=>home?path.join(home,'bin',name):name;
 try{
 fs.writeFileSync(path.join(dir,'BrowserReturnTest.java'),`import java.net.HttpURLConnection;
public class BrowserReturnTest {
 static class PluginCall{int resolved,rejected;void resolve(){resolved++;}void reject(String message){rejected++;}}
 ${source.slice(start,end)}
 static Pending pending(PluginCall call){Pending p=new Pending();p.browserCall=call;return p;}
 public static void main(String[] args){
  PluginCall call=new PluginCall();Pending p=pending(call);int[] launches={0};
  p.paused();if(p.returned())throw new AssertionError("Old pause admitted");
  p.launch(()->launches[0]++);if(p.returned()||call.resolved!=0)throw new AssertionError("Poll before browser pause");
  p.paused();if(call.resolved!=0)throw new AssertionError("Poll during browser background");
  if(!p.returned()||call.resolved!=1||p.returned()||launches[0]!=1)throw new AssertionError("Return must settle once");
  p.cancel();if(call.rejected!=0)throw new AssertionError("Settled return rejected again");
  for(boolean afterLaunch:new boolean[]{false,true}){
   PluginCall cancelled=new PluginCall();Pending stopped=pending(cancelled);
   if(afterLaunch){stopped.launch(()->{});stopped.paused();}
   stopped.cancel();stopped.cancel();stopped.launch(()->{throw new AssertionError("Cancelled browser launched");});stopped.paused();
   if(stopped.returned()||cancelled.resolved!=0||cancelled.rejected!=1||stopped.browserCall!=null)throw new AssertionError("Cancellation leaked or settled twice");
  }
  PluginCall failed=new PluginCall();Pending missing=pending(failed);missing.launch(()->{throw new IllegalStateException();});missing.paused();
  if(missing.returned()||failed.rejected!=1||missing.browserCall!=null)throw new AssertionError("Launch failure not retired");
  PluginCall destroyed=new PluginCall();Pending closing=pending(destroyed);closing.launch(()->{});closing.paused();closing.cancel();
  if(closing.returned()||destroyed.resolved!=0||destroyed.rejected!=1)throw new AssertionError("Destroy allowed stale completion");
 }
}`);
 execFileSync(bin('javac'),['-d',dir,path.join(dir,'BrowserReturnTest.java')],{timeout:15000});execFileSync(bin('java'),['-cp',dir,'BrowserReturnTest'],{timeout:15000});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
function browser(){
 const f={cancelled:[]};
 const source=fs.readFileSync('apps/app/src/runtime/native-connection.ts','utf8');
 const opener=source.slice(source.indexOf('export async function openConnectionBrowser')).replace('export async function','async function');
 const box={native:{openExternal:input=>{f.input=input;return new Promise(resolve=>f.resume=resolve);},cancel:async input=>f.cancelled.push(input)},crypto,DOMException};
 vm.runInNewContext(stripTypeScriptTypes(opener,{mode:'transform'})+'\nglobalThis.open=openConnectionBrowser;',box);
 f.open=box.open;return f;
}
test('renderer browser return barrier holds polling continuation and removes its abort listener',async()=>{
 const f=browser(),controller=new AbortController();let polls=0;
 const pending=f.open('https://eliza.app/auth/cli-login?session=synthetic',controller.signal).then(()=>polls++);
 await new Promise(r=>setImmediate(r));assert.equal(polls,0);f.resume();await pending;assert.equal(polls,1);
 controller.abort();await new Promise(r=>setImmediate(r));assert.deepEqual(f.cancelled,[]);
});
test('cancel and expiry interrupt a pending native handoff and late return cannot start polling',async()=>{
 for(const reason of [new DOMException('Cancelled','AbortError'),new Error('Expired')]){
  const f=browser(),controller=new AbortController();let polls=0;
  const pending=f.open('https://eliza.app/auth/cli-login?session=synthetic',controller.signal).then(()=>polls++);
  controller.abort(reason);await assert.rejects(pending,error=>error===reason);
  assert.equal(f.cancelled.length,1);assert.equal(f.cancelled[0].requestId,f.input.requestId);
  f.resume();await new Promise(r=>setImmediate(r));assert.equal(polls,0);
 }
});

test('native later foreground admission waits, expires or cancels before dispatch',()=>{
 const source=fs.readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaConnectionPlugin.java','utf8');
 const start=source.indexOf('     synchronized(foregroundLock){',source.indexOf('// Gate only future dispatch.'));
 assert.ok(start>=0);let end=source.indexOf('{',start),depth=1;
 while(depth&&++end<source.length){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;}
 const block=source.slice(start,end+1);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-poll-admission-'));
 const home=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');const bin=name=>home?path.join(home,'bin',name):name;
 try{
 fs.writeFileSync(path.join(dir,'PollAdmissionTest.java'),`public class PollAdmissionTest {
 final Object foregroundLock=new Object();boolean foreground,destroyed;volatile int dispatched;
 static class Pending{volatile boolean cancelled;}
 void request(Pending pending,long expiresAt)throws Exception {${block}dispatched++;}
 void resume(){synchronized(foregroundLock){foreground=true;foregroundLock.notifyAll();}}
 public static void main(String[] args)throws Exception {
  PollAdmissionTest first=new PollAdmissionTest();Pending pending=new Pending();
  Thread worker=new Thread(()->{try{first.request(pending,System.currentTimeMillis()+10000);}catch(Exception e){throw new AssertionError(e);}});worker.start();Thread.sleep(30);
  if(first.dispatched!=0)throw new AssertionError("Background poll dispatched");first.resume();worker.join(1000);if(worker.isAlive()||first.dispatched!=1)throw new AssertionError("Return failed");
  first.foreground=false;Pending next=new Pending();Thread later=new Thread(()->{try{first.request(next,System.currentTimeMillis()+10000);}catch(Exception e){throw new AssertionError(e);}});later.start();Thread.sleep(30);if(first.dispatched!=1)throw new AssertionError("Later background poll dispatched");first.resume();later.join(1000);if(later.isAlive()||first.dispatched!=2)throw new AssertionError("Later return failed");
  for(String mode:new String[]{"expiry","cancel","destroy"}){
   PollAdmissionTest state=new PollAdmissionTest();Pending p=new Pending();java.util.concurrent.atomic.AtomicReference<Exception> error=new java.util.concurrent.atomic.AtomicReference<>();
   Thread waiting=new Thread(()->{try{state.request(p,System.currentTimeMillis()+(mode.equals("expiry")?40:10000));}catch(Exception e){error.set(e);}});waiting.start();Thread.sleep(20);
   if(!mode.equals("expiry")){synchronized(state.foregroundLock){if(mode.equals("cancel"))p.cancelled=true;else state.destroyed=true;state.foregroundLock.notifyAll();}}
   waiting.join(1000);if(waiting.isAlive()||error.get()==null||state.dispatched!=0)throw new AssertionError("Invalid wait admission");state.resume();if(state.dispatched!=0)throw new AssertionError("Stale wait dispatched");
  }
 }
}`);
 execFileSync(bin('javac'),['-d',dir,path.join(dir,'PollAdmissionTest.java')],{timeout:15000});execFileSync(bin('java'),['-cp',dir,'PollAdmissionTest'],{timeout:15000});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
