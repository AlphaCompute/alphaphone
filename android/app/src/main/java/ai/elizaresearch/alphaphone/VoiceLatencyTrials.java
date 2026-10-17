package ai.elizaresearch.alphaphone;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/**
 * Voice-assistant latency trials on one monotonic clock (issue #395): from the end of the last
 * captured speech sample to the first audible sample of the spoken response. Pure state, no
 * Android types, so the host JVM can check it; {@link AlphaVoiceLatencyProbe} feeds it the
 * AudioRecord, VAD and playback timestamps.
 *
 * <p>Every mark is nanoseconds of CLOCK_MONOTONIC (System.nanoTime on Android, which is also the
 * time base of AudioTimestamp.TIMEBASE_MONOTONIC and MediaTimestamp). A trial opens when the VAD
 * closes a speech segment and holds:
 * <ul>
 * <li>{@code last-user-audio}: capture time of the last sample of the last window the gate still
 *     counted as speech (Silero P at or above {@link LiveVadGate#END});</li>
 * <li>{@code endpoint}: when the gate decided the turn ended (about 512 ms of trailing silence);</li>
 * <li>{@code asr-final}, {@code request}, {@code first-token}: the final transcript, the agent turn
 *     dispatched and the first streamed reply token, stamped when the renderer reports them over the
 *     bridge (AlphaVoiceCloudPlugin.markVoiceTurn), so they include the bridge hop;</li>
 * <li>{@code tts-start}, {@code tts-ready}: synthesis began, and its first PCM (streamed) or whole
 *     sentence (non-streaming engines) was ready. Stage marks are diagnostic only, never summed;</li>
 * <li>{@code first-pcm}: the response PCM was handed to the platform player (first AudioTrack write
 *     for streamed speech, MediaPlayer.start otherwise);</li>
 * <li>{@code audible-playback}: the platform's presentation time of the first non-silent response
 *     sample. This is the output pipeline's own estimate, not an acoustic measurement.</li>
 * </ul>
 * Every trial carries a random {@code turnId} that links these stages across capture, the renderer's
 * agent turn and playback: the renderer echoes it on later marks and on the reply's synthesis, so a
 * stage or reply can only attach to the turn it belongs to.
 * The result is {@code audible-playback - last-user-audio}, and includes end-of-turn detection,
 * recognition, the reply, synthesis and playback buffering.
 *
 * <p>Outcomes: {@code passed} (audible reached), {@code failed} (playback started and no audible
 * time could be established, or the player failed), {@code abandoned} (no response playback followed
 * the turn: superseded by the next turn or none within {@link #PENDING_LIMIT_NS}). Numbers and
 * fixed labels only: no audio, text or identifiers beyond a per-process sequence.
 */
final class VoiceLatencyTrials {
 static final String[] MARKS={"last-user-audio","endpoint","asr-final","request","first-token","tts-start","tts-ready","first-pcm","audible-playback"};
 static final int LAST_USER_AUDIO=0,ENDPOINT=1,TTS_START=5,FIRST_PCM=7,AUDIBLE=8;
 /** Stages the renderer reports over the bridge. */
 static final String[] RENDERER_STAGES={"asr-final","request","first-token"};
 static final long PENDING_LIMIT_NS=120_000_000_000L;
 static final int MAX_RECORDS=512;
 static final long UNSET=Long.MIN_VALUE;
 interface Clock { long nanos(); }

 static final class Trial {
  final long sequence;
  /** Random per-turn link between capture, the agent turn and playback; no other meaning. */
  final String turnId=java.util.UUID.randomUUID().toString();
  final String pipeline,captureClock;
  final long[] marks=new long[MARKS.length];
  boolean cold;
  String coldReason,outcome,reason,audibleClock,network,thermal;
  float thermalHeadroom=Float.NaN;
  /** An earlier turn's reply was still being produced when this turn ended: its playback cannot be attributed. */
  boolean overlapped;
  Trial(long sequence,String pipeline,String captureClock){this.sequence=sequence;this.pipeline=pipeline;this.captureClock=captureClock;java.util.Arrays.fill(marks,UNSET);}
  long mark(String name){int index=index(name);return index<0?UNSET:marks[index];}
  /** audible - last user audio in ms, or NaN. */
  double latencyMs(){return marks[AUDIBLE]==UNSET?Double.NaN:(marks[AUDIBLE]-marks[LAST_USER_AUDIO])/1e6;}
 }

 /** CLOCK_MONOTONIC time of {@code frame} from a platform (frame, time) anchor at {@code rate} Hz. */
 static long frameTimeNs(long anchorNs,long anchorFrame,long frame,int rate){return anchorNs+(frame-anchorFrame)*1_000_000_000L/rate;}
 /**
  * Presentation time of media time {@code mediaUs} from a player anchor: the anchor system time plus
  * the media distance scaled by the playback clock rate.
  */
 static long presentationNs(long anchorNs,long anchorMediaUs,long mediaUs,float clockRate){return anchorNs+(long)((mediaUs-anchorMediaUs)*1000.0/clockRate);}

 static int index(String name){for(int i=0;i<MARKS.length;i++)if(MARKS[i].equals(name))return i;return -1;}

 private final Clock clock;
 private final ArrayDeque<Trial> finished=new ArrayDeque<>();
 private Trial pending;
 private long sequence;
 private boolean processFirstTurn=true;
 private int dropped;

 VoiceLatencyTrials(Clock clock){this.clock=clock;}

