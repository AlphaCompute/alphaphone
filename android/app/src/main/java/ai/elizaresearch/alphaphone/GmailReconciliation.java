package ai.elizaresearch.alphaphone;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.json.*;

/** Durable metadata only. No message contents, token, send, archive or read-state mutation. */
final class GmailReconciliation {
 static final String SLOT="gmail-background:v1";
 interface Store {String read()throws Exception;void write(String value)throws Exception;}
 interface Guard {void check()throws Exception;}
 interface Poster {boolean allowed();boolean active(String key);void post(String key);void cancel(String key);}
 private final Store store;private final Guard guard;private final Poster poster;
 GmailReconciliation(Store store,Guard guard,Poster poster){this.store=store;this.guard=guard;this.poster=poster;}
 static List<String> keys(JSONObject value){List<String> keys=new ArrayList<>();value.keys().forEachRemaining(keys::add);return keys;}
 static String id(String value){if(value==null||!value.matches("[A-Za-z0-9_-]{1,256}"))throw new IllegalArgumentException("Invalid Gmail identity");return value;}
 static String revision(String value){if(value==null||!value.matches("[1-9][0-9]{0,19}"))throw new IllegalArgumentException("Invalid Gmail history");return value;}
 static String hash(String value)throws Exception{byte[] bytes=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();for(byte b:bytes)out.append(String.format(Locale.ROOT,"%02x",b&255));return out.toString();}
 static String optional(JSONObject value,String key)throws Exception {Object item=value.get(key);if(item==JSONObject.NULL)return null;if(!(item instanceof String)||((String)item).isEmpty())throw new IllegalArgumentException("Invalid Gmail field");return (String)item;}
 JSONObject state()throws Exception{guard.check();String raw=store.read();if(raw==null)throw new SecurityException("Mail reconciliation disabled");JSONObject state=new JSONObject(raw);if(state.getInt("version")!=1)throw new IllegalArgumentException("Unknown Gmail state");return state;}
 private void save(JSONObject state)throws Exception{guard.check();store.write(state.toString());}
 static JSONObject initial(JSONObject binding)throws Exception{return new JSONObject().put("version",1).put("binding",binding).put("historyId",JSONObject.NULL).put("pageToken",JSONObject.NULL).put("lastPageHistory",JSONObject.NULL).put("notices",new JSONObject()).put("incompleteCatchup",true).put("lastSyncAt",0).put("status","waiting");}
 JSONObject query()throws Exception{JSONObject s=state();return new JSONObject().put("startHistoryId",s.get("historyId")).put("pageToken",s.get("pageToken"));}
 /** Every event and continuation is committed together, before notifications or final watermark use. */
 void accept(JSONObject page,long now)throws Exception{
  JSONObject s=state(),binding=s.getJSONObject("binding");String start=optional(s,"historyId"),token=optional(s,"pageToken");
  if(page.getInt("version")!=1||!binding.getString("grantId").equals(page.getString("grantId"))||!Objects.equals(start,optional(page,"startHistoryId")))throw new SecurityException("Gmail page binding changed");
  String status=page.getString("status"),current=optional(page,"historyId"),checkpoint=optional(page,"checkpoint"),next=optional(page,"nextPageToken");JSONArray events=page.getJSONArray("events");
  if(events.length()>2000)throw new IllegalArgumentException("Gmail page exceeds bounds");
  if(status.equals("baseline-required")||status.equals("reset-required")){
   if(!page.getBoolean("backfillRequired")||events.length()!=0||checkpoint!=null||next!=null)throw new IllegalArgumentException("Invalid Gmail baseline");
   if(status.equals("baseline-required")){if(start!=null)throw new IllegalArgumentException("Unexpected Gmail baseline");revision(current);}
   else if(start==null||current!=null)throw new IllegalArgumentException("Invalid Gmail reset");
   // A profile watermark starts future observation quietly; it never claims missed mail was read.
   s.put("historyId",current==null?JSONObject.NULL:current).put("pageToken",JSONObject.NULL).put("lastPageHistory",JSONObject.NULL).put("incompleteCatchup",true).put("status",status.equals("reset-required")?"history-expired":"watching-new-mail").put("lastSyncAt",now);save(s);return;
  }
  if(!status.equals("page")||start==null||page.getBoolean("backfillRequired"))throw new IllegalArgumentException("Invalid Gmail page");
  BigInteger floor=new BigInteger(revision(start)),ceiling=new BigInteger(revision(current));if(ceiling.compareTo(floor)<0)throw new IllegalArgumentException("History reversed");
  if(next!=null&&(next.length()>4096||next.equals(token)||checkpoint!=null)||next==null&&!current.equals(checkpoint))throw new IllegalArgumentException("Invalid Gmail checkpoint");
  String prior=optional(s,"lastPageHistory");BigInteger previous=prior==null?floor:new BigInteger(revision(prior));
  Set<String> seen=new HashSet<>();JSONObject notices=s.getJSONObject("notices");String last=null;
  // Only retire records behind an already committed checkpoint, never the current batch.
  // Pending, ambiguous, active and captured notices keep their durable identity.
  if(token==null){JSONObject tap=s.optJSONObject("tap");for(String key:keys(notices)){
   JSONObject notice=notices.getJSONObject(key);String phase=notice.getString("phase");
   if(tap!=null&&key.equals(tap.optString("key"))||!notice.has("historyId")||new BigInteger(revision(notice.getString("historyId"))).compareTo(floor)>0)continue;
   boolean terminal=Set.of("opened","withdrawn","denied").contains(phase);
   boolean expired=phase.equals("posted")&&now-notice.getLong("createdAt")>=86400000L&&!poster.active(key);
   if(terminal||expired){poster.cancel(key);notices.remove(key);}
  }}
  for(int i=0;i<events.length();i++){
   JSONObject e=events.getJSONObject(i);String history=revision(e.getString("historyId")),type=e.getString("type"),message=id(e.getString("messageId")),thread=id(e.getString("threadId"));
   if(!Set.of("message-added","message-deleted","labels-added","labels-removed").contains(type))throw new IllegalArgumentException("Invalid Gmail event");
   BigInteger number=new BigInteger(history);if(number.compareTo(previous)<0||number.compareTo(floor)<=0||number.compareTo(ceiling)>0||prior!=null&&number.compareTo(new BigInteger(prior))<=0)throw new IllegalArgumentException("Unordered Gmail history");previous=number;last=history;
   String event=history+":"+type+":"+message;if(!event.equals(e.getString("id"))||!seen.add(event))throw new IllegalArgumentException("Invalid Gmail event identity");
   JSONArray labels=e.getJSONArray("labelIds");if(labels.length()>100)throw new IllegalArgumentException("Gmail labels exceed bounds");Set<String> labelIds=new HashSet<>();for(int j=0;j<labels.length();j++)labelIds.add(id(labels.getString(j)));
   if(type.equals("message-added")&&(!(e.opt("messageAvailable") instanceof Boolean)||!e.getBoolean("messageAvailable")&&!labelIds.isEmpty()))throw new IllegalArgumentException("Gmail current message availability required");
   String key=hash(binding.getString("generation")+":"+binding.getString("accountRef")+":"+binding.getString("grantId")+":"+message);
   if(type.equals("message-added")&&e.getBoolean("messageAvailable")&&labelIds.contains("INBOX")&&labelIds.contains("UNREAD")&&!labelIds.contains("SPAM")&&!labelIds.contains("TRASH")&&!notices.has(key))notices.put(key,new JSONObject().put("messageId",message).put("threadId",thread).put("phase","pending").put("historyId",history).put("createdAt",now));
   if(type.equals("message-deleted")||type.equals("labels-removed")&&(labelIds.contains("INBOX")||labelIds.contains("UNREAD"))){JSONObject notice=notices.optJSONObject(key);if(notice!=null)notice.put("phase","withdrawn");}
  }
  // Bound retained notice identities without forgetting a current pagination batch. Refuse overflow:
  // never truncate an event page or advance a checkpoint past unsaved events.
  if(notices.length()>1000)throw new IllegalStateException("Gmail notice history full");
  s.put("historyId",next==null?checkpoint:start).put("pageToken",next==null?JSONObject.NULL:next).put("lastPageHistory",next==null?JSONObject.NULL:last==null?s.get("lastPageHistory"):last).put("status",next==null?"watching-new-mail":"catching-up").put("lastSyncAt",now);save(s);
 }
 /** Reservation precedes the OS side effect. Ambiguous dispatch is never automatically replayed. */
 void publish()throws Exception{
  JSONObject s=state(),notices=s.getJSONObject("notices");for(String key:keys(notices)){
   guard.check();JSONObject n=notices.getJSONObject(key);String phase=n.getString("phase");
   if(phase.equals("withdrawn")){poster.cancel(key);continue;}
   if(phase.equals("dispatching")){n.put("phase",poster.active(key)?"posted":"uncertain");save(s);continue;}
   if(!phase.equals("pending"))continue;
   n.put("phase",poster.allowed()?"dispatching":"denied");save(s);
   if(n.getString("phase").equals("denied"))continue;
   guard.check();try{poster.post(key);n.put("phase",poster.active(key)?"posted":"uncertain");}catch(SecurityException denied){n.put("phase","denied");}save(s);return;
  }
 }
 boolean hasPending()throws Exception{JSONObject notices=state().getJSONObject("notices");for(String key:keys(notices))if("pending".equals(notices.getJSONObject(key).getString("phase")))return true;return false;}
 void failure(String status)throws Exception{if(!Set.of("unsupported","retrying","grant-unavailable","capacity-reached").contains(status))throw new IllegalArgumentException();JSONObject s=state();s.put("status",status).put("lastAttemptAt",System.currentTimeMillis());save(s);}
 JSONObject status()throws Exception{JSONObject s=state();int uncertain=0,denied=0;JSONObject notices=s.getJSONObject("notices");for(String key:keys(notices)){String phase=notices.getJSONObject(key).getString("phase");if(phase.equals("uncertain")||phase.equals("dispatching"))uncertain++;if(phase.equals("denied"))denied++;}return new JSONObject().put("status",s.getString("status")).put("lastSyncAt",s.getLong("lastSyncAt")).put("incompleteCatchup",s.getBoolean("incompleteCatchup")).put("uncertainNotices",uncertain).put("deniedNotices",denied).put("grantId",s.getJSONObject("binding").getString("grantId"));}
 void capture(String key)throws Exception{if(key==null||!key.matches("[a-f0-9]{64}"))return;JSONObject s=state(),record=s.getJSONObject("notices").optJSONObject(key);if(record==null||!Set.of("posted","dispatching","uncertain").contains(record.getString("phase")))return;s.put("tap",new JSONObject().put("key",key).put("token",UUID.randomUUID().toString()));save(s);}
 JSONObject pending()throws Exception{JSONObject s=state(),tap=s.optJSONObject("tap");if(tap==null)return new JSONObject();JSONObject n=s.getJSONObject("notices").optJSONObject(tap.getString("key"));if(n==null||!Set.of("posted","dispatching","uncertain").contains(n.getString("phase")))return new JSONObject();JSONObject binding=s.getJSONObject("binding");return new JSONObject().put("token",tap.getString("token")).put("grantId",binding.getString("grantId")).put("credentialId",binding.getString("credentialId")).put("userId",binding.getString("userId")).put("generation",binding.getString("generation"));}
 void consume(String token)throws Exception{JSONObject s=state(),tap=s.getJSONObject("tap");if(!tap.getString("token").equals(token))throw new SecurityException("Gmail tap changed");String key=tap.getString("key");s.getJSONObject("notices").getJSONObject(key).put("phase","opened");s.remove("tap");save(s);poster.cancel(key);}
}
