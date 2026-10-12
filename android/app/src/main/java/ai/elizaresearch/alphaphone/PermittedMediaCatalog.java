package ai.elizaresearch.alphaphone;

import android.Manifest;
import android.app.KeyguardManager;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.ContentObserver;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.os.UserManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Size;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

/** Same-user, permission-filtered MediaStore access. No media bytes or index are uploaded. */
final class PermittedMediaCatalog implements AutoCloseable {
 private static final int PAGE_SIZE=24;
 private static final String[] FIELDS={"_id","width","height","date_added","_size",MediaStore.MediaColumns.DISPLAY_NAME,"date_modified","owner_package_name","generation_added","generation_modified","is_favorite"};
 private final Context context;
 private final ContentResolver resolver;
 private final Handler main=new Handler(Looper.getMainLooper());
 private final AtomicLong epoch=new AtomicLong();
 private final Runnable changed;
 private volatile boolean closed;
 private final LinkedHashMap<String,Page> pages=new LinkedHashMap<>();
 private final ContentObserver observer=new ContentObserver(main){@Override public void onChange(boolean selfChange){invalidate();changed.run();}};
 private static final class Page {
  final String snapshot,query,kind;final int bucket;final long before,until;
  Page(String snapshot,String query,String kind,int bucket,long before){this.snapshot=snapshot;this.query=query;this.kind=kind;this.bucket=bucket;this.before=before;until=SystemClock.elapsedRealtime()+120000;}
 }
 PermittedMediaCatalog(Context context,Runnable changed){this.context=context;this.changed=changed;resolver=context.getContentResolver();resolver.registerContentObserver(MediaStore.AUTHORITY_URI,true,observer);}
 void invalidate(){epoch.incrementAndGet();synchronized(pages){pages.clear();}}
 private boolean granted(String permission){return context.checkSelfPermission(permission)==PackageManager.PERMISSION_GRANTED;}
 JSObject access(){
  boolean legacy=Build.VERSION.SDK_INT<33&&granted(Manifest.permission.READ_EXTERNAL_STORAGE);
  boolean images=legacy||(Build.VERSION.SDK_INT>=33&&granted(Manifest.permission.READ_MEDIA_IMAGES));
  boolean videos=legacy||(Build.VERSION.SDK_INT>=33&&granted(Manifest.permission.READ_MEDIA_VIDEO));
  boolean selected=Build.VERSION.SDK_INT>=34&&granted(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED);
  JSObject result=new JSObject();result.put("images",images?"full":selected?"selected":"denied");result.put("videos",videos?"full":selected?"selected":"denied");
  result.put("scope",images&&videos?"full":images||videos?"partial":selected?"selected":"denied");return result;
 }
 private void unlocked(){
  KeyguardManager keyguard=context.getSystemService(KeyguardManager.class);UserManager users=context.getSystemService(UserManager.class);
  if(closed||keyguard==null||users==null||keyguard.isDeviceLocked()||!users.isUserUnlocked())throw new SecurityException("Unlock this profile to use Photos");
 }
 private List<String> volumes(){
  List<String> result=new ArrayList<>(MediaStore.getExternalVolumeNames(context));Collections.sort(result);
  if(result.size()>16)throw new IllegalStateException("Too many media volumes");return result;
 }
 private String version(String volume){return Build.VERSION.SDK_INT>=30?MediaStore.getVersion(context,volume):MediaStore.getVersion(context);}
 private String snapshot(List<String> volumes){
  unlocked();StringBuilder value=new StringBuilder(access().toString()).append('|').append(epoch.get());
  for(String volume:volumes)value.append('|').append(volume).append('=').append(version(volume));return value.toString();
 }
 private void current(String expected,List<String> volumes){if(!expected.equals(snapshot(volumes))||!volumes.equals(volumes()))throw new IllegalStateException("Photo access or library changed; refresh Photos");}
 private String[] fields(boolean video){List<String> result=new ArrayList<>(java.util.Arrays.asList(Build.VERSION.SDK_INT>=30?FIELDS:java.util.Arrays.copyOf(FIELDS,8)));if(video)result.add(MediaStore.Video.VideoColumns.DURATION);return result.toArray(new String[0]);}
 private String revision(Cursor row,String volume){
  // The provider version rejects recycled row IDs after a database rebuild.
  return version(volume)+":"+row.getLong(3)+":"+row.getLong(4)+":"+row.getLong(6)+(Build.VERSION.SDK_INT>=30?":"+row.getLong(8)+":"+row.getLong(9):"");
 }
 private JSObject metadata(Cursor row,String volume,boolean video){
  MediaLibraryKey key=new MediaLibraryKey(volume,row.getLong(0),video);JSObject result=new JSObject();result.put("id",key.toString());result.put("kind",key.video?"video":"image");
  result.put("width",row.getInt(1));result.put("height",row.getInt(2));result.put("date",row.getLong(3)*1000);result.put("size",row.getLong(4));result.put("duration",video?row.getLong(row.getColumnIndexOrThrow(MediaStore.Video.VideoColumns.DURATION))/1000d:0);
  String name=row.getString(5);result.put("name",name==null?"":name.substring(0,Math.min(256,name.length())));result.put("revision",revision(row,volume));result.put("mutationRevision",revision(row,volume));
  result.put("favorite",Build.VERSION.SDK_INT>=30&&row.getInt(10)==1);result.put("owned",context.getPackageName().equals(row.getString(7)));result.put("trashed",false);return result;
 }
 Uri uri(MediaLibraryKey key){return ContentUris.withAppendedId(key.video?MediaStore.Video.Media.getContentUri(key.volume):MediaStore.Images.Media.getContentUri(key.volume),key.id);}
 private String thumbnail(MediaLibraryKey key,int size)throws Exception{
  unlocked();CancellationSignal cancellation=new CancellationSignal();Runnable timeout=cancellation::cancel;main.postDelayed(timeout,3000);
  try{Bitmap bitmap=resolver.loadThumbnail(uri(key),new Size(size,size),cancellation);
   try(ByteArrayOutputStream bytes=new ByteArrayOutputStream()){if(!bitmap.compress(Bitmap.CompressFormat.JPEG,80,bytes))throw new IllegalStateException();return "data:image/jpeg;base64,"+Base64.encodeToString(bytes.toByteArray(),Base64.NO_WRAP);}finally{bitmap.recycle();}
  }finally{main.removeCallbacks(timeout);}
 }
 private Cursor query(String volume,boolean video,Bundle args){
  CancellationSignal cancellation=new CancellationSignal();Runnable timeout=cancellation::cancel;main.postDelayed(timeout,3000);
  try{
   // Typed collections are required for other apps' media under scoped storage.
   Uri collection=video?MediaStore.Video.Media.getContentUri(volume):MediaStore.Images.Media.getContentUri(volume);
   Cursor cursor=resolver.query(collection,fields(video),args,cancellation);
   if(cursor==null){main.removeCallbacks(timeout);return null;}
   return new android.database.CursorWrapper(cursor){@Override public void close(){try{super.close();}finally{main.removeCallbacks(timeout);}}};
  }catch(RuntimeException failure){main.removeCallbacks(timeout);throw failure;}
 }
 /** Provider search, not an in-memory scan of previously loaded thumbnails. */
 JSObject list(String cursor,String search,String kind,boolean thumbnails)throws Exception{
  if(search==null||search.length()>128||search.indexOf('\0')>=0||kind==null||!kind.matches("all|image|video"))throw new IllegalArgumentException("Invalid photo query");
  List<String> volumes=volumes();String snapshot=snapshot(volumes);int bucketIndex=0;long before=Long.MAX_VALUE;
  List<MediaLibraryKey> buckets=new ArrayList<>();for(String volume:volumes){if(!kind.equals("video"))buckets.add(new MediaLibraryKey(volume,1,false));if(!kind.equals("image"))buckets.add(new MediaLibraryKey(volume,1,true));}
  if(cursor!=null&&!cursor.isEmpty()){
   Page page;synchronized(pages){page=pages.remove(cursor);}
   if(page==null||page.until<SystemClock.elapsedRealtime()||!page.snapshot.equals(snapshot)||!page.query.equals(search)||!page.kind.equals(kind))throw new IllegalStateException("Photo page expired; refresh Photos");
   bucketIndex=page.bucket;before=page.before;
  }
  JSArray items=new JSArray();String next="";
  outer:for(;bucketIndex<buckets.size();bucketIndex++,before=Long.MAX_VALUE){
   MediaLibraryKey bucket=buckets.get(bucketIndex);String volume=bucket.volume;Bundle args=new Bundle();List<String> values=new ArrayList<>();values.add(Long.toString(before));
   String where="is_pending=0 AND _id<?"+(Build.VERSION.SDK_INT>=30?" AND is_trashed=0":"");
   if(!search.isBlank()){where+=" AND instr(lower("+MediaStore.MediaColumns.DISPLAY_NAME+"),lower(?))>0";values.add(search.trim());}
   args.putString(ContentResolver.QUERY_ARG_SQL_SELECTION,where);args.putStringArray(ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS,values.toArray(new String[0]));
   args.putStringArray(ContentResolver.QUERY_ARG_SORT_COLUMNS,new String[]{"_id"});args.putInt(ContentResolver.QUERY_ARG_SORT_DIRECTION,ContentResolver.QUERY_SORT_DIRECTION_DESCENDING);args.putInt(ContentResolver.QUERY_ARG_LIMIT,PAGE_SIZE+1-items.length());
   try(Cursor rows=query(volume,bucket.video,args)){
    if(rows==null)throw new IllegalStateException("Media provider unavailable");
    while(rows.moveToNext()){
     if(items.length()==PAGE_SIZE){next=UUID.randomUUID().toString();synchronized(pages){pages.entrySet().removeIf(entry->entry.getValue().until<SystemClock.elapsedRealtime());while(pages.size()>=32)pages.remove(pages.keySet().iterator().next());pages.put(next,new Page(snapshot,search,kind,bucketIndex,before));}break outer;}
     JSObject item=metadata(rows,volume,bucket.video);before=rows.getLong(0);
     if(thumbnails){try{item.put("image",thumbnail(MediaLibraryKey.parse(item.getString("id")),240));}catch(Exception unavailable){item.put("image","");}}items.put(item);
    }
   }
  }
  current(snapshot,volumes);JSObject result=new JSObject();result.put("items",items);result.put("next",next);result.put("access",access());return result;
 }
 JSObject read(String id,String expectedRevision,boolean pixels)throws Exception{
  MediaLibraryKey key=MediaLibraryKey.parse(id);List<String> volumes=volumes();String snapshot=snapshot(volumes);if(!volumes.contains(key.volume))throw new IllegalArgumentException("Media volume unavailable");
  JSObject result=inspect(key);String revision=result.getString("revision");if(expectedRevision!=null&&!expectedRevision.equals(revision))throw new IllegalStateException("Selected media changed");
  if(pixels)result.put("image",thumbnail(key,1024));
  if(!revision.equals(inspect(key).getString("revision")))throw new IllegalStateException("Selected media changed");current(snapshot,volumes);return result;
 }
 private JSObject inspect(MediaLibraryKey key){
  unlocked();Bundle args=new Bundle();args.putString(ContentResolver.QUERY_ARG_SQL_SELECTION,"_id=? AND is_pending=0"+(Build.VERSION.SDK_INT>=30?" AND is_trashed=0":""));args.putStringArray(ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS,new String[]{Long.toString(key.id)});
  try(Cursor row=query(key.volume,key.video,args)){if(row==null||!row.moveToFirst())throw new SecurityException("Selected media is unavailable");return metadata(row,key.volume,key.video);}
 }
 @Override public void close(){closed=true;invalidate();resolver.unregisterContentObserver(observer);}
}
