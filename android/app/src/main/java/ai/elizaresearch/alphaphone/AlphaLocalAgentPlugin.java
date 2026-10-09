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
 // Set only from in-process debug instrumentation; no route, intent or preference activation.
 static volatile java.net.ServerSocket instrumentationRecoveryEndpoint;
 private static String rootToken,ownerToken,ownerIdentity;
 private static long expiresAt;
 private static final Object lifecycleLock=new Object(), enrollmentLock=new Object();
 private static long lifecycleEpoch;
 private static String startRequestId;
 private static long startRequestEpoch;
 private static boolean startOwnsLaunch;
 private final java.util.Set<String> cancelledStarts=new java.util.HashSet<>();
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
  if(!validProviderToken(key,1024)||!model.matches("[A-Za-z0-9][A-Za-z0-9._/-]{0,127}")){call.reject("Enter a valid Cerebras key and model.");return;}
  workers.execute(()->{try{
   bindDirectProvider(new AlphaCredentialStore(getContext()),key,model);
   call.resolve(new JSObject().put("configured",true));
  }catch(Exception error){call.reject("Provider could not be saved securely.");}});
 }
 static final String CLOUD_PROVIDER_MODEL="cerebras/qwen-3.8-27b";
 static final String CLOUD_PROVIDER_BASE="https://api.eliza.app/api/v1";
 /** Binds an existing account credential; no bearer value crosses this method's renderer API. */
 @PluginMethod public void configureCloudProvider(PluginCall call) {
  if(!runtimePackaged()){call.reject("On-device agent is unavailable in this version.");return;}
  String credentialId=call.getString("credentialId",""),model=call.getString("model","");
  if(!CLOUD_PROVIDER_MODEL.equals(model)){call.reject("Choose a supported Cloud model.");return;}
  try{workers.execute(()->{try{
   bindCloudProvider(new AlphaCredentialStore(getContext()),credentialId,model);
   call.resolve(new JSObject().put("configured",true));
  }catch(Exception unavailable){call.reject("Cloud account changed or is unavailable. Sign in again before starting the local agent.");}});}
  catch(java.util.concurrent.RejectedExecutionException closed){call.reject("Local agent bridge is closed.");}
 }
 /** Preserve the previous selection when admission loses its account, without replacing a newer selection. */
 static void bindCloudProvider(AlphaCredentialStore store,String credentialId,String model) throws Exception {
  if(!CLOUD_PROVIDER_MODEL.equals(model))throw new IllegalArgumentException();
  String previous=store.readCredentialSlot("local-agent-provider:v1");
  String cloud=store.readCredentialSlot("cloud:production");
  cloudProviderToken(cloud,credentialId,System.currentTimeMillis());
  // A unique revision distinguishes two concurrent admissions for the same account/model.
  String selection=new JSONObject().put("provider","elizacloud").put("credentialId",credentialId).put("model",model)
   .put("revision",java.util.UUID.randomUUID().toString()).toString();
  String binding=store.compareExchangeProviderAdmission(previous,selection,"cloud:production",cloud);
  if(binding==null)throw new IllegalStateException();
  try{
   cloudProviderToken(store.readCredentialSlot("cloud:production"),credentialId,System.currentTimeMillis());
   if(!binding.equals(store.readCredentialSlot("local-agent-provider:v1")))throw new IllegalStateException();
  }catch(Exception unavailable){
   store.rollbackProviderAdmission(binding,previous);
   throw unavailable;
  }
 }
 /** Direct configuration is also an explicit native admission; renderer metadata is never accepted. */
 static void bindDirectProvider(AlphaCredentialStore store,String key,String model)throws Exception {
  if(!validProviderToken(key,1024)||!model.matches(PROVIDER_MODEL_PATTERN))throw new IllegalArgumentException();
  String previous=store.readCredentialSlot("local-agent-provider:v1");
  String selection=new JSONObject().put("provider","cerebras").put("key",key).put("model",model)
   .put("revision",java.util.UUID.randomUUID().toString()).toString();
  if(store.compareExchangeProviderAdmission(previous,selection,null,null)==null)throw new IllegalStateException();
 }
 static boolean validProviderToken(String token,int maximumLength) {
  if(token==null||token.length()<8||token.length()>maximumLength)return false;
  // HTTP bearer credentials are visible ASCII; reject all whitespace/control characters, including CR/LF runs.
  for(int i=0;i<token.length();i++)if(token.charAt(i)<=0x20||token.charAt(i)>=0x7f)return false;
  return true;
 }
 static String cloudProviderToken(String saved,String credentialId,long now) throws Exception {
  if(credentialId==null||!java.util.UUID.fromString(credentialId).toString().equalsIgnoreCase(credentialId)||saved==null)throw new IllegalArgumentException();
  JSONObject credential=new JSONObject(saved);
  if(!credentialId.equals(credential.opt("credentialId")))throw new IllegalArgumentException();
  Object token=credential.opt("token");
  if(!(token instanceof String)||!validProviderToken((String)token,16384))throw new IllegalArgumentException();
  if(credential.has("expiresAt")){
   Object expiry=credential.opt("expiresAt");
   if(!(expiry instanceof Number)||!Double.isFinite(((Number)expiry).doubleValue())||((Number)expiry).doubleValue()<=now)throw new IllegalArgumentException();
  }
  return (String)token;
 }
 /** Select exactly one billing authority at process launch; never accept UI balance as authorization. */
 static void applyProviderEnvironment(JSONObject provider,String cloudSaved,java.util.Map<String,String> env,long now) throws Exception {
  String kind=provider.optString("provider","cerebras"),model=provider.getString("model");
  // Retirement context only: reuse protected selection identity, never a credential or renderer value.
  Object selectedRevision=provider.opt("revision");
  String hostRevision;
  if(provider.has("revision")){
   if(!(selectedRevision instanceof String))throw new IllegalArgumentException();
   String revision=java.util.UUID.fromString((String)selectedRevision).toString();
   if(!revision.equalsIgnoreCase((String)selectedRevision))throw new IllegalArgumentException();
   hostRevision="provider:"+kind+":"+revision;
  }else{
   // Legacy selections cannot carry an unfinished read across a process restart.
   hostRevision="boot:"+java.util.UUID.randomUUID().toString();
  }
  if("elizacloud".equals(kind)){
   if(!CLOUD_PROVIDER_MODEL.equals(model))throw new IllegalArgumentException();
   String token=cloudProviderToken(cloudSaved,provider.getString("credentialId"),now);
   for(String key:new String[]{"CEREBRAS_API_KEY","CEREBRAS_BASE_URL","CEREBRAS_MODEL","CEREBRAS_SMALL_MODEL","CEREBRAS_LARGE_MODEL","OPENAI_API_KEY","OPENAI_BASE_URL","ELIZA_PROVIDER"})env.remove(key);
   env.put("ELIZAOS_CLOUD_API_KEY",token);
   env.put("ELIZAOS_CLOUD_BASE_URL",CLOUD_PROVIDER_BASE);
   env.put("ELIZAOS_CLOUD_USE_INFERENCE","true");
   env.put("ELIZAOS_CLOUD_USE_EMBEDDINGS","true");
   env.put("ELIZAOS_CLOUD_EMBEDDING_MODEL","bge-small-en-v1.5");
   env.put("ELIZAOS_CLOUD_EMBEDDING_DIMENSIONS","384");
   env.put("ELIZA_DISABLE_LOCAL_EMBEDDINGS","true");
   env.put("ELIZA_LOCAL_EMBEDDING_ENABLED","0");
   env.remove("ELIZA_LOCAL_EMBEDDING_MODEL_PATH");env.remove("ELIZA_LOCAL_EMBEDDING_DIMENSIONS");
   env.put("ELIZAOS_CLOUD_SMALL_MODEL",model);
   env.put("ELIZAOS_CLOUD_LARGE_MODEL",model);
  }else if("cerebras".equals(kind)){
   String key=provider.getString("key");
   if(!model.matches(PROVIDER_MODEL_PATTERN)||!validProviderToken(key,1024))throw new IllegalArgumentException();
   for(String name:new String[]{"ELIZAOS_CLOUD_API_KEY","ELIZAOS_CLOUD_BASE_URL","ELIZAOS_CLOUD_SMALL_MODEL","ELIZAOS_CLOUD_LARGE_MODEL","ELIZAOS_CLOUD_USE_EMBEDDINGS","ELIZAOS_CLOUD_EMBEDDING_MODEL","ELIZAOS_CLOUD_EMBEDDING_DIMENSIONS","ELIZA_DISABLE_LOCAL_EMBEDDINGS","ELIZA_LOCAL_EMBEDDING_ENABLED"})env.remove(name);
   env.put("CEREBRAS_API_KEY",key);
   env.put("CEREBRAS_MODEL",model);
   env.put("CEREBRAS_SMALL_MODEL",model);
   env.put("CEREBRAS_LARGE_MODEL",model);
   env.put("ELIZAOS_CLOUD_USE_INFERENCE","false");
  }else throw new IllegalArgumentException();
  env.put("ELIZA_HOST_CONTEXT_REVISION",hostRevision);
 }
 static final String PROVIDER_MODEL_PATTERN="[A-Za-z0-9][A-Za-z0-9._/-]{0,127}";
 /** Settings may show which hosted provider and model are configured; the key never leaves native storage. */
 static JSObject providerIdentity(String saved) {
  JSObject result=new JSObject().put("provider","cerebras").put("configured",false);
  if(saved==null)return result;
  try{
   JSONObject provider=new JSONObject(saved);
   String model=provider.optString("model",""),kind=provider.optString("provider","cerebras");
   if("elizacloud".equals(kind)){result.put("provider","elizacloud");if(CLOUD_PROVIDER_MODEL.equals(model))result.put("configured",true).put("model",model);}
   else if("cerebras".equals(kind)&&model.matches(PROVIDER_MODEL_PATTERN))result.put("configured",true).put("model",model);
  }catch(org.json.JSONException malformed){/* Report unconfigured, never the stored value. */}
  return result;
 }
 @PluginMethod public void providerStatus(PluginCall call) {
  try{workers.execute(()->{
   try{
    AlphaCredentialStore store=new AlphaCredentialStore(getContext());
    String saved=store.readCredentialSlot("local-agent-provider:v1");
    JSObject status=providerIdentity(saved);
    if("elizacloud".equals(status.optString("provider"))&&status.optBoolean("configured")){
     try{cloudProviderToken(store.readCredentialSlot("cloud:production"),new JSONObject(saved).optString("credentialId"),System.currentTimeMillis());}
     catch(Exception unavailable){status.put("configured",false);}
    }
    call.resolve(status);
   }
   catch(Exception unavailable){call.reject("Provider status unavailable.");}
  });}
  catch(java.util.concurrent.RejectedExecutionException closed){call.reject("Local agent bridge is closed.");}
 }
 /** The shared service activates its bionic host from this same packaged engine/JNI pair. */
 static void configureLocalEmbeddings(File nativeDirectory,File filesDirectory,java.util.Map<String,String> env) {
  File model=new File(filesDirectory,".eliza/local-inference/models/bge-small-en-v1.5-f16.gguf");
  if(!new File(nativeDirectory,"libelizainference.so").isFile()||!new File(nativeDirectory,"libelizavoicejni.so").isFile()||!model.isFile())return;
  // The APK build guard pins these native bytes and the BGE model. BgeEmbeddingSession
  // verifies the actual extracted model and vector space before native inference.
  env.put("ELIZAOS_CLOUD_USE_EMBEDDINGS","false");
  env.put("ELIZA_DISABLE_LOCAL_EMBEDDINGS","false");
  env.put("ELIZA_LOCAL_EMBEDDING_ENABLED","1");
  env.put("ELIZA_LOCAL_EMBEDDING_MODEL_PATH",model.getAbsolutePath());
  env.put("ELIZA_LOCAL_EMBEDDING_DIMENSIONS","384");
 }
 static void configureNativeViews(java.io.InputStream policy,java.util.Map<String,String> env) throws java.io.IOException {
  try(policy){
   java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream();
   byte[] buffer=new byte[4096];int count;
   while((count=policy.read(buffer))!=-1){
    if(output.size()+count>16384)throw new java.io.IOException("Native view launch policy is too large");
    output.write(buffer,0,count);
   }
   env.put("ELIZA_NATIVE_VIEW_DECLARATIONS",output.toString(java.nio.charset.StandardCharsets.UTF_8.name()));
  }
 }
 static void configureEnvironment(Context context,java.util.Map<String,String> env) throws java.io.IOException {
  configureNativeViews(context.getAssets().open("agent/native-view-declarations.json"),env);
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
  applyProviderEnvironment(provider,"elizacloud".equals(provider.optString("provider"))?new AlphaCredentialStore(context).readCredentialSlot("cloud:production"):null,env,System.currentTimeMillis());
  if(!"elizacloud".equals(provider.optString("provider","cerebras")))configureLocalEmbeddings(new File(context.getApplicationInfo().nativeLibraryDir),context.getFilesDir(),env);
  env.put("ELIZA_DISABLE_PERSONAL_ASSISTANT","1");
  env.put("ELIZA_DISTRIBUTION_PROFILE","store");
  // A packaged app has no repository character file to discover above its workspace.
  env.put("ELIZA_DISABLE_LOCAL_CHARACTER","1");
  // Pseudonymize secrets and PII using the pinned upstream runtime.
  env.put("ELIZA_SECRET_SWAP_ENABLED","true");
  env.put("ELIZA_PII_SWAP_ENABLED","true");
  java.net.ServerSocket fixture=instrumentationRecoveryEndpoint;
  if(fixture!=null){
   if(!BuildConfig.DEBUG||android.os.Process.myUid()/100000<=0||fixture.isClosed()
      ||!fixture.isBound()||!"127.0.0.1".equals(fixture.getInetAddress().getHostAddress())
      ||fixture.getLocalPort()<=0||!"synthetic-resident-recovery-only".equals(provider.getString("key")))
    throw new java.io.IOException("Invalid resident recovery fixture endpoint");
   String endpoint="http://127.0.0.1:"+fixture.getLocalPort()+"/v1";
   env.put("CEREBRAS_BASE_URL",endpoint);env.put("OPENAI_BASE_URL",endpoint);
   env.put("OPENAI_API_KEY","synthetic-resident-recovery-only");env.put("ELIZA_PROVIDER","cerebras");
  }
  } catch(Exception error) {throw new java.io.IOException("Local model provider unavailable");}
 }
 @PluginMethod public void start(PluginCall call) {
  String requestId=call.getString("requestId");
  if(requestId!=null&&!requestId.matches("[a-f0-9-]{36}")){call.reject("Invalid startup request");return;}
  try {
   if(!runtimePackaged()){call.reject("On-device agent is unavailable in this version. Connect a remote agent or use Eliza Cloud.");return;}
   if(new AlphaCredentialStore(getContext()).readCredentialSlot("local-agent-provider:v1")==null){call.reject("Configure your model provider before starting the local agent.");return;}
   // Hosted inference is distinct from an on-device language-model payload.
   getContext().getSharedPreferences("CapacitorStorage",Context.MODE_PRIVATE).edit().putString("eliza:mobile-runtime-mode","cloud-hybrid").apply();
   final long epoch;
   long admitted=-1;
   for(int attempt=0;attempt<3;attempt++){
    final long observedEpoch;
    synchronized(lifecycleLock){
     if(requestId!=null&&cancelledStarts.remove(requestId)){call.reject("Local startup cancelled");return;}
     if(cancelledStarts.size()>=128){call.reject("Startup cancellation capacity reached; reopen the app.");return;}
     observedEpoch=lifecycleEpoch;
    }
    JSONObject nativeState=ElizaAgentService.getLocalAgentBootState(getContext());
    synchronized(lifecycleLock){
     if(requestId!=null&&cancelledStarts.remove(requestId)){call.reject("Local startup cancelled");return;}
     if(observedEpoch!=lifecycleEpoch)continue;
     if(disposed){call.reject("Local agent bridge is closed.");return;}
     if(stopping&&shutdownConfirmed(nativeState))stopping=false;
     if(stopping){call.reject("Local agent is stopping; wait for stopped status before starting.");return;}
     invalidateCalls();admitted=++lifecycleEpoch;accepting=true;clearEnrollment();pending.add(call);
     startRequestId=requestId;startRequestEpoch=admitted;startOwnsLaunch=shutdownConfirmed(nativeState);
     ElizaAgentService.start(getContext());break;
    }
   }
   if(admitted<0){call.reject("Local agent connection changed; check status before starting again.");return;}
   epoch=admitted;
   workers.execute(()->{
    long deadline=android.os.SystemClock.elapsedRealtime()+90000;
    boolean ready=false;
    while(android.os.SystemClock.elapsedRealtime()<deadline){
     try{if(rejectStartupRefusal(call,epoch,ElizaAgentService.getLocalAgentBootState(getContext())))return;String root=ElizaAgentService.localAgentToken();if(root==null||root.isEmpty())throw new IllegalStateException();authenticatedStatus(epoch,root);ready=true;break;}
     catch(Superseded stale){rejectSuperseded(call);return;}
     catch(Exception unavailable){try{Thread.sleep(1000);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();break;}}
    }
    if(ready){
     // Never poll enrollment: a failed response may follow a committed pairing POST.
     try{enroll(epoch);resolveCurrent(call,epoch,new JSObject().put("state","ready"));return;}
     catch(Superseded stale){rejectSuperseded(call);return;}
     catch(Exception uncertain){rejectPending(call,"Local enrollment did not complete. Check runtime status before reconnecting.");return;}
    }
    rejectPending(call,"Local agent startup did not complete. Check runtime status; no chat was sent.");
   });
  }catch(Exception error){synchronized(lifecycleLock){pending.remove(call);}call.reject("The on-device agent could not start. Try again or connect another agent.");}
 }
 /** Only the current startup caller may retire a launch it created; reused services are never stopped here. */
 @PluginMethod public void cancelStart(PluginCall call) {
  String requestId=call.getString("requestId","");
  if(!requestId.matches("[a-f0-9-]{36}")){call.reject("Invalid startup request");return;}
  synchronized(lifecycleLock){
   if(requestId.equals(startRequestId)&&startRequestEpoch==lifecycleEpoch){
    boolean stopOwned=startOwnsLaunch;
    startRequestId=null;startOwnsLaunch=false;
    invalidateCalls();++lifecycleEpoch;clearEnrollment();
    if(stopOwned){
     accepting=false;stopping=true;
     try{ElizaAgentService.stop(getContext());}
     catch(Exception uncertain){call.reject("Owned startup cancellation requested; check shutdown status.");return;}
    }
   }else if(cancelledStarts.size()<128)cancelledStarts.add(requestId);
   else {call.reject("Startup cancellation capacity reached; reopen the app.");return;}
   call.resolve();
  }
 }
 static String startupRefusalMessage(String reason){
  if("ipc-recovery-retention-limit".equals(reason))return "Local startup is blocked because retained recovery records reached their limit. Your records were preserved. Waiting or repeated starts will not clear this limit. Use another connection while recovery records are reviewed; do not clear app data.";
  if("ipc-recovery-required".equals(reason))return "Local startup could not safely identify an interrupted agent or workflow. Your records were preserved. Use another connection while the runtime is inspected; do not clear app data or rerun unfinished work.";
  if("runtime-identity-unavailable".equals(reason))return "Local startup could not verify its runtime files. Your records were preserved. Check the installed runtime before reconnecting.";
  return null;
 }
 private boolean rejectStartupRefusal(PluginCall call,long epoch,JSONObject status) throws Superseded {
  String reason=status.optString("reason");
  String message=startupRefusalMessage(reason);
  if(message==null)return false;
  synchronized(lifecycleLock){requireCurrent(epoch);if(pending.remove(call))call.reject(message,reason);return true;}
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
    JSObject status=new JSObject(ElizaAgentService.getLocalAgentBootState(getContext()).toString());
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
   startRequestId=null;startOwnsLaunch=false;
   invalidateCalls();++lifecycleEpoch;accepting=false;stopping=true;clearEnrollment();
   try{ElizaAgentService.stop(getContext());call.resolve(new JSObject().put("state","stopping"));}
   catch(Exception unavailable){call.reject("Stop requested locally, but native shutdown could not be confirmed. Check runtime status.");}
  }
 }
 // Native callers may bind background result reads to an existing enrollment.
 // This is deliberately not a Capacitor method and never initiates pairing.
 static JSONObject captureResultSession(String expectedOwner) throws Exception {
  synchronized(lifecycleLock){
   String currentRoot=ElizaAgentService.localAgentToken();
   if(!accepting||stopping||rootToken==null||!rootToken.equals(currentRoot)||
      ownerIdentity==null||!ownerIdentity.equals(expectedOwner)||ownerToken==null||
      expiresAt<=System.currentTimeMillis()+30000)throw new SecurityException("Reconnect the local agent before binding results");
   return ResidentResultSession.snapshot(ownerIdentity,ownerToken,expiresAt,currentRoot);
  }
 }
 /** Native-only read of the already enrolled machine session. Never calls enroll or setup. */
 static JSONObject captureReminderOwnerSession()throws Exception{
  synchronized(lifecycleLock){return captureResultSession(ownerIdentity);}
 }
 static JSONObject readReminderOwnerRoute(JSONObject expected,String path,JSONObject deviceHeaders)throws Exception{
  if(!java.util.Arrays.asList("/api/auth/me","/api/agents","/api/client-devices/context").contains(path))throw new SecurityException("Native owner route unavailable");
  JSONObject before=captureReminderOwnerSession();
  if(!before.toString().equals(expected.toString()))throw new SecurityException("Native owner session changed");
  JSONObject result=raw(path,"GET",null,expected.getString("token"),deviceHeaders,3000);
  if(!captureReminderOwnerSession().toString().equals(expected.toString()))throw new SecurityException("Native owner session changed");
  return result;
 }
 private static JSONObject raw(String path,String method,String body,String token,JSONObject supplied,int timeoutMs) throws Exception {
  JSONObject headers=new JSONObject();headers.put("Accept","application/json");headers.put("Content-Type","application/json");
  if(token!=null)headers.put("Authorization","Bearer "+token);
  if(supplied!=null)for(String key:new String[]{"X-Eliza-Device-Id","X-Eliza-Device-Key","X-Eliza-Device-Capabilities"}){
   if(supplied.has(key)){String value=supplied.getString(key);if(value.length()>2048||value.contains("\r")||value.contains("\n"))throw new IllegalArgumentException();headers.put(key,value);}
  }
  JSONObject input=new JSONObject().put("path",path).put("method",method).put("headers",headers).put("timeoutMs",timeoutMs);
  if(body!=null)input.put("body",body);
  return new JSONObject(ElizaAgentService.requestLocalAgent(input.toString()));
 }
 private static JSONObject json(String path,String method,JSONObject body,String token) throws Exception {
  JSONObject response=raw(path,method,body==null?null:body.toString(),token,null,120000);
  if(response.getInt("status")!=200)throw new IllegalStateException("Local enrollment unavailable");
  return new JSONObject(response.getString("body"));
 }
 private void requireEnrollmentRoot(long epoch,String root) throws Exception {
  requireCurrent(epoch);
  if(root==null||root.isEmpty()||!root.equals(ElizaAgentService.localAgentToken()))throw new IllegalStateException("Local runtime token changed");
 }
 private JSONObject enrollmentJson(long epoch,String path,String method,JSONObject body,String token,String root) throws Exception {
  requireEnrollmentRoot(epoch,root);
  // Admission precedes dispatch. In-flight native requests are not claimed cancelled.
  JSONObject result=json(path,method,body,token);requireEnrollmentRoot(epoch,root);return result;
 }
 private JSONObject authenticatedStatus(long epoch,String root) throws Exception {
  JSONObject status=enrollmentJson(epoch,"/api/auth/status","GET",null,root,root);
  if(!Boolean.TRUE.equals(status.opt("authenticated")))throw new IllegalStateException("Local runtime token not authenticated");
  if(status.getString("instanceId").isEmpty())throw new IllegalStateException("Local runtime instance unavailable");
  return status;
 }
 private String enroll(long epoch) throws Exception {
  synchronized(enrollmentLock){
  requireCurrent(epoch);
  String root=ElizaAgentService.localAgentToken();
  if(root==null||root.isEmpty())throw new IllegalStateException();
  synchronized(lifecycleLock){requireEnrollmentRoot(epoch,root);if(root.equals(rootToken)&&ownerToken!=null&&expiresAt>System.currentTimeMillis()+30000)return ownerToken;}
  JSONObject status=authenticatedStatus(epoch,root);
  JSONObject code=enrollmentJson(epoch,"/api/auth/pair-code","GET",null,root,root);
  JSONObject paired=enrollmentJson(epoch,"/api/auth/pair","POST",new JSONObject().put("code",code.getString("code")).put("instanceId",status.getString("instanceId")),root,root);
  if(!"owner".equals(paired.getString("access"))||!status.getString("instanceId").equals(paired.getString("instanceId")))throw new IllegalStateException();
  String token=paired.getString("token");JSONObject who=enrollmentJson(epoch,"/api/auth/me","GET",null,token,root);
  if(!"OWNER".equals(who.getJSONObject("access").getString("role"))||!paired.getString("identityId").equals(who.getJSONObject("identity").getString("id"))||!token.equals(who.getJSONObject("session").getString("id")))throw new IllegalStateException();
  long expiry=who.getJSONObject("session").getLong("expiresAt");if(expiry<=System.currentTimeMillis())throw new IllegalStateException();
  synchronized(lifecycleLock){requireEnrollmentRoot(epoch,root);rootToken=root;ownerToken=token;ownerIdentity=paired.getString("identityId");expiresAt=expiry;return token;}
  }
 }
 @PluginMethod public void request(PluginCall call) {
  String path=call.getString("path",""),method=call.getString("method","GET"),body=call.getString("body"),expectedOwner=call.getString("ownerId");
  boolean automation=AutomationsRoutes.owns(path);
  if((automation? !AutomationsRoutes.allowed(path,method)||expectedOwner==null||expectedOwner.trim().isEmpty(): ((path.startsWith("/api/views/")||path.endsWith("/messages/truncate"))&&(!method.equals("POST")||expectedOwner==null||expectedOwner.trim().isEmpty()))||path.contains("..")||path.contains("%")||path.contains("\\")||!path.matches("^/api/(auth/me|agents|status|conversations(/[A-Za-z0-9_-]+(/messages(/truncate)?)?)?|views/interact-(claim|result)|client-devices/[A-Za-z0-9_/-]+|workflow(/[A-Za-z0-9_/?=&-]+)?)$")||!(method.equals("GET")||method.equals("POST")))||((method.equals("GET")||method.equals("DELETE"))&&body!=null)||(body!=null&&body.length()>2*1024*1024)){
   call.reject("Unsupported local agent request.");return;
  }
  JSONObject headers=call.getObject("headers");
  final long epoch;
  try{synchronized(lifecycleLock){epoch=admittedEpoch();pending.add(call);}}catch(Superseded stale){call.reject("Local agent is stopped or unavailable.","LOCAL_AGENT_EPOCH_CHANGED");return;}
  try{workers.execute(()->{try{
   String token=enroll(epoch);
   synchronized(lifecycleLock){requireCurrent(epoch);if(expectedOwner!=null&&!expectedOwner.equals(ownerIdentity)){resolveCurrent(call,epoch,new JSObject().put("status",409).put("body","{\"error\":\"Local owner changed; reconnect before continuing\"}"));return;}}
   requireCurrent(epoch);
   JSONObject result=raw(path,method,body,token,headers,120000);
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
