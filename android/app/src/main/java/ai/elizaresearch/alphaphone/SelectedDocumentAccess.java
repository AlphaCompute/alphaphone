package ai.elizaresearch.alphaphone;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/** Opaque picker capabilities. Persist only grants actually offered by Android;
 * the registry is device-local and never sent to a signed-in agent account. */
final class SelectedDocumentAccess {
 private static final int MAX_SELECTIONS = 32;
 private static final int MAX_TEXT_BYTES = 64 * 1024;
 private static final Map<String, Uri> selected = new LinkedHashMap<>();
 private static final Map<String, Integer> retained = new LinkedHashMap<>();
 private static Context owner;
 private SelectedDocumentAccess() {}
 static synchronized void initialize(Context context) {
  if(owner!=null)return; owner=context.getApplicationContext();
  try {
   org.json.JSONArray entries=new org.json.JSONArray(owner.getSharedPreferences("selected-documents",0).getString("records","[]"));
   for(int i=0;i<Math.min(entries.length(),MAX_SELECTIONS);i++){
    org.json.JSONObject entry=entries.getJSONObject(i);String id=entry.getString("id");Uri uri=Uri.parse(entry.getString("uri"));int flags=entry.getInt("flags");
    if(!id.matches("[a-f0-9-]{36}")||!"content".equals(uri.getScheme())||flags<1||flags>3)continue;
    selected.put(id,uri);retained.put(id,flags);
   }
  }catch(Exception ignored){/* Corrupt registry confers no new access. */}
 }
 private static void persist(){
  org.json.JSONArray entries=new org.json.JSONArray();
  try{for(Map.Entry<String,Integer> entry:retained.entrySet())if(selected.containsKey(entry.getKey())){
   org.json.JSONObject record=new org.json.JSONObject();record.put("id",entry.getKey());record.put("uri",selected.get(entry.getKey()).toString());record.put("flags",entry.getValue());entries.put(record);
  }}catch(org.json.JSONException error){throw new IllegalStateException(error);}
  if(!owner.getSharedPreferences("selected-documents",0).edit().putString("records",entries.toString()).commit())throw new IllegalStateException("Selection could not be saved");
 }
 static synchronized String authorize(Context context,Uri uri,int flags) {
  initialize(context);if(uri==null||!"content".equals(uri.getScheme()))throw new IllegalArgumentException("Picker content URI required");
  String id=UUID.randomUUID().toString();if(flags!=0)for(Map.Entry<String,Integer> previous:retained.entrySet())if(uri.equals(selected.get(previous.getKey())))flags|=previous.getValue();selected.put(id,uri);if(flags!=0)retained.put(id,flags);
  try{persist();}catch(RuntimeException error){selected.remove(id);retained.remove(id);releaseUnused(uri,flags);throw error;}
  while(selected.size()>MAX_SELECTIONS)forget(selected.keySet().iterator().next());return id;
 }
 static synchronized Uri resolve(String id) {
  Uri uri=id==null?null:selected.get(id);if(uri==null)return null;
  if(retained.containsKey(id)){
   boolean granted=false;for(android.content.UriPermission permission:owner.getContentResolver().getPersistedUriPermissions())if(permission.getUri().equals(uri)&&permission.isReadPermission()){granted=true;break;}
   if(!granted){forget(id);return null;}
  }
  return uri;
 }
 private static void releaseUnused(Uri uri,int flags){
  if(uri==null||flags==0||selected.containsValue(uri))return;
  try{owner.getContentResolver().releasePersistableUriPermission(uri,flags);}catch(SecurityException ignored){/* Already revoked by the provider. */}
 }
 static synchronized void forget(String id) {
  if(id==null)return;Uri uri=selected.remove(id);Integer flags=retained.remove(id);
  try{persist();}catch(RuntimeException error){if(uri!=null)selected.put(id,uri);if(flags!=null)retained.put(id,flags);throw error;}
  releaseUnused(uri,flags==null?0:flags);clearPreview(id);
 }
 private static void clearPreview(String id){if(owner==null||id==null||!id.matches("[a-f0-9-]{36}"))return;new java.io.File(owner.getCacheDir(),"document-"+id+".pdf").delete();new java.io.File(owner.getCacheDir(),"document-"+id+".png").delete();}
 static synchronized JSObject restore(Context context){
  initialize(context);String[] ids=retained.keySet().toArray(new String[0]);
  for(int i=ids.length-1;i>=0;i--){String id=ids[i];Uri uri=selected.get(id);boolean valid=false;
   for(android.content.UriPermission grant:context.getContentResolver().getPersistedUriPermissions())if(grant.getUri().equals(uri)&&grant.isReadPermission()){valid=true;break;}
   if(!valid){forget(id);continue;}
   try{JSObject value=describe(context,id);value.put("status","selected");value.put("action","files");return value;}catch(SecurityException error){forget(id);}catch(RuntimeException error){return result("failed","The saved document provider is unavailable. Try again or select another document.");}
  }
  return result("unavailable","No saved document selection");
 }
 /** Reopen one recorded selection by its opaque ID, only while Android still
  * holds its grant. A revoked grant is forgotten and reported, never repaired. */
 static synchronized JSObject describeSelected(Context context,String id){
  initialize(context);
  if(id==null||!id.matches("[a-f0-9-]{36}")||resolve(id)==null)return result("unavailable","Access to this file ended. Select it again.");
  try{JSObject value=describe(context,id);value.put("status","selected");value.put("action","files");return value;}
  catch(SecurityException error){forget(id);return result("unavailable","Access to this file ended. Select it again.");}
  catch(RuntimeException error){return result("failed","The document provider is unavailable. Try again.");}
 }
 private static JSObject describe(Context context,String id){
  Uri uri=resolve(id);if(uri==null)throw new IllegalArgumentException();JSObject value=new JSObject();value.put("selectionId",id);value.put("uri",uri.toString());value.put("mimeType",context.getContentResolver().getType(uri));
  try(android.database.Cursor cursor=context.getContentResolver().query(uri,new String[]{android.provider.OpenableColumns.DISPLAY_NAME},null,null,null)){if(cursor==null||!cursor.moveToFirst())throw new IllegalStateException();value.put("name",cursor.getString(0));}
  boolean rename=false;
  try(android.database.Cursor cursor=context.getContentResolver().query(uri,new String[]{android.provider.DocumentsContract.Document.COLUMN_FLAGS},null,null,null)){if(cursor!=null&&cursor.moveToFirst())rename=(cursor.getInt(0)&android.provider.DocumentsContract.Document.FLAG_SUPPORTS_RENAME)!=0;}catch(RuntimeException ignored){/* Non-document providers may omit operation flags. */}
  value.put("canRename",rename&&(retained.getOrDefault(id,0)&Intent.FLAG_GRANT_WRITE_URI_PERMISSION)!=0&&context.checkUriPermission(uri,android.os.Process.myPid(),android.os.Process.myUid(),Intent.FLAG_GRANT_WRITE_URI_PERMISSION)==android.content.pm.PackageManager.PERMISSION_GRANTED);return value;
 }
 static synchronized JSObject rename(Context context,String id,String name){
  Uri uri=resolve(id);if(uri==null)return result("unavailable","Select this document again.");
  if(name==null||name.trim().isEmpty()||name.trim().equals(".")||name.trim().equals("..")||name.length()>255||name.indexOf('/')>=0||name.indexOf('\\')>=0||name.chars().anyMatch(c->Character.isISOControl(c)))return result("failed","Enter a valid file name.");
  try{
   if(!describe(context,id).optBoolean("canRename"))return result("unsupported","This provider did not grant rename access. Select the file again or rename it in its document app.");
   Uri renamed=android.provider.DocumentsContract.renameDocument(context.getContentResolver(),uri,name.trim());if(renamed==null)return result("failed","The provider did not rename the document.");
   Integer flags=retained.get(id);selected.put(id,renamed);
   // Providers may return the same ID after rescanning and revoke its old grant.
   // Reacquire only the permission offered by the returned document; never infer
   // durable access from ownership of the underlying MediaStore file.
   if(flags!=null){try{context.getContentResolver().takePersistableUriPermission(renamed,flags);}catch(SecurityException unavailable){retained.remove(id);}if(!renamed.equals(uri))releaseUnused(uri,flags);}
   boolean durable=false;for(android.content.UriPermission grant:context.getContentResolver().getPersistedUriPermissions())if(grant.getUri().equals(renamed)&&grant.isReadPermission()){durable=true;break;}
   if(!durable){forget(id);JSObject value=result("renamed-reselect","The provider completed the rename but did not retain access. Select the renamed file to verify it and continue.");value.put("action","files");return value;}
   clearPreview(id);persist();JSObject value=describe(context,id);value.put("status","selected");value.put("action","files");return value;
  }catch(SecurityException error){forget(id);return result("unavailable","Access expired. Select this document again.");}catch(Exception error){return result("failed","The provider could not confirm the rename. Refresh or reselect before retrying.");}
 }
 static synchronized JSObject pdf(Context context,String id,int pageIndex){
  Uri uri=resolve(id);if(uri==null)return result("unavailable","Select this document again.");
  java.io.File copy=new java.io.File(context.getCacheDir(),"document-"+id+".pdf"),image=new java.io.File(context.getCacheDir(),"document-"+id+".png");
  try{
   if(!"application/pdf".equals(context.getContentResolver().getType(uri)))return result("unsupported","This selection is not a PDF.");
   try(InputStream in=context.getContentResolver().openInputStream(uri);java.io.FileOutputStream out=new java.io.FileOutputStream(copy)){
    if(in==null)throw new IOException();byte[] buffer=new byte[8192];int total=0,count;while((count=in.read(buffer))!=-1){if(count>20*1024*1024-total)throw new IOException();out.write(buffer,0,count);total+=count;}
   }
   try(android.os.ParcelFileDescriptor fd=android.os.ParcelFileDescriptor.open(copy,android.os.ParcelFileDescriptor.MODE_READ_ONLY);android.graphics.pdf.PdfRenderer renderer=new android.graphics.pdf.PdfRenderer(fd)){
    int count=renderer.getPageCount();if(pageIndex<0||pageIndex>=count)return result("failed","This PDF page is unavailable.");
    try(android.graphics.pdf.PdfRenderer.Page page=renderer.openPage(pageIndex)){
     if(page.getWidth()<1||page.getHeight()<1)throw new IOException();double scale=Math.min(1200.0/page.getWidth(),1600.0/page.getHeight());
     android.graphics.Bitmap bitmap=android.graphics.Bitmap.createBitmap(Math.max(1,(int)(page.getWidth()*scale)),Math.max(1,(int)(page.getHeight()*scale)),android.graphics.Bitmap.Config.ARGB_8888);
     try{bitmap.eraseColor(android.graphics.Color.WHITE);page.render(bitmap,null,null,android.graphics.pdf.PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);try(java.io.FileOutputStream out=new java.io.FileOutputStream(image)){if(!bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out))throw new IOException();}}finally{bitmap.recycle();}
    }
    JSObject value=result("rendered","PDF rendered on this device. Nothing was uploaded.");value.put("page",pageIndex);value.put("pageCount",count);value.put("imageUri",Uri.fromFile(image).toString());return value;
   }
  }catch(SecurityException error){return result("unavailable","This PDF is encrypted or access expired. Open it in a compatible app or select it again.");}catch(Exception error){return result("failed","PDF preview is unavailable. It may be malformed, encrypted, or larger than 20 MiB.");}
  finally{copy.delete();}
 }
 private static JSObject result(String status, String message) {
  JSObject value = new JSObject(); value.put("status", status); value.put("message", message); return value;
 }
 static JSObject read(Context context, String id) {
  Uri uri = resolve(id);
  if (uri == null) return result("unavailable", "Select this document again before reading it.");
  return readTextUri(context,uri,false,id);
 }
 // Only native picker callbacks may use this; no renderer-supplied URI entrypoint.
 static JSObject readTransientText(Context context,Uri uri){
  if(uri==null||!"content".equals(uri.getScheme()))return result("unavailable","Select a document first.");
  return readTextUri(context,uri,true,null);
 }
 private static JSObject readTextUri(Context context,Uri uri,boolean preserveBom,String id){
  try {
   String mime = context.getContentResolver().getType(uri);
   String normalized = mime == null ? "" : mime.toLowerCase(Locale.ROOT).split(";",2)[0].trim();
   if (!(normalized.startsWith("text/") || normalized.equals("application/json") || normalized.equals("application/xml"))) {
    return result("unsupported", "This file type has no text preview. Open it in a compatible app.");
   }
   try (InputStream input = context.getContentResolver().openInputStream(uri)) {
    if (input == null) return result("unavailable", "The document provider could not open this selection.");
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    byte[] buffer = new byte[4096];
    while (bytes.size() <= MAX_TEXT_BYTES) {
     int count = input.read(buffer, 0, Math.min(buffer.length, MAX_TEXT_BYTES + 1 - bytes.size()));
     if (count == -1) break;
     if (count == 0) { int single = input.read(); if (single == -1) break; bytes.write(single); }
     else bytes.write(buffer, 0, count);
    }
    if (bytes.size() > MAX_TEXT_BYTES) return result("too-large", "Text preview is limited to 64 KiB. Open this document in a compatible app.");
    String text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes.toByteArray())).toString();
    if (text.indexOf('\0') >= 0) return result("unsupported", "This document does not contain supported UTF-8 text.");
    JSObject value = result("read", "Read the selected document on this device. Nothing was uploaded.");
    value.put("text", !preserveBom && text.startsWith("\uFEFF") ? text.substring(1) : text);
    value.put("mimeType", mime); value.put("bytes", bytes.size()); return value;
   }
  } catch (CharacterCodingException error) { return result("unsupported", "Text preview requires UTF-8. Open this document in a compatible app."); }
  catch (SecurityException error) { forget(id); return result("unavailable", "Access expired. Select this document again."); }
  catch (IOException | RuntimeException error) { return result("failed", "The document provider could not read this selection."); }
 }
 static JSObject share(Activity activity, String id) {
  Uri uri=resolve(id);
  if(uri==null)return result("unavailable","Select this document again before sharing it.");
  return shareUri(activity,uri);
 }
 // Package-private: callers must first validate a picker capability or owned media ID.
 static JSObject shareUri(Activity activity, Uri uri) {
  try {
   try(android.content.res.AssetFileDescriptor file=activity.getContentResolver().openAssetFileDescriptor(uri,"r")) {
    if(file==null)return result("unavailable","This item is no longer available.");
   }
   String mime=activity.getContentResolver().getType(uri);
   Intent send=new Intent(Intent.ACTION_SEND).setType(mime==null?"application/octet-stream":mime)
     .putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
   send.setClipData(ClipData.newRawUri("Selected item",uri));
   activity.startActivity(Intent.createChooser(send,"Share"));
   return result("opened","Choose an app to share this item. Nothing has been sent yet.");
  } catch(SecurityException | java.io.FileNotFoundException error) {
   return result("unavailable","Access expired or the item was removed. Select it again.");
  } catch(IOException | RuntimeException error) {
   return result("failed","Android could not open sharing for this item.");
  }
 }
 static JSObject open(Activity activity, String id) {
  Uri uri = resolve(id);
  if (uri == null) return result("unavailable", "Select this document again before opening it.");
  try {
   String mime = activity.getContentResolver().getType(uri);
   Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime == null ? "*/*" : mime)
       .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
   intent.setClipData(ClipData.newRawUri("Selected document", uri));
   activity.startActivity(intent);
   return result("opened", "Opened the selected document. Complete any further action in that app.");
  } catch (ActivityNotFoundException error) { return result("unavailable", "No compatible app is installed to open this document."); }
  catch (SecurityException error) { forget(id); return result("unavailable", "Access expired. Select this document again."); }
  catch (RuntimeException error) { return result("failed", "Android could not open the selected document."); }
 }
}
