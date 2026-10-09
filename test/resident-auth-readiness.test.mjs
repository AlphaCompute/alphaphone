import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
test('actual native startup and enrollment authenticate stable boot token before pairing without replay',()=>{
 const source=fs.readFileSync(path.join(root,'android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java'),'utf8');
 const methods=source.slice(source.indexOf(' private void requireEnrollmentRoot('),source.indexOf(' @PluginMethod public void request('));
 const current=source.slice(source.indexOf(' private void requireCurrent('),source.indexOf(' private long admittedEpoch('));
 const loop=source.slice(source.indexOf('    long deadline=android.os.SystemClock.elapsedRealtime()+90000;'),source.indexOf('    if(ready){'));
 assert.ok(methods.includes('private String enroll(')&&current.includes('throw new Superseded()')&&loop.includes('authenticatedStatus(epoch,root)'));
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-native-auth-'));
 try{
  fs.mkdirSync(path.join(fixture,'android/os'),{recursive:true});
  fs.writeFileSync(path.join(fixture,'android/os/SystemClock.java'),'package android.os; public final class SystemClock {public static long time;public static long elapsedRealtime(){return time;}}');
  fs.writeFileSync(path.join(fixture,'NativeAuthFlow.java'),String.raw`import java.util.*;
public class NativeAuthFlow {
 static String rootToken,ownerToken,ownerIdentity;static long expiresAt,lifecycleEpoch=1;
 static Object lifecycleLock=new Object(),enrollmentLock=new Object();static boolean accepting=true;boolean disposed;
 static String scenario;static int probes,codes,pairs,me,rotations;static List<String> paths=new ArrayList<>();
 static class Superseded extends Exception{}
 static class PluginCall{boolean rejected;}
 static class Thread{static void sleep(long value)throws InterruptedException{android.os.SystemClock.time+=value;}static Thread currentThread(){return new Thread();}void interrupt(){}}
 static class JSONObject{Map<String,Object> values=new HashMap<>();JSONObject put(String key,Object value){values.put(key,value);return this;}Object opt(String key){return values.get(key);}String getString(String key)throws Exception{Object value=values.get(key);if(!(value instanceof String))throw new Exception("missing string");return(String)value;}JSONObject getJSONObject(String key)throws Exception{Object value=values.get(key);if(!(value instanceof JSONObject))throw new Exception("missing object");return(JSONObject)value;}long getLong(String key)throws Exception{Object value=values.get(key);if(!(value instanceof Long))throw new Exception("missing long");return(Long)value;}}
 static class ElizaAgentService{static String token;static String localAgentToken(){return token;}static JSONObject getLocalAgentBootState(Object ignored){return new JSONObject();}}
 Object getContext(){return this;}
 boolean rejectStartupRefusal(PluginCall call,long epoch,JSONObject state)throws Superseded{requireCurrent(epoch);return false;}
 void rejectSuperseded(PluginCall call){call.rejected=true;}
 ${current}
 ${methods}
 void startup(PluginCall call)throws Exception{long epoch=lifecycleEpoch;
 ${loop}
 if(ready)enroll(epoch);else throw new Exception("startup timeout");
 }
 static void check(boolean value){if(!value)throw new AssertionError();}
 static JSONObject json(String route,String method,JSONObject body,String token)throws Exception{
  paths.add(route);
  if(route.equals("/api/auth/status")){
   probes++;Object auth=Boolean.TRUE;
   if(scenario.equals("false")||scenario.equals("transient")&&probes==1)auth=Boolean.FALSE;
   if(scenario.equals("missing"))auth=null;
   if(scenario.equals("string"))auth="true";
   if(scenario.equals("rotation")&&probes==1){ElizaAgentService.token="new-boot";rotations++;}
   if(scenario.equals("epoch")&&probes==1)lifecycleEpoch++;
   return new JSONObject().put("instanceId","same-instance").put("authenticated",auth);
  }
  if(route.equals("/api/auth/pair-code")){codes++;check(token.equals(ElizaAgentService.token));if(scenario.equals("code-rotation"))ElizaAgentService.token="new-boot";if(scenario.equals("code-ambiguous"))throw new Exception("lost code reply");return new JSONObject().put("code","synthetic");}
  if(route.equals("/api/auth/pair")){pairs++;check(token.equals(ElizaAgentService.token));if(scenario.equals("post-rotation"))ElizaAgentService.token="new-boot";if(scenario.equals("post-ambiguous"))throw new Exception("lost paired reply");return new JSONObject().put("access","owner").put("instanceId","same-instance").put("token","native-session").put("identityId","owner");}
  if(route.equals("/api/auth/me")){me++;check(token.equals("native-session"));if(scenario.equals("me-rotation"))ElizaAgentService.token="new-boot";return new JSONObject().put("access",new JSONObject().put("role","OWNER")).put("identity",new JSONObject().put("id","owner")).put("session",new JSONObject().put("id","native-session").put("expiresAt",System.currentTimeMillis()+3600000));}
  throw new AssertionError(route);
 }
 static NativeAuthFlow reset(String value){scenario=value;probes=codes=pairs=me=rotations=0;paths.clear();rootToken=ownerToken=ownerIdentity=null;expiresAt=0;lifecycleEpoch=1;accepting=true;android.os.SystemClock.time=0;ElizaAgentService.token="old-boot";return new NativeAuthFlow();}
 public static void main(String[] args)throws Exception{
  for(String value:new String[]{"ready","transient","rotation"}){NativeAuthFlow flow=reset(value);flow.startup(new PluginCall());check(codes==1&&pairs==1&&me==1&&rootToken.equals(ElizaAgentService.token));check(probes==(value.equals("ready")?2:3));int count=paths.size();flow.enroll(1);check(paths.size()==count);}
  for(String value:new String[]{"false","missing","string"}){
   NativeAuthFlow flow=reset(value);try{flow.startup(new PluginCall());throw new AssertionError();}catch(Exception expected){}check(codes==0&&pairs==0&&android.os.SystemClock.time==90000&&ownerToken==null);
   flow=reset(value);try{flow.enroll(1);throw new AssertionError();}catch(Exception expected){}check(probes==1&&codes==0&&pairs==0&&ownerToken==null);
  }
  NativeAuthFlow flow=reset("epoch");PluginCall call=new PluginCall();flow.startup(call);check(call.rejected&&codes==0&&pairs==0&&ownerToken==null);
  for(String value:new String[]{"code-rotation","code-ambiguous","post-rotation","post-ambiguous","me-rotation"}){flow=reset(value);try{flow.startup(new PluginCall());throw new AssertionError();}catch(Exception expected){}check(codes==1&&pairs==(value.startsWith("code-")?0:1)&&ownerToken==null);}
  System.out.println("PASS actual native startup/enrollment: stable authenticated token, readonly polling, epoch fences, exact single pairing dispatch, uncertain response refusal");
 }
}`);
  const java=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');const binary=name=>java?path.join(java,'bin',name):name;
  execFileSync(binary('javac'),['--release','8','-d',fixture,path.join(fixture,'android/os/SystemClock.java'),path.join(fixture,'NativeAuthFlow.java')],{timeout:20000});
  assert.match(execFileSync(binary('java'),['-cp',fixture,'NativeAuthFlow'],{encoding:'utf8',timeout:20000}),/^PASS actual native startup\/enrollment/);
 }finally{fs.rmSync(fixture,{recursive:true,force:true});}
});


