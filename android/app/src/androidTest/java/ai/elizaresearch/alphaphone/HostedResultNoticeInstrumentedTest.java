package ai.elizaresearch.alphaphone;
import android.app.NotificationManager;
import android.os.SystemClock;
import android.service.notification.StatusBarNotification;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.Test;
import java.util.UUID;
import java.io.File;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

/** Explicit campaign only. External runner owns permission state/restoration. */
public final class HostedResultNoticeInstrumentedTest {
 private JSONObject call(String expression)throws Exception {
  long ready=SystemClock.elapsedRealtime()+20000;while(SystemClock.elapsedRealtime()<ready&&!"true".equals(WebViewTestDriver.evaluate("Boolean(window.Capacitor?.Plugins?.AlphaHostedResults)")))SystemClock.sleep(50);
  String global="__hostedNativeFixture";WebViewTestDriver.evaluate("window."+global+"=null;Promise.resolve().then(()=>"+expression+").then(v=>window."+global+"=JSON.stringify(v||{}),()=>window."+global+"=JSON.stringify({error:true}))");
  long end=SystemClock.elapsedRealtime()+20000;
  while(SystemClock.elapsedRealtime()<end){String raw=WebViewTestDriver.evaluate("window."+global);if(!"null".equals(raw)&&!"undefined".equals(raw))return new JSONObject((String)new JSONTokener(raw).nextValue());SystemClock.sleep(50);}throw new AssertionError("Native call timed out");
 }
 private void save(String slot,JSONObject value)throws Exception {assertFalse(call("Capacitor.Plugins.AlphaConnection.secureWrite({slot:"+JSONObject.quote(slot)+",value:"+JSONObject.quote(value.toString())+"})").has("error"));}
 private JSONObject read(String slot)throws Exception {JSONObject r=call("Capacitor.Plugins.AlphaConnection.secureRead({slot:"+JSONObject.quote(slot)+"})");return r.isNull("value")?new JSONObject():new JSONObject(r.getString("value"));}
 private void cleanNotice(String key)throws Exception {
  java.util.concurrent.atomic.AtomicReference<AlphaHostedResultsPlugin> plugin=new java.util.concurrent.atomic.AtomicReference<>();java.util.concurrent.atomic.AtomicReference<AlphaConnectionPlugin> store=new java.util.concurrent.atomic.AtomicReference<>();
  BoundedActivityScenario.main(()->{for(android.app.Activity a:androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(androidx.test.runner.lifecycle.Stage.RESUMED))if(a instanceof MainActivity){plugin.set((AlphaHostedResultsPlugin)((MainActivity)a).getBridge().getPlugin("AlphaHostedResults").getInstance());store.set((AlphaConnectionPlugin)((MainActivity)a).getBridge().getPlugin("AlphaConnection").getInstance());}});
  assertNotNull(plugin.get());java.lang.reflect.Field field=AlphaHostedResultsPlugin.class.getDeclaredField("notices");field.setAccessible(true);Object lock=field.get(plugin.get());assertNotNull(lock);
  synchronized(lock){String raw=store.get().readCredentialSlot(HostedResultNotices.LEDGER);JSONObject ledger=raw==null?new JSONObject():new JSONObject(raw);ledger.remove(key);store.get().writeCredentialSlot(HostedResultNotices.LEDGER,ledger.toString());raw=store.get().readCredentialSlot(HostedResultNotices.PENDING);JSONObject pending=raw==null?new JSONObject():new JSONObject(raw);if(key.equals(pending.optString("key")))store.get().writeCredentialSlot(HostedResultNotices.PENDING,"{}");}
 }
 private StatusBarNotification notice(String key){for(StatusBarNotification n:InstrumentationRegistry.getInstrumentation().getTargetContext().getSystemService(NotificationManager.class).getActiveNotifications())if(key.equals(n.getTag()))return n;return null;}
 private void run(boolean granted)throws Exception {
  try(BoundedActivityScenario<MainActivity> activity=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();
   assertEquals("External runner must configure notification permission/channel",granted,call("Capacitor.Plugins.AlphaHostedResults.status()").getBoolean("enabled"));
   String run="fixture_"+UUID.randomUUID(),origin="https://hosted-fixture.invalid",owner=UUID.randomUUID().toString(),agent=UUID.randomUUID().toString(),scope=HostedResultNotices.hash(new JSONArray().put(origin).put(owner).put(agent).toString()),slot="hosted-digests:v1:"+scope,key=HostedResultNotices.hash(scope+":"+run),secret="PRIVATE-HOSTED-FIXTURE-"+UUID.randomUUID();
   JSONObject route=new JSONObject().put("scope",scope).put("origin",origin).put("ownerId",owner).put("agentId",agent).put("runId",run).put("workflowId",run).put("workflowVersionId","version1");
   try {
    save(slot,new JSONObject().put("ids",new JSONArray().put(run)));save(slot+":"+run,new JSONObject().put("runId",run).put("workflowId",run).put("workflowVersionId","version1").put("output",secret));
    File file=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getNoBackupFilesDir(),"connection-credentials/"+HostedResultNotices.hash(slot+":"+run));assertFalse(new String(Files.readAllBytes(file.toPath()),StandardCharsets.ISO_8859_1).contains(secret));
    assertEquals(granted?"posted":"denied",call("Capacitor.Plugins.AlphaHostedResults.publishResult("+route+")").getString("phase"));
    if(granted){StatusBarNotification posted=notice(key);assertNotNull(posted);assertEquals(AlphaHostedResultsPlugin.CHANNEL,posted.getNotification().getChannelId());assertEquals(android.app.Notification.VISIBILITY_PRIVATE,posted.getNotification().visibility);assertFalse(posted.getNotification().extras.toString().contains(owner));assertFalse(posted.getNotification().extras.toString().contains(secret));assertFalse(posted.getNotification().publicVersion.extras.toString().contains(secret));posted.getNotification().contentIntent.send();
     JSONObject tap=null;for(int i=0;i<100;i++){tap=call("Capacitor.Plugins.AlphaHostedResults.pendingResult()");if(key.equals(tap.optString("key")))break;SystemClock.sleep(100);}assertNotNull(tap);assertEquals(key,tap.getString("key"));String token=tap.getString("token");
     activity.recreate();AppNavigation.liveMode();JSONObject restored=call("Capacitor.Plugins.AlphaHostedResults.pendingResult()");assertEquals(token,restored.getString("token"));assertEquals(run,restored.getString("runId"));assertTrue(restored.getBoolean("retained"));
     assertFalse(call("Capacitor.Plugins.AlphaHostedResults.consumeResult({token:"+JSONObject.quote(token)+"})").has("error"));assertEquals("opened",call("Capacitor.Plugins.AlphaHostedResults.publishResult("+route+")").getString("phase"));assertNull(notice(key));
    }else assertNull(notice(key));
   } finally {
    cleanNotice(key);
    InstrumentationRegistry.getInstrumentation().getTargetContext().getSystemService(NotificationManager.class).cancel(key,0);
    assertFalse(call("Capacitor.Plugins.AlphaConnection.secureRemove({slot:"+JSONObject.quote(slot)+"})").has("error"));assertFalse(call("Capacitor.Plugins.AlphaConnection.secureRemove({slot:"+JSONObject.quote(slot+":"+run)+"})").has("error"));
   }
  }
 }
 @Test public void redactedNoticeTapSurvivesRecreationWithoutReplay()throws Exception {org.junit.Assume.assumeTrue("Dedicated hosted notice campaign","1".equals(InstrumentationRegistry.getArguments().getString("hostedNotice")));run(true);}
 @Test public void deniedNotificationRetainsEncryptedHistory()throws Exception {org.junit.Assume.assumeTrue("Dedicated denied notice campaign","1".equals(InstrumentationRegistry.getArguments().getString("hostedNoticeDenied")));run(false);}
}
