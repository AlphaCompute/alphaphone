package ai.elizaresearch.alphaphone.sense;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.drawable.Icon;

/**
 * The listening indicator the listener itself owns: an ongoing foreground-service notification,
 * public on the lock screen (status text only, never content), with Pause and Stop usable without
 * unlocking and Resume requiring authentication. The system microphone privacy indicator is
 * separate and is not controlled here. Attention states (before unlock, revoked permission,
 * stopped after errors, no speech model) get a quiet non-ongoing status notification.
 */
final class ListenerNotifications {
 private ListenerNotifications(){}
 static final String CHANNEL_ACTIVE="listening",CHANNEL_STATUS="listener-status";
 static final int ACTIVE_ID=1,STATUS_ID=2;

 static void channels(Context context){
  NotificationManager manager=context.getSystemService(NotificationManager.class);
  NotificationChannel active=new NotificationChannel(CHANNEL_ACTIVE,"Always-on listening",NotificationManager.IMPORTANCE_LOW);
  active.setDescription("Shown whenever always-on listening is on or paused.");
  active.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
  active.setShowBadge(false);
  NotificationChannel status=new NotificationChannel(CHANNEL_STATUS,"Listening status",NotificationManager.IMPORTANCE_LOW);
  status.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
  status.setShowBadge(false);
  manager.createNotificationChannel(active);
  manager.createNotificationChannel(status);
 }

 private static PendingIntent action(Context context,String action,int code){
  Intent intent=new Intent(context,ListenerActionReceiver.class).setAction(action);
  return PendingIntent.getBroadcast(context,code,intent,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
 }

 private static PendingIntent settings(Context context){
  Intent intent=new Intent(context,ConsentActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
  return PendingIntent.getActivity(context,10,intent,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
 }

 private static Notification.Action button(Context context,String label,String action,int code,boolean needsUnlock){
  return new Notification.Action.Builder(Icon.createWithResource(context,R.drawable.ic_listening),label,action(context,action,code))
   .setAuthenticationRequired(needsUnlock).build();
 }

 static Notification active(Context context,ListenerPolicy.State state){
  channels(context);
  Notification.Builder builder=new Notification.Builder(context,CHANNEL_ACTIVE)
   .setSmallIcon(R.drawable.ic_listening)
   .setContentTitle(ListenerPolicy.label(state))
   .setContentText(ListenerPolicy.processesAudio(state)?"Say “Alpha” to ask. Audio stays on this phone and is not saved.":"The microphone is not being analysed.")
   .setCategory(Notification.CATEGORY_SERVICE)
   .setVisibility(Notification.VISIBILITY_PUBLIC)
   .setOngoing(true)
   .setOnlyAlertOnce(true)
   .setShowWhen(false)
   .setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
   .setContentIntent(settings(context));
  if(state==ListenerPolicy.State.PAUSED_USER)builder.addAction(button(context,"Resume",ListenerActionReceiver.RESUME,3,ListenerPolicy.resumeRequiresUnlock()));
  else builder.addAction(button(context,"Pause",ListenerActionReceiver.PAUSE,1,false));
  builder.addAction(button(context,"Turn off",ListenerActionReceiver.STOP,2,false));
  return builder.build();
 }

 /** Posts or clears the attention notification for states that capture nothing. */
 static void showStatus(Context context,ListenerPolicy.State state){
  NotificationManager manager=context.getSystemService(NotificationManager.class);
  if(manager==null)return;
  if(!ListenerPolicy.needsAttention(state)){manager.cancel(STATUS_ID);return;}
  channels(context);
  Notification.Builder builder=new Notification.Builder(context,CHANNEL_STATUS)
   .setSmallIcon(R.drawable.ic_listening)
   .setContentTitle(ListenerPolicy.label(state))
   .setContentText(state==ListenerPolicy.State.WAITING_FOR_UNLOCK?"The microphone stays off until you unlock this phone.":"The microphone is off. Open listening settings to turn it back on.")
   .setVisibility(Notification.VISIBILITY_PUBLIC)
   .setOnlyAlertOnce(true)
   .setContentIntent(settings(context));
  try{manager.notify(STATUS_ID,builder.build());}catch(SecurityException notificationsDenied){}
 }
}
