package ai.elizaresearch.alphaphone;

/**
 * Pure policy for re-arming the resident agent's schedules after reboot, an app update, or a clock
 * or time-zone change (#394). Schedules (digests, agent triggers) live in the resident runtime and
 * run only while it does; this only brings the owner's already-enabled resident back. The runtime
 * itself recomputes due times from the wall clock, records an occurrence that passed while it was
 * not running once as missed, and never replays it. No Android imports: plain-JVM tested.
 */
final class ResidentScheduleRearm {
 static final String BOOT_COMPLETED="android.intent.action.BOOT_COMPLETED";
 static final String PACKAGE_REPLACED="android.intent.action.MY_PACKAGE_REPLACED";
 static final String TIME_SET="android.intent.action.TIME_SET";
 static final String TIMEZONE_CHANGED="android.intent.action.TIMEZONE_CHANGED";

 enum Decision {
  /** Not a re-arming broadcast. */
  IGNORE,
  /** Credential-encrypted agent state is unavailable; the owner's unlock and next launch start it. */
  LOCKED,
  /** This build carries no on-device runtime. */
  NOT_PACKAGED,
  /** The owner has not enabled the on-device agent here (fresh install) or the device is below its floor. */
  NOT_ENABLED,
  /** A surface is stopping the agent or changing its provider; that lifecycle owns the next start. */
  LIFECYCLE_BUSY,
  /** Start (or keep) the resident. Starting an already running resident is a no-op. */
  START
 }

 private ResidentScheduleRearm(){}

 static boolean handles(String action){
  return BOOT_COMPLETED.equals(action)||PACKAGE_REPLACED.equals(action)||TIME_SET.equals(action)||TIMEZONE_CHANGED.equals(action);
 }

 static Decision decide(String action,boolean userUnlocked,boolean runtimePackaged,boolean ownerEnabled,boolean lifecycleIdle){
  if(!handles(action))return Decision.IGNORE;
  if(!userUnlocked)return Decision.LOCKED;
  if(!runtimePackaged)return Decision.NOT_PACKAGED;
  if(!ownerEnabled)return Decision.NOT_ENABLED;
  if(!lifecycleIdle)return Decision.LIFECYCLE_BUSY;
  return Decision.START;
 }
}
