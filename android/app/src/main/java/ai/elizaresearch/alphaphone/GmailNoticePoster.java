package ai.elizaresearch.alphaphone;
import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

/** Content-free, package-private mail notices. PendingIntents carry only a ledger key. */
final class GmailNoticePoster implements GmailReconciliation.Poster {
 static final String CHANNEL="alpha-gmail",ACTION="ai.elizaresearch.alphaphone.OPEN_GMAIL_NOTICE",PREFIX="alpha-gmail:",TAG="alpha-gmail-";
 private final Context context;private final NotificationManager manager;
 GmailNoticePoster(Context context){this.context=context.getApplicationContext();manager=context.getSystemService(NotificationManager.class);NotificationChannel channel=new NotificationChannel(CHANNEL,"New Gmail messages",NotificationManager.IMPORTANCE_DEFAULT);channel.setDescription("New unread Inbox messages for the selected Google account. Background checks may be delayed by Android.");channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);manager.createNotificationChannel(channel);}
 public boolean allowed(){NotificationChannel c=manager.getNotificationChannel(CHANNEL);return (Build.VERSION.SDK_INT<33||context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED)&&manager.areNotificationsEnabled()&&c!=null&&c.getImportance()!=NotificationManager.IMPORTANCE_NONE;}
 public boolean active(String key){for(android.service.notification.StatusBarNotification n:manager.getActiveNotifications())if((TAG+key).equals(n.getTag()))return true;return false;}
 private Intent intent(String key){return new Intent(context,MainActivity.class).setAction(ACTION).setData(Uri.parse(PREFIX+key)).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);}
 public void post(String key){PendingIntent tap=PendingIntent.getActivity(context,0,intent(key),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);Notification redacted=new Notification.Builder(context,CHANNEL).setSmallIcon(R.drawable.notification_icon).setContentTitle("Alpha Phone").setContentText("Open Alpha to review.").build();manager.notify(TAG+key,0,new Notification.Builder(context,CHANNEL).setSmallIcon(R.drawable.notification_icon).setContentTitle("New mail in Gmail").setContentText("Open Inbox with the matching account to review.").setPublicVersion(redacted).setVisibility(Notification.VISIBILITY_PRIVATE).setContentIntent(tap).setOnlyAlertOnce(true).setAutoCancel(true).setTimeoutAfter(86400000L).setCategory(Notification.CATEGORY_EMAIL).build());long until=android.os.SystemClock.elapsedRealtime()+500;while(!active(key)&&android.os.SystemClock.elapsedRealtime()<until){try{Thread.sleep(25);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();break;}}}
 public void cancel(String key){manager.cancel(TAG+key,0);PendingIntent tap=PendingIntent.getActivity(context,0,intent(key),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_NO_CREATE);if(tap!=null)tap.cancel();}
 void cancelAll(){for(android.service.notification.StatusBarNotification n:manager.getActiveNotifications())if(n.getTag()!=null&&n.getTag().startsWith(TAG))cancel(n.getTag().substring(TAG.length()));}
}
