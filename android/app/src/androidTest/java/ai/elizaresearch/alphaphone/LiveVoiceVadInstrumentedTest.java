package ai.elizaresearch.alphaphone;

import ai.eliza.voice.VoiceAssets;
import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.InputStream;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/**
 * Live voice VAD in the app process: Silero VAD through libelizainference (ElizaVoiceNative) on the
 * packaged bundle, gated by LiveVadGate as AlphaLiveVoiceCapture does. Opt-in with
 * -e localSpeech 1 on an APK that packages the voice bundle and the app JNI bridge. It does not
 * open the microphone, does not call the agent and proves nothing about physical capture.
 */
@RunWith(AndroidJUnit4.class)
public final class LiveVoiceVadInstrumentedTest {
 @Test public void sileroVadOpensOneSegmentOnRecordedSpeechAndNoneOnSilence()throws Exception{
  org.junit.Assume.assumeTrue("Opt-in real local models required","1".equals(InstrumentationRegistry.getArguments().getString("localSpeech")));
  Context app=InstrumentationRegistry.getInstrumentation().getTargetContext();
  VoiceAssets.Bundle bundle=VoiceAssets.install(app);
  assertTrue("the bundle carries Silero VAD",new java.io.File(bundle.root,"vad/silero-vad-v5.gguf").isFile());
  assertTrue("VAD is usable in the app process",AlphaLiveVoiceCapture.vadAvailable(app));
  assertTrue(ElizaVoiceNative.ensureLoaded());
  long context=ElizaVoiceNative.nativeContextCreate(bundle.root.getAbsolutePath());
  assertNotEquals(0,context);
  long vad=ElizaVoiceNative.nativeVadOpen(context);
  try{
   assertEquals("digital silence opens no segment",0,segments(vad,new float[16000*2]));
   float[] human;try(InputStream in=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("speech-fixture/0.wav")){human=AlphaLocalSpeechEngine.readMono16kWav(in);}
   float[] padded=new float[human.length+16000*2];System.arraycopy(human,0,padded,0,human.length);
   assertTrue("recorded speech opens a segment that closes in the trailing silence",segments(vad,padded)>=1);
  }finally{ElizaVoiceNative.nativeVadClose(vad);ElizaVoiceNative.nativeContextDestroy(context);}
 }
 private static int segments(long vad,float[] pcm){
  ElizaVoiceNative.nativeVadReset(vad);
  LiveVadGate gate=new LiveVadGate();int closed=0;
  int windows=pcm.length/LiveVadGate.WINDOW;float[] batch=new float[windows*LiveVadGate.WINDOW];System.arraycopy(pcm,0,batch,0,batch.length);
  float[] probabilities=ElizaVoiceNative.nativeVadProcessBatch(vad,batch);
  assertEquals(windows,probabilities.length);
  for(float probability:probabilities)if(gate.accept(probability)==LiveVadGate.Edge.SPEECH_END)closed++;
  return closed;
 }
}
