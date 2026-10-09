package ai.elizaresearch.alphaphone;
import ai.eliza.plugins.reminders.ReminderLifecycleTestAccess;
import ai.eliza.plugins.reminders.ReminderTestAccess;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.NotificationManager;
import android.app.UiAutomation;
import android.content.Context;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.UUID;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** A due reminder on the high-importance channel appears as a heads-up in System UI. Emulator evidence only. */
@RunWith(AndroidJUnit4.class)
public class ReminderHeadsUpInstrumentedTest {
 private static boolean visible(UiAutomation automation,String title){
  for(AccessibilityWindowInfo window:automation.getWindows()){
   AccessibilityNodeInfo root=window.getRoot();if(root==null||root.getPackageName()==null||!"com.android.systemui".contentEquals(root.getPackageName()))continue;
   if(!root.findAccessibilityNodeInfosByText(title).isEmpty())return true;
  }
  return false;
 }
 @Test public void dueReminderIsShownHeadsUpWithoutOpeningTheShade()throws Exception{
  Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();
  UiAutomation automation=InstrumentationRegistry.getInstrumentation().getUiAutomation(UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES);
  automation.grantRuntimePermission(c.getPackageName(),android.Manifest.permission.POST_NOTIFICATIONS);
  ReminderTestAccess.channel(c);org.junit.Assume.assumeTrue("Notifications enabled",ReminderTestAccess.allowed(c));
  org.junit.Assume.assumeTrue("Heads-up requires no Do Not Disturb",c.getSystemService(NotificationManager.class).getCurrentInterruptionFilter()<=NotificationManager.INTERRUPTION_FILTER_ALL);
  AccessibilityServiceInfo info=automation.getServiceInfo();info.flags|=AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;automation.setServiceInfo(info);
  String id="headsup_"+UUID.randomUUID(),title="Heads-up fixture "+id.substring(8,16);
  try{
   ReminderTestAccess.schedule(c,id,title,"Disposable heads-up fixture",System.currentTimeMillis()+1000);SystemClock.sleep(1500);
   ReminderTestAccess.deliver(c,id,ReminderTestAccess.read(c,id).getString("occurrenceId"));
   assertEquals("posted",ReminderTestAccess.read(c,id).getString("status"));
   boolean shown=false;for(int i=0;i<50&&!shown;i++){shown=visible(automation,title);if(!shown)SystemClock.sleep(200);}
   assertTrue("Heads-up notification visible in System UI",shown);
   assertEquals(NotificationManager.IMPORTANCE_HIGH,c.getSystemService(NotificationManager.class).getNotificationChannel(ReminderLifecycleTestAccess.dueChannel()).getImportance());
  }finally{ReminderTestAccess.cancel(c,id);assertTrue(new ReminderTestAccess.Envelope(c).records().edit().remove(id).commit());}
 }
}
