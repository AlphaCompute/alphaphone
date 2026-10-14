package ai.elizaresearch.alphaphone;

import android.Manifest;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.CancellationSignal;
import android.provider.Settings;
import android.provider.Telephony;
import android.telephony.SmsManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * SMS/MMS provider reads and reviewed native sends for the Alpha AOSP image (issue #421). Every entry
 * point is reached only from {@link AlphaTelephonyPlugin} or {@link AlphaSmsSendReceiver}, both of which
 * require {@link AlphaImageCapability}; callers also check READ_SMS / SEND_SMS themselves.
 *
 * Reads are bounded (threads and messages per page, characters per body, addresses per message) and
 * take the caller's CancellationSignal. Sends go through SmsManager for the reviewed subscription with
 * one immutable, package-explicit sent and delivery PendingIntent per part, and are journaled in
 * {@link SmsSendJournal} before the first platform call.
 */
final class AlphaSms {
 private AlphaSms() {}
 static final String ACTION_SENT = "ai.elizaresearch.alphaphone.SMS_SENT", ACTION_DELIVERED = "ai.elizaresearch.alphaphone.SMS_DELIVERED";
 static final String EXTRA_OPERATION = "operationId", EXTRA_INDEX = "partIndex";
 private static final Uri CONVERSATIONS = Uri.parse("content://mms-sms/conversations?simple=true");
 private static final Uri CANONICAL_ADDRESSES = Uri.parse("content://mms-sms/canonical-addresses");
 private static final int MMS_FROM = 137;
 static final ExecutorService WORK = Executors.newSingleThreadExecutor();

 interface Listener { void sendUpdated(String operationId); }
 private static volatile Listener listener;
 static void listen(Listener value) { listener = value; }
 static void stopListening(Listener value) { if (listener == value) listener = null; }
 static void updated(String operationId) { Listener current = listener; if (current != null) current.sendUpdated(operationId); }

 private static SmsSendJournal journal;
 /** The process's journal; an interrupted dispatch from an earlier process is reconciled to unknown on first load. */
 static synchronized SmsSendJournal journal(Context context) throws IOException {
  if (journal == null) {
   SmsSendJournal loaded = new SmsSendJournal(new File(context.getNoBackupFilesDir(), "alpha-sms-sends.journal"));
   loaded.reconcile(boot(context), false);
   journal = loaded;
  }
  return journal;
 }
 static long boot(Context context) {
  try { return Settings.Global.getInt(context.getContentResolver(), Settings.Global.BOOT_COUNT, -1); }
  catch (RuntimeException unreadable) { return -1; }
 }
 static boolean granted(Context context, String permission) { return context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED; }

 // ---- Reads -----------------------------------------------------------------------------------

 private static Cursor query(ContentResolver resolver, Uri uri, String[] projection, String selection, String[] args, String order, CancellationSignal cancel) {
  return resolver.query(uri, projection, selection, args, order, cancel);
 }
 private static long longAt(Cursor c, String column) { int i = c.getColumnIndex(column); return i < 0 || c.isNull(i) ? 0 : c.getLong(i); }
 private static int intAt(Cursor c, String column, int otherwise) { int i = c.getColumnIndex(column); return i < 0 || c.isNull(i) ? otherwise : c.getInt(i); }
 private static String textAt(Cursor c, String column) { int i = c.getColumnIndex(column); return i < 0 || c.isNull(i) ? null : c.getString(i); }

 /** Conversation threads, newest first, before an optional date (exclusive). */
 static JSObject threads(Context context, int limit, long before, CancellationSignal cancel) {
  ContentResolver resolver = context.getContentResolver();
  JSArray rows = new JSArray();
  List<String[]> recipientIds = new ArrayList<>();
  List<JSObject> pending = new ArrayList<>();
  Set<String> ids = new HashSet<>();
  try (Cursor c = query(resolver, CONVERSATIONS, new String[] { "_id", "date", "message_count", "recipient_ids", "snippet", "read" },
    before > 0 ? "date < ?" : null, before > 0 ? new String[] { Long.toString(before) } : null, "date DESC", cancel)) {
   while (c != null && c.moveToNext() && pending.size() < limit) {
    cancel.throwIfCanceled();
    long id = longAt(c, "_id");
    if (id <= 0) continue;
    String raw = textAt(c, "recipient_ids");
    String[] members = raw == null || raw.trim().isEmpty() ? new String[0] : raw.trim().split("\\s+");
    if (members.length > SmsRecords.MAX_ADDRESSES) members = java.util.Arrays.copyOf(members, SmsRecords.MAX_ADDRESSES);
    for (String member : members) if (member.matches("[0-9]{1,18}")) ids.add(member);
    JSObject row = new JSObject();
    row.put("id", SmsRecords.threadId(id));
    row.put("date", longAt(c, "date"));
    row.put("messageCount", Math.max(0, intAt(c, "message_count", 0)));
    row.put("snippet", SmsRecords.clip(textAt(c, "snippet"), 160));
    row.put("unread", intAt(c, "read", 1) == 0);
    pending.add(row); recipientIds.add(members);
   }
  }
  java.util.Map<String, String> addresses = canonicalAddresses(resolver, ids, cancel);
  for (int i = 0; i < pending.size(); i++) {
   JSArray people = new JSArray();
   for (String member : recipientIds.get(i)) { String address = addresses.get(member); if (address != null) people.put(SmsRecords.clip(address, 64)); }
   pending.get(i).put("addresses", people);
   rows.put(pending.get(i));
  }
  JSObject value = new JSObject();
  value.put("threads", rows);
  return value;
 }
 private static java.util.Map<String, String> canonicalAddresses(ContentResolver resolver, Set<String> ids, CancellationSignal cancel) {
  java.util.Map<String, String> found = new java.util.HashMap<>();
  if (ids.isEmpty()) return found;
  StringBuilder in = new StringBuilder();
  for (int i = 0; i < ids.size(); i++) in.append(i == 0 ? "?" : ",?");
  try (Cursor c = query(resolver, CANONICAL_ADDRESSES, new String[] { "_id", "address" }, "_id IN (" + in + ")", ids.toArray(new String[0]), null, cancel)) {
   while (c != null && c.moveToNext() && found.size() < ids.size()) found.put(Long.toString(longAt(c, "_id")), textAt(c, "address"));
  }
  return found;
 }

 /** Messages of one thread, newest first, SMS and MMS merged, before an optional date (exclusive, milliseconds). */
 static JSObject messages(Context context, long thread, int limit, long before, CancellationSignal cancel) {
  ContentResolver resolver = context.getContentResolver();
  List<JSObject> all = new ArrayList<>();
  String[] sms = { Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE, Telephony.Sms.TYPE, Telephony.Sms.STATUS, Telephony.Sms.READ, Telephony.Sms.SUBSCRIPTION_ID };
  String smsWhere = Telephony.Sms.THREAD_ID + " = ? AND " + Telephony.Sms.TYPE + " != " + SmsRecords.DRAFT + (before > 0 ? " AND " + Telephony.Sms.DATE + " < ?" : "");
  String[] smsArgs = before > 0 ? new String[] { Long.toString(thread), Long.toString(before) } : new String[] { Long.toString(thread) };
  try (Cursor c = query(resolver, Telephony.Sms.CONTENT_URI, sms, smsWhere, smsArgs, Telephony.Sms.DATE + " DESC", cancel)) {
   int taken = 0;
   while (c != null && c.moveToNext() && taken < limit) {
    cancel.throwIfCanceled();
    int type = intAt(c, Telephony.Sms.TYPE, 0), status = intAt(c, Telephony.Sms.STATUS, SmsSendJournal.STATUS_NONE);
    boolean read = intAt(c, Telephony.Sms.READ, 0) != 0;
    String direction = SmsRecords.direction(type), state = SmsRecords.smsStatus(type, status, read);
    if (direction == null || state == null) continue;
    JSObject row = message(false, longAt(c, Telephony.Sms._ID), thread, direction, state, longAt(c, Telephony.Sms.DATE), read, intAt(c, Telephony.Sms.SUBSCRIPTION_ID, -1));
    JSArray addresses = new JSArray(); String address = textAt(c, Telephony.Sms.ADDRESS); if (address != null) addresses.put(SmsRecords.clip(address, 64));
    row.put("addresses", addresses);
    row.put("body", SmsRecords.clip(textAt(c, Telephony.Sms.BODY), SmsRecords.MAX_BODY));
    String report = SmsRecords.smsDeliveryReport(type, status);
    row.put("deliveryReport", report == null ? JSONObject.NULL : report);
    row.put("attachments", 0);
    all.add(row); taken++;
   }
  }
  String[] mms = { Telephony.Mms._ID, Telephony.Mms.DATE, Telephony.Mms.MESSAGE_BOX, Telephony.Mms.READ, Telephony.Mms.SUBSCRIPTION_ID };
  String mmsWhere = Telephony.Mms.THREAD_ID + " = ? AND " + Telephony.Mms.MESSAGE_BOX + " != " + SmsRecords.DRAFT + (before > 0 ? " AND " + Telephony.Mms.DATE + " < ?" : "");
  String[] mmsArgs = before > 0 ? new String[] { Long.toString(thread), Long.toString((before + 999) / 1000) } : new String[] { Long.toString(thread) };
  List<JSObject> mmsRows = new ArrayList<>();
  try (Cursor c = query(resolver, Telephony.Mms.CONTENT_URI, mms, mmsWhere, mmsArgs, Telephony.Mms.DATE + " DESC", cancel)) {
   while (c != null && c.moveToNext() && mmsRows.size() < limit) {
    cancel.throwIfCanceled();
    int box = intAt(c, Telephony.Mms.MESSAGE_BOX, 0);
    boolean read = intAt(c, Telephony.Mms.READ, 0) != 0;
    String direction = SmsRecords.direction(box), state = SmsRecords.mmsStatus(box, read);
    if (direction == null || state == null) continue;
    long date = SmsRecords.mmsMillis(longAt(c, Telephony.Mms.DATE));
    if (before > 0 && date >= before) continue;
    mmsRows.add(message(true, longAt(c, Telephony.Mms._ID), thread, direction, state, date, read, intAt(c, Telephony.Mms.SUBSCRIPTION_ID, -1)));
   }
  }
  for (JSObject row : mmsRows) { mmsContent(resolver, row, cancel); all.add(row); }
  all.sort((a, b) -> Long.compare(b.optLong("date"), a.optLong("date")));
  JSArray rows = new JSArray();
  for (int i = 0; i < all.size() && i < limit; i++) rows.put(all.get(i));
  JSObject value = new JSObject();
  value.put("messages", rows);
  return value;
 }
 private static JSObject message(boolean mms, long id, long thread, String direction, String status, long date, boolean read, int subscription) {
  JSObject row = new JSObject();
  row.put("id", SmsRecords.messageId(mms, id));
  row.put("kind", mms ? "mms" : "sms");
  row.put("threadId", SmsRecords.threadId(thread));
  row.put("direction", direction);
  row.put("status", status);
  row.put("date", date);
  row.put("read", read);
  row.put("subscriptionId", subscription >= 0 ? (Object) subscription : JSONObject.NULL);
  return row;
 }
 /** Text parts (bounded) and the attachment count of one MMS; attachment bytes are never read. */
 private static void mmsContent(ContentResolver resolver, JSObject row, CancellationSignal cancel) {
  String id = row.optString("id").substring(4);
  StringBuilder body = new StringBuilder(); int attachments = 0;
  try (Cursor c = query(resolver, Uri.parse("content://mms/part"), new String[] { "_id", "ct", "text" }, "mid = ?", new String[] { id }, null, cancel)) {
   int seen = 0;
   while (c != null && c.moveToNext() && seen++ < 32) {
    String type = textAt(c, "ct");
    if ("text/plain".equals(type)) { String text = textAt(c, "text"); if (text != null && body.length() < SmsRecords.MAX_BODY) body.append(body.length() == 0 ? "" : "\n").append(text); }
    else if (type != null && !"application/smil".equals(type)) attachments++;
   }
  }
  JSArray addresses = new JSArray(); String direction = row.optString("direction");
  try (Cursor c = query(resolver, Uri.parse("content://mms/" + id + "/addr"), new String[] { "address", "type" }, null, null, null, cancel)) {
   while (c != null && c.moveToNext() && addresses.length() < SmsRecords.MAX_ADDRESSES) {
    int type = intAt(c, "type", 0); String address = textAt(c, "address");
    // Incoming: the sender. Outgoing: the recipients (to, cc, bcc), never Alpha's own number.
    if (address == null || "insert-address-token".equals(address)) continue;
    if ("incoming".equals(direction) ? type == MMS_FROM : type != MMS_FROM) addresses.put(SmsRecords.clip(address, 64));
   }
  }
  row.put("addresses", addresses);
  row.put("body", SmsRecords.clip(body.toString(), SmsRecords.MAX_BODY));
  row.put("deliveryReport", JSONObject.NULL);
  row.put("attachments", attachments);
 }

 // ---- Sends -----------------------------------------------------------------------------------

 static SmsManager manager(Context context, int subscriptionId) {
  if (android.os.Build.VERSION.SDK_INT >= 31) {
   SmsManager base = context.getSystemService(SmsManager.class);
   if (base == null) throw new IllegalStateException("no SmsManager");
   return base.createForSubscriptionId(subscriptionId);
  }
  return SmsManager.getSmsManagerForSubscriptionId(subscriptionId);
 }

 private static PendingIntent callback(Context context, String action, String operationId, int index) {
  // Explicit component and package, immutable and one-shot: the framework can only report the result code.
  Intent intent = new Intent(action).setClass(context, AlphaSmsSendReceiver.class).setPackage(context.getPackageName())
   .setData(Uri.fromParts("alphaphone-sms", operationId + "/" + index, null))
   .putExtra(EXTRA_OPERATION, operationId).putExtra(EXTRA_INDEX, index);
  return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_ONE_SHOT);
 }

 /**
  * Journals the reviewed send, then submits one message per recipient on the reviewed subscription,
  * divided by the platform. A platform call that throws ends the dispatch as unknown: earlier
  * recipients may have been submitted, so nothing is attempted again automatically.
  */
 static SmsSendJournal.Record dispatch(Context context, SmsSendJournal journal, String operationId, String[] recipients, String body, int subscriptionId, ArrayList<String> parts) throws IOException {
  SmsManager manager = manager(context, subscriptionId);
  int[] counts = new int[recipients.length];
  java.util.Arrays.fill(counts, parts.size());
  SmsSendJournal.Record record = journal.beginDispatch(operationId, recipients, body, subscriptionId, counts, System.currentTimeMillis(), boot(context));
  boolean returned = true;
  try {
   int index = 0;
   for (String recipient : recipients) {
    ArrayList<PendingIntent> sent = new ArrayList<>(), delivered = new ArrayList<>();
    for (int part = 0; part < parts.size(); part++, index++) { sent.add(callback(context, ACTION_SENT, operationId, index)); delivered.add(callback(context, ACTION_DELIVERED, operationId, index)); }
    if (parts.size() == 1) manager.sendTextMessage(recipient, null, parts.get(0), sent.get(0), delivered.get(0));
    else manager.sendMultipartTextMessage(recipient, null, parts, sent, delivered);
   }
  } catch (RuntimeException failed) {
   returned = false;
  } finally {
   journal.endDispatch(operationId, returned);
  }
  return record;
 }

 /** The shared contract's `SmsSendResult`, exactly its fields. */
 static JSObject result(SmsSendJournal.Record record) {
  JSObject value = new JSObject();
  value.put("kind", "sms-send");
  value.put("operationId", record.operationId);
  value.put("subscriptionId", record.subscriptionId);
  value.put("bindingHash", record.bindingHash);
  String status = record.status();
  value.put("status", status);
  JSArray parts = new JSArray();
  if (record.decision == null) for (int i = 0; i < record.parts(); i++) {
   JSObject part = new JSObject();
   part.put("index", i); part.put("recipientIndex", record.recipientOf(i)); part.put("partIndex", record.partOf(i));
   part.put("sent", state(record.sent[i])); part.put("delivery", state(record.delivery[i]));
   parts.put(part);
  }
  value.put("parts", parts);
  value.put("createdAt", record.createdAt);
  return value;
 }
 private static String state(char value) { return value == SmsSendJournal.SUCCESS ? "success" : value == SmsSendJournal.FAILED ? "failed" : "unknown"; }

 /**
  * Matches each sent recipient to the provider row the platform wrote (address, time window and body
  * hash; READ_SMS required) and applies that row's delivery status to parts whose delivery report
  * arrived. Returns the operation IDs that changed.
  */
 static Set<String> reconcile(Context context) {
  Set<String> changed = new HashSet<>();
  try {
   SmsSendJournal journal = journal(context);
   if (journal.reconcile(boot(context), true)) for (SmsSendJournal.Record r : journal.recent(SmsSendJournal.MAX_RECORDS)) changed.add(r.operationId);
   if (!granted(context, Manifest.permission.READ_SMS)) return changed;
   ContentResolver resolver = context.getContentResolver();
   Set<Long> claimed = new HashSet<>();
   for (SmsSendJournal.Record r : journal.recent(SmsSendJournal.MAX_RECORDS)) for (long row : r.providerRow) if (row > 0) claimed.add(row);
   for (SmsSendJournal.Record record : journal.open()) {
    for (int recipient = 0; recipient < record.recipients.length; recipient++) {
     int first = record.firstPart(recipient), count = record.partsPerRecipient[recipient];
     boolean allSent = true, reported = false;
     for (int i = first; i < first + count; i++) { allSent &= record.sent[i] == SmsSendJournal.SUCCESS; reported |= record.reported[i] && record.delivery[i] == SmsSendJournal.UNKNOWN; }
     if (!allSent) continue;
     if (record.providerRow[recipient] == 0) {
      long row = findRow(resolver, record, recipient, claimed);
      if (row > 0) { journal.providerRow(record.operationId, recipient, row); claimed.add(row); }
     }
     if (!reported || record.providerRow[recipient] == 0) continue;
     try (Cursor c = resolver.query(Uri.withAppendedPath(Telephony.Sms.CONTENT_URI, Long.toString(record.providerRow[recipient])), new String[] { Telephony.Sms.STATUS }, null, null, null)) {
      if (c != null && c.moveToFirst() && journal.providerStatus(record.operationId, recipient, intAt(c, Telephony.Sms.STATUS, SmsSendJournal.STATUS_NONE))) changed.add(record.operationId);
     }
    }
   }
  } catch (IOException | RuntimeException unreadable) {
   // Evidence stays as recorded; nothing is inferred from a failed read.
  }
  return changed;
 }
 private static long findRow(ContentResolver resolver, SmsSendJournal.Record record, int recipient, Set<Long> claimed) {
  String where = Telephony.Sms.ADDRESS + " = ? AND " + Telephony.Sms.DATE + " >= ? AND " + Telephony.Sms.TYPE + " IN (2,4,5,6)";
  try (Cursor c = resolver.query(Telephony.Sms.CONTENT_URI, new String[] { Telephony.Sms._ID, Telephony.Sms.BODY }, where,
    new String[] { record.recipients[recipient], Long.toString(record.createdAt - 60_000L) }, Telephony.Sms._ID + " ASC")) {
   int seen = 0;
   while (c != null && c.moveToNext() && seen++ < 20) {
    long id = longAt(c, Telephony.Sms._ID); String body = textAt(c, Telephony.Sms.BODY);
    if (id > 0 && body != null && !claimed.contains(id) && SmsSendJournal.sha256(body).equals(record.bodyHash)) return id;
   }
  }
  return 0;
 }
}
