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

/**
 * Decision P-11 (owner, 2026-10-13): the resident agent is always present. Emulator check, flag-off
 * builds only: signed out with the network off and an older build's "local apps without AI"
 * selection stored, the app starts the resident instead of offering a no-agent mode. No Welcome
 * gate opens by itself, the stored selection becomes the resident, Home and Notes are reachable,
 * the agent state is shown (starting, running or recovering, never "no agent"), and a send
 * dispatches nothing while inference is unavailable. The saved Cloud credential and connection
 * selection are restored afterwards. Written evidence only until run; it does not prove a full
 * AOSP image, a physical device or that the resident answers.
 */
@RunWith(AndroidJUnit4.class)
public class ResidentAlwaysPresentInstrumentedTest {
 private static final String SELECTION = "alpha.connection.selection.v1";
 private static void until(String expression, long timeoutMs) throws Exception {
  long deadline = SystemClock.elapsedRealtime() + timeoutMs;
  while (SystemClock.elapsedRealtime() < deadline) {
   if ("true".equals(WebViewTestDriver.evaluate("Boolean(" + expression + ")"))) return;
   SystemClock.sleep(80);
  }
  fail("Renderer did not reach expected state: " + expression);
 }
 private static void until(String expression) throws Exception { until(expression, 20000); }
 private static void shell(String command) throws Exception {
  UiAutomation ui = InstrumentationRegistry.getInstrumentation().getUiAutomation();
  try (ParcelFileDescriptor.AutoCloseInputStream input = new ParcelFileDescriptor.AutoCloseInputStream(ui.executeShellCommand(command))) { input.readAllBytes(); }
 }
 @Test public void signedOutOfflineStartsTheResidentAndSendsNothing() throws Exception {
  Assume.assumeTrue("Product behavior only; test-mocks builds keep the development chooser", !BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS);
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
   // An older build's "Use local apps without AI" choice.
   WebViewTestDriver.navigateHostDocument("localStorage.setItem('" + SELECTION + "',JSON.stringify({kind:'offline',localApps:true}));location.replace(location.origin+location.pathname)", true);
   until("performance.timeOrigin!==" + previous + "&&document.querySelector('[data-screen]')");
   AppNavigation.declineStartupAccess();
   // No sign-in gate opens by itself, and no no-agent choice exists anywhere.
   assertEquals("No connection dialog opens at start", "false", WebViewTestDriver.evaluate("!!document.querySelector('.alpha-connection-scrim')"));
   assertEquals("The stored choice reads as the resident", "true", WebViewTestDriver.evaluate("localStorage.getItem('" + SELECTION + "')===JSON.stringify({kind:'resident'})"));
   assertEquals("No retired no-agent copy", "false", WebViewTestDriver.evaluate("['without AI','Continue offline','Connect an agent'].some(t=>document.body.innerText.includes(t))"));
   for (String view : new String[]{"Notes", "Calendar"}) {
    WebViewTestDriver.evaluate(AppNavigation.request(view));
    until(AppNavigation.selected(view));
    WebViewTestDriver.evaluate("window.dispatchEvent(new Event('alpha-back'))");
    until(AppNavigation.selected("Home"));
   }
   // Settings › Agent connection shows the resident's state: Starting, Running on this device, or Not running with Retry.
   WebViewTestDriver.evaluate(AppNavigation.request("Settings"));
   until(AppNavigation.selected("Settings"));
   until("!!document.querySelector('button[aria-label=\"Agent connection\"]')");
   WebViewTestDriver.evaluate("document.querySelector('button[aria-label=\"Agent connection\"]').click()");
   until("document.querySelector('#connection-title')?.textContent==='Your agent'", 120000);
   until("['Starting…','Running on this device','Not running'].some(t=>document.querySelector('.alpha-connection [role=status] strong')?.textContent===t)", 120000);
   assertEquals("AI is off until sign-in", "true", WebViewTestDriver.evaluate("document.querySelector('.alpha-connection').innerText.includes('Sign in with Eliza Cloud')"));
   WebViewTestDriver.evaluate(AppNavigation.closeConnection());
   until("!document.querySelector('.alpha-connection-scrim')");
  } finally {
   shell("svc wifi enable"); shell("svc data enable");
   if (savedCloud != null) store.writeCredentialSlot("cloud:production", savedCloud);
   try (BoundedActivityScenario<MainActivity> restore = BoundedActivityScenario.launch(MainActivity.class)) {
    until("document.querySelector('[data-screen]')");
    WebViewTestDriver.evaluate(savedSelection != null && !"null".equals(savedSelection)
     ? "localStorage.setItem('" + SELECTION + "'," + savedSelection + ")"
     : "localStorage.removeItem('" + SELECTION + "')");
   }
  }
 }
}
