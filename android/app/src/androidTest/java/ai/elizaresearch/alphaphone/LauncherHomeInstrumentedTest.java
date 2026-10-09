package ai.elizaresearch.alphaphone;

import android.app.UiAutomation;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.KeyCharacterMap;
import android.view.KeyEvent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONObject;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** The launcher APK as the device's HOME: Alpha Home's All-apps drawer lists installed apps, opens
 * Android Settings and the stock dialer through the user-visible controls, and Android's HOME key
 * returns to Alpha Home. Never changes the HOME role: it runs only where Alpha already holds it
 * (provisioning or the operator selected it). Emulator evidence, not device or user acceptance. */
@RunWith(AndroidJUnit4.class)
public class LauncherHomeInstrumentedTest {
 private static final Pattern TOP = Pattern.compile("(?:topResumedActivity|mResumedActivity)[=:][^\\n]*?\\s([A-Za-z0-9_.]+)/");

 private static void assumeAlphaIsHome() {
  Assume.assumeTrue("HOME qualification exists only in the launcher variant", BuildConfig.IS_LAUNCHER);
  Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
  ResolveInfo home = context.getPackageManager().resolveActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), PackageManager.MATCH_DEFAULT_ONLY);
  Assume.assumeTrue("Alpha must already be the selected HOME app; this test never changes roles",
   home != null && home.activityInfo != null && context.getPackageName().equals(home.activityInfo.packageName));
 }
 private static String eval(String js) throws Exception { return WebViewTestDriver.evaluate(js); }
 private static void until(String condition, String message) throws Exception {
  for (int i = 0; i < 300; i++) { if ("true".equals(eval("!!(" + condition + ")"))) return; SystemClock.sleep(100); }
  fail(message + ": " + eval("document.documentElement.dataset.activeView||null"));
 }
 private static String foreground() throws Exception {
  UiAutomation ui = InstrumentationRegistry.getInstrumentation().getUiAutomation();
  String dump;
  try (InputStream input = new ParcelFileDescriptor.AutoCloseInputStream(ui.executeShellCommand("dumpsys activity activities"))) { dump = new String(input.readAllBytes(), StandardCharsets.UTF_8); }
  Matcher match = TOP.matcher(dump);
  return match.find() ? match.group(1) : null;
 }
 private static void awaitForeground(String packageName, String message) throws Exception {
  String seen = null;
  for (int i = 0; i < 100; i++) { seen = foreground(); if (packageName.equals(seen)) return; SystemClock.sleep(150); }
  fail(message + " (foreground: " + seen + ")");
 }
 private static void pressHome() {
  UiAutomation ui = InstrumentationRegistry.getInstrumentation().getUiAutomation();
  long down = SystemClock.uptimeMillis();
  assertTrue("Android accepted HOME down", ui.injectInputEvent(new KeyEvent(down, down, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_HOME, 0, 0, KeyCharacterMap.VIRTUAL_KEYBOARD, 0, KeyEvent.FLAG_FROM_SYSTEM, InputDevice.SOURCE_KEYBOARD), true));
  assertTrue("Android accepted HOME up", ui.injectInputEvent(new KeyEvent(down, SystemClock.uptimeMillis(), KeyEvent.ACTION_UP, KeyEvent.KEYCODE_HOME, 0, 0, KeyCharacterMap.VIRTUAL_KEYBOARD, 0, KeyEvent.FLAG_FROM_SYSTEM, InputDevice.SOURCE_KEYBOARD), true));
 }
 private static String button(String label) { return "[...document.querySelectorAll('[data-screen] button')].find(b=>b.getAttribute('aria-label')===" + JSONObject.quote(label) + "&&b.getClientRects().length&&!b.disabled&&!b.closest('[inert]'))"; }
 private static void tap(String label) throws Exception { until(button(label), "Missing control " + label); eval("(" + button(label) + ").click()"); }
 private static final String DRAWER = "document.querySelector('[data-alpha-layer=\"drawer\"][role=\"dialog\"]')";
 private static void returnHome(Context context) throws Exception {
  pressHome();
  awaitForeground(context.getPackageName(), "HOME returns to Alpha");
  until("document.documentElement.dataset.activeView==='home'&&!" + DRAWER, "HOME lands on Alpha Home with the drawer closed");
 }

 @Test public void allAppsSearchLaunchesSettingsAndHomeReturnsToAlpha() throws Exception {
  assumeAlphaIsHome();
  Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
  Intent settingsLaunch = context.getPackageManager().getLaunchIntentForPackage("com.android.settings");
  Assume.assumeTrue("Android Settings has a launcher entry on this image", settingsLaunch != null);
  try (BoundedActivityScenario<MainActivity> scenario = BoundedActivityScenario.launch(MainActivity.class)) {
   AppNavigation.liveMode();
   eval(AppNavigation.request("Home"));
   until(AppNavigation.selected("Home") + "&&!document.querySelector('.os')?.inert", "Home ready");
   tap("All apps");
   until(DRAWER + "&&" + button("Open Settings"), "Installed apps listed, including Android Settings");
   assertFalse("Alpha never lists itself", "true".equals(eval("[...document.querySelectorAll('[data-alpha-layer=\"drawer\"] button')].some(b=>b.getAttribute('aria-label')==='Open Alpha Phone')")));
   assertEquals("Icons are rendered from the device", "true", eval("!!document.querySelector('[data-alpha-layer=\"drawer\"] img[src^=\"data:image/png;base64,\"]')"));
   eval("(()=>{const input=document.querySelector('[data-alpha-layer=\"drawer\"] input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Settings');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
   until(button("Open Settings") + "&&!" + button("Open Phone"), "Search narrows to Settings");
   tap("Open Settings");
   awaitForeground("com.android.settings", "Android Settings opens from the drawer");
   returnHome(context);
  }
 }

 @Test public void phoneShortcutOpensTheStockDialerWithinTwoTapsAndHomeReturns() throws Exception {
  assumeAlphaIsHome();
  Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
  ResolveInfo dialer = context.getPackageManager().resolveActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:")), PackageManager.MATCH_DEFAULT_ONLY);
  Assume.assumeTrue("A stock dialer handles ACTION_DIAL on this image", dialer != null && dialer.activityInfo != null && !"android".equals(dialer.activityInfo.packageName));
  String dialerPackage = dialer.activityInfo.packageName;
  try (BoundedActivityScenario<MainActivity> scenario = BoundedActivityScenario.launch(MainActivity.class)) {
   AppNavigation.liveMode();
   eval(AppNavigation.request("Home"));
   until(AppNavigation.selected("Home") + "&&!document.querySelector('.os')?.inert", "Home ready");
   // Tap 1: All apps. Tap 2: Phone (the resolved ACTION_DIAL handler, not Alpha's deferred Phone view).
   tap("All apps");
   String phone = "[...document.querySelectorAll('[data-alpha-layer=\"drawer\"] button')].find(b=>/^Open Phone/.test(b.getAttribute('aria-label')||'')&&!b.disabled)";
   until(phone, "The drawer offers the resolved Phone shortcut");
   eval("(" + phone + ").click()");
   awaitForeground(dialerPackage, "The stock dialer opens within two taps");
   returnHome(context);
  }
 }
}
