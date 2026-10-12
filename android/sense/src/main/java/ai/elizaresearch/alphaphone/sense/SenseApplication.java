package ai.elizaresearch.alphaphone.sense;

import android.Manifest;
import android.app.Application;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;

/**
 * The image starts this persistent, direct-boot-aware process at boot and restarts it after a
 * crash. Each start counts an unclean exit when a capture session was left open (the crash-loop
 * breaker), then converges on policy: off without consent, waiting before first unlock, and
 * listening only after unlock with consent and permission.
 */
public final class SenseApplication extends Application {
 @Override public void onCreate(){
  super.onCreate();
  boolean granted=checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED;
  new ListenerStore(this).recordProcessStart(System.currentTimeMillis(),granted);
  registerReceiver(new BroadcastReceiver(){
   @Override public void onReceive(Context context,Intent intent){Listener.refresh(context);}
  },new IntentFilter(Intent.ACTION_USER_UNLOCKED),Context.RECEIVER_NOT_EXPORTED);
  Listener.refresh(this);
 }
}
