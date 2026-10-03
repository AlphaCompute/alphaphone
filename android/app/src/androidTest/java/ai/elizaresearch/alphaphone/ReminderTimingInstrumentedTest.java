package ai.elizaresearch.alphaphone;

import android.Manifest;
import android.app.PendingIntent;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.UUID;
import static org.junit.Assert.*;

/** Two independently owned secondary-user phases: denied permission and granted permission. */
@RunWith(AndroidJUnit4.class)
public class ReminderTimingInstrumentedTest {
 private final ArrayList<String> ids=new ArrayList<>(),operations=new ArrayList<>();
 private final String binding=ReminderStore.digest("synthetic explicit timing fixture");
 private Context admitted(String phase){
  org.junit.Assume.assumeTrue("Owned timing fixture required",phase.equals(InstrumentationRegistry.getArguments().getString("reminderTiming")));
  Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();assertTrue("Secondary user only",android.os.Process.myUid()/100000>0);return c;
 }
 private String id(){String id="timing_"+UUID.randomUUID();ids.add(id);return id;}
 private JSONObject timing(long due,Object lead)throws Exception{return new JSONObject().put("dueAt",due).put("alertMinutes",lead);}
 private JSONObject operate(Context c,String id,String type,JSONObject fields)throws Exception{
  JSONObject op=new JSONObject().put("type",type).put("target",ReminderStore.selected(c,id));if(fields!=null)op.put("fields",fields);
  String key=UUID.randomUUID().toString();operations.add(key);JSONObject result=ReminderStore.operate(c,key,binding,op);
  assertEquals("succeeded",result.getString("status"));assertEquals(result.toString(),ReminderStore.operate(c,key,binding,op).toString());assertEquals(result.toString(),ReminderStore.operationReceipt(c,key,binding,op).toString());return result.getJSONObject("result");
 }
 private PendingIntent alarm(Context c,String id,String occurrence){return PendingIntent.getBroadcast(c,0,new Intent(c,ReminderReceiver.class).setAction("ai.elizaresearch.alphaphone.REMIND").setData(Uri.parse("alpha-reminder:"+id+"/"+occurrence)),PendingIntent.FLAG_NO_CREATE|PendingIntent.FLAG_IMMUTABLE);}
 private void noNotification(Context c,String id){for(android.service.notification.StatusBarNotification n:c.getSystemService(NotificationManager.class).getActiveNotifications())assertNotEquals(id,n.getTag());}
 private void cleanup(Context c)throws Exception{
  for(String id:ids)ReminderStore.cancel(c,id);
  synchronized(ReminderStore.class){ReminderEnvelope e=new ReminderEnvelope(c);for(String id:ids)e.value.getJSONObject("records").remove(id);for(String op:operations)e.value.getJSONObject("operations").remove(op);e.save();}
 }
 private JSONObject bridge(JSONObject args)throws Exception{return bridge("scheduleReminder",args);}
 private JSONObject bridge(String method,JSONObject args)throws Exception{
  WebViewTestDriver.evaluate("window.__timingResult=null;Capacitor.nativePromise('DailyApps','"+method+"',"+args+").then(value=>window.__timingResult=value,()=>window.__timingResult={rejected:true})");
  long end=SystemClock.elapsedRealtime()+20000;
  while(SystemClock.elapsedRealtime()<end){String result=WebViewTestDriver.evaluate("window.__timingResult");if(!"null".equals(result))return new JSONObject(result);SystemClock.sleep(100);}throw new AssertionError("Native reminder save did not resolve without permission interaction");
 }
 @Test public void noAlertBridgeWithoutPermissionRestoresAndCompletesWithoutDelivery()throws Exception{
  Context c=admitted("none");assertEquals(PackageManager.PERMISSION_DENIED,c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS));assertFalse(ReminderStore.allowed(c));
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();JSONObject surface=bridge("surfaceInfo",new JSONObject());assertTrue("Timing capability must be numeric",surface.get("reminderTimingVersion") instanceof Number);assertEquals(2,surface.getInt("reminderTimingVersion"));String id=id();long due=System.currentTimeMillis()+3600000;
   JSONObject response=bridge(new JSONObject().put("id",id).put("title","No alert native fixture").put("body","Synthetic only").put("at",due).put("dueAt",due).put("alertMinutes",JSONObject.NULL));
   assertEquals("pending",response.getString("status"));assertEquals("none",response.getString("mode"));assertTrue(response.isNull("alertMinutes"));
   JSONObject row=ReminderStore.read(c,id);assertEquals(due,row.getLong("dueAt"));assertEquals(due,row.getLong("at"));assertEquals(2,ReminderStore.selected(c,id).getInt("timingVersion"));assertNull(alarm(c,id,row.getString("occurrenceId")));
   ReminderStore.restore(c);ReminderStore.deliver(c,id,row.getString("occurrenceId"));assertEquals(row.toString(),ReminderStore.read(c,id).toString());assertNull(alarm(c,id,row.getString("occurrenceId")));noNotification(c,id);
   // Even a stale scheduled flag cannot turn an explicit None record into an alarm.
   JSONObject inconsistent=new JSONObject(row.toString()).put("status","scheduled");assertTrue(new ReminderEnvelope(c).records().edit().putString(id,inconsistent.toString()).commit());
   ReminderStore.restore(c);ReminderStore.deliver(c,id,row.getString("occurrenceId"));assertNull(alarm(c,id,row.getString("occurrenceId")));noNotification(c,id);assertTrue(new ReminderEnvelope(c).records().edit().putString(id,row.toString()).commit());
   String invalid=id();JSONObject invalidResponse=bridge(new JSONObject().put("id",invalid).put("title","Malformed explicit timing").put("at",due).put("dueAt",due));assertEquals("failed",invalidResponse.getString("status"));assertNull(ReminderStore.read(c,invalid));
   JSONObject read=operate(c,id,"reminder_read_selected",null);assertTrue(read.isNull("alertMinutes"));assertEquals(due,read.getJSONObject("fields").getJSONObject("schedule").getLong("dueAt"));
   try{ReminderStore.decide(c,id,row.getString("occurrenceId"),"snooze");fail("No-alert snooze accepted");}catch(IllegalArgumentException expected){}assertEquals(row.toString(),ReminderStore.read(c,id).toString());
   assertEquals("completed",operate(c,id,"reminder_complete",null).getString("status"));assertEquals(due,ReminderStore.read(c,id).getJSONArray("history").getJSONObject(0).getLong("dueAt"));
   String recurring=id();java.time.ZonedDateTime civil=java.time.ZonedDateTime.now(java.time.ZoneId.of("UTC")).plusDays(1).withHour(12).withMinute(0).withSecond(0).withNano(0);long first=civil.toInstant().toEpochMilli();
   JSONObject repeat=new JSONObject().put("rule","daily").put("zone","UTC").put("date",civil.toLocalDate().toString()).put("time","12:00").put("leadMinutes",0);
   try{ReminderStore.schedule(c,recurring,"Bad silent repeat","",first,new JSONObject(repeat.toString()).put("leadMinutes",10),timing(first,JSONObject.NULL));fail("None repeat lead accepted");}catch(IllegalArgumentException expected){}assertNull(ReminderStore.read(c,recurring));
   try{ReminderStore.schedule(c,recurring,"Mismatched civil due","",first+60000,repeat,timing(first+60000,JSONObject.NULL));fail("Civil due mismatch accepted");}catch(IllegalArgumentException expected){}assertNull(ReminderStore.read(c,recurring));
   ReminderStore.schedule(c,recurring,"Silent repeat","",first,repeat,timing(first,JSONObject.NULL));
   JSONObject completed=operate(c,recurring,"reminder_complete",null),next=ReminderStore.read(c,recurring);assertEquals("pending",completed.getString("status"));assertEquals("none",next.getString("mode"));assertEquals(first+86400000,next.getLong("dueAt"));assertEquals(next.getLong("dueAt"),next.getLong("at"));assertNull(alarm(c,recurring,next.getString("occurrenceId")));ReminderStore.restore(c);ReminderStore.deliver(c,recurring,next.getString("occurrenceId"));noNotification(c,recurring);
   assertEquals(PackageManager.PERMISSION_DENIED,c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS));assertFalse(ReminderStore.allowed(c));
  }finally{cleanup(c);}
 }
 @Test public void numericLeadDueTimeStaleTargetsAndLegacyReceiptsRemainBound()throws Exception{
  Context c=admitted("numeric");ReminderStore.channel(c);assertTrue(ReminderStore.allowed(c));
  try{
   String id=id();long due=System.currentTimeMillis()+7200000,at=due-600000;
   JSONObject row=ReminderStore.schedule(c,id,"Ten minutes before","",at,null,timing(due,10));assertEquals(due,row.getLong("dueAt"));assertEquals(10,row.getInt("alertMinutes"));assertNotNull(alarm(c,id,row.getString("occurrenceId")));
   JSONObject target=ReminderStore.selected(c,id);operate(c,id,"reminder_snooze",null);assertEquals(due,ReminderStore.read(c,id).getLong("dueAt"));JSONObject afterSnooze=operate(c,id,"reminder_read_selected",null);assertEquals(10,afterSnooze.getInt("alertMinutes"));assertEquals(at,afterSnooze.getJSONObject("fields").getJSONObject("schedule").getLong("at"));long snoozeDeadline=afterSnooze.getLong("at");assertEquals(ReminderStore.read(c,id).getLong("at"),snoozeDeadline);operate(c,id,"reminder_update",new JSONObject().put("title","Metadata after snooze").put("body","Keep actual deadline"));assertEquals(snoozeDeadline,ReminderStore.read(c,id).getLong("at"));assertEquals(due,ReminderStore.read(c,id).getLong("dueAt"));assertEquals(10,ReminderStore.read(c,id).getInt("alertMinutes"));
   JSONObject schedule=timing(due,JSONObject.NULL).put("at",due).put("recurrence",JSONObject.NULL),fields=new JSONObject().put("title","Reviewed no alert").put("body","").put("schedule",schedule);
   JSONObject none=operate(c,id,"reminder_update",fields);assertEquals("pending",none.getString("status"));assertTrue(none.isNull("alertMinutes"));assertNull(alarm(c,id,none.getString("occurrenceId")));
   ReminderStore.deliver(c,id,row.getString("occurrenceId"));ReminderStore.deliver(c,id,none.getString("occurrenceId"));ReminderStore.restore(c);assertEquals("pending",ReminderStore.read(c,id).getString("status"));noNotification(c,id);
   String retained=ReminderStore.read(c,id).toString();try{ReminderStore.operate(c,UUID.randomUUID().toString(),binding,new JSONObject().put("type","reminder_update").put("target",target).put("fields",fields));fail("Stale timing target accepted");}catch(IllegalArgumentException expected){}assertEquals(retained,ReminderStore.read(c,id).toString());
   for(JSONObject invalid:new JSONObject[]{new JSONObject().put("dueAt",due),new JSONObject().put("alertMinutes",0),timing(due,"10"),timing(due,0.5),timing(due,10081),timing(due-1,10)}){try{ReminderStore.schedule(c,id,"Must not replace","",at,null,invalid);fail("Malformed timing accepted");}catch(IllegalArgumentException expected){}assertEquals(retained,ReminderStore.read(c,id).toString());}
   try{ReminderStore.schedule(c,id,"Legacy overwrite refused","",due);fail("Legacy call removed explicit timing");}catch(IllegalArgumentException expected){}assertEquals(retained,ReminderStore.read(c,id).toString());
   JSONObject downgrade=new JSONObject().put("type","reminder_update").put("target",ReminderStore.selected(c,id)).put("fields",new JSONObject().put("title","Downgrade refused").put("body","").put("schedule",new JSONObject().put("at",due).put("recurrence",JSONObject.NULL)));
   try{ReminderStore.operate(c,UUID.randomUUID().toString(),binding,downgrade);fail("Canonical downgrade removed explicit timing");}catch(IllegalArgumentException expected){}assertEquals(retained,ReminderStore.read(c,id).toString());
   String legacy=id();ReminderStore.schedule(c,legacy,"Legacy unchanged","",due);JSONObject old=operate(c,legacy,"reminder_read_selected",null);assertFalse(old.has("alertMinutes"));assertFalse(old.has("dueAt"));assertFalse(ReminderStore.selected(c,legacy).has("timingVersion"));assertFalse(old.getJSONObject("fields").getJSONObject("schedule").has("alertMinutes"));
   JSONObject legacyRead=new JSONObject().put("type","reminder_read_selected").put("target",ReminderStore.selected(c,legacy));String legacyOp=UUID.randomUUID().toString();operations.add(legacyOp);String historical=ReminderStore.operate(c,legacyOp,binding,legacyRead).toString();
   operate(c,legacy,"reminder_update",new JSONObject().put("title","Explicit timing upgrade").put("body","").put("schedule",timing(due,JSONObject.NULL).put("at",due).put("recurrence",JSONObject.NULL)));
   assertEquals(historical,ReminderStore.operate(c,legacyOp,binding,legacyRead).toString());assertEquals(historical,ReminderStore.operationReceipt(c,legacyOp,binding,legacyRead).toString());
  }finally{cleanup(c);}
 }
}
