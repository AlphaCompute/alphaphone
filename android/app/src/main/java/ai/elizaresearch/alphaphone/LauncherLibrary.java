package ai.elizaresearch.alphaphone;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.pm.LauncherActivityInfo;
import android.content.pm.LauncherApps;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.os.Process;
import android.os.UserHandle;
import android.os.UserManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Alpha Home's installed-app library, one entry per launcher activity.
 *
 * <p>An entry is identified by package, activity class and Android user, never by its label. The
 * current user's entries come from the package manager under the manifest's MAIN/LAUNCHER
 * visibility; other profiles (work, private, clone) come from {@link LauncherApps}. Listing never
 * launches. A launch re-resolves the exact component at that moment, so an entry from an older
 * list that has since been removed, disabled or locked is refused with a reason instead of
 * opening something else. */
final class LauncherLibrary {
 private LauncherLibrary() {}

 static final String NOT_INSTALLED = "not-installed";
 static final String DISABLED = "disabled";
 static final String NO_LAUNCHER = "no-launcher";
 static final String PROFILE_LOCKED = "profile-locked";
 static final String PROFILE_UNAVAILABLE = "profile-unavailable";
 static final String FAILED = "failed";

 static final class Entry {
  final String packageName; final String activityName; final String label;
  /** Android user serial for another profile; null for the current user. */
  final String user;
  /** "work", "private", "clone" or "other" for another profile; null for the current user. */
  final String profile;
  final boolean locked;
  /** The ResolveInfo or LauncherActivityInfo this entry was read from; only used to draw its icon. */
  final Object source;
  Entry(String packageName, String activityName, String label, String user, String profile, boolean locked, Object source) {
   this.packageName = packageName; this.activityName = activityName; this.label = label; this.user = user; this.profile = profile; this.locked = locked; this.source = source;
  }
  /** This activity's own icon (badged for another profile), or null when Android cannot load one. */
  android.graphics.drawable.Drawable icon(PackageManager packages) {
   try {
    if (source instanceof LauncherActivityInfo) return ((LauncherActivityInfo) source).getBadgedIcon(0);
    if (source instanceof ResolveInfo) return ((ResolveInfo) source).loadIcon(packages);
   } catch (RuntimeException error) { return null; }
   return null;
  }
  String key() { return packageName + "/" + activityName + (user == null ? "" : "#" + user); }
 }

 /** A refused launch: `code` is stable for the renderer, the message is shown to the user. */
 static final class Refusal extends Exception {
  private static final long serialVersionUID = 1L;
  final String code;
  Refusal(String code, String message) { super(message); this.code = code; }
 }

 /** What a launch needs after resolution; `user` is null for the current user. */
 static final class Target {
  final ComponentName component; final UserHandle user;
  Target(ComponentName component, UserHandle user) { this.component = component; this.user = user; }
 }

