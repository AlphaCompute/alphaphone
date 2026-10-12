package ai.elizaresearch.alphaphone;

import android.content.Context;
import android.net.ConnectivityManager;
import android.os.Debug;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONObject;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/**
 * On-device speech through the packaged fused libelizainference engine: real prerecorded human
 * speech (speech-fixture/0.wav), Kokoro synthesis bounds, synthesis-to-recognition, VAD, release
 * and offline reopen. Opt-in with -e localSpeech 1 and networking disabled.
 *
 * <p>This proves neither physical microphone capture nor speaker intelligibility to a listener.
 * Kokoro RMS and peak bounds are diagnostic only. The ASR methods are skipped (and the suite then
 * fails in the runner) while no qualified ASR pair is packaged.
 */
@RunWith(AndroidJUnit4.class)
public final class FusedSpeechInstrumentedTest {
 private static Context app(){return InstrumentationRegistry.getInstrumentation().getTargetContext();}
 private static void requireOffline(){
  Assume.assumeTrue("Opt-in packaged on-device voice required","1".equals(InstrumentationRegistry.getArguments().getString("localSpeech")));
  assertNull("Disable device networking before on-device acceptance",app().getSystemService(ConnectivityManager.class).getActiveNetwork());
 }
 private static File evidenceFolder(){File folder=new File(app().getExternalFilesDir(null),"fused-speech-evidence");assertTrue(folder.isDirectory()||folder.mkdirs());return folder;}
 private static void write(File file,JSONObject value)throws Exception{try(Writer out=new FileWriter(file)){out.write(value.toString(2));}}
 static float[] human()throws IOException{try(InputStream in=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("speech-fixture/0.wav")){return AlphaSpeechText.readMono16kWav(in);}}
 static float[] to16k(AlphaFusedSpeech.Audio audio){float[] out=new float[(int)((long)audio.samples.length*16000/audio.sampleRate)];for(int i=0;i<out.length;i++){double position=(double)i*audio.sampleRate/16000;int left=Math.min((int)position,audio.samples.length-1),right=Math.min(left+1,audio.samples.length-1);out[i]=(float)(audio.samples[left]+(audio.samples[right]-audio.samples[left])*(position-left));}return out;}
 static double rms(float[] samples){double sum=0;for(float s:samples)sum+=(double)s*s;return Math.sqrt(sum/Math.max(1,samples.length));}
 static double peak(float[] samples){double max=0;for(float s:samples)max=Math.max(max,Math.abs(s));return max;}

