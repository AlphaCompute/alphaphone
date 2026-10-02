package ai.elizaresearch.alphaphone;

import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Native bridge integration against an explicitly synthetic HTTP peer; no real credentials. */
@RunWith(AndroidJUnit4.class)
public class ReminderDeletionStorageInstrumentedTest {
 private String slotHash(String slot) throws Exception {
  StringBuilder text = new StringBuilder();
  for (byte b : java.security.MessageDigest.getInstance("SHA-256").digest(slot.getBytes(StandardCharsets.UTF_8))) text.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
  return text.toString();
 }
 private void until(String expression) throws Exception {
  long deadline = SystemClock.elapsedRealtime() + 15000;
  while (SystemClock.elapsedRealtime() < deadline) {
   if ("true".equals(WebViewTestDriver.evaluate("Boolean(" + expression + ")"))) return;
   SystemClock.sleep(60);
  }
  fail("Connection fixture did not finish");
 }
 private void begin(String expression) throws Exception {
  WebViewTestDriver.evaluate("window.__connectionResult=null;Promise.resolve(" + expression + ").then(value=>window.__connectionResult={ok:true,value:value??null},()=>window.__connectionResult={ok:false})");
 }
 private JSONObject result() throws Exception {
  until("window.__connectionResult!==null");
  return new JSONObject(WebViewTestDriver.evaluate("window.__connectionResult"));
 }
 private JSONObject invoke(String method, JSONObject args) throws Exception {
  begin("Capacitor.Plugins.AlphaConnection." + method + "(" + args + ")"); return result();
 }
 private void ready() throws Exception { until("window.Capacitor?.Plugins?.AlphaConnection && document.documentElement.dataset.activeView"); }

 @Test public void reminderDeletionSlotUsesEncryptedCompareExchange() throws Exception {
  assertTrue(BuildConfig.DEBUG);assertTrue("Owned secondary test user required",android.os.Process.myUid()/100000>0);
  String slot="reminder-deletions:v1:device";
  File stored=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getNoBackupFilesDir(),"connection-credentials/"+slotHash(slot));
  assertFalse("Preserve preexisting reminder recovery",stored.exists());
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();ready();
   assertTrue(invoke("secureRead",new JSONObject().put("slot",slot)).getJSONObject("value").isNull("value"));
   String value=new JSONObject().put("fixture","PRIVATE_REMINDER_CAS_"+java.util.UUID.randomUUID()).toString();
   boolean owned=false;
   try{
    assertEquals("saved",invoke("secureCompareExchange",new JSONObject().put("slot",slot).put("expectedValue",JSONObject.NULL).put("value",value)).getJSONObject("value").getString("status"));owned=true;
    assertFalse(new String(Files.readAllBytes(stored.toPath()),StandardCharsets.ISO_8859_1).contains("PRIVATE_REMINDER_CAS_"));
    assertEquals("conflict",invoke("secureCompareExchange",new JSONObject().put("slot",slot).put("expectedValue",JSONObject.NULL).put("value","{}")).getJSONObject("value").getString("status"));
    scenario.recreate();ready();
    assertEquals(value,invoke("secureRead",new JSONObject().put("slot",slot)).getJSONObject("value").getString("value"));
    assertFalse(invoke("secureCompareExchange",new JSONObject().put("slot",slot).put("expectedValue",value).put("value",new String(new char[262145]).replace('\0','x'))).getBoolean("ok"));
    assertEquals(value,invoke("secureRead",new JSONObject().put("slot",slot)).getJSONObject("value").getString("value"));
   }finally{
    if(owned){assertEquals("saved",invoke("secureCompareExchange",new JSONObject().put("slot",slot).put("expectedValue",value).put("value",JSONObject.NULL)).getJSONObject("value").getString("status"));assertFalse(stored.exists());}
   }
  }
 }

}
