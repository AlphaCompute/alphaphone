package ai.elizaresearch.alphaphone.sense;

/** Versioned hint for SystemUI to locate the existing immutable Pause capability.
 * A marker alone is not authority: SystemUI must verify the image-pinned signer, notification
 * owner and PendingIntent creator/type/immutability before sending the token without fill-in data.
 */
final class ListenerActionContract {
 static final String KEY="ai.elizaresearch.alphaphone.sense.SYSTEMUI_ACTION_V1";
 static final String PAUSE="pause-until-resumed";
 static String marker(String action){
  return "ai.elizaresearch.alphaphone.sense.action.PAUSE".equals(action)?PAUSE:null;
 }
 private ListenerActionContract(){}
}
