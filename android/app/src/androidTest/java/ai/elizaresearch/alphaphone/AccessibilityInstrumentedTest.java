package ai.elizaresearch.alphaphone;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.matcher.ViewMatchers.isRoot;
import static org.junit.Assert.*;

import android.graphics.Rect;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import androidx.test.espresso.accessibility.AccessibilityChecks;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Home, the notification shade, Settings and the composer at 200% system font scale:
 * Accessibility Test Framework checks on the native view hierarchy (Espresso) and a
 * UiAutomator check that every actionable node TalkBack reaches has a label, is not
 * clipped off-screen and appears in reading order. Emulator evidence only.
 */
@RunWith(AndroidJUnit4.class)
public final class AccessibilityInstrumentedTest {
 private static String shell(String command)throws Exception{
  try(InputStream in=new ParcelFileDescriptor.AutoCloseInputStream(InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command))){return new String(in.readAllBytes(),StandardCharsets.UTF_8).trim();}
 }
 private static String js(String code)throws Exception{return WebViewTestDriver.evaluate(code);}
 private static void until(String code)throws Exception{for(int i=0;i<200;i++){if("true".equals(js("Boolean("+code+")")))return;SystemClock.sleep(100);}fail("Accessibility flow condition: "+code);}
 private static void open(String view)throws Exception{js(AppNavigation.request(view));until(AppNavigation.selected(view));}

 /** Actionable or labelled leaf nodes in accessibility-tree (TalkBack linear) order. */
 private static void collect(UiObject2 node,List<UiObject2> out){
  List<UiObject2> children=node.getChildren();
  boolean actionable=node.isClickable()||node.isCheckable()||node.isLongClickable();
  String label=(node.getText()==null?"":node.getText())+(node.getContentDescription()==null?"":node.getContentDescription());
  if(actionable||(children.isEmpty()&&!label.trim().isEmpty()))out.add(node);
  for(UiObject2 child:children)collect(child,out);
 }
 private static void talkBackOrder(UiDevice device,String surface){
  device.waitForIdle(2000);
  UiObject2 root=device.findObject(By.pkg(BuildConfig.APPLICATION_ID).depth(0));
  assertNotNull(surface+": app window has an accessibility tree",root);
  List<UiObject2> nodes=new ArrayList<>();collect(root,nodes);
  int width=device.getDisplayWidth();
  List<String> problems=new ArrayList<>();
  UiObject2 previous=null;
  int actionable=0;
  for(UiObject2 node:nodes){
   Rect r=node.getVisibleBounds();
   if(r.isEmpty())continue;
   String label=((node.getText()==null?"":node.getText())+" "+(node.getContentDescription()==null?"":node.getContentDescription())).trim();
   if(node.isClickable()){actionable++;if(label.isEmpty()&&node.getChildren().stream().noneMatch(c->c.getText()!=null&&!c.getText().trim().isEmpty()))problems.add("unlabelled control at "+r.toShortString());}
   if(r.left<0||r.right>width)problems.add("clipped '"+label+"' at "+r.toShortString());
   if(previous!=null){
    Rect p=previous.getVisibleBounds();
    // The next node may start a new column to the right, otherwise it must not read upward.
    if(r.top<p.top-Math.max(p.height(),r.height())/2&&r.left<p.right)problems.add("reading order goes up from '"+previous.getText()+"' to '"+label+"'");
   }
   previous=node;
  }
  assertTrue(surface+": TalkBack reaches actionable controls",actionable>0);
  assertTrue(surface+" at 200% font: "+problems,problems.isEmpty());
 }

 @Test public void homeShadeSettingsAndComposerAtDoubleFontScale()throws Exception{
  String previous=shell("settings get system font_scale");
  UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
  try{
   shell("settings put system font_scale 2.0");
   try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
    AppNavigation.liveMode();
    // Throws on any ATF error-level result for the native hierarchy (WebView host, system bars).
    AccessibilityChecks.enable().setRunChecksFromRootView(true);
    open("Home");onView(isRoot()).check(AccessibilityChecks.accessibilityAssertion());talkBackOrder(device,"Home");
    // The notification shade opens with a downward swipe from the top of the phone screen.
    Rect web=device.findObject(By.clazz("android.webkit.WebView")).getVisibleBounds();
    device.swipe(web.centerX(),web.top+web.height()/40,web.centerX(),web.top+web.height()/2,20);
    until("document.querySelector('[data-alpha-layer=\"shade\"]')?.getAttribute('aria-hidden')!=='true'");
    talkBackOrder(device,"Notification shade");
    device.pressBack();until("document.querySelector('[data-alpha-layer=\"shade\"]')?.getAttribute('aria-hidden')==='true'");
    open("Settings");onView(isRoot()).check(AccessibilityChecks.accessibilityAssertion());talkBackOrder(device,"Settings");
    open("Home");js(AppNavigation.type());until(AppNavigation.composer());talkBackOrder(device,"Composer");
   }
  }finally{
   shell("settings put system font_scale "+(previous.isEmpty()||"null".equals(previous)?"1.0":previous));
  }
 }
}
