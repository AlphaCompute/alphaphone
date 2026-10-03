package ai.elizaresearch.alphaphone;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** At-most-once OS dispatch. An uncertain or dismissed notice is never reposted. */
final class WorkflowNoticeDelivery {
 interface Storage {String read(String slot)throws Exception;void write(String slot,String value)throws Exception;}
 interface Poster {boolean allowed();void post(String id,String title,String body)throws Exception;boolean matches(String id,String title,String body)throws Exception;}
 private static final Object LOCK=new Object();
 static final String SLOT="workflow-notice-delivery:v1";
 private final Storage storage;private final Poster poster;
 WorkflowNoticeDelivery(Storage storage,Poster poster){this.storage=storage;this.poster=poster;}
 private static String text(String value,int maximum){if(value==null||value.isBlank()||value.length()>maximum||value.indexOf('\0')>=0)throw new IllegalArgumentException("Invalid notification text");return value;}
 private static String hash(String value)throws Exception{byte[] bytes=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();for(byte b:bytes)out.append(String.format(Locale.ROOT,"%02x",b&255));return out.toString();}
 private static String identity(String id,String binding,String title,String body)throws Exception{
  if(id==null||!id.matches("[A-Za-z0-9_-]{1,128}")||binding==null||!binding.matches("[a-f0-9]{64}"))throw new IllegalArgumentException("Invalid notification binding");
  return hash(new JSONArray().put(text(title,200)).put(text(body,2000)).toString());
 }
 private JSONObject ledger()throws Exception{String raw=storage.read(SLOT);JSONObject ledger=raw==null?new JSONObject():new JSONObject(raw);if(ledger.length()>512)throw new IllegalStateException("Notification receipt capacity exceeded");return ledger;}
 private String retained(JSONObject ledger,JSONObject record,String id,String binding,String digest,String title,String body)throws Exception{
  if(record.length()!=3||!binding.equals(record.getString("binding"))||!digest.equals(record.getString("digest"))||!Set.of("applying","succeeded","failed","unknown").contains(record.getString("status")))throw new IllegalStateException("Notification receipt mismatch");
  if(Set.of("applying","unknown").contains(record.getString("status"))){String status=poster.matches(id,title,body)?"succeeded":"unknown";if(!status.equals(record.getString("status"))){record.put("status",status);storage.write(SLOT,ledger.toString());}}
  return record.getString("status");
 }
 String receipt(String id,String binding,String title,String body)throws Exception{synchronized(LOCK){String digest=identity(id,binding,title,body);JSONObject ledger=ledger(),record=ledger.optJSONObject(id);if(record==null){if(ledger.has(id))throw new IllegalStateException("Invalid notification receipt");return "unknown";}return retained(ledger,record,id,binding,digest,title,body);}}
 String publish(String id,String binding,String title,String body)throws Exception{synchronized(LOCK){
  String digest=identity(id,binding,title,body);JSONObject ledger=ledger(),record=ledger.optJSONObject(id);
  if(record!=null)return retained(ledger,record,id,binding,digest,title,body);
  if(ledger.has(id)||ledger.length()>=512)throw new IllegalStateException("Notification receipt history is full or unavailable");
  record=new JSONObject().put("binding",binding).put("digest",digest).put("status",poster.allowed()?"applying":"failed");ledger.put(id,record);
  storage.write(SLOT,ledger.toString()); // A committed intent precedes every OS effect.
  if(record.getString("status").equals("failed"))return "failed";
  try{poster.post(id,title,body);record.put("status",poster.matches(id,title,body)?"succeeded":"unknown");}
  catch(Exception failure){record.put("status","unknown");}
  storage.write(SLOT,ledger.toString());return record.getString("status");
 }}
}
