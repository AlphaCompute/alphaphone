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
   JSONObject cancel=new JSONObject().put("type","reminder_cancel").put("target",ReminderStore.selected(c,id));String cancelId=UUID.randomUUID().toString();operations.add(cancelId);
   assertEquals("cancelled",ReminderStore.operate(c,cancelId,binding,cancel).getJSONObject("result").getString("status"));
   assertEquals("cancelled",ReminderStore.read(c,id).getString("status"));
  } finally {
   ReminderStore.cancel(c,id);
   synchronized(ReminderStore.class){ReminderEnvelope store=new ReminderEnvelope(c);store.value.getJSONObject("records").remove(id);for(String op:operations)store.value.getJSONObject("operations").remove(op);store.save();}
   assertNull(ReminderStore.read(c,id));
  }
 }
}
