package ai.elizaresearch.alphaphone;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/** First-party local runtime bridge. Runtime and owner bearer tokens stay native. */
@CapacitorPlugin(name="Agent")
public final class AlphaLocalAgentPlugin extends Plugin {
 private final ExecutorService workers=Executors.newFixedThreadPool(2);
 private static String rootToken,ownerToken,ownerIdentity;
 private static long expiresAt;
 private static final Object lifecycleLock=new Object(), enrollmentLock=new Object();
 private static long lifecycleEpoch;
 private static boolean accepting=true,stopping;
 private volatile boolean disposed;
 private static final java.util.Set<PluginCall> pending=new java.util.HashSet<>();
 private static final java.util.Map<String,ElizaAgentService.LocalStreamHandle> streams=new java.util.HashMap<>();
 private static final java.util.Map<String,Runnable> streamInvalidators=new java.util.HashMap<>();
 private static void invalidateCalls(){
  for(var notify:streamInvalidators.values())notify.run();streamInvalidators.clear();
  for(var handle:streams.values())handle.cancel();streams.clear();
  for(PluginCall call:pending)call.reject("Local agent connection changed. A dispatched operation may still have completed; inspect its receipt before retrying.","LOCAL_AGENT_EPOCH_CHANGED");
  pending.clear();
 }
 private static void rejectPending(PluginCall call,String message){synchronized(lifecycleLock){if(pending.remove(call))call.reject(message);}}

 private static final class Superseded extends Exception {}
 private static void clearEnrollment(){rootToken=null;ownerToken=null;ownerIdentity=null;expiresAt=0;}
 private void requireCurrent(long epoch) throws Superseded {
  synchronized(lifecycleLock){if(disposed||!accepting||epoch!=lifecycleEpoch)throw new Superseded();}
 }
 private long admittedEpoch() throws Superseded {
  synchronized(lifecycleLock){requireCurrent(lifecycleEpoch);return lifecycleEpoch;}
 }
 private void resolveCurrent(PluginCall call,long epoch,JSObject result) throws Superseded {
  synchronized(lifecycleLock){requireCurrent(epoch);if(pending.remove(call))call.resolve(result);}
 }
 private static void rejectSuperseded(PluginCall call){synchronized(lifecycleLock){if(pending.remove(call))call.reject("Local agent connection changed. A dispatched operation may still have completed; inspect its receipt before retrying.","LOCAL_AGENT_EPOCH_CHANGED");}}

