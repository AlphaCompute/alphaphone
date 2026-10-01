package ai.elizaresearch.alphaphone;

import android.content.Context;
import android.net.ConnectivityManager;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.runner.lifecycle.*;
import java.io.*;
import java.lang.reflect.Field;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Actual offline Capacitor submitLocal -> packaged CPU models -> native playback; fixture audio only. */
@RunWith(AndroidJUnit4.class)
public final class LocalSpeechBridgeInstrumentedTest {
 private static void until(String expression,long timeout)throws Exception {long end=SystemClock.elapsedRealtime()+timeout;while(SystemClock.elapsedRealtime()<end){if("true".equals(WebViewTestDriver.evaluate("Boolean("+expression+")")))return;SystemClock.sleep(50);}fail("Local bridge condition timed out");}
 private static JSONObject call(String expression)throws Exception {
  WebViewTestDriver.evaluate("window.__localBridgeResult=null;Promise.resolve("+expression+").then(v=>window.__localBridgeResult=JSON.stringify(v||{}),()=>window.__localBridgeResult=JSON.stringify({error:true}))");
  until("window.__localBridgeResult!==null",150000);
  return new JSONObject((String)new JSONTokener(WebViewTestDriver.evaluate("window.__localBridgeResult")).nextValue());
 }
 private static AlphaVoiceCloudPlugin plugin()throws Exception {AtomicReference<AlphaVoiceCloudPlugin> value=new AtomicReference<>();BoundedActivityScenario.main(()->{for(android.app.Activity a:ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED))if(a instanceof MainActivity)value.set((AlphaVoiceCloudPlugin)((MainActivity)a).getBridge().getPlugin("AlphaVoiceCloud").getInstance());});assertNotNull(value.get());return value.get();}
 private static Field field(Class<?> c,String name)throws Exception {Field f=c.getDeclaredField(name);f.setAccessible(true);return f;}
 private static boolean draining(AlphaVoiceCloudPlugin plugin,java.util.Map<?,?> pending)throws Exception {synchronized(pending){return field(AlphaVoiceCloudPlugin.class,"draining").getBoolean(plugin);}}
 private static JSONObject ready(String id)throws Exception {JSONObject r=call("Capacitor.Plugins.AlphaVoiceCloud.localSpeechStatus({requestId:"+JSONObject.quote(id)+"})");assertFalse("Local status must succeed",r.has("error"));assertTrue(r.getBoolean("ready"));assertEquals("device",r.getString("execution"));assertEquals("sherpa-onnx-cpu",r.getString("provider"));return r;}
 @Test public void offlineLocalBridgeTranscribesSynthesizesPlaysAndRecoversCancellation()throws Exception {
  Assume.assumeTrue("Explicit packaged local bridge opt-in","1".equals(InstrumentationRegistry.getArguments().getString("localSpeechBridge")));
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();assertNull("Networking must be disabled",context.getSystemService(ConnectivityManager.class).getActiveNetwork());
  File audio=File.createTempFile("local-bridge-fixture-",".m4a",context.getCacheDir());String clip=UUID.randomUUID().toString();
  try(InputStream in=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("speech-fixture/0-recorder.m4a");OutputStream out=new FileOutputStream(audio)){byte[] bytes=new byte[8192];int n;while((n=in.read(bytes))!=-1)out.write(bytes,0,n);}
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
  // Production capture is mono16k AAC. Raw PCM WAV is not an accepted recorder draft.
  android.media.MediaExtractor fixture=new android.media.MediaExtractor();
  try{fixture.setDataSource(audio.getAbsolutePath());assertEquals("One recorder audio track",1,fixture.getTrackCount());android.media.MediaFormat format=fixture.getTrackFormat(0);assertEquals("audio/mp4a-latm",format.getString(android.media.MediaFormat.KEY_MIME));assertEquals(16000,format.getInteger(android.media.MediaFormat.KEY_SAMPLE_RATE));assertEquals(1,format.getInteger(android.media.MediaFormat.KEY_CHANNEL_COUNT));}finally{fixture.release();}
   until("window.Capacitor?.Plugins?.AlphaVoiceCloud&&document.querySelector('.os')",30000);
   try {
    assertFalse(call("Capacitor.Plugins.AlphaVoiceCloud.cancelRecording()").has("error"));ready("bridge-ready");
    AlphaVoiceCloudPlugin nativePlugin=plugin();Object capture=field(AlphaVoiceCloudPlugin.class,"capture").get(nativePlugin);
    BoundedActivityScenario.main(()->{try{field(capture.getClass(),"file").set(capture,audio);field(capture.getClass(),"id").set(capture,clip);field(capture.getClass(),"durationMs").set(capture,6625L);}catch(Exception e){throw new RuntimeException(e);}});
    JSONObject text=call("Capacitor.Plugins.AlphaVoiceCloud.transcribeLocalRecording({recordingId:"+JSONObject.quote(clip)+",requestId:'bridge-asr'})");
    assertFalse("Actual local transcription succeeds",text.has("error"));assertTrue(text.getBoolean("local"));assertEquals("device",text.getString("execution"));assertEquals("sherpa-onnx-cpu",text.getString("provider"));
    String lower=text.getString("text").toLowerCase(Locale.ROOT);for(String word:new String[]{"nightfall","yellow","lamps","light","quarter"})assertTrue("Known human fixture contains "+word,lower.contains(word));
    WebViewTestDriver.evaluate("window.__localBridgeEnded=[];window.__localBridgeFailed=[];window.__localBridgeListeners=null;Promise.all([Capacitor.Plugins.AlphaVoiceCloud.addListener('playbackEnded',v=>window.__localBridgeEnded.push(v.playbackId)),Capacitor.Plugins.AlphaVoiceCloud.addListener('playbackFailed',v=>window.__localBridgeFailed.push(v.playbackId))]).then(h=>window.__localBridgeListeners=h)");until("window.__localBridgeListeners!==null",10000);
    JSONObject speech=call("Capacitor.Plugins.AlphaVoiceCloud.synthesizeLocal({text:'The quick brown fox jumps over the lazy dog.',requestId:'bridge-tts'})");assertFalse(speech.has("error"));assertEquals("device",speech.getString("execution"));String first=speech.getString("playbackId");
    assertFalse(call("Capacitor.Plugins.AlphaVoiceCloud.play({playbackId:"+JSONObject.quote(first)+"})").has("error"));until("window.__localBridgeEnded.includes("+JSONObject.quote(first)+")",30000);assertEquals("0",WebViewTestDriver.evaluate("window.__localBridgeFailed.length"));
    speech=call("Capacitor.Plugins.AlphaVoiceCloud.synthesizeLocal({text:'The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog.',requestId:'bridge-tts-stop'})");assertFalse(speech.has("error"));String second=speech.getString("playbackId");assertNotEquals(first,second);
    assertFalse(call("Capacitor.Plugins.AlphaVoiceCloud.play({playbackId:"+JSONObject.quote(second)+"})").has("error"));assertFalse(call("Capacitor.Plugins.AlphaVoiceCloud.stopPlayback()").has("error"));SystemClock.sleep(250);assertEquals("false",WebViewTestDriver.evaluate("window.__localBridgeEnded.includes("+JSONObject.quote(second)+")"));assertTrue(call("Capacitor.Plugins.AlphaVoiceCloud.play({playbackId:"+JSONObject.quote(second)+"})").has("error"));
    // Queue a real local request behind a controlled executor gate, then cancel it before inference.
    // No model output or bridge response is substituted; this deterministically exercises drain ordering.
    ExecutorService workers=(ExecutorService)field(AlphaVoiceCloudPlugin.class,"workers").get(nativePlugin);CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);
    Future<?> gate=workers.submit(()->{entered.countDown();try{if(!release.await(20,TimeUnit.SECONDS))throw new AssertionError("Gate timeout");}catch(InterruptedException e){Thread.currentThread().interrupt();throw new AssertionError(e);}});
    try {
     assertTrue(entered.await(5,TimeUnit.SECONDS));
     WebViewTestDriver.evaluate("window.__localBridgeCancelled=null;window.__localBridgeDrain=null;Capacitor.Plugins.AlphaVoiceCloud.localSpeechStatus({requestId:'bridge-cancel'}).then(()=>window.__localBridgeCancelled='unexpected-success',()=>window.__localBridgeCancelled='rejected')");
     long end=SystemClock.elapsedRealtime()+5000;java.util.Map<?,?> pending=(java.util.Map<?,?>)field(AlphaVoiceCloudPlugin.class,"pending").get(nativePlugin);while(!pending.containsKey("bridge-cancel")&&SystemClock.elapsedRealtime()<end)SystemClock.sleep(10);assertTrue("Actual request admitted",pending.containsKey("bridge-cancel"));
     WebViewTestDriver.evaluate("Capacitor.Plugins.AlphaVoiceCloud.cancelRecording().then(()=>window.__localBridgeDrain='resolved',()=>window.__localBridgeDrain='rejected')");
     end=SystemClock.elapsedRealtime()+5000;while(!draining(nativePlugin,pending)&&SystemClock.elapsedRealtime()<end)SystemClock.sleep(10);assertTrue("Cancellation entered drain",draining(nativePlugin,pending));assertEquals("null",WebViewTestDriver.evaluate("window.__localBridgeDrain"));
    }finally{release.countDown();gate.get(5,TimeUnit.SECONDS);}
    until("window.__localBridgeDrain==='resolved'&&window.__localBridgeCancelled==='rejected'",15000);ready("bridge-recovered");assertEquals("0",WebViewTestDriver.evaluate("window.__localBridgeFailed.length"));
   }finally{call("Capacitor.Plugins.AlphaVoiceCloud.cancelRecording()");call("Capacitor.Plugins.AlphaVoiceCloud.stopPlayback()");WebViewTestDriver.evaluate("window.__localBridgeListeners?.forEach(h=>h.remove());delete window.__localBridgeListeners;delete window.__localBridgeEnded;delete window.__localBridgeFailed;delete window.__localBridgeResult;delete window.__localBridgeDrain;delete window.__localBridgeCancelled;");}
  }finally{audio.delete();}
 }
}
