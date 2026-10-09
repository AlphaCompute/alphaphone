package ai.elizaresearch.alphaphone;

import ai.eliza.plugins.passwords.PasswordVaultAccess;
import ai.eliza.plugins.securestore.nativeonly.PasswordVaultStore;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.KeyguardManager;
import android.app.UiAutomation;
import android.content.Context;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.webkit.ScriptHandler;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/**
 * Distribution-variant acceptance for the integrated password manager (decision P-05) in Alpha's
 * own browser. It selects the shared ElizaPasswordAutofillService as Android's Autofill service,
 * signs into a synthetic form on a real HTTPS page (example.com; the form is injected by the
 * instrumentation only, and its submit handler navigates without sending the fields anywhere),
 * accepts the framework Save offer and the provider's own Save prompt with a device-credential
 * unlock, then on a fresh load fills the same origin only after another unlock and an explicit
 * choice. A login form inside a cross-origin iframe (example.org) is focused and must receive no
 * offer. All values are synthetic. Cleanup deletes the saved entry when the vault is still unlocked
 * (the fill unlock leaves a short window); after an earlier failure it can remain, locked, until
 * removed in Settings.
 *
 * <p>Unlock needs a secure lock screen. On an emulator without one the test sets a synthetic PIN
 * and clears it afterwards (that invalidates any earlier auth-bound vault key on that emulator);
 * on any other device a secure lock screen and the instrumentation argument
 * {@code passwordFillPin} are required, otherwise the test is skipped as not runnable.
 */
@RunWith(AndroidJUnit4.class)
public final class PasswordBrowserFillInstrumentedTest {
 private static final String OFFER="Fill with a saved password";
 private final BrowserFlowInstrumentedTest browser=new BrowserFlowInstrumentedTest();
 private final String token=UUID.randomUUID().toString().replace("-","").substring(0,16);
 private final String username="alpha-fill-"+token;
 private final String password="Synthetic-"+token+"-pw";

 private String host(String js)throws Exception{return WebViewTestDriver.evaluate(js);}
 private void waitHost(String predicate)throws Exception{for(int i=0;i<200;i++){if("true".equals(host("Boolean("+predicate+")")))return;SystemClock.sleep(100);}fail("Host condition timed out: "+predicate.substring(0,Math.min(120,predicate.length())));}
 private void click(String label)throws Exception{
  String button="[...document.querySelectorAll('[data-screen] button')].find(e=>e.getAttribute('aria-label')==="+JSONObject.quote(label)+")";
  waitHost(button);host("("+button+").click()");
 }
 private void address(String value)throws Exception{
  if("false".equals(host("!!document.querySelector('input[aria-label=Address]')")))click("Edit address");
  waitHost("document.querySelector('input[aria-label=Address]')");
  host("(()=>{const e=document.querySelector('input[aria-label=Address]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,"+JSONObject.quote(value)+");e.dispatchEvent(new Event('input',{bubbles:true}));})()");
  waitHost("document.querySelector('input[aria-label=Address]').value==="+JSONObject.quote(value));
  host("document.querySelector('input[aria-label=Address]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
 }
 private void childReady(String predicate)throws Exception{for(int i=0;i<300;i++){if("true".equals(browser.child("Boolean("+predicate+")")))return;SystemClock.sleep(100);}fail("Child document condition timed out: "+predicate.substring(0,Math.min(120,predicate.length()))+"; "+browser.diagnostics());}
 private void page(String url)throws Exception{address(url);childReady("location.href==="+JSONObject.quote(url)+" && document.readyState==='complete' && typeof Capacitor==='undefined'");}

 // ---- Shell and accessibility across windows (framework save UI, provider sheets, keyguard) --
 private UiAutomation automation(){return InstrumentationRegistry.getInstrumentation().getUiAutomation();}
 private String shell(String command)throws Exception{
  try(ParcelFileDescriptor descriptor=automation().executeShellCommand(command);java.io.InputStream input=new ParcelFileDescriptor.AutoCloseInputStream(descriptor)){
   java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream();byte[] buffer=new byte[1024];int count;
   while((count=input.read(buffer))!=-1){if(output.size()+count>8192)throw new java.io.IOException("Bounded shell response exceeded");output.write(buffer,0,count);}
   return output.toString("UTF-8").trim();
  }
 }
 private List<AccessibilityNodeInfo> roots(){
  List<AccessibilityNodeInfo> roots=new ArrayList<>();
  for(AccessibilityWindowInfo window:automation().getWindows()){AccessibilityNodeInfo root=window.getRoot();if(root!=null)roots.add(root);}
  AccessibilityNodeInfo active=automation().getRootInActiveWindow();if(active!=null)roots.add(active);
  return roots;
 }
 private interface Match{boolean test(AccessibilityNodeInfo node);}
 private AccessibilityNodeInfo find(Match match){
  for(AccessibilityNodeInfo root:roots()){
   ArrayDeque<AccessibilityNodeInfo> queue=new ArrayDeque<>();queue.add(root);int visited=0;
   while(!queue.isEmpty()&&visited++<1024){AccessibilityNodeInfo node=queue.remove();if(node.isVisibleToUser()&&match.test(node))return node;for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo child=node.getChild(i);if(child!=null)queue.add(child);}}
  }
  return null;
 }
 private static String text(AccessibilityNodeInfo node){return node.getText()==null?"":node.getText().toString().trim();}
 private AccessibilityNodeInfo withText(String value,boolean exact){String expected=value.toLowerCase(Locale.ROOT);return find(node->{String actual=text(node).toLowerCase(Locale.ROOT);return exact?actual.equals(expected):actual.contains(expected);});}
 private void visible(String value,int tenths)throws Exception{for(int i=0;i<tenths;i++){if(withText(value,false)!=null)return;SystemClock.sleep(100);}fail("Missing native state: "+value+"; "+browser.diagnostics());}
 private void press(String value,boolean exact)throws Exception{
  for(int i=0;i<200;i++){AccessibilityNodeInfo node=withText(value,exact);while(node!=null&&!node.isClickable())node=node.getParent();if(node!=null&&node.isEnabled()&&node.performAction(AccessibilityNodeInfo.ACTION_CLICK))return;SystemClock.sleep(100);}
  fail("Native control not clickable: "+value);
 }
 /** Device credential (PIN) entry on the system BiometricPrompt/ConfirmCredential screen. */
 private void enterPin(String pin)throws Exception{
  for(int i=0;i<200;i++){
   AccessibilityNodeInfo field=find(node->node.isPassword()&&node.isEditable());
   if(field!=null){field.performAction(AccessibilityNodeInfo.ACTION_FOCUS);shell("input text "+pin);SystemClock.sleep(300);shell("input keyevent 66");return;}
   SystemClock.sleep(100);
  }
  fail("Device credential prompt did not appear");
 }

