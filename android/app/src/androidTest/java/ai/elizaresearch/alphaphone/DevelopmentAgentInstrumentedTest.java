package ai.elizaresearch.alphaphone;

import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class DevelopmentAgentInstrumentedTest {
 private String evaluate(BoundedActivityScenario<MainActivity> scenario, String js) throws Exception {
  return WebViewTestDriver.evaluate(js);
 }
 private JSONObject call(BoundedActivityScenario<MainActivity> scenario, String expression) throws Exception {
  evaluate(scenario,"window.__devTest=null;("+expression+").then(v=>window.__devTest=JSON.stringify(v)).catch(e=>window.__devTest=JSON.stringify({error:e.code||String(e)}))");
  for(int i=0;i<100;i++) {
   String result=evaluate(scenario,"window.__devTest || null");
   if(!"null".equals(result))return new JSONObject((String)new JSONTokener(result).nextValue());
   SystemClock.sleep(100);
  }
  fail("Development bridge did not resolve"); return null;
 }
 @Test public void missingAndInvalidPrivateTokenCannotConnectOrChat() throws Exception {
  org.junit.Assume.assumeTrue("DevelopmentAgent exists only in -PELIZA_DEV_ALLOW_TEST_MOCKS=1 builds",BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS);
  android.content.Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
  File token = new File(context.getFilesDir(),"development-agent-token");
  File backup = new File(context.getFilesDir(),"development-token-test-backup-"+UUID.randomUUID());
  boolean existed=token.exists();
  if(existed)assertTrue("Preserve existing development token",token.renameTo(backup));
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)) {
   boolean ready=false;
   for(int i=0;i<100;i++) {
    ready="true".equals(evaluate(scenario,"Boolean(window.Capacitor?.Plugins?.DevelopmentAgent)"));
    if(ready)break;SystemClock.sleep(100);
   }
   assertTrue("Debug native bridge registered",ready);
   JSONObject absent=call(scenario,"Capacitor.Plugins.DevelopmentAgent.status()");
   assertTrue(absent.getBoolean("available")); assertFalse(absent.getBoolean("configured")); assertFalse(absent.getBoolean("connected"));
   assertFalse(absent.has("token"));
   JSONObject denied=call(scenario,"Capacitor.Plugins.DevelopmentAgent.chat({requestId:'no_token',text:'hello',context:{view:'Home'}})");
   assertEquals("NOT_CONFIGURED",denied.getString("error"));
   try(FileOutputStream output=new FileOutputStream(token)){output.write("invalid".getBytes(java.nio.charset.StandardCharsets.UTF_8));}
   JSONObject invalid=call(scenario,"Capacitor.Plugins.DevelopmentAgent.status()");
   assertFalse(invalid.getBoolean("configured")); assertFalse(invalid.getBoolean("connected"));
   assertTrue(android.security.NetworkSecurityPolicy.getInstance().isCleartextTrafficPermitted("127.0.0.1"));
   assertFalse("Cleartext is restricted to loopback",android.security.NetworkSecurityPolicy.getInstance().isCleartextTrafficPermitted("example.com"));
  } finally {
   if(token.exists())assertTrue(token.delete());
   if(existed)assertTrue("Restore development token without reading it",backup.renameTo(token));
  }
 }
 @Test public void explicitMicrophoneCaptureCreatesAndDiscardsPrivateDraft() throws Exception {
  org.junit.Assume.assumeTrue("DevelopmentAgent exists only in -PELIZA_DEV_ALLOW_TEST_MOCKS=1 builds",BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS);
  android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(context.getPackageName(),android.Manifest.permission.RECORD_AUDIO);
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)) {
   for(int i=0;i<100;i++) {
    if("true".equals(evaluate(scenario,"Boolean(window.Capacitor?.Plugins?.DevelopmentAgent)")))break;
    SystemClock.sleep(100);
   }
   JSONObject started=call(scenario,"Capacitor.Plugins.DevelopmentAgent.startRecording()");
   assertEquals(started.toString(),"recording",started.getString("status"));
   SystemClock.sleep(1500);
   JSONObject stopped=call(scenario,"Capacitor.Plugins.DevelopmentAgent.stopRecording()");
   assertEquals(stopped.toString(),"recorded",stopped.getString("status"));
   assertEquals(started.getString("recordingId"),stopped.getString("recordingId"));
   assertTrue(stopped.getLong("durationMs")>=1000);
   File recording=new File(context.getCacheDir(),"alpha-dev-voice-"+stopped.getString("recordingId")+".m4a");
   assertTrue("Real recorder wrote an app-private audio draft",recording.length()>0);
   JSONObject discarded=call(scenario,"Capacitor.Plugins.DevelopmentAgent.cancelRecording()");
   assertEquals("cancelled",discarded.getString("status"));
   assertFalse("Discard deletes the raw audio",recording.exists());
   JSONObject cannotUpload=call(scenario,"Capacitor.Plugins.DevelopmentAgent.transcribeRecording({requestId:'discarded_recording',recordingId:"+JSONObject.quote(stopped.getString("recordingId"))+"})");
   assertEquals("INVALID_RECORDING",cannotUpload.getString("error"));
  }
 }

}
