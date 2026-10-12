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
 * Home, the notification shade, Settings and the composer at 200% system font scale, the page's
 * own measure of that text size, Home text overlap, and the gesture zones of Alpha's notifications:
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
  // The WebView publishes a layer's accessibility nodes shortly after the layer appears; read the
  // tree again until it holds a clickable control (five seconds at most). The checks below are unchanged.
  UiObject2 root=null;List<UiObject2> nodes=new ArrayList<>();
  for(int attempt=0;attempt<25;attempt++){
   root=device.findObject(By.pkg(BuildConfig.APPLICATION_ID).depth(0));nodes=new ArrayList<>();
   if(root!=null){try{collect(root,nodes);}catch(androidx.test.uiautomator.StaleObjectException changing){nodes.clear();}}
   boolean clickable=false;try{for(UiObject2 node:nodes)if(node.isClickable()&&!node.getVisibleBounds().isEmpty())clickable=true;}catch(androidx.test.uiautomator.StaleObjectException changing){clickable=false;}
   if(clickable)break;
   SystemClock.sleep(200);
  }
  assertNotNull(surface+": app window has an accessibility tree",root);
  int width=device.getDisplayWidth();
  List<String> problems=new ArrayList<>();
  UiObject2 previous=null;
  int actionable=0;
  for(UiObject2 node:nodes){
   Rect r=node.getVisibleBounds();
   if(r.isEmpty())continue;
   String label=((node.getText()==null?"":node.getText())+" "+(node.getContentDescription()==null?"":node.getContentDescription())).trim();
   // An empty text field has no text; Android carries its accessible name (aria-label/placeholder) as the hint, which TalkBack reads.
   if(label.isEmpty()&&"android.widget.EditText".equals(node.getClassName())&&node.getHint()!=null)label=node.getHint().trim();
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

 /** The first node visible to the user whose text or content description is exactly the name. */
 private static android.view.accessibility.AccessibilityNodeInfo named(android.view.accessibility.AccessibilityNodeInfo node,String name,int depth){
  if(node==null||depth>60)return null;
  if(node.isVisibleToUser()&&(name.contentEquals(node.getText()==null?"":node.getText())||name.contentEquals(node.getContentDescription()==null?"":node.getContentDescription())))return node;
  for(int i=0;i<node.getChildCount();i++){android.view.accessibility.AccessibilityNodeInfo found=named(node.getChild(i),name,depth+1);if(found!=null)return found;}
  return null;
 }

 private static final String SHADE_CLOSED="document.querySelector('[data-alpha-layer=\"shade\"]')?.getAttribute('aria-hidden')==='true'";
 private static final String SHADE_OPEN="document.querySelector('[data-alpha-layer=\"shade\"]')?.getAttribute('aria-hidden')!=='true'";
 /** evaluateJavascript returns a JSON value; this unwraps a JSON string result. */
 private static String unquote(String json)throws Exception{return (String)new org.json.JSONTokener(json).nextValue();}
 /**
  * Pairs of Home text runs whose painted boxes overlap, as a JSON array (empty when none). Each
  * line box is cut by its clipping ancestors and reduced to its middle 70% in height, because line
  * boxes of adjacent lines overlap by design where the line height is below the font's content area.
  */
 private static final String HOME_TEXT_OVERLAP="(()=>{const root=document.querySelector('[data-alpha-layer=\"home\"]'),runs=[];"
  +"const clip=(b,el)=>{const r={l:b.left,r:b.right,t:b.top,b:b.bottom};for(let n=el;n&&n!==document.documentElement;n=n.parentElement){const s=getComputedStyle(n);if(s.overflowX==='visible'&&s.overflowY==='visible')continue;const f=n.getBoundingClientRect();if(s.overflowX!=='visible'){r.l=Math.max(r.l,f.left);r.r=Math.min(r.r,f.right);}if(s.overflowY!=='visible'){r.t=Math.max(r.t,f.top);r.b=Math.min(r.b,f.bottom);}}return r.r-r.l>1&&r.b-r.t>1?r:null;};"
  +"const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);for(let n=w.nextNode();n;n=w.nextNode()){const el=n.parentElement,text=(n.nodeValue||'').trim();if(!text||!el.getClientRects().length||getComputedStyle(el).visibility!=='visible'||el.closest('[aria-hidden=\"true\"]'))continue;"
  +"const range=document.createRange();range.selectNodeContents(n);for(const b of range.getClientRects()){if(b.width<=1||b.height<=1)continue;const trim=b.height*.15,box=clip({left:b.left,right:b.right,top:b.top+trim,bottom:b.bottom-trim},el);if(box)runs.push({el,text:text.slice(0,24),box});}}"
  +"const bad=[];for(let i=0;i<runs.length;i++)for(let j=i+1;j<runs.length;j++){const a=runs[i],b=runs[j];if(a.el===b.el)continue;if(Math.min(a.box.r,b.box.r)-Math.max(a.box.l,b.box.l)>2&&Math.min(a.box.b,b.box.b)-Math.max(a.box.t,b.box.t)>2)bad.push(a.text+' / '+b.text);}"
  +"return JSON.stringify([...new Set(bad)]);})()";
 /** One-word Home app labels drawn on more than one line, as a JSON array (empty when none). */
 private static final String HOME_LABELS_SPLIT="(()=>{const bad=[];for(const button of document.querySelectorAll('[data-alpha-home-apps] > button')){const label=button.lastElementChild,text=(label.textContent||'').trim();if(!text||/\\s/.test(text))continue;"
  +"const range=document.createRange();range.selectNodeContents(label);const tops=new Set([...range.getClientRects()].filter(b=>b.width>1).map(b=>Math.round(b.top)));if(tops.size>1)bad.push(text);}return JSON.stringify(bad);})()";

 @Test public void homeShadeSettingsAndComposerAtDoubleFontScale()throws Exception{
  String previous=shell("settings get system font_scale");
  UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
  try{
   shell("settings put system font_scale 2.0");
   try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
    AppNavigation.liveMode();
    // Throws on any ATF error-level result for the native hierarchy (WebView host, system bars).
    AccessibilityChecks.enable().setRunChecksFromRootView(true);
    open("Home");AppNavigation.declineStartupAccess();onView(isRoot()).check(AccessibilityChecks.accessibilityAssertion());talkBackOrder(device,"Home");
    // Large text reaches the page as WebView text zoom. The page measures it (runtime/text-scale.ts)
    // and its layout rules read the result; a value near 1 here would mean those rules never engage.
    until("Number(getComputedStyle(document.documentElement).getPropertyValue('--alpha-text-scale'))>0");
    double measured=Double.parseDouble(js("Number(getComputedStyle(document.documentElement).getPropertyValue('--alpha-text-scale'))"));
    assertTrue("The page measures the 200% text it is drawn at (measured "+measured+")",Math.abs(measured-2.0)<0.2);
    // Round 7 saw the Home card title printed over the lines around it and app labels split
    // mid-word at this size. Measured from the painted line boxes inside the WebView.
    assertEquals("Home text printed over other text at 200% font","[]",unquote(js(HOME_TEXT_OVERLAP)));
    assertEquals("Home app labels split mid-word at 200% font","[]",unquote(js(HOME_LABELS_SPLIT)));

    // Gesture zones (docs/gesture-zones.md). The top edge is Android's; Alpha's notifications open
    // only from the handle on Home.
    Rect web=device.findObject(By.clazz("android.webkit.WebView")).getVisibleBounds();
    float css=web.width()/Float.parseFloat(js("window.innerWidth"));
    org.json.JSONObject handle=new org.json.JSONObject(unquote(js("(()=>{const b=document.querySelector('[data-alpha-shade-handle]').getBoundingClientRect();return JSON.stringify({x:b.left+b.width/2,y:b.top+b.height/2,top:b.top,left:b.left,width:b.width,height:b.height})})()")));
    assertTrue("The handle is a 44 by 44 CSS pixel target at least: "+handle,handle.getDouble("height")>=44&&handle.getDouble("width")>=44);
    int handleX=web.left+Math.round((float)handle.getDouble("x")*css),handleY=web.top+Math.round((float)handle.getDouble("y")*css);
    // 1. A swipe from the very top edge belongs to Android (it opens Android's own shade in both
    // flavors). Alpha's panel must stay closed. Android's shade is then collapsed again.
    device.swipe(web.centerX(),2,web.centerX(),web.top+web.height()/2,20);
    SystemClock.sleep(800);
    assertEquals("A top-edge swipe does not open Alpha's notifications","true",js(SHADE_CLOSED));
    shell("cmd statusbar collapse");
    assertTrue("Alpha is in front again after Android's shade closes",device.wait(androidx.test.uiautomator.Until.hasObject(By.pkg(BuildConfig.APPLICATION_ID).depth(0)),5000));
    SystemClock.sleep(500);
    // 2. A swipe that starts beside the handle, below the status bar, opens nothing.
    device.swipe(web.left+Math.round(12*css),handleY,web.left+Math.round(12*css),web.top+web.height()/2,20);
    SystemClock.sleep(800);
    assertEquals("A swipe that starts beside the handle does not open Alpha's notifications","true",js(SHADE_CLOSED));
    // 3. TalkBack and Switch Access activate the handle with no touch. The node must offer the click
    // action and be clickable. On WebView 133 through UiAutomation, ACTION_CLICK is accepted but no
    // click reaches any page control (the same happened with the calendar card), while
    // ACTION_FOCUS does move page focus; the handle is a plain <button onClick>. So the step
    // activates it the way a keyboard or switch does: accessibility focus onto the node, then
    // DPAD_CENTER (ENTER as a fallback). A TalkBack double-tap stays a device runbook check.
    android.view.accessibility.AccessibilityNodeInfo node=null;
    for(int i=0;i<50&&node==null;i++){
     android.view.accessibility.AccessibilityNodeInfo root=InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow();
     // The tree is walked: WebView's node provider answers findAccessibilityNodeInfosByText with an
     // empty list for every query (measured on WebView 133, API 36), so that lookup cannot find a page control.
     if(root!=null)node=named(root,"Open notifications",0);
     if(node==null)SystemClock.sleep(100);
    }
    assertNotNull("The handle is exposed to accessibility services by its name",node);
    android.view.accessibility.AccessibilityNodeInfo target=node;while(target!=null&&!target.isClickable())target=target.getParent();
    assertNotNull("The handle is a clickable accessibility node",target);
    assertTrue("The handle node is clickable",target.isClickable());
    assertTrue("The handle node exposes ACTION_CLICK",target.getActionList().contains(android.view.accessibility.AccessibilityNodeInfo.AccessibilityAction.ACTION_CLICK));
    assertTrue("The accessibility focus action is accepted",target.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_FOCUS));
    until("document.activeElement===document.querySelector('[data-alpha-shade-handle]')");
    for(int key:new int[]{android.view.KeyEvent.KEYCODE_DPAD_CENTER,android.view.KeyEvent.KEYCODE_ENTER}){
     if("true".equals(js(SHADE_OPEN)))break;
     device.pressKeyCode(key);
     for(int i=0;i<30&&!"true".equals(js(SHADE_OPEN));i++)SystemClock.sleep(100);
    }
    until(SHADE_OPEN);
    talkBackOrder(device,"Notification shade");
    device.pressBack();until(SHADE_CLOSED);
    // 4. A pull down that starts on the handle opens the panel. On the launcher flavor the handle
    // sits below the status bar inset Android reports, outside the system's top-edge zone.
    device.swipe(handleX,handleY,handleX,handleY+web.height()/3,20);
    until(SHADE_OPEN);
    device.pressBack();until(SHADE_CLOSED);
    open("Settings");onView(isRoot()).check(AccessibilityChecks.accessibilityAssertion());talkBackOrder(device,"Settings");
    open("Home");js(AppNavigation.type());until(AppNavigation.composer());talkBackOrder(device,"Composer");
   }
  }finally{
   shell("settings put system font_scale "+(previous.isEmpty()||"null".equals(previous)?"1.0":previous));
  }
 }
}
