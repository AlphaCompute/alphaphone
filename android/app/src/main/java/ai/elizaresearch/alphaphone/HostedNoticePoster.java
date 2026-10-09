package ai.elizaresearch.alphaphone;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.util.concurrent.*;
import org.json.JSONObject;

final class HostedNoticePoster implements HostedResultNotices.Poster {
 private final Context context;
 private static final String CHANNEL=AlphaHostedResultsPlugin.CHANNEL,ACTION=AlphaHostedResultsPlugin.ACTION,PREFIX=AlphaHostedResultsPlugin.PREFIX;
 HostedNoticePoster(Context context){this.context=context.getApplicationContext();channel();}
 public boolean active(String key){for(android.service.notification.StatusBarNotification item:manager().getActiveNotifications())if(key.equals(item.getTag()))return true;return false;}
 public void cancel(String key){manager().cancel(key,0);}
 private NotificationManager manager(){return context.getSystemService(NotificationManager.class);}
 void channel(){NotificationChannel c=new NotificationChannel(CHANNEL,"Scheduled digest results",NotificationManager.IMPORTANCE_DEFAULT);c.setDescription("Private hosted results. Open Alpha Phone to review with the matching account.");c.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);manager().createNotificationChannel(c);}
 public boolean allowed(){if(Build.VERSION.SDK_INT>=33&&context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return false;NotificationChannel c=manager().getNotificationChannel(CHANNEL);return manager().areNotificationsEnabled()&&c!=null&&c.getImportance()!=NotificationManager.IMPORTANCE_NONE;}
 public void post(String key){
  Intent open=new Intent(context,MainActivity.class).setAction(ACTION).setData(Uri.parse(PREFIX+key)).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
  PendingIntent tap=PendingIntent.getActivity(context,0,open,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  Notification redacted=new Notification.Builder(context,CHANNEL).setSmallIcon(R.drawable.notification_icon).setContentTitle("Alpha Phone result").setContentText("Open Alpha Phone to review.").build();
  Notification notice=new Notification.Builder(context,CHANNEL).setSmallIcon(R.drawable.notification_icon).setContentTitle("Scheduled result ready").setContentText("Open Alpha Phone to review with the matching account.").setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(redacted).setContentIntent(tap).setOnlyAlertOnce(true).setAutoCancel(true).setCategory(Notification.CATEGORY_STATUS).build();
  manager().notify(key,0,notice);
 }
}
