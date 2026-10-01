package ai.elizaresearch.alphaphone;

import android.app.role.RoleManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.SystemClock;
import androidx.lifecycle.Lifecycle;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Actual Android assist activity and task boundary; does not silently change the user's role. */
@RunWith(AndroidJUnit4.class)
public class AssistantInstrumentedTest {
 @Test public void assistantCandidateIsExportedAndHasSeparateTask() throws Exception {
  Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
  PackageManager packages = context.getPackageManager();
  Intent assist = new Intent(Intent.ACTION_ASSIST).setPackage(context.getPackageName());
  android.content.pm.ResolveInfo resolved = packages.resolveActivity(assist, PackageManager.MATCH_DEFAULT_ONLY);
  assertNotNull("ACTION_ASSIST resolves for user role selection", resolved);
  assertEquals(AlphaAssistActivity.class.getName(), resolved.activityInfo.name);
  assertTrue(resolved.activityInfo.exported);
  assertEquals(context.getPackageName() + ".assistant", resolved.activityInfo.taskAffinity);
  assertNotEquals(packages.getActivityInfo(new ComponentName(context, MainActivity.class), 0).taskAffinity, resolved.activityInfo.taskAffinity);
  assertTrue("Phone system offers the opt-in assistant role", context.getSystemService(RoleManager.class).isRoleAvailable(RoleManager.ROLE_ASSISTANT));
 }
 @Test public void explicitAssistDropsCallerContextAndCanFinish() throws Exception {
  Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
  Intent intent = new Intent(context, AlphaAssistActivity.class).setAction(Intent.ACTION_ASSIST)
   .setData(Uri.parse("https://example.com/private-context"))
   .putExtra(Intent.EXTRA_TEXT, "Never automatically forward caller content")
   .putExtra("query", "Never automatically execute caller instructions");
  try (BoundedActivityScenario<AlphaAssistActivity> scenario = BoundedActivityScenario.launch(intent)) {
   WebViewTestDriver.withActivity(AlphaAssistActivity.class, activity -> {
    assertNull(activity.getIntent().getExtras());
    assertNull(activity.getIntent().getData());
    assertTrue(activity.isAssistantSurface());
    assertNotNull(activity.getBridge());
    activity.finish();
   });
   for (int i = 0; i < 50 && scenario.getState() != Lifecycle.State.DESTROYED; i++) SystemClock.sleep(100);
   assertEquals("Assistant closes normally in both distribution variants", Lifecycle.State.DESTROYED, scenario.getState());
  }
 }
}
