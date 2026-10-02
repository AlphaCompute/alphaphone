package ai.elizaresearch.alphaphone;

import android.content.Context;
import android.os.Build;
import android.os.Process;
import android.os.SystemClock;
import android.system.Os;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.*;
import org.json.*;
import org.junit.Assume;
import org.junit.Test;
import static org.junit.Assert.*;

/** Opt-in real packaged ARM64 runtime. No host agent, model mock, or bearer in test output. */
public final class ResidentAgentInstrumentedTest {
 private Context context;
 private JSONObject fixture;
 private static String hash(byte[] bytes)throws Exception {StringBuilder value=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))value.append(String.format(Locale.ROOT,"%02x",b&255));return value.toString();}
 private static byte[] bounded(InputStream input,int max)throws Exception {ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buf=new byte[8192];int n;while((n=input.read(buf))!=-1){assertTrue("Input exceeds bound",out.size()+n<=max);out.write(buf,0,n);}return out.toByteArray();}
 private static String fileHash(File file)throws Exception {try(InputStream in=new FileInputStream(file)){MessageDigest digest=MessageDigest.getInstance("SHA-256");byte[] buf=new byte[65536];int n;while((n=in.read(buf))!=-1)digest.update(buf,0,n);StringBuilder s=new StringBuilder();for(byte b:digest.digest())s.append(String.format(Locale.ROOT,"%02x",b&255));return s.toString();}}
 private JSONObject invoke(String method,JSONObject input,long timeout)throws Exception {
  assertTrue(method.matches("[A-Za-z]+"));
  WebViewTestDriver.evaluateSensitive("window.__residentResult=null;Capacitor.Plugins.Agent."+method+"("+input+").then(value=>window.__residentResult=JSON.stringify({value}),()=>window.__residentResult=JSON.stringify({rejected:true}))");
  long end=SystemClock.elapsedRealtime()+timeout;
  while(SystemClock.elapsedRealtime()<end){String raw=WebViewTestDriver.evaluateSensitive("window.__residentResult");if(!"null".equals(raw)){JSONObject result=new JSONObject((String)new JSONTokener(raw).nextValue());WebViewTestDriver.evaluateSensitive("delete window.__residentResult");return result;}SystemClock.sleep(100);}
  throw new AssertionError("Resident bridge deadline; ambiguous effects must not be resubmitted");
 }
 private JSONObject call(String method,JSONObject input,long timeout)throws Exception {JSONObject value=invoke(method,input,timeout);assertFalse("Resident bridge rejected",value.optBoolean("rejected"));return value.getJSONObject("value");}
 private JSONObject request(String path,JSONObject body)throws Exception {
  JSONObject args=new JSONObject().put("path",path).put("method",body==null?"GET":"POST").put("headers",new JSONObject()).put("timeoutMs",120000);
  if(body!=null)args.put("body",body.toString());JSONObject reply=call("request",args,125000);assertEquals("Resident API rejected",200,reply.getInt("status"));return new JSONObject(reply.getString("body"));
 }
 private JSONObject nativeGet(String path,String bearer)throws Exception {
  JSONObject headers=new JSONObject();if(bearer!=null)headers.put("Authorization","Bearer "+bearer);
  return new JSONObject(ElizaAgentService.requestLocalAgent(new JSONObject().put("path",path).put("method","GET").put("headers",headers).put("timeoutMs",10000).toString()));
 }
 private String processStart(int pid)throws Exception {String stat=new String(Files.readAllBytes(new File("/proc/"+pid+"/stat").toPath()),StandardCharsets.UTF_8);String[] columns=stat.substring(stat.lastIndexOf(')')+2).split(" ");return columns[19];}
 private JSONObject ownedChild()throws Exception {
  List<JSONObject> matches=new ArrayList<>();File[] processes=new File("/proc").listFiles();assertNotNull(processes);
  String bundle=new File(context.getFilesDir(),"agent/agent-bundle.js").getCanonicalPath();
  for(File proc:processes){if(!proc.getName().matches("[0-9]+"))continue;
   try {if(Os.stat(proc.getPath()).st_uid!=Process.myUid())continue;
    String command=new String(Files.readAllBytes(new File(proc,"cmdline").toPath()),StandardCharsets.UTF_8);
    if(!Arrays.asList(command.split(String.valueOf((char)0))).contains(bundle))continue;
    String executable=Os.readlink(new File(proc,"exe").getPath());
    if(!fileHash(new File(executable)).equals(fixture.getString("processExecutableSha256")))continue;
    int pid=Integer.parseInt(proc.getName());matches.add(new JSONObject().put("pid",pid).put("start",processStart(pid)).put("uid",Process.myUid()).put("executableSha256",fixture.getString("processExecutableSha256")));
   } catch(IOException|android.system.ErrnoException raced) { /* Other processes may exit during observation. */ }
  }
  assertEquals("Require exactly one verified native runtime process",1,matches.size());return matches.get(0);
 }
 private void stopped(JSONObject child)throws Exception {
  long end=SystemClock.elapsedRealtime()+30000;
  while(SystemClock.elapsedRealtime()<end){boolean gone=!new File("/proc/"+child.getInt("pid")).exists();if(!gone)try{gone=!processStart(child.getInt("pid")).equals(child.getString("start"));}catch(IOException raced){gone=true;}
   JSONObject status=ElizaAgentService.getLocalAgentBootState(context);if(gone&&!status.optBoolean("socketListening")&&!status.optBoolean("serviceActive"))return;SystemClock.sleep(100);}
  fail("Resident process/socket did not stop within30s");
 }
 private JSONObject owner()throws Exception {JSONObject who=request("/api/auth/me",null);assertEquals("owner",who.getJSONObject("identity").getString("kind"));assertEquals("OWNER",who.getJSONObject("access").getString("role"));assertEquals("native-owned-session",who.getJSONObject("session").getString("id"));return who;}
 private JSONObject agent()throws Exception {JSONArray agents=request("/api/agents",null).getJSONArray("agents");assertEquals(1,agents.length());JSONObject agent=agents.getJSONObject(0);assertEquals("running",agent.getString("status"));return agent;}
 private JSONArray history(String id)throws Exception{return request("/api/conversations/"+id+"/messages",null).getJSONArray("messages");}
 private JSONObject trace(String room,String messageId)throws Exception {
  long end=SystemClock.elapsedRealtime()+30000;
  while(SystemClock.elapsedRealtime()<end){JSONObject response=nativeGet("/api/trajectories?limit=100&roomId="+room,null);assertEquals(200,response.getInt("status"));JSONObject list=new JSONObject(response.getString("body"));JSONArray entries=list.getJSONArray("trajectories");assertEquals(list.getInt("total"),entries.length());JSONObject found=null;
   for(int i=0;i<entries.length();i++){String id=entries.getJSONObject(i).getString("id");assertTrue(id.matches("[A-Za-z0-9_-]+"));JSONObject detail=new JSONObject(nativeGet("/api/trajectories/"+id+"?includePayloads=1",null).getString("body"));JSONObject trajectory=detail.getJSONObject("trajectory"),meta=trajectory.optJSONObject("metadata");
    if(meta==null||!messageId.equals(meta.optString("messageId"))||meta.has("taskId"))continue;
    assertNull("Ambiguous initial trajectory",found);found=detail;
   }
   if(found!=null&&!found.getJSONObject("trajectory").isNull("endTime")){assertEquals("completed",found.getJSONObject("trajectory").getString("status"));assertTrue(found.getBoolean("payloadsIncluded"));assertEquals(room,found.getJSONObject("trajectory").getString("roomId"));JSONArray calls=found.getJSONArray("llmCalls");assertTrue(calls.length()>0&&calls.length()<=12);for(int i=0;i<calls.length();i++){JSONObject c=calls.getJSONObject(i);assertEquals("qwen-3.8-27b",c.getString("model"));assertTrue(c.getString("provider").toLowerCase(Locale.ROOT).contains("cerebras"));assertEquals(found.getJSONObject("trajectory").getString("id"),c.getString("trajectoryId"));assertFalse(c.optString("response").isEmpty());}return new JSONObject().put("trajectoryId",found.getJSONObject("trajectory").getString("id")).put("modelCalls",calls.length());}
   SystemClock.sleep(250);
  }throw new AssertionError("Correlated initial resident trajectory not complete");
 }
 @Test public void bootAuthenticatedChatAndRestartPersists()throws Exception {
  Assume.assumeTrue("Explicit resident fixture required","1".equals(InstrumentationRegistry.getArguments().getString("residentAgent")));
  assertTrue(BuildConfig.DEBUG);assertEquals("arm64-v8a",Build.SUPPORTED_ABIS[0]);assertTrue("Never run in user0",Process.myUid()/100000>0);
  context=InstrumentationRegistry.getInstrumentation().getTargetContext();File input=new File(context.getFilesDir(),"resident-provider-input.json");assertTrue(input.isFile());assertEquals(0,Os.stat(input.getPath()).st_mode&0077);assertEquals(Process.myUid(),Os.stat(input.getPath()).st_uid);
  try(InputStream stream=new FileInputStream(input)){fixture=new JSONObject(new String(bounded(stream,16384),StandardCharsets.UTF_8));}assertTrue(input.delete());
  assertEquals(InstrumentationRegistry.getArguments().getString("residentRunId"),fixture.getString("runId"));assertNull("Fresh credential slot",new AlphaCredentialStore(context).readCredentialSlot("local-agent-provider:v1"));
  File bun=new File(context.getApplicationInfo().nativeLibraryDir,"libeliza_bun.so");assertEquals(fixture.getString("bunSha256"),fileHash(bun));
  try(InputStream in=new FileInputStream(bun)){byte[] h=new byte[20];assertEquals(20,in.read(h));assertEquals(0x7f,h[0]&255);assertEquals('E',h[1]);assertEquals('L',h[2]);assertEquals('F',h[3]);assertEquals(2,h[4]);assertEquals(1,h[5]);assertEquals(183,(h[18]&255)|((h[19]&255)<<8));}
  try(InputStream in=context.getAssets().open("agent/agent-bundle.js")){assertEquals(fixture.getString("bundleSha256"),hash(bounded(in,128*1024*1024)));}
  try(InputStream in=context.getAssets().open("agent/alpha-source.json")){assertEquals(fixture.getString("sourceSha256"),hash(bounded(in,8*1024*1024)));}
  JSONObject child=null,proof=new JSONObject().put("runId",fixture.getString("runId")).put("passed",false);
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)) {
   try {
    long bridgeDeadline=SystemClock.elapsedRealtime()+15000;
    while(!"true".equals(WebViewTestDriver.evaluateSensitive("Boolean(window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.Agent)"))){assertTrue("Native bridge not ready",SystemClock.elapsedRealtime()<bridgeDeadline);SystemClock.sleep(100);}
    assertTrue(call("getStatus",new JSONObject(),15000).getBoolean("packaged"));assertFalse(ElizaAgentService.getLocalAgentBootState(context).optBoolean("socketListening"));
    assertTrue("Missing provider must reject",invoke("start",new JSONObject(),15000).optBoolean("rejected"));
    assertFalse(ElizaAgentService.getLocalAgentBootState(context).optBoolean("socketListening"));
    JSONObject provider=new JSONObject().put("apiKey",fixture.getString("apiKey")).put("model","qwen-3.8-27b");assertTrue(call("configureProvider",provider,15000).getBoolean("configured"));fixture.remove("apiKey");provider.remove("apiKey");
    assertEquals("ready",call("start",new JSONObject(),95000).getString("state"));child=ownedChild();proof.put("firstProcess",child);
    assertEquals(fixture.getString("bundleSha256"),fileHash(new File(context.getFilesDir(),"agent/agent-bundle.js")));
    JSONObject who=owner(),agent=agent();String ownerId=who.getJSONObject("identity").getString("id"),agentId=agent.getString("id");
    int denied=nativeGet("/api/conversations","synthetic-invalid-bearer").getInt("status");assertTrue("Explicit invalid bearer must deny",denied==401||denied==403);
    JSONObject wrong=call("request",new JSONObject().put("path","/api/auth/me").put("method","GET").put("ownerId","wrong-owner"),15000);assertEquals(409,wrong.getInt("status"));
    String label="Resident fixture "+fixture.getString("runId");JSONObject conversation=request("/api/conversations",new JSONObject().put("title",label)).getJSONObject("conversation");String id=conversation.getString("id"),room=conversation.getString("roomId");assertTrue(id.matches("[A-Za-z0-9_-]+"));assertTrue(room.matches("[A-Za-z0-9_-]+"));assertEquals(0,history(id).length());
    JSONObject reply=request("/api/conversations/"+id+"/messages",new JSONObject().put("text",label+": Reply with the value of seven times eight. Do not use tools or create anything.").put("channelType","DM").put("clientMessageId",UUID.randomUUID().toString()));assertFalse("Actual resident reply required",reply.getString("text").trim().isEmpty());assertTrue(reply.getString("text").contains("56"));
    proof.put("model",trace(room,reply.getString("userMessageId")));JSONArray before=history(id);assertTrue(before.length()>=2);String historyHash=hash(before.toString().getBytes(StandardCharsets.UTF_8));
    call("stop",new JSONObject(),15000);stopped(child);JSONObject old=child;child=null;
    assertEquals("ready",call("start",new JSONObject(),95000).getString("state"));child=ownedChild();assertNotEquals("Real native process restart",old.getInt("pid"),child.getInt("pid"));
    assertEquals(ownerId,owner().getJSONObject("identity").getString("id"));assertEquals(agentId,agent().getString("id"));assertEquals(historyHash,hash(history(id).toString().getBytes(StandardCharsets.UTF_8)));
    proof.put("secondProcess",child).put("ownerId",ownerId).put("agentId",agentId).put("conversationId",id).put("historySha256",historyHash).put("passed",true);
   } finally {
    ElizaAgentService.stop(context);if(child!=null)stopped(child);
    proof.put("socketStopped",!ElizaAgentService.getLocalAgentBootState(context).optBoolean("socketListening"));
    try(FileOutputStream output=context.openFileOutput("resident-complete.json",Context.MODE_PRIVATE)){output.write(proof.toString().getBytes(StandardCharsets.UTF_8));}
   }
  }
 }
}
