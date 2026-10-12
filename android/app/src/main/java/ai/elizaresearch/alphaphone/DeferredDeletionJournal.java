package ai.elizaresearch.alphaphone;

import org.json.*;

/** Single-process durable admission for provider deletes. Never retries a dispatching write.
 * Store.save must commit atomically or throw; callers share one journal instance/lock. */
final class DeferredDeletionJournal {
 interface Store {String read()throws Exception;void save(String value)throws Exception;}
 interface Admission {String refusal(JSONObject owner,JSONObject target)throws Exception;}
 interface Delete {JSONObject apply(JSONObject target)throws Exception;}
 private final Store store;
 DeferredDeletionJournal(Store store){this.store=store;}
 private JSONObject read()throws Exception{String raw=store.read();if(raw==null)return new JSONObject().put("version",1).put("records",new JSONObject());JSONObject data=new JSONObject(raw);if(data.getInt("version")!=1)throw new IllegalStateException("Deletion journal unavailable");data.getJSONObject("records");return data;}
 private static JSONObject copy(JSONObject value)throws Exception{return new JSONObject(value.toString());}
 private static boolean same(Object a,Object b)throws Exception{
  if(a instanceof JSONObject&&b instanceof JSONObject){JSONObject x=(JSONObject)a,y=(JSONObject)b;if(x.length()!=y.length())return false;for(java.util.Iterator<String> i=x.keys();i.hasNext();){String key=i.next();if(!y.has(key)||!same(x.get(key),y.get(key)))return false;}return true;}
  if(a instanceof JSONArray&&b instanceof JSONArray){JSONArray x=(JSONArray)a,y=(JSONArray)b;if(x.length()!=y.length())return false;for(int i=0;i<x.length();i++)if(!same(x.get(i),y.get(i)))return false;return true;}
  return java.util.Objects.equals(a,b);
 }
 private static String window(JSONObject row,String continuity,long elapsed)throws Exception{
  JSONObject d=row.getJSONObject("deadline");long start=d.getLong("createdElapsed"),expiry=d.getLong("expiresElapsed");
  if(!d.getString("continuity").equals(continuity)||elapsed<start)return "clock-changed";
  return elapsed<expiry?"open":"expired";
 }
 synchronized JSONObject stage(String id,JSONObject owner,JSONObject target,DeletionDeadline deadline)throws Exception{
  if(id==null||!id.matches("[A-Za-z0-9_-]{1,128}"))throw new IllegalArgumentException("Deletion identity required");
  JSONObject data=read(),records=data.getJSONObject("records"),prior=records.optJSONObject(id);
  if(prior!=null){if(!same(owner,prior.getJSONObject("owner"))||!same(target,prior.getJSONObject("target")))throw new IllegalArgumentException("Deletion identity changed");return copy(prior);}
  if(records.length()>=500)throw new IllegalStateException("Deletion history full");
  JSONObject row=new JSONObject().put("version",1).put("id",id).put("owner",copy(owner)).put("target",copy(target)).put("phase","queued").put("deadline",new JSONObject().put("continuity",deadline.continuity).put("createdElapsed",deadline.createdElapsed).put("expiresElapsed",deadline.expiresElapsed).put("expiresAt",deadline.expiresAt));
  records.put(id,row);store.save(data.toString());return copy(row);
 }
 synchronized JSONArray list(String continuity,long elapsed)throws Exception{
  JSONObject records=read().getJSONObject("records");JSONArray rows=new JSONArray();for(java.util.Iterator<String> i=records.keys();i.hasNext();){JSONObject row=copy(records.getJSONObject(i.next()));if("queued".equals(row.getString("phase")))row.put("window",window(row,continuity,elapsed));else if("dispatching".equals(row.getString("phase")))row.put("phase","unknown");rows.put(row);}return rows;
 }
 synchronized JSONObject undo(String id,JSONObject owner,String continuity,long elapsed)throws Exception{
  JSONObject data=read(),row=data.getJSONObject("records").getJSONObject(id);
  if(!same(owner,row.getJSONObject("owner")))throw new SecurityException("Deletion owner changed");
  String phase=row.getString("phase");if(!"queued".equals(phase))return copy(row);
  if("expired".equals(window(row,continuity,elapsed)))throw new IllegalStateException("Undo window ended");
  row.put("phase","undone");store.save(data.toString());return copy(row);
 }
 synchronized JSONObject expire(String id,String continuity,long elapsed,Admission admission,Delete deletion)throws Exception{
  JSONObject data=read(),row=data.getJSONObject("records").getJSONObject(id);
  if(!"queued".equals(row.getString("phase"))||!"expired".equals(window(row,continuity,elapsed)))return copy(row);
  String refusal;try{refusal=admission.refusal(copy(row.getJSONObject("owner")),copy(row.getJSONObject("target")));}catch(Exception unavailable){refusal="owner-unavailable";}
  if(refusal!=null){row.put("blocked",refusal);store.save(data.toString());return copy(row);}
  row.remove("blocked");row.put("phase","dispatching");store.save(data.toString());
  JSONObject outcome;try{outcome=deletion.apply(copy(row.getJSONObject("target")));}catch(Exception unknown){outcome=new JSONObject().put("status","unknown");}
  String status=outcome.optString("status","unknown");if(!java.util.Arrays.asList("deleted","conflict","permission-required","unknown").contains(status))status="unknown";
  row.put("phase",status).put("outcome",outcome);store.save(data.toString());return copy(row);
 }
}
