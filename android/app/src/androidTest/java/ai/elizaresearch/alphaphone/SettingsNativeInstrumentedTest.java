package ai.elizaresearch.alphaphone;
import android.Manifest;
import android.os.SystemClock;
import android.view.KeyEvent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public final class SettingsNativeInstrumentedTest {
 private String js(String code)throws Exception{return WebViewTestDriver.evaluate(code);}
 private void until(String code)throws Exception{for(int i=0;i<200;i++){if("true".equals(js("Boolean("+code+")")))return;SystemClock.sleep(100);}fail("Settings condition: "+code);}
 private void label(String text)throws Exception{String q="[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith("+JSONObject.quote(text)+"))";until(q);js("("+q+").click()");}
 private void settings()throws Exception{js(AppNavigation.request("Home"));until(AppNavigation.selected("Home"));js(AppNavigation.request("Settings"));until(AppNavigation.selected("Settings"));}
 private void accountsAndBack()throws Exception{
  settings();label("Accounts");label("Device accounts in Android");
  android.app.UiAutomation ui=InstrumentationRegistry.getInstrumentation().getUiAutomation();boolean found=false;
  for(int i=0;i<150;i++){android.view.accessibility.AccessibilityNodeInfo root=ui.getRootInActiveWindow();if(root!=null&&"com.android.settings".contentEquals(root.getPackageName())){found=true;break;}SystemClock.sleep(100);}assertTrue("Real Android Settings foreground",found);
  long t=SystemClock.uptimeMillis();for(int action:new int[]{KeyEvent.ACTION_DOWN,KeyEvent.ACTION_UP})assertTrue(ui.injectInputEvent(new KeyEvent(t,SystemClock.uptimeMillis(),action,KeyEvent.KEYCODE_BACK,0),true));
  found=false;String app=InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName();for(int i=0;i<150;i++){android.view.accessibility.AccessibilityNodeInfo root=ui.getRootInActiveWindow();if(root!=null&&app.contentEquals(root.getPackageName())){found=true;break;}SystemClock.sleep(100);}assertTrue("Back returns to actual Alpha window",found);
 }
 @Test public void accountsHandoffAndLocationAccuracyReadback()throws Exception{
  org.junit.Assume.assumeTrue("Permission-restoring runner required","1".equals(InstrumentationRegistry.getArguments().getString("settingsNative")));
  android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  assertEquals(android.content.pm.PackageManager.PERMISSION_GRANTED,context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION));assertEquals(android.content.pm.PackageManager.PERMISSION_DENIED,context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION));
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();settings();label("Privacy & data");until("document.body.textContent.includes('Approximate location allowed')");assertEquals("No false precise grant","false",js("document.body.textContent.includes('Precise location allowed')"));
   accountsAndBack();
   InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(context.getPackageName(),Manifest.permission.ACCESS_FINE_LOCATION);
   accountsAndBack();settings();label("Privacy & data");until("document.body.textContent.includes('Precise location allowed')");assertEquals("Old approximate value replaced","false",js("document.body.textContent.includes('Approximate location allowed')"));
  }
 }
}
