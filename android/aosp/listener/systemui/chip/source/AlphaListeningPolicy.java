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
 private AlphaListeningPolicy(){}
}