 private boolean runtimePackaged() {
  try {
   try(var ignored=getContext().getAssets().open("agent/agent-bundle.js")){}
   return new File(getContext().getApplicationInfo().nativeLibraryDir,"libeliza_bun.so").isFile();
  } catch(Exception unavailable) { return false; }
 }
 @PluginMethod public void configureProvider(PluginCall call) {
  if(!runtimePackaged()){call.reject("On-device agent is unavailable in this version. Connect a remote agent or use Eliza Cloud.");return;}
  String key=call.getString("apiKey",""),model=call.getString("model","");
  if(key.length()<8||key.length()>1024||key.matches(".*[\\r\\n\\s].*")||!model.matches("[A-Za-z0-9][A-Za-z0-9._/-]{0,127}")){call.reject("Enter a valid Cerebras key and model.");return;}
  workers.execute(()->{try{
   new AlphaCredentialStore(getContext()).writeCredentialSlot("local-agent-provider:v1",new JSONObject().put("key",key).put("model",model).toString());
   call.resolve(new JSObject().put("configured",true));
  }catch(Exception error){call.reject("Provider could not be saved securely.");}});
 }
 static void configureEnvironment(Context context,java.util.Map<String,String> env) throws java.io.IOException {
  env.remove("ELIZA_MOBILE_WORKFLOWS");
  java.io.InputStream workerIndex=null;
  try {workerIndex=context.getAssets().open("agent/workflow-worker/files.sha256");}
  catch(java.io.FileNotFoundException absent) { /* Older payloads do not contain a workflow worker. */ }
  if(workerIndex!=null){
   String root=env.get("AGENT_ROOT");if(root==null){workerIndex.close();throw new java.io.IOException("Agent resource directory unavailable");}
   java.io.File worker=WorkflowWorkerAssets.install(new java.io.File(root),workerIndex,path->context.getAssets().open("agent/workflow-worker/"+path));
   WorkflowWorkerAssets.configureEnvironment(worker,env);
  }
  try {
  String saved=new AlphaCredentialStore(context).readCredentialSlot("local-agent-provider:v1");
  if(saved==null)throw new IllegalStateException("Configure a model provider before starting the local agent");
  JSONObject provider=new JSONObject(saved);
  env.put("CEREBRAS_API_KEY",provider.getString("key"));
  env.put("CEREBRAS_MODEL",provider.getString("model"));
  env.put("CEREBRAS_SMALL_MODEL",provider.getString("model"));
  env.put("CEREBRAS_LARGE_MODEL",provider.getString("model"));
  env.put("ELIZAOS_CLOUD_USE_INFERENCE","false");
  env.put("ELIZA_DISABLE_PERSONAL_ASSISTANT","1");
  env.put("ELIZA_DISTRIBUTION_PROFILE","store");
  } catch(Exception error) {throw new java.io.IOException("Local model provider unavailable");}
 }
 @PluginMethod public void start(PluginCall call) {
  try {
   if(!runtimePackaged()){call.reject("On-device agent is unavailable in this version. Connect a remote agent or use Eliza Cloud.");return;}
   if(new AlphaCredentialStore(getContext()).readCredentialSlot("local-agent-provider:v1")==null){call.reject("Configure your model provider before starting the local agent.");return;}
   // Hosted inference is distinct from an on-device language-model payload.
   getContext().getSharedPreferences("CapacitorStorage",Context.MODE_PRIVATE).edit().putString("eliza:mobile-runtime-mode","cloud-hybrid").apply();
   final long epoch;
   long admitted=-1;
   for(int attempt=0;attempt<3;attempt++){
    final long observedEpoch;
    final boolean needsShutdownObservation;
    synchronized(lifecycleLock){observedEpoch=lifecycleEpoch;needsShutdownObservation=stopping;}
    JSONObject nativeState=needsShutdownObservation?ElizaAgentService.getLocalAgentBootState(getContext()):null;
    synchronized(lifecycleLock){
     if(observedEpoch!=lifecycleEpoch)continue;
     if(disposed){call.reject("Local agent bridge is closed.");return;}
     if(stopping&&shutdownConfirmed(nativeState))stopping=false;
     if(stopping){call.reject("Local agent is stopping; wait for stopped status before starting.");return;}
     invalidateCalls();admitted=++lifecycleEpoch;accepting=true;clearEnrollment();pending.add(call);
     ElizaAgentService.start(getContext());break;
    }
   }
   if(admitted<0){call.reject("Local agent connection changed; check status before starting again.");return;}
   epoch=admitted;
   workers.execute(()->{
    long deadline=android.os.SystemClock.elapsedRealtime()+90000;
    while(android.os.SystemClock.elapsedRealtime()<deadline){
     try{enroll(epoch);resolveCurrent(call,epoch,new JSObject().put("state","ready"));return;}
     catch(Superseded stale){rejectSuperseded(call);return;}
     catch(Exception unavailable){try{Thread.sleep(1000);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();break;}}
    }
    rejectPending(call,"Local agent startup did not complete. Check runtime status; no chat was sent.");
   });
  }catch(Exception error){synchronized(lifecycleLock){pending.remove(call);}call.reject("The on-device agent could not start. Try again or connect another agent.");}
 }
 private static boolean shutdownConfirmed(JSONObject status){
  return status!=null&&"dead".equals(status.optString("state"))&&!status.optBoolean("serviceActive",true)&&!status.optBoolean("socketListening",true);
 }
 @PluginMethod public void getStatus(PluginCall call) {
  try{
   boolean packaged=runtimePackaged();
   for(int attempt=0;attempt<3;attempt++){
    final long observedEpoch;
    synchronized(lifecycleLock){observedEpoch=lifecycleEpoch;}
    // Native socket observation must never delay stop's epoch invalidation.
    JSObject status=packaged?new JSObject(ElizaAgentService.getLocalAgentBootState(getContext()).toString()):new JSObject().put("state","unavailable");
    synchronized(lifecycleLock){
     if(observedEpoch!=lifecycleEpoch)continue;
     if(stopping||!accepting){
      boolean stopped=shutdownConfirmed(status);
      if(stopped)stopping=false;
      status.put("state",stopped?"stopped":"stopping");
     }
     status.put("packaged",packaged);call.resolve(status);return;
    }
   }
   call.reject("Local runtime changed while checking status; check again.");
  }catch(Exception error){call.reject("Local runtime status unavailable.");}
 }
 @PluginMethod public void stop(PluginCall call) {
  synchronized(lifecycleLock){
   invalidateCalls();++lifecycleEpoch;accepting=false;stopping=true;clearEnrollment();
   try{ElizaAgentService.stop(getContext());call.resolve(new JSObject().put("state","stopping"));}
   catch(Exception unavailable){call.reject("Stop requested locally, but native shutdown could not be confirmed. Check runtime status.");}
  }
 }
 private static JSONObject raw(String path,String method,String body,String token,JSONObject supplied) throws Exception {
  JSONObject headers=new JSONObject();headers.put("Accept","application/json");headers.put("Content-Type","application/json");
  if(token!=null)headers.put("Authorization","Bearer "+token);
  if(supplied!=null)for(String key:new String[]{"X-Eliza-Device-Id","X-Eliza-Device-Key","X-Eliza-Device-Capabilities"}){
   if(supplied.has(key)){String value=supplied.getString(key);if(value.length()>2048||value.contains("\r")||value.contains("\n"))throw new IllegalArgumentException();headers.put(key,value);}
  }
  JSONObject input=new JSONObject().put("path",path).put("method",method).put("headers",headers).put("timeoutMs",120000);
  if(body!=null)input.put("body",body);
  return new JSONObject(ElizaAgentService.requestLocalAgent(input.toString()));
 }
 private static JSONObject json(String path,String method,JSONObject body,String token) throws Exception {
  JSONObject response=raw(path,method,body==null?null:body.toString(),token,null);
  if(response.getInt("status")!=200)throw new IllegalStateException("Local enrollment unavailable");
  return new JSONObject(response.getString("body"));
 }
 private JSONObject enrollmentJson(long epoch,String path,String method,JSONObject body,String token) throws Exception {
  requireCurrent(epoch);
  // Admission precedes dispatch. In-flight native requests are not claimed cancelled.
  JSONObject result=json(path,method,body,token);requireCurrent(epoch);return result;
 }
 private String enroll(long epoch) throws Exception {
  synchronized(enrollmentLock){
  requireCurrent(epoch);
  String root=ElizaAgentService.localAgentToken();
  if(root==null||root.isEmpty())throw new IllegalStateException();
  synchronized(lifecycleLock){requireCurrent(epoch);if(root.equals(rootToken)&&ownerToken!=null&&expiresAt>System.currentTimeMillis()+30000)return ownerToken;}
  JSONObject status=enrollmentJson(epoch,"/api/auth/status","GET",null,root);
  JSONObject code=enrollmentJson(epoch,"/api/auth/pair-code","GET",null,root);
  JSONObject paired=enrollmentJson(epoch,"/api/auth/pair","POST",new JSONObject().put("code",code.getString("code")).put("instanceId",status.getString("instanceId")),root);
  if(!"owner".equals(paired.getString("access"))||!status.getString("instanceId").equals(paired.getString("instanceId")))throw new IllegalStateException();
  String token=paired.getString("token");JSONObject who=enrollmentJson(epoch,"/api/auth/me","GET",null,token);
  if(!"OWNER".equals(who.getJSONObject("access").getString("role"))||!paired.getString("identityId").equals(who.getJSONObject("identity").getString("id"))||!token.equals(who.getJSONObject("session").getString("id")))throw new IllegalStateException();
  long expiry=who.getJSONObject("session").getLong("expiresAt");if(expiry<=System.currentTimeMillis())throw new IllegalStateException();
  synchronized(lifecycleLock){requireCurrent(epoch);rootToken=root;ownerToken=token;ownerIdentity=paired.getString("identityId");expiresAt=expiry;return token;}
  }
 }
 @PluginMethod public void request(PluginCall call) {
  String path=call.getString("path",""),method=call.getString("method","GET"),body=call.getString("body");
  if(path.contains("..")||path.contains("%")||path.contains("\\")||!path.matches("^/api/(auth/me|agents|status|conversations(/[A-Za-z0-9_-]+(/messages)?)?|client-devices/[A-Za-z0-9_/-]+|workflow(/[A-Za-z0-9_/?=&-]+)?)$")||!(method.equals("GET")||method.equals("POST"))||(method.equals("GET")&&body!=null)||(body!=null&&body.length()>2*1024*1024)){
   call.reject("Unsupported local agent request.");return;
  }
  JSONObject headers=call.getObject("headers");
  final long epoch;
  try{synchronized(lifecycleLock){epoch=admittedEpoch();pending.add(call);}}catch(Superseded stale){call.reject("Local agent is stopped or unavailable.","LOCAL_AGENT_EPOCH_CHANGED");return;}
  try{workers.execute(()->{try{
   String token=enroll(epoch);
   String expectedOwner=call.getString("ownerId");
   synchronized(lifecycleLock){requireCurrent(epoch);if(expectedOwner!=null&&!expectedOwner.equals(ownerIdentity)){resolveCurrent(call,epoch,new JSObject().put("status",409).put("body","{\"error\":\"Local owner changed; reconnect before continuing\"}"));return;}}
   requireCurrent(epoch);
   JSONObject result=raw(path,method,body,token,headers);
   requireCurrent(epoch);
   if(result.getInt("status")==401)synchronized(lifecycleLock){requireCurrent(epoch);clearEnrollment();}
   if(path.equals("/api/auth/me")&&result.getInt("status")==200){JSONObject who=new JSONObject(result.getString("body"));who.getJSONObject("session").put("id","native-owned-session");result.put("body",who.toString());result.remove("bodyBase64");}
   resolveCurrent(call,epoch,new JSObject(result.toString()));
  }catch(Superseded stale){rejectSuperseded(call);}
  catch(Exception error){rejectPending(call,"Local agent request failed. No automatic retry was made.");}});}
  catch(java.util.concurrent.RejectedExecutionException closed){rejectPending(call,"Local agent bridge is closed.");}
 }
 /** Cancellation acknowledges transport closure, never server-effect cancellation. */
 @PluginMethod public void cancelStream(PluginCall call) {
  String id=call.getString("streamId","");
  synchronized(lifecycleLock){var handle=streams.remove(id);streamInvalidators.remove(id);if(handle!=null)handle.cancel();}
  call.resolve(new JSObject().put("transportClosed",true).put("outcome","unknown"));
 }
 @PluginMethod public void requestStream(PluginCall call) {
  String id=call.getString("streamId",""),path=call.getString("path",""),owner=call.getString("ownerId",""),body=call.getString("body","");
  if(!id.matches("[A-Za-z0-9-]{16,64}")||!path.matches("^/api/conversations/[A-Za-z0-9_-]+/messages/stream$")||owner.isEmpty()||body.isEmpty()||body.length()>2*1024*1024){call.reject("Unsupported local stream.");return;}
  final long epoch;final var handle=new ElizaAgentService.LocalStreamHandle();
  try{synchronized(lifecycleLock){epoch=admittedEpoch();if(streams.size()>=2||streams.containsKey(id))throw new IllegalStateException();streams.put(id,handle);streamInvalidators.put(id,()->notifyListeners("alphaAgentStream",new JSObject().put("streamId",id).put("event",new JSObject().put("type","complete").put("error","Local connection changed. Outcome unknown; check history before retrying."))));}}
  catch(Exception unavailable){call.reject("Local stream unavailable.");return;}
  final JSONObject supplied=call.getObject("headers");
  call.resolve(new JSObject().put("streamId",id));
  try{workers.execute(()->{try{
   String token=enroll(epoch);JSONObject headers=new JSONObject().put("Authorization","Bearer "+token).put("Accept","text/event-stream").put("Content-Type","application/json");
   if(supplied!=null)for(String key:new String[]{"X-Eliza-Device-Id","X-Eliza-Device-Key","X-Eliza-Device-Capabilities"})if(supplied.has(key)){String value=supplied.getString(key);if(value.length()>2048||value.contains("\r")||value.contains("\n"))throw new IllegalArgumentException();headers.put(key,value);}
   synchronized(lifecycleLock){requireCurrent(epoch);if(!owner.equals(ownerIdentity)||streams.get(id)!=handle)throw new Superseded();}
   JSONObject input=new JSONObject().put("path",path).put("method","POST").put("body",body).put("headers",headers).put("timeoutMs",120000);
   ElizaAgentService.requestLocalAgentStream(input.toString(),event->{synchronized(lifecycleLock){try{requireCurrent(epoch);if(streams.get(id)!=handle)return;JSONObject value=new JSONObject(event);if("response".equals(value.optString("type"))&&value.optInt("status")==401)clearEnrollment();notifyListeners("alphaAgentStream",new JSObject().put("streamId",id).put("event",value));}catch(Exception ignored){}}},handle);
  }catch(Exception error){synchronized(lifecycleLock){if(streams.get(id)==handle)notifyListeners("alphaAgentStream",new JSObject().put("streamId",id).put("event",new JSObject().put("type","complete").put("error","Stream interrupted. Outcome unknown; check history before retrying.")));}}
  finally{synchronized(lifecycleLock){if(streams.get(id)==handle){streams.remove(id);streamInvalidators.remove(id);}handle.cancel();}}});}
  catch(java.util.concurrent.RejectedExecutionException closed){synchronized(lifecycleLock){streams.remove(id);streamInvalidators.remove(id);handle.cancel();}notifyListeners("alphaAgentStream",new JSObject().put("streamId",id).put("event",new JSObject().put("type","complete").put("error","Stream unavailable.")));}
 }
 @Override protected void handleOnDestroy(){synchronized(lifecycleLock){disposed=true;invalidateCalls();++lifecycleEpoch;clearEnrollment();}workers.shutdownNow();super.handleOnDestroy();}
}
