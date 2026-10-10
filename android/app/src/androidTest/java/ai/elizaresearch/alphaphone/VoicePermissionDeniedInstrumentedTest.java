package ai.elizaresearch.alphaphone;

import android.content.Context;
import android.content.pm.PackageManager;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/**
 * journeys-12: with RECORD_AUDIO revoked, starting a recording rejects with
 * "permission-denied" and the recorder shows the denied state with Open app settings.
 *
 * Revoking a runtime permission kills the target process, so the revoke step runs before
 * this instrumentation starts, on a disposable test device:
 *   adb shell pm revoke ai.elizaresearch.alphaphone android.permission.RECORD_AUDIO
 *   adb shell am instrument -w -e voicePermissionDenied 1 \
 *     -e class ai.elizaresearch.alphaphone.VoicePermissionDeniedInstrumentedTest \
 *     ai.elizaresearch.alphaphone.test/androidx.test.runner.AndroidJUnitRunner
 * The system permission prompt, if Android shows one, is dismissed with Back (a denial).
 * No audio is captured and nothing is uploaded. This proves the emulator/device renderer and
 * plugin path only, not a user's acceptance.
 */
@RunWith(AndroidJUnit4.class)
public final class VoicePermissionDeniedInstrumentedTest {
 private static void until(String expression,long timeout)throws Exception{long end=SystemClock.elapsedRealtime()+timeout;while(SystemClock.elapsedRealtime()<end){if("true".equals(WebViewTestDriver.evaluate("Boolean("+expression+")")))return;SystemClock.sleep(100);}fail("Voice permission UI condition timed out: "+expression);}
 private static String button(String label){return "[...document.querySelectorAll('button')].find(e=>(e.getAttribute('aria-label')==="+JSONObject.quote(label)+"||e.textContent.trim()==="+JSONObject.quote(label)+")&&e.getClientRects().length&&!e.disabled)";}
 private static void click(String label)throws Exception{until(button(label),20000);WebViewTestDriver.evaluate(button(label)+".click()");}
 private static boolean appFocused()throws Exception{AtomicBoolean focused=new AtomicBoolean();WebViewTestDriver.withActivity(MainActivity.class,a->focused.set(a.hasWindowFocus()));return focused.get();}
 @Test public void deniedMicrophoneShowsSettingsRecoveryAndKeyboard()throws Exception {
  org.junit.Assume.assumeTrue("Run after revoking RECORD_AUDIO (see class documentation)","1".equals(InstrumentationRegistry.getArguments().getString("voicePermissionDenied")));
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  assertEquals("RECORD_AUDIO must be revoked before this instrumentation starts",PackageManager.PERMISSION_DENIED,context.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO));
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   until("window.Capacitor?.Plugins?.AlphaVoiceCloud&&document.querySelector('.os')",60000);
   AppNavigation.liveMode();WebViewTestDriver.evaluate(AppNavigation.request("Notes"));until(AppNavigation.selected("Notes"),30000);until("window.__alphaTestNavigation?.status==='complete'",30000);
   click("Record and transcribe");
   // Recording without transcription needs no speech models; it still needs the microphone.
   click("Record without transcription");
   click("Start recording");
   long end=SystemClock.elapsedRealtime()+20000;boolean dismissed=false;String denied="document.querySelector('[data-alpha-subview=\"notes-recording\"]')?.dataset.voiceState==='denied'";
   while(SystemClock.elapsedRealtime()<end&&!"true".equals(WebViewTestDriver.evaluate("Boolean("+denied+")"))){
    // The permission prompt takes window focus; Back dismisses it as a denial.
    if(!dismissed&&!appFocused()){SystemClock.sleep(500);if(!appFocused()){WebViewTestDriver.pressBack();dismissed=true;}}
    SystemClock.sleep(200);
   }
   until(denied,5000);
   String text=WebViewTestDriver.evaluate("document.querySelector('[data-alpha-subview=\"notes-recording\"]').textContent");
   assertTrue("Denied guidance names app settings",text.contains("Open app settings"));
   assertTrue("Denied guidance offers the keyboard",text.contains("keyboard"));
   assertTrue("Nothing was recorded",text.contains("Nothing was recorded"));
   until(button("Open app settings"),5000);
   assertEquals("Start recording stays available for a retry","true",WebViewTestDriver.evaluate("Boolean("+button("Start recording")+")"));
   assertEquals("Denial must not grant the permission",PackageManager.PERMISSION_DENIED,context.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO));
   // Open app settings leaves Alpha for Android's app details page; Back returns.
   click("Open app settings");
   long left=SystemClock.elapsedRealtime()+10000;while(SystemClock.elapsedRealtime()<left&&appFocused())SystemClock.sleep(200);
   assertFalse("Android app settings opened",appFocused());
   WebViewTestDriver.pressBack();
   long back=SystemClock.elapsedRealtime()+10000;while(SystemClock.elapsedRealtime()<back&&!appFocused())SystemClock.sleep(200);
   assertTrue("Back returns to Alpha",appFocused());
  }
 }
}
