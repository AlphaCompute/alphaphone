package ai.elizaresearch.alphaphone;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.UserManager;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.Arrays;
import java.util.List;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** The installed-app library's identity and refusal rules against the device's own package
 * manager. Resolves only: nothing is launched, installed, removed or re-roled. A device with a
 * work profile, a paused profile and real add/remove is separate acceptance. */
@RunWith(AndroidJUnit4.class)
public class LauncherLibraryInstrumentedTest {
 private static Context context() { return InstrumentationRegistry.getInstrumentation().getTargetContext(); }
 private static ResolveInfo activity(String packageName, String name, String label, boolean exported, boolean enabled, boolean appEnabled) {
  ResolveInfo info = new ResolveInfo();
  info.activityInfo = new ActivityInfo();
  info.activityInfo.packageName = packageName; info.activityInfo.name = name; info.activityInfo.exported = exported; info.activityInfo.enabled = enabled;
  info.activityInfo.applicationInfo = new ApplicationInfo();
  info.activityInfo.applicationInfo.packageName = packageName; info.activityInfo.applicationInfo.enabled = appEnabled;
  info.nonLocalizedLabel = label;
  return info;
 }

 @Test public void entriesAreComponentsAndDisabledUnexportedOrOwnActivitiesAreNeverListed() {
  String self = context().getPackageName();
  List<ResolveInfo> candidates = Arrays.asList(
   activity("org.example.one", "org.example.one.Main", "Notes", true, true, true),
   activity("org.example.two", "org.example.two.Main", "Notes", true, true, true),
   activity("org.example.two", "org.example.two.Second", "Notes", true, true, true),
   activity("org.example.two", "org.example.two.Second", "Notes", true, true, true),
   activity("org.example.hidden", "org.example.hidden.Main", "Unexported", false, true, true),
   activity("org.example.off", "org.example.off.Main", "Disabled activity", true, false, true),
   activity("org.example.frozen", "org.example.frozen.Main", "Disabled app", true, true, false),
   activity(self, self + ".MainActivity", "Alpha", true, true, true),
   activity("org.example.blank", "org.example.blank.Main", "  ", true, true, true),
   null);
  List<LauncherLibrary.Entry> entries = LauncherLibrary.describe(context().getPackageManager(), candidates, self);
  String[] keys = new String[entries.size()];
  for (int i = 0; i < keys.length; i++) keys[i] = entries.get(i).key();
  assertArrayEquals("Same label stays three entries; ineligible and repeated components are dropped",
   new String[] {"org.example.one/org.example.one.Main", "org.example.two/org.example.two.Main", "org.example.two/org.example.two.Second", "org.example.blank/org.example.blank.Main"}, keys);
  assertEquals("A blank label falls back to the package name", "org.example.blank", entries.get(3).label);
  for (LauncherLibrary.Entry entry : entries) { assertNull(entry.user); assertNull(entry.profile); assertFalse(entry.locked); }
  assertNotNull(LauncherLibrary.find(entries, "org.example.two", "org.example.two.Second", null));
  assertNull("Another profile's entry is a different identity", LauncherLibrary.find(entries, "org.example.two", "org.example.two.Second", "10"));
  assertNull(LauncherLibrary.find(entries, "org.example.two", "org.example.two.Missing", null));
 }

 @Test public void aListedEntryResolvesToExactlyItsOwnComponent() throws Exception {
  List<LauncherLibrary.Entry> entries = LauncherLibrary.list(context());
  LauncherLibrary.Entry own = null;
  for (LauncherLibrary.Entry entry : entries) {
   assertNotEquals("Alpha never lists itself", context().getPackageName(), entry.packageName);
   if (own == null && entry.user == null) own = entry;
  }
  Assume.assumeTrue("This image has at least one other launchable app", own != null);
  LauncherLibrary.Target target = LauncherLibrary.resolve(context(), own.packageName, own.activityName, null);
  assertEquals(new ComponentName(own.packageName, own.activityName), target.component);
  assertNull(target.user);
  Intent intent = LauncherLibrary.launchIntent(target.component);
  assertEquals(Intent.ACTION_MAIN, intent.getAction());
  assertTrue(intent.hasCategory(Intent.CATEGORY_LAUNCHER));
  assertEquals("The launch is explicit, never resolved by label or by package default", target.component, intent.getComponent());
  assertTrue((intent.getFlags() & Intent.FLAG_ACTIVITY_NEW_TASK) != 0);
 }

 @Test public void staleOrUnknownEntriesAreRefusedWithAReason() throws Exception {
  try { LauncherLibrary.resolve(context(), "org.example.alpha.not.installed", "org.example.alpha.not.installed.Main", null); fail("A removed package must not resolve"); }
  catch (LauncherLibrary.Refusal refusal) { assertEquals(LauncherLibrary.NOT_INSTALLED, refusal.code); assertFalse(refusal.getMessage().isEmpty()); }

  LauncherLibrary.Entry own = null;
  for (LauncherLibrary.Entry entry : LauncherLibrary.list(context())) if (entry.user == null) { own = entry; break; }
  Assume.assumeTrue("This image has at least one other launchable app", own != null);
  try { LauncherLibrary.resolve(context(), own.packageName, own.activityName + "Gone", null); fail("A component that is no longer a launcher entry must not resolve"); }
  catch (LauncherLibrary.Refusal refusal) { assertEquals(LauncherLibrary.NO_LAUNCHER, refusal.code); }
  try { LauncherLibrary.resolve(context(), own.packageName, own.activityName, "999999999"); fail("An unknown profile must not resolve"); }
  catch (LauncherLibrary.Refusal refusal) { assertEquals(LauncherLibrary.PROFILE_UNAVAILABLE, refusal.code); }
  for (String[] bad : new String[][] {{null, "x.Main"}, {"", "x.Main"}, {context().getPackageName(), "x.Main"}, {own.packageName, null}, {own.packageName, ""}, {own.packageName, own.activityName, "not-a-number"}}) {
   try { LauncherLibrary.resolve(context(), bad[0], bad[1], bad.length > 2 ? bad[2] : null); fail("Malformed request must be rejected"); }
   catch (IllegalArgumentException expected) { assertEquals("Choose an installed app", expected.getMessage()); }
  }
 }

 @Test public void refusalReasonsNameTheProfileAndPackageState() {
  PackageManager packages = context().getPackageManager();
  assertEquals(LauncherLibrary.NOT_INSTALLED, LauncherLibrary.explain(packages, "org.example.alpha.not.installed").code);
  // Alpha is installed and enabled; asked about as a launch target it simply has no entry here.
  assertEquals(LauncherLibrary.NO_LAUNCHER, LauncherLibrary.explain(packages, context().getPackageName()).code);
  assertEquals("work", LauncherLibrary.profileKind(UserManager.USER_TYPE_PROFILE_MANAGED));
  assertEquals("private", LauncherLibrary.profileKind(UserManager.USER_TYPE_PROFILE_PRIVATE));
  assertEquals("clone", LauncherLibrary.profileKind(UserManager.USER_TYPE_PROFILE_CLONE));
  assertEquals("other", LauncherLibrary.profileKind((String) null));
  assertTrue(LauncherLibrary.lockedMessage("work").startsWith("Work apps are paused or locked"));
  assertTrue(LauncherLibrary.lockedMessage("private").startsWith("Private space is locked"));
  assertTrue(LauncherLibrary.lockedMessage("other").startsWith("This profile is paused or locked"));
 }
}
