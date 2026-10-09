package ai.elizaresearch.alphaphone;

import android.content.Context;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/**
 * Local problem log: a forced uncaught exception is recorded by class only, survives a fresh
 * read from disk and, with the two-phase runner, a real process death; Settings shows it.
 */
@RunWith(AndroidJUnit4.class)
public final class SettingsCrashLogInstrumentedTest {
 private static final String SECRET="Synthetic note text 555-0100 dana@example.com";
 private final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
 private String js(String code)throws Exception{return WebViewTestDriver.evaluate(code);}
 private void until(String code)throws Exception{for(int i=0;i<200;i++){if("true".equals(js("Boolean("+code+")")))return;SystemClock.sleep(100);}fail("Settings condition: "+code);}
 private void button(String label)throws Exception{String q="[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith("+JSONObject.quote(label)+"))";until(q);js("("+q+").click()");}
 private static JSONObject last(JSONArray entries,String source)throws Exception{for(int i=entries.length()-1;i>=0;i--)if(source.equals(entries.getJSONObject(i).optString("source")))return entries.getJSONObject(i);return null;}

 @Test public void forcedUncaughtExceptionIsRecordedByClassOnlyAndReadBackFromDisk()throws Exception{
  AlphaCrashLog.clear(context);
  AtomicReference<Throwable> delegated=new AtomicReference<>();
  Thread.UncaughtExceptionHandler handler=AlphaCrashLog.handler(context,(thread,error)->delegated.set(error));
  IllegalStateException forced=new IllegalStateException(SECRET,new java.io.IOException(SECRET));
  Thread thread=new Thread(()->{throw forced;},"forced-crash");thread.setUncaughtExceptionHandler(handler);thread.start();thread.join(10_000);
  assertSame("Android's own handler still runs",forced,delegated.get());
  String bytes=new String(Files.readAllBytes(AlphaCrashLog.file(context).toPath()),StandardCharsets.UTF_8);
  assertFalse("No message, stack or content on disk",bytes.contains("555-0100")||bytes.contains("dana@")||bytes.contains("Synthetic")||bytes.contains("at ai."));
  JSONObject entry=last(AlphaCrashLog.read(context).getJSONArray("entries"),"uncaught");
  assertNotNull(entry);
  assertEquals("java.lang.IllegalStateException",entry.getString("errorClass"));
  assertEquals("java.io.IOException",entry.getString("rootClass"));
  assertEquals("background",entry.getString("thread"));
  AlphaCrashLog.recordRenderer(context,"render","TypeError");
  try{AlphaCrashLog.recordRenderer(context,"made-up","TypeError");fail("Unknown renderer kinds are refused");}catch(IllegalArgumentException expected){}
  AlphaCrashLog.recordRenderer(context,"startup",SECRET);
  assertEquals("A non-identifier class becomes Error","Error",last(AlphaCrashLog.read(context).getJSONArray("entries"),"renderer").getString("errorClass"));
  for(int i=0;i<AlphaCrashLog.MAX_ENTRIES+5;i++)AlphaCrashLog.recordRenderer(context,"uncaught","RangeError");
  assertEquals(AlphaCrashLog.MAX_ENTRIES,AlphaCrashLog.read(context).getJSONArray("entries").length());
 }

 /**
  * Two-phase forced crash. The runner first passes crashLogPhase=crash (this process dies with
  * the real default handler), then crashLogPhase=readback in a new process.
  */
 @Test public void realCrashSurvivesRestartAndShowsInSettings()throws Exception{
  String phase=InstrumentationRegistry.getArguments().getString("crashLogPhase");
  Assume.assumeTrue("Two-phase crash runner required","crash".equals(phase)||"readback".equals(phase));
  if("crash".equals(phase)){
   AlphaCrashLog.clear(context);
   new Thread(()->{throw new IllegalStateException(SECRET);},"forced-crash").start();
   SystemClock.sleep(10_000);fail("The process should have crashed");
  }
  JSONArray entries=AlphaCrashLog.read(context).getJSONArray("entries");
  JSONObject entry=last(entries,"uncaught");
  assertNotNull("Uncaught entry survived the process death",entry);
  assertEquals("java.lang.IllegalStateException",entry.getString("errorClass"));
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();
   js(AppNavigation.request("Settings"));until(AppNavigation.selected("Settings"));
   button("About");until("document.body.textContent.includes('recorded')");
   button("Problem log");until("document.body.textContent.includes('App crashed · java.lang.IllegalStateException')");
   if(android.os.Build.VERSION.SDK_INT>=30){
    AlphaCrashLog.collectExitReasons(context);
    assertNotNull("Android recorded the crash exit",last(AlphaCrashLog.read(context).getJSONArray("entries"),"exit"));
   }
   assertEquals("No content in Settings","false",js("document.body.textContent.includes('555-0100')"));
  }
 }
}
