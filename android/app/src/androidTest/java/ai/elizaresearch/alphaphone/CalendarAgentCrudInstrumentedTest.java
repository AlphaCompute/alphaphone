package ai.elizaresearch.alphaphone;

import android.Manifest;
import android.content.ContentUris;
import android.content.Context;
import android.database.Cursor;
import android.os.SystemClock;
import android.provider.CalendarContract;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Real exported native operation boundary. Server queue exercised separately over real SQL/HTTP. */
@RunWith(AndroidJUnit4.class)
public class CalendarAgentCrudInstrumentedTest {
 private String eval(String script)throws Exception{return WebViewTestDriver.evaluate(script);}
 private void until(String condition)throws Exception{for(int i=0;i<150;i++){if("true".equals(eval("Boolean("+condition+")")))return;SystemClock.sleep(100);}fail("Missing Calendar native fixture condition");}
 private void nativeClick(String label)throws Exception{for(int i=0;i<120;i++){String early=eval("window.__calendarAgentResult ? JSON.stringify({status:window.__calendarAgentResult.status,error:window.__calendarAgentResult.error}) : null");if(!"null".equals(early))fail("Calendar operation settled before review control "+label+": "+early);AccessibilityNodeInfo root=InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow();if(root!=null){java.util.ArrayDeque<AccessibilityNodeInfo> queue=new java.util.ArrayDeque<>();queue.add(root);while(!queue.isEmpty()){AccessibilityNodeInfo node=queue.removeFirst();if(node.getText()!=null&&label.equalsIgnoreCase(node.getText().toString())&&node.isVisibleToUser()&&node.isClickable()&&node.performAction(AccessibilityNodeInfo.ACTION_CLICK))return;for(int child=0;child<node.getChildCount();child++){AccessibilityNodeInfo value=node.getChild(child);if(value!=null)queue.add(value);}}}SystemClock.sleep(100);}fail("Native Calendar control missing: "+label);}
 private JSONObject result()throws Exception{until("window.__calendarAgentResult");JSONObject value=new JSONObject(eval("window.__calendarAgentResult"));assertFalse(value.has("error"));if("applied".equals(value.optString("status"))||"cancelled".equals(value.optString("status")))assertReviewReleased();return value;}
 private void assertReviewReleased()throws Exception{WebViewTestDriver.withActivity(MainActivity.class,activity->{try{AlphaCalendarPlugin plugin=(AlphaCalendarPlugin)activity.getBridge().getPlugin("AlphaCalendar").getInstance();java.lang.reflect.Field busy=ai.eliza.plugins.calendar.CalendarPlugin.class.getDeclaredField("deleting"),dialog=ai.eliza.plugins.calendar.CalendarPlugin.class.getDeclaredField("deleteDialog");busy.setAccessible(true);dialog.setAccessible(true);assertFalse("Terminal receipt must release native review gate",((java.util.concurrent.atomic.AtomicBoolean)busy.get(plugin)).get());assertNull("Terminal receipt must follow dialog dismissal",dialog.get(plugin));}catch(ReflectiveOperationException error){throw new AssertionError(error);}});}
 // A dialog receipt confirms dismissal, but the Activity can regain focus a frame later.
 // Wait before a new reviewed request; never retry an operation that already settled.
 private void awaitReviewForeground()throws Exception{
  long deadline=SystemClock.elapsedRealtime()+15000;
  while(SystemClock.elapsedRealtime()<deadline){
   boolean[] ready={false};
   WebViewTestDriver.withActivity(MainActivity.class,activity->{ready[0]=!activity.isFinishing()&&!activity.isDestroyed()&&activity.hasWindowFocus();});
   if(ready[0])return;
   SystemClock.sleep(100);
  }
  fail("Alpha Activity did not regain foreground focus before Calendar review");
 }
 private void begin(JSONObject operation)throws Exception{awaitReviewForeground();eval("window.__calendarAgentResult=null;Capacitor.Plugins.AlphaCalendar.executeAgent({operation:"+operation+",operationId:"+JSONObject.quote(java.util.UUID.randomUUID().toString())+"}).then(value=>window.__calendarAgentResult=value,error=>window.__calendarAgentResult={error:String(error)})");}
 private JSONObject perform(JSONObject operation,String button)throws Exception{begin(operation);nativeClick(button);return result();}
 private boolean exists(Context context,long id){try(Cursor row=context.getContentResolver().query(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,id),new String[]{CalendarContract.Events.DELETED},null,null,null)){return row!=null&&row.moveToFirst()&&row.getInt(0)==0;}}
 @Test public void reviewedNativeCreateReadUpdateDeleteAndStaleRevision()throws Exception{
  org.junit.Assume.assumeTrue("Explicit synthetic agent Calendar gate", "1".equals(InstrumentationRegistry.getArguments().getString("calendarAgent")));
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();for(String permission:new String[]{Manifest.permission.READ_CALENDAR,Manifest.permission.WRITE_CALENDAR})InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(context.getPackageName(),permission);
  long id=0;
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();until("document.documentElement.dataset.activeView");eval(AppNavigation.request("Calendar"));until(AppNavigation.selected("Calendar"));
   eval("window.__calendarAgentResult=null;Capacitor.Plugins.AlphaCalendar.prepareAgentSource().then(value=>window.__calendarAgentResult=value)");JSONObject prepared=result();assertEquals("ready",prepared.getString("status"));JSONObject source=new JSONObject().put("sourceId",prepared.getString("sourceId")).put("sourceRevision",prepared.getString("sourceRevision"));
   long begin=System.currentTimeMillis()+3600000;java.time.format.DateTimeFormatter format=new java.time.format.DateTimeFormatterBuilder().appendInstant(3).toFormatter();JSONObject fields=new JSONObject().put("title","Agent Calendar "+java.util.UUID.randomUUID()).put("description","Synthetic approved body").put("location","Fixture").put("start",format.format(java.time.Instant.ofEpochMilli(begin))).put("end",format.format(java.time.Instant.ofEpochMilli(begin+3600000))).put("timeZone","UTC");
   JSONObject created=perform(new JSONObject().put("type","calendar_create").put("source",source).put("fields",fields),"Create event");assertEquals("applied",created.getString("status"));JSONObject receipt=created.getJSONObject("result");id=Long.parseLong(receipt.getString("eventId"));assertTrue(exists(context,id));
   JSONObject target=new JSONObject(source.toString()).put("eventId",Long.toString(id)).put("revision",receipt.getString("revision"));
   JSONObject read=perform(new JSONObject().put("type","calendar_read_selected").put("target",target),"Share with agent");assertEquals(fields.getString("description"),read.getJSONObject("result").getJSONObject("fields").getString("description"));
   JSONObject changed=new JSONObject(fields.toString()).put("title",fields.getString("title")+" edited");JSONObject updated=perform(new JSONObject().put("type","calendar_update").put("target",target).put("fields",changed),"Update event");assertEquals("applied",updated.getString("status"));assertEquals(Long.toString(id),updated.getJSONObject("result").getString("eventId"));assertNotEquals(target.getString("revision"),updated.getJSONObject("result").getString("revision"));
   begin(new JSONObject().put("type","calendar_delete").put("target",target));assertEquals("conflict",result().getString("status"));assertTrue(exists(context,id));
   target.put("revision",updated.getJSONObject("result").getString("revision"));JSONObject deletion=new JSONObject().put("type","calendar_delete").put("target",target);assertEquals("cancelled",perform(deletion,"Cancel").getString("status"));assertTrue(exists(context,id));
   JSONObject deleted=perform(deletion,"Delete event");assertEquals("applied",deleted.getString("status"));assertEquals(target.getString("revision"),deleted.getJSONObject("result").getString("revision"));assertFalse(exists(context,id));
  }finally{if(id>0)context.getContentResolver().delete(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,id),null,null);}
 }
}
