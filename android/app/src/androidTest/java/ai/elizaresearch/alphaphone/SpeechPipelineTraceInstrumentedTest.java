package ai.elizaresearch.alphaphone;

import android.content.Context;
import android.net.ConnectivityManager;
import android.os.SystemClock;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.json.*;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 * Diagnostic acquisition only: do not substitute this for voice acceptance. Renders a fixed corpus
 * three times through the packaged fused engine (Java front end, Kokoro phrases), saves every
 * waveform with its IPA phrases and hash, and, when an ASR pair is packaged, transcribes each one
 * back with word edit counts. Modes: engine-warm (human ASR first) and engine-cold.
 */
public final class SpeechPipelineTraceInstrumentedTest {
 private static final String[] CORPUS={
  "The quick brown fox jumps over the lazy dog.",
  "The lady put the blue coat beside the door.",
  "Busy bees buzz around the roses.",
  "Daisy found an easy way to close the box.",
  "Please move my meeting from Tuesday to Thursday.",
  "Save a note about the blue train and the green boat.",
  "Set a reminder for seven thirty tomorrow morning.",
  "My calendar has four events and two reminders."
 };
 private static String[] words(String text){return text.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9' ]"," ").trim().split("\\s+");}
 private static int edits(String expected,String observed){String[] a=words(expected),b=words(observed);int[][] d=new int[a.length+1][b.length+1];for(int i=0;i<=a.length;i++)d[i][0]=i;for(int j=0;j<=b.length;j++)d[0][j]=j;for(int i=1;i<=a.length;i++)for(int j=1;j<=b.length;j++)d[i][j]=Math.min(Math.min(d[i-1][j]+1,d[i][j-1]+1),d[i-1][j-1]+(a[i-1].equals(b[j-1])?0:1));return d[a.length][b.length];}
 private static String sha(byte[] bytes)throws Exception{StringBuilder out=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))out.append(String.format(Locale.ROOT,"%02x",b&255));return out.toString();}
 private static void save(File dir,JSONObject report)throws Exception{try(Writer out=new OutputStreamWriter(new FileOutputStream(new File(dir,"comparison.json")),StandardCharsets.UTF_8)){out.write(report.toString(2));}}
 @Test public void tracePackagedSynthesisPipeline()throws Exception{
  org.junit.Assume.assumeTrue("Explicit offline diagnostic","1".equals(InstrumentationRegistry.getArguments().getString("speechPipelineTrace")));
  String mode=InstrumentationRegistry.getArguments().getString("speechPipelineMode","engine-warm");
  assertTrue(Arrays.asList("engine-cold","engine-warm").contains(mode));
  Context app=InstrumentationRegistry.getInstrumentation().getTargetContext();assertNull("Networking must be disabled",app.getSystemService(ConnectivityManager.class).getActiveNetwork());
  File dir=new File(app.getExternalFilesDir(null),"speech-pipeline-trace-"+mode+"-"+UUID.randomUUID());assertTrue(dir.mkdirs());
  JSONObject report=new JSONObject().put("diagnosticOnly",true).put("qualityAccepted",false).put("complete",false).put("mode",mode).put("engine",AlphaFusedSpeech.PROVIDER).put("runDirectory",dir.getName());
  JSONArray rows=new JSONArray();report.put("samples",rows);long allStart=SystemClock.elapsedRealtime();
  AlphaFusedSpeech engine=null;
  try{
   AlphaFusedSpeechAssets.Bundle bundle=AlphaFusedSpeechAssets.install(app);report.put("bundleManifestSha256",bundle.manifestSha256);
   AlphaKokoroG2p frontEnd=new AlphaKokoroG2p(bundle.file("lexicon"));
   engine=new AlphaFusedSpeech(bundle);boolean asr=engine.status().asr;report.put("asrPackaged",asr);
   if(mode.equals("engine-warm")&&asr){float[] human=FusedSpeechInstrumentedTest.human();report.put("humanTranscript",engine.transcribe(human,()->false));assertEquals("",engine.transcribe(new float[16000],()->false));}
   List<AlphaFusedSpeech.Audio> audioRows=new ArrayList<>();
   for(int round=0;round<3;round++)for(int index=0;index<CORPUS.length;index++){
    String input=CORPUS[index];long start=SystemClock.elapsedRealtime();AlphaFusedSpeech.Audio audio=engine.synthesize(input,()->false);
    long ttsMs=SystemClock.elapsedRealtime()-start;assertTrue(audio.samples.length>audio.sampleRate/10&&audio.samples.length<30*audio.sampleRate);
    byte[] wav=audio.wav();String name="r"+round+"-sentence"+index+".wav";try(OutputStream stream=new FileOutputStream(new File(dir,name))){stream.write(wav);}
    audioRows.add(audio);rows.put(new JSONObject().put("round",round).put("sentence",index).put("input",input).put("phrases",new JSONArray(frontEnd.phrases(input))).put("ttsMs",ttsMs).put("samples",audio.samples.length).put("sampleRate",audio.sampleRate).put("rms",FusedSpeechInstrumentedTest.rms(audio.samples)).put("peak",FusedSpeechInstrumentedTest.peak(audio.samples)).put("waveform",name).put("wavSha256",sha(wav)));save(dir,report);
   }
   if(asr)for(int i=0;i<audioRows.size();i++){long start=SystemClock.elapsedRealtime();String transcript=engine.transcribe(FusedSpeechInstrumentedTest.to16k(audioRows.get(i)),()->false);rows.getJSONObject(i).put("transcript",transcript).put("asrMs",SystemClock.elapsedRealtime()-start).put("wordEdits",edits(rows.getJSONObject(i).getString("input"),transcript));save(dir,report);}
   frontEnd.clear();
   assertEquals(24,rows.length());assertNull(app.getSystemService(ConnectivityManager.class).getActiveNetwork());report.put("complete",true);
  }finally{if(engine!=null)engine.close();report.put("elapsedMs",SystemClock.elapsedRealtime()-allStart);save(dir,report);android.util.Log.i("SpeechPipelineTrace",dir.getAbsolutePath());}
 }
}
