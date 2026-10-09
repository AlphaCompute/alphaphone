package ai.elizaresearch.alphaphone;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

/** Private saved-binding identity. It grants no reminder permission or authenticated owner role. */
final class LocalAgentProviderAdmission {
 static final String PROVIDER_SLOT="local-agent-provider:v1";
 private static final String GENERATION="admissionGeneration",FINGERPRINT="admissionFingerprint",CLOUD_IDENTITY="verifiedCloudIdentity";
 private static String uuid(Object value)throws Exception {
  if(!(value instanceof String))throw new IllegalArgumentException();
  String canonical=UUID.fromString((String)value).toString();
  if(!canonical.equals(value))throw new IllegalArgumentException();
  return canonical;
 }
 static String withoutAdmission(String saved)throws Exception {
  JSONObject provider=new JSONObject(saved);provider.remove(GENERATION);provider.remove(FINGERPRINT);provider.remove(CLOUD_IDENTITY);return provider.toString();
 }
 private static String cloudId(Object value)throws Exception {
  if(!(value instanceof String)||!((String)value).matches("(?i)[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"))throw new IllegalArgumentException();
  return UUID.fromString((String)value).toString();
 }
 static JSONObject verifiedCloudIdentity(JSONObject data)throws Exception {
  JSONObject identity=new JSONObject().put("userId",cloudId(data.opt("id")));
  Object organization=data.opt("organization_id");
  if(organization!=null&&organization!=JSONObject.NULL)identity.put("organizationId",cloudId(organization));
  return identity;
 }
 private static JSONObject cloudIdentity(JSONObject selected)throws Exception {
  JSONObject saved=selected.getJSONObject(CLOUD_IDENTITY);
  if(saved.length()<1||saved.length()>2)throw new IllegalArgumentException();
  JSONObject identity=new JSONObject().put("userId",cloudId(saved.opt("userId")));
  if(saved.has("organizationId"))identity.put("organizationId",cloudId(saved.opt("organizationId")));
  if(identity.length()!=saved.length())throw new IllegalArgumentException();
  return identity;
 }
 static String cloudAccountRef(JSONObject selected)throws Exception {
  JSONObject identity=cloudIdentity(selected);
  return new JSONArray().put("cloud").put("production").put(identity.getString("userId")).put(identity.opt("organizationId")).toString();
 }
 private static JSONArray cloudIdentity(String saved,String expectedId)throws Exception {
  String token=AlphaLocalAgentPlugin.cloudProviderToken(saved,expectedId,System.currentTimeMillis());
  JSONObject credential=new JSONObject(saved);
  return new JSONArray().put("production").put(expectedId).put(credential.opt("userId")).put(credential.opt("organizationId")).put(token);
 }
 /** Metadata/reserialization is not credential replacement; invalid or removed records never match. */
 static boolean sameCloudCredential(String before,String after){
  try{
   String id=new JSONObject(before).getString("credentialId");
   return cloudIdentity(before,id).toString().equals(cloudIdentity(after,id).toString());
  }catch(Exception unavailable){return false;}
 }
 private static String fingerprint(JSONObject selected,String cloud)throws Exception {
  String kind=selected.optString("provider","cerebras"),model=selected.getString("model");
  JSONArray identity=new JSONArray().put(1).put(kind).put(model);
  if("elizacloud".equals(kind)){
   if(!AlphaLocalAgentPlugin.CLOUD_PROVIDER_MODEL.equals(model)||!"production".equals(selected.optString("environment","production")))throw new IllegalArgumentException();
   String id=selected.getString("credentialId");
   JSONArray credentialIdentity=cloudIdentity(cloud,id);
   for(int index=0;index<credentialIdentity.length();index++)identity.put(credentialIdentity.get(index));
   JSONObject verified=cloudIdentity(selected);
   identity.put(verified.getString("userId")).put(verified.opt("organizationId"));
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
 static String admit(String previous,String selection,String cloud,JSONObject verifiedIdentity)throws Exception {
  JSONObject selected=new JSONObject(withoutAdmission(selection));
  if("elizacloud".equals(selected.optString("provider"))){
   selected.put(CLOUD_IDENTITY,verifiedIdentity);
   cloudIdentity(selected);
  }else if(verifiedIdentity!=null)throw new IllegalArgumentException();
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
