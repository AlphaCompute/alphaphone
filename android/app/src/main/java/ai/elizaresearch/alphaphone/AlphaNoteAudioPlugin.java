package ai.elizaresearch.alphaphone;

import android.media.MediaPlayer;
import android.util.AtomicFile;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.JSONObject;

/** Durable, device-local voice notes. No paths, audio bytes or credentials cross the JS bridge. */
@CapacitorPlugin(name="AlphaNoteAudio")
public class AlphaNoteAudioPlugin extends Plugin {
 private MediaPlayer player; private String playingId; private PluginCall preparing;
 private final android.os.Handler main=new android.os.Handler(android.os.Looper.getMainLooper());
 private static final Object METADATA_LOCK=new Object();
 private final java.util.concurrent.ExecutorService migrationWorker=java.util.concurrent.Executors.newSingleThreadExecutor();
 private volatile boolean destroyed;
 private volatile String migrationState="pending";
 private volatile int migrationFailures;
 private static String id(String value){if(value==null||!value.matches("[A-Za-z0-9_-]{1,100}"))throw new IllegalArgumentException();return value;}
 private File directory(){File d=new File(getContext().getNoBackupFilesDir(),"note-audio");if(!d.isDirectory()&&!d.mkdirs())throw new IllegalStateException();return d;}
 @Override public void load(){
  // Plugin registration/startup must not synchronously decrypt an entire old collection.
  main.post(()->{if(destroyed)return;try{migrationWorker.execute(this::migrateLegacyMetadata);}catch(java.util.concurrent.RejectedExecutionException stopped){migrationState="stopped";}});
 }
 private void migrateLegacyMetadata(){
  migrationState="running";
  try{
   File[] records=directory().listFiles((dir,name)->name.endsWith(".json"));
   if(records==null)throw new IOException("Recording directory unavailable");
   for(File record:records){
    if(destroyed||Thread.currentThread().isInterrupted())return;
    try{synchronized(METADATA_LOCK){
     if(destroyed)return;
     String key=record.getName().substring(0,record.getName().length()-5);
     JSONObject value=read(key);long deleted=value.optLong("deletedAt",0);
     if(deleted>0&&System.currentTimeMillis()-deleted>30L*24*60*60*1000){if(!audio(key).exists()||audio(key).delete()){if(!value.has("deletionOperations")){secure().removeCredentialSlot(slot(key));metadata(key).delete();}else{value.put("transcript","");write(key,value);}}}
    }}catch(Exception retained){migrationFailures++;/* Keep both copies; explicit status reports recovery needed. */}
   }
  }catch(Exception retained){migrationFailures++;}
  finally{migrationState=destroyed?"stopped":migrationFailures>0?"needs-recovery":"complete";}
 }
 @PluginMethod public void migrationStatus(PluginCall call){JSObject result=new JSObject();result.put("state",migrationState);result.put("failedRecords",migrationFailures);call.resolve(result);}

