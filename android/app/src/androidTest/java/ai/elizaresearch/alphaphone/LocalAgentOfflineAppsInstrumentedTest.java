package ai.elizaresearch.alphaphone;

import android.app.UiAutomation;
import android.content.Context;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Emulator check: signed out with the network off, Welcome offers local apps without AI and
 * Home, Notes and Calendar are reachable. The saved Cloud credential and connection selection are
 * restored afterwards. This does not prove a full AOSP image or a physical device. */
@RunWith(AndroidJUnit4.class)
public class LocalAgentOfflineAppsInstrumentedTest {
 private static final String SELECTION = "alpha.connection.selection.v1";
 private static void until(String expression) throws Exception {
  long deadline = SystemClock.elapsedRealtime() + 20000;
  while (SystemClock.elapsedRealtime() < deadline) {
   if ("true".equals(WebViewTestDriver.evaluate("Boolean(" + expression + ")"))) return;
   SystemClock.sleep(80);
  }
  fail("Renderer did not reach expected state: " + expression);
 }
 private static void shell(String command) throws Exception {
  UiAutomation ui = InstrumentationRegistry.getInstrumentation().getUiAutomation();
  try (ParcelFileDescriptor.AutoCloseInputStream input = new ParcelFileDescriptor.AutoCloseInputStream(ui.executeShellCommand(command))) { input.readAllBytes(); }
 }
 @Test public void signedOutOfflineReachesLocalApps() throws Exception {
  Assume.assumeFalse("Product Welcome only; test-mocks builds use the development chooser", BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS);
  Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
  AlphaCredentialStore store = new AlphaCredentialStore(context);
  String savedCloud = store.readCredentialSlot("cloud:production");
  String savedSelection = null;
  shell("svc wifi disable"); shell("svc data disable");
  try (BoundedActivityScenario<MainActivity> scenario = BoundedActivityScenario.launch(MainActivity.class)) {
   until("document.querySelector('[data-screen]')");
   savedSelection = WebViewTestDriver.evaluate("localStorage.getItem('" + SELECTION + "')");
   if (savedCloud != null) store.removeCredentialSlot("cloud:production");
   String previous = WebViewTestDriver.evaluate("performance.timeOrigin");
   WebViewTestDriver.navigateHostDocument("localStorage.removeItem('" + SELECTION + "');location.replace(location.origin+location.pathname)", true);
   until("performance.timeOrigin!==" + previous + "&&[...document.querySelectorAll('.alpha-connection button')].some(b=>b.textContent==='Use local apps without AI')");
   WebViewTestDriver.evaluate("[...document.querySelectorAll('.alpha-connection button')].find(b=>b.textContent==='Use local apps without AI').click()");
   until("!document.querySelector('.alpha-connection-scrim')");
   // Back closes the access panel a fresh install opens before it leaves an app; settle it first.
   AppNavigation.declineStartupAccess();
   assertEquals("Local apps choice is saved", "true", WebViewTestDriver.evaluate("localStorage.getItem('" + SELECTION + "')===JSON.stringify({kind:'offline',localApps:true})"));
   for (String view : new String[]{"Notes", "Calendar"}) {
    WebViewTestDriver.evaluate(AppNavigation.request(view));
    until(AppNavigation.selected(view));
    WebViewTestDriver.evaluate("window.dispatchEvent(new Event('alpha-back'))");
    until(AppNavigation.selected("Home"));
   }
  } finally {
   shell("svc wifi enable"); shell("svc data enable");
   if (savedCloud != null) store.writeCredentialSlot("cloud:production", savedCloud);
   // Restore the previous connection choice, including "none saved".
   try (BoundedActivityScenario<MainActivity> restore = BoundedActivityScenario.launch(MainActivity.class)) {
    until("document.querySelector('[data-screen]')");
    WebViewTestDriver.evaluate(savedSelection != null && !"null".equals(savedSelection)
     ? "localStorage.setItem('" + SELECTION + "'," + savedSelection + ")"
     : "localStorage.removeItem('" + SELECTION + "')");
   }
  }
 }
}
