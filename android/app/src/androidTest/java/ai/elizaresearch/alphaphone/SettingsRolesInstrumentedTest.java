package ai.elizaresearch.alphaphone;

import android.Manifest;
import android.app.UiAutomation;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.List;
import org.json.JSONObject;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/**
 * Settings role and permission state against Android's own answer: the HOME request is declined
 * and then accepted in the real role dialog, and each result is compared with
 * `cmd role get-role-holders`; the Calendar row is compared with the runtime grant.
 */
@RunWith(AndroidJUnit4.class)
public final class SettingsRolesInstrumentedTest {
 private static final String HOME="android.app.role.HOME";
 private final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
 private UiAutomation ui(){return InstrumentationRegistry.getInstrumentation().getUiAutomation();}
 private String shell(String command)throws Exception{
  try(var fd=ui().executeShellCommand(command);var in=new java.io.FileInputStream(fd.getFileDescriptor())){return new String(in.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8).trim();}
 }
 private String js(String code)throws Exception{return WebViewTestDriver.evaluate(code);}
 private void until(String code)throws Exception{for(int i=0;i<200;i++){if("true".equals(js("Boolean("+code+")")))return;SystemClock.sleep(100);}fail("Settings condition: "+code);}
 private String text(String value){return "document.body.textContent.includes("+JSONObject.quote(value)+")";}
 private void button(String label)throws Exception{String q="[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith("+JSONObject.quote(label)+"))";until(q);js("("+q+").click()");}
 private void settings()throws Exception{js(AppNavigation.request("Home"));until(AppNavigation.selected("Home"));js(AppNavigation.request("Settings"));until(AppNavigation.selected("Settings"));}
 private boolean holdsHome()throws Exception{return shell("cmd role get-role-holders --user 0 "+HOME).contains(context.getPackageName());}
 private AccessibilityNodeInfo dialogNode(String... labels){
  for(int i=0;i<100;i++){
   AccessibilityNodeInfo root=ui().getRootInActiveWindow();
   if(root!=null&&!context.getPackageName().contentEquals(root.getPackageName()))for(String label:labels){List<AccessibilityNodeInfo> found=root.findAccessibilityNodeInfosByText(label);if(!found.isEmpty())return found.get(0);}
   SystemClock.sleep(100);
  }
  return null;
 }
 private void back(){long t=SystemClock.uptimeMillis();for(int action:new int[]{KeyEvent.ACTION_DOWN,KeyEvent.ACTION_UP})ui().injectInputEvent(new KeyEvent(t,SystemClock.uptimeMillis(),action,KeyEvent.KEYCODE_BACK,0),true);}
 private static boolean click(AccessibilityNodeInfo node){for(AccessibilityNodeInfo n=node;n!=null;n=n.getParent())if(n.isClickable())return n.performAction(AccessibilityNodeInfo.ACTION_CLICK);return false;}

 @Test public void homeRequestDeclineAndAcceptMatchRoleHolders()throws Exception{
  Assume.assumeTrue("Only the launcher variant declares HOME",BuildConfig.IS_LAUNCHER);
  String previous=shell("cmd role get-role-holders --user 0 "+HOME);
  shell("cmd role remove-role-holder --user 0 "+HOME+" "+context.getPackageName());
  assertFalse("Fixture starts without the HOME role",holdsHome());
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();settings();
   until(text("Home app"));until(text("Make Alpha your Home app"));
   // Decline in Android's own dialog: nothing changes, and Settings says so after reading back.
   button("Make Alpha your Home app");
   assertNotNull("Android role dialog shown",dialogNode("Alpha Phone","Cancel"));
   back();
   until(text("Home app not changed"));
   assertFalse("Declined request holds no role",holdsHome());
   assertEquals("Settings offers the request again","true",js("Boolean("+"[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith('Make Alpha your Home app'))"+")"));
   // Accept: choose Alpha, then confirm when the dialog asks.
   button("Make Alpha your Home app");
   AccessibilityNodeInfo alpha=dialogNode("Alpha Phone");assertNotNull("Alpha listed as a Home app",alpha);assertTrue(click(alpha));
   AccessibilityNodeInfo confirm=dialogNode("Set as default","SET AS DEFAULT");if(confirm!=null)click(confirm);
   until(text("Alpha Phone is your Home app"));
   assertTrue("Android reports Alpha as HOME holder",holdsHome());
   assertEquals("The request is no longer offered","false",js("Boolean([...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith('Make Alpha your Home app')))"));
  }finally{
   for(String holder:previous.split("\\s+"))if(!holder.isEmpty())shell("cmd role add-role-holder --user 0 "+HOME+" "+holder);
   if(!previous.contains(context.getPackageName()))shell("cmd role remove-role-holder --user 0 "+HOME+" "+context.getPackageName());
  }
 }

 /**
  * `pm revoke` kills the app process, and with it this instrumentation, so the runner sets the
  * grant between runs and passes the expected state (settingsCalendar=granted|revoked).
  */
 @Test public void calendarRowMatchesRuntimeGrant()throws Exception{
  String expected=InstrumentationRegistry.getArguments().getString("settingsCalendar");
  Assume.assumeTrue("Permission-changing runner required","granted".equals(expected)||"revoked".equals(expected));
  boolean granted=context.checkSelfPermission(Manifest.permission.READ_CALENDAR)==PackageManager.PERMISSION_GRANTED;
  assertEquals("Runner applied the requested grant","granted".equals(expected),granted);
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();settings();button("Privacy & data");
   String row="[...document.querySelectorAll('[aria-label],*')].some(e=>e.childElementCount<4&&e.textContent.includes('Calendar')&&e.textContent.includes("+JSONObject.quote(granted?"Allowed for Alpha":"Not allowed")+"))";
   until(row);
   assertEquals("Contacts is not presented","false",js("[...document.querySelectorAll('button,div')].some(e=>e.childElementCount===0&&e.textContent.trim()==='Contacts')"));
  }
 }
}
