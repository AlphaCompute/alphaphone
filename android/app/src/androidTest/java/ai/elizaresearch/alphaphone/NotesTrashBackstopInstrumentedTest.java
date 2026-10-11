package ai.elizaresearch.alphaphone;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/**
 * Native Notes Trash backstop on the real encrypted slot store and recording files: expired
 * text and voice entries are erased with the renderer's rules, kept entries stay byte-identical,
 * and a recording a saved note still references is never touched. Saved slots are restored.
 */
@RunWith(AndroidJUnit4.class)
public final class NotesTrashBackstopInstrumentedTest {
 private static final long DAY=24L*60*60*1000;
 private static final String[] SLOTS={AlphaNoteAudioPlugin.NOTES_TRASH_SLOT,AlphaNoteAudioPlugin.NOTES_SLOT,AlphaNoteAudioPlugin.PENDING_AUDIO_SLOT,"note-audio-metadata:v1:backstop-expired","note-audio-metadata:v1:backstop-shared"};
 private final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
 private final AlphaCredentialStore store=new AlphaCredentialStore(context);
 private final String[] saved=new String[SLOTS.length];

 @Before public void save()throws Exception{for(int i=0;i<SLOTS.length;i++)saved[i]=store.readCredentialSlot(SLOTS[i]);}
 @After public void restore()throws Exception{
  for(int i=0;i<SLOTS.length;i++){if(saved[i]==null)store.removeCredentialSlot(SLOTS[i]);else store.writeCredentialSlot(SLOTS[i],saved[i]);}
  for(String id:new String[]{"backstop-expired","backstop-shared"}){new File(audioDir(),id+".audio").delete();new File(audioDir(),id+".json").delete();}
 }
 private File audioDir(){File dir=new File(context.getNoBackupFilesDir(),"note-audio");dir.mkdirs();return dir;}
 private void recording(String audioId,String noteId,String operation,long deletedAt)throws Exception{
  try(FileOutputStream out=new FileOutputStream(new File(audioDir(),audioId+".audio"))){out.write("synthetic".getBytes(StandardCharsets.UTF_8));}
  JSONObject record=new JSONObject().put("audioId",audioId).put("noteId",noteId).put("durationMs",1000).put("createdAt",deletedAt-1000).put("mimeType","audio/mp4")
   .put("transcript","Synthetic spoken words").put("deletedAt",deletedAt).put("activeDeletionOperation",operation).put("deletionOperations",new JSONObject().put(operation,"removed"));
  store.writeCredentialSlot("note-audio-metadata:v1:"+audioId,record.toString());
 }
 /** JSON.stringify's form for these simple records: insertion order, no spaces, no escaped slashes. */
 private static String entry(String id,String noteId,String kind,String title,long deletedAt,String audioId){
  String audio=audioId==null?"":",\"audio\":{\"audioId\":\""+audioId+"\",\"noteId\":\""+noteId+"\"}";
  return "{\"id\":\""+id+"\",\"note\":{\"id\":\""+noteId+"\",\"kind\":\""+kind+"\",\"title\":\""+title+"\",\"body\":\"Body with a / slash\""+audio+"}"+(audioId==null?"":",\"audio\":{\"audioId\":\""+audioId+"\"}")+",\"index\":0,\"deletedAt\":"+deletedAt+"}";
 }
 private void notes(String... audioIds)throws Exception{
  JSONArray records=new JSONArray().put(new JSONObject().put("id","backstop-live").put("kind","text").put("title","Live").put("body",""));
  for(String audioId:audioIds)records.put(new JSONObject().put("id","backstop-live-"+audioId).put("kind","voice").put("title","Shares").put("body","").put("audio",new JSONObject().put("audioId",audioId).put("noteId","backstop-live-"+audioId)));
  JSONObject envelope=new JSONObject().put("version",2).put("collectionId","backstop").put("records",records).put("deleted",new JSONArray());
  store.writeCredentialSlot(AlphaNoteAudioPlugin.NOTES_SLOT,new JSONObject().put("currentRaw",envelope.toString()).toString());
 }

