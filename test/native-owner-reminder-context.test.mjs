import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const native=path.resolve('android/app/src/main/java/ai/elizaresearch/alphaphone');
function method(source,start){const at=source.indexOf(start);assert.ok(at>=0,start);let depth=0;for(let i=source.indexOf('{',at);i<source.length;i++){if(source[i]==='{')depth++;else if(source[i]==='}'&&--depth===0)return source.slice(at,i+1);}throw Error('Unclosed method');}
test('actual native owner context checks fresh read-only role/device and protected binding around every exchange',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-native-owner-context-'));
 const java=process.env.JAVA_HOME||'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
 const jar=process.env.ALPHA_JSON_JAR||fs.globSync(path.join(os.homedir(),'.gradle/caches/modules-2/files-2.1/org.json/json/20250517/*/json-20250517.jar'))[0];assert.ok(jar);
 const write=(name,value)=>{const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);return file;};
 try{
 const files=[write('android/content/Context.java','package android.content;public class Context {public Context getApplicationContext(){return this;}}'),write('ai/elizaresearch/alphaphone/NativeOwnerReminderHost.java',fs.readFileSync(path.join(native,'NativeOwnerReminderHost.java'),'utf8'))];
 files.push(write('ai/elizaresearch/alphaphone/AlphaCredentialStore.java','package ai.elizaresearch.alphaphone;class AlphaCredentialStore {AlphaCredentialStore(android.content.Context c){}org.json.JSONObject providerAdmissionSnapshot(){throw new AssertionError("Unexpected production storage in closed fixture");}String readCredentialSlot(String slot){throw new AssertionError("Unexpected production storage in closed fixture");}}'));
 files.push(write('ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java','package ai.elizaresearch.alphaphone;class AlphaLocalAgentPlugin {static org.json.JSONObject captureReminderOwnerSession(){throw new AssertionError("Unexpected native runtime in closed fixture");}static org.json.JSONObject readReminderOwnerRoute(org.json.JSONObject session,String path,org.json.JSONObject headers){throw new AssertionError("Unexpected native runtime in closed fixture");}}'));
 const inbox=fs.readFileSync(path.join(native,'HostedInbox.java'),'utf8'),notices=fs.readFileSync(path.join(native,'HostedResultNotices.java'),'utf8');
 files.push(write('ai/elizaresearch/alphaphone/HostedInbox.java',`package ai.elizaresearch.alphaphone;class HostedInbox {${method(inbox,' static String id(')}}`));
 files.push(write('ai/elizaresearch/alphaphone/HostedResultNotices.java',`package ai.elizaresearch.alphaphone;import java.security.*;import java.nio.charset.*;import java.util.*;class HostedResultNotices {${method(notices,' static String hash(')}}`));
 files.push(write('ai/elizaresearch/alphaphone/OwnerContextTest.java',`package ai.elizaresearch.alphaphone;import org.json.*;import java.util.*;
public class OwnerContextTest {
 static final String OWNER="owned-owner",AGENT="owned-agent",INSTALL="7857ed9e-1bf2-4d8a-a22f-68b1fa8070c3",ENROLL="owned-enrollment",KEY="a".repeat(64);static int cases;
 interface Task{void run()throws Exception;}static void denied(Task task)throws Exception{try{task.run();}catch(SecurityException expected){return;}throw new AssertionError("Expected native refusal");}static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
 static class Ports implements NativeOwnerReminderHost.Ports {
  JSONObject provider=new JSONObject(),session=new JSONObject(),device=new JSONObject();String role="OWNER",mode="session",kind="machine",agent=AGENT,status="running";boolean providerMissing,deviceMissing;int calls,authReads,contextReads;String contextOwner=OWNER,contextEnrollment=ENROLL,contextAgent=AGENT,contextInstallation=INSTALL;long responseExpiry;java.util.function.Consumer<String> after=path->{};
  Ports()throws Exception {responseExpiry=System.currentTimeMillis()+600000;provider.put("provider","elizacloud").put("environment","production").put("accountRef","cloud:production:owned-credential").put("sessionGeneration","stable-native-generation");session.put("ownerId",OWNER).put("token","native-owned-machine-token").put("expiresAt",responseExpiry).put("runtimeDigest","private-runtime-digest");device.put("installationId",INSTALL).put("enrollmentId",ENROLL).put("key",KEY);}
  public JSONObject provider(){if(providerMissing)throw new SecurityException("Legacy provider unavailable");return provider;}
  public JSONObject ownerSession(){return session;}
  public String device(String slot)throws Exception{String expected="device:"+HostedResultNotices.hash(new JSONArray().put("https://device.alpha.invalid").put(OWNER).put(AGENT).toString());check(expected.equals(slot),"Caller chose device slot");return deviceMissing?null:device.toString();}
  public JSONObject exchange(JSONObject captured,String path,JSONObject headers)throws Exception{
   calls++;check(captured.getString("token").equals("native-owned-machine-token"),"Caller supplied machine token");JSONObject body;
   if(path.equals("/api/auth/me")){authReads++;body=new JSONObject().put("identity",new JSONObject().put("id",OWNER).put("kind","owner")).put("access",new JSONObject().put("role",role).put("mode",mode)).put("session",new JSONObject().put("id","native-owned-machine-token").put("kind",kind).put("expiresAt",responseExpiry));}
   else if(path.equals("/api/agents"))body=new JSONObject().put("agents",new JSONArray().put(new JSONObject().put("id",agent).put("status",status)));
   else if(path.equals("/api/client-devices/context")){contextReads++;check(headers.length()==2&&INSTALL.equals(headers.getString("X-Eliza-Device-Id"))&&KEY.equals(headers.getString("X-Eliza-Device-Key")),"Wrong native device proof");body=new JSONObject().put("subjectUserId",contextOwner).put("agentId",contextAgent).put("installationId",contextInstallation).put("enrollmentId",contextEnrollment).put("scope","actual-backend-context");}
   else throw new AssertionError("Setup/write/provider route attempted: "+path);
   after.accept(path);return new JSONObject().put("status",200).put("body",body.toString());
  }
 }
 public static void main(String[] args)throws Exception{
  Ports success=new Ports();JSONObject actual=NativeOwnerReminderHost.read(success);check(actual.length()==8&&OWNER.equals(actual.getString("subjectUserId"))&&AGENT.equals(actual.getString("agentId"))&&ENROLL.equals(actual.getString("enrollmentId"))&&success.authReads==2&&success.contextReads==1,"Fresh owner/context reads missing");check(!actual.toString().contains(KEY)&&!actual.toString().contains("machine-token")&&!actual.toString().contains("runtime-digest"),"Secret projected");cases++;
  for(String role:new String[]{"USER","ADMIN","NONE"}){Ports p=new Ports();p.role=role;denied(()->NativeOwnerReminderHost.read(p));check(p.calls==1&&p.contextReads==0,"Non-owner reached device context");cases++;}
  for(String mode:new String[]{"token","trusted-local"}){Ports p=new Ports();p.mode=mode;denied(()->NativeOwnerReminderHost.read(p));check(p.calls==1,"Bare authority accepted");cases++;}
  Ports kind=new Ports();kind.kind="browser";denied(()->NativeOwnerReminderHost.read(kind));cases++;
  Ports expired=new Ports();expired.session.put("expiresAt",System.currentTimeMillis());denied(()->NativeOwnerReminderHost.read(expired));check(expired.calls==0,"Expired cached session dispatched");cases++;
  Ports legacy=new Ports();legacy.providerMissing=true;denied(()->NativeOwnerReminderHost.read(legacy));check(legacy.calls==0,"Legacy missing generation dispatched");cases++;
  Ports absent=new Ports();absent.deviceMissing=true;denied(()->NativeOwnerReminderHost.read(absent));check(absent.contextReads==0,"Missing enrollment registered/refreshed");cases++;
  for(String field:new String[]{"sessionGeneration","accountRef","environment"}){Ports p=new Ports();p.after=path->{if(path.equals("/api/auth/me"))p.provider.put(field,"replacement");};denied(()->NativeOwnerReminderHost.read(p));check(p.calls==1,"Protected binding changed while await but progressed");cases++;}
  for(String field:new String[]{"token","runtimeDigest","ownerId","expiresAt"}){Ports p=new Ports();p.after=path->{if(path.equals("/api/auth/me"))p.session.put(field,field.equals("expiresAt")?System.currentTimeMillis():"replacement");};denied(()->NativeOwnerReminderHost.read(p));check(p.calls==1,"Native session changed but progressed");cases++;}
  for(String field:new String[]{"key","installationId","enrollmentId"}){Ports p=new Ports();p.after=path->{if(path.equals("/api/client-devices/context"))p.device.put(field,"replacement");};denied(()->NativeOwnerReminderHost.read(p));cases++;}
  for(String mismatch:new String[]{"subject","agent","install","enrollment"}){Ports p=new Ports();if(mismatch.equals("subject"))p.contextOwner="foreign-owner";if(mismatch.equals("agent"))p.contextAgent="foreign-agent";if(mismatch.equals("install"))p.contextInstallation="foreign-install";if(mismatch.equals("enrollment"))p.contextEnrollment="foreign-enrollment";denied(()->NativeOwnerReminderHost.read(p));cases++;}
  Ports revoked=new Ports();revoked.after=path->{if(path.equals("/api/client-devices/context"))revoked.role="USER";};denied(()->NativeOwnerReminderHost.read(revoked));check(revoked.authReads==2,"Final fresh role was not read");cases++;
  Ports renewed=new Ports();renewed.after=path->{if(path.equals("/api/client-devices/context"))renewed.responseExpiry++;};denied(()->NativeOwnerReminderHost.read(renewed));cases++;
  Ports recheck=new Ports();NativeOwnerReminderHost.read(recheck);recheck.contextEnrollment="replacement-enrollment";denied(()->NativeOwnerReminderHost.read(recheck));check(recheck.contextReads==2,"Context cached across uses");cases++;
  System.out.println("PASS "+cases+" native owner/context closed cases");
 }
}`));
 execFileSync(path.join(java,'bin/javac'),['--release','17','-cp',jar,'-d',dir,...files],{timeout:20000});
 const output=execFileSync(path.join(java,'bin/java'),['-cp',dir+path.delimiter+jar,'ai.elizaresearch.alphaphone.OwnerContextTest'],{encoding:'utf8',timeout:20000});assert.match(output,/PASS 27 native owner\/context closed cases/);t.diagnostic(output.trim());
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('actual native owner route helper reads an existing session and refuses setup or late session replacement',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-native-owner-route-')),java=process.env.JAVA_HOME||'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
 const jar=process.env.ALPHA_JSON_JAR||fs.globSync(path.join(os.homedir(),'.gradle/caches/modules-2/files-2.1/org.json/json/20250517/*/json-20250517.jar'))[0];assert.ok(jar);
 const plugin=fs.readFileSync(path.join(native,'AlphaLocalAgentPlugin.java'),'utf8'),session=fs.readFileSync(path.join(native,'ResidentResultSession.java'),'utf8'),inbox=fs.readFileSync(path.join(native,'HostedInbox.java'),'utf8'),notices=fs.readFileSync(path.join(native,'HostedResultNotices.java'),'utf8');
 const javaSource=`import java.util.*;import org.json.*;import java.security.*;import java.nio.charset.*;
public class NativeOwnerRouteTest {
 static final Object lifecycleLock=new Object();static String rootToken="native-root",ownerToken="native-owner-machine",ownerIdentity="native-owner";static long expiresAt=System.currentTimeMillis()+600000;static boolean accepting=true,stopping;
 static class ElizaAgentService {static String root="native-root";static int calls;static Runnable after=()->{};static String localAgentToken(){return root;}static String requestLocalAgent(String raw)throws Exception{JSONObject request=new JSONObject(raw);if(!"GET".equals(request.getString("method"))||request.getInt("timeoutMs")!=3000||request.has("body")||!request.getJSONObject("headers").getString("Authorization").equals("Bearer native-owner-machine"))throw new AssertionError("Wrong native read transport");calls++;after.run();return new JSONObject().put("status",200).put("body","{}").toString();}}
 static class HostedInbox {${method(inbox,' static String id(')}}
 static class HostedResultNotices {${method(notices,' static String hash(')}}
 static class ResidentResultSession {${method(session,' static JSONObject snapshot(')}}
 ${method(plugin,' static JSONObject captureResultSession(')}
 ${method(plugin,' static JSONObject captureReminderOwnerSession(')}
 ${method(plugin,' static JSONObject readReminderOwnerRoute(')}
 ${method(plugin,' private static JSONObject raw(')}
 interface Task{void run()throws Exception;}static void denied(Task task)throws Exception{try{task.run();}catch(SecurityException expected){return;}throw new AssertionError("Expected read refusal");}
 static void reset(){ElizaAgentService.root="native-root";rootToken="native-root";ownerToken="native-owner-machine";ownerIdentity="native-owner";expiresAt=System.currentTimeMillis()+600000;accepting=true;stopping=false;ElizaAgentService.after=()->{};}
 public static void main(String[] args)throws Exception{
  int cases=0;for(String path:new String[]{"/api/auth/me","/api/agents","/api/client-devices/context"}){reset();JSONObject captured=captureReminderOwnerSession();readReminderOwnerRoute(captured,path,null);cases++;}
  for(String path:new String[]{"/api/auth/pair","/api/auth/pair-code","/api/client-devices/register","/api/workflow/execute"}){reset();int before=ElizaAgentService.calls;denied(()->readReminderOwnerRoute(captureReminderOwnerSession(),path,null));if(before!=ElizaAgentService.calls)throw new AssertionError("Setup route dispatched");cases++;}
  for(String changed:new String[]{"root","owner","token","expiry"}){reset();JSONObject captured=captureReminderOwnerSession();ElizaAgentService.after=()->{if(changed.equals("root"))ElizaAgentService.root="replacement-root";if(changed.equals("owner"))ownerIdentity="replacement-owner";if(changed.equals("token"))ownerToken="replacement-machine";if(changed.equals("expiry"))expiresAt=System.currentTimeMillis();};denied(()->readReminderOwnerRoute(captured,"/api/auth/me",null));cases++;}
  reset();ownerToken=null;int before=ElizaAgentService.calls;denied(()->captureReminderOwnerSession());if(before!=ElizaAgentService.calls)throw new AssertionError("Absent session paired");cases++;
  System.out.println("PASS "+cases+" native read-only session route cases");
 }
}`;
 try{fs.writeFileSync(path.join(dir,'NativeOwnerRouteTest.java'),javaSource);execFileSync(path.join(java,'bin/javac'),['--release','17','-cp',jar,'-d',dir,path.join(dir,'NativeOwnerRouteTest.java')],{timeout:20000});const output=execFileSync(path.join(java,'bin/java'),['-cp',dir+path.delimiter+jar,'NativeOwnerRouteTest'],{encoding:'utf8',timeout:20000});assert.match(output,/PASS 12 native read-only session route cases/);t.diagnostic(output.trim());}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
