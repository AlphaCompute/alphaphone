package ai.elizaresearch.alphaphone;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/** Android owns the package-scoped deletion, process stop, jobs, alarms and Keystore cleanup.
 * A persisted request retries before app initialization if interrupted before system dispatch.
 * This marker does not make Android's multi-step storage deletion filesystem-atomic.
 *
 * Fail closed: Alpha's data is never cleared before an installed image listener durably
 * acknowledges consent revocation, and the old runtime never resumes while the marker exists.
 * When the reset cannot finish, the main process still stops, but a start the user is looking at
 * first opens {@link ResetRecoveryActivity} in its own provider-free process. Where Alpha is HOME, that
 * visible surface replaces a silent stop that Android would immediately relaunch. Automatic
 * attempts are bounded; the recovery surface's Try again is always a fresh attempt. */
final class AlphaDataReset {
 /** Automatic (unprompted) attempts allowed within {@link #AUTOMATIC_WINDOW_MS}; then only the recovery surface. */
 static final int AUTOMATIC_ATTEMPTS=3;
 static final long AUTOMATIC_WINDOW_MS=60_000;
 enum Outcome{DISPATCHED,LISTENER_UNACKNOWLEDGED,ANDROID_REFUSED,DEFERRED}
 private static File directory(Context context){return context.createDeviceProtectedStorageContext().getNoBackupFilesDir();}
 private static AtomicFile marker(Context context){return new AtomicFile(new File(directory(context),"reset-alpha.pending"));}
 private static AtomicFile failures(Context context){return new AtomicFile(new File(directory(context),"reset-alpha.failures"));}
 private static boolean exists(AtomicFile file){return file.getBaseFile().exists()||new File(file.getBaseFile().getPath()+".bak").exists();}
 static boolean pending(Context context){return exists(marker(context));}
 /** A new confirmed request starts with a fresh automatic-attempt budget. */
 static void record(Context context)throws Exception{failures(context).delete();write(marker(context),new byte[]{1});}
 private static void write(AtomicFile file,byte[] value)throws Exception{
  FileOutputStream out=null;
  try{out=file.startWrite();out.write(value);out.getFD().sync();file.finishWrite(out);out=null;
   java.io.FileDescriptor directory=android.system.Os.open(file.getBaseFile().getParent(),android.system.OsConstants.O_RDONLY,0);
   try{android.system.Os.fsync(directory);}finally{android.system.Os.close(directory);}
  }finally{if(out!=null)file.failWrite(out);}
 }
 /** {count, first failure time in the current window}; unreadable state counts as exhausted
  * until a user-initiated attempt from the recovery surface starts a new window. */
 static long[] failureState(Context context){
  AtomicFile file=failures(context);if(!exists(file))return new long[]{0,0};
  try{String[] parts=new String(file.readFully(),StandardCharsets.US_ASCII).trim().split(":");
   long count=Long.parseLong(parts[0]),first=Long.parseLong(parts[1]);
   // A negative or overflowing count would otherwise grant unbounded automatic attempts.
   if(parts.length==2&&count>=0&&count<=Integer.MAX_VALUE&&first>=0)return new long[]{count,first};
  }catch(Exception unreadable){/* Treated as exhausted below. */}
  return new long[]{AUTOMATIC_ATTEMPTS,-1};
 }
 static boolean automaticAttemptAllowed(long[] state,long now){
  if(state[0]<AUTOMATIC_ATTEMPTS)return true;
  if(state[1]<0)return false;
  // A wall-clock step backwards also starts a new window rather than deferring forever.
  return now<state[1]||now-state[1]>=AUTOMATIC_WINDOW_MS;
 }
 private static void recordFailure(Context context,long now){
  // A late result after Android finished the clear must not recreate state in fresh data.
  if(!pending(context))return;
  long[] state=failureState(context);
  long[] next=state[0]==0||now<state[1]||now-state[1]>=AUTOMATIC_WINDOW_MS?new long[]{1,now}:new long[]{Math.min(state[0]+1,Integer.MAX_VALUE),state[1]};
  try{write(failures(context),(next[0]+":"+next[1]).getBytes(StandardCharsets.US_ASCII));}
  catch(Exception unavailable){/* The pending marker, not this counter, keeps the reset fail-closed. */}
 }
 /** One attempt: durable listener revocation first, then Android's package-scoped clear of Alpha
  * itself. On {@link Outcome#DISPATCHED} Android stops every Alpha process and deletes its data,
  * including this marker; any other outcome leaves the marker and all data in place. */
 static Outcome attempt(Context context,long now){
  Outcome outcome;
  try{
   if(!AlphaListenerPlugin.resetForData(context))outcome=Outcome.LISTENER_UNACKNOWLEDGED;
   else{ActivityManager manager=context.getSystemService(ActivityManager.class);outcome=manager!=null&&manager.clearApplicationUserData()?Outcome.DISPATCHED:Outcome.ANDROID_REFUSED;}
  }catch(RuntimeException failure){outcome=Outcome.ANDROID_REFUSED;}
  if(outcome!=Outcome.DISPATCHED)recordFailure(context,now);
  return outcome;
 }
 /** The user just confirmed the reset in Alpha, so an unfinished reset always opens recovery. */
 static void dispatchAndExit(Context context){dispatchAndExit(context,true);}
 /** Startup admission, before any provider or initializer. Android also starts Alpha's process
  * for jobs, alarms, broadcasts, pushes, providers and bound services (the notification listener,
  * autofill). Such a start is not a launch the user is looking at: opening recovery from it would
  * take the screen from the app in front, including Phone or Settings opened from recovery. The
  * process still stops; recovery opens on the next activity start. When Android cannot say why
  * this process started, recovery opens. */
 static void admitAndExit(Context context){
  boolean visible;
  try{visible=userVisibleStart(context);}catch(RuntimeException|LinkageError unknown){visible=true;}
  dispatchAndExit(context,visible);
 }
 private static boolean userVisibleStart(Context context){
  if(android.os.Build.VERSION.SDK_INT<35)return true;
  ActivityManager manager=context.getSystemService(ActivityManager.class);if(manager==null)return true;
  java.util.List<android.app.ApplicationStartInfo> starts=manager.getHistoricalProcessStartReasons(1);
  if(starts==null||starts.isEmpty()||starts.get(0).getPid()!=android.os.Process.myPid())return true;
  return !backgroundStart(starts.get(0).getReason());
 }
 static boolean backgroundStart(int reason){
  switch(reason){
   case android.app.ApplicationStartInfo.START_REASON_ALARM: case android.app.ApplicationStartInfo.START_REASON_BACKUP:
   case android.app.ApplicationStartInfo.START_REASON_BOOT_COMPLETE: case android.app.ApplicationStartInfo.START_REASON_BROADCAST:
   case android.app.ApplicationStartInfo.START_REASON_CONTENT_PROVIDER: case android.app.ApplicationStartInfo.START_REASON_JOB:
   case android.app.ApplicationStartInfo.START_REASON_PUSH: case android.app.ApplicationStartInfo.START_REASON_SERVICE:return true;
   default:return false;
  }
 }
 /** Never resumes the old runtime, including when Android refuses or the Binder call fails. */
 private static void dispatchAndExit(Context context,boolean showRecovery){
  try{
   long now=System.currentTimeMillis();
   Outcome outcome=automaticAttemptAllowed(failureState(context),now)?attempt(context,now):Outcome.DEFERRED;
   if(outcome!=Outcome.DISPATCHED){android.util.Log.w("AlphaReset","Reset not finished ("+outcome+")"+(showRecovery?"; showing recovery":"; background start"));if(showRecovery)showRecovery(context);}
  }catch(RuntimeException failure){android.util.Log.w("AlphaReset","Reset admission failed");if(showRecovery)showRecovery(context);}
  finally{android.os.Process.killProcess(android.os.Process.myPid());System.exit(0);}
 }
 private static void showRecovery(Context context){
  try{context.startActivity(new Intent(context,ResetRecoveryActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK));}
  catch(RuntimeException refused){/* Next HOME or launcher start shows it; data stays intact. */}
 }
 private AlphaDataReset(){}
}
