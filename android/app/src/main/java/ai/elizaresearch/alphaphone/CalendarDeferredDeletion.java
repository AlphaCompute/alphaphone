package ai.elizaresearch.alphaphone;

import android.content.ContentProviderOperation;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.provider.CalendarContract;
import ai.eliza.plugins.calendar.CalendarConfiguration;
import ai.eliza.plugins.calendar.read.CalendarSourceIdentity;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Policy P-30: one review now, provider deletion after the ten-second Undo window.
 *
 * The shared Calendar plugin's remove() couples its review dialog to an immediate provider delete,
 * so it cannot delay the deletion. This product class splits the two: a confirmed review stores a
 * single-use grant bound to the exact provider revision. Commit first checks the grant and reads
 * the event without spending the grant, so a provider that cannot be read returns "unavailable"
 * with the grant intact and the renderer retries later. Only then is the grant consumed (saved
 * before the provider call, so it can never run twice) and the same atomic assertions as the
 * shared guard applied before deleting. A missing grant is "unknown", never "conflict": the
 * renderer settles it by readback and never reports an unchanged event as changed. The canonical revision fields and hash match
 * ai.eliza.plugins.calendar.CalendarEventGuard (checked by test/calendar-deletion-undo.test.mjs),
 * so a revision from the shared inspect() is accepted here. Scope is the same as the shared remove:
 * a direct, non-repeating Alpha Phone local event with no guests or alarms. Repeating events and
 * invitations stay with Android Calendar; nothing is ever recreated as a "restore".
 * Move this to plugin-native-calendar as a shared deferred-deletion API when upstream accepts it.
 */
final class CalendarDeferredDeletion {
 static final String PREFERENCES = "alpha-calendar-deletion-grants-v1";
 static final int MAXIMUM_GRANTS = 100;
 /** Grants expire if never committed or revoked; the renderer intent expires far sooner. */
 static final long GRANT_LIFETIME_MS = 30L * 24 * 60 * 60 * 1000;
 static final String[] EVENT = {"_id","calendar_id","title","description","eventLocation","dtstart","dtend","eventTimezone","allDay","rrule","rdate","exrule","exdate","original_id","original_sync_id","eventStatus","deleted","hasAlarm","hasAttendeeData","availability","accessLevel","organizer"};
 private CalendarDeferredDeletion() {}

