package ai.elizaresearch.alphaphone;

/**
 * Speech segment edges from Silero VAD probabilities (one per 512-sample window at 16 kHz, 32 ms).
 * Pure state: AlphaLiveVoiceCapture feeds it the libelizainference VAD output and forwards the
 * edges with the audio to the agent's live ASR route.
 *
 * <p>A segment opens after {@link #START_WINDOWS} consecutive windows at or above {@link #START}
 * and closes after {@link #END_WINDOWS} consecutive windows below {@link #END} (about 512 ms of
 * trailing silence, the latency budget of a spoken turn). While a segment is closed, the last
 * {@link #PREROLL_WINDOWS} windows are kept so the opening syllable reaches the decoder.
 */
final class LiveVadGate {
 static final int WINDOW = 512;
 static final float START = 0.5f, END = 0.35f;
 static final int START_WINDOWS = 2, END_WINDOWS = 16, PREROLL_WINDOWS = 10;
 /** No edge, segment opened (at this window minus the start run), segment closed. */
 enum Edge { NONE, SPEECH_START, SPEECH_END }
 private boolean speaking;
 private int above, below;
 boolean speaking(){return speaking;}
 Edge accept(float probability){
  if(!Float.isFinite(probability))probability=0f;
  if(!speaking){
   above=probability>=START?above+1:0;
   if(above>=START_WINDOWS){speaking=true;above=0;below=0;return Edge.SPEECH_START;}
   return Edge.NONE;
  }
  below=probability<END?below+1:0;
  if(below>=END_WINDOWS){speaking=false;below=0;above=0;return Edge.SPEECH_END;}
  return Edge.NONE;
 }
 /** End an open segment now (capture stopped while speaking). */
 boolean close(){boolean was=speaking;speaking=false;above=0;below=0;return was;}
}