 /**
  * A VAD segment closed. {@code lastSpeechNs} must not be later than {@code endpointNs}. An older
  * turn with no reply in progress is abandoned as superseded (a cold flag it never used carries
  * over); one whose reply was already being synthesized or played fails, and the new turn is
  * marked overlapped because the next playback cannot be attributed to it.
  */
 synchronized Trial speechEnded(long lastSpeechNs,long endpointNs,String captureClock,String pipeline){
  expire();
  if(lastSpeechNs==UNSET||endpointNs==UNSET||lastSpeechNs>endpointNs)return null;
  Trial trial=new Trial(++sequence,pipeline,captureClock);
  trial.marks[LAST_USER_AUDIO]=lastSpeechNs;trial.marks[ENDPOINT]=endpointNs;
  if(pending!=null){
   Trial previous=pending;
   boolean replying=previous.marks[TTS_START]!=UNSET||previous.marks[FIRST_PCM]!=UNSET;
   if(replying){finish(previous,"failed","superseded-during-reply");trial.overlapped=true;}
   else{finish(previous,"abandoned","superseded");if(previous.cold){trial.cold=true;trial.coldReason=previous.coldReason;}}
  }
  if(processFirstTurn){trial.cold=true;if(trial.coldReason==null)trial.coldReason="process-first-turn";processFirstTurn=false;}
  pending=trial;return trial;
 }
 /** The open turn, or null. */
 synchronized Trial pending(){expire();return pending;}
 /** The open turn when its id is {@code turnId}; null for a stale, unknown or missing id. */
 synchronized Trial forTurn(String turnId){expire();return pending!=null&&turnId!=null&&pending.turnId.equals(turnId)?pending:null;}
 static boolean rendererStage(String name){for(String stage:RENDERER_STAGES)if(stage.equals(name))return true;return false;}
 /** Stamps a stage mark on its admitted turn once; stale owners and out-of-order stamps are ignored. */
 synchronized boolean mark(Trial owner,String name,long at){
  expire();int index=index(name);
  if(owner==null||owner!=pending||index<=ENDPOINT||index>=FIRST_PCM||pending.marks[index]!=UNSET||at<pending.marks[ENDPOINT])return false;
  for(int i=0;i<MARKS.length;i++)if(pending.marks[i]!=UNSET&&((i<index&&pending.marks[i]>at)||(i>index&&pending.marks[i]<at)))return false;
  pending.marks[index]=at;return true;
 }
 /** A speech engine had to load during this turn: it is a cold trial. */
 synchronized void engineLoaded(Trial owner,String reason){
  expire();if(owner==null||owner!=pending)return;
  pending.cold=true;
  if(pending.coldReason==null)pending.coldReason=reason;else if(!pending.coldReason.contains(reason))pending.coldReason+="+"+reason;
 }
 /** Response PCM handed to the player. The owner must still be the open turn. */
 synchronized Trial firstPcm(Trial owner,long at){
  expire();
  if(owner==null||owner!=pending||pending.marks[FIRST_PCM]!=UNSET||at<pending.marks[ENDPOINT])return null;
  for(int i=0;i<FIRST_PCM;i++)if(pending.marks[i]!=UNSET&&pending.marks[i]>at)return null;
  pending.marks[FIRST_PCM]=at;return pending;
 }
 /** The first non-silent response sample is presented at {@code at}. Completes the trial. */
 synchronized boolean audible(Trial trial,long at,String source){
  expire();
  if(trial==null||trial!=pending||trial.marks[FIRST_PCM]==UNSET||at<trial.marks[FIRST_PCM])return false;
  trial.marks[AUDIBLE]=at;trial.audibleClock=source;
  if(trial.overlapped)finish(trial,"failed","overlapping-reply");else finish(trial,"passed",null);
  return true;
 }
 /** The trial's outcome once settled, or null. */
 synchronized String outcome(Trial trial){expire();return trial.outcome;}
 synchronized void failed(Trial trial,String reason){if(trial!=null&&trial==pending)finish(trial,"failed",reason);}
 /** Its playback was stopped (barge-in, stop, focus loss) after first-pcm and before an audible time. */
 synchronized void stopped(Trial trial){if(trial!=null&&trial==pending&&trial.marks[FIRST_PCM]!=UNSET)finish(trial,"failed","playback-stopped");}
 synchronized void environment(Trial trial,String network,String thermal,float headroom){if(trial==null)return;trial.network=network;trial.thermal=thermal;trial.thermalHeadroom=headroom;}
 synchronized List<Trial> snapshot(){expire();return new ArrayList<>(finished);}
 synchronized int dropped(){return dropped;}
 synchronized void clear(){finished.clear();pending=null;dropped=0;}

 private void expire(){
  if(pending==null)return;
  long reference=pending.marks[FIRST_PCM]!=UNSET?pending.marks[FIRST_PCM]:pending.marks[ENDPOINT];
  if(clock.nanos()-reference>PENDING_LIMIT_NS)finish(pending,pending.marks[FIRST_PCM]!=UNSET?"failed":"abandoned",pending.marks[FIRST_PCM]!=UNSET?"no-audible-time":"no-response");
 }
 private void finish(Trial trial,String outcome,String reason){
  trial.outcome=outcome;trial.reason=reason;
  if(trial==pending)pending=null;
  finished.addLast(trial);
  while(finished.size()>MAX_RECORDS){finished.removeFirst();dropped++;}
 }
}