 @Test public void expiredTextAndVoiceEntriesAreErasedAndOthersKeptVerbatim()throws Exception{
  long now=System.currentTimeMillis(),expired=now-3*DAY-60_000,fresh=now-DAY;
  String opText="11111111-1111-4111-8111-111111111111",opVoice="22222222-2222-4222-8222-222222222222",opShared="33333333-3333-4333-8333-333333333333",opFresh="44444444-4444-4444-8444-444444444444",opLive="55555555-5555-4555-8555-555555555555";
  recording("backstop-expired","backstop-voice",opVoice,expired);
  recording("backstop-shared","backstop-shared-note",opShared,expired);
  notes("backstop-shared");
  store.removeCredentialSlot(AlphaNoteAudioPlugin.PENDING_AUDIO_SLOT);
  String keptFresh=entry(opFresh,"backstop-fresh","text","Fresh",fresh,null);
  String keptShared=entry(opShared,"backstop-shared-note","voice","Shared",expired,"backstop-shared");
  String keptLive=entry(opLive,"backstop-live","text","Live again",expired,null);
  String trash="{\"version\":1,\"entries\":["+entry(opText,"backstop-text","text","Expired",expired,null)+","+keptFresh+","+entry(opVoice,"backstop-voice","voice","Voice",expired,"backstop-expired")+","+keptShared+","+keptLive+"]}";
  store.writeCredentialSlot(AlphaNoteAudioPlugin.NOTES_TRASH_SLOT,trash);

  assertEquals(2,AlphaNoteAudioPlugin.sweepExpiredTrash(context,now));
  assertEquals("Kept entries are copied byte for byte","{\"version\":1,\"entries\":["+keptFresh+","+keptShared+","+keptLive+"]}",store.readCredentialSlot(AlphaNoteAudioPlugin.NOTES_TRASH_SLOT));
  assertFalse("Expired recording bytes erased",new File(audioDir(),"backstop-expired.audio").exists());
  JSONObject erased=new JSONObject(store.readCredentialSlot("note-audio-metadata:v1:backstop-expired"));
  assertEquals("",erased.getString("transcript"));assertEquals("purged",erased.getJSONObject("deletionOperations").getString(opVoice));
  assertTrue("A recording a saved note references is kept",new File(audioDir(),"backstop-shared.audio").exists());
  assertEquals("Synthetic spoken words",new JSONObject(store.readCredentialSlot("note-audio-metadata:v1:backstop-shared")).getString("transcript"));
  assertEquals("Idempotent",0,AlphaNoteAudioPlugin.sweepExpiredTrash(context,now));
 }

 @Test public void unreadableStoresAndReviewRowsMakeItANoOp()throws Exception{
  long now=System.currentTimeMillis(),expired=now-3*DAY-60_000;String op="66666666-6666-4666-8666-666666666666";
  recording("backstop-expired","backstop-voice",op,expired);
  String trash="{\"version\":1,\"entries\":["+entry(op,"backstop-voice","voice","Voice",expired,"backstop-expired")+"]}";
  store.writeCredentialSlot(AlphaNoteAudioPlugin.NOTES_TRASH_SLOT,trash);
  store.removeCredentialSlot(AlphaNoteAudioPlugin.NOTES_SLOT);
  assertEquals("No saved-notes readback, no purge",0,AlphaNoteAudioPlugin.sweepExpiredTrash(context,now));
  notes();
  store.writeCredentialSlot(AlphaNoteAudioPlugin.PENDING_AUDIO_SLOT,new JSONObject().put(op,new JSONObject().put("id",op)).toString());
  assertEquals("A deletion under review is never purged",0,AlphaNoteAudioPlugin.sweepExpiredTrash(context,now));
  assertTrue(new File(audioDir(),"backstop-expired.audio").exists());
  store.writeCredentialSlot(AlphaNoteAudioPlugin.NOTES_TRASH_SLOT,"{\"entries\":[],\"version\":1}");
  store.removeCredentialSlot(AlphaNoteAudioPlugin.PENDING_AUDIO_SLOT);
  assertEquals("Unrecognized bytes are left alone",0,AlphaNoteAudioPlugin.sweepExpiredTrash(context,now));
  assertEquals("{\"entries\":[],\"version\":1}",store.readCredentialSlot(AlphaNoteAudioPlugin.NOTES_TRASH_SLOT));
  assertNull(AlphaNoteAudioPlugin.trashEntrySpans("{\"version\":1,\"entries\":[{\"a\":\"]}\"},]}"));
  assertEquals(2,AlphaNoteAudioPlugin.trashEntrySpans("{\"version\":1,\"entries\":[{\"a\":\"},{\\\"\"},{\"b\":[1,{}]}]}").size());
 }
 /** MVP-15: the sweep takes its clock as an argument, so wrong and corrected clocks are exact. */
 @Test public void wrongClocksNeverPurgeEarlyAndTheDeadlineIsExact()throws Exception{
  long deletedAt=System.currentTimeMillis()-DAY;String opText="77777777-7777-4777-8777-777777777777",opVoice="88888888-8888-4888-8888-888888888888";
  recording("backstop-expired","backstop-voice",opVoice,deletedAt);
  notes();
  store.removeCredentialSlot(AlphaNoteAudioPlugin.PENDING_AUDIO_SLOT);
  String trash="{\"version\":1,\"entries\":["+entry(opText,"backstop-text","text","Clock",deletedAt,null)+","+entry(opVoice,"backstop-voice","voice","Voice",deletedAt,"backstop-expired")+"]}";
  store.writeCredentialSlot(AlphaNoteAudioPlugin.NOTES_TRASH_SLOT,trash);
  // A clock moved backwards (even before the deletion) and one millisecond before the deadline.
  for(long now:new long[]{deletedAt-10*DAY,1L,deletedAt,deletedAt+3*DAY-1}){
   assertEquals(0,AlphaNoteAudioPlugin.sweepExpiredTrash(context,now));
   assertEquals("deletedAt is never rewritten",trash,store.readCredentialSlot(AlphaNoteAudioPlugin.NOTES_TRASH_SLOT));
   assertTrue(new File(audioDir(),"backstop-expired.audio").exists());
  }
  // Exactly three days after deletion both entries go, the recording with its own operation.
  assertEquals(2,AlphaNoteAudioPlugin.sweepExpiredTrash(context,deletedAt+3*DAY));
  assertEquals("{\"version\":1,\"entries\":[]}",store.readCredentialSlot(AlphaNoteAudioPlugin.NOTES_TRASH_SLOT));
  assertFalse(new File(audioDir(),"backstop-expired.audio").exists());
  assertEquals("purged",new JSONObject(store.readCredentialSlot("note-audio-metadata:v1:backstop-expired")).getJSONObject("deletionOperations").getString(opVoice));
 }

