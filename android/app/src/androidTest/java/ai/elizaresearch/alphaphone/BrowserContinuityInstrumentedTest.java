package ai.elizaresearch.alphaphone;

import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.UUID;
import static org.junit.Assert.*;

/** Real renderer controls and isolated HTTPS WebViews; native encrypted bookmark
 * readback is an independent witness. Activity recreation is not process death. */
@RunWith(AndroidJUnit4.class)
public final class BrowserContinuityInstrumentedTest {
 private final BrowserFlowInstrumentedTest browser=new BrowserFlowInstrumentedTest();
 private String host(String script)throws Exception{return WebViewTestDriver.evaluate(script);}
 private void ready(String predicate)throws Exception{for(int i=0;i<200;i++){if("true".equals(host("Boolean("+predicate+")")))return;SystemClock.sleep(100);}fail("Browser continuity control/state missing");}
 private String button(String label){return "[...document.querySelectorAll('[data-screen] button')].find(e=>e.getAttribute('aria-label')==="+JSONObject.quote(label)+")";}
 private void click(String label)throws Exception{ready(button(label));host("("+button(label)+").click()");}
 private void app(String label)throws Exception{host(AppNavigation.request(label));ready(AppNavigation.selected(label));}
 private void address(String value)throws Exception{
  if("false".equals(host("!!document.querySelector('input[aria-label=Address]')")))click("Edit address");
  ready("document.querySelector('input[aria-label=Address]')");
  host("(()=>{const e=document.querySelector('input[aria-label=Address]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,"+JSONObject.quote(value)+");e.dispatchEvent(new Event('input',{bubbles:true}));})()");
  ready("document.querySelector('input[aria-label=Address]').value==="+JSONObject.quote(value));
  host("document.querySelector('input[aria-label=Address]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
 }
 private void page(String url)throws Exception{
  for(int i=0;i<300;i++){if("true".equals(browser.child("location.href==="+JSONObject.quote(url)+" && document.readyState==='complete' && document.title==='Example Domain' && typeof Capacitor==='undefined'")))return;SystemClock.sleep(100);}fail("Actual isolated HTTPS document not restored; "+browser.diagnostics());
  ready("document.querySelector('svg[aria-label=\"Secure connection\"]')");
 }
 private void saved(BrowserBookmarks store,String url,boolean expected)throws Exception{for(int i=0;i<150;i++){if(store.read().contains(url)==expected)return;SystemClock.sleep(100);}fail("Native encrypted bookmark commit did not match UI action");}
 @Test public void tabsSurviveAppNavigationAndBookmarksSurviveActivityRecreation()throws Exception{
  String token=UUID.randomUUID().toString(),one="https://example.com/?alpha_continuity="+token+"-one",two="https://example.com/?alpha_continuity="+token+"-two",three="https://example.com/?alpha_continuity="+token+"-three";
  android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();BrowserBookmarks store=new BrowserBookmarks(context);
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();app("Browser");address(one);page(one);
   browser.child("localStorage.setItem('alpha_continuity',"+JSONObject.quote(token)+");true");
   address(two);page(two);click("Menu");click("Bookmark");saved(store,two,true);
   String sealed=context.getSharedPreferences("alpha-browser-bookmarks",0).getString("sealed","");assertFalse("Explicit URL is encrypted at rest",sealed.contains(token));assertFalse(sealed.isEmpty());
   click("Tabs");click("New tab");address(three);page(three);
   assertEquals("Independent tab profile","null",browser.child("localStorage.getItem('alpha_continuity')"));
   app("Notes");app("Browser");page(three);
   ready("("+button("Tabs")+").textContent.trim()==='2'");
   click("Tabs");host("(()=>{const b=[...document.querySelectorAll('button[aria-label^=\"Switch to \"]')].find(e=>e.textContent.includes("+JSONObject.quote(two)+"));if(b)b.click();})()");page(two);
   assertEquals("Original tab storage remains intact",JSONObject.quote(token),browser.child("localStorage.getItem('alpha_continuity')"));
   click("Previous page");page(one);click("Next page");page(two);
   click("Menu");click("Bookmarks and history");click("Bookmarks");ready(button(two));click(two);page(two);
   assertEquals("No host access to website storage","null",host("localStorage.getItem('alpha_continuity')"));
   scenario.recreate();AppNavigation.liveMode();app("Browser");
   ready("("+button("Tabs")+").textContent.trim()==='1'");
   assertEquals("Recreated renderer does not automatically reopen saved websites","null",browser.child("true"));
   click("Menu");click("Bookmarks and history");click("Bookmarks");ready(button(two));
   host("("+button(two)+").parentElement.querySelector('button[aria-label=\"Remove bookmark\"]').click()");saved(store,two,false);ready("!("+button(two)+")");
   scenario.recreate();AppNavigation.liveMode();app("Browser");click("Menu");click("Bookmarks and history");click("Bookmarks");
   assertFalse("Removal survives new native store instance",new BrowserBookmarks(context).read().contains(two));
  }finally{if(store.read().contains(two))store.change(two,false);}
 }
 private static class BrowserSnapshot {
  MainActivity activity;String namespace;java.util.List<String> profiles=new java.util.ArrayList<>();java.util.List<android.view.View> frames=new java.util.ArrayList<>();
 }
 private BrowserSnapshot snapshot()throws Exception{
  BrowserSnapshot result=new BrowserSnapshot();java.util.concurrent.atomic.AtomicReference<Exception> error=new java.util.concurrent.atomic.AtomicReference<>();
  WebViewTestDriver.withActivity(MainActivity.class,activity->{try{
   result.activity=activity;Object plugin=activity.getBridge().getPlugin("AlphaBrowser").getInstance();
   java.lang.reflect.Field namespace=plugin.getClass().getDeclaredField("namespace"),tabs=plugin.getClass().getDeclaredField("tabs");namespace.setAccessible(true);tabs.setAccessible(true);result.namespace=(String)namespace.get(plugin);
   for(Object tab:((java.util.Map<?,?>)tabs.get(plugin)).values()){
    java.lang.reflect.Field profile=tab.getClass().getDeclaredField("profile"),frame=tab.getClass().getDeclaredField("frame");profile.setAccessible(true);frame.setAccessible(true);result.profiles.add((String)profile.get(tab));result.frames.add((android.view.View)frame.get(tab));
   }
  }catch(Exception failure){error.set(failure);}});if(error.get()!=null)throw error.get();return result;
 }
 private void resetVerified(BrowserSnapshot before,String url)throws Exception{
  BrowserSnapshot after=snapshot();assertSame("Document replacement keeps the actual Activity",before.activity,after.activity);assertNotEquals("Host reload rotates profile namespace",before.namespace,after.namespace);assertTrue("Old child tabs removed",after.frames.isEmpty());
  WebViewTestDriver.withActivity(MainActivity.class,activity->{
   for(android.view.View frame:before.frames)assertNull("Old native surface detached",frame.getParent());
  });
  for(String profile:before.profiles){
   java.util.concurrent.atomic.AtomicBoolean purged=new java.util.concurrent.atomic.AtomicBoolean();
   for(int i=0;i<200&&!purged.get();i++){
    WebViewTestDriver.withActivity(MainActivity.class,activity->{try{
     Object plugin=activity.getBridge().getPlugin("AlphaBrowser").getInstance();java.lang.reflect.Field field=plugin.getClass().getDeclaredField("retiredProfiles");field.setAccessible(true);
     purged.set("purged".equals(((java.util.Map<?,?>)field.get(plugin)).get(profile)));
    }catch(Exception failure){throw new AssertionError(failure);}});
    if(!purged.get())SystemClock.sleep(100);
   }
   assertTrue("Profile-scoped data deletion callback completed",purged.get());
   // Reopen the exact retired profile for an independent storage witness. A
   // new namespace alone would prove isolation, not deletion of old data.
   java.util.concurrent.CountDownLatch done=new java.util.concurrent.CountDownLatch(1);
   java.util.concurrent.atomic.AtomicReference<String> answer=new java.util.concurrent.atomic.AtomicReference<>();
   java.util.concurrent.atomic.AtomicReference<android.webkit.WebView> probe=new java.util.concurrent.atomic.AtomicReference<>();
   WebViewTestDriver.withActivity(MainActivity.class,activity->{
    android.webkit.WebView web=new android.webkit.WebView(activity);probe.set(web);androidx.webkit.WebViewCompat.setProfile(web,profile);
    web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);
    web.setWebViewClient(new android.webkit.WebViewClient(){
     @Override public void onPageFinished(android.webkit.WebView view,String loaded){if(!url.equals(loaded))return;
      view.evaluateJavascript("localStorage.getItem('reload_private')===null && !document.cookie.split(';').some(c=>c.trim().startsWith('alpha_reload_private=')) && typeof Capacitor==='undefined'",value->{answer.set(value);done.countDown();});
     }
     @Override public void onReceivedSslError(android.webkit.WebView view,android.webkit.SslErrorHandler handler,android.net.http.SslError error){handler.cancel();answer.set("TLS failure");done.countDown();}
    });web.loadUrl(url);
   });
   try{assertTrue("Retired-profile HTTPS storage probe completed",done.await(30,java.util.concurrent.TimeUnit.SECONDS));assertEquals("Old profile cookie and localStorage were actually purged","true",answer.get());}
   finally{WebViewTestDriver.withActivity(MainActivity.class,activity->{probe.get().stopLoading();probe.get().destroy();});}
  }
 }
 @Test public void sameActivityReloadAndMockRoundTripRetireNativeProfiles()throws Exception{
  org.junit.Assume.assumeTrue("Mock mode exists only in -PELIZA_DEV_ALLOW_TEST_MOCKS=1 builds",BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS);
  String token=UUID.randomUUID().toString(),url="https://example.com/?alpha_document_reload="+token;
  BrowserBookmarks store=new BrowserBookmarks(InstrumentationRegistry.getInstrumentation().getTargetContext());
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();app("Browser");address(url);page(url);browser.child("localStorage.setItem('reload_private',"+JSONObject.quote(token)+");document.cookie='alpha_reload_private="+token+"; Secure; SameSite=Lax; Path=/';true");
   assertEquals("Private fixture stored before purge",JSONObject.quote(token),browser.child("localStorage.getItem('reload_private')"));assertEquals("Cookie fixture stored before purge","true",browser.child("document.cookie.includes('alpha_reload_private="+token+"')"));
   click("Menu");click("Bookmark");saved(store,url,true);BrowserSnapshot first=snapshot();assertEquals(1,first.frames.size());
   String origin=host("performance.timeOrigin");WebViewTestDriver.navigateHostDocument("location.reload()",true);ready("performance.timeOrigin!=="+origin+"&&document.documentElement.dataset.activeView==='home'");resetVerified(first,url);
   app("Browser");address(url);page(url);assertEquals("New document cannot reuse old site storage","null",browser.child("localStorage.getItem('reload_private')"));
   click("Menu");click("Bookmarks and history");click("Bookmarks");ready(button(url));click(url);page(url);browser.child("localStorage.setItem('reload_private',"+JSONObject.quote(token)+");document.cookie='alpha_reload_private="+token+"; Secure; SameSite=Lax; Path=/';true");BrowserSnapshot second=snapshot();
   app("Settings");ready("window.__alphaTestNavigation?.status==='complete'");click("Agent connection");ready("document.querySelector('.alpha-connection-scrim')");
   host("[...document.querySelectorAll('.alpha-connection summary')].find(e=>e.textContent==='Mock mode').click()");
   WebViewTestDriver.navigateHostDocument("[...document.querySelectorAll('.alpha-connection button')].find(e=>e.textContent.trim()==='Enter mock mode').click()",false);
   ready("document.documentElement.dataset.connectionMode==='mock'&&document.querySelector('.mock-mode-banner')");resetVerified(second,url);
   assertEquals("Mock renderer does not receive private bookmark URL","false",host("document.body.textContent.includes("+JSONObject.quote(token)+")"));
   WebViewTestDriver.navigateHostDocument("document.querySelector('.mock-mode-banner button').click()",true);ready("document.documentElement.dataset.connectionMode==='live'&&!document.querySelector('.mock-mode-banner')");
   assertSame(first.activity,snapshot().activity);app("Browser");address(url);page(url);assertEquals("Fresh browser after mock exit","null",browser.child("localStorage.getItem('reload_private')"));
   click("Menu");click("Bookmarks and history");click("Bookmarks");ready(button(url));
  }finally{if(store.read().contains(url))store.change(url,false);}
 }
 /** External runner supplies separate processes and explicit force-stop boundaries. */
 @Test public void bookmarkProcessRestartPhase()throws Exception{
  String phase=InstrumentationRegistry.getArguments().getString("bookmarkPhase");org.junit.Assume.assumeTrue("Explicit process runner only",phase!=null);
  android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();BrowserBookmarks store=new BrowserBookmarks(context);
  android.content.SharedPreferences fixture=context.getSharedPreferences("browser-bookmark-restart-fixture",0);
  if("cleanup".equals(phase)){
   String owned=fixture.getString("url",null);if(owned!=null&&store.read().contains(owned))store.change(owned,false);assertTrue(fixture.edit().clear().commit());return;
  }
  if("prepare".equals(phase)){
   assertFalse("Clean previous owned fixture first",fixture.contains("url"));String url="https://example.com/?alpha_bookmark_restart="+UUID.randomUUID();
   assertTrue(fixture.edit().putString("url",url).putInt("pid",android.os.Process.myPid()).commit());
   try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
    AppNavigation.liveMode();app("Browser");address(url);page(url);click("Menu");click("Bookmark");saved(store,url,true);
    assertTrue(fixture.edit().putStringSet("profiles",new java.util.HashSet<>(snapshot().profiles)).commit());
   }return;
  }
  assertTrue("Owned fixture prepared",fixture.contains("url"));String url=fixture.getString("url","");
  assertNotEquals("Actual new process required",fixture.getInt("pid",-1),android.os.Process.myPid());
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();
   java.util.Set<String> retired=fixture.getStringSet("profiles",java.util.Collections.emptySet());assertFalse("Exact prior-process profiles recorded",retired.isEmpty());
   WebViewTestDriver.withActivity(MainActivity.class,activity->{for(String name:retired)assertFalse("Old native profile deleted after real process restart",androidx.webkit.ProfileStore.getInstance().getAllProfileNames().contains(name));});
   app("Browser");ready("("+button("Tabs")+").textContent.trim()==='1'");
   assertEquals("No automatic browsing on process start","null",browser.child("true"));
   click("Menu");click("Bookmarks and history");click("Bookmarks");
   if("verify".equals(phase)){
    ready(button(url));assertTrue("Native store survived process death",store.read().contains(url));click(url);page(url);
    click("Menu");click("Bookmarks and history");click("Bookmarks");ready(button(url));
    host("("+button(url)+").parentElement.querySelector('button[aria-label=\"Remove bookmark\"]').click()");saved(store,url,false);ready("!("+button(url)+")");
    assertTrue(fixture.edit().putInt("pid",android.os.Process.myPid()).putStringSet("profiles",new java.util.HashSet<>(snapshot().profiles)).commit());
   }else{
    assertEquals("verifyRemoved",phase);assertFalse("Removal survives another process death",store.read().contains(url));
    // Wait for the asynchronous native hydration to settle via a complete menu
    // close/reopen, then independently assert the native durable state above.
    click("Back to page");click("Menu");click("Bookmarks and history");click("Bookmarks");ready("!("+button(url)+")");
   }
  }
 }

}