test('actual native navigation and edit admission require a nonblank owner before lifecycle enqueue',()=>{
 const source=fs.readFileSync(path.join(root,'android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java'),'utf8');
 const start=source.indexOf('public void request(PluginCall call) {');
 const admission=source.slice(start,source.indexOf('  JSONObject headers=call.getObject("headers");',start));
 assert.ok(admission.startsWith('public void request(')&&admission.includes('call.reject('));
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-navigation-admission-'));
 try{
  fs.writeFileSync(path.join(fixture,'NavigationAdmission.java'),String.raw`import java.util.*;
public class NavigationAdmission {
 int admitted;
 static class PluginCall {
  final Map<String,Object> data=new HashMap<>();int rejected;
  PluginCall(String path,String method,Object owner){data.put("path",path);data.put("method",method);if(owner!=null)data.put("ownerId",owner);}
  String getString(String key){Object value=data.get(key);return value instanceof String?(String)value:null;}
  String getString(String key,String fallback){String value=getString(key);return value==null?fallback:value;}
  void reject(String message){rejected++;}
 }
 ${admission}
 admitted++;}
 static void check(boolean value){if(!value)throw new AssertionError();}
 public static void main(String[] args){
  NavigationAdmission host=new NavigationAdmission();
  for(String route:new String[]{"/api/views/interact-claim","/api/views/interact-result","/api/conversations/owned-room/messages/truncate"}){
   for(Object owner:new Object[]{null,"","  ",42}){PluginCall call=new PluginCall(route,"POST",owner);int before=host.admitted;host.request(call);check(call.rejected==1&&host.admitted==before);}
   for(String method:new String[]{"GET","DELETE"}){PluginCall call=new PluginCall(route,method,"owner");int before=host.admitted;host.request(call);check(call.rejected==1&&host.admitted==before);}
   PluginCall call=new PluginCall(route,"POST","owner");int before=host.admitted;host.request(call);check(call.rejected==0&&host.admitted==before+1);
  }
  for(String route:new String[]{"/api/views/interact","/api/views/interact-claim?x=1","/api/views/interact-result/extra"}){PluginCall call=new PluginCall(route,"POST","owner");int before=host.admitted;host.request(call);check(call.rejected==1&&host.admitted==before);}
  PluginCall bootstrap=new PluginCall("/api/auth/me","GET",null);int before=host.admitted;host.request(bootstrap);check(bootstrap.rejected==0&&host.admitted==before+1);
  System.out.println("PASS actual native navigation and edit admission owner, method, closed routes and legacy bootstrap");
 }
}`);
  const java=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');const binary=name=>java?path.join(java,'bin',name):name;
  execFileSync(binary('javac'),['--release','8','-d',fixture,path.join(fixture,'NavigationAdmission.java')],{timeout:20000});
  assert.match(execFileSync(binary('java'),['-cp',fixture,'NavigationAdmission'],{encoding:'utf8',timeout:20000}),/^PASS actual native navigation and edit admission/);
 }finally{fs.rmSync(fixture,{recursive:true,force:true});}
});
