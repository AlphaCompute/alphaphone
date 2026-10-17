package ai.elizaresearch.alphaphone;

import android.content.ContentProviderOperation;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.provider.MediaStore;
import androidx.annotation.OptIn;
import androidx.media3.common.Effect;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.common.util.ExperimentalApi;
import androidx.media3.effect.Crop;
import androidx.media3.effect.Presentation;
import androidx.media3.effect.ScaleAndRotateTransformation;
import androidx.media3.transformer.AudioEncoderSettings;
import androidx.media3.transformer.Composition;
import androidx.media3.transformer.DefaultEncoderFactory;
import androidx.media3.transformer.EditedMediaItem;
import androidx.media3.transformer.Effects;
import androidx.media3.transformer.ExportException;
import androidx.media3.transformer.ExportResult;
import androidx.media3.transformer.Transformer;
import androidx.media3.transformer.VideoEncoderSettings;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/** Native edit-as-copy over an admitted video. The encoder reads a frozen private
 * snapshot; publication rechecks source bytes, access and provider revision.
 * Each Save has one durable identity, including after a lost bridge response. */
@OptIn(markerClass={UnstableApi.class,ExperimentalApi.class})
final class VideoCopyEdits {
 interface Sources { Source read(String id,String expectedRevision)throws Exception; }
 static final class Source {
  final Uri uri;final String revision;
  Source(Uri uri,String revision){this.uri=uri;this.revision=revision;}
 }
 private static final Uri OUTPUTS=MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
 private final Context context;
 private final Sources sources;
 private final SharedPreferences journal;
 private final File directory;
 private final ExecutorService io=Executors.newSingleThreadExecutor();
 private final java.util.concurrent.atomic.AtomicLong epoch=new java.util.concurrent.atomic.AtomicLong();
 private volatile Session active;
 private volatile boolean retired;
 private volatile HandlerThread encoderThread;
 private volatile Handler encoder;
 private static final class Session {
  String token,id,revision;
  Source source;
  byte[] digest;
  File input,output;
  long durationMs,bitrate;
  long epoch;
  int width,height;
  boolean audio;
  ContentValues version;
  VideoEditSpec edit;
  volatile String stage="prepared";
  volatile boolean cancelled,encodingFinished;
  volatile Transformer transformer;
  volatile PluginCall saveCall;
 }

