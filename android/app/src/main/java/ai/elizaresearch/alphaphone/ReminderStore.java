package ai.elizaresearch.alphaphone;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Comparator;
import java.time.*;
import java.util.UUID;

/** Device-local reminder storage and Android OS scheduling; no agent workflow executor. */
final class ReminderStore {
 static final String CHANNEL = "alpha-local-reminders";
 static final String OPEN_ID = "alpha.reminder.id";
 static final String OCCURRENCE = "alpha.reminder.occurrence";
 private static final String PREFS = "alpha-local-reminders-v1";
 private static final int LIMIT = 250;
 private ReminderStore() {}
 private static ReminderEnvelope activeEnvelope;
 private static ArrayList<Runnable> deferredEffects;
 private static ReminderEnvelope envelope(Context context) { return activeEnvelope==null?new ReminderEnvelope(context):activeEnvelope; }
 private static SharedPreferences prefs(Context context) { return envelope(context).records(); }
 private static void effect(Runnable action){if(deferredEffects==null)action.run();else deferredEffects.add(action);}
 private static void cancelAlarm(Context context,String id,String occurrence){effect(()->context.getSystemService(AlarmManager.class).cancel(pending(context,id,occurrence)));}
 private static void cancelNotification(Context context,String id){effect(()->context.getSystemService(NotificationManager.class).cancel(id,0));}
 static boolean validId(String id) { return id != null && id.matches("[A-Za-z0-9_-]{1,100}"); }
 static void channel(Context context) {
  NotificationChannel channel = new NotificationChannel(CHANNEL, "Local reminders", NotificationManager.IMPORTANCE_DEFAULT);
  channel.setDescription("Reminders scheduled on this device. Delivery time may vary with Android battery policies.");
  channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
  context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
 }
 static boolean allowed(Context context) {
  NotificationManager manager = context.getSystemService(NotificationManager.class);
  if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
  NotificationChannel channel = manager.getNotificationChannel(CHANNEL);
  return manager.areNotificationsEnabled() && (channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE);
 }
 private static PendingIntent pending(Context context, String id) { return pending(context,id,null); }
 private static PendingIntent pending(Context context, String id, String occurrence) {
  Intent intent = new Intent(context, ReminderReceiver.class).setAction("ai.elizaresearch.alphaphone.REMIND")
   .setData(Uri.parse("alpha-reminder:" + id + (occurrence==null?"":"/"+occurrence))).putExtra(OPEN_ID, id).putExtra(OCCURRENCE,occurrence);
  return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
 }
 private static void arm(Context context, String id, long at) {
  // Inexact alarms deliberately avoid the privileged/user-granted exact-alarm capability.
  String occurrence=null;
  try { JSONObject record=read(context,id);if(record!=null)occurrence=record.optString("occurrenceId",null); }
  catch(JSONException error){throw new IllegalStateException("Reminder could not be read",error);}
  final String selectedOccurrence=occurrence;
  effect(()->context.getSystemService(AlarmManager.class).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, Math.max(at, System.currentTimeMillis() + 1000), pending(context,id,selectedOccurrence)));
 }
 static synchronized JSONObject schedule(Context context, String id, String title, String body, long at) throws JSONException {
  return schedule(context,id,title,body,at,null);
 }
 static synchronized JSONObject schedule(Context context, String id, String title, String body, long at, JSONObject recurrence) throws JSONException {
  if (!validId(id) || title == null || title.trim().isEmpty() || title.length() > 200 || body == null || body.length() > 4000) throw new IllegalArgumentException("Use a valid reminder ID, title up to 200 characters, and details up to 4000 characters");
  if (at <= System.currentTimeMillis()) throw new IllegalArgumentException("Choose a future reminder time");
  SharedPreferences preferences = prefs(context);
  String reclaimedId = null, reclaimedRecord = null;
  if (!preferences.contains(id) && preferences.getAll().size() >= LIMIT) {
   // Explicitly cancelled or completed records are terminal. Posted and denied
   // reminders remain unresolved; damaged records must also be retained.
   long oldestAt = Long.MAX_VALUE;
   for (String key : preferences.getAll().keySet()) {
    try {
     JSONObject candidate = read(context, key);
     if (candidate != null && ("cancelled".equals(candidate.optString("status")) || "completed".equals(candidate.optString("status")))
       && candidate.optLong("cancelledAt", candidate.optLong("completedAt", Long.MAX_VALUE)) < oldestAt) {
      reclaimedId = key; reclaimedRecord = candidate.toString();
      oldestAt = candidate.optLong("cancelledAt", candidate.optLong("completedAt"));
     }
    } catch (JSONException | ClassCastException invalid) { /* Preserve damaged neighbors. */ }
   }
   if (reclaimedId == null) throw new IllegalArgumentException("Reminder storage is full. Complete or cancel an existing reminder before adding another.");
  }
  JSONObject previous = read(context, id);
  JSONObject record = new JSONObject().put("id", id).put("title", title.trim()).put("body", body).put("at", at)
   .put("status", "scheduled").put("mode", "inexact").put("createdAt", System.currentTimeMillis());
  if(recurrence!=null) {
   initializeRecurrence(record,recurrence,at);
  }
  if(recurrence==null)record.put("occurrenceId",UUID.randomUUID().toString()).put("dueAt",at).put("history",new JSONArray());
  if(previous!=null)record.put("history",previous.optJSONArray("history")==null?new JSONArray():previous.getJSONArray("history")).put("createdAt",previous.optLong("createdAt",System.currentTimeMillis()));
  SharedPreferences.Editor write = preferences.edit().putString(id, record.toString());
  if (reclaimedId != null) write.remove(reclaimedId);
  if (!write.commit()) throw new IllegalStateException("Reminder could not be saved");
  try { arm(context, id, at); }
  catch (RuntimeException error) {
   SharedPreferences.Editor editor = preferences.edit();
   if (previous == null) editor.remove(id); else editor.putString(id, previous.toString());
   if (reclaimedId != null) editor.putString(reclaimedId, reclaimedRecord);
   if(!editor.commit())throw new IllegalStateException("Reminder rollback failed",error); throw error;
  }
  if(previous!=null && !java.util.Objects.equals(previous.optString("occurrenceId",null),record.optString("occurrenceId",null))) cancelAlarm(context,id,previous.optString("occurrenceId",null));
  cancelAlarm(context,id,null);
  cancelNotification(context,id);
  return record;
 }
 static synchronized JSONObject read(Context context, String id) throws JSONException {
  String value = prefs(context).getString(id, null); if(value==null)return null;
  JSONObject row=new JSONObject(value);
  // Old one-off records had no revision. Derive a stable identity without changing
  // their ID or deadline; a genuine old alarm is still accepted until mutation.
  if(!row.has("occurrenceId")&&!row.has("recurrence")){
   String seed=id+":"+row.optLong("createdAt")+":"+row.getLong("at");
   row.put("occurrenceId","legacy_"+UUID.nameUUIDFromBytes(seed.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
    .put("dueAt",row.getLong("at")).put("legacyAlarm",true);
   if(!row.has("history"))row.put("history",new JSONArray());
  }
  return row;
 }
 static synchronized JSONArray list(Context context) throws JSONException {
  ArrayList<JSONObject> values = new ArrayList<>();
  for (String key : prefs(context).getAll().keySet()) {
   try { JSONObject value=read(context,key);if(value!=null){value.put("target",selected(context,key));values.add(value); } }
   catch (JSONException | ClassCastException invalid) { /* Preserve damaged records, but do not hide healthy reminders. */ }
  }
  values.sort(Comparator.comparingLong(value -> value.optLong("at")));
  JSONArray result = new JSONArray(); for (JSONObject value : values) result.put(value); return result;
 }
 static synchronized boolean cancel(Context context, String id) throws JSONException {
  if (!validId(id)) throw new IllegalArgumentException("Invalid reminder ID");
  JSONObject value = read(context, id); if (value == null) return false;
  // Persist cancellation before touching AlarmManager; the receiver checks the stored state.
  value.put("status", "cancelled").put("cancelledAt", System.currentTimeMillis());
  if (!prefs(context).edit().putString(id, value.toString()).commit()) throw new IllegalStateException("Cancellation could not be saved");
  cancelAlarm(context,id,value.optString("occurrenceId",null));
  cancelAlarm(context,id,null);
  cancelNotification(context,id); return true;
 }
 static synchronized void restore(Context context) {
  // Recover each record independently. A damaged record or one failed alarm must
  // not suppress other reminders. Permission-denied records require explicit rescheduling.
  for (String key : prefs(context).getAll().keySet()) {
   try {
    JSONObject value=read(context,key);
    if(value!=null && "scheduled".equals(value.optString("status"))) arm(context,value.getString("id"),value.getLong("at"));
   } catch (RuntimeException | JSONException ignored) { /* Keep this record for inspection; continue recovery. */ }
  }
 }
 static synchronized void deliver(Context context, String id) { deliver(context,id,null); }
 static synchronized void deliver(Context context, String id, String occurrence) {
  if (!validId(id)) return;
  try {
   JSONObject value = read(context, id);
   if (value == null || !"scheduled".equals(value.optString("status"))) return;
   if(value.has("occurrenceId")&&!value.getString("occurrenceId").equals(occurrence)){
    if(occurrence!=null||!value.optBoolean("legacyAlarm"))return;
   }
   occurrence=value.optString("occurrenceId",null);
   long at = value.getLong("at");
   // A superseded PendingIntent can already be in flight while an ID is
   // rescheduled. Always honor the latest persisted deadline, with no early window.
   if (at > System.currentTimeMillis()) { arm(context, id, at); return; }
   channel(context);
   if (!allowed(context)) {
    value.put("status", "permission-denied"); if(!prefs(context).edit().putString(id, value.toString()).commit())throw new IllegalStateException("Reminder state could not be saved"); return;
   }
   postNotification(context,id,value,occurrence);
   value.put("status", "posted").put("postedAt", System.currentTimeMillis());
   if(!prefs(context).edit().putString(id, value.toString()).commit())throw new IllegalStateException("Reminder state could not be saved");
  } catch (RuntimeException | JSONException ignored) {
   // The persisted record stays unresolved if the provider/system fails; no false delivered receipt.
  }
 }

 private static void postNotification(Context context,String id,JSONObject value,String occurrence)throws JSONException{
   Intent open = new Intent(context, MainActivity.class).setAction("ai.elizaresearch.alphaphone.OPEN_REMINDER")
    .setData(Uri.parse("alpha-reminder-open:" + id + (occurrence==null?"":"/"+occurrence))).putExtra(OPEN_ID, id).putExtra(OCCURRENCE,occurrence).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
   PendingIntent tap = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
   Notification publicVersion = new Notification.Builder(context, CHANNEL).setSmallIcon(android.R.drawable.ic_popup_reminder)
    .setContentTitle("Alpha Phone reminder").build();
   Notification.Builder builder = new Notification.Builder(context, CHANNEL).setSmallIcon(android.R.drawable.ic_popup_reminder)
    .setContentTitle(value.getString("title")).setContentText(value.getString("body"))
    .setStyle(new Notification.BigTextStyle().bigText(value.getString("body")))
    .setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(publicVersion)
     .setContentIntent(tap).setOnlyAlertOnce(true).setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER);
   if(occurrence!=null){
    builder.addAction(new Notification.Action.Builder(null,"Done",decisionIntent(context,id,occurrence,"done")).build());
    builder.addAction(new Notification.Action.Builder(null,"Snooze 10 minutes",decisionIntent(context,id,occurrence,"snooze")).build());
   }
   context.getSystemService(NotificationManager.class).notify(id, 0, builder.build());
 }
 private static void initializeRecurrence(JSONObject record,JSONObject config,long at)throws JSONException {
  String rule=config.getString("rule"),zone=config.getString("zone"),date=config.getString("date"),time=config.getString("time");
  if(!rule.equals("daily")&&!rule.equals("weekdays")&&!rule.equals("weekly"))throw new IllegalArgumentException("Unknown repeat rule");
  ZoneId z=ZoneId.of(zone);LocalDate day=LocalDate.parse(date);LocalTime clock=LocalTime.parse(time);
  int lead=config.getInt("leadMinutes");if(lead<0||lead>10080||clock.getSecond()!=0||clock.getNano()!=0)throw new IllegalArgumentException("Invalid repeat time");
  LocalDateTime civil=day.atTime(clock);
  if(z.getRules().getValidOffsets(civil).isEmpty())throw new IllegalArgumentException("This local time does not exist");
  if(rule.equals("weekdays")&&(day.getDayOfWeek()==DayOfWeek.SATURDAY||day.getDayOfWeek()==DayOfWeek.SUNDAY))throw new IllegalArgumentException("Choose a weekday for the first occurrence");
  long due=civil.atZone(z).withEarlierOffsetAtOverlap().toInstant().toEpochMilli();
  if(due-lead*60000L!=at)throw new IllegalArgumentException("Repeat time does not match reminder time");
  String revision=UUID.randomUUID().toString();
  record.put("recurrence",new JSONObject().put("rule",rule).put("zone",zone).put("date",date).put("time",time).put("leadMinutes",lead))
   .put("revision",revision).put("occurrenceId",revision+"_"+date).put("dueAt",due).put("history",new JSONArray());
 }
 private static PendingIntent decisionIntent(Context context,String id,String occurrence,String action){
  Intent intent=new Intent(context,ReminderReceiver.class).setAction("ai.elizaresearch.alphaphone.REMINDER_DECISION")
   .setData(Uri.parse("alpha-reminder-decision:"+id+"/"+occurrence+"/"+action)).putExtra(OPEN_ID,id).putExtra(OCCURRENCE,occurrence).putExtra("decision",action);
  return PendingIntent.getBroadcast(context,0,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
 }
 /** Completion-driven repeats: only explicit Done advances the civil schedule. */
 static synchronized JSONObject decide(Context context,String id,String occurrence,String action)throws JSONException {
  if(!validId(id)||occurrence==null)throw new IllegalArgumentException("Select the current reminder occurrence");
  JSONObject value=read(context,id);
  if(value==null||!occurrence.equals(value.optString("occurrenceId"))||"cancelled".equals(value.optString("status"))||"completed".equals(value.optString("status")))return new JSONObject().put("status","stale");
  if(!action.equals("done")&&!action.equals("snooze"))throw new IllegalArgumentException("Unknown reminder action");
  if(action.equals("snooze")&&"scheduled".equals(value.optString("status"))&&value.has("snoozedAt"))return new JSONObject().put("status","unchanged");
  long now=System.currentTimeMillis();
  if(action.equals("done")&&!value.has("recurrence")){
   JSONArray previous=value.optJSONArray("history"),history=new JSONArray();
   if(previous!=null)for(int i=Math.max(0,previous.length()-31);i<previous.length();i++)history.put(previous.get(i));
   history.put(new JSONObject().put("occurrenceId",occurrence).put("dueAt",value.getLong("dueAt")).put("completedAt",now).put("skippedDates",0));
   value.put("history",history).put("status","completed").put("completedAt",now);value.remove("legacyAlarm");
   if(!prefs(context).edit().putString(id,value.toString()).commit())throw new IllegalStateException("Reminder action could not be saved");
   cancelAlarm(context,id,occurrence);
   cancelAlarm(context,id,null);
   cancelNotification(context,id);
   return new JSONObject().put("status","completed");
  }
  if(action.equals("done")){
   JSONObject rule=value.getJSONObject("recurrence");ZoneId zone=ZoneId.of(rule.getString("zone"));LocalTime time=LocalTime.parse(rule.getString("time"));
   LocalDate day=LocalDate.parse(rule.getString("date"));String kind=rule.getString("rule");long at;int skipped=0;
   do{
    day=day.plusDays(kind.equals("weekly")?7:1);
    if(kind.equals("weekdays"))while(day.getDayOfWeek()==DayOfWeek.SATURDAY||day.getDayOfWeek()==DayOfWeek.SUNDAY)day=day.plusDays(1);
    LocalDateTime civil=day.atTime(time);
    // Future missing wall times use the first valid instant after the gap.
    ZonedDateTime next=zone.getRules().getValidOffsets(civil).isEmpty()?zone.getRules().getTransition(civil).getDateTimeAfter().atZone(zone):civil.atZone(zone).withEarlierOffsetAtOverlap();
    at=next.toInstant().toEpochMilli()-rule.getInt("leadMinutes")*60000L;
    if(at<=now)skipped++;
   }while(at<=now);
   JSONArray previous=value.optJSONArray("history"),history=new JSONArray();
   if(previous!=null)for(int i=Math.max(0,previous.length()-31);i<previous.length();i++)history.put(previous.get(i));
   history.put(new JSONObject().put("occurrenceId",occurrence).put("dueAt",value.getLong("dueAt")).put("completedAt",now).put("skippedDates",skipped));
   rule.put("date",day.toString());value.put("history",history).put("occurrenceId",value.getString("revision")+"_"+day).put("dueAt",at+rule.getInt("leadMinutes")*60000L).put("at",at);
   value.remove("snoozedAt");value.remove("postedAt");
  }else value.put("at",now+600000L).put("snoozedAt",now);
  value.remove("legacyAlarm");
  value.put("status",allowed(context)?"scheduled":"permission-denied");
  if(!prefs(context).edit().putString(id,value.toString()).commit())throw new IllegalStateException("Reminder action could not be saved");
  cancelAlarm(context,id,occurrence);cancelAlarm(context,id,null);cancelNotification(context,id);
  if("scheduled".equals(value.getString("status")))try{arm(context,id,value.getLong("at"));}catch(RuntimeException error){value.put("status","scheduling-failed");if(!prefs(context).edit().putString(id,value.toString()).commit())throw new IllegalStateException("Reminder failure state could not be saved");}
  return new JSONObject().put("status",value.getString("status"));
 }
 static String digest(String value){try{byte[] bytes=java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();for(byte b:bytes)out.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return out.toString();}catch(java.security.NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}}
 private static String canonical(Object value)throws JSONException{if(value instanceof JSONObject){JSONObject obj=(JSONObject)value;ArrayList<String> keys=new ArrayList<>();for(java.util.Iterator<String> it=obj.keys();it.hasNext();)keys.add(it.next());java.util.Collections.sort(keys);StringBuilder s=new StringBuilder("{");for(String key:keys){if(s.length()>1)s.append(',');s.append(JSONObject.quote(key)).append(':').append(canonical(obj.get(key)));}return s.append('}').toString();}if(value instanceof JSONArray){JSONArray a=(JSONArray)value;StringBuilder s=new StringBuilder("[");for(int i=0;i<a.length();i++){if(i>0)s.append(',');s.append(canonical(a.get(i)));}return s.append(']').toString();}return value instanceof String?JSONObject.quote((String)value):String.valueOf(value);}
 private static void exactKeys(JSONObject v,String...keys)throws JSONException{java.util.Set<String> expected=new java.util.HashSet<>(java.util.Arrays.asList(keys));if(v.length()!=expected.size())throw new IllegalArgumentException("Unexpected reminder fields");for(String key:keys)if(!v.has(key))throw new IllegalArgumentException("Missing reminder field");}
 static synchronized JSONObject selected(Context context,String id)throws JSONException{
  if(!validId(id))throw new IllegalArgumentException("Invalid reminder ID");JSONObject row=read(context,id);if(row==null)throw new IllegalArgumentException("Reminder not found");
  String source=envelope(context).active().getString("source");return new JSONObject().put("sourceId",source).put("sourceRevision",digest(source)).put("reminderId",id).put("occurrenceId",row.getString("occurrenceId")).put("revision",digest(canonical(row)));
 }
 private static JSONObject operationResult(Context context,String type,String id)throws JSONException{
  JSONObject row=read(context,id),target=selected(context,id);
  JSONObject result=new JSONObject().put("version",1).put("kind",type).put("sourceId",target.getString("sourceId")).put("reminderId",id).put("occurrenceId",target.getString("occurrenceId")).put("revision",target.getString("revision")).put("status",row.getString("status")).put("at",row.getLong("at"));
  if(type.equals("reminder_read_selected"))result.put("fields",new JSONObject().put("title",row.getString("title")).put("body",row.getString("body")).put("schedule",new JSONObject().put("at",row.getLong("at")).put("recurrence",row.has("recurrence")?row.getJSONObject("recurrence"):JSONObject.NULL)));
  return result;
 }
 static synchronized JSONObject operationReceipt(Context context,String operationId,String bindingHash,JSONObject operation)throws JSONException{
  if(operationId==null||bindingHash==null||operation==null)throw new IllegalArgumentException("Missing reminder receipt binding");
  JSONObject receipts=new ReminderEnvelope(context).value.getJSONObject("operations");
  if(!receipts.has(operationId))return new JSONObject().put("status","unknown");
  JSONObject saved=receipts.getJSONObject(operationId);
  if(!digest(bindingHash+":"+canonical(operation)).equals(saved.getString("argumentHash")))throw new IllegalArgumentException("Reminder receipt binding changed");
  return new JSONObject(saved.getJSONObject("response").toString());
 }
 /** No automatic replay of an uncertain Android effect. Same operation returns its original receipt. */
 static synchronized JSONObject operate(Context context,String operationId,String bindingHash,JSONObject operation)throws JSONException{
  if(operationId==null||!operationId.matches("[A-Za-z0-9_-]{1,128}")||bindingHash==null||!bindingHash.matches("[a-f0-9]{64}"))throw new IllegalArgumentException("Invalid reminder operation binding");
  String type=operation.getString("type");if(!java.util.Arrays.asList("reminder_read_selected","reminder_update","reminder_complete","reminder_snooze","reminder_cancel").contains(type))throw new IllegalArgumentException("Unsupported reminder operation");
  if(type.equals("reminder_update"))exactKeys(operation,"type","target","fields");else exactKeys(operation,"type","target");
  JSONObject target=operation.getJSONObject("target");exactKeys(target,"sourceId","sourceRevision","reminderId","occurrenceId","revision");
  ReminderEnvelope store=new ReminderEnvelope(context);String argumentHash=digest(bindingHash+":"+canonical(operation));JSONObject receipts=store.value.getJSONObject("operations");
  if(receipts.has(operationId)){JSONObject saved=receipts.getJSONObject(operationId);if(!argumentHash.equals(saved.getString("argumentHash")))throw new IllegalArgumentException("Reminder operation binding changed");return new JSONObject(saved.getJSONObject("response").toString());}
  if(receipts.length()>=500)throw new IllegalStateException("Reminder operation storage full");
  String id=target.getString("reminderId");if(!canonical(target).equals(canonical(selected(context,id))))throw new IllegalArgumentException("Selected reminder changed");
  activeEnvelope=store;store.begin();deferredEffects=new ArrayList<>();ArrayList<Runnable> effects;
  try{
   JSONObject row=read(context,id);
   if(type.equals("reminder_update")){
    JSONObject fields=operation.getJSONObject("fields");if(fields.has("schedule"))exactKeys(fields,"title","body","schedule");else exactKeys(fields,"title","body");
    if(!(fields.opt("title") instanceof String)||!(fields.opt("body") instanceof String))throw new IllegalArgumentException("Invalid reminder fields");String title=fields.getString("title"),body=fields.getString("body");if(title.trim().isEmpty()||title.length()>200||body.length()>4000||title.indexOf(0)>=0||body.indexOf(0)>=0)throw new IllegalArgumentException("Invalid reminder text");
    if(fields.has("schedule")){JSONObject schedule=fields.getJSONObject("schedule");exactKeys(schedule,"at","recurrence");Object at=schedule.get("at");if(!(at instanceof Number)||!Double.isFinite(((Number)at).doubleValue())||((Number)at).doubleValue()>8640000000000000L||((Number)at).doubleValue()<0||((Number)at).doubleValue()!=((Number)at).longValue())throw new IllegalArgumentException("Invalid reminder instant");JSONObject recurrence=schedule.isNull("recurrence")?null:schedule.getJSONObject("recurrence");if(recurrence!=null){exactKeys(recurrence,"rule","zone","date","time","leadMinutes");Object lead=recurrence.get("leadMinutes");if(!(lead instanceof Number)||((Number)lead).doubleValue()!=((Number)lead).intValue())throw new IllegalArgumentException("Invalid reminder lead");}if(!allowed(context))throw new IllegalStateException("Reminder notification permission required");schedule(context,id,title,body,((Number)at).longValue(),recurrence);}
    else{row.put("title",title.trim()).put("body",body);if(!prefs(context).edit().putString(id,row.toString()).commit())throw new IllegalStateException("Reminder save failed");if("posted".equals(row.optString("status")))effect(()->{try{postNotification(context,id,row,row.getString("occurrenceId"));}catch(JSONException e){throw new IllegalStateException(e);}});}
   }else if(type.equals("reminder_cancel"))cancel(context,id);
   else if(type.equals("reminder_complete")||type.equals("reminder_snooze")){JSONObject result=decide(context,id,target.getString("occurrenceId"),type.equals("reminder_complete")?"done":"snooze");if(result.optString("status").equals("stale"))throw new IllegalArgumentException("Reminder occurrence changed");}
   JSONObject result=operationResult(context,type,id);
   JSONObject response=new JSONObject().put("status",deferredEffects.isEmpty()?"succeeded":"unknown").put("result",result);
   JSONObject receipt=new JSONObject().put("argumentHash",argumentHash).put("phase",deferredEffects.isEmpty()?"terminal":"effects-pending").put("response",response);
   store.active().getJSONObject("operations").put(operationId,receipt);
   // All record changes and original absolute deadlines become durable together.
   store.commit();effects=deferredEffects;
  }catch(RuntimeException|JSONException failure){store.abort();throw failure;}finally{activeEnvelope=null;deferredEffects=null;}
  if(!effects.isEmpty()){
   boolean effectsComplete=false;
   try{for(Runnable action:effects)action.run();effectsComplete=true;JSONObject receipt=store.value.getJSONObject("operations").getJSONObject(operationId);receipt.put("phase","terminal");receipt.getJSONObject("response").put("status","succeeded");store.save();}
   catch(RuntimeException failure){
    try{JSONObject record=new JSONObject(store.value.getJSONObject("records").getString(id));if(!effectsComplete&&"scheduled".equals(record.optString("status"))){record.put("status","scheduling-failed");store.value.getJSONObject("records").put(id,record.toString());}JSONObject receipt=store.value.getJSONObject("operations").getJSONObject(operationId);receipt.put("phase","effects-uncertain");receipt.getJSONObject("response").put("status","unknown");store.save();}catch(RuntimeException|JSONException persistenceFailure){/* Previously committed unknown phase remains authoritative. */}
    return new JSONObject().put("status","unknown").put("message","Android reminder effect requires review; not repeated");
   }
  }
  return new JSONObject(store.value.getJSONObject("operations").getJSONObject(operationId).getJSONObject("response").toString());
 }

}
