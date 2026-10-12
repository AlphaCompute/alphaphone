package ai.elizaresearch.alphaphone;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.SystemClock;
import java.io.File;

/**
 * Runs in its own process after "Reset Alpha data" deleted Alpha's files. It ends the main process,
 * waits until that process is gone, then opens Alpha so first run starts in a fresh process. It
 * reads and writes no Alpha data.
 */
public final class AlphaResetRelaunchActivity extends Activity {
 static final String EXTRA_PID = "ai.elizaresearch.alphaphone.extra.RESET_PID";

 @Override protected void onCreate(Bundle state) {
  super.onCreate(state);
  int pid = getIntent().getIntExtra(EXTRA_PID, -1);
  if (pid > 0 && pid != android.os.Process.myPid()) {
   android.os.Process.killProcess(pid);
   long deadline = SystemClock.elapsedRealtime() + 3000;
   while (new File("/proc/" + pid).exists() && SystemClock.elapsedRealtime() < deadline) SystemClock.sleep(25);
  }
  Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
  if (launch != null && launch.getComponent() != null) {
   try { startActivity(Intent.makeRestartActivityTask(launch.getComponent())); }
   catch (RuntimeException refused) { /* The next open starts fresh. */ }
  }
  finish();
  overridePendingTransition(0, 0);
  Runtime.getRuntime().exit(0);
 }
}
