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
public class ConnectionInstrumentedTest {
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

 @Test public void localDraftCompareExchangePreservesNewerEditsAndEncryptedRecreation() throws Exception {
  String slot="inbox-drafts:v1:instrumentation-"+java.util.UUID.randomUUID();
  String first=new JSONObject().put("body","PRIVATE_SYNTHETIC_DRAFT_"+java.util.UUID.randomUUID()).put("revision","first").toString();
  String second=new JSONObject().put("body","SECOND_SYNTHETIC_BODY").put("revision","second").toString();
  File stored=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getNoBackupFilesDir(),"connection-credentials/"+slotHash(slot));
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();ready();
   JSONObject initial=new JSONObject().put("slot",slot).put("expectedValue",JSONObject.NULL).put("value",first);
   assertEquals("saved",invoke("secureCompareExchange",initial).getJSONObject("value").getString("status"));
   assertFalse(new String(Files.readAllBytes(stored.toPath()),StandardCharsets.ISO_8859_1).contains("PRIVATE_SYNTHETIC_DRAFT_"));
   assertEquals("conflict",invoke("secureCompareExchange",initial).getJSONObject("value").getString("status"));
   assertEquals("saved",invoke("secureCompareExchange",new JSONObject().put("slot",slot).put("expectedValue",first).put("value",second)).getJSONObject("value").getString("status"));
   scenario.recreate();ready();
   assertEquals(second,invoke("secureRead",new JSONObject().put("slot",slot)).getJSONObject("value").getString("value"));
   assertEquals("conflict",invoke("secureCompareExchange",new JSONObject().put("slot",slot).put("expectedValue",first).put("value",JSONObject.NULL)).getJSONObject("value").getString("status"));
   assertEquals(second,invoke("secureRead",new JSONObject().put("slot",slot)).getJSONObject("value").getString("value"));
   assertFalse(invoke("secureCompareExchange",new JSONObject().put("slot","cloud:forbidden-fixture").put("expectedValue",JSONObject.NULL).put("value",first)).getBoolean("ok"));
   assertFalse(invoke("secureCompareExchange",new JSONObject().put("slot",slot).put("expectedValue",second).put("value",17)).getBoolean("ok"));
   assertEquals("saved",invoke("secureCompareExchange",new JSONObject().put("slot",slot).put("expectedValue",second).put("value",JSONObject.NULL)).getJSONObject("value").getString("status"));
   assertFalse(stored.exists());
  }finally{new android.util.AtomicFile(stored).delete();}
 }

 @Test public void encryptedCredentialsAndHttpSurviveRecreationWithCancellationAndRedirectRejection() throws Exception {
  assertTrue("HTTP fixture requires debug packaging", BuildConfig.DEBUG);
  String slot = "instrumentation.connection.synthetic.v1";
  String token = "SYNTHETIC-ALPHA-CONNECTION-NOT-A-REAL-TOKEN";
  String value = new JSONObject().put("token", token).put("identityId", "fixture-owner").toString();
  AtomicInteger redirectTargetHits = new AtomicInteger(), requestHits = new AtomicInteger();
  java.util.concurrent.atomic.AtomicReference<String> lastCapabilities=new java.util.concurrent.atomic.AtomicReference<>();
  CountDownLatch slowStarted = new CountDownLatch(1), releaseSlow = new CountDownLatch(1);
  ServerSocket server = new ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"));
  String base = "http://127.0.0.1:" + server.getLocalPort();
  Thread peer = new Thread(() -> {
   while (!server.isClosed()) {
    try {
     Socket socket = server.accept();
     Thread handler = new Thread(() -> {
      try (socket) {
       socket.setSoTimeout(15000);
       BufferedReader input = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
       String first = input.readLine(), line;requestHits.incrementAndGet();
       int length = 0;
       while ((line = input.readLine()) != null && !line.isEmpty()) {
        if(line.toLowerCase(java.util.Locale.ROOT).startsWith("x-eliza-device-capabilities:"))lastCapabilities.set(line.substring(line.indexOf(':')+1).trim());
        if (line.toLowerCase(java.util.Locale.ROOT).startsWith("content-length:")) length = Integer.parseInt(line.substring(15).trim());
       }
       while (length-- > 0) input.read();
       String path = first.split(" ")[1];
       if (path.equals("/slow")) { slowStarted.countDown(); releaseSlow.await(15, TimeUnit.SECONDS); }
       if (path.equals("/redirect-target")) redirectTargetHits.incrementAndGet();
       String body = "{\"fixture\":true}";
       String response = path.equals("/redirect")
         ? "HTTP/1.1 302 Found\r\nLocation: " + base + "/redirect-target\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
         : "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: " + body.length() + "\r\nConnection: close\r\n\r\n" + body;
       socket.getOutputStream().write(response.getBytes(StandardCharsets.UTF_8));
      } catch (Exception ignored) { /* Cancellation intentionally closes the client socket. */ }
     }, "alpha-connection-fixture-request");
     handler.setDaemon(true); handler.start();
    } catch (Exception ignored) { if (server.isClosed()) return; }
   }
  }, "alpha-connection-fixture");
  peer.setDaemon(true); peer.start();
  try (BoundedActivityScenario<MainActivity> scenario = BoundedActivityScenario.launch(MainActivity.class)) {
   AppNavigation.liveMode();
   ready();
   assertTrue(invoke("secureWrite", new JSONObject().put("slot", slot).put("value", value)).getBoolean("ok"));
   String hash = slotHash(slot);
   File stored = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getNoBackupFilesDir(), "connection-credentials/" + hash);
   assertTrue("Ciphertext exists in private no-backup storage", stored.isFile());
   byte[] ciphertext = Files.readAllBytes(stored.toPath());
   assertFalse("Fixture token must not appear in persisted bytes", new String(ciphertext, StandardCharsets.ISO_8859_1).contains(token));
   assertEquals(1, ciphertext[0]);
   assertEquals(value, invoke("secureRead", new JSONObject().put("slot", slot)).getJSONObject("value").getString("value"));
   scenario.recreate(); ready();
   assertEquals(value, invoke("secureRead", new JSONObject().put("slot", slot)).getJSONObject("value").getString("value"));
   JSONObject request = new JSONObject().put("requestId", "fixture-ok").put("url", base + "/ok").put("method", "POST")
     .put("headers", new JSONObject().put("Content-Type", "application/json").put("Authorization", "Bearer " + token)).put("body", "{\"fixture\":true}");
   JSONObject response = invoke("request", request);
   assertTrue(response.getBoolean("ok")); assertEquals(200, response.getJSONObject("value").getInt("status"));
   assertTrue(response.getJSONObject("value").getJSONObject("data").getBoolean("fixture"));
   String negotiatedCapabilities="calendar.local-event.v1,notes.local-record.v1,reminders.local-record.v1,maps.selected-read.v1";
   for(String capabilities:new String[]{"calendar.local-event.v1","notes.local-record.v1","calendar.local-event.v1,notes.local-record.v1","notes.local-record.v1,calendar.local-event.v1","maps.selected-read.v1","calendar.local-event.v1,notes.local-record.v1,maps.selected-read.v1",negotiatedCapabilities}){
    int before=requestHits.get();
    JSONObject accepted=invoke("request",new JSONObject().put("requestId",java.util.UUID.randomUUID().toString()).put("url",base+"/api/conversations").put("method","GET").put("headers",new JSONObject().put("X-Eliza-Device-Capabilities",capabilities)));
    assertTrue(accepted.getBoolean("ok"));assertEquals(200,accepted.getJSONObject("value").getInt("status"));
    assertTrue(accepted.getJSONObject("value").getJSONObject("data").getBoolean("fixture"));
    assertEquals("Accepted capability header must reach the HTTP peer exactly once",before+1,requestHits.get());assertEquals(capabilities,lastCapabilities.get());
   }
   for(String capabilities:new String[]{"calendar.local-event.v1,calendar.local-event.v1","notes.local-record.v1,","unknown","calendar.local-event.v1,notes.local-record.v1,unknown","notes.local-record.v1\r\nX-Injected: yes","maps.selected-read.v1,maps.selected-read.v1","calendar.local-event.v1,notes.local-record.v1,reminders.local-record.v1,unknown",negotiatedCapabilities+",maps.selected-read.v1",negotiatedCapabilities+",unknown",negotiatedCapabilities+"\nX-Injected: yes"}){
    int before=requestHits.get();assertFalse(invoke("request",new JSONObject().put("requestId",java.util.UUID.randomUUID().toString()).put("url",base+"/capabilities-invalid").put("method","GET").put("headers",new JSONObject().put("X-Eliza-Device-Capabilities",capabilities))).getBoolean("ok"));assertEquals("Invalid capability header must not reach HTTP peer",before,requestHits.get());
   }
   assertFalse(invoke("request", new JSONObject().put("requestId", "fixture-redirect").put("url", base + "/redirect").put("method", "GET")).getBoolean("ok"));
   assertEquals("Redirect destination must never receive a request", 0, redirectTargetHits.get());
   begin("Capacitor.Plugins.AlphaConnection.request(" + new JSONObject().put("requestId", "fixture-cancel").put("url", base + "/slow").put("method", "GET") + ")");
   assertTrue("Slow request reached synthetic host", slowStarted.await(15, TimeUnit.SECONDS));
   WebViewTestDriver.evaluate("window.__connectionCancelled=false;Capacitor.Plugins.AlphaConnection.cancel({requestId:'fixture-cancel'}).then(()=>window.__connectionCancelled=true)");
   until("window.__connectionCancelled===true");
   releaseSlow.countDown(); assertFalse(result().getBoolean("ok"));
   assertTrue(invoke("secureRemove", new JSONObject().put("slot", slot)).getBoolean("ok"));
   assertFalse(stored.exists());
   assertTrue(invoke("secureRead", new JSONObject().put("slot", slot)).getJSONObject("value").isNull("value"));
  } finally {
   releaseSlow.countDown(); server.close(); peer.join(2000);
   // Delete only this fixture's slot even when UI verification fails.
   String hash = slotHash(slot);
   new android.util.AtomicFile(new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getNoBackupFilesDir(), "connection-credentials/" + hash)).delete();
  }
 }
}
