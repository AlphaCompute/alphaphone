package ai.elizaresearch.alphaphone;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONArray;
import java.security.KeyStore;
import java.util.ArrayList;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Explicit bookmarks only. URLs can contain private query parameters, so the
 * bounded device-local store is encrypted; no page content/history/cookies. */
final class BrowserBookmarks {
 private static final String ALIAS="alpha-browser-bookmarks-v1";
 private final SharedPreferences preferences;
 BrowserBookmarks(Context context){preferences=context.getSharedPreferences("alpha-browser-bookmarks",Context.MODE_PRIVATE);}
 private SecretKey key()throws Exception{
  KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
  if(store.containsAlias(ALIAS))return (SecretKey)store.getKey(ALIAS,null);
  KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
  generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());return generator.generateKey();
 }
 static boolean valid(String value){
  if(value==null||value.isEmpty()||value.length()>4096||value.matches("(?s).*[\\x00-\\x20\\x7f].*"))return false;
  try{Uri uri=Uri.parse(value);return "https".equalsIgnoreCase(uri.getScheme())&&uri.getHost()!=null&&uri.getUserInfo()==null;}catch(Exception invalid){return false;}
 }
 synchronized ArrayList<String> read()throws Exception{
  String packed=preferences.getString("sealed",null);ArrayList<String> result=new ArrayList<>();if(packed==null)return result;
  String[] parts=packed.split(":",-1);if(parts.length!=2||packed.length()>800000)throw new IllegalStateException();
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));
  JSONArray rows=new JSONArray(new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),java.nio.charset.StandardCharsets.UTF_8));
  if(rows.length()>100)throw new IllegalStateException();
  for(int i=0;i<rows.length();i++){String value=rows.getString(i);if(!valid(value)||result.contains(value))throw new IllegalStateException();result.add(value);}return result;
 }
 synchronized ArrayList<String> change(String url,boolean saved)throws Exception{
  if(!valid(url))throw new IllegalArgumentException();ArrayList<String> rows=read();rows.remove(url);
  if(saved){if(rows.size()>=100)throw new IllegalStateException();rows.add(0,url);}
  JSONArray json=new JSONArray();for(String value:rows)json.put(value);
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
  byte[] encrypted=cipher.doFinal(json.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
  if(!preferences.edit().putString("sealed",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(encrypted,Base64.NO_WRAP)).commit())throw new IllegalStateException();
  return rows;
 }
}
