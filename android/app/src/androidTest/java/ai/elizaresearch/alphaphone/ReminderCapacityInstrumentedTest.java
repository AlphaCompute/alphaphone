package ai.elizaresearch.alphaphone;

import android.content.Context;
import android.content.ContextWrapper;
import android.content.SharedPreferences;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.ArrayList;
import java.util.Map;
import java.util.UUID;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Native scheduling/persistence lifecycle at capacity, with synthetic damaged/history snapshots. */
@RunWith(AndroidJUnit4.class)
public class ReminderCapacityInstrumentedTest {
 @Test public void fullStorePreservesUnresolvedAndDamagedNeighborsUntilExplicitCancellation() throws Exception {
  Context base = InstrumentationRegistry.getInstrumentation().getTargetContext();
  String prefix = "capacity_" + UUID.randomUUID().toString().replace("-", "");
  // Isolate preferences only. AlarmManager, PendingIntents and notification cancellation
  // still use real Android services; every fixture has a unique ID and is cancelled below.
  Context context = new ContextWrapper(base) {
   @Override public SharedPreferences getSharedPreferences(String name, int mode) {
    return super.getSharedPreferences(name.equals("alpha-local-reminders-v1")||name.equals("alpha-reminder-envelope-v1") ? prefix+"_"+name : name, mode);
   }
  };
  
  ArrayList<String> ids = new ArrayList<>();
  long future = System.currentTimeMillis() + 86400000L;
  String replacement = prefix + "_replacement";
  try {
   for (int i = 0; i < 248; i++) {
    String id = prefix + "_" + i; ids.add(id);
    assertEquals("scheduled", ReminderStore.schedule(context, id, "Capacity fixture " + i, "", future + i * 1000L).getString("status"));
   }
   // These persisted historical states are synthetic, not evidence of real permission
   // denial/delivery. Dedicated recovery tests exercise those actual OS boundaries.
   String denied = ids.get(0), posted = ids.get(1);
   JSONObject deniedRecord = ReminderStore.read(context, denied).put("status", "permission-denied");
   JSONObject postedRecord = ReminderStore.read(context, posted).put("status", "posted").put("postedAt", System.currentTimeMillis());
   assertTrue(new ReminderEnvelope(context).records().edit().putString(denied, deniedRecord.toString()).putString(posted, postedRecord.toString())
    .putString(prefix + "_bad_json", "broken-json").putInt(prefix + "_bad_type", 7).commit());
   Map<String, ?> before = new ReminderEnvelope(context).records().getAll();
   assertEquals(250, before.size());
   try { ReminderStore.schedule(context, replacement, "Must remain unscheduled", "", future); fail("Unresolved reminders must not be reclaimed"); }
   catch (IllegalArgumentException expected) { assertTrue(expected.getMessage().contains("storage is full")); }
   assertEquals("Refusal must not alter any persisted record", before, new ReminderEnvelope(context).records().getAll());
   assertNull(ReminderStore.read(context, replacement));
   assertEquals(248, ReminderStore.list(context).length());
   ReminderStore.restore(context); // Corrupted neighbors cannot stop healthy alarm restoration.

   String cancelled = ids.get(2);
   assertTrue(ReminderStore.cancel(context, cancelled));
   assertEquals("cancelled", ReminderStore.read(context, cancelled).getString("status"));
   ids.add(replacement);
   assertEquals("scheduled", ReminderStore.schedule(context, replacement, "Replacement", "", future).getString("status"));
   assertNull("Only explicit cancelled history may be reclaimed", ReminderStore.read(context, cancelled));
   assertEquals(250, new ReminderEnvelope(context).records().getAll().size());
   assertEquals(deniedRecord.toString(), new ReminderEnvelope(context).records().getString(denied, null));
   assertEquals(postedRecord.toString(), new ReminderEnvelope(context).records().getString(posted, null));
   assertEquals("broken-json", new ReminderEnvelope(context).records().getString(prefix + "_bad_json", null));
   assertEquals(7, new ReminderEnvelope(context).records().getInt(prefix + "_bad_type", 0));
   for (int i = 3; i < 248; i++) assertEquals(before.get(ids.get(i)), new ReminderEnvelope(context).records().getString(ids.get(i), null));
   assertEquals("Existing reminders remain editable at capacity", future + 900000L,
    ReminderStore.schedule(context, replacement, "Edited replacement", "", future + 900000L).getLong("at"));
  } finally {
   for (String id : ids) ReminderStore.cancel(context, id);
   assertTrue(base.getSharedPreferences(prefix+"_alpha-reminder-envelope-v1",0).edit().clear().commit());assertTrue(base.getSharedPreferences(prefix+"_alpha-local-reminders-v1",0).edit().clear().commit());
  }
 }
}
