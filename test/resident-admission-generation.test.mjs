import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const native=path.resolve('android/app/src/main/java/ai/elizaresearch/alphaphone');
const plugin=fs.readFileSync(path.join(native,'AlphaLocalAgentPlugin.java'),'utf8');
function method(start){const at=plugin.indexOf(start);assert.ok(at>=0,start);let depth=0;for(let i=plugin.indexOf('{',at);i<plugin.length;i++){if(plugin[i]==='{')depth++;else if(plugin[i]==='}'&&--depth===0)return plugin.slice(at,i+1);}throw Error('Unclosed method');}
test('actual native provider/store keeps durable admission separate from CAS and invalidates credential replacement',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-provider-admission-'));
 const java=process.env.JAVA_HOME||'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
 const jar=process.env.ALPHA_JSON_JAR||fs.globSync(path.join(os.homedir(),'.gradle/caches/modules-2/files-2.1/org.json/json/20250517/*/json-20250517.jar'))[0];
 assert.ok(jar,'Pinned org.json jar required');
 const write=(file,text)=>{const p=path.join(dir,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);return p;};
 const sourceFiles=[];
 try{
 sourceFiles.push(write('android/content/Context.java',`package android.content;public class Context {public Context getApplicationContext(){return this;}public java.io.File getNoBackupFilesDir(){return new java.io.File(".");}}`));
 sourceFiles.push(write('android/os/SystemClock.java','package android.os;public class SystemClock {public static long elapsedRealtime(){return System.nanoTime()/1000000;}}'));
 sourceFiles.push(write('ai/elizaresearch/alphaphone/AlphaConnectionPlugin.java','package ai.elizaresearch.alphaphone;class AlphaConnectionPlugin {static org.json.JSONObject readCloudIdentity(String token)throws Exception{return new org.json.JSONObject().put("userId","cf67e311-fec4-40a9-87fa-c6f02f6f11f0").put("organizationId","90b3f419-2590-4276-87ae-0e3c2f61ed1a");}}'));
 sourceFiles.push(write('ai/elizaresearch/alphaphone/ElizaAgentService.java','package ai.elizaresearch.alphaphone;class ElizaAgentService {static long stopForCredentialChange(android.content.Context c){return 1;}static boolean isCredentialShutdownConfirmed(long request){return true;}static void stop(android.content.Context c){}static org.json.JSONObject getLocalAgentBootState(android.content.Context c)throws Exception{return new org.json.JSONObject().put("state","dead").put("serviceActive",false).put("socketListening",false);}}'));
 sourceFiles.push(write('android/util/AtomicFile.java',`package android.util;public class AtomicFile {}`));
 sourceFiles.push(write('com/getcapacitor/JSObject.java',`package com.getcapacitor;public class JSObject extends org.json.JSONObject {public JSObject put(String k,Object v){try{super.put(k,v);return this;}catch(org.json.JSONException e){throw new IllegalArgumentException(e);}}public JSObject put(String k,boolean v){try{super.put(k,v);return this;}catch(org.json.JSONException e){throw new IllegalArgumentException(e);}}}`));
 sourceFiles.push(write('ai/eliza/plugins/securestore/nativeonly/JsonCredentialSlots.java',`package ai.eliza.plugins.securestore.nativeonly;
import java.util.*;import java.io.*;import android.util.AtomicFile;
public class JsonCredentialSlots {
 public static final Object LOCK=new Object();public interface Limits{int maxBytes(String name);}
 public static final Map<String,String> values=new HashMap<>();public static java.util.function.Consumer<String> onRead=n->{};public static String failWrite;
 public JsonCredentialSlots(File f,String a,Limits l){}public String slotHash(String n){return n;}public AtomicFile slotFile(String h){return null;}
 public String read(String n){synchronized(LOCK){onRead.accept(n);return values.get(n);}}
 public void write(String n,String v)throws Exception{synchronized(LOCK){if(n.equals(failWrite))throw new IOException("Synthetic write failed");new org.json.JSONTokener(v).nextValue();values.put(n,v);}}
 public void remove(String n){synchronized(LOCK){values.remove(n);}}
 public boolean compareExchange(String n,String e,String v)throws Exception{synchronized(LOCK){if(!Objects.equals(read(n),e))return false;if(v==null)remove(n);else write(n,v);return true;}}
}`));
 for(const name of ['AlphaCredentialStore','LocalAgentProviderAdmission'])sourceFiles.push(write(`ai/elizaresearch/alphaphone/${name}.java`,fs.readFileSync(path.join(native,name+'.java'),'utf8')));
 const constants=['CLOUD_PROVIDER_MODEL','PROVIDER_MODEL_PATTERN','CEREBRAS_PROVIDER_MODEL'].map(name=>plugin.match(new RegExp(' static final String '+name+'=[^;]+;'))[0]).join('\n');
 sourceFiles.push(write('ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java',`package ai.elizaresearch.alphaphone;import android.content.Context;import org.json.*;import com.getcapacitor.JSObject;public class AlphaLocalAgentPlugin {static final Object lifecycleLock=new Object();static long lifecycleEpoch,credentialIntentEpoch,credentialMutationEpoch=-1,credentialShutdownRequest=-1;static String startRequestId;static boolean startOwnsLaunch,accepting=true,stopping;static class Superseded extends Exception{}static void invalidateCalls(){}static void clearEnrollment(){}${plugin.slice(plugin.indexOf(' static long reserveCredentialIntent()'),plugin.indexOf(' private void requireCurrent'))}${method(' private static boolean shutdownConfirmed(')}${constants}\n${[' static boolean validProviderToken(',' static String cloudProviderToken(',' static void bindCloudProvider(',' static void bindDirectProvider(',' static JSObject providerIdentity('].map(method).join('\n')}}`));
 sourceFiles.push(write('ai/elizaresearch/alphaphone/AdmissionTest.java',`package ai.elizaresearch.alphaphone;
import java.util.*;import org.json.*;import ai.eliza.plugins.securestore.nativeonly.JsonCredentialSlots;
public class AdmissionTest {
 static final String SLOT="local-agent-provider:v1",CLOUD="cloud:production",ID="d32f7f34-962b-47b7-8f0d-f2fe7f12610a";
 static AlphaCredentialStore store=new AlphaCredentialStore(new android.content.Context());static int cases;
 static void check(boolean v,String why){if(!v)throw new AssertionError(why);}
 interface Task{void run()throws Exception;}static void refuses(Task t)throws Exception{try{t.run();}catch(Exception e){return;}throw new AssertionError("Expected refusal");}
 static String credential(String token,String user)throws Exception{return new JSONObject().put("credentialId",ID).put("token",token).put("userId",user).put("organizationId","synthetic-org").toString();}
 static String generation()throws Exception{return store.providerAdmissionGeneration();}
 static void bind()throws Exception{AlphaLocalAgentPlugin.bindCloudProvider(store,ID,AlphaLocalAgentPlugin.CLOUD_PROVIDER_MODEL);}
 public static void main(String[] args)throws Exception {
  String original=credential("synthetic-token","synthetic-owner");store.writeCredentialSlot(CLOUD,original);bind();String first=generation(),firstBytes=store.readCredentialSlot(SLOT),revision=new JSONObject(firstBytes).getString("revision");
  check(first!=null,"Explicit native binding missing generation");cases++;
  JSONObject projection=store.providerAdmissionSnapshot();check(projection.length()==4&&first.equals(projection.getString("sessionGeneration"))&&!projection.toString().contains("admissionFingerprint")&&!projection.toString().contains("synthetic-token"),"Private provider snapshot leaked or minted identity");
  bind();check(first.equals(generation()),"Identical restore changed stable generation");check(!revision.equals(new JSONObject(store.readCredentialSlot(SLOT)).getString("revision")),"CAS revision did not rotate");cases++;
  String beforeRead=store.readCredentialSlot(SLOT);check(first.equals(generation())&&beforeRead.equals(store.readCredentialSlot(SLOT)),"Read mutated authority");cases++;
  for(String changed:new String[]{credential("replacement-token","synthetic-owner"),credential("synthetic-token","other-owner"),new JSONObject(original).put("credentialId",UUID.randomUUID().toString()).toString(),new JSONObject(original).put("organizationId","other-org").toString()}){
   store.writeCredentialSlot(CLOUD,changed);check(generation()==null,"Replacement kept admission");store.writeCredentialSlot(CLOUD,original);check(generation()==null,"Restored credential bytes revived old generation");bind();check(!first.equals(generation()),"Old generation reminted");first=generation();cases++;
  }
  store.removeCredentialSlot(CLOUD);check(generation()==null,"Logout kept generation");store.writeCredentialSlot(CLOUD,original);check(generation()==null,"Logout restoration revived grant");bind();check(!first.equals(generation()),"Logout old generation reused");cases++;
  first=generation();String oldProvider=store.readCredentialSlot(SLOT);store.removeCredentialSlot(CLOUD);store.writeCredentialSlot(CLOUD,original);store.writeCredentialSlot(SLOT,oldProvider);check(generation()==null,"Raw old provider bytes imported authority");bind();check(!first.equals(generation()),"Old provider bytes revived generation");cases++;
  String cloudGen=generation();AlphaLocalAgentPlugin.bindDirectProvider(store,"synthetic-direct-key","model-a");String direct=generation();check(direct!=null&&!cloudGen.equals(direct),"Provider replacement kept generation");AlphaLocalAgentPlugin.bindDirectProvider(store,"synthetic-direct-key","model-a");check(direct.equals(generation()),"Direct identical restore changed generation");AlphaLocalAgentPlugin.bindDirectProvider(store,"synthetic-direct-key","model-b");check(!direct.equals(generation()),"Model replacement kept generation");direct=generation();AlphaLocalAgentPlugin.bindDirectProvider(store,"replacement-direct-key","model-b");check(!direct.equals(generation()),"Direct key replacement kept generation");cases++;
  bind();first=generation();String winner=store.readCredentialSlot(SLOT);check(!store.compareExchangeCredentialSlot(SLOT,"stale",oldProvider),"Stale rollback won");check(winner.equals(store.readCredentialSlot(SLOT))&&first.equals(generation()),"Stale rollback changed winner");check(store.compareExchangeProviderAdmission("stale",winner,CLOUD,original,AlphaConnectionPlugin.readCloudIdentity("synthetic-token"))==null,"Stale admission replaced winner");check(first.equals(generation()),"Failed admission changed winner");cases++;
  check(!store.compareExchangeCredentialSlot(CLOUD,"stale",credential("replacement-token","synthetic-owner")),"Stale credential CAS won");check(first.equals(generation()),"Failed credential CAS invalidated winner");cases++;
  JsonCredentialSlots.failWrite=CLOUD;refuses(()->store.writeCredentialSlot(CLOUD,credential("replacement-token","synthetic-owner")));JsonCredentialSlots.failWrite=null;check(generation()==null&&original.equals(store.readCredentialSlot(CLOUD)),"Failed credential mutation preserved stale grant");bind();check(!first.equals(generation()),"Failed write old generation reused");cases++;
  String eligible=store.readCredentialSlot(SLOT);JsonCredentialSlots.failWrite=SLOT;refuses(()->store.removeCredentialSlot(CLOUD));JsonCredentialSlots.failWrite=null;check(original.equals(store.readCredentialSlot(CLOUD))&&eligible.equals(store.readCredentialSlot(SLOT)),"Failed invalidation mutated credential");cases++;
  JSONObject legacy=new JSONObject(eligible);legacy.remove("admissionGeneration");legacy.remove("admissionFingerprint");store.writeCredentialSlot(SLOT,legacy.toString());String legacyBytes=store.readCredentialSlot(SLOT);check(generation()==null&&legacyBytes.equals(store.readCredentialSlot(SLOT)),"Legacy read minted/migrated");cases++;
  JSONObject forged=new JSONObject(eligible).put("admissionGeneration",UUID.randomUUID().toString()).put("admissionFingerprint","forged");store.writeCredentialSlot(SLOT,forged.toString());check(generation()==null,"Caller supplied identity imported");bind();String privateSaved=store.readCredentialSlot(SLOT);JSONObject publicStatus=AlphaLocalAgentPlugin.providerIdentity(privateSaved);check(publicStatus.length()==3&&publicStatus.has("provider")&&publicStatus.has("configured")&&publicStatus.has("model"),"Public status leaked private fields");check(!publicStatus.toString().contains("admission")&&!publicStatus.toString().contains("synthetic-token"),"Public status leaked fingerprint/token");cases++;
  JsonCredentialSlots.onRead=n->{if(n.equals(CLOUD))check(Thread.holdsLock(JsonCredentialSlots.LOCK),"Credential comparison escaped mutation lock");};String expected=store.readCredentialSlot(SLOT);String selected=new JSONObject(expected).put("admissionGeneration","caller-value").put("admissionFingerprint","caller-value").put("revision",UUID.randomUUID().toString()).toString();String committed=store.compareExchangeProviderAdmission(expected,selected,CLOUD,original,AlphaConnectionPlugin.readCloudIdentity("synthetic-token"));check(committed!=null&&!committed.contains("caller-value"),"Explicit configure trusted caller generation");JsonCredentialSlots.onRead=n->{};cases++;
  String previousDirect=new JSONObject().put("key","synthetic-direct-key").put("model","model-a").toString();store.writeCredentialSlot(SLOT,previousDirect);final int[] reads={0};
  JsonCredentialSlots.onRead=n->{if(n.equals(CLOUD)&&++reads[0]==3){JsonCredentialSlots.onRead=x->{};try{store.removeCredentialSlot(CLOUD);}catch(Exception e){throw new RuntimeException(e);}}};
  refuses(()->bind());JsonCredentialSlots.onRead=n->{};check(new JSONObject(previousDirect).similar(new JSONObject(store.readCredentialSlot(SLOT))),"Failed account admission lost prior selection");check(generation()==null,"Failed admission restored old grant");store.writeCredentialSlot(CLOUD,original);cases++;
  final String[] newer={null};reads[0]=0;JsonCredentialSlots.onRead=n->{if(n.equals(CLOUD)&&++reads[0]==3){JsonCredentialSlots.onRead=x->{};try{AlphaLocalAgentPlugin.bindDirectProvider(store,"winner-direct-key","winner-model");newer[0]=store.readCredentialSlot(SLOT);}catch(Exception e){throw new RuntimeException(e);}}};
  refuses(()->bind());JsonCredentialSlots.onRead=n->{};check(newer[0]!=null&&newer[0].equals(store.readCredentialSlot(SLOT)),"Rollback replaced concurrent winner");cases++;
  bind();String environmentGen=generation();JSONObject wrongEnvironment=new JSONObject(store.readCredentialSlot(SLOT)).put("environment","staging");store.writeCredentialSlot(SLOT,wrongEnvironment.toString());check(generation()==null,"Changed environment kept generation");bind();check(!environmentGen.equals(generation()),"Changed environment revived old generation");cases++;
  String unchanged=generation();store.writeCredentialSlot(CLOUD,original);store.writeCredentialSlot("cloud:staging",credential("staging-token","staging-owner"));check(unchanged.equals(generation()),"Unchanged/foreign environment credential invalidated current binding");cases++;
  final int[] unrelatedReads={0};JsonCredentialSlots.onRead=n->{if(n.equals("notes-records:v1:device"))unrelatedReads[0]++;};store.writeCredentialSlot("notes-records:v1:device","[]");JsonCredentialSlots.onRead=n->{};check(unrelatedReads[0]==0&&unchanged.equals(generation()),"Unrelated slot write acquired/read provider data");cases++;
  AlphaLocalAgentPlugin.bindDirectProvider(store,"synthetic-direct-key","model-a");String directAccount=generation();store.writeCredentialSlot(CLOUD,credential("replacement-token","other-owner"));check(generation()==null,"Account replacement retained direct-provider grant");store.writeCredentialSlot(CLOUD,original);AlphaLocalAgentPlugin.bindDirectProvider(store,"synthetic-direct-key","model-a");check(!directAccount.equals(generation()),"Restored account revived direct-provider grant");cases++;
  directAccount=generation();store.removeCredentialSlot(CLOUD);check(generation()==null,"Logout retained direct-provider grant");store.writeCredentialSlot(CLOUD,original);AlphaLocalAgentPlugin.bindDirectProvider(store,"synthetic-direct-key","model-a");check(!directAccount.equals(generation()),"Logout restore revived direct-provider grant");cases++;
  bind();String logical=generation();String reordered="{\\"organizationId\\":\\"synthetic-org\\",\\"userId\\":\\"synthetic-owner\\",\\"token\\":\\"synthetic-token\\",\\"credentialId\\":\\""+ID+"\\"}";store.writeCredentialSlot(CLOUD,reordered);check(logical.equals(generation()),"Reserialization retired identical logical credential");cases++;
  String metadataOnly=new JSONObject(original).put("expiresAt",System.currentTimeMillis()+600000).put("email","synthetic@example.invalid").put("refreshedAt",System.currentTimeMillis()).toString();store.writeCredentialSlot(CLOUD,metadataOnly);check(logical.equals(generation()),"Metadata/valid expiry update retired identical credential");bind();check(logical.equals(generation()),"Restore after metadata update retired generation");cases++;
  store.writeCredentialSlot(CLOUD,new JSONObject(metadataOnly).put("expiresAt",1).toString());check(generation()==null,"Expired credential retained grant");store.writeCredentialSlot(CLOUD,metadataOnly);check(generation()==null,"Valid metadata restoration revived expired grant");bind();check(!logical.equals(generation()),"Expired grant was reminted");cases++;
  System.out.println("PASS "+cases+" native admission ownership cases");
 }
}`));
 execFileSync(path.join(java,'bin/javac'),['--release','17','-cp',jar,'-d',dir,...sourceFiles],{timeout:20000});
 const androidJar=process.env.ALPHA_ANDROID_JAR||path.join(os.homedir(),'Library/Android/sdk/platforms/android-36/android.jar');
 assert.ok(fs.existsSync(androidJar),'Cached Android API jar required');
 execFileSync(path.join(java,'bin/javac'),['--release','17','-cp',androidJar,'-d',path.join(dir,'android-api'),...sourceFiles.filter(p=>!p.endsWith('/AdmissionTest.java'))],{timeout:20000});
 const result=execFileSync(path.join(java,'bin/java'),['-cp',dir+path.delimiter+jar,'ai.elizaresearch.alphaphone.AdmissionTest'],{encoding:'utf8',timeout:20000});
 assert.match(result,/PASS 27 native admission ownership cases/);
 t.diagnostic(result.trim());
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
