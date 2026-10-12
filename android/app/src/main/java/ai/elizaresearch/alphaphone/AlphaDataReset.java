package ai.elizaresearch.alphaphone;

import android.app.ActivityManager;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.webkit.CookieManager;
import android.webkit.WebStorage;
import androidx.work.WorkManager;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.security.KeyStore;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Android side of "Reset Alpha data" (P-25). Order and resume rules live in
 * {@link AlphaDataResetPlan}. Every effect here is scoped to this package: its own processes,
 * work, notices, Keystore aliases and private directories. Shared photos/files, other apps, the
 * remote Gmail/Cloud account and any subscription are never touched.
 */
final class AlphaDataReset {
 private AlphaDataReset() {}
 static final String MARKER = "alpha-data-reset.pending";
 /** Set as soon as a reset starts in this process and never cleared: the process always ends. */
 private static volatile boolean inProcess;
 private static final Object runLock = new Object();
 private static boolean running;
 private static final java.util.List<Listener> waiting = new java.util.ArrayList<>();

 interface Listener { void finished(AlphaDataResetPlan.Outcome outcome, Exception failure); }

 static File markerFile(Context context) { return new File(context.getNoBackupFilesDir(), MARKER); }

 static AlphaDataResetPlan.Marker marker(Context context) {
  final File file = markerFile(context);
  return new AlphaDataResetPlan.Marker() {
   @Override public boolean exists() { return file.exists(); }
   @Override public void write() throws IOException {
    if (file.exists()) return;
    File parent = file.getParentFile();
    if (parent != null && !parent.isDirectory() && !parent.mkdirs()) throw new IOException("No private directory");
    File temporary = new File(parent, MARKER + ".tmp");
    try (FileOutputStream out = new FileOutputStream(temporary)) { out.write(1); out.getFD().sync(); }
    if (!temporary.renameTo(file)) throw new IOException("Reset marker not committed");
   }
   @Override public void clear() throws IOException { if (file.exists() && !file.delete()) throw new IOException("Reset marker not removed"); }
  };
 }

 /** Alarms, workers, the notification listener and agent starts do nothing while this is true. */
 static boolean blocked(Context context) {
  return AlphaDataResetPlan.blocked(inProcess, marker(context.getApplicationContext()));
 }

 /**
  * Starts (or resumes) the reset on a background thread. A request while one runs does not start a
  * second run; its listener is told the outcome of the run already in progress.
  */
 static void start(Context input, Listener listener) {
  final Context context = input.getApplicationContext();
  synchronized (runLock) {
   if (listener != null) waiting.add(listener);
   if (running) return;
   running = true; inProcess = true;
  }
  Thread worker = new Thread(() -> {
   AlphaDataResetPlan.Outcome outcome = null; Exception failure = null;
   try { outcome = AlphaDataResetPlan.run(marker(context), new AndroidHost(context), null); }
   catch (Exception error) { failure = error; android.util.Log.w("AlphaDataReset", "Reset not finished: " + error.getClass().getSimpleName()); }
   java.util.List<Listener> notify;
   synchronized (runLock) {
    running = false;
    // Nothing was stopped or erased and no marker exists: this process is not resetting.
    if (failure instanceof AlphaDataResetPlan.NotStarted) inProcess = false;
    notify = new java.util.ArrayList<>(waiting); waiting.clear();
   }
   for (Listener each : notify) {
    try { each.finished(outcome, failure); } catch (RuntimeException ignored) { /* A closed screen gets no notice. */ }
   }
  }, "alpha-data-reset");
  worker.start();
 }

 /** Process start: resume an interrupted reset, otherwise restore components a finished reset disabled. */
 static boolean resumeIfPending(Context context) { return resumeIfPending(context, null); }

 static boolean resumeIfPending(Context context, Listener listener) {
  if (markerFile(context).exists()) { start(context, listener); return true; }
  setGatedComponents(context, true);
  setAgentService(context, true);
  return false;
 }

 /**
  * Components that could act on Alpha data without the app's own gates: the notification listener
  * and autofill service are bound by Android, and the reminder receiver gets alarms and system
  * broadcasts. Each also checks {@link #blocked} in code where Alpha owns the class.
  */
 static final java.util.List<String> GATED_COMPONENTS = java.util.Collections.unmodifiableList(Arrays.asList(
  "ai.elizaresearch.alphaphone.AlphaNotificationListener",
  "ai.elizaresearch.alphaphone.ReminderReceiver",
  "ai.eliza.plugins.passwords.ElizaPasswordAutofillService"));

 /**
  * Disabled components receive nothing: Android unbinds the listener and drops alarm broadcasts to
  * the reminder receiver. Component state survives Android's own data clear, so the next normal
  * start re-enables both.
  */
 static void setGatedComponents(Context context, boolean enabled) {
  for (String component : GATED_COMPONENTS) setComponent(context, component, enabled);
 }