 @Test public void kokoroSynthesizesBoundedSpeechOffline()throws Exception{
  requireOffline();
  JSONObject evidence=new JSONObject().put("pass",false).put("engine",AlphaFusedSpeech.PROVIDER);
  try{
   long start=SystemClock.elapsedRealtime();AlphaFusedSpeechAssets.Bundle bundle=AlphaFusedSpeechAssets.install(app());evidence.put("installMs",SystemClock.elapsedRealtime()-start);
   start=SystemClock.elapsedRealtime();
   try(AlphaFusedSpeech engine=new AlphaFusedSpeech(bundle)){
    AlphaFusedSpeech.Status status=engine.status();evidence.put("openMs",SystemClock.elapsedRealtime()-start).put("abi",status.abi).put("asr",status.asr).put("tts",status.tts).put("vad",status.vad);
    assertTrue("ABI is at least 16",status.abi>=AlphaFusedSpeech.ABI_MIN);assertTrue("Kokoro voice is packaged",status.tts);
    start=SystemClock.elapsedRealtime();AlphaFusedSpeech.Audio audio=engine.synthesize("The quick brown fox jumps over the lazy dog.",()->false);
    evidence.put("ttsMs",SystemClock.elapsedRealtime()-start).put("ttsRate",audio.sampleRate).put("ttsSamples",audio.samples.length).put("rms",rms(audio.samples)).put("peak",peak(audio.samples));
    assertEquals("Kokoro v1.0 renders 24 kHz",24000,audio.sampleRate);
    assertTrue("At least one second for nine words",audio.samples.length>=audio.sampleRate);assertTrue("Bounded duration",audio.samples.length<=audio.sampleRate*15);
    assertTrue("Audible RMS",rms(audio.samples)>0.005);assertTrue("Unclipped peak",peak(audio.samples)<=1.0&&peak(audio.samples)>0.05);
    try(OutputStream out=new FileOutputStream(new File(evidenceFolder(),"synthesized.wav"))){out.write(audio.wav());}
    AlphaFusedSpeech.Audio second=engine.synthesize("Your calendar is ready.",()->false);assertFalse("Distinct input must create a distinct waveform",Arrays.equals(audio.samples,second.samples));
    AlphaFusedSpeech.Audio unusual=engine.synthesize("Zorvexa has 42 notes!",()->false);
    try(OutputStream out=new FileOutputStream(new File(evidenceFolder(),"name-and-number.wav"))){out.write(unusual.wav());}
    evidence.put("nameAndNumberSamples",unusual.samples.length).put("nameAndNumberPolicy","Unknown English words spelled letter by letter; numbers read as English cardinals");
    try{engine.synthesize("Read https://example.com",()->false);fail("Unsupported URL symbols must not disappear");}catch(IllegalArgumentException expected){}
    byte[] passage=engine.synthesizePassage("Groceries. Milk and eggs. Call the bank before noon, then walk the dog.",()->false);
    assertEquals("RIFF",new String(passage,0,4,java.nio.charset.StandardCharsets.US_ASCII));assertTrue(passage.length>44+24000);
    Debug.MemoryInfo memory=new Debug.MemoryInfo();Debug.getMemoryInfo(memory);evidence.put("processPssKb",memory.getTotalPss()).put("nativeHeapBytes",Debug.getNativeHeapAllocatedSize());
   }
   assertNull("Networking remained unavailable",app().getSystemService(ConnectivityManager.class).getActiveNetwork());
   evidence.put("execution","android-process-cpu").put("pass",true).put("physicalSpeakerVerified",false).put("intelligibilityQualified",false);
  }finally{write(new File(evidenceFolder(),"tts-result.json"),evidence);}
 }

 @Test public void vadSeparatesSilenceFromHumanSpeech()throws Exception{
  requireOffline();
  try(AlphaFusedSpeech engine=new AlphaFusedSpeech(AlphaFusedSpeechAssets.install(app()))){
   Assume.assumeTrue("Silero VAD packaged",engine.status().vad);
   float[] human=human();
   float speech=engine.maxSpeechProbability(human),silence=engine.maxSpeechProbability(new float[16000]);
   write(new File(evidenceFolder(),"vad-result.json"),new JSONObject().put("humanMaxProbability",speech).put("silenceMaxProbability",silence).put("threshold",AlphaFusedSpeech.NO_SPEECH_THRESHOLD));
   assertTrue("Human speech crosses the no-speech threshold",speech>=AlphaFusedSpeech.NO_SPEECH_THRESHOLD);
   assertTrue("Digital silence stays below it",silence<AlphaFusedSpeech.NO_SPEECH_THRESHOLD);
   Arrays.fill(human,0);
  }
 }