 /** MVP-15: process death after the recording erase but before the Trash row was removed converges. */
 @Test public void anEraseInterruptedBeforeItsRowWasRemovedIsCompletedOnce()throws Exception{
  long now=System.currentTimeMillis(),expired=now-3*DAY-60_000;String op="99999999-9999-4999-8999-999999999999";
  // The state a killed process leaves: bytes gone, receipt purged, row still present.
  JSONObject record=new JSONObject().put("audioId","backstop-expired").put("noteId","backstop-voice").put("durationMs",1000).put("createdAt",expired-1000).put("mimeType","audio/mp4")
   .put("transcript","").put("deletedAt",expired).put("activeDeletionOperation",op).put("deletionOperations",new JSONObject().put(op,"purged"));
  store.writeCredentialSlot("note-audio-metadata:v1:backstop-expired",record.toString());
  notes();
  store.removeCredentialSlot(AlphaNoteAudioPlugin.PENDING_AUDIO_SLOT);
  store.writeCredentialSlot(AlphaNoteAudioPlugin.NOTES_TRASH_SLOT,"{\"version\":1,\"entries\":["+entry(op,"backstop-voice","voice","Voice",expired,"backstop-expired")+"]}");
  assertEquals(1,AlphaNoteAudioPlugin.sweepExpiredTrash(context,now));
  assertEquals("{\"version\":1,\"entries\":[]}",store.readCredentialSlot(AlphaNoteAudioPlugin.NOTES_TRASH_SLOT));
  assertEquals("The receipt is unchanged",record.toString(),new JSONObject(store.readCredentialSlot("note-audio-metadata:v1:backstop-expired")).toString());
  assertEquals("Idempotent",0,AlphaNoteAudioPlugin.sweepExpiredTrash(context,now));
 }

 /** MVP-15: a permanent deletion under review (no Trash entry) leaves the sweep with nothing to erase. */
 @Test public void aPermanentDeletionUnderReviewIsNeverSweptThroughAnotherEntry()throws Exception{
  long now=System.currentTimeMillis(),expired=now-3*DAY-60_000;String stale="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",permanent="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  // The recording is in the audio trash under the permanent operation; an older Trash row names another operation.
  recording("backstop-expired","backstop-voice",permanent,expired);
  notes();
  store.writeCredentialSlot(AlphaNoteAudioPlugin.PENDING_AUDIO_SLOT,new JSONObject().put(permanent,new JSONObject().put("id",permanent).put("permanent",true)).toString());
  String trash="{\"version\":1,\"entries\":["+entry(stale,"backstop-voice","voice","Voice",expired,"backstop-expired")+"]}";
  store.writeCredentialSlot(AlphaNoteAudioPlugin.NOTES_TRASH_SLOT,trash);
  assertEquals("Only the operation that owns the audio trash may erase it",0,AlphaNoteAudioPlugin.sweepExpiredTrash(context,now));
  assertEquals(trash,store.readCredentialSlot(AlphaNoteAudioPlugin.NOTES_TRASH_SLOT));
  assertTrue(new File(audioDir(),"backstop-expired.audio").exists());
  assertEquals("Synthetic spoken words",new JSONObject(store.readCredentialSlot("note-audio-metadata:v1:backstop-expired")).getString("transcript"));
 }
}
