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
 private File directory(){return directory(getContext());}
 private static File directory(android.content.Context context){File d=new File(context.getNoBackupFilesDir(),"note-audio");if(!d.isDirectory()&&!d.mkdirs())throw new IllegalStateException();return d;}
 @Override public void load(){
  // Plugin registration/startup must not synchronously decrypt an entire old collection.
  main.post(()->{if(destroyed)return;try{migrationWorker.execute(this::migrateLegacyMetadata);migrationWorker.execute(this::sweepTrashOnStart);}catch(java.util.concurrent.RejectedExecutionException stopped){migrationState="stopped";}});
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
 private void sweepTrashOnStart(){if(destroyed)return;try{sweepExpiredTrash(getContext(),System.currentTimeMillis());}catch(Exception retained){/* The renderer and the periodic sweep retry. */}}

 /** Product Trash retention, matching notes-trash-policy.ts: three days after deletion. */
 static final long NOTES_TRASH_RETENTION_MS=3L*24*60*60*1000;
 static final String NOTES_TRASH_SLOT="notes-trash:v1:device",NOTES_SLOT="notes-records:v1:device",PENDING_AUDIO_SLOT="notes-audio-deletions:v1:device";
 private static final String TRASH_PREFIX="{\"version\":1,\"entries\":[",TRASH_SUFFIX="]}";
 private static final String TRASH_WORK="alpha-notes-trash-backstop";
 private static final Object SWEEP_LOCK=new Object();
 private static final String OPERATION="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

 /** Periodic best-effort upkeep while Alpha is closed; the renderer remains the primary purge path. */
 static void scheduleTrashBackstop(android.content.Context context){
  androidx.work.WorkManager.getInstance(context).enqueueUniquePeriodicWork(TRASH_WORK,androidx.work.ExistingPeriodicWorkPolicy.KEEP,
   new androidx.work.PeriodicWorkRequest.Builder(NotesTrashBackstopWorker.class,6,java.util.concurrent.TimeUnit.HOURS).build());
 }
 public static final class NotesTrashBackstopWorker extends androidx.work.Worker {
  public NotesTrashBackstopWorker(@androidx.annotation.NonNull android.content.Context context,@androidx.annotation.NonNull androidx.work.WorkerParameters params){super(context,params);}
  @androidx.annotation.NonNull @Override public Result doWork(){try{sweepExpiredTrash(getApplicationContext(),System.currentTimeMillis());return Result.success();}catch(Exception unavailable){return Result.retry();}}
 }

 /**
  * Native backstop for Notes Trash. Erases the recording of each Trash entry whose three days
  * have elapsed, then removes those entries from the encrypted Trash slot, under the same rules
  * as the renderer's maintenance: a note that is saved again, a recording that any saved note
  * still references, and a deletion still under review are never touched. Any unreadable or
  * unrecognized store makes it a no-op. The Trash slot is edited by compare-and-exchange on the
  * renderer's own bytes: kept entries are copied verbatim, so the result is exactly the
  * JSON.stringify form the renderer compares against, and a concurrent renderer edit wins.
  * Returns the number of entries removed.
  */
 static int sweepExpiredTrash(android.content.Context context,long now)throws Exception{
  // Sweeps serialize among themselves. METADATA_LOCK, which the main-thread plugin methods also
  // take, is held only while one recording is erased, never while large slots are decrypted.
  synchronized(SWEEP_LOCK){
   AlphaCredentialStore store=new AlphaCredentialStore(context);
   String raw=store.readCredentialSlot(NOTES_TRASH_SLOT);if(raw==null)return 0;
   java.util.List<String> spans=trashEntrySpans(raw);if(spans==null||spans.isEmpty())return 0;
   String notesRaw=store.readCredentialSlot(NOTES_SLOT);if(notesRaw==null)return 0;
   org.json.JSONArray records=new JSONObject(new JSONObject(notesRaw).getString("currentRaw")).getJSONArray("records");
   Set<String> liveNotes=new HashSet<>(),liveAudio=new HashSet<>();
   for(int i=0;i<records.length();i++){JSONObject note=records.getJSONObject(i);liveNotes.add(note.getString("id"));JSONObject audio=note.optJSONObject("audio");if(audio!=null&&audio.optString("audioId").length()>0)liveAudio.add(audio.getString("audioId"));}
   String pendingRaw=store.readCredentialSlot(PENDING_AUDIO_SLOT);JSONObject pending=pendingRaw==null?new JSONObject():new JSONObject(pendingRaw);
   List<String> kept=new ArrayList<>();int removed=0;
   for(String span:spans){
    JSONObject entry=new JSONObject(span),note=entry.getJSONObject("note");
    String id=entry.getString("id"),noteId=note.getString("id");long deletedAt=entry.getLong("deletedAt");
    boolean due=deletedAt>0&&now>=deletedAt+NOTES_TRASH_RETENTION_MS&&!liveNotes.contains(noteId);
    JSONObject audio=entry.optJSONObject("audio");
    if(due&&audio!=null){
     String audioId=audio.optString("audioId");
     due=!pending.has(id)&&!liveAudio.contains(audioId);
     if(due)synchronized(METADATA_LOCK){due=purgeTrashedLocked(context,store,audioId,noteId,id);}
    }
    if(due)removed++;else kept.add(span);
   }
   if(removed==0)return 0;
   StringBuilder next=new StringBuilder(TRASH_PREFIX);
   for(int i=0;i<kept.size();i++){if(i>0)next.append(',');next.append(kept.get(i));}
   next.append(TRASH_SUFFIX);
   return store.compareExchangeCredentialSlot(NOTES_TRASH_SLOT,raw,next.toString())?removed:0;
  }
 }
 /** Same effect and receipt as purge(): only the deletion that owns the audio trash may erase it. */
 private static boolean purgeTrashedLocked(android.content.Context context,AlphaCredentialStore store,String audioId,String noteId,String operation){
  try{
   if(operation==null||!operation.matches(OPERATION))return false;
   JSONObject record=readLocked(context,store,id(audioId));
   if(!noteId.equals(record.optString("noteId")))return false;
   JSONObject receipts=record.optJSONObject("deletionOperations");String prior=receipts==null?"unknown":receipts.optString(operation,"unknown");
   if(prior.equals("purged"))return true;
   if(!prior.equals("removed")||record.optLong("deletedAt",0)<=0||!operation.equals(record.optString("activeDeletionOperation")))return false;
   File bytes=audio(context,audioId);if(bytes.exists()&&!bytes.delete())return false;
   record.put("transcript","");receipts.put(operation,"purged");record.put("deletionOperations",receipts);
   writeLocked(context,store,audioId,record);return true;
  }catch(Exception retained){return false;}
 }
 /**
  * Top-level entry substrings of a Trash document written by JSON.stringify, or null when the
  * bytes are not exactly {"version":1,"entries":[...]}.
  */
 static List<String> trashEntrySpans(String raw){
  if(raw==null||!raw.startsWith(TRASH_PREFIX)||!raw.endsWith(TRASH_SUFFIX))return null;
  int end=raw.length()-TRASH_SUFFIX.length();List<String> spans=new ArrayList<>();
  int depth=0,start=TRASH_PREFIX.length();boolean string=false,escape=false;
  if(start==end)return spans;
  for(int i=start;i<end;i++){
   char c=raw.charAt(i);
   if(string){if(escape)escape=false;else if(c=='\\')escape=true;else if(c=='"')string=false;continue;}
   if(c=='"')string=true;
   else if(c=='{'||c=='[')depth++;
   else if(c=='}'||c==']'){if(--depth<0)return null;}
   else if(c==','&&depth==0){if(i==start)return null;spans.add(raw.substring(start,i));start=i+1;}
  }
  if(string||depth!=0||start>=end)return null;
  spans.add(raw.substring(start,end));
  for(String span:spans)if(!span.startsWith("{")||!span.endsWith("}"))return null;
  return spans;
 }

 @PluginMethod public void migrationStatus(PluginCall call){JSObject result=new JSObject();result.put("state",migrationState);result.put("failedRecords",migrationFailures);call.resolve(result);}

 private File audio(String value){return audio(getContext(),value);}
 private static File audio(android.content.Context context,String value){return new File(directory(context),id(value)+".audio");}
 private AtomicFile metadata(String value){return metadata(getContext(),value);}
 private static AtomicFile metadata(android.content.Context context,String value){return new AtomicFile(new File(directory(context),id(value)+".json"));}
 /** The same Keystore-backed slot store the AlphaConnection bridge uses, reachable without a bridge. */
 private AlphaCredentialStore secure(){return new AlphaCredentialStore(getContext());}
 private static String slot(String value){return "note-audio-metadata:v1:"+id(value);}
 private void write(String value,JSONObject record)throws Exception {synchronized(METADATA_LOCK){writeLocked(getContext(),secure(),value,record);}}
 private static void writeLocked(android.content.Context context,AlphaCredentialStore store,String value,JSONObject record)throws Exception {
  String serialized=record.toString();store.writeCredentialSlot(slot(value),serialized);
  if(!serialized.equals(store.readCredentialSlot(slot(value))))throw new IOException("Recording metadata commit unconfirmed");
  // Only replace the legacy file after durable encrypted storage has been read back.
  atomic(metadata(context,value),"{\"encrypted\":1}".getBytes(StandardCharsets.UTF_8));
 }
 private JSONObject read(String value)throws Exception {synchronized(METADATA_LOCK){return readLocked(getContext(),secure(),value);}}
 private static JSONObject readLocked(android.content.Context context,AlphaCredentialStore store,String value)throws Exception {
  String encrypted=store.readCredentialSlot(slot(value));
  JSONObject legacy=null;AtomicFile metadata=metadata(context,value);
  if(metadata.getBaseFile().exists()||new File(metadata.getBaseFile()+".bak").exists()){
   try(InputStream in=metadata.openRead()){ByteArrayOutputStream bytes=new ByteArrayOutputStream();copyBounded(in,bytes,512*1024);legacy=new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));}
  }
  if(legacy!=null&&!legacy.has("encrypted")){
   String original=legacy.toString();
   if(encrypted!=null&&!encrypted.equals(original))throw new IOException("Recording metadata copies disagree; originals retained");
   writeLocked(context,store,value,legacy);return legacy;
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
