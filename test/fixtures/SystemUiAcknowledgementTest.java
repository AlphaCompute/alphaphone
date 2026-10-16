package com.android.systemui.privacy;

import android.content.Context;
import android.hardware.display.DisplayManager;
import android.media.AudioManager;
import android.os.Handler;
import android.view.Display;
import android.view.ViewGroup;
import com.android.systemui.plugins.statusbar.StatusBarStateController;
import com.android.systemui.settings.UserTracker;
import com.android.systemui.statusbar.CommandQueue;
import com.android.systemui.statusbar.NotificationListener;
import com.android.systemui.statusbar.policy.KeyguardStateController;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.concurrent.Executor;

/**
 * Host-JVM run of AlphaListeningController's acknowledgement composition through stubs: lock
 * screen and AOD (keyguard chip), unlocked status bar, expanded shade and immersive mode, and the
 * display state. Stub views report what the test sets; nothing here measures a real view.
 */
public final class SystemUiAcknowledgementTest {
 static void check(boolean value,String why){if(!value)throw new AssertionError(why);}
 static final int UID=10_042;
 static boolean locked,expanded;static int displayState=Display.STATE_ON;
 static android.service.notification.StatusBarNotification[] active=new android.service.notification.StatusBarNotification[0];

 static void show(android.view.View view,boolean on){
  view.stubAttached=on;view.stubShown=on;view.stubWindowVisibility=on?android.view.View.VISIBLE:android.view.View.GONE;
  view.stubWidth=view.stubHeight=10;view.stubVisibleWidth=view.stubVisibleHeight=on?10:0;
 }
 static AlphaListeningChipView chip(Context context,boolean keyguard,ViewGroup host){
  AlphaListeningChipView view=keyguard?new AlphaListeningChipView(context):new AlphaListeningChipView(context,null);
  view.stubParent=host;view.onVisibilityAggregated(true);return view;
 }

