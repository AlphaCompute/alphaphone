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
 private AccessibilityNodeInfo exactDialogNode(String label){
  for(int i=0;i<100;i++){
   AccessibilityNodeInfo root=ui().getRootInActiveWindow();
   if(root!=null&&!context.getPackageName().contentEquals(root.getPackageName()))for(AccessibilityNodeInfo node:root.findAccessibilityNodeInfosByText(label))if(node.getText()!=null&&label.equalsIgnoreCase(node.getText().toString().trim()))return node;
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
   // Decline with the dialog's own Cancel: on Android 16 this dialog ignores the Back key
   // (measured on the API 36 emulator), so Back is only the fallback for a dialog without the button.
   AccessibilityNodeInfo cancel=dialogNode("Cancel");
   if(cancel==null||!click(cancel))back();
   until(text("Home app not changed"));
   assertFalse("Declined request holds no role",holdsHome());
   assertEquals("Settings offers the request again","true",js("Boolean("+"[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith('Make Alpha your Home app'))"+")"));
   // Accept: choose Alpha, then confirm when the dialog asks.
   button("Make Alpha your Home app");
   // The dialog's title also contains the app name; the list row is the node whose text is exactly it.
   AccessibilityNodeInfo alpha=exactDialogNode("Alpha Phone");assertNotNull("Alpha listed as a Home app",alpha);assertTrue("Alpha's row is selectable",click(alpha));
   AccessibilityNodeInfo confirm=null;for(int i=0;i<50&&(confirm==null||!confirm.isEnabled());i++){confirm=exactDialogNode("Set as default");if(confirm==null||!confirm.isEnabled())SystemClock.sleep(100);}
   if(confirm!=null)assertTrue("Set as default is pressed",click(confirm));
   for(int i=0;i<200&&!holdsHome();i++)SystemClock.sleep(100);
   assertTrue("Android reports Alpha as HOME holder",holdsHome());
   // Becoming HOME makes Android start Alpha as the home activity. On the API 36 emulator that is a
   // new MainActivity in the home task, so the page that asked is no longer in front and its
   // "Last change" notice is not what the owner sees. Settings in the instance now in front must
   // name Alpha as the Home app, read back from Android.
   settings();
   until("[...document.querySelectorAll('[data-screen] *')].some(e=>e.childElementCount<4&&e.textContent.trim().startsWith('Home app')&&e.textContent.includes('Alpha Phone'))");
   assertEquals("The request is no longer offered","false",js("Boolean([...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith('Make Alpha your Home app')))"));
  }finally{
   for(String holder:previous.split("\\s+"))if(!holder.isEmpty())shell("cmd role add-role-holder --user 0 "+HOME+" "+holder);
   if(!previous.contains(context.getPackageName()))shell("cmd role remove-role-holder --user 0 "+HOME+" "+context.getPackageName());
  }
 }

 /**
  * `pm revoke` kills the app process, and with it this instrumentation, so a permission-changing
  * runner sets the grant between runs and passes the expected state (settingsCalendar=granted|revoked).
  * Without that argument the row is still compared with the current runtime grant, so the test
  * never skips; covering both states needs the two runs.
  */
 @Test public void calendarRowMatchesRuntimeGrant()throws Exception{
  String expected=InstrumentationRegistry.getArguments().getString("settingsCalendar");
  assertTrue("settingsCalendar must be granted or revoked when given",expected==null||"granted".equals(expected)||"revoked".equals(expected));
  boolean granted=context.checkSelfPermission(Manifest.permission.READ_CALENDAR)==PackageManager.PERMISSION_GRANTED;
  if(expected!=null)assertEquals("Runner applied the requested grant","granted".equals(expected),granted);
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();settings();button("Privacy & data");
   String row="[...document.querySelectorAll('[aria-label],*')].some(e=>e.childElementCount<4&&e.textContent.includes('Calendar')&&e.textContent.includes("+JSONObject.quote(granted?"Allowed for Alpha":"Not allowed")+"))";
   until(row);
   assertEquals("Contacts is not presented","false",js("[...document.querySelectorAll('button,div')].some(e=>e.childElementCount===0&&e.textContent.trim()==='Contacts')"));
  }
 }
}
