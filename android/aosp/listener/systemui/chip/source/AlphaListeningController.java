package com.android.systemui.privacy;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.*;
import android.content.pm.*;
import android.media.*;
import android.os.*;
import android.service.notification.StatusBarNotification;
import com.android.systemui.CoreStartable;
import com.android.systemui.dagger.SysUISingleton;
import com.android.systemui.dagger.qualifiers.Background;
import com.android.systemui.dagger.qualifiers.Main;
import com.android.systemui.res.R;
import com.android.systemui.settings.UserTracker;
import com.android.systemui.statusbar.NotificationListener;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.Executor;
import javax.inject.Inject;

/**
 * SystemUI-owned microphone truth. Notification actions are capabilities, never capture evidence.
 * It also holds the listener's indicator health lease ({@link AlphaListeningLease}), acknowledging
 * only what its own views measure, so the listener stops when this indicator cannot be shown.
 */
@SysUISingleton
public final class AlphaListeningController implements CoreStartable {
 private static AlphaListeningController instance;
 private static final Set<AlphaListeningChipView> views=new HashSet<>(); // main thread only
 private final Context context;private final AudioManager audio;private final Handler main;
 private final UserTracker users;private final NotificationListener notifications;
 private final AlphaListeningLease lease;
 private int uid=-1;private boolean active;
 private final AudioManager.AudioRecordingCallback recording=new AudioManager.AudioRecordingCallback(){
  @Override public void onRecordingConfigChanged(List<AudioRecordingConfiguration> configs){refresh(configs);}
 };
 private final UserTracker.Callback userCallback=new UserTracker.Callback(){
  @Override public void onBeforeUserSwitching(int user){uid=-1;active=false;publish();}
  @Override public void onUserChanged(int user,Context userContext){refreshCurrent();}
 };
 @Inject public AlphaListeningController(Context context,AudioManager audio,@Main Handler main,@Background Executor background,
   UserTracker users,NotificationListener notifications){this.context=context;this.audio=audio;this.main=main;this.users=users;this.notifications=notifications;
  lease=new AlphaListeningLease(context,main,background,this::acknowledgement);}
 @Override public void start(){
  instance=this;
  audio.registerAudioRecordingCallback(recording,main);
  users.addCallback(userCallback,main::post);
  IntentFilter filter=new IntentFilter();filter.addAction(Intent.ACTION_PACKAGE_ADDED);filter.addAction(Intent.ACTION_PACKAGE_REMOVED);filter.addAction(Intent.ACTION_PACKAGE_REPLACED);filter.addDataScheme("package");
  context.registerReceiver(new BroadcastReceiver(){@Override public void onReceive(Context c,Intent i){refreshCurrent();}},filter,null,main,Context.RECEIVER_NOT_EXPORTED);
  refreshCurrent();
  lease.start();
 }
 static void attach(AlphaListeningChipView view){views.add(view);if(instance!=null)instance.refreshCurrent();else view.render(false);}
 static void detach(AlphaListeningChipView view){views.remove(view);surfaceChanged();}
 static void surfaceChanged(){if(instance!=null)instance.lease.now();}
 /** Main thread: what SystemUI itself measures. Unverified identity or user switching acknowledges nothing. */
 private AlphaListeningLease.Acknowledgement acknowledgement(){
  boolean admitted=uid!=-1&&!users.isUserSwitching()&&users.getUserId()==0;
  boolean surface=false,chip=false;
  for(AlphaListeningChipView view:views){boolean shown=view.chipVisible();chip|=shown;surface|=shown||view.hostVisible();}
  return new AlphaListeningLease.Acknowledgement(admitted?uid:-1,surface,chip,active);
 }
 private void publish(){for(AlphaListeningChipView view:new ArrayList<>(views))view.render(active);lease.now();}
 private void refreshCurrent(){try{refresh(audio.getActiveRecordingConfigurations());}catch(RuntimeException unavailable){uid=-1;active=false;publish();}}
 private int verifiedUid(){
  try{
   if(users.isUserSwitching())return -1;
   PackageManager pm=context.getPackageManager();PackageInfo pkg=pm.getPackageInfoAsUser(AlphaListeningPolicy.PACKAGE,PackageManager.GET_SIGNING_CERTIFICATES,0);
   ApplicationInfo app=pkg.applicationInfo;Signature[] signers=pkg.signingInfo==null?null:pkg.signingInfo.getApkContentsSigners();
   if(signers==null||signers.length!=1||!app.enabled)return -1;
   StringBuilder digest=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(signers[0].toByteArray()))digest.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
   String[] packages=pm.getPackagesForUid(app.uid);
   boolean accepted=AlphaListeningPolicy.identity(app.uid,users.getUserId(),UserHandle.getUserId(app.uid)==0,
    (app.flags&ApplicationInfo.FLAG_SYSTEM)!=0,(app.privateFlags&ApplicationInfo.PRIVATE_FLAG_PRIVILEGED)!=0,
    context.getString(R.string.config_alphaListeningCertificateSha256),digest.toString(),
    pm.checkSignatures(AlphaListeningPolicy.PACKAGE,"ai.elizaresearch.alphaphone")==PackageManager.SIGNATURE_MATCH,
    packages!=null&&packages.length==1&&AlphaListeningPolicy.PACKAGE.equals(packages[0]));
   return accepted?app.uid:-1;
  }catch(Exception unavailable){return -1;}
 }
 private void refresh(List<AudioRecordingConfiguration> configs){
  uid=verifiedUid();active=false;
  if(uid!=-1)for(AudioRecordingConfiguration config:configs)if(AlphaListeningPolicy.recording(uid,config.getClientUid(),config.isClientSilenced())){active=true;break;}
  publish();
 }
 static boolean pause(){return instance!=null&&instance.pauseCurrent();}
 private boolean pauseCurrent(){
  refreshCurrent();if(!active||uid<0)return false;
  try{
   StatusBarNotification[] entries=notifications.getActiveNotifications();if(entries==null)return false;
   PendingIntent chosen=null;
   for(StatusBarNotification entry:entries){Notification notification=entry.getNotification();if(notification.actions==null)continue;
    for(Notification.Action action:notification.actions){PendingIntent token=action.actionIntent;if(token==null)continue;
     Intent target=token.getIntent();
     if(target==null||!"ai.elizaresearch.alphaphone.sense.action.PAUSE".equals(target.getAction())
       ||!new ComponentName(AlphaListeningPolicy.PACKAGE,AlphaListeningPolicy.PACKAGE+".ListenerActionReceiver").equals(target.getComponent())
       ||target.getData()!=null||target.getClipData()!=null||target.getExtras()!=null)continue;
     if(AlphaListeningPolicy.pause(uid,entry.getUid(),entry.getPackageName(),entry.getId(),notification.getChannelId(),token.getCreatorUid(),token.getCreatorPackage(),token.isImmutable(),token.isBroadcast(),action.isAuthenticationRequired(),action.getExtras().getString(AlphaListeningPolicy.ACTION_KEY))){if(chosen!=null)return false;chosen=token;}
    }
   }
   if(chosen==null||verifiedUid()!=uid)return false;
   chosen.send(); // No fill-in Intent, extras, resume action, provider call or shared signer assumption.
   return true; // Keep indicator visible until AudioManager confirms recording has stopped.
  }catch(Exception unavailable){return false;}
 }
}
