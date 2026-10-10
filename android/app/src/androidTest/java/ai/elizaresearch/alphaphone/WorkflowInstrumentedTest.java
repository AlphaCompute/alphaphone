package ai.elizaresearch.alphaphone;

import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Opt-in actual patched backend -> rendered approval -> note -> durable journal. */
@RunWith(AndroidJUnit4.class)
public class WorkflowInstrumentedTest {
 private void until(String expression,long timeout)throws Exception {
  long deadline=SystemClock.elapsedRealtime()+timeout;
  while(SystemClock.elapsedRealtime()<deadline){if("true".equals(WebViewTestDriver.evaluate("Boolean("+expression+")")))return;SystemClock.sleep(100);}
  fail("Patched device flow did not reach expected state");
 }
 private void click(String text)throws Exception {
  String expression="[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==="+JSONObject.quote(text)+"&&e.getClientRects().length)";
  until(expression,15000);WebViewTestDriver.evaluate("("+expression+").click()");
 }
 private String hash(String value)throws Exception {
  StringBuilder out=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)))out.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return out.toString();
 }
 @Test public void realArithmeticWorkflowReviewRunReceiptAndPause()throws Exception {
  Assume.assumeTrue("Requires explicit local workflow opt-in","true".equals(InstrumentationRegistry.getArguments().getString("workflows")));
  File fixture=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getFilesDir(),"workflow-pairing.json");
  JSONObject config=new JSONObject(new String(Files.readAllBytes(fixture.toPath()),StandardCharsets.UTF_8));
  String origin=config.getString("origin"),title=config.getString("title");
  assertEquals("http://10.0.2.2:47840",origin);
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)) {
   until("document.querySelector('[data-screen]')",20000);
   WebViewTestDriver.evaluate("localStorage.removeItem('alpha.connection.selection.v1');location.replace(location.origin+location.pathname)");
   until("document.querySelector('.alpha-connection-scrim')",20000);
   WebViewTestDriver.evaluate("[...document.querySelectorAll('.alpha-connection summary')].find(e=>e.textContent==='Local development agent').click()");
   WebViewTestDriver.evaluateSensitive("(()=>{const d=[...document.querySelectorAll('.alpha-connection details')].find(e=>e.querySelector('summary')?.textContent==='Local development agent');const inputs=d.querySelectorAll('input');inputs[0].value="+JSONObject.quote(origin)+";inputs[1].value="+JSONObject.quote(config.getString("code"))+";})()");
   click("Connect local agent");until("!document.querySelector('.alpha-connection-scrim')",60000);
   WebViewTestDriver.evaluate(AppNavigation.request("Workflows"));until(AppNavigation.selected("workflows"),20000);
   String card="[...document.querySelectorAll('button')].find(e=>e.textContent.includes("+JSONObject.quote(title)+")&&e.getClientRects().length)";
   until(card,30000);WebViewTestDriver.evaluate("("+card+").click()");
   until("document.querySelector('button[aria-label=\"Run now\"]')",20000);
   WebViewTestDriver.evaluate("document.querySelector('button[aria-label=\"Run now\"]').click()");
   until("document.body.textContent.includes('Tap Run now again to confirm')",10000);
   WebViewTestDriver.evaluate("document.querySelector('button[aria-label=\"Run now\"]').click()");
   until("document.querySelector('button[aria-label=\"Refresh execution receipt\"]')",30000);
   for(int i=0;i<30&&!"true".equals(WebViewTestDriver.evaluate("[...document.querySelectorAll('span')].some(e=>e.textContent==='finished')"));i++){WebViewTestDriver.evaluate("document.querySelector('button[aria-label=\"Refresh execution receipt\"]').click()");SystemClock.sleep(1000);}
   until("[...document.querySelectorAll('span')].some(e=>e.textContent==='finished')",10000);
   WebViewTestDriver.evaluate("[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')==="+JSONObject.quote("Back to "+title)+").click()");
   String toggle="[...document.querySelectorAll('button')].filter(e=>e.getAttribute('aria-label')==="+JSONObject.quote("Turn "+title+" on or off")+").at(-1)";
   WebViewTestDriver.evaluate("("+toggle+").click()");until("document.body.textContent.includes('Tap the switch again to enable')",10000);
   WebViewTestDriver.evaluate("("+toggle+").click()");until("("+toggle+").getAttribute('aria-pressed')==='true'",30000);
   WebViewTestDriver.evaluate("("+toggle+").click()");until("("+toggle+").getAttribute('aria-pressed')==='false'",30000);
   scenario.recreate();until("document.documentElement.dataset.activeView==='home'&&!document.querySelector('.alpha-connection-scrim')",60000);
  } finally {fixture.delete();}
 }
}
