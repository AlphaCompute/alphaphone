package ai.elizaresearch.alphaphone;

import org.json.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** Durable selected-source consent. Permission to use Android APIs alone is never a grant. */
final class NativeDigestSources {
 interface Storage {String read(String key)throws Exception;void write(String key,String value)throws Exception;}
 interface Reader {
  JSONArray calendar(JSONArray ids,String start,String end,int maximum,String startDate,String endDateExclusive)throws Exception;
  JSONArray reminders()throws Exception;
 }
 interface Guard {void check()throws Exception;}
 private final Storage storage;
 private final Object lock;
 private final java.util.function.LongSupplier clock;
 NativeDigestSources(Storage storage,Object lock){this(storage,lock,System::currentTimeMillis);}
 NativeDigestSources(Storage storage,Object lock,java.util.function.LongSupplier clock){this.storage=storage;this.lock=lock;this.clock=clock;}
 private static final DateTimeFormatter UTC=new java.time.format.DateTimeFormatterBuilder().appendInstant(3).toFormatter();
 private static String id(JSONObject value,String key)throws Exception {String text=value.getString(key);if(!text.matches("[A-Za-z0-9][A-Za-z0-9_.-]{0,255}"))throw new SecurityException("Invalid source identity");return text;}
 private static void keys(JSONObject value,String... expected){Set<String> names=new HashSet<>(Arrays.asList(expected));if(value.length()!=names.size())throw new SecurityException("Invalid source scope");for(java.util.Iterator<String> it=value.keys();it.hasNext();)if(!names.contains(it.next()))throw new SecurityException("Unexpected source scope");}
 static JSONObject scope(JSONObject value)throws Exception {
  keys(value,"calendars","reminders","timeZone","window","maximumItems","modelEgress");
  JSONArray ids=value.getJSONArray("calendars"),copy=new JSONArray();Set<String> unique=new HashSet<>();
  if(ids.length()>16)throw new SecurityException("Too many selected calendars");
  for(int i=0;i<ids.length();i++){JSONObject source=ids.getJSONObject(i);keys(source,"id","revision");String id=source.getString("id"),revision=source.getString("revision");if(!id.matches("[1-9][0-9]{0,18}")||Long.parseLong(id)<=0||!unique.add(id)||!revision.matches("[a-f0-9]{64}"))throw new SecurityException("Invalid calendar selection");copy.put(new JSONObject().put("id",id).put("revision",revision));}
  Object reminders=value.get("reminders"),egress=value.get("modelEgress"),maximum=value.get("maximumItems");
  if(!(reminders instanceof Boolean)||!Boolean.TRUE.equals(egress)||!(maximum instanceof Number)||((Number)maximum).doubleValue()!=((Number)maximum).intValue()||((Number)maximum).intValue()<1||((Number)maximum).intValue()>200||ids.length()==0&&!Boolean.TRUE.equals(reminders)||!"owner_day_and_overdue_reminders".equals(value.getString("window")))throw new SecurityException("Review source and model egress scope");
  String zone=value.getString("timeZone");ZoneId.of(zone);
  return new JSONObject().put("calendars",copy).put("reminders",reminders).put("timeZone",zone).put("window","owner_day_and_overdue_reminders").put("maximumItems",((Number)maximum).intValue()).put("modelEgress",true);
 }
 private static String slot(JSONObject binding,String sourceId)throws Exception {
  id(binding,"ownerId");id(binding,"agentId");id(binding,"installationId");id(binding,"enrollmentId");
  return "native-digest-source:v1:"+HostedResultNotices.hash(new JSONArray().put(binding.getString("ownerId")).put(binding.getString("agentId")).put(binding.getString("installationId")).put(binding.getString("enrollmentId")).put(sourceId).toString());
 }
 /** Only a foreground, explicit consent handler calls this method, with a native-verified binding. */
 JSONObject approve(JSONObject binding,String sourceId,JSONObject selection,long expiresAt,long now,Guard guard)throws Exception {
  id(new JSONObject().put("id",sourceId),"id");JSONObject selected=scope(selection);
  if(expiresAt<=now||expiresAt-now>90L*86400000)throw new SecurityException("Source expiry must be within 90 days");
  JSONObject grant=new JSONObject().put("version",1).put("provider","native").put("ownerId",binding.getString("ownerId")).put("agentId",binding.getString("agentId")).put("installationId",binding.getString("installationId")).put("enrollmentId",binding.getString("enrollmentId")).put("sourceId",sourceId).put("scope",selected).put("expiresAt",UTC.format(Instant.ofEpochMilli(expiresAt)));
  String revision=HostedResultNotices.hash(grant.toString());grant.put("revision",revision).put("revoked",false);
  synchronized(lock){guard.check();String key=slot(binding,sourceId),prior=storage.read(key);if(prior!=null){JSONObject old=new JSONObject(prior);if(!revision.equals(old.getString("revision"))||old.getBoolean("revoked"))throw new SecurityException("Source identity already used; review a new source");return old;}storage.write(key,grant.toString());guard.check();return new JSONObject(storage.read(key));}
 }
 void revoke(JSONObject binding,String sourceId,Guard guard)throws Exception {synchronized(lock){guard.check();String key=slot(binding,sourceId),raw=storage.read(key);if(raw==null)return;JSONObject grant=new JSONObject(raw);grant.put("revoked",true);storage.write(key,grant.toString());}}
 JSONObject current(JSONObject binding,String sourceId,String revision,long now,Guard guard)throws Exception {
  guard.check();String raw=storage.read(slot(binding,sourceId));if(raw==null)throw new SecurityException("Native source consent missing");JSONObject grant=new JSONObject(raw);
  if(grant.getInt("version")!=1||grant.getBoolean("revoked")||!revision.equals(grant.getString("revision"))||Instant.parse(grant.getString("expiresAt")).toEpochMilli()<=now)throw new SecurityException("Native source consent expired or revoked");
  for(String field:new String[]{"ownerId","agentId","installationId","enrollmentId"})if(!binding.getString(field).equals(grant.getString(field)))throw new SecurityException("Native source owner changed");
  scope(grant.getJSONObject("scope"));JSONObject original=new JSONObject(grant.toString());original.remove("revision");original.remove("revoked");if(!revision.equals(HostedResultNotices.hash(original.toString())))throw new SecurityException("Native source grant integrity changed");return grant;
 }
 JSONObject read(JSONObject binding,String sourceId,String revision,long occurrence,long now,Reader reader,Guard guard)throws Exception {
  final JSONObject grant;synchronized(lock){grant=current(binding,sourceId,revision,now,guard);}
  JSONObject selected=grant.getJSONObject("scope");ZoneId zone=ZoneId.of(selected.getString("timeZone"));LocalDate day=Instant.ofEpochMilli(occurrence).atZone(zone).toLocalDate();
  Instant begin=day.atStartOfDay(zone).toInstant(),end=day.plusDays(1).atStartOfDay(zone).toInstant();int maximum=selected.getInt("maximumItems");
  JSONArray calendars=selected.getJSONArray("calendars"),events=calendars.length()==0?new JSONArray():reader.calendar(calendars,UTC.format(begin),UTC.format(end),maximum,day.toString(),day.plusDays(1).toString()),reminders=new JSONArray();
  if(events.length()>maximum)throw new SecurityException("Selected calendar results exceed consent bound");
  if(selected.getBoolean("reminders")){JSONArray rows=reader.reminders();for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);String status=row.getString("status");if("completed".equals(status)||"cancelled".equals(status))continue;if(row.optBoolean("legacyAlarm"))continue;Object at=row.has("dueAt")?row.get("dueAt"):row.get("at");long due=at instanceof Number?((Number)at).longValue():Instant.parse(row.getString("at")).toEpochMilli();if(due>=end.toEpochMilli())continue;if(events.length()+reminders.length()>=maximum)throw new SecurityException("Selected source results exceed consent bound");reminders.put(new JSONObject().put("id",row.getString("id")).put("title",row.getString("title")).put("dueAt",UTC.format(Instant.ofEpochMilli(due))).put("status",status));}}
  JSONObject result=new JSONObject().put("sourceId",sourceId).put("sourceRevision",revision).put("occurrence",UTC.format(Instant.ofEpochMilli(occurrence))).put("observedAt",UTC.format(Instant.ofEpochMilli(now))).put("timeZone",zone.getId()).put("start",UTC.format(begin)).put("end",UTC.format(end)).put("events",events).put("reminders",reminders);
  if(result.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>65536)throw new SecurityException("Selected source results exceed byte bound");
  synchronized(lock){current(binding,sourceId,revision,clock.getAsLong(),guard);}return result;
 }
}
