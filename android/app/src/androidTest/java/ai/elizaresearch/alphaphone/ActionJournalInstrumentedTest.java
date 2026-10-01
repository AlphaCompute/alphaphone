package ai.elizaresearch.alphaphone;

import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Real WebView bridge, encrypted native disk, concurrent claims and Activity recreation. */
@RunWith(AndroidJUnit4.class)
public class ActionJournalInstrumentedTest {
 private static String hash(String value)throws Exception{
  byte[] bytes=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
  StringBuilder out=new StringBuilder();for(byte b:bytes)out.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return out.toString();
 }
 private JSONObject call(String expression)throws Exception{
  for(int i=0;i<100&&!"true".equals(WebViewTestDriver.evaluate("Boolean(window.Capacitor?.Plugins?.AlphaActionJournal)"));i++)SystemClock.sleep(100);
  WebViewTestDriver.evaluate("window.__journalResult=null;Promise.resolve().then(()=>"+expression+").then(v=>window.__journalResult=JSON.stringify(v),()=>window.__journalResult=JSON.stringify({error:true}))");
  for(int i=0;i<200;i++){
   String raw=WebViewTestDriver.evaluate("window.__journalResult");
   if(!"null".equals(raw))return new JSONObject((String)new JSONTokener(raw).nextValue());
   SystemClock.sleep(50);
  }
  throw new AssertionError("Journal bridge did not complete");
 }
 @Test public void journalSurvivesRecreationAndRejectsRepeatedEffects()throws Exception{
  String scope=hash(UUID.randomUUID().toString()),id=UUID.randomUUID().toString();
  JSONObject request=new JSONObject().put("scope",scope).put("proposalId",id).put("operationId",UUID.randomUUID().toString())
   .put("operationHash",hash("synthetic-operation")).put("record",new JSONObject().put("title","Synthetic journal plaintext sentinel"));
  String params=request.toString(),binding=new JSONObject().put("scope",scope).put("proposalId",id).toString();
  File folder=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getNoBackupFilesDir(),"connection-credentials");
  String entrySlot="action-journal:v1:"+scope+":entry:"+id,indexSlot="action-journal:v1:"+scope+":index";
  try(BoundedActivityScenario<MainActivity> activity=BoundedActivityScenario.launch(MainActivity.class)){
   for(int i=0;i<100&&!"true".equals(WebViewTestDriver.evaluate("Boolean(window.Capacitor?.Plugins?.AlphaActionJournal)"));i++)SystemClock.sleep(100);
   JSONObject reserved=call("Promise.all([Capacitor.Plugins.AlphaActionJournal.reserve("+params+"),Capacitor.Plugins.AlphaActionJournal.reserve("+params+")]).then(entries=>({entries}))");
   JSONArray rows=reserved.getJSONArray("entries");assertNotEquals(rows.getJSONObject(0).getBoolean("created"),rows.getJSONObject(1).getBoolean("created"));
   assertEquals("reserved",rows.getJSONObject(0).getJSONObject("entry").getString("phase"));
   String encrypted=new String(Files.readAllBytes(new File(folder,hash(entrySlot)).toPath()),StandardCharsets.ISO_8859_1);
   assertFalse("Journal contents must be encrypted",encrypted.contains("Synthetic journal plaintext sentinel"));
   activity.recreate();
   JSONObject restored=call("Capacitor.Plugins.AlphaActionJournal.get("+binding+")").getJSONObject("entry");
   assertEquals(request.getString("operationId"),restored.getString("operationId"));
   JSONObject applying=new JSONObject(binding).put("attemptId",UUID.randomUUID().toString());
   assertEquals("applying",call("Capacitor.Plugins.AlphaActionJournal.markApplying("+applying+")").getJSONObject("entry").getString("phase"));
   activity.recreate();
   assertTrue("A recovered applying entry cannot issue another effect",call("Capacitor.Plugins.AlphaActionJournal.markApplying("+applying+")").has("error"));
   JSONObject done=new JSONObject(binding).put("status","succeeded").put("summary","Synthetic operation completed");
   assertEquals("terminal",call("Capacitor.Plugins.AlphaActionJournal.finish("+done+")").getJSONObject("entry").getString("phase"));
   assertFalse(call("Capacitor.Plugins.AlphaActionJournal.finish("+done+")").has("error"));
   done.put("result",new JSONObject().put("changed",true));assertTrue(call("Capacitor.Plugins.AlphaActionJournal.finish("+done+")").has("error"));done.remove("result");
   done.put("status","failed");assertTrue(call("Capacitor.Plugins.AlphaActionJournal.finish("+done+")").has("error"));
   request.put("record",new JSONObject().put("title","Changed immutable proposal"));assertTrue(call("Capacitor.Plugins.AlphaActionJournal.reserve("+request+")").has("error"));
   request.put("operationHash",hash("changed-operation"));assertTrue(call("Capacitor.Plugins.AlphaActionJournal.reserve("+request+")").has("error"));
   JSONObject other=new JSONObject(binding).put("scope",hash("other-scope"));assertTrue(call("Capacitor.Plugins.AlphaActionJournal.get("+other+")").isNull("entry"));
   assertEquals(1,call("Capacitor.Plugins.AlphaActionJournal.list("+new JSONObject().put("scope",scope)+")").getJSONArray("entries").length());
  }finally{
   for(String slot:new String[]{entrySlot,indexSlot})for(String suffix:new String[]{"",".bak",".new"})new File(folder,hash(slot)+suffix).delete();
  }
 }
}
