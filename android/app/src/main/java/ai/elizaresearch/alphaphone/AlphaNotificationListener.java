package ai.elizaresearch.alphaphone;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/** Android alone binds this opt-in service. No network or agent forwarding. */
public final class AlphaNotificationListener extends NotificationListenerService {
 private final ThreadPoolExecutor events=new ThreadPoolExecutor(1,1,0,TimeUnit.MILLISECONDS,new ArrayBlockingQueue<>(64),new ThreadPoolExecutor.AbortPolicy());
 private final BroadcastReceiver screen=new BroadcastReceiver(){
  @Override public void onReceive(Context context,Intent intent){NotificationAccess.redact();}
 };
 @Override public void onCreate(){
  super.onCreate();
  androidx.core.content.ContextCompat.registerReceiver(this,screen,new IntentFilter(Intent.ACTION_SCREEN_OFF),androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED);
 }
 @Override public void onListenerConnected(){NotificationAccess.connected(this);}
 @Override public void onListenerDisconnected(){events.getQueue().clear();NotificationAccess.disconnected(this);}
 private void enqueue(StatusBarNotification notice,boolean removed){
  if(notice==null)return;
  final long generation=NotificationAccess.eventGeneration();
  NotificationAccess.invalidateKey(notice.getKey());
  try{events.execute(()->NotificationAccess.changed(this,notice,removed,generation));}
  catch(java.util.concurrent.RejectedExecutionException unavailable){NotificationAccess.redact();events.getQueue().clear();}
 }
 @Override public void onNotificationPosted(StatusBarNotification notice){enqueue(notice,false);}
 @Override public void onNotificationRemoved(StatusBarNotification notice){enqueue(notice,true);}
 @Override public void onDestroy(){
  unregisterReceiver(screen);events.shutdownNow();NotificationAccess.disconnected(this);super.onDestroy();
 }
}
