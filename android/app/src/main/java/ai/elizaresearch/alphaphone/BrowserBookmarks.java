package ai.elizaresearch.alphaphone;

import ai.eliza.plugins.securestore.nativeonly.KeystoreTextFrame;
import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import org.json.JSONArray;
import java.util.ArrayList;

/** Explicit bookmarks only. URLs can contain private query parameters, so the
 * bounded device-local store is encrypted; no page content/history/cookies. */
final class BrowserBookmarks {
 private static final String ALIAS="alpha-browser-bookmarks-v1";
 private final SharedPreferences preferences;
 private final KeystoreTextFrame frame=new KeystoreTextFrame(ALIAS,800000);
 BrowserBookmarks(Context context){preferences=context.getSharedPreferences("alpha-browser-bookmarks",Context.MODE_PRIVATE);}
 static boolean valid(String value){
  if(value==null||value.isEmpty()||value.length()>4096||value.matches("(?s).*[\\x00-\\x20\\x7f].*"))return false;
  try{Uri uri=Uri.parse(value);return "https".equalsIgnoreCase(uri.getScheme())&&uri.getHost()!=null&&uri.getUserInfo()==null;}catch(Exception invalid){return false;}
 }
 synchronized ArrayList<String> read()throws Exception{
  String packed=preferences.getString("sealed",null);ArrayList<String> result=new ArrayList<>();if(packed==null)return result;
  JSONArray rows=new JSONArray(frame.open(packed));
  if(rows.length()>100)throw new IllegalStateException();
  for(int i=0;i<rows.length();i++){String value=rows.getString(i);if(!valid(value)||result.contains(value))throw new IllegalStateException();result.add(value);}return result;
 }
 synchronized ArrayList<String> change(String url,boolean saved)throws Exception{
  if(!valid(url))throw new IllegalArgumentException();ArrayList<String> rows=read();rows.remove(url);
  if(saved){if(rows.size()>=100)throw new IllegalStateException();rows.add(0,url);}
  JSONArray json=new JSONArray();for(String value:rows)json.put(value);
  if(!preferences.edit().putString("sealed",frame.seal(json.toString())).commit())throw new IllegalStateException();
  return rows;
 }
}
