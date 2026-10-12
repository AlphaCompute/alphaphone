package ai.elizaresearch.alphaphone;

import android.app.ActivityManager;
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

 /** Starts (or resumes) the reset on a background thread. A second request while one runs is ignored. */
 static void start(Context input, Listener listener) {
  final Context context = input.getApplicationContext();
  synchronized (runLock) { if (running) return; running = true; inProcess = true; }
  Thread worker = new Thread(() -> {
   AlphaDataResetPlan.Outcome outcome = null; Exception failure = null;
   try { outcome = AlphaDataResetPlan.run(marker(context), new AndroidHost(context), null); }
   catch (Exception error) { failure = error; android.util.Log.w("AlphaDataReset", "Reset not finished: " + error.getClass().getSimpleName()); }
   finally { synchronized (runLock) { running = false; } }
   if (listener != null) listener.finished(outcome, failure);
  }, "alpha-data-reset");
  worker.start();
 }

 /** Process start: resume an interrupted reset, otherwise restore components a finished reset disabled. */
 static boolean resumeIfPending(Context context) {
  if (markerFile(context).exists()) { start(context, null); return true; }
  setGatedComponents(context, true);
  return false;
 }

 /**
  * Disabled components receive nothing: Android unbinds the listener and drops alarm broadcasts to
  * the reminder receiver. Component state survives Android's own data clear, so the next normal
  * start re-enables both.
  */
 static void setGatedComponents(Context context, boolean enabled) {
  PackageManager packages = context.getPackageManager();
  int state = enabled ? PackageManager.COMPONENT_ENABLED_STATE_DEFAULT : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
  for (Class<?> component : Arrays.asList(AlphaNotificationListener.class, ReminderReceiver.class)) {
   ComponentName name = new ComponentName(context, component);
   try {
    int current = packages.getComponentEnabledSetting(name);
    boolean change = enabled ? current == PackageManager.COMPONENT_ENABLED_STATE_DISABLED : current != state;
    if (change) packages.setComponentEnabledSetting(name, state, PackageManager.DONT_KILL_APP);
   }
   catch (RuntimeException unavailable) { if (!enabled) throw unavailable; }
  }
 }

 private static final class AndroidHost implements AlphaDataResetPlan.Host {
  private final Context context;
  AndroidHost(Context context) { this.context = context; }

  @Override public void stopAgent() throws Exception { AlphaLocalAgentPlugin.stopForReset(context); }

  @Override public void stopServices() {
   context.stopService(new Intent(context, AlphaNavigationService.class));
   setGatedComponents(context, false);
  }

  @Override public void cancelWork() throws Exception {
   WorkManager.getInstance(context).cancelAllWork().getResult().get(10, TimeUnit.SECONDS);
   JobScheduler jobs = context.getSystemService(JobScheduler.class);
   if (jobs != null) jobs.cancelAll();
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
   Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
   if (launch != null && launch.getComponent() != null) {
    try { context.startActivity(Intent.makeRestartActivityTask(launch.getComponent())); }
    catch (RuntimeException backgroundStartRefused) { /* The next open starts fresh. */ }
   }
   // No in-memory copy of erased state may outlive the reset.
   SystemClock.sleep(250);
   Runtime.getRuntime().exit(0);
  }
 }
}
