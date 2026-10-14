package ai.elizaresearch.alphaphone;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Durable journal of reviewed native SMS sends on the Alpha AOSP image (issue #421). Plain Java so the
 * JVM tests exercise it without Android.
 *
 * The record shape follows the shared device-action contract `sms.send.v1` (elizaOS/eliza PR #36178,
 * `sms-contract.ts`): the operation ID is the execution claim's idempotency key, the binding hash is
 * SHA-256 over the fixed JSON field order of {@link #bindingText}, and status is one of cancelled,
 * denied, failed, unknown, submitted, sent or delivered, with per-part sent and delivery evidence.
 *
 * Rules: a repeated operation ID only reads its record; nothing here ever resends. "submitted" means
 * the platform send call returned. "sent" requires a successful sent callback for every part,
 * "delivered" a delivery report for every part whose provider status reads complete. A record that was
 * being dispatched when the process died, or whose sent callbacks cannot arrive any more because the
 * phone restarted, becomes "unknown". The message body is never stored, only its SHA-256.
 */
final class SmsSendJournal {
 static final int MAX_RECIPIENTS = 5, MAX_BODY = 1600, MAX_PARTS_PER_RECIPIENT = 10, MAX_RECORDS = 200;
 static final Pattern OPERATION = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$");
 static final Pattern NUMBER = Pattern.compile("^\\+?[0-9]{2,20}$");
 static final char UNKNOWN = 'u', SUCCESS = 's', FAILED = 'f';
 /** Provider SMS status column values (android.provider.Telephony.TextBasedSmsColumns). */
 static final int STATUS_NONE = -1, STATUS_COMPLETE = 0, STATUS_PENDING = 32, STATUS_FAILED = 64;

 /** One reviewed send. Public fields are only mutated under the journal's lock. */
 static final class Record {
  final String operationId, bindingHash, bodyHash;
  final int subscriptionId;
  final long createdAt, boot;
  final String[] recipients;
  /** Terminal decision before any dispatch: cancelled or denied. Null otherwise. */
  String decision;
  /** dispatching: persisted before the first platform call; submitted: every call returned. */
  boolean dispatching, submitted, unknown;
  int[] partsPerRecipient;
  char[] sent, delivery;
  boolean[] reported;
  long[] providerRow;
  Record(String operationId, int subscriptionId, String bindingHash, String bodyHash, String[] recipients, long createdAt, long boot) {
   this.operationId = operationId; this.subscriptionId = subscriptionId; this.bindingHash = bindingHash; this.bodyHash = bodyHash;
   this.recipients = recipients; this.createdAt = createdAt; this.boot = boot;
   partsPerRecipient = new int[0]; sent = new char[0]; delivery = new char[0]; reported = new boolean[0]; providerRow = new long[recipients.length];
  }
  int parts() { return sent.length; }
  int recipientOf(int index) { int seen = 0; for (int r = 0; r < partsPerRecipient.length; r++) { seen += partsPerRecipient[r]; if (index < seen) return r; } throw new IndexOutOfBoundsException(); }
  int partOf(int index) { int seen = 0; for (int r = 0; r < partsPerRecipient.length; r++) { if (index < seen + partsPerRecipient[r]) return index - seen; seen += partsPerRecipient[r]; } throw new IndexOutOfBoundsException(); }
  int firstPart(int recipient) { int seen = 0; for (int r = 0; r < recipient; r++) seen += partsPerRecipient[r]; return seen; }
  /** The contract status, derived only from recorded evidence. */
  String status() {
   if (decision != null) return decision;
   boolean anyFailed = false, allSent = parts() > 0, allDelivered = parts() > 0;
   for (int i = 0; i < parts(); i++) {
    if (sent[i] == FAILED) anyFailed = true;
    if (sent[i] != SUCCESS) allSent = false;
    if (delivery[i] != SUCCESS) allDelivered = false;
   }
   if (anyFailed) return "failed";
   if (allSent && partsPerRecipient.length == recipients.length) return allDelivered ? "delivered" : "sent";
   if (unknown || dispatching) return "unknown";
   return submitted ? "submitted" : "unknown";
  }
  /** Further evidence can still change this record. */
  boolean open() {
   if (decision != null) return false;
   for (int i = 0; i < parts(); i++) if (sent[i] == UNKNOWN || (sent[i] == SUCCESS && delivery[i] == UNKNOWN)) return true;
   return false;
  }
 }

 private final File file;
 private final Map<String, Record> records = new LinkedHashMap<>();
 SmsSendJournal(File file) throws IOException { this.file = file; load(); }

 // ---- Validation and binding ------------------------------------------------------------------

 /** Throws IllegalArgumentException unless the request matches `validateSmsSend` in the shared contract. */
 static void validate(String operationId, String[] recipients, String body, int subscriptionId) {
  if (operationId == null || !OPERATION.matcher(operationId).matches()) throw new IllegalArgumentException("operation");
  if (recipients == null || recipients.length < 1 || recipients.length > MAX_RECIPIENTS) throw new IllegalArgumentException("recipients");
  for (int i = 0; i < recipients.length; i++) {
   if (recipients[i] == null || !NUMBER.matcher(recipients[i]).matches()) throw new IllegalArgumentException("recipient");
   for (int j = 0; j < i; j++) if (recipients[j].equals(recipients[i])) throw new IllegalArgumentException("duplicate recipient");
  }
  if (body == null || body.isEmpty() || body.length() > MAX_BODY || body.indexOf('\0') >= 0) throw new IllegalArgumentException("body");
  for (int i = 0; i < body.length(); i++) {
   char c = body.charAt(i);
   if (Character.isHighSurrogate(c)) { if (i + 1 >= body.length() || !Character.isLowSurrogate(body.charAt(i + 1))) throw new IllegalArgumentException("body"); i++; }
   else if (Character.isLowSurrogate(c)) throw new IllegalArgumentException("body");
  }
  if (subscriptionId < 0) throw new IllegalArgumentException("subscription");
 }

 /** Byte-for-byte `JSON.stringify({body, recipients, subscriptionId, type})` of the shared contract. */
 static String bindingText(String[] recipients, String body, int subscriptionId) {
  StringBuilder out = new StringBuilder("{\"body\":");
  json(out, body);
  out.append(",\"recipients\":[");
  for (int i = 0; i < recipients.length; i++) { if (i > 0) out.append(','); json(out, recipients[i]); }
  return out.append("],\"subscriptionId\":").append(subscriptionId).append(",\"type\":\"sms_send\"}").toString();
 }
 private static void json(StringBuilder out, String value) {
  out.append('"');
  for (int i = 0; i < value.length(); i++) {
   char c = value.charAt(i);
   switch (c) {
    case '"': out.append("\\\""); break;
    case '\\': out.append("\\\\"); break;
    case '\b': out.append("\\b"); break;
    case '\f': out.append("\\f"); break;
    case '\n': out.append("\\n"); break;
    case '\r': out.append("\\r"); break;
    case '\t': out.append("\\t"); break;
    default: if (c < 0x20) out.append(String.format("\\u%04x", (int) c)); else out.append(c);
   }
  }
  out.append('"');
 }
 static String sha256(String text) {
  try {
   byte[] digest = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
   StringBuilder hex = new StringBuilder(64);
   for (byte b : digest) hex.append(Character.forDigit((b >> 4) & 15, 16)).append(Character.forDigit(b & 15, 16));
   return hex.toString();
  } catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
 }

 // ---- Lifecycle of one send -------------------------------------------------------------------

 synchronized Record get(String operationId) { return records.get(operationId); }

 /** The existing record for a repeated ID, or null for a new one. A reused ID with different content is refused. */
 synchronized Record existing(String operationId, String bindingHash) {
  Record found = records.get(operationId);
  if (found != null && !found.bindingHash.equals(bindingHash)) throw new IllegalStateException("operation reused");
  return found;
 }

 /** Records an outcome reached without any platform call: the owner cancelled or Android refused it. */
 synchronized Record decide(String operationId, String[] recipients, String body, int subscriptionId, String decision, long now, long boot) throws IOException {
  if (!"cancelled".equals(decision) && !"denied".equals(decision)) throw new IllegalArgumentException("decision");
  Record record = create(operationId, recipients, body, subscriptionId, now, boot);
  record.decision = decision;
  save();
  return record;
 }

 /** Persists the reviewed send before the first platform call, so an interrupted dispatch reads "unknown" and is never repeated. */
 synchronized Record beginDispatch(String operationId, String[] recipients, String body, int subscriptionId, int[] partsPerRecipient, long now, long boot) throws IOException {
  if (partsPerRecipient.length != recipients.length) throw new IllegalArgumentException("parts");
  int total = 0;
  for (int count : partsPerRecipient) { if (count < 1 || count > MAX_PARTS_PER_RECIPIENT) throw new IllegalArgumentException("parts"); total += count; }
  Record record = create(operationId, recipients, body, subscriptionId, now, boot);
  record.partsPerRecipient = partsPerRecipient.clone();
  record.sent = new char[total]; record.delivery = new char[total]; record.reported = new boolean[total];
  java.util.Arrays.fill(record.sent, UNKNOWN); java.util.Arrays.fill(record.delivery, UNKNOWN);
  record.dispatching = true;
  save();
  return record;
 }
 private Record create(String operationId, String[] recipients, String body, int subscriptionId, long now, long boot) {
  validate(operationId, recipients, body, subscriptionId);
  if (records.containsKey(operationId)) throw new IllegalStateException("operation exists");
  prune();
  Record record = new Record(operationId, subscriptionId, sha256(bindingText(recipients, body, subscriptionId)), sha256(body), recipients.clone(), now, boot);
  records.put(operationId, record);
  return record;
 }

 /** Every platform send call returned (submitted), or one threw (the outcome cannot be known). */
 synchronized void endDispatch(String operationId, boolean allReturned) throws IOException {
  Record record = records.get(operationId);
  if (record == null || !record.dispatching) return;
  record.dispatching = false;
  if (allReturned) record.submitted = true; else record.unknown = true;
  save();
 }

 /** A sent PendingIntent result. Only Activity.RESULT_OK (-1) is success. The first answer per part stands. */
 synchronized boolean sentResult(String operationId, int index, boolean ok) throws IOException {
  Record record = records.get(operationId);
  if (record == null || record.decision != null || index < 0 || index >= record.parts() || record.sent[index] != UNKNOWN) return false;
  record.sent[index] = ok ? SUCCESS : FAILED;
  save();
  return true;
 }

 /** A delivery PendingIntent arrived for this part. Its outcome is resolved from the provider status. */
 synchronized boolean deliveryReported(String operationId, int index) throws IOException {
  Record record = records.get(operationId);
  if (record == null || record.decision != null || index < 0 || index >= record.parts() || record.reported[index]) return false;
  record.reported[index] = true;
  save();
  return true;
 }

 /** The provider row the platform wrote for this recipient's message (matched by address, time and body hash). */
 synchronized void providerRow(String operationId, int recipient, long row) throws IOException {
  Record record = records.get(operationId);
  if (record == null || recipient < 0 || recipient >= record.recipients.length || row <= 0 || record.providerRow[recipient] != 0) return;
  record.providerRow[recipient] = row;
  save();
 }

 /**
  * Applies the provider's delivery status to the parts of one recipient whose delivery report has
  * arrived and whose sent callback succeeded. Pending or absent status changes nothing.
  */
 synchronized boolean providerStatus(String operationId, int recipient, int status) throws IOException {
  Record record = records.get(operationId);
  if (record == null || recipient < 0 || recipient >= record.partsPerRecipient.length) return false;
  char outcome = status == STATUS_COMPLETE ? SUCCESS : status >= STATUS_FAILED ? FAILED : UNKNOWN;
  if (outcome == UNKNOWN) return false;
  boolean changed = false;
  int first = record.firstPart(recipient);
  for (int i = first; i < first + record.partsPerRecipient[recipient]; i++)
   if (record.reported[i] && record.sent[i] == SUCCESS && record.delivery[i] == UNKNOWN) { record.delivery[i] = outcome; changed = true; }
  if (changed) save();
  return changed;
 }

 /**
  * Startup and observer reconciliation. A dispatch interrupted by process death and a send whose
  * callbacks can no longer arrive (the phone restarted since) become "unknown". Never resends.
  */
 synchronized boolean reconcile(long boot, boolean dispatchingInThisProcess) throws IOException {
  boolean changed = false;
  for (Record record : records.values()) {
   if (record.dispatching && !dispatchingInThisProcess) { record.dispatching = false; record.unknown = true; changed = true; }
   if (record.decision == null && !record.unknown && record.boot != boot) {
    for (int i = 0; i < record.parts(); i++) if (record.sent[i] == UNKNOWN) { record.unknown = true; changed = true; break; }
   }
  }
  if (changed) save();
  return changed;
 }

 synchronized List<Record> open() {
  List<Record> found = new ArrayList<>();
  for (Record record : records.values()) if (record.open()) found.add(record);
  return found;
 }

 /** The newest records first, at most limit. */
 synchronized List<Record> recent(int limit) {
  List<Record> all = new ArrayList<>(records.values());
  java.util.Collections.reverse(all);
  return all.subList(0, Math.min(limit, all.size()));
 }

 /** Removes the oldest closed records beyond the bound. Open records are kept until they close. */
 private void prune() {
  if (records.size() < MAX_RECORDS) return;
  java.util.Iterator<Record> each = records.values().iterator();
  while (records.size() >= MAX_RECORDS && each.hasNext()) { Record record = each.next(); if (!record.open() && !record.dispatching) each.remove(); }
  if (records.size() >= MAX_RECORDS) throw new IllegalStateException("journal full");
 }

 // ---- Storage: one line per record, atomically replaced ---------------------------------------

 static String encode(Record r) {
  StringBuilder line = new StringBuilder("v1|").append(r.operationId).append('|').append(r.subscriptionId).append('|').append(r.bindingHash).append('|').append(r.bodyHash)
   .append('|').append(r.createdAt).append('|').append(r.boot).append('|').append(String.join(",", r.recipients)).append('|').append(r.decision == null ? "-" : r.decision)
   .append('|').append(r.dispatching ? 1 : 0).append(r.submitted ? 1 : 0).append(r.unknown ? 1 : 0).append('|');
  for (int i = 0; i < r.partsPerRecipient.length; i++) { if (i > 0) line.append(','); line.append(r.partsPerRecipient[i]); }
  line.append('|').append(r.sent.length == 0 ? "-" : new String(r.sent)).append('|').append(r.delivery.length == 0 ? "-" : new String(r.delivery)).append('|');
  if (r.reported.length == 0) line.append('-'); else for (boolean seen : r.reported) line.append(seen ? '1' : '0');
  line.append('|');
  for (int i = 0; i < r.providerRow.length; i++) { if (i > 0) line.append(','); line.append(r.providerRow[i]); }
  return line.toString();
 }
 static Record decode(String line) {
  String[] f = line.split("\\|", -1);
  if (f.length != 15 || !"v1".equals(f[0])) throw new IllegalArgumentException("record");
  String[] recipients = f[7].split(",", -1);
  Record r = new Record(f[1], Integer.parseInt(f[2]), f[3], f[4], recipients, Long.parseLong(f[5]), Long.parseLong(f[6]));
  if (!OPERATION.matcher(r.operationId).matches() || !r.bindingHash.matches("[0-9a-f]{64}") || !r.bodyHash.matches("[0-9a-f]{64}")) throw new IllegalArgumentException("record");
  for (String number : recipients) if (!NUMBER.matcher(number).matches()) throw new IllegalArgumentException("record");
  r.decision = "-".equals(f[8]) ? null : f[8];
  if (r.decision != null && !"cancelled".equals(r.decision) && !"denied".equals(r.decision)) throw new IllegalArgumentException("record");
  if (f[9].length() != 3) throw new IllegalArgumentException("record");
  r.dispatching = f[9].charAt(0) == '1'; r.submitted = f[9].charAt(1) == '1'; r.unknown = f[9].charAt(2) == '1';
  if (!f[10].isEmpty()) { String[] counts = f[10].split(","); r.partsPerRecipient = new int[counts.length]; for (int i = 0; i < counts.length; i++) r.partsPerRecipient[i] = Integer.parseInt(counts[i]); }
  r.sent = "-".equals(f[11]) ? new char[0] : f[11].toCharArray();
  r.delivery = "-".equals(f[12]) ? new char[0] : f[12].toCharArray();
  r.reported = new boolean[r.sent.length];
  if (!"-".equals(f[13])) { if (f[13].length() != r.sent.length) throw new IllegalArgumentException("record"); for (int i = 0; i < r.reported.length; i++) r.reported[i] = f[13].charAt(i) == '1'; }
  int total = 0; for (int count : r.partsPerRecipient) total += count;
  if (total != r.sent.length || r.delivery.length != r.sent.length || (r.partsPerRecipient.length != 0 && r.partsPerRecipient.length != recipients.length)) throw new IllegalArgumentException("record");
  for (int i = 0; i < r.sent.length; i++) if ("usf".indexOf(r.sent[i]) < 0 || "usf".indexOf(r.delivery[i]) < 0) throw new IllegalArgumentException("record");
  String[] rows = f[14].split(",", -1);
  if (rows.length != recipients.length) throw new IllegalArgumentException("record");
  for (int i = 0; i < rows.length; i++) r.providerRow[i] = Long.parseLong(rows[i]);
  return r;
 }
 private void load() throws IOException {
  if (!file.exists()) return;
  // A damaged journal is an error, never an empty one: an empty journal would allow a resend.
  for (String line : new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8).split("\n")) {
   if (line.isEmpty()) continue;
   Record record = decode(line);
   records.put(record.operationId, record);
  }
 }
 private void save() throws IOException {
  StringBuilder out = new StringBuilder();
  for (Record record : records.values()) out.append(encode(record)).append('\n');
  File temp = new File(file.getPath() + ".tmp");
  try (FileOutputStream stream = new FileOutputStream(temp)) { stream.write(out.toString().getBytes(StandardCharsets.UTF_8)); stream.getFD().sync(); }
  if (!temp.renameTo(file)) { Files.move(temp.toPath(), file.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING, java.nio.file.StandardCopyOption.ATOMIC_MOVE); }
 }
}
