package ai.elizaresearch.alphaphone;

import android.content.Context;
import java.io.IOException;

/**
 * The always-on listener's recognizer: the same fused libelizainference engine as Alpha
 * ({@link AlphaFusedSpeech}: Silero VAD, then the mtmd ASR pair), opened over the listener APK's own
 * copy of the qualified voice bundle. It needs recognition (ASR pair and VAD) only; a bundle without
 * them refuses to open, so the listener reports speech unavailable instead of listening.
 *
 * <p>Transcripts are returned to the caller and never stored. Not thread-safe across callers beyond
 * what {@link AlphaFusedSpeech} serializes; the listener uses it from one recognition thread.
 */
public final class ListenerSpeech implements AutoCloseable {
 private final AlphaFusedSpeech engine;
 private ListenerSpeech(AlphaFusedSpeech engine){this.engine=engine;}

 /** Installs and verifies the packaged bundle, loads the native engine and checks recognition is present. */
 public static ListenerSpeech open(Context context)throws Exception{
  AlphaFusedSpeech engine=AlphaFusedSpeech.open(context);
  try{
   AlphaFusedSpeech.Status status=engine.status();
   if(!status.asr||!status.vad)throw new IOException("On-device recognition is not packaged in the listener");
   return new ListenerSpeech(engine);
  }catch(Exception failed){engine.close();throw failed;}
 }

 /** Mono 16 kHz PCM in [-1, 1]; returns "" when voice activity detection finds no speech. */
 public String transcribe(float[] mono16k){return engine.transcribe(mono16k,null);}

 @Override public void close(){engine.close();}
}
