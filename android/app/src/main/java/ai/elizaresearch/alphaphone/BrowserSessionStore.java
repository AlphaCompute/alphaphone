package ai.elizaresearch.alphaphone;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import java.security.KeyStore;
import java.util.LinkedHashSet;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Normal-tab browsing history and the restorable tab list. Private tabs never
 * reach this store. URLs can carry private query parameters, so the bounded
 * device-local record is AES-GCM encrypted with an Android Keystore key, like
 * bookmarks. It holds no page content, form data, cookies or credentials. */
final class BrowserSessionStore {
 static final int MAX_HISTORY=100, MAX_TABS=8, MAX_TITLE=200;
 private static final String ALIAS="alpha-browser-session-v1";
 private final SharedPreferences preferences;
 BrowserSessionStore(Context context){preferences=context.getSharedPreferences("alpha-browser-session",Context.MODE_PRIVATE);}
 private SecretKey key()throws Exception{
  KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
  if(store.containsAlias(ALIAS))return (SecretKey)store.getKey(ALIAS,null);
  KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
  generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());return generator.generateKey();
 }
 static boolean validUrl(String value){
  if(value==null||value.isEmpty()||value.length()>4096||value.matches("(?s).*[\\x00-\\x20\\x7f].*"))return false;
  try{Uri uri=Uri.parse(value);String scheme=uri.getScheme();return ("https".equalsIgnoreCase(scheme)||"http".equalsIgnoreCase(scheme))&&uri.getHost()!=null&&uri.getUserInfo()==null;}catch(Exception invalid){return false;}
 }
 static boolean validId(String value){return value!=null&&value.matches("[A-Za-z0-9_-]{1,80}");}
 static String title(String value){
  if(value==null)return "";
  StringBuilder out=new StringBuilder();
  for(int i=0;i<value.length()&&out.length()<MAX_TITLE;i++){char c=value.charAt(i);out.append(c<32||c==127?' ':c);}
  return out.toString().trim();
 }
 /** Canonical bounded form. Invalid rows are dropped rather than stored. */
 static JSONObject normalize(JSONObject input)throws Exception{
  JSONObject result=new JSONObject();JSONArray history=new JSONArray(),tabs=new JSONArray();
  LinkedHashSet<String> seen=new LinkedHashSet<>();
  JSONArray rawHistory=input.optJSONArray("history");
  if(rawHistory!=null)for(int i=0;i<rawHistory.length()&&seen.size()<MAX_HISTORY;i++){String url=rawHistory.optString(i,null);if(validUrl(url)&&seen.add(url))history.put(url);}
  LinkedHashSet<String> ids=new LinkedHashSet<>();
  JSONArray rawTabs=input.optJSONArray("tabs");
  if(rawTabs!=null)for(int i=0;i<rawTabs.length()&&ids.size()<MAX_TABS;i++){
   JSONObject tab=rawTabs.optJSONObject(i);if(tab==null)continue;
   String id=tab.optString("id",null),url=tab.optString("url",null);
   if(!validId(id)||!validUrl(url)||!ids.add(id))continue;
   tabs.put(new JSONObject().put("id",id).put("url",url).put("title",title(tab.optString("title",""))));
  }
  String cur=input.optString("cur","");
  result.put("history",history).put("tabs",tabs).put("cur",ids.contains(cur)?cur:"");
  return result;
 }
 private String seal(JSONObject value)throws Exception{
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
  byte[] encrypted=cipher.doFinal(value.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
  return Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(encrypted,Base64.NO_WRAP);
 }
 private JSONObject open(String packed)throws Exception{
  String[] parts=packed.split(":",-1);if(parts.length!=2||packed.length()>2000000)throw new IllegalStateException();
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));
  return new JSONObject(new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),java.nio.charset.StandardCharsets.UTF_8));
 }
 synchronized JSONObject read()throws Exception{
  String packed=preferences.getString("sealed",null);
  if(packed==null)return normalize(new JSONObject());
  return normalize(open(packed));
 }
 synchronized JSONObject write(JSONObject state)throws Exception{
  JSONObject canonical=normalize(state);
  if(!preferences.edit().putString("sealed",seal(canonical)).commit())throw new IllegalStateException();
  return canonical;
 }
 synchronized void clear(){if(!preferences.edit().remove("sealed").commit())throw new IllegalStateException();}

 /* Website permission decisions for the persistent normal-tab profile only:
  * {"https://host[:port]":{"camera":true,"microphone":false,"location":true}}.
  * Private tabs never read or write them. Origins reveal visited sites, so the
  * record is sealed with the same Keystore key. Bounded to MAX_PERMISSION_ORIGINS. */
 static final int MAX_PERMISSION_ORIGINS=200;
 static final java.util.Set<String> PERMISSION_KINDS=java.util.Set.of("camera","microphone","location");
 static boolean validOrigin(String origin){return origin!=null&&origin.length()<=300&&origin.matches("https?://[a-z0-9.\\-\\[\\]:]+");}
 synchronized JSONObject permissions(){
  String packed=preferences.getString("permissions",null);
  if(packed==null)return new JSONObject();
  // A damaged record grants nothing: every site is asked again.
  try{return open(packed);}catch(Exception damaged){return new JSONObject();}
 }
 /** Stored decision, or null when the site must be asked. */
 synchronized Boolean permission(String origin,String kind){
  JSONObject site=permissions().optJSONObject(origin);
  return site==null||!site.has(kind)?null:site.optBoolean(kind,false);
 }
 synchronized void setPermission(String origin,String kind,boolean allowed)throws Exception{
  if(!validOrigin(origin)||!PERMISSION_KINDS.contains(kind))throw new IllegalArgumentException();
  JSONObject all=permissions(),site=all.optJSONObject(origin);if(site==null)site=new JSONObject();
  site.put(kind,allowed);all.remove(origin);
  // Insertion order is oldest first; drop the oldest origins beyond the bound.
  JSONObject bounded=new JSONObject();java.util.ArrayList<String> names=new java.util.ArrayList<>();java.util.Iterator<String> keys=all.keys();while(keys.hasNext())names.add(keys.next());
  for(int i=Math.max(0,names.size()-(MAX_PERMISSION_ORIGINS-1));i<names.size();i++)bounded.put(names.get(i),all.get(names.get(i)));
  bounded.put(origin,site);
  if(!preferences.edit().putString("permissions",seal(bounded)).commit())throw new IllegalStateException();
 }
 synchronized void clearPermissions(){if(!preferences.edit().remove("permissions").commit())throw new IllegalStateException();}
 /** Remove decisions for a registrable domain and its subdomains (Clear data for this site). */
 synchronized void clearPermissionsForSite(String site)throws Exception{
  if(site==null||site.isEmpty())return;String domain=site.toLowerCase(java.util.Locale.ROOT);
  JSONObject all=permissions(),kept=new JSONObject();java.util.Iterator<String> keys=all.keys();
  while(keys.hasNext()){String origin=keys.next();String host=Uri.parse(origin).getHost();if(host!=null&&(host.equals(domain)||host.endsWith("."+domain)))continue;kept.put(origin,all.get(origin));}
  if(!preferences.edit().putString("permissions",seal(kept)).commit())throw new IllegalStateException();
 }
}
