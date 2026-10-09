package ai.elizaresearch.alphaphone;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationChannelGroup;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.service.notification.StatusBarNotification;

/** Uses only this app's channel; private contents are hidden on the lock screen. */
final class WorkflowNoticePoster implements WorkflowNoticeDelivery.Poster {
 private static final String CHANNEL="alpha_workflow_steps";
 private final Context context;
 WorkflowNoticePoster(Context context){this.context=context.getApplicationContext();NotificationChannel channel=new NotificationChannel(CHANNEL,"Approved workflow notifications",NotificationManager.IMPORTANCE_DEFAULT);channel.setDescription("Notifications explicitly approved in Alpha Phone workflows");channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);manager().createNotificationChannel(channel);}
 private NotificationManager manager(){return context.getSystemService(NotificationManager.class);}
 private String tag(String id){return "alpha-workflow-"+id;}
 public boolean allowed(){
  if(Build.VERSION.SDK_INT>=33&&context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return false;
  NotificationChannel channel=manager().getNotificationChannel(CHANNEL);if(!manager().areNotificationsEnabled()||channel==null||channel.getImportance()==NotificationManager.IMPORTANCE_NONE)return false;
  NotificationChannelGroup group=channel.getGroup()==null?null:manager().getNotificationChannelGroup(channel.getGroup());return group==null||!group.isBlocked();
 }
 public void post(String id,String title,String body)throws Exception{
  if(!allowed())throw new SecurityException("Notification delivery is disabled");
  Notification redacted=new Notification.Builder(context,CHANNEL).setSmallIcon(R.drawable.notification_icon).setContentTitle("Alpha Phone workflow").setContentText("Unlock to review this notification.").build();
  Notification.Builder notice=new Notification.Builder(context,CHANNEL).setSmallIcon(R.drawable.notification_icon).setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body)).setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(redacted).setOnlyAlertOnce(true).setAutoCancel(false).setCategory(Notification.CATEGORY_STATUS);
  Intent launch=context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
  String token=WorkflowNoticeTapsFactory.create(context).token(id);
  if(launch==null||token==null)throw new IllegalStateException("Workflow notification route unavailable");
  {launch.setAction(WorkflowNoticeTaps.ACTION).setData(android.net.Uri.parse(WorkflowNoticeTaps.PREFIX+token));notice.setContentIntent(PendingIntent.getActivity(context,0,launch,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT));}
  manager().notify(tag(id),0,notice.build());
 }
 public boolean matches(String id,String title,String body){for(StatusBarNotification row:manager().getActiveNotifications())if(row.getId()==0&&tag(id).equals(row.getTag())){Notification notice=row.getNotification();return CHANNEL.equals(notice.getChannelId())&&title.contentEquals(notice.extras.getCharSequence(Notification.EXTRA_TITLE,""))&&body.contentEquals(notice.extras.getCharSequence(Notification.EXTRA_BIG_TEXT,notice.extras.getCharSequence(Notification.EXTRA_TEXT,"")));}return false;}
}
