package ai.elizaresearch.alphaphone;

import android.app.UiAutomation;
import android.content.Context;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Emulator check: signed out with the network off, Welcome requires Eliza Cloud sign-in, offers no
 * agent-less "local apps without AI" choice, and the on-device agent is running anyway, without
 * hosted inference (owner directive 2026-10-13: the agent always runs on the device). The saved Cloud
 * credential and connection selection are restored afterwards. This does not prove a full AOSP image
 * or a physical device. */
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
 @Test public void signedOutOfflineRunsTheAgentBehindSignIn() throws Exception {
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
   until("performance.timeOrigin!==" + previous + "&&[...document.querySelectorAll('.alpha-connection button')].some(b=>b.textContent==='Sign in with Eliza Cloud')");
   assertEquals("No agent-less choice is offered", "false", WebViewTestDriver.evaluate("[...document.querySelectorAll('button')].some(b=>/without AI/.test(b.textContent))"));
   // The agent starts behind the sign-in dialog: the resident selection is saved once it is connected.
   until("localStorage.getItem('" + SELECTION + "')===JSON.stringify({kind:'resident'})");
   JSONObject state = ElizaAgentService.getLocalAgentBootState(context);
   assertEquals("On-device agent is listening", "listening", state.optString("state"));
   assertTrue("Agent service is active", state.optBoolean("serviceActive", false));
   // No hosted inference is bound without a plan.
   assertNull("No provider is stored while signed out", store.readCredentialSlot("local-agent-provider:v1"));
   // The sign-in dialog cannot be dismissed with Back.
   WebViewTestDriver.evaluate("window.dispatchEvent(new Event('alpha-back'))");
   SystemClock.sleep(300);
   assertEquals("Sign-in stays required", "true", WebViewTestDriver.evaluate("Boolean(document.querySelector('.alpha-connection-scrim'))"));
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
