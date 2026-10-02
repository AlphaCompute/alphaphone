package ai.elizaresearch.alphaphone;

import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import org.json.JSONObject;

/** Metadata-only journal; provider owns event text. Unknown operations are never replayed. */
final class CalendarCreationStore {
 private static final String STORE="alpha-calendar-creations-v1";
 private static boolean quarantined;
 private static SharedPreferences preferences(Context context) {
  if(quarantined)throw new IllegalStateException("Restart Alpha after calendar journal persistence failure");
  return context.getSharedPreferences(STORE,Context.MODE_PRIVATE);
 }
 private static JSONObject read(Context context)throws Exception {
  JSONObject value=new JSONObject(preferences(context).getString("operations","{}"));
  if(value.length()>1000)throw new IllegalStateException("Calendar operation journal full");
  return value;
 }
 private static void write(Context context,JSONObject value) {
  boolean committed=false;
  try{committed=preferences(context).edit().putString("operations",value.toString()).commit();if(!committed)throw new IllegalStateException("Calendar operation persistence failed");}
  finally{if(!committed)quarantined=true;}
 }
 private static String identity(String id) {
  if(id==null||!id.matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"))throw new IllegalArgumentException("Calendar creation identity required");
  return "alphaphone://calendar-creation/"+id;
 }
 private static String digest(ContentValues values)throws Exception {
  ArrayList<String> keys=new ArrayList<>(values.keySet());Collections.sort(keys);StringBuilder text=new StringBuilder();
  for(String key:keys){String value=values.getAsString(key);text.append(key.length()).append(':').append(key).append(value==null?-1:value.length()).append(':').append(value==null?"":value);}
  byte[] hash=MessageDigest.getInstance("SHA-256").digest(text.toString().getBytes(StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();for(byte b:hash)out.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return out.toString();
 }
 private static JSObject response(String id,JSONObject record)throws Exception {
  JSObject result=new JSObject();result.put("creationId",id);result.put("status",record.optString("status","unknown"));
  if("saved".equals(record.optString("status"))){result.put("id",record.getString("eventId"));result.put("calendarId",record.getString("calendarId"));}
  return result;
 }
 private static boolean pending(JSONObject all)throws Exception {
  for(Iterator<String> it=all.keys();it.hasNext();)if(!all.getJSONObject(it.next()).optBoolean("acknowledged"))return true;
  return false;
 }
 private static boolean reconcile(Context context,String id,JSONObject record)throws Exception {
  if("saved".equals(record.optString("status")))return false;
  String[] fields={CalendarContract.Events._ID,CalendarContract.Events.CALENDAR_ID,CalendarContract.Events.TITLE,CalendarContract.Events.DESCRIPTION,CalendarContract.Events.EVENT_LOCATION,CalendarContract.Events.DTSTART,CalendarContract.Events.DTEND,CalendarContract.Events.EVENT_TIMEZONE};
  String where=CalendarContract.Events.CUSTOM_APP_PACKAGE+"=? AND "+CalendarContract.Events.CUSTOM_APP_URI+"=? AND "+CalendarContract.Events.DELETED+"=0";
  try(Cursor rows=context.getContentResolver().query(CalendarContract.Events.CONTENT_URI,fields,where,new String[]{context.getPackageName(),identity(id)},null)) {
   if(rows==null||rows.getCount()!=1||!rows.moveToFirst())return false;
   ContentValues actual=new ContentValues();for(int i=1;i<fields.length;i++){if(rows.isNull(i))actual.putNull(fields[i]);else actual.put(fields[i],rows.getString(i));}
   if(!record.getString("argumentHash").equals(digest(actual)))return false;
   record.put("status","saved").put("eventId",Long.toString(rows.getLong(0)));return true;
  }
 }
 static synchronized JSObject create(Context context,String id,ContentValues values,boolean separate)throws Exception {
  identity(id);JSONObject all=read(context);String binding=digest(values);
  if(all.has(id)) {
   JSONObject record=all.getJSONObject(id);if(!binding.equals(record.getString("argumentHash")))throw new IllegalArgumentException("Calendar creation identity changed");
   if(reconcile(context,id,record))write(context,all);return response(id,record);
  }
  if(pending(all)&&!separate){JSObject result=new JSObject();result.put("status","pending-creation");return result;}
  if(all.length()>=1000)throw new IllegalStateException("Calendar operation journal full");
  JSONObject record=new JSONObject().put("argumentHash",binding).put("calendarId",values.getAsString(CalendarContract.Events.CALENDAR_ID)).put("status","unknown").put("acknowledged",false);
  all.put(id,record);write(context,all); // Durable unknown must precede the provider effect.
  ContentValues insert=new ContentValues(values);insert.put(CalendarContract.Events.CUSTOM_APP_PACKAGE,context.getPackageName());insert.put(CalendarContract.Events.CUSTOM_APP_URI,identity(id));
  try {
   Uri uri=context.getContentResolver().insert(CalendarContract.Events.CONTENT_URI,insert);
   if(uri==null||ContentUris.parseId(uri)<=0)throw new IllegalStateException("Missing inserted calendar identity");
   if(reconcile(context,id,record))write(context,all);
  }catch(Exception uncertain){/* Persisted unknown survives provider/readback/receipt response loss. */}
  preferences(context); // A failed journal commit must never expose its in-memory receipt.
  return response(id,record);
 }
 static synchronized JSObject pendingCreations(Context context)throws Exception {
  JSONObject all=read(context);JSArray pending=new JSArray();boolean changed=false;
  for(Iterator<String> it=all.keys();it.hasNext();) {
   String id=it.next();JSONObject record=all.getJSONObject(id);if(record.optBoolean("acknowledged"))continue;
   try{changed|=reconcile(context,id,record);}catch(Exception unavailable){/* Keep unknown; query failure never authorizes insertion. */}
   pending.put(response(id,record));
  }
  if(changed)write(context,all);JSObject result=new JSObject();result.put("status","ready");result.put("creations",pending);return result;
 }
 static synchronized void acknowledge(Context context,String id)throws Exception {
  identity(id);JSONObject all=read(context);JSONObject record=all.getJSONObject(id);
  if(!"saved".equals(record.optString("status")))throw new IllegalStateException("Unconfirmed calendar creation cannot be cleared");
  record.put("acknowledged",true);write(context,all);
 }
}
