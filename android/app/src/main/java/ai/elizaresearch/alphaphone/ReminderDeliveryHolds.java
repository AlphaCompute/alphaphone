package ai.elizaresearch.alphaphone;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import java.util.Iterator;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Policy P-30: reminder delivery is suspended while a reviewed deletion can still be undone.
 * A hold names the pending-deletion record that owns it. An alarm that fires during a hold is
 * recorded, not posted; releasing the hold after Undo (or a kept reminder) delivers it late,
 * and releasing it after a confirmed deletion drops it. Holds survive process death and reboot.
 * The renderer reconciles holds against its durable pending-deletion records on every start.
 */
final class ReminderDeliveryHolds {
 static final String PREFERENCES = "alpha-reminder-delivery-holds-v1";
 private static final String KEY = "holds";
 static final int MAXIMUM_HOLDS = 100, MAXIMUM_DEFERRED = 32;
 private ReminderDeliveryHolds() {}
 private static boolean validHold(String value) { return value != null && value.matches("[A-Za-z0-9_:.-]{1,200}"); }
 private static boolean validReminder(String value) { return value != null && !value.isEmpty() && value.length() <= 200 && value.indexOf(0) < 0; }
 private static SharedPreferences preferences(Context context) { return context.getApplicationContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE); }
 private static JSONObject read(Context context) {
  try { return new JSONObject(preferences(context).getString(KEY, "{}")); }
  // A damaged store keeps no hold: delivery is never silently lost because of unreadable state.
  catch (JSONException damaged) { return new JSONObject(); }
 }
 private static void write(Context context, JSONObject holds) {
  if (!preferences(context).edit().putString(KEY, holds.toString()).commit()) throw new IllegalStateException("Reminder hold was not saved");
 }
 static synchronized void hold(Context context, String reminderId, String holdId) throws JSONException {
  if (!validReminder(reminderId) || !validHold(holdId)) throw new IllegalArgumentException("Invalid reminder hold");
  JSONObject holds = read(context);
  JSONObject existing = holds.optJSONObject(reminderId);
  if (existing != null && holdId.equals(existing.optString("holdId"))) return;
  if (existing == null && holds.length() >= MAXIMUM_HOLDS) throw new IllegalStateException("Too many reminder holds");
  holds.put(reminderId, new JSONObject().put("holdId", holdId).put("deferred", new JSONArray()));
  write(context, holds);
 }
 /** Returns true when the alarm was absorbed by a hold and must not be posted now. */
 static synchronized boolean defer(Context context, String reminderId, String occurrence) {
  if (!validReminder(reminderId)) return false;
  try {
   JSONObject holds = read(context), hold = holds.optJSONObject(reminderId);
   if (hold == null) return false;
   JSONArray deferred = hold.optJSONArray("deferred");
   if (deferred == null) deferred = new JSONArray();
   String value = occurrence == null ? "" : occurrence;
   boolean seen = false;
   for (int i = 0; i < deferred.length(); i++) if (value.equals(deferred.optString(i))) seen = true;
   if (!seen && deferred.length() < MAXIMUM_DEFERRED) deferred.put(value);
   hold.put("deferred", deferred);
   write(context, holds);
   return true;
  } catch (JSONException | RuntimeException failed) {
   // Could not record the deferral: deliver rather than lose an alert the user may still keep.
   return false;
  }
 }
 /** Remove the hold owned by holdId. Returns the alarms to deliver late (empty unless redeliver). */
 static synchronized JSONArray release(Context context, String reminderId, String holdId, boolean redeliver) throws JSONException {
  if (!validReminder(reminderId) || !validHold(holdId)) throw new IllegalArgumentException("Invalid reminder hold");
  JSONObject holds = read(context), hold = holds.optJSONObject(reminderId);
  if (hold == null || !holdId.equals(hold.optString("holdId"))) return new JSONArray();
  holds.remove(reminderId);
  write(context, holds);
  JSONArray deferred = hold.optJSONArray("deferred");
  return redeliver && deferred != null ? deferred : new JSONArray();
 }
 static synchronized JSONArray list(Context context) throws JSONException {
  JSONObject holds = read(context);
  JSONArray out = new JSONArray();
  for (Iterator<String> keys = holds.keys(); keys.hasNext();) {
   String reminderId = keys.next();
   JSONObject hold = holds.optJSONObject(reminderId);
   if (hold == null) continue;
   out.put(new JSONObject().put("id", hold.optString("holdId")).put("reminderId", reminderId).put("deferred", hold.optJSONArray("deferred") == null ? 0 : hold.optJSONArray("deferred").length()));
  }
  return out;
 }
 /** Late delivery after release goes through the shared engine's normal revision checks. */
 static void redeliver(Context context, String reminderId, JSONArray occurrences) {
  for (int i = 0; i < occurrences.length(); i++) {
   String occurrence = occurrences.optString(i, "");
   Intent intent = new Intent(context, ReminderReceiver.class).setAction(AlphaReminders.CONFIGURATION.remindAction)
    .putExtra(AlphaReminders.CONFIGURATION.idExtra, reminderId);
   if (!occurrence.isEmpty()) intent.putExtra(AlphaReminders.CONFIGURATION.occurrenceExtra, occurrence);
   AlphaReminders.engine(context).dispatch(intent);
  }
 }
}