 // ---- Child page geometry and real touches -----------------------------------------
 private void collect(View view,List<WebView> children,WebView hostView){if(view instanceof WebView&&view!=hostView)children.add((WebView)view);if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++)collect(((ViewGroup)view).getChildAt(i),children,hostView);}
 private WebView visibleChild()throws Exception{
  AtomicReference<WebView> found=new AtomicReference<>();
  WebViewTestDriver.withActivity(MainActivity.class,main->{List<WebView> children=new ArrayList<>();collect(main.getWindow().getDecorView(),children,main.getBridge().getWebView());for(WebView child:children)if(child.isShown())found.set(child);});
  assertNotNull("Actual native child must be visible",found.get());return found.get();
 }
 private void tapPage(double cssX,double cssY)throws Exception{
  double width=Double.parseDouble(browser.child("innerWidth"));WebView child=visibleChild();float[] point=new float[2];
  BoundedActivityScenario.main(()->{int[] position=new int[2];child.getLocationOnScreen(position);float scale=(float)(child.getWidth()/width);point[0]=position[0]+(float)cssX*scale;point[1]=position[1]+(float)cssY*scale;});
  long down=SystemClock.uptimeMillis();
  for(int action:new int[]{MotionEvent.ACTION_DOWN,MotionEvent.ACTION_UP}){MotionEvent event=MotionEvent.obtain(down,SystemClock.uptimeMillis(),action,point[0],point[1],0);event.setSource(InputDevice.SOURCE_TOUCHSCREEN);InstrumentationRegistry.getInstrumentation().sendPointerSync(event);event.recycle();}
 }
 private void tapField(String id)throws Exception{
  browser.child("window.__alphaLayout=false;requestAnimationFrame(()=>requestAnimationFrame(()=>window.__alphaLayout=true))");
  childReady("window.__alphaLayout===true && document.getElementById("+JSONObject.quote(id)+").getBoundingClientRect().height>0");
  JSONArray rect=new JSONArray(browser.child("(()=>{const r=document.getElementById("+JSONObject.quote(id)+").getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()"));
  tapPage(rect.getDouble(0),rect.getDouble(1));
  childReady("document.activeElement?.id==="+JSONObject.quote(id));
 }
 /** Real key events into the focused field; script value changes are not user input to autofill.
  * The password field sits 200 CSS px below the username so the provider's one-row offer popup
  * under the username never covers it. */
 private void type(String value)throws Exception{shell("input text "+value);}
 private void form(boolean navigateOnSubmit)throws Exception{
  String submit=navigateOnSubmit?"event.preventDefault();location.href=\\'https://example.com/?alpha_password_signed_in="+token+"\\';":"event.preventDefault();";
  assertEquals("true",browser.child("(()=>{document.body.innerHTML='<form id=\"alpha-login\" autocomplete=\"on\" onsubmit=\""+submit+"\"><label>Username<input id=\"alpha-user\" name=\"username\" autocomplete=\"username\" style=\"display:block;width:85%;height:48px\"></label><label style=\"display:block;margin-top:200px\">Password<input id=\"alpha-password\" name=\"password\" type=\"password\" autocomplete=\"current-password\" style=\"display:block;width:85%;height:48px;margin-bottom:24px\"></label><button id=\"alpha-submit\" style=\"display:block;height:48px\">Sign in</button></form>';return typeof Capacitor==='undefined' && typeof androidBridge==='undefined'})()"));
 }

 private List<String> savedIds(PasswordVaultAccess access)throws Exception{
  List<String> ids=new ArrayList<>();
  JSONArray entries=access.use(PasswordVaultStore::entries);
  for(int i=0;i<entries.length();i++){JSONObject entry=entries.getJSONObject(i);if(username.equals(entry.optString("username"))&&PasswordVaultStore.bindings(entry).contains("https://example.com"))ids.add(entry.getString("id"));}
  return ids;
 }

 @Test public void saveThenFillAfterUnlockAndNoOfferToCrossOriginFrame()throws Exception{
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  AccessibilityServiceInfo info=automation().getServiceInfo();info.flags|=AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;automation().setServiceInfo(info);
  boolean emulator="1".equals(shell("getprop ro.kernel.qemu"));
  KeyguardManager keyguard=context.getSystemService(KeyguardManager.class);
  String suppliedPin=InstrumentationRegistry.getArguments().getString("passwordFillPin");
  boolean ownPin=false;String pin=suppliedPin;
  if(!keyguard.isDeviceSecure()){
   Assume.assumeTrue("A synthetic PIN is set only on an emulator; this device needs a secure lock screen and passwordFillPin",emulator);
   pin="7"+String.valueOf(100000+new Random().nextInt(800000));
   shell("locksettings set-pin "+pin);ownPin=true;
   for(int i=0;i<50&&!keyguard.isDeviceSecure();i++)SystemClock.sleep(100);
   assertTrue("Synthetic PIN makes the device secure",keyguard.isDeviceSecure());
  }else Assume.assumeTrue("Secure device: pass the lock-screen PIN as passwordFillPin",pin!=null&&pin.matches("[0-9]{4,16}"));
  String user=shell("am get-current-user");
  assertTrue("Foreground Android user must be numeric",user.matches("[0-9]{1,6}"));
  String prior=shell("settings --user "+user+" get secure autofill_service");
  assertTrue("Existing provider setting must be safely restorable",prior.isEmpty()||prior.equals("null")||prior.matches("[A-Za-z0-9_.$]+/[A-Za-z0-9_.$]+"));
  String component=context.getPackageName()+"/ai.eliza.plugins.passwords.ElizaPasswordAutofillService";
  ScriptHandler frameScript=null;
  try{
   shell("settings --user "+user+" put secure autofill_service "+component);
   assertEquals("Eliza password provider selected",component,shell("settings --user "+user+" get secure autofill_service"));
   try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
    AppNavigation.liveMode();host(AppNavigation.request("Browser"));waitHost(AppNavigation.selected("Browser"));

    // 1. Sign in: real typing, page-initiated navigation, framework Save offer, provider Save + unlock.
    page("https://example.com/?alpha_password_save="+token);
    form(true);tapField("alpha-user");type(username);
    tapField("alpha-password");type(password);
    childReady("document.getElementById('alpha-user').value==="+JSONObject.quote(username)+" && document.getElementById('alpha-password').value.length==="+password.length());
    browser.child("document.getElementById('alpha-login').requestSubmit()");
    childReady("location.search==="+JSONObject.quote("?alpha_password_signed_in="+token)+" && document.readyState==='complete'");
    visible("Alpha Phone passwords",150);
    press("Save",true);
    visible("Save password?",150);
    assertNotNull("Save prompt names the origin's host",withText("example.com",false));
    assertNotNull("Save prompt shows the captured username",withText(username,false));
    press("Save",true);
    enterPin(pin);
    PasswordVaultAccess access=PasswordVaultAccess.get(context);
    List<String> saved=Collections.emptyList();
    for(int i=0;i<150;i++){if(access.unlocked()){saved=savedIds(access);if(!saved.isEmpty())break;}SystemClock.sleep(100);}
    assertEquals("Exactly one entry bound to https://example.com was saved",1,saved.size());
    access.lock();

    // 2. Fresh load of the same origin: offer, fresh unlock in the picker, explicit choice, fill.
    page("https://example.com/?alpha_password_fill="+token);
    childReady("!document.getElementById('alpha-password')");
    form(false);tapField("alpha-user");
    press(OFFER,false);
    enterPin(pin);
    visible("Choose a sign-in",150);
    press(username,false);
    childReady("document.getElementById('alpha-user').value==="+JSONObject.quote(username)+" && document.getElementById('alpha-password').value==="+JSONObject.quote(password));
    assertEquals("Privileged host never sees the filled form","true",host("!document.querySelector('#alpha-password') && !document.body.innerText.includes("+JSONObject.quote(password)+")"));

    // 3. A login form only inside a cross-origin iframe: focused for real, never offered.
    Assume.assumeTrue("Cross-origin frame phase needs WebView document-start scripts",WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT));
    WebView child=visibleChild();AtomicReference<ScriptHandler> handler=new AtomicReference<>();
    String inner="document.addEventListener('DOMContentLoaded',()=>{document.body.innerHTML='<form autocomplete=\"on\" onsubmit=\"return false\"><input id=\"alpha-frame-user\" name=\"username\" autocomplete=\"username\" style=\"position:fixed;left:8px;top:8px;width:200px;height:48px\"><input id=\"alpha-frame-password\" type=\"password\" autocomplete=\"current-password\" style=\"position:fixed;left:8px;top:72px;width:200px;height:48px\"></form>';document.addEventListener('focusin',e=>parent.postMessage('alpha-frame-focus:'+e.target.id,'*'));});";
    BoundedActivityScenario.main(()->handler.set(WebViewCompat.addDocumentStartJavaScript(child,inner,Collections.singleton("https://example.org"))));
    frameScript=handler.get();
    page("https://example.com/?alpha_password_frame="+token);
    browser.child("(()=>{window.__alphaFrameFocus='';addEventListener('message',e=>{if(e.origin==='https://example.org')window.__alphaFrameFocus=String(e.data)});document.body.innerHTML='<iframe id=\"alpha-frame\" src=\"https://example.org/?alpha_password_frame="+token+"\" style=\"position:fixed;left:0;top:0;width:300px;height:160px;border:0\" onload=\"window.__alphaFrameLoaded=true\"></iframe>';})()");
    childReady("window.__alphaFrameLoaded===true");
    for(int attempt=0;attempt<100;attempt++){
     tapPage(8+100,8+24);SystemClock.sleep(300);
     if("true".equals(browser.child("window.__alphaFrameFocus==='alpha-frame-focus:alpha-frame-user'")))break;
    }
    assertEquals("The cross-origin frame's username field received a real focus","true",browser.child("window.__alphaFrameFocus==='alpha-frame-focus:alpha-frame-user'"));
    SystemClock.sleep(2500);
    assertNull("No password offer for a cross-origin iframe",withText(OFFER,false));
    assertNull("No picker for a cross-origin iframe",withText("Choose a sign-in",false));
   }
  }finally{
   if(frameScript!=null){ScriptHandler remove=frameScript;try{BoundedActivityScenario.main(remove::remove);}catch(Throwable ignored){}}
   // Delete only this test's synthetic entry. The fill unlock leaves a short window open.
   try{PasswordVaultAccess access=PasswordVaultAccess.get(context);if(access.unlocked())for(String id:savedIds(access)){String entry=id;access.use(store->{store.delete(entry);return null;});}}catch(Exception locked){}
   if(prior.equals("null"))shell("settings --user "+user+" delete secure autofill_service");
   else if(prior.isEmpty()){
    UiAutomation automation=automation();automation.adoptShellPermissionIdentity(android.Manifest.permission.WRITE_SECURE_SETTINGS);
    try{android.provider.Settings.Secure.putString(context.getContentResolver(),"autofill_service","");}finally{automation.dropShellPermissionIdentity();}
   }
   else shell("settings --user "+user+" put secure autofill_service "+prior);
   if(ownPin)shell("locksettings clear --old "+pin);
  }
 }
}
