package ai.elizaresearch.alphaphone;

import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.UUID;

/** Durable, redacted notice projection; it never schedules or executes a workflow. */
final class HostedResultNotices {
 interface Storage { String read(String slot)throws Exception; void write(String slot,String value)throws Exception; }
 interface Poster { boolean allowed(); boolean active(String key); void post(String key); void cancel(String key); }
 static final String LEDGER="hosted-notices:v1", PENDING="hosted-notices:pending:v1";
 private final Storage storage; private final Poster poster;
 HostedResultNotices(Storage storage,Poster poster){this.storage=storage;this.poster=poster;}
 static String hash(String value)throws Exception {byte[] digest=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();for(byte b:digest)out.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return out.toString();}
 private JSONObject read(String slot)throws Exception {String value=storage.read(slot);return value==null?new JSONObject():new JSONObject(value);}
 private void write(String slot,JSONObject value)throws Exception {storage.write(slot,value.toString());}
 private static String required(JSONObject value,String name)throws Exception {String text=value.getString(name);if(text.isBlank()||text.length()>2048)throw new IllegalArgumentException("Invalid notice identity");return text;}
 private JSONObject result(JSONObject route)throws Exception {
  String scope=required(route,"scope"),origin=required(route,"origin"),owner=required(route,"ownerId"),agent=required(route,"agentId"),run=required(route,"runId");
  if(!scope.matches("[a-f0-9]{64}")||!run.matches("[A-Za-z0-9][A-Za-z0-9_-]{0,127}")||!scope.equals(hash(new JSONArray().put(origin).put(owner).put(agent).toString())))throw new IllegalArgumentException("Notice scope mismatch");
  String slot="hosted-digests:v1:"+scope;JSONObject index=read(slot);JSONArray ids=index.optJSONArray("ids");boolean found=false;
  if(ids!=null)for(int i=0;i<ids.length();i++)if(run.equals(ids.getString(i)))found=true;
  if(!found)throw new IllegalStateException("Result is not retained");
  JSONObject result=read(slot+":"+run);
  if(!run.equals(result.optString("runId"))||!required(route,"workflowId").equals(result.optString("workflowId"))||!required(route,"workflowVersionId").equals(result.optString("workflowVersionId")))throw new IllegalStateException("Retained result mismatch");
  return result;
 }
 synchronized String publish(JSONObject requested)throws Exception {
  JSONObject result=result(requested);String digest=hash(result.toString()),key=hash(requested.getString("scope")+":"+requested.getString("runId"));
  JSONObject ledger=read(LEDGER),record=ledger.optJSONObject(key);
  if(record!=null){
   if(!digest.equals(record.getString("digest")))throw new IllegalStateException("Retained result changed");
   String phase=record.getString("phase");
   if(phase.equals("dispatching")){record.put("phase",poster.active(key)?"posted":"uncertain");write(LEDGER,ledger);}
   return record.getString("phase");
  }
  record=new JSONObject();for(String field:new String[]{"scope","origin","ownerId","agentId","runId","workflowId","workflowVersionId"})record.put(field,required(requested,field));
  record.put("key",key).put("digest",digest).put("createdAt",System.currentTimeMillis()).put("phase",poster.allowed()?"dispatching":"denied");
  ledger.put(key,record);
  // Bound encrypted metadata across accounts. A pending tap is never evicted.
  String pendingKey=read(PENDING).optString("key");ArrayList<String> keys=new ArrayList<>();ledger.keys().forEachRemaining(keys::add);keys.sort(Comparator.comparingLong(k->ledger.optJSONObject(k).optLong("createdAt")));
  while(ledger.length()>200){String oldest=null;for(String candidate:keys)if(!candidate.equals(key)&&!candidate.equals(pendingKey)){oldest=candidate;break;}if(oldest==null)throw new IllegalStateException("Notice history full");keys.remove(oldest);ledger.remove(oldest);poster.cancel(oldest);}
  write(LEDGER,ledger); // Exact route and uncertain dispatch state precede any OS effect.
  if(record.getString("phase").equals("denied"))return "denied";
  try {poster.post(key);record.put("phase","posted");write(LEDGER,ledger);return "posted";}
  catch(SecurityException denied){record.put("phase","denied");write(LEDGER,ledger);return "denied";}
 }
 synchronized void capture(String key)throws Exception {
  if(key==null||!key.matches("[a-f0-9]{64}"))return;
  JSONObject ledger=read(LEDGER),record=ledger.optJSONObject(key);if(record==null)return;
  JSONObject previous=read(PENDING);if(key.equals(previous.optString("key")))return;
  write(PENDING,new JSONObject().put("key",key).put("token",UUID.randomUUID().toString()));
 }
 synchronized JSONObject peek()throws Exception {
  JSONObject pending=read(PENDING),record=read(LEDGER).optJSONObject(pending.optString("key"));
  if(record==null)return new JSONObject();
  JSONObject out=new JSONObject(record.toString());out.remove("digest");out.remove("createdAt");out.remove("phase");out.put("token",pending.getString("token"));
  try{JSONObject result=result(record);if(!hash(result.toString()).equals(record.getString("digest")))throw new IllegalStateException();out.put("retained",true);}catch(Exception missing){out.put("retained",false);}
  return out;
 }
 synchronized void consume(String token)throws Exception {
  JSONObject pending=read(PENDING);if(!token.equals(pending.optString("token")))throw new IllegalStateException("Tap changed");
  String key=pending.getString("key");JSONObject ledger=read(LEDGER),record=ledger.optJSONObject(key);
  if(record!=null){record.put("phase","opened");write(LEDGER,ledger);}write(PENDING,new JSONObject());poster.cancel(key);
 }
}
