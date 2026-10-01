package ai.elizaresearch.alphaphone;

import android.Manifest;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.UUID;
import static org.junit.Assert.*;

/** Real prototype UI and durable local data. Provider absence is never a route success. */
@RunWith(AndroidJUnit4.class)
public class MapsInstrumentedTest {
 private String eval(String js)throws Exception{return WebViewTestDriver.evaluate(js);}
 private void until(String js)throws Exception{long end=SystemClock.elapsedRealtime()+25000;while(SystemClock.elapsedRealtime()<end){if("true".equals(eval("Boolean("+js+")")))return;SystemClock.sleep(100);}fail("Maps condition: "+js+" screen="+eval("document.body.innerText.slice(-900)"));}
 private void click(String label)throws Exception{String node="document.querySelector('[aria-label='+"+JSONObject.quote(JSONObject.quote(label))+"+']')";until(node);eval("("+node+").click()");}
 private void input(String label,String text)throws Exception{String node="document.querySelector('input[aria-label='+"+JSONObject.quote(JSONObject.quote(label))+"+']')";until(node);eval("(()=>{const e="+node+";Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,"+JSONObject.quote(text)+");e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()");}
 private void maps()throws Exception{AppNavigation.liveMode();eval(AppNavigation.request("Maps"));until(AppNavigation.selected("Maps"));}
 @Test public void coordinatesSaveRenamePersistAndRemoveWithoutInventedProviderData()throws Exception{
  String label="Alpha maps fixture "+UUID.randomUUID(),renamed=label+" renamed";
  double lat=10+Math.random(),lon=20+Math.random();String point=String.format(java.util.Locale.ROOT,"%.6f, %.6f",lat,lon);
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   maps();until("document.querySelector('[data-alpha-maps-status]')?.textContent.includes('provider not connected')");
   assertEquals("No simulated geography","false",eval("[...document.querySelectorAll('[data-alpha-maps-root] svg[width=\"1200\"] path')].some(p=>!!p.getAttribute('d'))"));
   input("Search places",point);eval("document.querySelector('input[aria-label=\"Search places\"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
   until("document.querySelector('[aria-label=\"Rename place\"]')");assertEquals("Name editor is opt-in", "false", eval("!!document.querySelector('input[aria-label=\"Place name\"]')"));click("Rename place");input("Place name",label);click("Apply place name");click("Save");
   until("JSON.parse(localStorage.getItem('alpha.maps.saved-places.v1')||'{\"items\":[]}').items.some(p=>p.label==="+JSONObject.quote(label)+")");
   click("Directions");until("document.querySelector('[data-alpha-maps-status]')?.textContent.includes('No route has been calculated')");
   click("Rename place");input("Place name",renamed);click("Apply place name");
   eval(AppNavigation.request("Home"));until(AppNavigation.selected("Home"));scenario.recreate();maps();
   until("[...document.querySelectorAll('[data-alpha-maps-root] button')].some(b=>b.textContent.trim()==="+JSONObject.quote(renamed)+")");
   eval("[...document.querySelectorAll('[data-alpha-maps-root] button')].find(b=>b.textContent.trim()==="+JSONObject.quote(renamed)+").click()");
   until("document.querySelector('[aria-label=\"Rename place\"]')?.textContent==="+JSONObject.quote(renamed));click("Remove from saved");
   until("!JSON.parse(localStorage.getItem('alpha.maps.saved-places.v1')).items.some(p=>p.label==="+JSONObject.quote(renamed)+")");
   click("Close place");input("Search places","Tartine Bakery San Francisco");eval("document.querySelector('input[aria-label=\"Search places\"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
   until("document.querySelector('[data-alpha-maps-status]')?.textContent.includes('Connect a Maps provider')");
   assertEquals("No fake search results","false",eval("[...document.querySelectorAll('[data-alpha-maps-root] button')].some(b=>b.textContent.includes('600 Guerrero'))"));
  }finally{
   // Cleanup only this test's two labels; never restore/erase unrelated saved places.
   try(BoundedActivityScenario<MainActivity> cleanup=BoundedActivityScenario.launch(MainActivity.class)){
    until("document.documentElement.dataset.activeView");eval("(()=>{const key='alpha.maps.saved-places.v1',raw=localStorage.getItem(key);if(!raw)return;const data=JSON.parse(raw);data.items=data.items.filter(p=>!["+JSONObject.quote(label)+","+JSONObject.quote(renamed)+"].includes(p.label));localStorage.setItem(key,JSON.stringify(data));})()");
   }
  }
 }
 @Test public void explicitRecenterUsesInjectedNativeLocationAndStopsWatch()throws Exception{
  String expectedLat=InstrumentationRegistry.getArguments().getString("mapsLatitude"),expectedLon=InstrumentationRegistry.getArguments().getString("mapsLongitude");
  Assume.assumeTrue("Requires root-coordinated continuing emulator GPS injection and mapsLatitude/mapsLongitude args",expectedLat!=null&&expectedLon!=null);
  String app=InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName();
  for(String permission:new String[]{Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.ACCESS_FINE_LOCATION})InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(app,permission);
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   maps();click("Recenter");until("document.querySelector('[aria-label=\"Rename place\"]')?.textContent==='Current location'");
   String coordinates=String.format(java.util.Locale.ROOT,"%.5f, %.5f",Double.parseDouble(expectedLat),Double.parseDouble(expectedLon));
   until("document.querySelector('[data-alpha-maps-root]').textContent.includes("+JSONObject.quote(coordinates)+")");
   until("document.querySelector('[data-alpha-maps-status]')?.textContent.includes('accuracy')");
   java.util.concurrent.atomic.AtomicInteger watches=new java.util.concurrent.atomic.AtomicInteger(-1);
   for(int i=0;i<50;i++){
    WebViewTestDriver.withActivity(MainActivity.class,activity->{try{Object plugin=activity.getBridge().getPlugin("ElizaLocation").getInstance();java.lang.reflect.Field field=plugin.getClass().getDeclaredField("watches");field.setAccessible(true);watches.set(((java.util.Map<?,?>)field.get(plugin)).size());}catch(Exception error){throw new AssertionError(error);}});
    if(watches.get()==0)break;SystemClock.sleep(100);
   }
   assertEquals("One-shot fix releases actual native location watch",0,watches.get());
   eval(AppNavigation.request("Home"));until(AppNavigation.selected("Home"));maps();
   assertEquals("Location never resumes implicitly","false",eval("!!document.querySelector('[aria-label=\"Rename place\"]')"));
  }
 }
}
