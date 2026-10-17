package ai.eliza.voicequalify;

import ai.eliza.voice.NativeAsr;
import ai.eliza.voice.ParadeeVoice;
import ai.eliza.voice.VoiceAssets;
import android.content.Context;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CancellationException;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Consumer qualification of the actual native callbacks, cancellation and ASR stream. */
public final class NativeVoiceStreamingQualification {
 @Test public void nativeStreamingCancellationAndRecovery() throws Exception {
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  VoiceAssets.Bundle bundle=VoiceAssets.install(context);
  String text="The quick brown fox jumps over the lazy dog.";
  JSONObject report=new JSONObject().put("device",Reports.device());
  try(ParadeeVoice voice=bundle.openVoice()) {
   assertTrue("Native TTS must stream",voice.supportsStreaming());
   List<float[]> chunks=new ArrayList<>();int[] finals={0};long began=System.nanoTime();long[] first={0};
   voice.synthesizeStream(text,1.0f,(pcm,complete)->{
    if(complete){assertEquals(0,pcm.length);finals[0]++;return true;}
    assertTrue(pcm.length>0&&pcm.length<=24000);assertEquals(0,finals[0]);
    if(first[0]==0)first[0]=System.nanoTime();
    for(float sample:pcm)assertTrue("PCM must be finite",Float.isFinite(sample));
    chunks.add(pcm.clone());assertTrue("Fixture output exceeded its expected duration",chunks.size()<64);return true;
   });
   long ended=System.nanoTime();assertEquals(1,finals[0]);assertFalse(chunks.isEmpty());
   int samples=0;for(float[] chunk:chunks)samples+=chunk.length;float[] pcm=new float[samples];int offset=0;
   for(float[] chunk:chunks){System.arraycopy(chunk,0,pcm,offset,chunk.length);offset+=chunk.length;}
   report.put("chunks",chunks.size()).put("samples",samples).put("finalCallbacks",finals[0]).put("firstChunkMs",(first[0]-began)/1000000.0).put("totalMs",(ended-began)/1000000.0);
   int[] cancelledChunks={0},cancelledFinals={0};boolean cancelled=false;
   try{voice.synthesizeStream(text+" "+text,1.0f,(part,complete)->{if(complete)cancelledFinals[0]++;else{cancelledChunks[0]++;voice.cancel();}return true;});}
   catch(CancellationException expected){cancelled=true;}
   assertTrue("Cancellation must be reported",cancelled);assertEquals(1,cancelledChunks[0]);assertEquals(0,cancelledFinals[0]);
   int[] recovered={0};voice.synthesizeStream("Hello again.",1.0f,(part,complete)->{if(complete)recovered[0]++;return true;});assertEquals(1,recovered[0]);
   report.put("cancelledChunks",cancelledChunks[0]).put("cancelledFinalCallbacks",cancelledFinals[0]).put("recoveredFinalCallbacks",recovered[0]);
   try(NativeAsr asr=bundle.openAsr()) {
    assertTrue("Native ASR must stream",asr.supportsStreaming());float[] input=Wer.resample(pcm,voice.sampleRate(),16000);String heard;
    try(NativeAsr.Stream stream=asr.openStream(16000)){
     for(int i=0;i<input.length;i+=3200)stream.feed(Arrays.copyOfRange(input,i,Math.min(i+3200,input.length)));
     heard=stream.finish();
    }
    int[] errors=Wer.wordErrors(text,heard);double wer=errors[1]==0?1:errors[0]/(double)errors[1];assertTrue("Native ASR stream WER="+wer,wer<=Wer.TTS_ROUND_TRIP_MAX_WER);
    report.put("streamHeard",heard).put("streamWords",errors[1]).put("streamEdits",errors[0]).put("streamWer",wer);
   }
  }
  report.put("pass",true);Reports.write(context,"native-streaming.json",report);Reports.status("native-streaming",report.toString());
 }
}
