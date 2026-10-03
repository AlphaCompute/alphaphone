package ai.elizaresearch.alphaphone;

import android.app.*;
import android.content.*;
import android.os.SystemClock;
import android.service.notification.StatusBarNotification;
import android.system.Os;
import android.system.OsConstants;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.junit.Assert.*;

/** Runs only in the separate instrumentation host; main dies while the test remains alive. */
public final class ReminderTapProcessDeathInstrumentedTest {
 private static final String APP="ai.elizaresearch.alphaphone";
 private static final class Identity {
  final int pid,uid;final String start,argvState;final boolean argvReady;
  Identity(int pid)throws Exception {
   this.pid=pid;
   String status=new String(Files.readAllBytes(Path.of("/proc/"+pid+"/status")), java.nio.charset.StandardCharsets.UTF_8);
   java.util.regex.Matcher match=java.util.regex.Pattern.compile("(?m)^Uid:\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*$").matcher(status);
   assertTrue("Process UID unavailable",match.find());uid=Integer.parseInt(match.group(1));
   for(int i=2;i<=4;i++)assertEquals(uid,Integer.parseInt(match.group(i)));
   assertFalse("Ambiguous UID",match.find());
   String cmdline=new String(Files.readAllBytes(Path.of("/proc/"+pid+"/cmdline")), java.nio.charset.StandardCharsets.UTF_8);
   argvReady=cmdline.startsWith(APP+"\0")&&cmdline.substring(APP.length()).chars().allMatch(ch->ch==0);
   argvState=argvReady?"expected":cmdline.isEmpty()?"empty":cmdline.startsWith(APP+"\0")?"expected-prefix-with-extra-bytes":"other";
   String stat=new String(Files.readAllBytes(Path.of("/proc/"+pid+"/stat")), java.nio.charset.StandardCharsets.UTF_8);int close=stat.lastIndexOf(')');assertTrue(close>0);
   String[] fields=stat.substring(close+2).trim().split("\\s+");assertTrue(fields.length>19);start=fields[19];assertTrue(start.matches("[0-9]+"));
   assertEquals(android.os.Process.myUid(),uid);assertNotEquals(android.os.Process.myPid(),pid);
  }
  void exact()throws Exception {Identity now=new Identity(pid);assertEquals(uid,now.uid);assertEquals(start,now.start);assertTrue("Unexpected process argv at kill boundary: "+now.argvState,now.argvReady);}
 }
 private static List<Integer> mainPids(Context context){
  List<Integer> found=new ArrayList<>();List<ActivityManager.RunningAppProcessInfo> rows=context.getSystemService(ActivityManager.class).getRunningAppProcesses();
  assertNotNull("Process inventory unavailable",rows);
  for(ActivityManager.RunningAppProcessInfo row:rows)if(APP.equals(row.processName)){assertEquals(android.os.Process.myUid(),row.uid);found.add(row.pid);}
  assertTrue("Multiple main processes",found.size()<=1);return found;
 }
 private static Identity awaitMain(Context context)throws Exception {
  long end=SystemClock.elapsedRealtime()+15000;Identity candidate=null;String argvState="not-observed";
  do{
   List<Integer> rows=mainPids(context);
   if(rows.size()==1){
    Identity current=new Identity(rows.get(0));
    if(candidate==null)candidate=current;
    else {assertEquals("Main PID changed during readiness",candidate.pid,current.pid);assertEquals(candidate.uid,current.uid);assertEquals("Main start changed during readiness",candidate.start,current.start);}
    argvState=current.argvState;if(current.argvReady)return current;
   }else if(candidate!=null)throw new AssertionError("Main disappeared during readiness");
   SystemClock.sleep(50);
  }while(SystemClock.elapsedRealtime()<end);
  throw new AssertionError("Main process readiness deadline; argv="+argvState);
 }
 private static StatusBarNotification notice(NotificationManager manager,String id){
  for(StatusBarNotification row:manager.getActiveNotifications())if(id.equals(row.getTag())&&row.getId()==0)return row;
  throw new AssertionError("Original reminder notification absent");
 }
 @Test public void capturedReminderTapSurvivesMainDeathWithoutAnotherNotificationIntent()throws Exception {
  org.junit.Assume.assumeTrue("Explicit isolated reminder process-death campaign","1".equals(InstrumentationRegistry.getArguments().getString("reminderTapProcessDeath")));
  assertEquals(APP+":workflowNoticeTest",Application.getProcessName());assertTrue(android.os.Process.myUid()/100000>0);
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  AlphaCredentialStore storage=new AlphaCredentialStore(context);assertNull("Fresh tap ledger required",storage.readCredentialSlot(ReminderTaps.SLOT));
  ReminderTaps taps=new ReminderTaps(context);NotificationManager manager=context.getSystemService(NotificationManager.class);
  String id="tap_death_"+UUID.randomUUID();
  try {
   ReminderStore.channel(context);assertTrue(ReminderStore.allowed(context));
   long at=System.currentTimeMillis()+1500;
   JSONObject scheduled=ReminderStore.schedule(context,id,"Retained reminder tap","Original OS notification body",at,null);
   while(System.currentTimeMillis()<at)SystemClock.sleep(25);
   // Delivery uses the production due-time/permission/post/persistence path once.
   ReminderStore.deliver(context,id,scheduled.getString("occurrenceId"));
   assertEquals("posted",ReminderStore.read(context,id).getString("status"));
   StatusBarNotification original=null;long noticeEnd=SystemClock.elapsedRealtime()+5000;
   do{try{original=notice(manager,id);break;}catch(AssertionError notYet){SystemClock.sleep(50);}}while(SystemClock.elapsedRealtime()<noticeEnd);
   assertNotNull(original);PendingIntent originalIntent=original.getNotification().contentIntent;assertNotNull(originalIntent);
   assertEquals(0,original.getNotification().flags&Notification.FLAG_AUTO_CANCEL);
   assertFalse(taps.pending().has("token"));
   // Exactly one original OS tap. No second tap/intent is sent after capture.
   originalIntent.send();Identity before=awaitMain(context);
   JSONObject captured=null;long captureEnd=SystemClock.elapsedRealtime()+15000;
   do{captured=taps.pending();if(captured.has("token"))break;SystemClock.sleep(25);}while(SystemClock.elapsedRealtime()<captureEnd);
   assertTrue("Main must durably capture the original tap",captured.has("token"));assertTrue(captured.getBoolean("retained"));
   assertTrue(ReminderTaps.same(ReminderStore.selected(context,id),captured.getJSONObject("target")));
   String token=captured.getString("token"),committed=storage.readCredentialSlot(ReminderTaps.SLOT);
   for(ActivityManager.AppTask task:context.getSystemService(ActivityManager.class).getAppTasks()){
    ActivityManager.RecentTaskInfo info=task.getTaskInfo();assertNotNull(info.baseIntent.getComponent());assertEquals(APP,info.baseIntent.getComponent().getPackageName());task.finishAndRemoveTask();
   }
   long tasksEnd=SystemClock.elapsedRealtime()+10000;
   while(!context.getSystemService(ActivityManager.class).getAppTasks().isEmpty()&&SystemClock.elapsedRealtime()<tasksEnd)SystemClock.sleep(50);
   assertTrue(context.getSystemService(ActivityManager.class).getAppTasks().isEmpty());
   before.exact();Os.kill(before.pid,OsConstants.SIGKILL);
   long deathEnd=SystemClock.elapsedRealtime()+10000;
   while((Files.exists(Path.of("/proc/"+before.pid))||!mainPids(context).isEmpty())&&SystemClock.elapsedRealtime()<deathEnd)SystemClock.sleep(50);
   assertFalse(Files.exists(Path.of("/proc/"+before.pid)));assertTrue("Main must be absent",mainPids(context).isEmpty());
   assertEquals(committed,storage.readCredentialSlot(ReminderTaps.SLOT));
   StatusBarNotification stillPosted=notice(manager,id);assertEquals(original.getKey(),stillPosted.getKey());assertEquals(original.getPostTime(),stillPosted.getPostTime());assertEquals(originalIntent,stillPosted.getNotification().contentIntent);
   // Normal app launch contains no reminder URI/extras: durable storage is the only route.
   Intent normal=context.getPackageManager().getLaunchIntentForPackage(APP);assertNotNull(normal);assertNull(normal.getData());assertFalse(normal.hasExtra(ReminderStore.OPEN_ID));assertFalse(normal.hasExtra(ReminderStore.OCCURRENCE));
   context.startActivity(normal);Identity after=awaitMain(context);assertTrue(before.pid!=after.pid||!before.start.equals(after.start));
   JSONObject recovered=new ReminderTaps(context).pending();assertEquals(token,recovered.getString("token"));assertTrue(recovered.getBoolean("retained"));assertTrue(ReminderTaps.same(captured.getJSONObject("target"),recovered.getJSONObject("target")));
   assertEquals(committed,storage.readCredentialSlot(ReminderTaps.SLOT));
   assertEquals(original.getPostTime(),notice(manager,id).getPostTime());
   android.os.Bundle evidence=new android.os.Bundle();evidence.putString("reminderTapProcessDeath",new JSONObject().put("beforePid",before.pid).put("beforeStart",before.start).put("afterPid",after.pid).put("afterStart",after.start).put("uid",after.uid).put("postTime",original.getPostTime()).put("notificationSends",1).put("recoveryLaunch","launcher-without-reminder-data").toString());InstrumentationRegistry.getInstrumentation().addResults(evidence);
  }finally{manager.cancel(id,0);/* Fresh-user supervisor owns all durable cleanup. */}
 }
}
