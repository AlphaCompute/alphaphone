package ai.elizaresearch.alphaphone.sense;

/**
 * SystemUI indicator health lease (docs/aosp-listening-chip.md, ADR 0001). Pure Java so the rules
 * run on the JVM in repository tests; {@link IndicatorLeaseProvider} feeds it SystemUI's
 * acknowledgements and the service asks it whether capture may continue.
 *
 * The listener never trusts SystemUI's clock: every renewal is stamped with the listener's own
 * monotonic {@code SystemClock.elapsedRealtime}. A lease is generation-bound: acquiring starts a new
 * generation that is not fresh until SystemUI acknowledges a visible surface, an expired, revoked or
 * replaced generation can never be renewed again (SystemUI must acquire anew), and a lease from
 * another boot never counts. The lease carries visibility facts only: no audio, transcript,
 * consent or resume command. It can only withhold capture; it never turns listening on.
 */
public final class IndicatorLease {
 /** Lease provider authority, method names and keys; mirrored by SystemUI's AlphaListeningPolicy. */
 public static final String AUTHORITY="ai.elizaresearch.alphaphone.sense.indicator";
 public static final String ACQUIRE="acquire",RENEW="renew",REVOKE="revoke";
 public static final String KEY_TOKEN="token",KEY_GENERATION="generation",KEY_ACCEPTED="accepted",
  KEY_SURFACE="surfaceVisible",KEY_CHIP="chipVisible",KEY_RECORDING="recordingObserved",KEY_RENEW_MS="renewMs";
 /** The only package admitted as the lease holder; it must also be platform-signed (see {@link #admitsController}). */
 public static final String SYSTEMUI_PACKAGE="com.android.systemui";
 /** SystemUI renews this often while a surface is visible. */
 public static final long RENEW_MS=1_000;
 /** A lease not renewed within this time expires; capture stops within TTL plus one main-thread dispatch. */
 public static final long TTL_MS=3_000;
 /** Time SystemUI has to observe and show a newly unsilenced recording before attribution is required. */
 public static final long ATTRIBUTION_GRACE_MS=2_500;

 /** Why the lease does not currently permit capture. {@link #NONE} means it does. */
 public enum Loss{NONE,NEVER_ACQUIRED,PENDING,EXPIRED,BINDER_DIED,REVOKED,REPLACED,OTHER_BOOT,SURFACE_HIDDEN,CHIP_HIDDEN,UNATTRIBUTED}

 private long generation;
 private boolean live;
 private boolean acknowledged;
 private long expiresAt;
 private long boot=Long.MIN_VALUE;
 private boolean surfaceVisible,chipVisible,recordingObserved;
 private Loss lastLoss=Loss.NEVER_ACQUIRED;

 /** Starts a new generation. Any previous generation is replaced and can never be renewed. */
 public synchronized long acquire(long boot){
  if(live)lastLoss=Loss.REPLACED;
  generation++;
  live=true;acknowledged=false;this.boot=boot;
  surfaceVisible=chipVisible=recordingObserved=false;
  return generation;
 }

 /**
  * A visibility acknowledgement for {@code gen}, stamped with the listener's clock {@code now}.
  * Refused (false) for a stale, revoked, expired, replaced or other-boot generation; SystemUI must
  * then acquire again. A refused or hidden acknowledgement never extends the lease.
  */
 public synchronized boolean renew(long gen,long now,long boot,boolean surface,boolean chip,boolean recording){
  if(!live||gen!=generation)return false;
  if(boot!=this.boot){end(Loss.OTHER_BOOT);return false;}
  if(acknowledged&&now>=expiresAt){end(Loss.EXPIRED);return false;}
  surfaceVisible=surface;chipVisible=chip;recordingObserved=recording;
  if(surface){acknowledged=true;expiresAt=now+TTL_MS;}
  return true;
 }

 /** Explicit revoke by SystemUI (surface detached, user switch, shutdown). Stale generations are ignored. */
 public synchronized void revoke(long gen){if(live&&gen==generation)end(Loss.REVOKED);}

 /** SystemUI's token binder died: its process is gone and nothing it showed can be trusted. */
 public synchronized void binderDied(long gen){if(live&&gen==generation)end(Loss.BINDER_DIED);}

 private void end(Loss reason){live=false;acknowledged=false;lastLoss=reason;surfaceVisible=chipVisible=recordingObserved=false;}

 /**
  * Whether capture may run now. {@code requireAttribution}: the listener has been capturing
  * unsilenced for longer than {@link #ATTRIBUTION_GRACE_MS}, so SystemUI must also report that it
  * observes the recording itself and shows the Listening chip.
  */
 public synchronized Loss verdict(long now,long boot,boolean requireAttribution){
  if(!live)return lastLoss;
  if(boot!=this.boot){end(Loss.OTHER_BOOT);return lastLoss;}
  if(!acknowledged)return Loss.PENDING;
  if(now>=expiresAt){end(Loss.EXPIRED);return lastLoss;}
  if(!surfaceVisible)return Loss.SURFACE_HIDDEN;
  if(recordingObserved&&!chipVisible)return Loss.CHIP_HIDDEN;
  if(requireAttribution&&!(recordingObserved&&chipVisible))return Loss.UNATTRIBUTED;
  return Loss.NONE;
 }

 public boolean permits(long now,long boot,boolean requireAttribution){return verdict(now,boot,requireAttribution)==Loss.NONE;}

 /** Delay until the service should re-check the lease while it holds the microphone. */
 public synchronized long nextCheckDelay(long now){
  long remaining=live&&acknowledged?expiresAt-now:0;
  return Math.max(50,Math.min(RENEW_MS,remaining));
 }

 synchronized long generation(){return live?generation:-1;}

 /** Attribution is required once unsilenced capture has run for longer than the grace period. */
 public static boolean requiresAttribution(boolean capturingUnsilenced,long unsilencedSince,long now){
  return capturingUnsilenced&&unsilencedSince>=0&&now-unsilencedSince>=ATTRIBUTION_GRACE_MS;
 }

 /**
  * The caller may hold the lease only when Android reports it holds STATUS_BAR_SERVICE (a
  * signature permission of the platform), its UID belongs to the system user and maps to exactly
  * the SystemUI package, and that package is signed with the platform certificate. Alpha, which
  * holds only LISTENER_CONTROL, can never renew a lease.
  */
 public static boolean admitsController(boolean holdsStatusBarService,int callingUid,String[] packagesForUid,boolean platformSigned){
  return holdsStatusBarService&&callingUid>=1000&&callingUid<100000&&packagesForUid!=null&&packagesForUid.length==1
   &&SYSTEMUI_PACKAGE.equals(packagesForUid[0])&&platformSigned;
 }
}
