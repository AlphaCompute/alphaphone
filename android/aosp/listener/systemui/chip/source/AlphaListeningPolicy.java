package com.android.systemui.privacy;

/** Platform-derived facts only. No transcript, PCM, listener self-report or app-supplied UID. */
public final class AlphaListeningPolicy {
 public static final String PACKAGE="ai.elizaresearch.alphaphone.sense";
 public static final String ACTION_KEY="ai.elizaresearch.alphaphone.sense.SYSTEMUI_ACTION_V1";
 public static final String PAUSE="pause-until-resumed";
 public static boolean identity(int uid,int foregroundUser,boolean primaryUser,boolean systemApp,
   boolean privileged,String expectedSigner,String actualSigner,boolean matchesAlpha,boolean solePackage){
  return foregroundUser==0&&primaryUser&&uid>=10000&&uid<20000&&systemApp&&privileged
   &&expectedSigner!=null&&expectedSigner.matches("[a-f0-9]{64}")&&expectedSigner.equals(actualSigner)
   &&matchesAlpha&&solePackage;
 }
 public static boolean recording(int admittedUid,int recordingUid,boolean silenced){
  return admittedUid>=10000&&admittedUid<20000&&admittedUid==recordingUid&&!silenced;
 }
 public static boolean pause(int admittedUid,int notificationUid,String notificationPackage,
   int notificationId,String channel,int creatorUid,String creatorPackage,boolean immutable,
   boolean broadcast,boolean requiresUnlock,String marker){
  return admittedUid>=10000&&admittedUid<20000&&admittedUid==notificationUid&&admittedUid==creatorUid
   &&PACKAGE.equals(notificationPackage)&&PACKAGE.equals(creatorPackage)&&notificationId==1
   &&"listening-indicator".equals(channel)&&immutable&&broadcast&&!requiresUnlock&&PAUSE.equals(marker);
 }
 // Indicator health lease (docs/aosp-listening-chip.md); mirrors the listener's IndicatorLease contract.
 public static final String LEASE_AUTHORITY="ai.elizaresearch.alphaphone.sense.indicator";
 public static final String LEASE_ACQUIRE="acquire",LEASE_RENEW="renew",LEASE_REVOKE="revoke";
 public static final String KEY_TOKEN="token",KEY_GENERATION="generation",KEY_ACCEPTED="accepted",
  KEY_SURFACE="surfaceVisible",KEY_CHIP="chipVisible",KEY_RECORDING="recordingObserved";
 public static final long LEASE_RENEW_MS=1_000;
 /** Below this effective alpha or visible fraction a surface does not count as shown. */
 public static final float MIN_ALPHA=0.5f;
 public static final int MIN_VISIBLE_PERCENT=90;
 /**
  * Effective on-screen visibility of one SystemUI view, measured by SystemUI from its own view
  * tree: attached, its window visible, shown through every ancestor, aggregated-visible, mostly
  * opaque along the ancestor chain and almost entirely inside the visible screen area.
  */
 public static boolean effectivelyVisible(boolean attached,boolean windowVisible,boolean shown,boolean aggregated,
   float effectiveAlpha,long visibleArea,long area){
  return attached&&windowVisible&&shown&&aggregated&&effectiveAlpha>=MIN_ALPHA&&area>0&&visibleArea>0
   &&visibleArea<=area&&visibleArea*100>=area*MIN_VISIBLE_PERCENT;
 }
 /** Acknowledgements go only to the lease provider of the already admitted listener UID. */
 public static boolean leaseTarget(int admittedUid,String providerPackage,int providerUid){
  return admittedUid>=10000&&admittedUid<20000&&PACKAGE.equals(providerPackage)&&providerUid==admittedUid;
 }
 /** The chip may be acknowledged as visible only while SystemUI itself observes the recording. */
 public static boolean chipAcknowledged(boolean recordingObserved,boolean anyChipVisible){return recordingObserved&&anyChipVisible;}
 private AlphaListeningPolicy(){}
}