 static Intent launcherQuery() { return new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER); }

 /** Exported, enabled launcher activities of enabled applications, never Alpha's own. */
 static boolean eligible(ActivityInfo activity, String self) {
  return activity != null && activity.exported && activity.enabled
   && activity.applicationInfo != null && activity.applicationInfo.enabled
   && activity.packageName != null && activity.name != null && !activity.name.isEmpty()
   && !activity.packageName.equals(self);
 }

 /** Current-user entries from resolved launcher activities, one per distinct component. */
 static List<Entry> describe(PackageManager packages, List<ResolveInfo> candidates, String self) {
  List<Entry> entries = new ArrayList<>();
  Set<String> seen = new HashSet<>();
  if (candidates == null) return entries;
  for (ResolveInfo item : candidates) {
   ActivityInfo activity = item == null ? null : item.activityInfo;
   if (!eligible(activity, self)) continue;
   CharSequence label = item.loadLabel(packages);
   Entry entry = new Entry(activity.packageName, activity.name, text(label, activity.packageName), null, null, false, item);
   if (seen.add(entry.key())) entries.add(entry);
  }
  return entries;
 }

 static String text(CharSequence label, String fallback) {
  String value = label == null ? "" : label.toString().trim();
  return value.isEmpty() ? fallback : value;
 }

 /** Every launcher entry visible to Alpha: the current user's, then each other profile's. */
 static List<Entry> list(Context context) {
  PackageManager packages = context.getPackageManager();
  String self = context.getPackageName();
  List<Entry> entries = describe(packages, packages.queryIntentActivities(launcherQuery(), 0), self);
  LauncherApps launcher = context.getSystemService(LauncherApps.class);
  UserManager users = context.getSystemService(UserManager.class);
  if (launcher == null || users == null) return entries;
  List<UserHandle> profiles;
  try { profiles = launcher.getProfiles(); } catch (RuntimeException error) { return entries; }
  Set<String> seen = new HashSet<>();
  for (UserHandle user : profiles) {
   if (user == null || user.equals(Process.myUserHandle())) continue;
   String serial = Long.toString(users.getSerialNumberForUser(user));
   String profile = profileKind(launcher, user);
   boolean locked = locked(users, user);
   List<LauncherActivityInfo> activities;
   // A profile Android will not describe to this app contributes nothing rather than failing the list.
   try { activities = launcher.getActivityList(null, user); } catch (RuntimeException error) { continue; }
   if (activities == null) continue;
   for (LauncherActivityInfo activity : activities) {
    ComponentName component = activity == null ? null : activity.getComponentName();
    if (component == null) continue;
    Entry entry = new Entry(component.getPackageName(), component.getClassName(), text(activity.getLabel(), component.getPackageName()), serial, profile, locked, activity);
    if (seen.add(entry.key())) entries.add(entry);
   }
  }
  return entries;
 }

 /** A profile in quiet mode ("work apps paused") or not yet unlocked cannot run its apps. */
 static boolean locked(UserManager users, UserHandle user) {
  try { return users.isQuietModeEnabled(user) || !users.isUserUnlocked(user); }
  catch (RuntimeException error) { return true; }
 }

 static String profileKind(LauncherApps launcher, UserHandle user) {
  if (Build.VERSION.SDK_INT >= 35) {
   try {
    android.content.pm.LauncherUserInfo info = launcher.getLauncherUserInfo(user);
    return info == null ? "other" : profileKind(info.getUserType());
   } catch (RuntimeException error) { return "other"; }
  }
  // Before Android 15 the profile type is not public; a managed (work) profile is the documented case.
  return "work";
 }
 static String profileKind(String userType) {
  if (UserManager.USER_TYPE_PROFILE_MANAGED.equals(userType)) return "work";
  if (UserManager.USER_TYPE_PROFILE_PRIVATE.equals(userType)) return "private";
  if (UserManager.USER_TYPE_PROFILE_CLONE.equals(userType)) return "clone";
  return "other";
 }

 /** The entry inside the current list that this request names, or null. */
 static Entry find(List<Entry> entries, String packageName, String activityName, String user) {
  for (Entry entry : entries) {
   if (entry.packageName.equals(packageName) && entry.activityName.equals(activityName) && java.util.Objects.equals(entry.user, user)) return entry;
  }
  return null;
 }

 /** Why the current user cannot open this package's launcher component right now. */
 static Refusal explain(PackageManager packages, String packageName) {
  ApplicationInfo application;
  try { application = packages.getApplicationInfo(packageName, 0); }
  catch (PackageManager.NameNotFoundException error) { return new Refusal(NOT_INSTALLED, "This app is no longer installed."); }
  if (!application.enabled) return new Refusal(DISABLED, "This app is disabled. Enable it in Android settings to open it.");
  return new Refusal(NO_LAUNCHER, "This app has no screen that can be opened from here.");
 }

 /** Resolves the exact component now. Never launches. */
 static Target resolve(Context context, String packageName, String activityName, String user) throws Refusal {
  String self = context.getPackageName();
  if (packageName == null || packageName.isEmpty() || packageName.equals(self) || activityName == null || activityName.isEmpty()) {
   throw new IllegalArgumentException("Choose an installed app");
  }
  PackageManager packages = context.getPackageManager();
  if (user == null) {
   List<Entry> current = describe(packages, packages.queryIntentActivities(launcherQuery().setPackage(packageName), 0), self);
   if (find(current, packageName, activityName, null) == null) throw explain(packages, packageName);
   return new Target(new ComponentName(packageName, activityName), null);
  }
  LauncherApps launcher = context.getSystemService(LauncherApps.class);
  UserManager users = context.getSystemService(UserManager.class);
  long serial;
  try { serial = Long.parseLong(user); } catch (NumberFormatException error) { throw new IllegalArgumentException("Choose an installed app"); }
  UserHandle handle = users == null ? null : users.getUserForSerialNumber(serial);
  if (launcher == null || handle == null || handle.equals(Process.myUserHandle()) || !launcher.getProfiles().contains(handle)) {
   throw new Refusal(PROFILE_UNAVAILABLE, "This profile is no longer on the phone.");
  }
  if (locked(users, handle)) throw new Refusal(PROFILE_LOCKED, lockedMessage(profileKind(launcher, handle)));
  ComponentName component = new ComponentName(packageName, activityName);
  List<LauncherActivityInfo> activities;
  try { activities = launcher.getActivityList(packageName, handle); } catch (RuntimeException error) { activities = Collections.emptyList(); }
  boolean present = false;
  if (activities != null) for (LauncherActivityInfo activity : activities) if (activity != null && component.equals(activity.getComponentName())) present = true;
  if (!present) throw new Refusal(NOT_INSTALLED, "This app is no longer available in that profile.");
  return new Target(component, handle);
 }

 static String lockedMessage(String profile) {
  if ("work".equals(profile)) return "Work apps are paused or locked. Turn on work apps in Android, then try again.";
  if ("private".equals(profile)) return "Private space is locked. Unlock it in Android, then try again.";
  return "This profile is paused or locked. Unlock it in Android, then try again.";
 }

 /** The explicit current-user launch intent for one resolved component. */
 static Intent launchIntent(ComponentName component) {
  return launcherQuery().setComponent(component).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
 }
}
