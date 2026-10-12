package ai.elizaresearch.alphaphone.sense;

/**
 * The listener's single source of truth for whether the microphone may be open. Pure Java so the
 * rules run on the JVM in repository tests; the Android service feeds it observed inputs.
 *
 * Off is the default and every unknown or unavailable input resolves away from capture. Only
 * {@link State#LISTENING} processes audio. {@link State#PAUSED_MIC_UNAVAILABLE} keeps the silenced
 * recording open only so Android can report when the microphone is released again; its frames
 * are discarded unread.
 */
public final class ListenerPolicy {
 private ListenerPolicy(){}

 /** Bump when what is captured, where it goes or what is kept changes; older consent then lapses. */
 public static final int CONSENT_VERSION=1;
 /** User pause that lasts until the user resumes. */
 public static final long PAUSE_UNTIL_RESUMED=Long.MAX_VALUE;

 public enum State {
  /** No consent, consent withdrawn or the user turned listening off. Nothing runs. */
  OFF,
  /** Consent exists but RECORD_AUDIO was revoked; the user must grant it again in the listener settings. */
  PERMISSION_REQUIRED,
  /** Repeated unclean exits; capture stays stopped until the user turns it back on. */
  STOPPED_AFTER_ERRORS,
  /** Booted and not yet unlocked (before first unlock). Never captures. */
  WAITING_FOR_UNLOCK,
  /** The local speech model could not be loaded. Never captures. */
  SPEECH_UNAVAILABLE,
  PAUSED_USER,
  PAUSED_CALL,
  /** Another app is recording; the listener releases the microphone until it finishes. */
  PAUSED_MIC_IN_USE,
  /** The listener's own recording is silenced (microphone privacy toggle or audio policy). */
  PAUSED_MIC_UNAVAILABLE,
  LISTENING
 }

 /** Observed inputs. Defaults are the most restrictive values. */
 public static final class Inputs {
  public int consentVersion;
  public boolean enabled;
  public boolean recordAudioGranted;
  public boolean crashLoopTripped;
  public boolean userUnlocked;
  public boolean speechUnavailable;
  public long pausedUntilMs;
  public boolean inCall;
  public boolean otherAppRecording;
  public boolean micSilenced;
 }

 public static boolean consented(int storedVersion){return storedVersion==CONSENT_VERSION;}

 public static State decide(Inputs in,long nowMs){
  if(in==null||!consented(in.consentVersion)||!in.enabled)return State.OFF;
  if(!in.recordAudioGranted)return State.PERMISSION_REQUIRED;
  if(in.crashLoopTripped)return State.STOPPED_AFTER_ERRORS;
  if(!in.userUnlocked)return State.WAITING_FOR_UNLOCK;
  if(in.speechUnavailable)return State.SPEECH_UNAVAILABLE;
  if(in.pausedUntilMs>nowMs)return State.PAUSED_USER;
  if(in.inCall)return State.PAUSED_CALL;
  if(in.otherAppRecording)return State.PAUSED_MIC_IN_USE;
  if(in.micSilenced)return State.PAUSED_MIC_UNAVAILABLE;
  return State.LISTENING;
 }

 /** Audio frames are analysed only in this state. */
 public static boolean processesAudio(State state){return state==State.LISTENING;}

 /** An AudioRecord may be open (silenced recordings stay open to observe release). */
 public static boolean holdsMicrophone(State state){return state==State.LISTENING||state==State.PAUSED_MIC_UNAVAILABLE;}

 /**
  * The microphone foreground service and its ongoing, lock-screen-visible notification run in
  * these states, so the user always has the indicator plus Pause/Resume/Stop while armed.
  */
 public static boolean foreground(State state){
  switch(state){
   case LISTENING:case PAUSED_USER:case PAUSED_CALL:case PAUSED_MIC_IN_USE:case PAUSED_MIC_UNAVAILABLE:return true;
   default:return false;
  }
 }

 /** States the user should be told about although nothing is captured. */
 public static boolean needsAttention(State state){
  return state==State.PERMISSION_REQUIRED||state==State.STOPPED_AFTER_ERRORS||state==State.WAITING_FOR_UNLOCK||state==State.SPEECH_UNAVAILABLE;
 }

 /** Lock-screen-safe status text. Never contains captured content. */
 public static String label(State state){
  switch(state){
   case LISTENING:return "Listening";
   case PAUSED_USER:return "Listening paused";
   case PAUSED_CALL:return "Paused during call";
   case PAUSED_MIC_IN_USE:return "Paused — another app is using the microphone";
   case PAUSED_MIC_UNAVAILABLE:return "Paused — microphone unavailable";
   case WAITING_FOR_UNLOCK:return "Listening starts after unlock";
   case SPEECH_UNAVAILABLE:return "Listening unavailable — speech model not ready";
   case STOPPED_AFTER_ERRORS:return "Listening stopped after repeated errors";
   case PERMISSION_REQUIRED:return "Listening needs microphone permission";
   default:return "Listening off";
  }
 }

 /** Pausing reduces capability, so it never needs unlock. Resuming or turning on does. */
 public static boolean resumeRequiresUnlock(){return true;}

 /** Pause end for a duration in minutes; 0 or less pauses until the user resumes. */
 public static long pauseUntil(long nowMs,int minutes){
  if(minutes<=0)return PAUSE_UNTIL_RESUMED;
  long span=minutes*60_000L;
  return nowMs>Long.MAX_VALUE-span?PAUSE_UNTIL_RESUMED:nowMs+span;
 }
}