 VideoCopyEdits(Context context,Sources sources)throws IOException {
  this.context=context.getApplicationContext();this.sources=sources;
  journal=context.getSharedPreferences("alpha-video-copy-results-v1",Context.MODE_PRIVATE);
  directory=new File(context.getCacheDir(),"alpha-video-edits");
  if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Video edit storage is unavailable");
  if(!directory.getCanonicalFile().getParentFile().equals(context.getCacheDir().getCanonicalFile()))throw new IOException("Video edit storage changed");
 }
 static boolean isVideoOperation(String token){return token!=null&&token.startsWith("video-");}
 private static void token(String token){
  if(token==null||!token.matches("video-[a-f0-9-]{36}")||!UUID.fromString(token.substring(6)).toString().equals(token.substring(6)))throw new IllegalArgumentException("Invalid video copy request");
 }
 private File file(String token,String suffix)throws IOException {
  token(token);File result=new File(directory,token+suffix);
  if(!result.getCanonicalFile().getParentFile().equals(directory.getCanonicalFile()))throw new IOException("Video edit storage changed");
  return result;
 }
 private String name(String token){token(token);return "Alpha-video-edit-"+token.substring(6)+".mp4";}
 private void write(String token,JSONObject record)throws IOException {
  if(!journal.edit().putString(token,record.toString()).commit())throw new IOException("Video copy receipt could not be retained");
 }
 private JSONObject read(String token)throws Exception {
  token(token);String raw=journal.getString(token,null);return raw==null?null:new JSONObject(raw);
 }
 private JSObject receipt(String token,String status,String id){
  JSObject value=new JSObject();value.put("operationId",token);value.put("status",status);if(id!=null)value.put("id","v:"+id);return value;
 }
 private boolean terminal(String status){return status.equals("saved")||status.equals("failed")||status.equals("not-started");}
 private interface Work {void run()throws Exception;}
 private void submit(PluginCall call,Work work){
  if(retired){call.reject("Video editor closed");return;}
  dispatch(()->{try{work.run();}catch(Exception error){call.reject(error.getMessage()==null?"Video edit could not be confirmed":error.getMessage());}},()->call.reject("Video editor closed"));
 }
 // Callbacks can arrive after Activity teardown has stopped IO. Preserve the
 // durable request for recovery and answer the bridge instead of crashing.
 private void dispatch(Runnable work,Runnable refused){
  PluginWorkers.submit(io,work,refused);
 }
 private void finish(Session session,Exception failure){
  dispatch(()->complete(session,failure),()->{
   synchronized(session){session.cancelled=true;if(active==session)active=null;}
   if(session.saveCall!=null)session.saveCall.reject("Video copy outcome is unresolved. Reopen Photos to check this request before saving another copy.");
   retire();
  });
 }
 private ContentValues version(Uri uri)throws Exception {
  String[] columns=Build.VERSION.SDK_INT>=30?new String[]{"_size","date_modified","generation_modified","is_pending","is_trashed"}:new String[]{"_size","date_modified","is_pending"};
  try(Cursor row=context.getContentResolver().query(uri,columns,null,null,null)){
   if(row==null||!row.moveToFirst()||row.getLong(0)<=0||row.getLong(0)>VideoEditSpec.MAX_BYTES||row.getInt(2+(Build.VERSION.SDK_INT>=30?1:0))!=0||(Build.VERSION.SDK_INT>=30&&row.getInt(4)!=0))throw new IOException("Choose an available video up to 100 MB");
   ContentValues values=new ContentValues();for(int i=0;i<columns.length;i++)values.put(columns[i],row.getLong(i));return values;
  }
 }
 private byte[] bytes(Session session,File destination)throws Exception {
  MessageDigest hash=MessageDigest.getInstance("SHA-256");
  try(InputStream input=context.getContentResolver().openInputStream(session.source.uri);FileOutputStream output=destination==null?null:new FileOutputStream(destination)){
   if(input==null)throw new IOException("Video is unavailable");byte[] buffer=new byte[64*1024];long total=0;int length;
   while((length=input.read(buffer))!=-1){if(session.cancelled||retired||session.epoch!=epoch.get())throw new IOException("Video editor closed");total+=length;if(total>VideoEditSpec.MAX_BYTES)throw new IOException("Choose a video up to 100 MB");hash.update(buffer,0,length);if(output!=null)output.write(buffer,0,length);}
   if(total!=session.version.getAsLong("_size"))throw new IOException("Video changed while opening");
   if(output!=null){output.flush();output.getFD().sync();}return hash.digest();
  }
 }
 private void current(Session session,boolean digest)throws Exception {
  if(active!=session||session.cancelled||retired||session.epoch!=epoch.get())throw new IOException("Video editor closed");
  Source source=sources.read(session.id,session.revision);
  if(!source.uri.equals(session.source.uri)||!source.revision.equals(session.revision)||!version(source.uri).equals(session.version)||digest&&!Arrays.equals(session.digest,bytes(session,null)))throw new IOException("Video changed. Close and reopen the editor.");
 }
 private void metadata(Session session)throws Exception {
  try(MediaMetadataRetriever media=new MediaMetadataRetriever()){
   media.setDataSource(session.input.getAbsolutePath());session.durationMs=Long.parseLong(media.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));
   session.width=Integer.parseInt(media.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH));session.height=Integer.parseInt(media.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT));
   String angle=media.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION);int rotation=angle==null?0:Integer.parseInt(angle);
   if(rotation%90!=0)throw new IOException("This video's orientation is unsupported");if(Math.floorMod(rotation,180)!=0){int width=session.width;session.width=session.height;session.height=width;}
   session.audio="yes".equals(media.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO));
   session.bitrate=Math.max(256_000,Math.min(12_000_000,session.input.length()*8_000/Math.max(1,session.durationMs)-(session.audio?128_000:0)));
   new VideoEditSpec(0,session.durationMs/1000d,0,false,session.durationMs,session.width,session.height);
  }
 }
 private void remove(File file)throws IOException {if(file.exists()&&!file.delete())throw new IOException("Video edit cleanup could not be confirmed");}
 private void files(String token)throws IOException {remove(file(token,"-input.mp4"));remove(file(token,"-output.mp4"));}
 private Uri copy(String token)throws Exception {
  try(Cursor row=context.getContentResolver().query(OUTPUTS,new String[]{"_id"},"owner_package_name=? AND _display_name=?",new String[]{context.getPackageName(),name(token)},null)){
   if(row==null)throw new IOException("Video copy lookup is unavailable");if(!row.moveToFirst())return null;
   Uri found=ContentUris.withAppendedId(OUTPUTS,row.getLong(0));if(row.moveToNext())throw new IOException("More than one copy matches this request. Inspect Photos.");return found;
  }
 }
 private boolean pending(Uri uri)throws Exception {
  try(Cursor row=context.getContentResolver().query(uri,new String[]{"is_pending"},null,null,null)){
   if(row==null||!row.moveToFirst())throw new IOException("Video copy readback is unavailable");return row.getInt(0)==1;
  }
 }
 private JSObject reconcile(String token)throws Exception {
  JSONObject record=read(token);if(record==null)return receipt(token,"not-started",null);
  if(active!=null&&active.token.equals(token)&&active.saveCall!=null)return receipt(token,"incomplete",null);
  if(record.optString("status").equals("saved")){try{files(token);}catch(IOException cleanup){/* The confirmed published copy remains saved; retainSpace retries owned-cache cleanup. */}return receipt(token,"saved",record.getString("id"));}
  if(active!=null&&active.token.equals(token)){active.cancelled=true;active=null;}
  Uri found=copy(token);
  if(found!=null&&!pending(found)){
   String id=Long.toString(ContentUris.parseId(found));record.put("status","saved").put("id",id);write(token,record);files(token);return receipt(token,"saved",id);
  }
  if(found!=null&&context.getContentResolver().delete(found,"is_pending=1 AND owner_package_name=?",new String[]{context.getPackageName()})!=1)throw new IOException("Pending video cleanup could not be confirmed");
  files(token);String status=record.optString("binding").isEmpty()?"not-started":"failed";record.put("status",status);write(token,record);return receipt(token,status,null);
 }
 private void retainSpace()throws Exception {
  if(directory.getUsableSpace()<VideoEditSpec.MAX_BYTES*4)throw new IOException("Free at least 400 MB to edit a video");
  for(String key:journal.getAll().keySet())if(terminal(read(key).optString("status")))files(key);
  if(journal.getAll().size()<128)return;
  List<String> terminal=new ArrayList<>();
  for(String key:journal.getAll().keySet()){JSONObject row=read(key);if(terminal(row.optString("status")))terminal.add(key);}
  terminal.sort((a,b)->{try{return Long.compare(read(a).optLong("createdAt"),read(b).optLong("createdAt"));}catch(Exception invalid){throw new IllegalStateException("Video copy history needs recovery",invalid);}});
  if(terminal.isEmpty()||!journal.edit().remove(terminal.get(0)).commit())throw new IOException("Resolve earlier video copies before editing another");
 }
 void begin(String id,String expected,PluginCall call){long admittedEpoch=epoch.get();submit(call,()->{
  if(retired||admittedEpoch!=epoch.get())throw new IOException("Video editor closed");
  if(active!=null)throw new IOException("Close the current video editor first");
  for(String key:journal.getAll().keySet()){JSONObject row=read(key);if(!terminal(row.optString("status")))reconcile(key);}
  retainSpace();Session session=new Session();session.epoch=admittedEpoch;session.token="video-"+UUID.randomUUID();session.id=id;session.revision=expected;session.source=sources.read(id,expected);session.version=version(session.source.uri);
  session.input=file(session.token,"-input.mp4");session.output=file(session.token,"-output.mp4");
  JSONObject record=new JSONObject().put("status","prepared").put("createdAt",System.currentTimeMillis());write(session.token,record);active=session;
  try{
   if(!session.input.createNewFile())throw new IOException("Video edit storage changed");session.digest=bytes(session,session.input);metadata(session);current(session,true);
   record.put("durationMs",session.durationMs).put("width",session.width).put("height",session.height);write(session.token,record);
   JSObject value=new JSObject();value.put("sessionId",session.token);value.put("operationId",session.token);value.put("duration",session.durationMs/1000d);value.put("width",session.width);value.put("height",session.height);call.resolve(value);
  }catch(Exception failure){active=null;reconcile(session.token);throw failure;}
 });}
 private Handler encoder(){
  if(encoder==null){encoderThread=new HandlerThread("Alpha video copy");encoderThread.start();encoder=new Handler(encoderThread.getLooper());}return encoder;
 }
 void save(String token,double start,double end,int rotation,boolean crop,PluginCall call){submit(call,()->{
  JSONObject record=read(token);if(record==null)throw new IOException("Reopen the video editor");
  VideoEditSpec edit=new VideoEditSpec(start,end,rotation,crop,record.getLong("durationMs"),record.getInt("width"),record.getInt("height"));
  if(record.has("binding")){if(!record.getString("binding").equals(edit.binding()))throw new IOException("This copy request already has different edits");call.resolve(reconcile(token));return;}
  Session session=active;if(session==null||!session.token.equals(token))throw new IOException("Video editor closed");current(session,true);
  if(edit.unchanged(session.durationMs)){session.cancelled=true;active=null;files(token);record.put("status","not-started");write(token,record);call.resolve(receipt(token,"unchanged",null));return;}
  if(session.output.exists())throw new IOException("Video edit output already exists");
  record.put("binding",edit.binding()).put("status","exporting");write(token,record);session.edit=edit;session.saveCall=call;
  encoder().post(()->encode(session));
 });}
 private void encode(Session session){
  try{
   if(session.cancelled||retired)throw new IOException("Video editor closed");
   List<Effect> effects=new ArrayList<>();if(session.edit.crop)effects.add(new Crop(-1/1.3f,1/1.3f,-1/1.3f,1/1.3f));
   if(session.edit.rotation!=0)effects.add(new ScaleAndRotateTransformation.Builder().setRotationDegrees(-session.edit.rotation).build());
   effects.add(Presentation.createForWidthAndHeight(session.edit.width,session.edit.height,Presentation.LAYOUT_SCALE_TO_FIT));
   MediaItem media=new MediaItem.Builder().setUri(Uri.fromFile(session.input)).setClippingConfiguration(new MediaItem.ClippingConfiguration.Builder().setStartPositionMs(session.edit.startMs).setEndPositionMs(session.edit.endMs).build()).build();
   EditedMediaItem edited=new EditedMediaItem.Builder(media).setRemoveAudio(false).setEffects(new Effects(java.util.Collections.emptyList(),effects)).build();
   int bitrate=(int)Math.max(256_000,Math.min(12_000_000,session.bitrate*(long)session.edit.width*session.edit.height/((long)session.width*session.height)));
   // Non-default encoder settings force real sample encoding, including trim-only
   // edits. No MP4 edit list can expose trimmed-away video/audio in another player.
   DefaultEncoderFactory factory=new DefaultEncoderFactory.Builder(context).setEnableFormatFallback(false).setRequestedVideoEncoderSettings(new VideoEncoderSettings.Builder().setBitrate(bitrate).build()).setRequestedAudioEncoderSettings(new AudioEncoderSettings.Builder().setBitrate(128_000).build()).build();
   session.transformer=new Transformer.Builder(context).setLooper(encoder.getLooper()).setEncoderFactory(factory).setVideoMimeType(MimeTypes.VIDEO_H264).setAudioMimeType(MimeTypes.AUDIO_AAC).experimentalSetMp4EditListTrimEnabled(false).experimentalSetTrimOptimizationEnabled(false).addListener(new Transformer.Listener(){
    @Override public void onCompleted(Composition composition,ExportResult result){session.encodingFinished=true;finish(session,null);}
    @Override public void onError(Composition composition,ExportResult result,ExportException error){session.encodingFinished=true;finish(session,error);}
   }).build();
   session.stage="encoding";session.transformer.start(edited,session.output.getAbsolutePath());
   long deadline=android.os.SystemClock.elapsedRealtime()+Math.max(60_000,(session.edit.endMs-session.edit.startMs)*3);
   Runnable guard=new Runnable(){public void run(){if(session.encodingFinished)return;if(session.cancelled||retired||session.output.length()>VideoEditSpec.MAX_BYTES||android.os.SystemClock.elapsedRealtime()>deadline){session.cancelled=true;session.transformer.cancel();session.encodingFinished=true;finish(session,new IOException("Video export stopped. Original unchanged."));}else encoder.postDelayed(this,250);}};encoder.postDelayed(guard,250);
  }catch(Exception failure){session.encodingFinished=true;finish(session,failure);}
 }
 private void output(Session session)throws Exception {
  if(!session.output.isFile()||session.output.length()<=0||session.output.length()>VideoEditSpec.MAX_BYTES)throw new IOException("Video copy is empty or exceeds 100 MB");
  try(MediaMetadataRetriever media=new MediaMetadataRetriever()){
   media.setDataSource(session.output.getAbsolutePath());long duration=Long.parseLong(media.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));int width=Integer.parseInt(media.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)),height=Integer.parseInt(media.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT));String angle=media.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION);if(angle!=null&&Math.floorMod(Integer.parseInt(angle),180)!=0){int old=width;width=height;height=old;}
   if(width!=session.edit.width||height!=session.edit.height||duration<=0||Math.abs(duration-(session.edit.endMs-session.edit.startMs))>150||session.audio!="yes".equals(media.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO)))throw new IOException("Video copy readback did not match the edit");
  }
 }
 private byte[] outputDigest(InputStream input,long expected,Session session)throws Exception{
  MessageDigest hash=MessageDigest.getInstance("SHA-256");byte[] buffer=new byte[64*1024];long bytes=0;int length;
  while((length=input.read(buffer))!=-1){if(session.cancelled||retired)throw new IOException("Video editor closed");bytes+=length;if(bytes>VideoEditSpec.MAX_BYTES)throw new IOException("Video copy exceeds 100 MB");hash.update(buffer,0,length);}
  if(bytes!=expected)throw new IOException("Video copy bytes did not match the export");return hash.digest();
 }
 private void complete(Session session,Exception failure){
  if(active!=session)return;
  try{
   if(failure!=null)throw failure;session.stage="export-readback";current(session,true);output(session);
   ContentValues values=new ContentValues();values.put("_display_name",name(session.token));values.put("mime_type","video/mp4");values.put("relative_path","Movies/Alpha Phone/Edits/");values.put("is_pending",1);values.put("width",session.edit.width);values.put("height",session.edit.height);
   session.stage="pending-write";Uri target=context.getContentResolver().insert(OUTPUTS,values);if(target==null)throw new IOException("Video copy could not be created");
   try(android.os.ParcelFileDescriptor descriptor=context.getContentResolver().openFileDescriptor(target,"w");FileInputStream input=new FileInputStream(session.output)){
    if(descriptor==null)throw new IOException("Video copy could not be written");try(FileOutputStream out=new android.os.ParcelFileDescriptor.AutoCloseOutputStream(descriptor)){byte[] chunk=new byte[64*1024];int length;while((length=input.read(chunk))!=-1){if(session.cancelled||retired)throw new IOException("Video editor closed");out.write(chunk,0,length);}out.flush();out.getFD().sync();}
   }
   try(InputStream saved=context.getContentResolver().openInputStream(target);FileInputStream exported=new FileInputStream(session.output)){
    if(saved==null||!Arrays.equals(outputDigest(saved,session.output.length(),session),outputDigest(exported,session.output.length(),session)))throw new IOException("Video copy readback changed");
   }
   current(session,true);
   ArrayList<ContentProviderOperation> batch=new ArrayList<>();batch.add(ContentProviderOperation.newAssertQuery(session.source.uri).withValues(session.version).withExpectedCount(1).build());batch.add(ContentProviderOperation.newUpdate(target).withSelection("is_pending=1 AND owner_package_name=?",new String[]{context.getPackageName()}).withValue("is_pending",0).withExpectedCount(1).build());
   session.stage="publish";synchronized(session){if(session.cancelled||retired||session.epoch!=epoch.get())throw new IOException("Video editor closed");context.getContentResolver().applyBatch("media",batch);}
   if(pending(target))throw new IOException("Video publication could not be confirmed");
   session.stage="receipt";JSONObject row=read(session.token);String id=Long.toString(ContentUris.parseId(target));row.put("status","saved").put("id",id);write(session.token,row);files(session.token);active=null;session.saveCall.resolve(receipt(session.token,"saved",id));
  }catch(Exception error){
   android.util.Log.w("AlphaVideoCopy","stage="+session.stage+",code="+(error instanceof ExportException?((ExportException)error).errorCode:0));
   active=null;
   try{session.saveCall.resolve(reconcile(session.token));}catch(Exception unknown){session.saveCall.reject("Video copy outcome is unresolved. Reopen Photos to check this request before saving another copy.");}
  }finally{retire();}
 }
 void result(String token,PluginCall call){submit(call,()->call.resolve(reconcile(token)));}
 void cancel(String token){
  Session session=active;if(token!=null&&(session==null||!session.token.equals(token)))return;
  // Also retire a Begin still queued on IO, before it can return a session ID.
  if(session==null){epoch.incrementAndGet();return;}
  synchronized(session){epoch.incrementAndGet();session.cancelled=true;}
  if(session.saveCall!=null){Handler handler=encoder;if(handler!=null)handler.post(()->{if(!session.encodingFinished){if(session.transformer!=null)session.transformer.cancel();session.encodingFinished=true;finish(session,new IOException("Video editor closed"));}});}
  else dispatch(()->{if(active==session){active=null;try{reconcile(session.token);}catch(Exception unresolved){/* The durable prepared record remains for read-only recovery. */}retire();}},()->{if(active==session)active=null;retire();});
 }
 private void retire(){if(retired&&active==null){if(encoderThread!=null)encoderThread.quitSafely();io.shutdown();}}
 void close(){if(retired)return;retired=true;cancel(null);if(active==null)retire();}
}