 public static void main(String[] args)throws Exception{
  Context context=new Context();
  Display display=new Display();
  DisplayManager displays=new DisplayManager(){@Override public Display getDisplay(int id){display.stubState=displayState;return id==Display.DEFAULT_DISPLAY?display:null;}};
  StatusBarStateController statusBar=new StatusBarStateController(){
   public boolean isExpanded(){return expanded;} public boolean isDozing(){return displayState==Display.STATE_DOZE;} public void addCallback(StateListener l){}};
  KeyguardStateController keyguard=new KeyguardStateController(){public boolean isShowing(){return locked;} public void addCallback(Callback c){}};
  UserTracker users=new UserTracker(){public int getUserId(){return 0;} public boolean isUserSwitching(){return false;} public void addCallback(Callback c,Executor e){}};
  NotificationListener notifications=new NotificationListener(){@Override public android.service.notification.StatusBarNotification[] getActiveNotifications(){return active;}};
  CommandQueue commands=new CommandQueue();
  AlphaListeningController controller=new AlphaListeningController(context,new AudioManager(),new Handler(),Runnable::run,users,notifications,statusBar,keyguard,commands,displays);
  Field uid=AlphaListeningController.class.getDeclaredField("uid");uid.setAccessible(true);uid.setInt(controller,UID);
  Field observed=AlphaListeningController.class.getDeclaredField("active");observed.setAccessible(true);observed.setBoolean(controller,true);
  Field bars=AlphaListeningController.class.getDeclaredField("systemBars");bars.setAccessible(true);CommandQueue.Callbacks systemBars=(CommandQueue.Callbacks)bars.get(controller);
  Method ack=AlphaListeningController.class.getDeclaredMethod("acknowledgement");ack.setAccessible(true);
  ViewGroup statusHost=new ViewGroup(context),lockHost=new ViewGroup(context);
  AlphaListeningChipView statusChip=chip(context,false,statusHost),lockChip=chip(context,true,lockHost);
  check(!statusChip.keyguardSurface()&&lockChip.keyguardSurface(),"inflated chip is the status bar's, code-built chip the keyguard's");
  AlphaListeningController.attach(statusChip);AlphaListeningController.attach(lockChip);
  statusChip.render(true);lockChip.render(true);
  // Unlocked, status bar shown.
  show(statusHost,true);show(statusChip,true);show(lockHost,false);show(lockChip,false);
  AlphaListeningLease.Acknowledgement a=(AlphaListeningLease.Acknowledgement)ack.invoke(controller);
  check(a.uid==UID&&a.surface&&a.chip&&a.recording&&"on".equals(a.display),"unlocked status-bar chip");
  // Immersive app hides the status bar; a transient swipe reveals it.
  systemBars.onSystemBarAttributesChanged(Display.DEFAULT_DISPLAY,0,null,false,0,0,"app",null);
  a=(AlphaListeningLease.Acknowledgement)ack.invoke(controller);
  check(!a.surface&&!a.chip,"immersive mode: the status bar is reported hidden even though its views still measure visible");
  systemBars.showTransient(Display.DEFAULT_DISPLAY,android.view.WindowInsets.Type.statusBars(),true);
  check(((AlphaListeningLease.Acknowledgement)ack.invoke(controller)).surface,"transient reveal");
  systemBars.abortTransient(Display.DEFAULT_DISPLAY,android.view.WindowInsets.Type.statusBars());
  systemBars.onSystemBarAttributesChanged(1,0,null,false,0,~0,"other display",null);
  check(!((AlphaListeningLease.Acknowledgement)ack.invoke(controller)).surface,"another display does not reset the default display");
  systemBars.onSystemBarAttributesChanged(Display.DEFAULT_DISPLAY,0,null,false,0,~0,"app",null);
  check(((AlphaListeningLease.Acknowledgement)ack.invoke(controller)).surface,"status bar shown again");
  // Shade expanded: chips are covered; only the listener's verified ongoing notification counts.
  expanded=true;
  check(!((AlphaListeningLease.Acknowledgement)ack.invoke(controller)).surface,"expanded shade without the listener notification");
  android.app.Notification note=new android.app.Notification(){@Override public String getChannelId(){return "listening-indicator";}};note.flags=android.app.Notification.FLAG_ONGOING_EVENT;
  active=new android.service.notification.StatusBarNotification[]{new android.service.notification.StatusBarNotification(){
   @Override public android.app.Notification getNotification(){return note;} @Override public int getUid(){return UID;}
   @Override public String getPackageName(){return AlphaListeningPolicy.PACKAGE;} @Override public int getId(){return 1;}}};
  a=(AlphaListeningLease.Acknowledgement)ack.invoke(controller);
  check(a.surface&&a.chip,"expanded shade showing the listener's ongoing notification");
  note.flags=0;
  check(!((AlphaListeningLease.Acknowledgement)ack.invoke(controller)).surface,"a non-ongoing notification does not count");
  expanded=false;
  // Lock screen and AOD use the keyguard chip; the status-bar chip does not count while locked.
  locked=true;
  check(!((AlphaListeningLease.Acknowledgement)ack.invoke(controller)).surface,"locked with only the status-bar chip measured");
  show(lockHost,true);show(lockChip,true);
  a=(AlphaListeningLease.Acknowledgement)ack.invoke(controller);
  check(a.surface&&a.chip&&"on".equals(a.display),"lock-screen chip");
  displayState=Display.STATE_DOZE;
  a=(AlphaListeningLease.Acknowledgement)ack.invoke(controller);
  check(a.surface&&a.chip&&"doze".equals(a.display),"AOD showing the keyguard chip");
  show(lockChip,false);show(lockHost,false);
  a=(AlphaListeningLease.Acknowledgement)ack.invoke(controller);
  check(!a.surface&&"doze".equals(a.display),"AOD not showing the chip");
  displayState=Display.STATE_OFF;
  check("off".equals(((AlphaListeningLease.Acknowledgement)ack.invoke(controller)).display),"display fully off");
  displayState=Display.STATE_UNKNOWN;
  check("off".equals(((AlphaListeningLease.Acknowledgement)ack.invoke(controller)).display),"unknown display state counts as off");
  uid.setInt(controller,-1);
  check(((AlphaListeningLease.Acknowledgement)ack.invoke(controller)).uid==-1,"unverified listener acknowledges nothing");
  System.out.println("PASS SystemUI acknowledgement: status bar, immersive, shade, lock screen, AOD, display off");
 }
}
