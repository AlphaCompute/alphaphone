package ai.elizaresearch.alphaphone;

import static org.junit.Assert.*;

import android.content.Context;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Resident agent with ELIZA_SECRET_SWAP_ENABLED/ELIZA_PII_SWAP_ENABLED on: the turn completes, and the recorded
 * provider request carries swap placeholders, never the raw identifiers. Requires an explicit fixture
 * (scripts/android-resident-instrumentation.mjs); a recorded trajectory is the request after the swap.
 */
@RunWith(AndroidJUnit4.class)
public class ResidentEgressRedactionInstrumentedTest {
 private static final String[] RAW={"jane.okafor@acmecapital.com","4111 1111 1111 1111","123-45-6789"};
 private Context context;private String root;
 private JSONObject call(String path,String method,JSONObject body)throws Exception{
  JSONObject headers=new JSONObject().put("Authorization","Bearer "+root);
  JSONObject args=new JSONObject().put("path",path).put("method",method).put("headers",headers).put("timeoutMs",120000);
  if(body!=null)args.put("body",body.toString());
  JSONObject result=new JSONObject(ElizaAgentService.requestLocalAgent(args.toString()));
  assertEquals("HTTP "+path+" "+result.optString("body"),200,result.getInt("status"));return new JSONObject(result.getString("body"));
 }
 @Test public void swappedTurnCompletesWithoutRawIdentifiers()throws Exception{
  Assume.assumeTrue("1".equals(InstrumentationRegistry.getArguments().getString("residentService")));
  context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  File input=new File(context.getFilesDir(),"resident-provider-input.json");
  JSONObject fixture=new JSONObject(new String(Files.readAllBytes(input.toPath()),StandardCharsets.UTF_8));assertTrue(input.delete());
  new AlphaCredentialStore(context).writeCredentialSlot("local-agent-provider:v1",new JSONObject().put("key",fixture.getString("apiKey")).put("model","qwen-3.8-27b").toString());
  assertTrue(context.getSharedPreferences("CapacitorStorage",Context.MODE_PRIVATE).edit().putString("eliza:mobile-runtime-mode","cloud-hybrid").commit());
  JSONObject proof=new JSONObject().put("runId",fixture.getString("runId")).put("scope","resident-egress-redaction").put("passed",false);
  try{
   ElizaAgentService.start(context);
   long deadline=SystemClock.elapsedRealtime()+90000;JSONObject status=null;
   while(SystemClock.elapsedRealtime()<deadline&&status==null){try{root=ElizaAgentService.localAgentToken(context);if(root!=null&&!root.isEmpty())status=call("/api/auth/status","GET",null);}catch(Exception e){status=null;}if(status==null)SystemClock.sleep(250);}
   assertNotNull("resident readiness",status);
   JSONObject conversation=call("/api/conversations","POST",new JSONObject().put("title","Redaction probe")).getJSONObject("conversation");
   String id=conversation.getString("id"),room=conversation.getString("roomId");
   JSONObject reply=call("/api/conversations/"+id+"/messages","POST",new JSONObject().put("text","Context only, do not repeat it: email "+RAW[0]+", card "+RAW[1]+", SSN "+RAW[2]+". Reply with the value of seven times eight. Do not use tools or create anything.").put("channelType","DM").put("clientMessageId",UUID.randomUUID().toString()));
   String text=reply.getString("text");proof.put("reply",text).put("replyHas56",text.contains("56"));
   for(String raw:RAW)proof.put("replyContains:"+raw,text.contains(raw));
   JSONArray llm=new JSONArray();long end=SystemClock.elapsedRealtime()+30000;
   while(llm.length()==0&&SystemClock.elapsedRealtime()<end){JSONArray list=call("/api/trajectories?limit=100&roomId="+room,"GET",null).getJSONArray("trajectories");
    for(int i=0;i<list.length();i++){JSONObject d=call("/api/trajectories/"+list.getJSONObject(i).getString("id")+"?includePayloads=1","GET",null);if(d.has("llmCalls")&&!d.getJSONObject("trajectory").isNull("endTime"))for(int j=0;j<d.getJSONArray("llmCalls").length();j++)llm.put(d.getJSONArray("llmCalls").getJSONObject(j));}
    if(llm.length()==0)SystemClock.sleep(500);}
   String recorded=llm.toString();proof.put("recordedLlmCalls",llm.length()).put("recordedHasSecretPlaceholder",recorded.contains("__ELIZA_SECRET_"));
   for(String raw:RAW)proof.put("recordedContains:"+raw,recorded.contains(raw));
   boolean clean=llm.length()>0&&recorded.contains("__ELIZA_SECRET_");for(String raw:RAW)clean&=!recorded.contains(raw);
   proof.put("passed",text.contains("56")&&clean);
  }finally{
   ElizaAgentService.stop(context);
   try(java.io.FileOutputStream out=context.openFileOutput("resident-redaction-complete.json",Context.MODE_PRIVATE)){out.write(proof.toString().getBytes(StandardCharsets.UTF_8));}
  }
  assertTrue("Swapped turn must complete and egress no raw identifiers: "+proof,proof.getBoolean("passed"));
 }
}