 static final class Snapshot {
  final long id, calendarId; final ContentValues event, calendar; final String revision;
  Snapshot(long id, long calendarId, ContentValues event, ContentValues calendar) throws Exception {
   this.id = id; this.calendarId = calendarId; this.event = event; this.calendar = calendar;
   StringBuilder canonical = new StringBuilder(); append(canonical, EVENT, event); append(canonical, CalendarSourceIdentity.fields(), calendar);
   revision = hex(MessageDigest.getInstance("SHA-256").digest(canonical.toString().getBytes(StandardCharsets.UTF_8)));
  }
  boolean deleted() { return number(event, "deleted") != 0; }
  boolean direct(CalendarConfiguration configuration) {
   return configuration.accountName.equals(calendar.getAsString("account_name")) && CalendarContract.ACCOUNT_TYPE_LOCAL.equals(calendar.getAsString("account_type"))
    && configuration.localCalendarName.equals(calendar.getAsString("name")) && number(calendar, "calendar_access_level") >= CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR
    && number(event, "allDay") == 0 && number(event, "deleted") == 0 && number(event, "hasAlarm") == 0 && number(event, "hasAttendeeData") == 0
    && event.get("original_id") == null && event.get("original_sync_id") == null && empty(event, "rrule") && empty(event, "rdate") && empty(event, "exrule") && empty(event, "exdate") && event.get("dtend") != null;
  }
  boolean visible(JSONObject expected) {
   return expected != null && same(expected.optString("title", ""), event, "title") && same(expected.optString("body", ""), event, "description")
    && same(expected.optString("location", ""), event, "eventLocation") && expected.optLong("begin", -1) == number(event, "dtstart") && expected.optLong("end", -1) == number(event, "dtend");
  }
  ArrayList<ContentProviderOperation> deletion() {
   ArrayList<ContentProviderOperation> operations = new ArrayList<>();
   operations.add(ContentProviderOperation.newAssertQuery(ContentUris.withAppendedId(CalendarContract.Calendars.CONTENT_URI, calendarId)).withValues(calendar).withExpectedCount(1).build());
   operations.add(ContentProviderOperation.newAssertQuery(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id)).withValues(event).withExpectedCount(1).build());
   operations.add(ContentProviderOperation.newAssertQuery(CalendarContract.Attendees.CONTENT_URI).withSelection("event_id=?", new String[]{Long.toString(id)}).withExpectedCount(0).build());
   operations.add(ContentProviderOperation.newAssertQuery(CalendarContract.Reminders.CONTENT_URI).withSelection("event_id=?", new String[]{Long.toString(id)}).withExpectedCount(0).build());
   operations.add(ContentProviderOperation.newDelete(CalendarContract.Events.CONTENT_URI).withSelection(CalendarContract.Events._ID + "=?", new String[]{Long.toString(id)}).withExpectedCount(1).build());
   return operations;
  }
 }

 static Snapshot read(ContentResolver resolver, long id, long calendarId) throws Exception {
  if (id <= 0 || calendarId <= 0) throw new IllegalArgumentException();
  ContentValues event = values(resolver, ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id), EVENT);
  if (event == null || number(event, "calendar_id") != calendarId) return null;
  ContentValues calendar = values(resolver, ContentUris.withAppendedId(CalendarContract.Calendars.CONTENT_URI, calendarId), CalendarSourceIdentity.fields());
  return calendar == null ? null : new Snapshot(id, calendarId, event, calendar);
 }

 private static SharedPreferences preferences(Context context) { return context.getApplicationContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE); }
 private static JSONObject grants(Context context) {
  try { return new JSONObject(preferences(context).getString("grants", "{}")); }
  catch (JSONException damaged) { return new JSONObject(); }
 }
 private static void save(Context context, JSONObject grants) { if (!preferences(context).edit().putString("grants", grants.toString()).commit()) throw new IllegalStateException("Deletion grant was not saved"); }

 /** Persist a reviewed grant. The caller has already shown and confirmed the review. */
 static synchronized String grant(Context context, Snapshot snapshot, long now) throws JSONException {
  JSONObject grants = grants(context);
  for (java.util.Iterator<String> keys = grants.keys(); keys.hasNext();) { JSONObject row = grants.optJSONObject(keys.next()); if (row == null || now - row.optLong("issuedAt") > GRANT_LIFETIME_MS || row.optLong("issuedAt") > now + GRANT_LIFETIME_MS) keys.remove(); }
  if (grants.length() >= MAXIMUM_GRANTS) throw new IllegalStateException("Too many pending deletions");
  String grant = java.util.UUID.randomUUID().toString();
  grants.put(grant, new JSONObject().put("id", Long.toString(snapshot.id)).put("calendarId", Long.toString(snapshot.calendarId)).put("revision", snapshot.revision).put("issuedAt", now));
  save(context, grants);
  return grant;
 }
 /** Read a grant without spending it. */
 static synchronized JSONObject peek(Context context, String grant) {
  if (grant == null || !grant.matches("[0-9a-f-]{36}")) return null;
  return grants(context).optJSONObject(grant);
 }
 /** Remove and return a grant. It is single use: a crash after this never allows a second commit. */
 static synchronized JSONObject consume(Context context, String grant) {
  if (grant == null || !grant.matches("[0-9a-f-]{36}")) return null;
  JSONObject grants = grants(context), row = grants.optJSONObject(grant);
  if (row == null) return null;
  grants.remove(grant); save(context, grants);
  return row;
 }
 static synchronized void revoke(Context context, String grant) { consume(context, grant); }

 /**
  * Statuses: deleted, conflict, unavailable (nothing dispatched, grant kept), unknown.
  * Readback after the batch confirms the provider row is gone.
  */
 static String commit(Context context, String grantId) {
  JSONObject grant = peek(context, grantId);
  // Already used, revoked or expired: the readback decides, never a guessed "changed".
  if (grant == null) return "unknown";
  ContentResolver resolver = context.getContentResolver();
  final long id, calendarId;
  final Snapshot snapshot;
  try { id = Long.parseLong(grant.optString("id")); calendarId = Long.parseLong(grant.optString("calendarId")); }
  catch (NumberFormatException damaged) { consume(context, grantId); return "unknown"; }
  try { snapshot = read(resolver, id, calendarId); }
  catch (Exception unavailable) { return "unavailable"; }
  if (snapshot == null) {
   String presence = presence(resolver, id, calendarId);
   if ("unavailable".equals(presence)) return "unavailable";
   consume(context, grantId);
   // An event moved to another calendar still exists: it was kept, not deleted.
   return "absent".equals(presence) ? "deleted" : "moved".equals(presence) ? "conflict" : "unknown";
  }
  if (snapshot.deleted()) { consume(context, grantId); return "deleted"; }
  if (!snapshot.revision.equals(grant.optString("revision"))) { consume(context, grantId); return "conflict"; }
  if (consume(context, grantId) == null) return "unknown";
  try {
   resolver.applyBatch(CalendarContract.AUTHORITY, snapshot.deletion());
   return "absent".equals(readback(context, snapshot.id, snapshot.calendarId, snapshot.revision)) ? "deleted" : "unknown";
  } catch (android.content.OperationApplicationException changed) { return "conflict"; }
  catch (Exception uncertain) { return "unknown"; }
 }
 /** Statuses: absent, present (exact revision), changed (edited or moved), unavailable. Never mutates. */
 static String readback(Context context, long id, long calendarId, String revision) {
  try {
   Snapshot snapshot = read(context.getContentResolver(), id, calendarId);
   if (snapshot == null) { String presence = presence(context.getContentResolver(), id, calendarId); return "moved".equals(presence) ? "changed" : "absent".equals(presence) ? "absent" : "unavailable"; }
   if (snapshot.deleted()) return "absent";
   return snapshot.revision.equals(revision) ? "present" : "changed";
  } catch (Exception unavailable) { return "unavailable"; }
 }
 /**
  * Tells a deleted row apart from one that read() rejected because it is now in another calendar.
  * Statuses: absent, moved, orphaned (the row is there but its calendar row is not), unavailable.
  */
 static String presence(ContentResolver resolver, long id, long calendarId) {
  try {
   ContentValues row = values(resolver, ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id), new String[]{"calendar_id", "deleted"});
   if (row == null || number(row, "deleted") != 0) return "absent";
   return number(row, "calendar_id") != calendarId ? "moved" : "orphaned";
  } catch (Exception unavailable) { return "unavailable"; }
 }

 private static ContentValues values(ContentResolver resolver, android.net.Uri uri, String[] fields) {
  try (Cursor row = resolver.query(uri, fields, null, null, null)) {
   if (row == null || !row.moveToFirst()) return null;
   ContentValues values = new ContentValues();
   for (int i = 0; i < fields.length; i++) { if (row.isNull(i)) values.putNull(fields[i]); else if (row.getType(i) == Cursor.FIELD_TYPE_INTEGER) values.put(fields[i], row.getLong(i)); else values.put(fields[i], row.getString(i)); }
   if (row.moveToNext()) throw new IllegalStateException("Ambiguous event");
   return values;
  }
 }
 private static void append(StringBuilder out, String[] fields, ContentValues values) { for (String key : fields) { Object value = values.get(key); out.append(key.length()).append(':').append(key).append(value == null ? "N" : "V" + value.toString().length() + ":" + value.toString()).append(';'); } }
 private static String hex(byte[] bytes) { StringBuilder out = new StringBuilder(); for (byte b : bytes) out.append(String.format(java.util.Locale.ROOT, "%02x", b & 255)); return out.toString(); }
 private static long number(ContentValues values, String key) { Long value = values.getAsLong(key); return value == null ? 0 : value; }
 private static boolean empty(ContentValues values, String key) { String value = values.getAsString(key); return value == null || value.isEmpty(); }
 private static boolean same(String value, ContentValues values, String key) { String actual = values.getAsString(key); return value.equals(actual == null ? "" : actual); }
}