 private File audio(String value){return new File(directory(),id(value)+".audio");}
 private AtomicFile metadata(String value){return new AtomicFile(new File(directory(),id(value)+".json"));}
 private AlphaConnectionPlugin secure(){return (AlphaConnectionPlugin)getBridge().getPlugin("AlphaConnection").getInstance();}
 private String slot(String value){return "note-audio-metadata:v1:"+id(value);}
 private void write(String value,JSONObject record)throws Exception {synchronized(METADATA_LOCK){writeLocked(value,record);}}
 private void writeLocked(String value,JSONObject record)throws Exception {
  String serialized=record.toString();secure().writeCredentialSlot(slot(value),serialized);
  if(!serialized.equals(secure().readCredentialSlot(slot(value))))throw new IOException("Recording metadata commit unconfirmed");
  // Only replace the legacy file after durable encrypted storage has been read back.
  atomic(metadata(value),"{\"encrypted\":1}".getBytes(StandardCharsets.UTF_8));
 }
 private JSONObject read(String value)throws Exception {synchronized(METADATA_LOCK){return readLocked(value);}}
 private JSONObject readLocked(String value)throws Exception {
  String encrypted=secure().readCredentialSlot(slot(value));
  JSONObject legacy=null;
  if(metadata(value).getBaseFile().exists()||new File(metadata(value).getBaseFile()+".bak").exists()){
   try(InputStream in=metadata(value).openRead()){ByteArrayOutputStream bytes=new ByteArrayOutputStream();copyBounded(in,bytes,512*1024);legacy=new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));}
  }
  if(legacy!=null&&!legacy.has("encrypted")){
   String original=legacy.toString();
   if(encrypted!=null&&!encrypted.equals(original))throw new IOException("Recording metadata copies disagree; originals retained");
   write(value,legacy);return legacy;
  }
  if(encrypted==null)throw new IOException("Recording metadata unavailable");
  return new JSONObject(encrypted);
 }
 private static void copyBounded(InputStream in,OutputStream out,int limit)throws IOException {byte[] buffer=new byte[8192];int total=0,count;while((count=in.read(buffer))!=-1){if(count>limit-total)throw new IOException("Recording data exceeds limit");out.write(buffer,0,count);total+=count;}}
 private static void atomic(AtomicFile file,byte[] bytes)throws Exception {FileOutputStream out=null;try{out=file.startWrite();out.write(bytes);file.finishWrite(out);}catch(Exception error){if(out!=null)file.failWrite(out);throw error;}}
 /** Only native recorders can import a stopped clip; the renderer cannot nominate a path. */
 JSObject retain(File source,String recordingId,String noteId,long duration,String transcript)throws Exception {synchronized(METADATA_LOCK){return retainLocked(source,recordingId,noteId,duration,transcript);}}
 private JSObject retainLocked(File source,String recordingId,String noteId,long duration,String transcript)throws Exception {
  id(recordingId);id(noteId);if(source==null||!source.isFile()||source.length()<1||source.length()>4*1024*1024||duration<1||duration>60000||transcript==null||transcript.length()>64000)throw new IOException();
  File target=audio(recordingId);JSONObject record;
  if(!target.isFile()&&secure().readCredentialSlot(slot(recordingId))!=null&&read(recordingId).has("deletionOperations"))throw new IOException("Recording identity retired");
  if(target.isFile()&&(metadata(recordingId).getBaseFile().isFile()||secure().readCredentialSlot(slot(recordingId))!=null)) {record=read(recordingId);if(!noteId.equals(record.optString("noteId"))||record.optLong("deletedAt",0)>0)throw new IOException();}
  else {
   File temp=new File(directory(),recordingId+".pending");
   try(InputStream in=new FileInputStream(source);FileOutputStream out=new FileOutputStream(temp)){copyBounded(in,out,4*1024*1024);out.getFD().sync();}catch(Exception error){temp.delete();throw error;}
   if(!temp.renameTo(target)){temp.delete();throw new IOException();}
   record=new JSONObject();record.put("audioId",recordingId);record.put("noteId",noteId);record.put("durationMs",duration);record.put("createdAt",System.currentTimeMillis());record.put("mimeType","audio/mp4");
  }
  record.put("transcript",transcript);write(recordingId,record);return JSObject.fromJSONObject(record);
 }
 @PluginMethod public void describe(PluginCall call){try{call.resolve(JSObject.fromJSONObject(read(call.getString("audioId"))));}catch(Exception error){call.reject("Saved recording is unavailable");}}
 @PluginMethod public void play(PluginCall call){main.post(()->{try{
  String key=id(call.getString("audioId"));if(read(key).optLong("deletedAt",0)>0)throw new IOException();File file=audio(key);if(!file.isFile())throw new IOException();stop();
  MediaPlayer next=new MediaPlayer();player=next;playingId=key;preparing=call;next.setDataSource(file.getAbsolutePath());
  next.setOnPreparedListener(p->{if(player!=p)return;try{p.start();JSObject receipt=new JSObject();receipt.put("audioId",key);receipt.put("playing",p.isPlaying());receipt.put("positionMs",p.getCurrentPosition());preparing=null;notifyListeners("started",receipt);call.resolve(receipt);}catch(RuntimeException e){stop();}});
  next.setOnCompletionListener(p->{if(player==p){stop();JSObject event=new JSObject();event.put("audioId",key);notifyListeners("ended",event);}});
  next.setOnErrorListener((p,w,e)->{if(player==p){stop();JSObject event=new JSObject();event.put("audioId",key);notifyListeners("failed",event);}return true;});next.prepareAsync();
 }catch(Exception error){stop();call.reject("Saved recording could not be played");}});}
 @PluginMethod public void stop(PluginCall call){main.post(()->{stop();call.resolve();});}
 @PluginMethod public void state(PluginCall call){main.post(()->{JSObject value=new JSObject();try{value.put("playing",player!=null&&player.isPlaying());value.put("audioId",playingId);value.put("positionMs",player==null?0:player.getCurrentPosition());}catch(RuntimeException error){value.put("playing",false);}call.resolve(value);});}
 @PluginMethod public void remove(PluginCall call){changeDeleted(call,true);}
 @PluginMethod public void restore(PluginCall call){changeDeleted(call,false);}
 /** Notes Trash expiry or "Delete forever": erase the bytes of a recording this operation already moved to the audio trash. */
 @PluginMethod public void purge(PluginCall call){main.post(()->{try{synchronized(METADATA_LOCK){
  String key=id(call.getString("audioId")),operation=operationId(call);JSONObject record=read(key);
  if(!record.getString("noteId").equals(id(call.getString("noteId"))))throw new IOException();
  JSONObject receipts=record.optJSONObject("deletionOperations");String prior=receipts==null?"unknown":receipts.optString(operation,"unknown");
  if(prior.equals("purged")){call.resolve(operationReceipt(record,operation,prior));return;}
  // Only the operation that owns the current audio trash may erase it. A restored recording is never purged.
  if(!prior.equals("removed")||record.optLong("deletedAt",0)<=0||!operation.equals(record.optString("activeDeletionOperation")))throw new IOException("Recording is not in this deletion");
  if(key.equals(playingId))stop();
  if(audio(key).exists()&&!audio(key).delete())throw new IOException("Recording bytes retained");
  record.put("transcript","");receipts.put(operation,"purged");record.put("deletionOperations",receipts);
  write(key,record);call.resolve(operationReceipt(record,operation,"purged"));
 }}catch(Exception error){call.reject("Saved recording could not be erased");}});}
 private static String operationId(PluginCall call){String value=call.getString("operationId");if(value==null||!value.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"))throw new IllegalArgumentException();return value;}
 private JSObject operationReceipt(JSONObject record,String operation,String status)throws Exception{JSObject result=new JSObject();result.put("operationId",operation);result.put("audioId",record.getString("audioId"));result.put("noteId",record.getString("noteId"));result.put("status",status);return result;}
 @PluginMethod public void deletionStatus(PluginCall call){try{synchronized(METADATA_LOCK){JSONObject record=read(id(call.getString("audioId")));if(!record.getString("noteId").equals(id(call.getString("noteId"))))throw new IOException();String operation=operationId(call);JSONObject receipts=record.optJSONObject("deletionOperations");call.resolve(operationReceipt(record,operation,receipts==null?"unknown":receipts.optString(operation,"unknown")));}}catch(Exception error){call.reject("Recording operation is unavailable");}}
 private void changeDeleted(PluginCall call,boolean deleted){main.post(()->{try{synchronized(METADATA_LOCK){
  String key=id(call.getString("audioId")),operation=operationId(call);JSONObject record=read(key);
  if(!record.getString("noteId").equals(id(call.getString("noteId"))))throw new IOException();
  JSONObject receipts=record.optJSONObject("deletionOperations");if(receipts==null)receipts=new JSONObject();
  String prior=receipts.optString(operation,"unknown");
  // Retired operations never regain permission to delete, even after renderer death.
  if(prior.equals("restored")||(deleted&&(prior.equals("removed")||prior.equals("purged")))){call.resolve(operationReceipt(record,operation,prior));return;}
  if(prior.equals("purged"))throw new IOException("Recording erased");
  if(!receipts.has(operation)&&receipts.length()>=128)throw new IOException("Recording operation history full");
  boolean legacyRestore=!deleted&&record.optLong("deletedAt",0)>0&&!record.has("activeDeletionOperation")&&!record.has("deletionOperations");
  if(record.has("deletedAt")&&!operation.equals(record.optString("activeDeletionOperation"))&&!legacyRestore)throw new IOException("Another deletion owns recording");
  if(!deleted&&record.optLong("deletedAt",0)>0&&System.currentTimeMillis()-record.getLong("deletedAt")>30L*24*60*60*1000)throw new IOException("Recording expired");
  if(key.equals(playingId))stop();
  if(deleted){record.put("deletedAt",System.currentTimeMillis());record.put("activeDeletionOperation",operation);}
  else {if(!audio(key).isFile())throw new IOException();record.remove("deletedAt");record.remove("activeDeletionOperation");}
  String status=deleted?"removed":"restored";receipts.put(operation,status);record.put("deletionOperations",receipts);
  // Receipt and effect share one encrypted metadata commit. No replay tombstone eviction.
  write(key,record);call.resolve(operationReceipt(record,operation,status));
 }}catch(Exception error){call.reject("Saved recording could not be updated");}});}
 private void stop(){if(preparing!=null){preparing.reject("Playback cancelled");preparing=null;}if(player!=null){player.release();player=null;}playingId=null;}
 @Override protected void handleOnPause(){main.post(this::stop);}
 @Override protected void handleOnDestroy(){destroyed=true;migrationWorker.shutdownNow();migrationState="stopped";main.post(this::stop);}
}
