package ai.elizaresearch.alphaphone;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

/** Private saved-binding identity. It grants no reminder permission or authenticated owner role. */
final class LocalAgentProviderAdmission {
 static final String PROVIDER_SLOT="local-agent-provider:v1";
 private static final String GENERATION="admissionGeneration",FINGERPRINT="admissionFingerprint";
 private static String uuid(Object value)throws Exception {
  if(!(value instanceof String))throw new IllegalArgumentException();
  String canonical=UUID.fromString((String)value).toString();
  if(!canonical.equals(value))throw new IllegalArgumentException();
  return canonical;
 }
 static String withoutAdmission(String saved)throws Exception {
  JSONObject provider=new JSONObject(saved);provider.remove(GENERATION);provider.remove(FINGERPRINT);return provider.toString();
 }
 private static String fingerprint(JSONObject selected,String cloud)throws Exception {
  String kind=selected.optString("provider","cerebras"),model=selected.getString("model");
  JSONArray identity=new JSONArray().put(1).put(kind).put(model);
  if("elizacloud".equals(kind)){
   if(!AlphaLocalAgentPlugin.CLOUD_PROVIDER_MODEL.equals(model)||!"production".equals(selected.optString("environment","production")))throw new IllegalArgumentException();
   String id=selected.getString("credentialId");
   String token=AlphaLocalAgentPlugin.cloudProviderToken(cloud,id,System.currentTimeMillis());
   JSONObject credential=new JSONObject(cloud);
   identity.put("production").put(id).put(credential.opt("userId")).put(credential.opt("organizationId")).put(token);
  }else if("cerebras".equals(kind)){
   String key=selected.getString("key");
   if(!model.matches(AlphaLocalAgentPlugin.PROVIDER_MODEL_PATTERN)||!AlphaLocalAgentPlugin.validProviderToken(key,1024))throw new IllegalArgumentException();
   String environment=selected.optString("environment","production");
   if(!"production".equals(environment))throw new IllegalArgumentException();
   identity.put(environment).put(key);
  }else throw new IllegalArgumentException();
  byte[] bytes=identity.toString().getBytes(StandardCharsets.UTF_8);
  try{
   byte[] digest=MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder hex=new StringBuilder();
   for(byte value:digest)hex.append(String.format(java.util.Locale.ROOT,"%02x",value&255));
   return hex.toString();
  }finally{java.util.Arrays.fill(bytes,(byte)0);}
 }
 /** Invoked only by explicit native configuration inside the existing credential mutation lock. */
 static String admit(String previous,String selection,String cloud)throws Exception {
  JSONObject selected=new JSONObject(withoutAdmission(selection));
  String nextFingerprint=fingerprint(selected,cloud),generation=null;
  if(previous!=null){
   try{
    JSONObject old=new JSONObject(previous);
    if(nextFingerprint.equals(old.opt(FINGERPRINT))&&nextFingerprint.equals(fingerprint(old,cloud)))generation=uuid(old.opt(GENERATION));
   }catch(Exception unavailable){/* An old or changed binding receives a fresh identity only on this explicit admission. */}
  }
  selected.put(GENERATION,generation==null?UUID.randomUUID().toString():generation).put(FINGERPRINT,nextFingerprint);
  return selected.toString();
 }
 /** Never writes, migrates legacy state, or mints an identity. */
 static String currentGeneration(String saved,String cloud){
  try{
   JSONObject selected=new JSONObject(saved);
   String generation=uuid(selected.opt(GENERATION));
   return fingerprint(selected,cloud).equals(selected.opt(FINGERPRINT))?generation:null;
  }catch(Exception unavailable){return null;}
 }
}
