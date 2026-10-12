package ai.elizaresearch.alphaphone;

/** Install the read-only native source callback before any resident service starts. */
public final class AlphaApplication extends android.app.Application {
 @Override public void onCreate(){
  super.onCreate();NativeDigestHost host=new NativeDigestHost(this);NativeSourceHost.configure(host::read);NativeOwnerReminderHost owner=new NativeOwnerReminderHost(this);NativeSourceHost.configureOwnerReminderContext(owner::read);
  // Isolated helper processes have no app storage; only the main process keeps the problem log and schedules upkeep.
  if(android.os.Process.isIsolated()||!getPackageName().equals(getProcessName()))return;
  // An interrupted "Reset Alpha data" finishes before anything is scheduled; nothing else starts.
  // Fails closed: if the reset state cannot be read, nothing is scheduled in this process.
  try{if(AlphaDataReset.resumeIfPending(this))return;}catch(RuntimeException unavailable){return;}
  if(AlphaDataReset.blocked(this))return;
  AlphaCrashLog.install(this);
  try{AlphaNoteAudioPlugin.scheduleTrashBackstop(this);}catch(RuntimeException unavailable){/* Retried on the next start; the renderer still purges Trash. */}
 }
}
