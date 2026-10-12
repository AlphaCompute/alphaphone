package ai.elizaresearch.alphaphone.sense;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;

/**
 * Listener settings in device-protected storage, so a persistent process started before first
 * unlock can read them and decide not to listen. Holds only flags and timestamps: never audio,
 * transcripts or account data. Consent is versioned; a missing or older version is no consent.
 */
// commit(), not apply(): consent, pause and the open-session marker must be durable before capture
// starts or stops, or a crash could lose a pause or hide an unclean exit.
@SuppressLint("ApplySharedPref")
final class ListenerStore {
 private static final String FILE="listener-settings";
 private static final String CONSENT="consentVersion",CONSENT_AT="consentAtMs",ENABLED="enabled",PAUSED_UNTIL="pausedUntilMs",
  SESSION_OPEN="captureSessionOpen",EXITS="uncleanExits",TRIPPED="stoppedAfterErrors";
 private final SharedPreferences prefs;

 ListenerStore(Context context){
  prefs=context.createDeviceProtectedStorageContext().getSharedPreferences(FILE,Context.MODE_PRIVATE);
 }

 int consentVersion(){return prefs.getInt(CONSENT,0);}
 boolean enabled(){return prefs.getBoolean(ENABLED,false);}
 long pausedUntil(){return prefs.getLong(PAUSED_UNTIL,0);}
 long consentAt(){return prefs.getLong(CONSENT_AT,0);}

 /** Records the explicit opt-in shown in {@link ConsentActivity} and turns listening on. */
 void grantConsent(long now){
  prefs.edit().putInt(CONSENT,ListenerPolicy.CONSENT_VERSION).putLong(CONSENT_AT,now).putBoolean(ENABLED,true)
   .putLong(PAUSED_UNTIL,0).remove(EXITS).remove(TRIPPED).commit();
  Listener.speechUnavailable=false;
 }

 /** Withdraws consent: listening stops and must be opted into again. */
 void revokeConsent(){
  prefs.edit().remove(CONSENT).remove(CONSENT_AT).putBoolean(ENABLED,false).remove(PAUSED_UNTIL).remove(EXITS).remove(TRIPPED).putBoolean(SESSION_OPEN,false).commit();
 }

 /** Turning listening back on is an explicit user action and clears a tripped crash loop. */
 void setEnabled(boolean enabled){
  SharedPreferences.Editor edit=prefs.edit().putBoolean(ENABLED,enabled).putLong(PAUSED_UNTIL,0);
  if(enabled){edit.remove(EXITS).remove(TRIPPED);Listener.speechUnavailable=false;}
  edit.commit();
 }

 void pause(long until){prefs.edit().putLong(PAUSED_UNTIL,until).commit();}
 void resume(){prefs.edit().putLong(PAUSED_UNTIL,0).remove(EXITS).remove(TRIPPED).commit();Listener.speechUnavailable=false;}

 /** Marks a capture session open (true) or cleanly closed (false); a process start that finds it open counts an unclean exit. */
 void setSessionOpen(boolean open){prefs.edit().putBoolean(SESSION_OPEN,open).commit();}

 /**
  * Called once per process start. Android kills the process when RECORD_AUDIO is revoked, so a
  * start without the permission is not counted as a crash. Returns whether the breaker is tripped.
  */
 boolean recordProcessStart(long now,boolean countOpenSession){
  long[] exits=CrashLoopBreaker.onProcessStart(CrashLoopBreaker.decode(prefs.getString(EXITS,null)),countOpenSession&&prefs.getBoolean(SESSION_OPEN,false),now);
  boolean tripped=prefs.getBoolean(TRIPPED,false)||CrashLoopBreaker.tripped(exits,now);
  prefs.edit().putString(EXITS,CrashLoopBreaker.encode(exits)).putBoolean(SESSION_OPEN,false).putBoolean(TRIPPED,tripped).commit();
  return tripped;
 }

 /** Sticky once tripped: the window ageing out never restarts capture; only an explicit user action does. */
 boolean crashLoopTripped(){return prefs.getBoolean(TRIPPED,false);}
}
