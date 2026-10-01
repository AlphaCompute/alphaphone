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
   ElizaAgentService.start(getContext());
   workers.execute(()->{
    long deadline=System.currentTimeMillis()+90000;
    while(System.currentTimeMillis()<deadline){
     try{enroll();call.resolve(new JSObject().put("state","ready"));return;}
     catch(Exception unavailable){try{Thread.sleep(1000);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();break;}}
    }
    call.reject("Local agent startup did not complete. Check runtime status; no chat was sent.");
   });
  }catch(Exception error){call.reject("The on-device agent could not start. Try again or connect another agent.");}
 }
 @PluginMethod public void getStatus(PluginCall call) {
  try{boolean packaged=runtimePackaged();JSObject status=packaged?new JSObject(ElizaAgentService.getLocalAgentBootState(getContext()).toString()):new JSObject().put("state","unavailable");status.put("packaged",packaged);call.resolve(status);}
  catch(Exception error){call.reject("Local runtime status unavailable.");}
 }
 @PluginMethod public void stop(PluginCall call) {
  ElizaAgentService.stop(getContext());synchronized(AlphaLocalAgentPlugin.class){ownerToken=null;rootToken=null;expiresAt=0;}
  call.resolve(new JSObject().put("state","stopped"));
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
 private static synchronized String enroll() throws Exception {
  String root=ElizaAgentService.localAgentToken();
  if(root==null||root.isEmpty())throw new IllegalStateException();
  if(root.equals(rootToken)&&ownerToken!=null&&expiresAt>System.currentTimeMillis()+30000)return ownerToken;
  JSONObject status=json("/api/auth/status","GET",null,root);
  JSONObject code=json("/api/auth/pair-code","GET",null,root);
  JSONObject paired=json("/api/auth/pair","POST",new JSONObject().put("code",code.getString("code")).put("instanceId",status.getString("instanceId")),root);
  if(!"owner".equals(paired.getString("access"))||!status.getString("instanceId").equals(paired.getString("instanceId")))throw new IllegalStateException();
  String token=paired.getString("token");JSONObject who=json("/api/auth/me","GET",null,token);
  if(!"OWNER".equals(who.getJSONObject("access").getString("role"))||!paired.getString("identityId").equals(who.getJSONObject("identity").getString("id"))||!token.equals(who.getJSONObject("session").getString("id")))throw new IllegalStateException();
  long expiry=who.getJSONObject("session").getLong("expiresAt");if(expiry<=System.currentTimeMillis())throw new IllegalStateException();
  rootToken=root;ownerToken=token;ownerIdentity=paired.getString("identityId");expiresAt=expiry;return token;
 }
 @PluginMethod public void request(PluginCall call) {
  String path=call.getString("path",""),method=call.getString("method","GET"),body=call.getString("body");
  if(path.contains("..")||path.contains("%")||path.contains("\\")||!path.matches("^/api/(auth/me|agents|status|conversations(/[A-Za-z0-9_-]+(/messages)?)?|client-devices/[A-Za-z0-9_/-]+|workflow(/[A-Za-z0-9_/?=&-]+)?)$")||!(method.equals("GET")||method.equals("POST"))||(method.equals("GET")&&body!=null)||(body!=null&&body.length()>2*1024*1024)){
   call.reject("Unsupported local agent request.");return;
  }
  JSONObject headers=call.getObject("headers");
  workers.execute(()->{try{
   String token=enroll();
   String expectedOwner=call.getString("ownerId");
   synchronized(AlphaLocalAgentPlugin.class){if(expectedOwner!=null&&!expectedOwner.equals(ownerIdentity)){call.resolve(new JSObject().put("status",409).put("body","{\"error\":\"Local owner changed; reconnect before continuing\"}"));return;}}
   JSONObject result=raw(path,method,body,token,headers);
   if(result.getInt("status")==401)synchronized(AlphaLocalAgentPlugin.class){ownerToken=null;}
   if(path.equals("/api/auth/me")&&result.getInt("status")==200){JSONObject who=new JSONObject(result.getString("body"));who.getJSONObject("session").put("id","native-owned-session");result.put("body",who.toString());result.remove("bodyBase64");}
   call.resolve(new JSObject(result.toString()));
  }catch(Exception error){call.reject("Local agent request failed. No automatic retry was made.");}});
 }
 @Override protected void handleOnDestroy(){workers.shutdownNow();super.handleOnDestroy();}
}
