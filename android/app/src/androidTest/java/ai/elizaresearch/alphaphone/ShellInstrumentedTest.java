package ai.elizaresearch.alphaphone;
import android.content.Intent;
import android.os.SystemClock;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONObject;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class ShellInstrumentedTest {
 private String evaluate(ActivityScenario<MainActivity> scenario, String js) throws Exception {
  AtomicReference<String> answer = new AtomicReference<>(); CountDownLatch latch = new CountDownLatch(1);
  scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(js, value -> { answer.set(value); latch.countDown(); }));
  assertTrue("WebView did not answer", latch.await(5, TimeUnit.SECONDS)); return answer.get();
 }
 @Test public void bundledRendererAndNativeBridgesWork() throws Exception {
  try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
   String ready = "false";
   for(int i=0; i<100; i++) {
    ready=evaluate(scenario,"Boolean(document.querySelector('main') && window.Capacitor)");
    if (ready.equals("true")) break;
    SystemClock.sleep(100);
   }
   assertEquals("Bundled renderer must mount offline", "true",ready);
   evaluate(scenario,"Promise.all([Capacitor.Plugins.DeviceApps.list(),Capacitor.Plugins.ElizaSystem.getStatus(),Capacitor.Plugins.DeviceApps.buildInfo()]).then(v=>document.body.dataset.nativeResult=JSON.stringify(v)).catch(e=>document.body.dataset.nativeError=String(e))");
   String result="null";
   for(int i=0;i<100;i++) { result=evaluate(scenario,"document.body.dataset.nativeResult || null"); if(!result.equals("null"))break;SystemClock.sleep(100); }
   assertNotEquals("Native bridge failed: "+evaluate(scenario,"document.body.dataset.nativeError || null"),"null",result);
   String payload=(String)new org.json.JSONTokener(result).nextValue();
   org.json.JSONArray values = new org.json.JSONArray(payload);
   assertTrue("Installed apps are discoverable", values.getJSONObject(0).getJSONArray("apps").length()>0);
   assertEquals("ai.elizaresearch.alphaphone",values.getJSONObject(1).getString("packageName"));
   assertEquals(BuildConfig.IS_LAUNCHER,values.getJSONObject(2).getBoolean("launcher"));
   assertFalse("Setup must not claim a connected agent",evaluate(scenario,"document.body.innerText").contains("Agent connected"));
   Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).setPackage("ai.elizaresearch.alphaphone");
   boolean qualifies = InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageManager().queryIntentActivities(home,0).size()>0;
   assertEquals("HOME qualification follows variant",BuildConfig.IS_LAUNCHER,qualifies);
   evaluate(scenario,"Capacitor.Plugins.DeviceApps.launch({packageName:'com.android.settings'})");
   boolean settingsOpened = false;
   for (int i=0; i<30; i++) {
    android.os.ParcelFileDescriptor pipe = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("dumpsys activity activities");
    String activity;
    try (java.io.InputStream input = new android.os.ParcelFileDescriptor.AutoCloseInputStream(pipe)) {
     activity = new java.io.BufferedReader(new java.io.InputStreamReader(input, java.nio.charset.StandardCharsets.UTF_8)).lines().collect(java.util.stream.Collectors.joining("\n"));
    }
    settingsOpened = activity.lines().anyMatch(line -> (line.contains("mResumedActivity") || line.contains("topResumedActivity")) && line.contains("com.android.settings"));
    if(settingsOpened)break;
    SystemClock.sleep(100);
   }
   assertTrue("Native installed-app handoff must open Settings",settingsOpened);
  }
 }
}
