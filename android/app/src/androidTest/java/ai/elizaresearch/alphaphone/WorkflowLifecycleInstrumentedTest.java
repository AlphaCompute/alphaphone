package ai.elizaresearch.alphaphone;

import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.util.concurrent.atomic.AtomicReference;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;
import androidx.test.runner.lifecycle.Stage;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Opt-in real metadata-only CAS, dropped committed response and exact read-only reconciliation. */
@RunWith(AndroidJUnit4.class)
public class WorkflowLifecycleInstrumentedTest {
 private void until(String expression,long timeout)throws Exception {
  long deadline=SystemClock.elapsedRealtime()+timeout;
  while(SystemClock.elapsedRealtime()<deadline){if("true".equals(WebViewTestDriver.evaluate("Boolean("+expression+")")))return;SystemClock.sleep(100);}
  fail("Workflow submission state timed out; chooser status="+WebViewTestDriver.evaluate("(document.querySelector('.alpha-connection [role=status]')?.textContent||'').slice(0,240)")+"; error="+WebViewTestDriver.evaluate("(document.querySelector('.alpha-connection [role=alert]')?.textContent||'').slice(0,240)"));
 }
 private void click(String text)throws Exception {
  String expression="[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==="+JSONObject.quote(text)+"&&e.getClientRects().length&&!e.disabled)";
  until(expression,30000);WebViewTestDriver.evaluate("("+expression+").click()");
 }
 private String hash(String value)throws Exception {
  StringBuilder out=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)))out.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return out.toString();
 }
 private static AlphaConnectionPlugin store(){for(android.app.Activity a:ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED))if(a instanceof MainActivity)return (AlphaConnectionPlugin)((MainActivity)a).getBridge().getPlugin("AlphaConnection").getInstance();throw new IllegalStateException("Alpha activity unavailable");}
 @Test public void removedHistorySurvivesRecreationAndExplicitRestore()throws Exception {
  Assume.assumeTrue("Requires explicit local workflow opt-in","true".equals(InstrumentationRegistry.getArguments().getString("workflowLifecycle")));
  File fixture=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getFilesDir(),"workflow-lifecycle-pairing.json");
  JSONObject config=new JSONObject(new String(Files.readAllBytes(fixture.toPath()),StandardCharsets.UTF_8));
  String origin=config.getString("origin"),title=config.getString("title");
  assertEquals("http://10.0.2.2:47857",origin);
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)) {
   until("document.querySelector('[data-screen]')",20000);
   String originalSelection=WebViewTestDriver.evaluate("localStorage.getItem('alpha.connection.selection.v1')");
   String slot="remote:"+origin;AtomicReference<String> originalCredential=new AtomicReference<>();
   BoundedActivityScenario.main(()->{try{originalCredential.set(store().readCredentialSlot(slot));}catch(Exception e){throw new RuntimeException(e);}});
   try {
   String timeOrigin=WebViewTestDriver.evaluate("performance.timeOrigin");
   WebViewTestDriver.evaluate("localStorage.removeItem('alpha.connection.selection.v1');location.replace(location.origin+location.pathname)");
   until("performance.timeOrigin!=="+timeOrigin+"&&document.querySelector('.os')&&document.querySelector('.alpha-connection-scrim')",20000);
   WebViewTestDriver.evaluate("[...document.querySelectorAll('.alpha-connection summary')].find(e=>e.textContent==='Local development agent').click()");
   WebViewTestDriver.evaluateSensitive("(()=>{const d=[...document.querySelectorAll('.alpha-connection details')].find(e=>e.querySelector('summary')?.textContent==='Local development agent');const inputs=d.querySelectorAll('input');inputs[0].value="+JSONObject.quote(origin)+";inputs[1].value="+JSONObject.quote(config.getString("code"))+";})()");
   click("Connect local agent");until("!document.querySelector('.alpha-connection-scrim')",60000);
   WebViewTestDriver.evaluate(AppNavigation.request("Workflows"));until(AppNavigation.selected("Workflows"),20000);until("window.__alphaTestNavigation?.status==='complete'",20000);
   String card="[...document.querySelectorAll('button')].find(e=>e.textContent.includes("+JSONObject.quote(title)+")&&e.getClientRects().length)";
   until(card,30000);WebViewTestDriver.evaluate("("+card+").click()");
   until("document.querySelector('button[aria-label=\"Remove workflow\"]')",20000);
   WebViewTestDriver.evaluate("document.querySelector('button[aria-label=\"Remove workflow\"]').click()");
   click("Remove workflow; keep execution history");until("document.body.textContent.includes('Removal or restore outcome unknown')",30000);
   String retained="Object.entries(localStorage).filter(([k,v])=>k.startsWith('alpha.workflow.pending.v1:')&&k.endsWith(':lifecycle')&&k.includes("+JSONObject.quote(config.getString("workflowId"))+") )";
   assertEquals("1",WebViewTestDriver.evaluate(retained+".length"));
   scenario.recreate();until("document.documentElement.dataset.activeView==='home'&&!document.querySelector('.alpha-connection-scrim')",60000);
   WebViewTestDriver.evaluate(AppNavigation.request("Workflows"));until(AppNavigation.selected("Workflows"),20000);until("window.__alphaTestNavigation?.status==='complete'",20000);
   String pending="[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Pending workflow change')&&e.getClientRects().length)";
   until(pending,30000);WebViewTestDriver.evaluate("("+pending+").click()");
   until("document.querySelector('button[aria-label=\"Restore workflow\"]')&&!document.body.textContent.includes('Removal or restore outcome unknown')",30000);
   assertEquals("0",WebViewTestDriver.evaluate(retained+".length"));assertEquals("false",WebViewTestDriver.evaluate("Boolean(document.querySelector('button[aria-label=\"Run now\"]'))"));
   assertEquals("true",WebViewTestDriver.evaluate("Boolean(document.querySelector('button[aria-label=\"finished execution\"]'))"));
   WebViewTestDriver.evaluate("document.querySelector('button[aria-label=\"Back to workflows\"]').click()");
   String removedCard="[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Removed workflows')&&e.getClientRects().length)";
   until(removedCard,20000);WebViewTestDriver.evaluate("("+removedCard+").click()");until(card,30000);WebViewTestDriver.evaluate("("+card+").click()");
   until("document.querySelector('button[aria-label=\"Restore workflow\"]')",20000);WebViewTestDriver.evaluate("document.querySelector('button[aria-label=\"Restore workflow\"]').click()");click("Confirm restore");
   until("document.querySelector('button[aria-label=\"Run now\"]')&&document.body.textContent.includes('Paused on remote agent')",30000);
   assertEquals("0",WebViewTestDriver.evaluate(retained+".length"));assertEquals("true",WebViewTestDriver.evaluate("Boolean(document.querySelector('button[aria-label=\"finished execution\"]'))"));
   } finally {
    BoundedActivityScenario.main(()->{try{if(originalCredential.get()!=null)store().writeCredentialSlot(slot,originalCredential.get());}catch(Exception e){throw new RuntimeException(e);}});
    if(originalCredential.get()==null){WebViewTestDriver.evaluate("window.__workflowRemoved=false;Capacitor.Plugins.AlphaConnection.secureRemove({slot:"+JSONObject.quote(slot)+"}).then(()=>window.__workflowRemoved=true)");until("window.__workflowRemoved",10000);}
    WebViewTestDriver.evaluate("(()=>{const value="+originalSelection+";if(value===null)localStorage.removeItem('alpha.connection.selection.v1');else localStorage.setItem('alpha.connection.selection.v1',value);})()");
    scenario.recreate();until("document.querySelector('.os')",30000);
   }
  } finally {fixture.delete();}
 }
}
