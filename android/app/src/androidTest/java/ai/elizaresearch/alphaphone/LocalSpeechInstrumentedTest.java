package ai.elizaresearch.alphaphone;

import ai.eliza.speech.*;
import android.content.Context;
import android.net.ConnectivityManager;
import android.os.Debug;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.util.*;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Native CPU models, real prerecorded human speech, synthesis-to-recognition, offline reopen.
 * This proves neither physical microphone capture nor speaker intelligibility to a listener. */
@RunWith(AndroidJUnit4.class)
public final class LocalSpeechInstrumentedTest {
 @Test public void nativeModelsTranscribeAndSynthesizeWithNoNetwork()throws Exception {
  org.junit.Assume.assumeTrue("Opt-in real local models required","1".equals(InstrumentationRegistry.getArguments().getString("localSpeech")));
  Context app=InstrumentationRegistry.getInstrumentation().getTargetContext();
  assertNull("Disable device networking before on-device acceptance",app.getSystemService(ConnectivityManager.class).getActiveNetwork());
  JSONObject evidence=new JSONObject();File folder=new File(app.getExternalFilesDir(null),"local-speech-evidence");assertTrue(folder.isDirectory()||folder.mkdirs());
  evidence.put("pass",false);
  try {
  long start=SystemClock.elapsedRealtime();File models=SpeechAssets.install(app);evidence.put("installMs",SystemClock.elapsedRealtime()-start);
  float[] human;try(InputStream in=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("speech-fixture/0.wav")){human=LocalSpeechEngine.readMono16kWav(in);}
  String transcript;
  start=SystemClock.elapsedRealtime();
  try(LocalSpeechEngine engine=new LocalSpeechEngine(models)){
   evidence.put("loadMs",SystemClock.elapsedRealtime()-start);start=SystemClock.elapsedRealtime();transcript=engine.transcribe(human);evidence.put("humanTranscript",transcript).put("asrMs",SystemClock.elapsedRealtime()-start).put("humanDurationMs",human.length/16);
   String lower=transcript.toLowerCase(Locale.ROOT);for(String word:new String[]{"nightfall","yellow","lamps","light","quarter"})assertTrue("Human recording transcript contains "+word,lower.contains(word));
   assertEquals("Digital silence creates no invented text","",engine.transcribe(new float[16000]));
   start=SystemClock.elapsedRealtime();LocalSpeechEngine.Audio audio=engine.synthesize("The quick brown fox jumps over the lazy dog.");evidence.put("ttsMs",SystemClock.elapsedRealtime()-start).put("ttsRate",audio.sampleRate).put("ttsSamples",audio.samples.length);
   byte[] wav=audio.wav();try(OutputStream out=new FileOutputStream(new File(folder,"synthesized.wav"))){out.write(wav);}
   float[] resampled=new float[(int)((long)audio.samples.length*16000/audio.sampleRate)];for(int i=0;i<resampled.length;i++){double position=(double)i*audio.sampleRate/16000;int left=Math.min((int)position,audio.samples.length-1),right=Math.min(left+1,audio.samples.length-1);resampled[i]=(float)(audio.samples[left]+(audio.samples[right]-audio.samples[left])*(position-left));}
   String roundtrip=engine.transcribe(resampled);evidence.put("synthesisTranscript",roundtrip);for(String word:new String[]{"quick","brown","fox","lazy","dog"})assertTrue("Synthesized speech recognizes "+word,roundtrip.toLowerCase(Locale.ROOT).contains(word));
   LocalSpeechEngine.Audio second=engine.synthesize("Your calendar is ready.");assertFalse("Distinct input must create distinct waveform",Arrays.equals(audio.samples,second.samples));
   LocalSpeechEngine.Audio unusual=engine.synthesize("Zorvexa has 42 notes!");
   try(OutputStream out=new FileOutputStream(new File(folder,"name-and-number.wav"))){out.write(unusual.wav());}
   evidence.put("nameAndNumberSamples",unusual.samples.length).put("nameAndNumberPolicy","Unknown English words spelled letter by letter; digits spoken individually");
   try{engine.synthesize("Read https://example.com");fail("Unsupported URL symbols must not disappear");}catch(IllegalArgumentException expected){}
   Debug.MemoryInfo memory=new Debug.MemoryInfo();Debug.getMemoryInfo(memory);evidence.put("processPssKb",memory.getTotalPss()).put("nativeHeapBytes",Debug.getNativeHeapAllocatedSize());
  }
  try(LocalSpeechEngine reopened=new LocalSpeechEngine(models)){assertEquals("Same speech survives engine close/reopen",transcript,reopened.transcribe(human));}
  assertNull("Networking remained unavailable",app.getSystemService(ConnectivityManager.class).getActiveNetwork());
  evidence.put("execution","android-process-cpu").put("pass",true).put("physicalMicrophoneVerified",false).put("physicalSpeakerVerified",false);
  } finally { try(Writer out=new FileWriter(new File(folder,"result.json"))){out.write(evidence.toString(2));} }
 }
 @Test public void modelHolderReusesAndReleasesOnItsWorker()throws Exception {
  org.junit.Assume.assumeTrue("Opt-in real local models required","1".equals(InstrumentationRegistry.getArguments().getString("localSpeech")));
  Context app=InstrumentationRegistry.getInstrumentation().getTargetContext();
  assertNull(app.getSystemService(ConnectivityManager.class).getActiveNetwork());
  File models=SpeechAssets.install(app),folder=new File(app.getExternalFilesDir(null),"local-speech-evidence");assertTrue(folder.isDirectory()||folder.mkdirs());
  float[] human;try(InputStream in=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("speech-fixture/0.wav")){human=LocalSpeechEngine.readMono16kWav(in);}
  java.util.concurrent.atomic.AtomicInteger loads=new java.util.concurrent.atomic.AtomicInteger();
  LocalSpeechEngineHolder holder=new LocalSpeechEngineHolder(()->{loads.incrementAndGet();return new LocalSpeechEngine(models);});
  java.util.concurrent.ExecutorService worker=java.util.concurrent.Executors.newSingleThreadExecutor();
  JSONObject evidence=new JSONObject().put("pass",false);
  try {
   String first=worker.submit(()->holder.use(engine->engine.transcribe(human))).get(120,java.util.concurrent.TimeUnit.SECONDS);
   long start=SystemClock.elapsedRealtime();String second=worker.submit(()->holder.use(engine->engine.transcribe(human))).get(120,java.util.concurrent.TimeUnit.SECONDS);
   evidence.put("warmAsrMs",SystemClock.elapsedRealtime()-start);assertEquals(first,second);assertEquals("Second request must reuse real model sessions",1,loads.get());
   worker.submit(holder::release).get(120,java.util.concurrent.TimeUnit.SECONDS);
   start=SystemClock.elapsedRealtime();String reopened=worker.submit(()->holder.use(engine->engine.transcribe(human))).get(120,java.util.concurrent.TimeUnit.SECONDS);
   evidence.put("releasedThenReopenedMs",SystemClock.elapsedRealtime()-start);assertEquals(first,reopened);assertEquals("Explicit release requires fresh model sessions",2,loads.get());
   worker.submit(holder::close).get(120,java.util.concurrent.TimeUnit.SECONDS);
   try{worker.submit(()->holder.use(engine->engine.transcribe(human))).get(120,java.util.concurrent.TimeUnit.SECONDS);fail("Closed holder must not reopen");}catch(java.util.concurrent.ExecutionException expected){assertTrue(expected.getCause() instanceof IllegalStateException);}
   assertNull(app.getSystemService(ConnectivityManager.class).getActiveNetwork());
   evidence.put("pass",true).put("actualModelLoads",loads.get()).put("execution","android-process-cpu").put("transcript",first);
  } finally {
   worker.submit(holder::close).get(120,java.util.concurrent.TimeUnit.SECONDS);worker.shutdown();
   Arrays.fill(human,0);try(Writer writer=new FileWriter(new File(folder,"holder-result.json"))){writer.write(evidence.toString(2));}
  }
 }

}
