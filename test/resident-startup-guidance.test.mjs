import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
test('actual native startup refusal preserves epoch and pending-call ownership',()=>{
 const source=fs.readFileSync(path.join(root,'android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java'),'utf8');
 const start=source.indexOf(' static String startupRefusalMessage('),end=source.indexOf(' private static boolean shutdownConfirmed(',start);
 assert.ok(start>=0&&end>start);
 const actual=source.slice(start,end);
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-startup-guidance-'));
 try{
  fs.writeFileSync(path.join(fixture,'Guidance.java'),`import java.util.*;
public class Guidance {
 static Object lifecycleLock=new Object();static Set<PluginCall> pending=new HashSet<>();long epoch=2;
 static class Superseded extends Exception{}
 void requireCurrent(long value)throws Superseded{if(value!=epoch)throw new Superseded();}
 static class JSONObject{String value;JSONObject(String v){value=v;}String optString(String ignored){return value;}}
 static class PluginCall{int rejected;String code;void reject(String message,String reason){rejected++;code=reason;}}
 ${actual}
 static void check(boolean result){if(!result)throw new AssertionError();}
 public static void main(String[] args)throws Exception{
  Guidance owner=new Guidance();PluginCall old=new PluginCall(),current=new PluginCall();pending.add(old);pending.add(current);
  try{owner.rejectStartupRefusal(old,1,new JSONObject("ipc-recovery-required"));throw new AssertionError();}catch(Superseded expected){}
  check(old.rejected==0&&pending.contains(old)&&pending.contains(current));
  check(!owner.rejectStartupRefusal(current,2,new JSONObject("starting")));check(pending.contains(current));
  check(owner.rejectStartupRefusal(current,2,new JSONObject("ipc-recovery-retention-limit")));check(current.rejected==1&&!pending.contains(current)&&pending.contains(old));
  owner.rejectStartupRefusal(current,2,new JSONObject("ipc-recovery-required"));check(current.rejected==1);
  check(startupRefusalMessage("ipc-recovery-retention-limit").contains("will not clear this limit"));
  check(startupRefusalMessage("ipc-recovery-required").contains("do not clear app data"));
  check(startupRefusalMessage("runtime-identity-unavailable")!=null);check(startupRefusalMessage("unknown")==null);
  System.out.println("PASS actual native refusal ownership, unknown status, retained record guidance");
 }
}`);
  const java=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');
  const binary=name=>java?path.join(java,'bin',name):name;
  execFileSync(binary('javac'),['--release','8','-d',fixture,path.join(fixture,'Guidance.java')],{timeout:20000});
  assert.match(execFileSync(binary('java'),['-cp',fixture,'Guidance'],{encoding:'utf8',timeout:20000}),/^PASS actual native refusal/);
 }finally{fs.rmSync(fixture,{recursive:true,force:true});}
});