 /** The agent service is disabled only after its shutdown is confirmed, so a sticky restart cannot bring it back. */
 static void setAgentService(Context context, boolean enabled) {
  setComponent(context, "ai.elizaresearch.alphaphone.ElizaAgentService", enabled);
 }

 private static void setComponent(Context context, String className, boolean enabled) {
  PackageManager packages = context.getPackageManager();
  int state = enabled ? PackageManager.COMPONENT_ENABLED_STATE_DEFAULT : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
  ComponentName name = new ComponentName(context.getPackageName(), className);
  try {
   int current = packages.getComponentEnabledSetting(name);
   boolean change = enabled ? current == PackageManager.COMPONENT_ENABLED_STATE_DISABLED : current != state;
   if (change) packages.setComponentEnabledSetting(name, state, PackageManager.DONT_KILL_APP);
  }
  catch (RuntimeException unavailable) { if (!enabled) throw unavailable; }
 }

 private static final class AndroidHost implements AlphaDataResetPlan.Host {
  private final Context context;
  AndroidHost(Context context) { this.context = context; }

  @Override public void stopAgent() throws Exception {
   AlphaLocalAgentPlugin.stopForReset(context);
   setAgentService(context, false);
  }

  @Override public void stopServices() {
   context.stopService(new Intent(context, AlphaNavigationService.class));
   setGatedComponents(context, false);
  }

  @Override public void cancelWork() throws Exception {
   WorkManager.getInstance(context).cancelAllWork().getResult().get(10, TimeUnit.SECONDS);
   JobScheduler jobs = context.getSystemService(JobScheduler.class);
   if (jobs != null) jobs.cancelAll();
   // Pending reminder alarms would otherwise fire into the receiver once it is re-enabled.
   if (android.os.Build.VERSION.SDK_INT >= 34) {
    AlarmManager alarms = context.getSystemService(AlarmManager.class);
    if (alarms == null) throw new IllegalStateException("Alarm cancellation unavailable");
    alarms.cancelAll();
   }
  }

  @Override public void cancelNotices() {
   NotificationManager notices = context.getSystemService(NotificationManager.class);
   if (notices != null) notices.cancelAll();
  }

  @Override public void deleteKeys() throws Exception {
   // The AndroidKeyStore lists only this app's own aliases (its UID), so this cannot reach another app.
   KeyStore store = KeyStore.getInstance("AndroidKeyStore");
   store.load(null);
   for (String alias : Collections.list(store.aliases())) store.deleteEntry(alias);
   KeyStore check = KeyStore.getInstance("AndroidKeyStore");
   check.load(null);
   if (check.aliases().hasMoreElements()) throw new IllegalStateException("Keystore aliases remain");
  }

  @Override public void clearWebStorage() throws Exception {
   CountDownLatch done = new CountDownLatch(1);
   new Handler(Looper.getMainLooper()).post(() -> {
    try {
     WebStorage.getInstance().deleteAllData();
     CookieManager cookies = CookieManager.getInstance();
     cookies.removeAllCookies(removed -> { cookies.flush(); done.countDown(); });
    } catch (RuntimeException unavailable) { done.countDown(); }
   });
   if (!done.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Web storage clear unconfirmed");
  }

  @Override public boolean clearByPlatform() {
   ActivityManager activities = context.getSystemService(ActivityManager.class);
   try { return activities != null && activities.clearApplicationUserData(); }
   catch (RuntimeException refused) { return false; }
  }

  @Override public void deletePrivateFiles() throws IOException {
   // The system-owned native library link stays; everything else in the private data directory goes.
   AlphaDataResetPlan.deleteChildren(context.getDataDir().toPath(), new HashSet<>(Arrays.asList("lib", "no_backup")));
   AlphaDataResetPlan.deleteChildren(context.getNoBackupFilesDir().toPath(), Collections.singleton(MARKER));
   // App-specific external directories only. Shared storage (photos, downloads, documents) is not touched.
   for (File directory : context.getExternalFilesDirs(null)) if (directory != null) AlphaDataResetPlan.deleteChildren(directory.toPath(), Collections.emptySet());
   for (File directory : context.getExternalCacheDirs()) if (directory != null) AlphaDataResetPlan.deleteChildren(directory.toPath(), Collections.emptySet());
  }

  @Override public void relaunch() {
   // A helper in its own process waits for this one to die before it opens first run, so the new
   // MainActivity can never be created inside this dying process.
   try {
    Intent helper = new Intent(context, AlphaResetRelaunchActivity.class)
     .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION)
     .putExtra(AlphaResetRelaunchActivity.EXTRA_PID, android.os.Process.myPid());
    context.startActivity(helper);
   } catch (RuntimeException backgroundStartRefused) { /* The next open starts fresh. */ }
   // No in-memory copy of erased state may outlive the reset.
   SystemClock.sleep(100);
   Runtime.getRuntime().exit(0);
  }
 }
}