 @Test public void fusedAsrTranscribesHumanSpeechAndSynthesizedSpeech()throws Exception{
  requireOffline();
  JSONObject evidence=new JSONObject().put("pass",false);
  try{
   AlphaFusedSpeechAssets.Bundle bundle=AlphaFusedSpeechAssets.install(app());
   Assume.assumeTrue("A qualified ASR pair must be packaged",bundle.has("asr-model")&&bundle.has("asr-mmproj"));
   float[] human=human();String transcript;
   try(AlphaFusedSpeech engine=new AlphaFusedSpeech(bundle)){
    long start=SystemClock.elapsedRealtime();transcript=engine.transcribe(human,()->false);evidence.put("humanTranscript",transcript).put("asrMs",SystemClock.elapsedRealtime()-start).put("humanDurationMs",human.length/16);
    String lower=transcript.toLowerCase(Locale.ROOT);for(String word:new String[]{"nightfall","yellow","lamps","light","quarter"})assertTrue("Human recording transcript contains "+word,lower.contains(word));
    assertEquals("Digital silence creates no invented text","",engine.transcribe(new float[16000],()->false));
    AlphaFusedSpeech.Audio audio=engine.synthesize("The quick brown fox jumps over the lazy dog.",()->false);
    String roundtrip=engine.transcribe(to16k(audio),()->false);evidence.put("synthesisTranscript",roundtrip);
    for(String word:new String[]{"quick","brown","fox","lazy","dog"})assertTrue("Synthesized speech recognizes "+word,roundtrip.toLowerCase(Locale.ROOT).contains(word));
    try{engine.transcribe(human,()->true);fail("A cancelled transcription is discarded");}catch(CancellationException expected){}
   }
   try(AlphaFusedSpeech reopened=new AlphaFusedSpeech(AlphaFusedSpeechAssets.install(app()))){assertEquals("Same speech survives engine close and reopen",transcript,reopened.transcribe(human,()->false));}
   assertNull("Networking remained unavailable",app().getSystemService(ConnectivityManager.class).getActiveNetwork());
   evidence.put("execution","android-process-cpu").put("pass",true).put("physicalMicrophoneVerified",false);
  }finally{write(new File(evidenceFolder(),"asr-result.json"),evidence);}
 }

 @Test public void holderReusesAndReleasesOnItsWorker()throws Exception{
  requireOffline();
  AlphaFusedSpeechAssets.Bundle bundle=AlphaFusedSpeechAssets.install(app());
  AtomicInteger opens=new AtomicInteger();
  AlphaFusedSpeech.Holder holder=new AlphaFusedSpeech.Holder(()->{opens.incrementAndGet();return new AlphaFusedSpeech(bundle);});
  ExecutorService worker=Executors.newSingleThreadExecutor();
  JSONObject evidence=new JSONObject().put("pass",false);
  try{
   int first=worker.submit(()->holder.use(engine->engine.synthesize("Ready.",()->false).samples.length)).get(120,TimeUnit.SECONDS);
   long start=SystemClock.elapsedRealtime();int second=worker.submit(()->holder.use(engine->engine.synthesize("Ready.",()->false).samples.length)).get(120,TimeUnit.SECONDS);
   evidence.put("warmTtsMs",SystemClock.elapsedRealtime()-start);assertEquals("Deterministic length for the same text",first,second);assertEquals("Second request reuses the context",1,opens.get());
   worker.submit(holder::release).get(120,TimeUnit.SECONDS);
   start=SystemClock.elapsedRealtime();int reopened=worker.submit(()->holder.use(engine->engine.synthesize("Ready.",()->false).samples.length)).get(120,TimeUnit.SECONDS);
   evidence.put("releasedThenReopenedMs",SystemClock.elapsedRealtime()-start);assertEquals(first,reopened);assertEquals("Release requires a fresh context",2,opens.get());
   worker.submit(holder::close).get(120,TimeUnit.SECONDS);
   try{worker.submit(()->holder.use(AlphaFusedSpeech::status)).get(120,TimeUnit.SECONDS);fail("Closed holder must not reopen");}catch(ExecutionException expected){assertTrue(expected.getCause() instanceof IllegalStateException);}
   assertNull(app().getSystemService(ConnectivityManager.class).getActiveNetwork());
   evidence.put("pass",true).put("actualContextOpens",opens.get()).put("execution","android-process-cpu");
  }finally{worker.submit(holder::close).get(120,TimeUnit.SECONDS);worker.shutdown();write(new File(evidenceFolder(),"holder-result.json"),evidence);}
 }
}
