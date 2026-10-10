package ai.elizaresearch.alphaphone;

import static org.junit.Assert.*;

import android.content.res.Configuration;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.UiDevice;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Rotate on Home and with a composer draft: the active view and the draft survive and
 * the visible primary actions stay inside the viewport. Requires the landscape layout;
 * a portrait-locked build fails the orientation assertion rather than passing trivially.
 * Emulator evidence only.
 */
@RunWith(AndroidJUnit4.class)
public final class RotationInstrumentedTest {
 private static final String DRAFT="Rotation draft "+System.nanoTime();
 private static String js(String code)throws Exception{return WebViewTestDriver.evaluate(code);}
 private static void until(String code)throws Exception{for(int i=0;i<200;i++){if("true".equals(js("Boolean("+code+")")))return;SystemClock.sleep(100);}fail("Rotation flow condition: "+code);}
 private static int orientation()throws Exception{AtomicInteger value=new AtomicInteger();WebViewTestDriver.withActivity(MainActivity.class,a->value.set(a.getResources().getConfiguration().orientation));return value.get();}
 private static void awaitOrientation(int expected)throws Exception{for(int i=0;i<100;i++){if(orientation()==expected)return;SystemClock.sleep(100);}fail("Activity did not reach orientation "+expected+" (landscape layout required)");}
 /** Visible enabled buttons of the active view whose box leaves the viewport. */
 private static final String CLIPPED="JSON.stringify([...document.querySelectorAll('button,[role=button]')].filter(e=>!e.disabled&&e.getClientRects().length&&!e.closest('[inert],[aria-hidden=\"true\"]')).map(e=>({l:e.getAttribute('aria-label')||e.textContent.trim(),r:e.getBoundingClientRect()})).filter(x=>x.r.width>0&&(x.r.left<-1||x.r.top<-1||x.r.right>innerWidth+1||x.r.bottom>innerHeight+1)).map(x=>x.l))";

 private static void rotateAndCheck(UiDevice device,String view,String extra)throws Exception{
  device.setOrientationLeft();awaitOrientation(Configuration.ORIENTATION_LANDSCAPE);
  until(AppNavigation.selected(view));if(extra!=null)until(extra);
  assertEquals("Primary actions clipped in landscape "+view,"[]",js(CLIPPED));
  device.setOrientationNatural();awaitOrientation(Configuration.ORIENTATION_PORTRAIT);
  until(AppNavigation.selected(view));if(extra!=null)until(extra);
  assertEquals("Primary actions clipped after returning to portrait "+view,"[]",js(CLIPPED));
 }

 @Test public void homeAndComposerDraftSurviveRotation()throws Exception{
  UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();AppNavigation.declineStartupAccess();
   js(AppNavigation.request("Home"));until(AppNavigation.selected("Home"));
   rotateAndCheck(device,"Home",null);
   js(AppNavigation.type());until(AppNavigation.composer());
   js("(()=>{const e="+AppNavigation.composer()+";Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,"+JSONObject.quote(DRAFT)+");e.dispatchEvent(new Event('input',{bubbles:true}));})()");
   String kept="("+AppNavigation.composer()+")?.value==="+JSONObject.quote(DRAFT);
   until(kept);
   rotateAndCheck(device,"Home",kept);
  }finally{
   device.setOrientationNatural();device.unfreezeRotation();
  }
 }
}
