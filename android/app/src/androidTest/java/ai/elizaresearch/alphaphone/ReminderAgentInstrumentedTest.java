package ai.elizaresearch.alphaphone;

import android.content.Context;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.UUID;
import static org.junit.Assert.*;

/** Owned synthetic records only. Real Android store and AlarmManager; no timing/clock changes. */
@RunWith(AndroidJUnit4.class)
public class ReminderAgentInstrumentedTest {
 @Test public void receiptSurvivesActualProcessReplacement()throws Exception {
  String phase=InstrumentationRegistry.getArguments().getString("reminderAgentPhase","");org.junit.Assume.assumeTrue("Use owned prepare/verify/cleanup campaign",!phase.isEmpty());
  Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();android.content.SharedPreferences fixture=c.getSharedPreferences("alpha-reminder-agent-process-fixture",0);
  String binding=ReminderStore.digest("synthetic-process-owner-device");
  if(phase.equals("prepare")){
   assertFalse("Prior fixture requires cleanup",fixture.contains("id"));assertTrue(ReminderStore.allowed(c));
   String id="agent_process_"+UUID.randomUUID(),op=UUID.randomUUID().toString();assertTrue(fixture.edit().putString("id",id).putString("op",op).putInt("pid",android.os.Process.myPid()).commit());
   ReminderStore.schedule(c,id,"Process replacement fixture","Synthetic only",System.currentTimeMillis()+3600000);
   JSONObject operation=new JSONObject().put("type","reminder_snooze").put("target",ReminderStore.selected(c,id));assertTrue(fixture.edit().putString("operation",operation.toString()).commit());
   JSONObject result=ReminderStore.operate(c,op,binding,operation);assertEquals("succeeded",result.getString("status"));assertTrue(fixture.edit().putString("result",result.toString()).commit());
  }else if(phase.equals("verify")){
   assertTrue(fixture.contains("result"));assertNotEquals("Runner must replace process",fixture.getInt("pid",0),android.os.Process.myPid());
   JSONObject receipt=ReminderStore.operationReceipt(c,fixture.getString("op",null),binding,new JSONObject(fixture.getString("operation",null)));
   assertEquals(fixture.getString("result",null),receipt.toString());assertEquals(receipt.getJSONObject("result").getLong("at"),ReminderStore.read(c,fixture.getString("id",null)).getLong("at"));
  }else if(phase.equals("cleanup")){
   String id=fixture.getString("id",null),op=fixture.getString("op",null);if(id!=null){assertTrue(id.startsWith("agent_process_"));ReminderStore.cancel(c,id);synchronized(ReminderStore.class){ReminderEnvelope store=new ReminderEnvelope(c);store.value.getJSONObject("records").remove(id);if(op!=null)store.value.getJSONObject("operations").remove(op);store.save();}}
   assertTrue(fixture.edit().clear().commit());
  }else fail("Unknown reminder process phase");
 }
 @Test public void legacyMigrationRetainsRawRecordsAndOccurrenceIdentity()throws Exception {
  Context base=InstrumentationRegistry.getInstrumentation().getTargetContext();String prefix="reminder_migration_"+UUID.randomUUID();
  Context c=new android.content.ContextWrapper(base){@Override public android.content.SharedPreferences getSharedPreferences(String name,int mode){return super.getSharedPreferences(prefix+"_"+name,mode);}};
  android.content.SharedPreferences legacy=c.getSharedPreferences("alpha-local-reminders-v1",0);
  String id="legacy_fixture",raw=new JSONObject().put("id",id).put("title","Original legacy title").put("body","Original legacy body").put("at",2000000000000L).put("createdAt",1).put("status","completed").put("mode","inexact").toString();
  try {
   assertTrue(legacy.edit().putString(id,raw).putString("damaged","broken-json").putInt("wrong_type",7).commit());
   JSONObject one=ReminderStore.read(c,id),two=ReminderStore.read(c,id);assertEquals(one.toString(),two.toString());assertTrue(one.getString("occurrenceId").startsWith("legacy_"));
   ReminderEnvelope envelope=new ReminderEnvelope(c);assertEquals(raw,envelope.value.getJSONObject("legacyArchive").getString(id));assertEquals(raw,envelope.value.getJSONObject("records").getString(id));assertEquals("broken-json",envelope.value.getJSONObject("records").getString("damaged"));assertEquals(7,envelope.value.getJSONObject("records").getInt("wrong_type"));
   JSONObject op=new JSONObject().put("type","reminder_read_selected").put("target",ReminderStore.selected(c,id));
   JSONObject result=ReminderStore.operate(c,"migration_read",ReminderStore.digest("synthetic migration owner"),op);assertEquals("succeeded",result.getString("status"));
   assertEquals(1,ReminderStore.list(c).length());assertEquals(3,new ReminderEnvelope(c).value.getJSONObject("records").length());assertEquals(1,new ReminderEnvelope(c).value.getJSONObject("operations").length());assertEquals(raw,legacy.getString(id,null));
  }finally{assertTrue(legacy.edit().clear().commit());assertTrue(c.getSharedPreferences("alpha-reminder-envelope-v1",0).edit().clear().commit());}
 }
 @Test public void selectedCrudPersistsExactReceiptsAndRejectsChangedBindings()throws Exception {
  org.junit.Assume.assumeTrue("Explicit owned reminder fixture gate", "1".equals(InstrumentationRegistry.getArguments().getString("reminderAgent")));
  Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();
  assertTrue("Enable normal notification permission before this campaign",ReminderStore.allowed(c));
  String id="agent_fixture_"+UUID.randomUUID();String binding=ReminderStore.digest("synthetic-owner-device-session");ArrayList<String> operations=new ArrayList<>();
  try {
   ReminderStore.schedule(c,id,"Synthetic selected reminder","Original content",System.currentTimeMillis()+3600000);
   JSONObject target=ReminderStore.selected(c,id),read=new JSONObject().put("type","reminder_read_selected").put("target",target);
   String readId=UUID.randomUUID().toString();operations.add(readId);
   JSONObject first=ReminderStore.operate(c,readId,binding,read);assertEquals("succeeded",first.getString("status"));assertEquals("Original content",first.getJSONObject("result").getJSONObject("fields").getString("body"));
   String updateId=UUID.randomUUID().toString();operations.add(updateId);
   JSONObject update=new JSONObject().put("type","reminder_update").put("target",target).put("fields",new JSONObject().put("title","Updated synthetic reminder").put("body","Updated content"));
   assertEquals("succeeded",ReminderStore.operate(c,updateId,binding,update).getString("status"));
   assertEquals("Updated content",ReminderStore.read(c,id).getString("body"));
   // A newly constructed envelope rereads disk for every call; this must be historical content.
   assertEquals(first.toString(),ReminderStore.operate(c,readId,binding,read).toString());
   try {ReminderStore.operate(c,readId,ReminderStore.digest("wrong-owner"),read);fail("Changed binding accepted");}catch(IllegalArgumentException expected){}
   try {ReminderStore.operate(c,UUID.randomUUID().toString(),binding,update);fail("Stale target accepted");}catch(IllegalArgumentException expected){}
   JSONObject snooze=new JSONObject().put("type","reminder_snooze").put("target",ReminderStore.selected(c,id));String snoozeId=UUID.randomUUID().toString();operations.add(snoozeId);
   long before=System.currentTimeMillis();JSONObject snoozed=ReminderStore.operate(c,snoozeId,binding,snooze);long exact=snoozed.getJSONObject("result").getLong("at");assertTrue(exact>=before+600000&&exact<=System.currentTimeMillis()+600000);
   assertEquals(snoozed.toString(),ReminderStore.operate(c,snoozeId,binding,snooze).toString());assertEquals(exact,ReminderStore.read(c,id).getLong("at"));
   String occurrence=ReminderStore.read(c,id).getString("occurrenceId");
   Intent alarm=new Intent(c,ReminderReceiver.class).setAction("ai.elizaresearch.alphaphone.REMIND").setData(Uri.parse("alpha-reminder:"+id+"/"+occurrence));
   assertNotNull("Real scheduled PendingIntent",PendingIntent.getBroadcast(c,0,alarm,PendingIntent.FLAG_NO_CREATE|PendingIntent.FLAG_IMMUTABLE));
   JSONObject done=new JSONObject().put("type","reminder_complete").put("target",ReminderStore.selected(c,id));String doneId=UUID.randomUUID().toString();operations.add(doneId);
   assertEquals("completed",ReminderStore.operate(c,doneId,binding,done).getJSONObject("result").getString("status"));
   ReminderStore.deliver(c,id,occurrence);assertEquals("completed",ReminderStore.read(c,id).getString("status"));
   JSONObject completedRow=ReminderStore.read(c,id);
   JSONObject metadata=new JSONObject().put("type","reminder_update").put("target",ReminderStore.selected(c,id)).put("fields",new JSONObject().put("title","Completed metadata edit").put("body","Completion must survive"));
   String metadataId=UUID.randomUUID().toString();operations.add(metadataId);
   JSONObject metadataReceipt=ReminderStore.operate(c,metadataId,binding,metadata);
   assertEquals("succeeded",metadataReceipt.getString("status"));assertEquals("completed",metadataReceipt.getJSONObject("result").getString("status"));
   assertEquals(occurrence,ReminderStore.read(c,id).getString("occurrenceId"));assertEquals(completedRow.getLong("at"),ReminderStore.read(c,id).getLong("at"));
   assertEquals(completedRow.getLong("completedAt"),ReminderStore.read(c,id).getLong("completedAt"));assertEquals(completedRow.getJSONArray("history").toString(),ReminderStore.read(c,id).getJSONArray("history").toString());
   long reviewedAt=System.currentTimeMillis()+7200000;
   JSONObject reschedule=new JSONObject().put("type","reminder_update").put("target",ReminderStore.selected(c,id)).put("fields",new JSONObject().put("title","Explicit new occurrence").put("body","Reviewed reschedule").put("schedule",new JSONObject().put("at",reviewedAt).put("recurrence",JSONObject.NULL)));
   String rescheduleId=UUID.randomUUID().toString();operations.add(rescheduleId);
   JSONObject rescheduled=ReminderStore.operate(c,rescheduleId,binding,reschedule);assertEquals("succeeded",rescheduled.getString("status"));assertEquals("scheduled",rescheduled.getJSONObject("result").getString("status"));
   String newOccurrence=ReminderStore.read(c,id).getString("occurrenceId");assertNotEquals(occurrence,newOccurrence);assertEquals(reviewedAt,ReminderStore.read(c,id).getLong("at"));
   assertFalse(ReminderStore.read(c,id).has("completedAt"));assertEquals(completedRow.getJSONArray("history").toString(),ReminderStore.read(c,id).getJSONArray("history").toString());
   Intent newAlarm=new Intent(c,ReminderReceiver.class).setAction("ai.elizaresearch.alphaphone.REMIND").setData(Uri.parse("alpha-reminder:"+id+"/"+newOccurrence));
   assertNotNull("New occurrence has a real scheduled PendingIntent",PendingIntent.getBroadcast(c,0,newAlarm,PendingIntent.FLAG_NO_CREATE|PendingIntent.FLAG_IMMUTABLE));
   assertEquals(rescheduled.toString(),ReminderStore.operate(c,rescheduleId,binding,reschedule).toString());assertEquals(rescheduled.toString(),ReminderStore.operationReceipt(c,rescheduleId,binding,reschedule).toString());
   assertEquals(newOccurrence,ReminderStore.read(c,id).getString("occurrenceId"));assertEquals(reviewedAt,ReminderStore.read(c,id).getLong("at"));
   try{ReminderStore.operate(c,UUID.randomUUID().toString(),binding,reschedule);fail("Stale reschedule target accepted");}catch(IllegalArgumentException expected){}
   String beforeOldDelivery=ReminderStore.read(c,id).toString();ReminderStore.deliver(c,id,occurrence);assertEquals(beforeOldDelivery,ReminderStore.read(c,id).toString());
   JSONObject cancel=new JSONObject().put("type","reminder_cancel").put("target",ReminderStore.selected(c,id));String cancelId=UUID.randomUUID().toString();operations.add(cancelId);
   assertEquals("cancelled",ReminderStore.operate(c,cancelId,binding,cancel).getJSONObject("result").getString("status"));
   assertEquals("cancelled",ReminderStore.read(c,id).getString("status"));
   String cancelledSnapshot=ReminderStore.read(c,id).toString();int receiptCount=new ReminderEnvelope(c).value.getJSONObject("operations").length();
   for(boolean scheduleUpdate:new boolean[]{false,true}){
    JSONObject fields=new JSONObject().put("title","Must not revive cancellation").put("body","");if(scheduleUpdate)fields.put("schedule",new JSONObject().put("at",reviewedAt+3600000).put("recurrence",JSONObject.NULL));
    JSONObject cancelledUpdate=new JSONObject().put("type","reminder_update").put("target",ReminderStore.selected(c,id)).put("fields",fields);String rejectedId=UUID.randomUUID().toString();operations.add(rejectedId);
    try{ReminderStore.operate(c,rejectedId,binding,cancelledUpdate);fail("Cancelled reminder edit accepted");}catch(IllegalArgumentException expected){}
    assertEquals("unknown",ReminderStore.operationReceipt(c,rejectedId,binding,cancelledUpdate).getString("status"));assertEquals(cancelledSnapshot,ReminderStore.read(c,id).toString());assertEquals(receiptCount,new ReminderEnvelope(c).value.getJSONObject("operations").length());
   }
  } finally {
   ReminderStore.cancel(c,id);
   synchronized(ReminderStore.class){ReminderEnvelope store=new ReminderEnvelope(c);store.value.getJSONObject("records").remove(id);for(String op:operations)store.value.getJSONObject("operations").remove(op);store.save();}
   assertNull(ReminderStore.read(c,id));
  }
 }
}
