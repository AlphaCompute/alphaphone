package ai.elizaresearch.alphaphone;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/** Durable, encrypted execution journal. No entry is permission to execute twice. */
@CapacitorPlugin(name="AlphaActionJournal")
public final class AlphaActionJournalPlugin extends Plugin {
 private static final Object LOCK=new Object();
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private volatile boolean destroyed;
 private interface Task { JSObject run(AlphaConnectionPlugin store,String scope,String id)throws Exception; }
 private static String field(String value,String pattern){if(value==null||!value.matches(pattern))throw new IllegalArgumentException();return value;}
 private static String key(String scope,String id){return "action-journal:v1:"+scope+":entry:"+id;}
 private static boolean sameJson(Object a,Object b)throws Exception{
  if(a instanceof JSONObject&&b instanceof JSONObject){
   JSONObject left=(JSONObject)a,right=(JSONObject)b;if(left.length()!=right.length())return false;
   java.util.Iterator<String> keys=left.keys();while(keys.hasNext()){String name=keys.next();if(!right.has(name)||!sameJson(left.get(name),right.get(name)))return false;}return true;
  }
  if(a instanceof JSONArray&&b instanceof JSONArray){
   JSONArray left=(JSONArray)a,right=(JSONArray)b;if(left.length()!=right.length())return false;
   for(int i=0;i<left.length();i++)if(!sameJson(left.get(i),right.get(i)))return false;return true;
  }
  return java.util.Objects.equals(a,b);
 }
 private static JSONObject read(AlphaConnectionPlugin store,String scope,String id)throws Exception{
  String value=store.readCredentialSlot(key(scope,id));return value==null?null:new JSONObject(value);
 }
 private static JSObject response(JSONObject entry)throws Exception{
  JSObject value=new JSObject();value.put("entry",entry==null?JSONObject.NULL:entry);return value;
 }
 private void work(PluginCall call,boolean needsId,Task task){
  worker.execute(()->{
   try{
    String scope=field(call.getString("scope"),"[a-f0-9]{64}");
    String id=needsId?field(call.getString("proposalId"),"[A-Za-z0-9_-]{1,128}"):null;
    AlphaConnectionPlugin store=(AlphaConnectionPlugin)getBridge().getPlugin("AlphaConnection").getInstance();
    JSObject result; synchronized(LOCK){result=task.run(store,scope,id);}call.resolve(result);
   }catch(Exception error){call.reject("Action journal unavailable or transition rejected");}
  });
 }
 @PluginMethod public void reserve(PluginCall call){work(call,true,(store,scope,id)->{
  String operationId=field(call.getString("operationId"),"[A-Za-z0-9_-]{1,128}");
  String hash=field(call.getString("operationHash"),"[a-f0-9]{64}");
  JSONObject record=call.getObject("record");if(record==null||record.toString().length()>64000)throw new IllegalArgumentException();
  JSONObject entry=read(store,scope,id);
  if(entry!=null){
   if(!hash.equals(entry.getString("operationHash"))||!sameJson(record,entry.getJSONObject("record")))throw new IllegalStateException();
   JSObject value=response(entry);value.put("created",false);return value;
  }
  String indexSlot="action-journal:v1:"+scope+":index";String saved=store.readCredentialSlot(indexSlot);
  JSONArray index=saved==null?new JSONArray():new JSONArray(saved);
  boolean exists=false;for(int i=0;i<index.length();i++)if(id.equals(index.getString(i)))exists=true;
  if(!exists){if(index.length()>=2048)throw new IllegalStateException();index.put(id);store.writeCredentialSlot(indexSlot,index.toString());}
  // Index commits first: a crash can leave a harmless absent entry, never an unlisted effect.
  entry=new JSONObject().put("scope",scope).put("proposalId",id).put("operationId",operationId).put("operationHash",hash)
   .put("record",record).put("phase","reserved").put("createdAt",System.currentTimeMillis());
  store.writeCredentialSlot(key(scope,id),entry.toString());JSObject value=response(entry);value.put("created",true);return value;
 });}
 @PluginMethod public void markApplying(PluginCall call){work(call,true,(store,scope,id)->{
  JSONObject entry=read(store,scope,id);if(entry==null||!"reserved".equals(entry.getString("phase")))throw new IllegalStateException();
  String attempt=field(call.getString("attemptId"),"[A-Za-z0-9_-]{1,128}");
  entry.put("attemptId",attempt).put("phase","applying").put("applyingAt",System.currentTimeMillis());
  store.writeCredentialSlot(key(scope,id),entry.toString());return response(entry);
 });}
 @PluginMethod public void finish(PluginCall call){work(call,true,(store,scope,id)->{
  JSONObject entry=read(store,scope,id);if(entry==null)throw new IllegalStateException();
  String status=call.getString("status"),summary=call.getString("summary");
  if(!Set.of("succeeded","failed","unknown","cancelled").contains(status)||summary==null||summary.length()>2000)throw new IllegalArgumentException();
  JSONObject result=call.getObject("result");
  JSONObject retainedOperation=entry.getJSONObject("record").optJSONObject("operation");
  if("succeeded".equals(status)&&entry.getJSONObject("record").has("workflow")&&retainedOperation!=null&&Set.of("read_selected_notes","read_calendar_range").contains(retainedOperation.optString("type"))&&result==null)throw new IllegalArgumentException();
  if("succeeded".equals(status)&&retainedOperation!=null&&Set.of("clock_handoff","maps_read_selected","notes_read_selected","notes_update","notes_delete","reminder_create","reminder_read_selected","reminder_update","reminder_complete","reminder_snooze","reminder_cancel").contains(retainedOperation.optString("type"))&&result==null)throw new IllegalArgumentException();
  if(result!=null){
   JSONObject record=entry.getJSONObject("record"),operation=record.optJSONObject("operation");String type=operation==null?"":operation.optString("type");boolean workflowRead=record.has("workflow")&&Set.of("read_selected_notes","read_calendar_range").contains(type);
   if("clock_handoff".equals(type)){
    if(result.length()!=(result.has("clockResult")?2:1)||!entry.getString("operationId").equals(result.optString("operationId")))throw new IllegalArgumentException();
    JSONObject clock=result.optJSONObject("clockResult");
    if(clock==null){if("succeeded".equals(status))throw new IllegalArgumentException();}
    else{
     String outcome=clock.optString("status");
     if(clock.length()!=3||!"clock-handoff".equals(clock.optString("kind"))||!operation.optString("action").equals(clock.optString("action"))||!Set.of("opened","unavailable","denied","failed","unknown").contains(outcome))throw new IllegalArgumentException();
     String expected="opened".equals(outcome)?"succeeded":"unknown".equals(outcome)?"unknown":"failed";
     if(!expected.equals(status))throw new IllegalArgumentException();
    }
   }else if("maps_read_selected".equals(type)){
    if(result.length()!=(result.has("mapsResult")?2:1)||!entry.getString("operationId").equals(result.optString("operationId")))throw new IllegalArgumentException();
    JSONObject maps=result.optJSONObject("mapsResult");
    if("succeeded".equals(status)){if(maps==null||maps.length()!=4||!type.equals(maps.optString("kind"))||maps.optInt("version")!=1||maps.optJSONObject("fields")==null||!sameJson(operation.optJSONObject("target"),maps.optJSONObject("target")))throw new IllegalArgumentException();}
    else if(maps!=null)throw new IllegalArgumentException();
    if(result.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>8000)throw new IllegalArgumentException();
   }else if(Set.of("reminder_create","reminder_read_selected","reminder_update","reminder_complete","reminder_snooze","reminder_cancel").contains(type)){
    if(result.length()!=(result.has("reminderResult")?2:1)||!entry.getString("operationId").equals(result.optString("operationId")))throw new IllegalArgumentException();
    JSONObject reminder=result.optJSONObject("reminderResult");if("succeeded".equals(status)){if(reminder==null||!type.equals(reminder.optString("kind"))||reminder.optInt("version")!=1)throw new IllegalArgumentException();}else if(reminder!=null)throw new IllegalArgumentException();
    if("reminder_create".equals(type)&&reminder!=null){
     JSONObject fields=operation.getJSONObject("fields"),schedule=fields.getJSONObject("schedule");
     if(reminder.length()!=11||!entry.getString("operationId").equals(reminder.optString("reminderId"))||!sameJson(fields,reminder.optJSONObject("fields"))||!sameJson(schedule.get("at"),reminder.opt("at"))||!sameJson(schedule.get("dueAt"),reminder.opt("dueAt"))||!sameJson(schedule.get("alertMinutes"),reminder.opt("alertMinutes")))throw new IllegalArgumentException();
     if(!(reminder.opt("version") instanceof Number)||reminder.getDouble("version")!=1||!(reminder.opt("revision") instanceof String)||!reminder.getString("revision").matches("[a-f0-9]{64}"))throw new IllegalArgumentException();
     for(String identity:new String[]{"sourceId","reminderId","occurrenceId"})if(!(reminder.opt(identity) instanceof String)||!reminder.getString(identity).matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}"))throw new IllegalArgumentException();
     if(schedule.isNull("alertMinutes")?!"pending".equals(reminder.optString("status")):!Set.of("scheduled","permission-denied","scheduling-failed").contains(reminder.optString("status")))throw new IllegalArgumentException();
    }
    if(result.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>32768)throw new IllegalArgumentException();
   }else if(Set.of("notes_read_selected","notes_update","notes_delete").contains(type)){
    if(result.length()!=(result.has("notesResult")?2:1)||!entry.getString("operationId").equals(result.optString("operationId")))throw new IllegalArgumentException();
    JSONObject note=result.optJSONObject("notesResult");if("succeeded".equals(status)){if(note==null||!type.equals(note.optString("kind"))||note.optInt("version")!=1)throw new IllegalArgumentException();}else if(note!=null)throw new IllegalArgumentException();
    if(result.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>150000)throw new IllegalArgumentException();
   }else if(Set.of("calendar_create","calendar_read_selected","calendar_update","calendar_delete").contains(type)){
    if(result.length()!=(result.has("calendarResult")?2:1)||!entry.getString("operationId").equals(result.optString("operationId")))throw new IllegalArgumentException();
    JSONObject calendar=result.optJSONObject("calendarResult");if("succeeded".equals(status)){if(calendar==null||!type.equals(calendar.optString("kind"))||calendar.optInt("version")!=1)throw new IllegalArgumentException();}else if(calendar!=null)throw new IllegalArgumentException();
    if(result.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>80000)throw new IllegalArgumentException();
   }else if(workflowRead){
    if(result.length()!=(result.has("readResult")?2:1)||!entry.getString("operationId").equals(result.optString("operationId")))throw new IllegalArgumentException();
    JSONObject read=result.optJSONObject("readResult");
    if("succeeded".equals(status)){if(read==null||read.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>65536)throw new IllegalArgumentException();}
    else if(result.has("readResult"))throw new IllegalArgumentException();
    if(result.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>66048)throw new IllegalArgumentException();
   }else if(result.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>8000||result.has("readResult"))throw new IllegalArgumentException();
  }
  if("terminal".equals(entry.getString("phase"))){
   if(!status.equals(entry.getString("status"))||!summary.equals(entry.getString("summary"))||!sameJson(result,entry.optJSONObject("result")))throw new IllegalStateException();
   return response(entry);
  }
  if("succeeded".equals(status)&&!"applying".equals(entry.getString("phase")))throw new IllegalStateException();
  entry.put("phase","terminal").put("status",status).put("summary",summary).put("finishedAt",System.currentTimeMillis());
  if(result!=null)entry.put("result",result);
  store.writeCredentialSlot(key(scope,id),entry.toString());return response(entry);
 });}
 @PluginMethod public void recoverNotification(PluginCall call){work(call,true,(store,scope,id)->{
  JSONObject entry=read(store,scope,id);
  AlphaCredentialStore noticeStore=new AlphaCredentialStore(getContext());
  WorkflowNoticeDelivery delivery=new WorkflowNoticeDelivery(new WorkflowNoticeDelivery.Storage(){public String read(String slot)throws Exception{return noticeStore.readCredentialSlot(slot);}public void write(String slot,String value)throws Exception{noticeStore.writeCredentialSlot(slot,value);}},new WorkflowNoticePoster(getContext()));
  JSONObject recovered=WorkflowNoticeRecovery.recover(entry,scope,id,call.getString("bindingHash"),delivery::receipt);
  if(recovered!=entry)store.writeCredentialSlot(key(scope,id),recovered.toString());return response(recovered);
 });}
 @PluginMethod public void recoverReminder(PluginCall call){work(call,true,(store,scope,id)->{
  JSONObject entry=read(store,scope,id);if(entry==null)throw new IllegalStateException();
  JSONObject operation=entry.getJSONObject("record").getJSONObject("operation");
  if(!Set.of("reminder_create","reminder_read_selected","reminder_update","reminder_complete","reminder_snooze","reminder_cancel").contains(operation.optString("type")))throw new IllegalArgumentException();
  if("terminal".equals(entry.optString("phase"))&&!"unknown".equals(entry.optString("status")))return response(entry);
  if(!"applying".equals(entry.optString("phase"))&&!"unknown".equals(entry.optString("status")))throw new IllegalStateException();
  JSONObject receipt=ReminderStore.operationReceipt(getContext(),entry.getString("operationId"),call.getString("bindingHash"),operation);
  if(!"succeeded".equals(receipt.optString("status")))return response(entry);
  entry.put("phase","terminal").put("status","succeeded").put("summary","Recovered the original saved reminder receipt. No action was repeated.").put("finishedAt",System.currentTimeMillis())
   .put("result",new JSONObject().put("operationId",entry.getString("operationId")).put("reminderResult",receipt.getJSONObject("result")));
  store.writeCredentialSlot(key(scope,id),entry.toString());return response(entry);
 });}
 private final android.os.Handler clockMain = new android.os.Handler(android.os.Looper.getMainLooper());
 private <T> T clockUi(java.util.concurrent.Callable<T> action) throws Exception {
  if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) throw new IllegalStateException("Clock storage must run off main thread");
  java.util.concurrent.FutureTask<T> task = new java.util.concurrent.FutureTask<>(() -> { if (destroyed) throw new IllegalStateException(); return action.call(); });
  if (!clockMain.post(task)) throw new IllegalStateException("Activity unavailable");
  try { return task.get(5, java.util.concurrent.TimeUnit.SECONDS); }
  catch (InterruptedException interrupted) { task.cancel(false); clockMain.removeCallbacks(task); Thread.currentThread().interrupt(); throw interrupted; }
  catch (Exception unavailable) { task.cancel(false); clockMain.removeCallbacks(task); throw unavailable; }
 }
 private JSONObject clockEntry(AlphaConnectionPlugin store,String scope,String id,String operationId)throws Exception{
  if(destroyed)throw new IllegalStateException();
  JSONObject entry=read(store,scope,id);
  if(entry==null||!"applying".equals(entry.getString("phase"))||!operationId.equals(entry.getString("operationId")))throw new IllegalStateException();
  JSONObject record=entry.getJSONObject("record"),operation=record.getJSONObject("operation");ClockAgentReview.validate(operation);
  for(String name:new String[]{"ownerId","sessionId","agentId","origin","installationId","enrollmentId"})if(record.getString(name).isEmpty())throw new IllegalStateException();
  if(record.getLong("expiresAt")<=System.currentTimeMillis()||record.getJSONObject("context").optBoolean("sensitive",false))throw new IllegalStateException();
  JSONObject clock=entry.optJSONObject("clockReview");
  if(clock!=null&&(!entry.getString("attemptId").equals(clock.getString("attemptId"))||!entry.getString("operationHash").equals(clock.getString("operationHash"))))throw new IllegalStateException();
  return entry;
 }
 private JSObject clockReply(JSONObject clock,String action)throws Exception{
  JSObject out=new JSObject();out.put("result",clock!=null&&clock.has("result")?clock.getJSONObject("result"):ClockAgentReview.result(action,"unknown"));return out;
 }
 private JSONObject clockMarker(JSONObject entry,String phase)throws Exception{return new JSONObject().put("phase",phase).put("attemptId",entry.getString("attemptId")).put("operationHash",entry.getString("operationHash"));}
 @PluginMethod public void reviewClock(PluginCall call){
  worker.execute(()->{try{
   String scope=field(call.getString("scope"),"[a-f0-9]{64}"),id=field(call.getString("proposalId"),"[A-Za-z0-9_-]{1,128}"),operationId=field(call.getString("operationId"),"[A-Za-z0-9_-]{1,128}");
   AlphaConnectionPlugin store=(AlphaConnectionPlugin)getBridge().getPlugin("AlphaConnection").getInstance();JSONObject approved;
   synchronized(LOCK){JSONObject entry=clockEntry(store,scope,id,operationId);approved=entry.getJSONObject("record").getJSONObject("operation");if(!sameJson(approved,call.getObject("operation")))throw new IllegalStateException();
    if(entry.has("clockReview")){call.resolve(clockReply(entry.getJSONObject("clockReview"),approved.getString("action")));return;}
    entry.put("clockReview",clockMarker(entry,"reviewing"));store.writeCredentialSlot(key(scope,id),entry.toString());
   }
   clockUi(()->{
    ClockAgentReview.show(getActivity(),scope+":"+id,approved,accepted->{if(destroyed)return;try{worker.execute(()->{if(destroyed)return;try{synchronized(LOCK){JSONObject entry=clockEntry(store,scope,id,operationId),clock=entry.getJSONObject("clockReview");
      if(!"reviewing".equals(clock.getString("phase"))){call.resolve(clockReply(clock,approved.getString("action")));return;}
      JSObject reply=new JSObject();if(accepted){String token=java.util.UUID.randomUUID().toString();clock.put("phase","approved").put("reviewToken",token);reply.put("reviewToken",token);}else{clock.put("phase","cancelled").put("result",ClockAgentReview.result(approved.getString("action"),"failed"));reply=clockReply(clock,approved.getString("action"));}
      store.writeCredentialSlot(key(scope,id),entry.toString());call.resolve(reply);
     }}catch(Exception refusal){if(!destroyed)call.reject("Clock review expired or was retired");}});}catch(java.util.concurrent.RejectedExecutionException retired){call.reject("Clock review retired");}});
    return null;
   });
  }catch(Exception refusal){call.reject("Exact approved Clock review unavailable");}});
 }
 @PluginMethod public void cancelClock(PluginCall call){work(call,true,(store,scope,id)->{
  String operationId=field(call.getString("operationId"),"[A-Za-z0-9_-]{1,128}");JSONObject entry=read(store,scope,id);
  if(entry==null||!operationId.equals(entry.getString("operationId")))throw new IllegalStateException();
  JSONObject operation=entry.getJSONObject("record").getJSONObject("operation");ClockAgentReview.validate(operation);
  JSONObject clock=entry.optJSONObject("clockReview");if(clock==null)clock=clockMarker(entry,"reviewing");
  if(Set.of("reviewing","approved").contains(clock.getString("phase"))){clock.put("phase","cancelled").put("result",ClockAgentReview.result(operation.getString("action"),"failed"));entry.put("clockReview",clock);store.writeCredentialSlot(key(scope,id),entry.toString());}
  getActivity().runOnUiThread(()->ClockAgentReview.dismiss(scope+":"+id));return clockReply(clock,operation.getString("action"));
 });}
 @PluginMethod public void confirmClock(PluginCall call){
  // Serialize exact approval and durable dispatch intent on the journal worker.
  // Only the foreground check and Android handoff run on the Activity thread.
  worker.execute(()->{try{synchronized(LOCK){
   if(destroyed)throw new IllegalStateException();
   String scope=field(call.getString("scope"),"[a-f0-9]{64}"),id=field(call.getString("proposalId"),"[A-Za-z0-9_-]{1,128}"),operationId=field(call.getString("operationId"),"[A-Za-z0-9_-]{1,128}");
   AlphaConnectionPlugin store=(AlphaConnectionPlugin)getBridge().getPlugin("AlphaConnection").getInstance();JSONObject entry=clockEntry(store,scope,id,operationId),clock=entry.getJSONObject("clockReview"),operation=entry.getJSONObject("record").getJSONObject("operation");
   if(!"approved".equals(clock.getString("phase"))){call.resolve(clockReply(clock,operation.getString("action")));return;}
   if(!clock.getString("reviewToken").equals(call.getString("reviewToken")))throw new IllegalStateException();
   clockUi(()->{ClockAgentReview.foreground(getActivity());ClockAgentReview.zone(operation);return null;});
   clock.put("phase","dispatching").remove("reviewToken");store.writeCredentialSlot(key(scope,id),entry.toString());
   long expiresAt=entry.getJSONObject("record").getLong("expiresAt");
   JSObject result=clockUi(()->{if(expiresAt<=System.currentTimeMillis())return ClockAgentReview.result(operation.getString("action"),"failed");return ClockAgentReview.dispatch(getActivity(),operation);});clock.put("phase","finished").put("result",result);store.writeCredentialSlot(key(scope,id),entry.toString());call.resolve(clockReply(clock,operation.getString("action")));
  }}catch(Exception uncertain){call.reject("Clock handoff result is unconfirmed; do not repeat it");}});
 }
 @PluginMethod public void get(PluginCall call){work(call,true,(store,scope,id)->response(read(store,scope,id)));}
 @PluginMethod public void list(PluginCall call){work(call,false,(store,scope,id)->{
  String saved=store.readCredentialSlot("action-journal:v1:"+scope+":index");JSONArray index=saved==null?new JSONArray():new JSONArray(saved);
  JSArray entries=new JSArray();for(int i=0;i<index.length();i++){JSONObject entry=read(store,scope,index.getString(i));if(entry!=null){
   // Passive history never expands every retained private read payload. Explicit
   // receipt recovery calls get() for one exact journal entry at a time.
   JSONObject result=entry.optJSONObject("result");if(result!=null&&result.has("readResult")){JSONObject summary=new JSONObject(result.toString());summary.remove("readResult");summary.put("readResultRetained",true);entry.put("result",summary);}if(result!=null&&result.optJSONObject("calendarResult")!=null&&result.getJSONObject("calendarResult").has("fields")){JSONObject summary=new JSONObject(result.toString());summary.getJSONObject("calendarResult").remove("fields");summary.put("calendarReadRetained",true);entry.put("result",summary);}if(result!=null&&result.optJSONObject("notesResult")!=null&&result.getJSONObject("notesResult").has("fields")){JSONObject summary=new JSONObject(result.toString());summary.getJSONObject("notesResult").remove("fields");summary.put("notesReadRetained",true);entry.put("result",summary);}if(result!=null&&result.optJSONObject("mapsResult")!=null){JSONObject summary=new JSONObject(result.toString());summary.remove("mapsResult");summary.put("mapsReadRetained",true);entry.put("result",summary);}entries.put(entry);
  }}
  JSObject value=new JSObject();value.put("entries",entries);return value;
 });}
 @Override protected void handleOnDestroy(){destroyed=true;ClockAgentReview.abandon();worker.shutdown();super.handleOnDestroy();}
}
