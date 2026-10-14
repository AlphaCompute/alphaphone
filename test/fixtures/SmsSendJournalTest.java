package ai.elizaresearch.alphaphone;

import java.io.File;
import java.nio.file.Files;

/** JVM checks of the reviewed-SMS journal and provider mapping (#421). No SIM, radio or provider. */
public final class SmsSendJournalTest {
 static void require(boolean yes, String what) { if (!yes) throw new AssertionError(what); }
 static void throwsOn(Runnable action, String what) { try { action.run(); } catch (RuntimeException expected) { return; } throw new AssertionError(what); }
 public static void main(String[] args) throws Exception {
  String expectedHash = args[0];
  File dir = Files.createTempDirectory("alpha-sms-journal").toFile();
  File file = new File(dir, "journal");
  String[] one = { "+15555550100" }, two = { "+15555550100", "5550101" };

  // Binding text is byte-identical to the shared contract's JSON.stringify (hash computed in Node).
  String body = "Running late \"5\" min\né😀\t\u0001";
  require(SmsSendJournal.sha256(SmsSendJournal.bindingText(two, body, 3)).equals(expectedHash), "binding hash matches JSON.stringify");

  // Validation follows validateSmsSend: 1..5 distinct numbers, 1..1600 chars, no NUL or lone surrogate.
  throwsOn(() -> SmsSendJournal.validate("op-1", new String[0], "x", 1), "no recipient");
  throwsOn(() -> SmsSendJournal.validate("op-1", new String[] { "1", "2", "3", "4", "5", "6" }, "x", 1), "too many");
  throwsOn(() -> SmsSendJournal.validate("op-1", new String[] { "+15555550100", "+15555550100" }, "x", 1), "duplicate");
  throwsOn(() -> SmsSendJournal.validate("op-1", new String[] { "*#06#" }, "x", 1), "MMI");
  throwsOn(() -> SmsSendJournal.validate("op-1", one, "", 1), "empty");
  throwsOn(() -> SmsSendJournal.validate("op-1", one, "a\0b", 1), "NUL");
  throwsOn(() -> SmsSendJournal.validate("op-1", one, "a\ud800b", 1), "lone surrogate");
  throwsOn(() -> SmsSendJournal.validate("op-1", one, "x".repeat(1601), 1), "long");
  throwsOn(() -> SmsSendJournal.validate("-op", one, "x", 1), "operation id");
  throwsOn(() -> SmsSendJournal.validate("op-1", one, "x", -1), "subscription");
  SmsSendJournal.validate("op-1", one, "x".repeat(1600), 0);

  SmsSendJournal journal = new SmsSendJournal(file);
  // Cancelled and denied: no parts, and a repeated ID reads the record.
  SmsSendJournal.Record cancelled = journal.decide("cancel-1", one, "hi", 1, "cancelled", 1000, 7);
  require("cancelled".equals(cancelled.status()) && cancelled.parts() == 0, "cancelled");
  String hash = SmsSendJournal.sha256(SmsSendJournal.bindingText(one, "hi", 1));
  require(journal.existing("cancel-1", hash) == cancelled, "a repeated ID returns the stored record");
  throwsOn(() -> journal.existing("cancel-1", SmsSendJournal.sha256(SmsSendJournal.bindingText(one, "other", 1))), "reused ID with other content is refused");
  throwsOn(() -> { try { journal.decide("cancel-1", one, "hi", 1, "denied", 1, 7); } catch (java.io.IOException e) { throw new RuntimeException(e); } }, "an ID is recorded once");

  // A multipart send to two recipients: submitted only after every call returned.
  SmsSendJournal.Record r = journal.beginDispatch("send-1", two, body, 3, new int[] { 2, 2 }, 2000, 7);
  require("unknown".equals(r.status()), "dispatch in progress is not reported as submitted");
  journal.endDispatch("send-1", true);
  require("submitted".equals(r.status()), "submitted");
  require(r.recipientOf(2) == 1 && r.partOf(2) == 0 && r.partOf(3) == 1 && r.firstPart(1) == 2, "part order");
  journal.sentResult("send-1", 0, true); journal.sentResult("send-1", 1, true); journal.sentResult("send-1", 2, true);
  require("submitted".equals(r.status()), "sent requires every part");
  require(!journal.sentResult("send-1", 0, false), "the first sent answer per part stands");
  journal.sentResult("send-1", 3, true);
  require("sent".equals(r.status()), "sent after every sent callback");
  // Delivery: a report alone is not an outcome; the provider status decides, per recipient.
  journal.deliveryReported("send-1", 0); journal.deliveryReported("send-1", 1);
  require(!journal.providerStatus("send-1", 0, SmsSendJournal.STATUS_PENDING), "pending status changes nothing");
  journal.providerStatus("send-1", 0, SmsSendJournal.STATUS_COMPLETE);
  journal.providerStatus("send-1", 1, SmsSendJournal.STATUS_COMPLETE);
  require("sent".equals(r.status()) && r.delivery[2] == SmsSendJournal.UNKNOWN, "no delivery without that part's report");
  journal.deliveryReported("send-1", 2); journal.deliveryReported("send-1", 3);
  journal.providerStatus("send-1", 1, SmsSendJournal.STATUS_COMPLETE);
  require("delivered".equals(r.status()), "delivered after every report");

  // A failed part makes the send failed; never retried.
  SmsSendJournal.Record f = journal.beginDispatch("send-2", one, "x", 3, new int[] { 1 }, 3000, 7);
  journal.endDispatch("send-2", true); journal.sentResult("send-2", 0, false);
  require("failed".equals(f.status()) && !f.open(), "failed is closed");
  // Delivery failure is recorded in the part, the send stays sent.
  SmsSendJournal.Record d = journal.beginDispatch("send-3", one, "y", 3, new int[] { 1 }, 3000, 7);
  journal.endDispatch("send-3", true); journal.sentResult("send-3", 0, true); journal.deliveryReported("send-3", 0);
  journal.providerStatus("send-3", 0, SmsSendJournal.STATUS_FAILED);
  require("sent".equals(d.status()) && d.delivery[0] == SmsSendJournal.FAILED, "delivery failure");
  // A platform call that threw: unknown.
  SmsSendJournal.Record u = journal.beginDispatch("send-4", two, "z", 3, new int[] { 1, 1 }, 4000, 7);
  journal.endDispatch("send-4", false);
  require("unknown".equals(u.status()), "a throwing dispatch is unknown");
  // Interrupted mid-dispatch (process death) and sends whose callbacks were lost to a restart.
  journal.beginDispatch("send-5", one, "w", 3, new int[] { 1 }, 5000, 7);
  SmsSendJournal.Record waiting = journal.beginDispatch("send-6", one, "v", 3, new int[] { 1 }, 5000, 7);
  journal.endDispatch("send-6", true);

  // Durable: reload from disk, as a new process would.
  SmsSendJournal reloaded = new SmsSendJournal(file);
  require("unknown".equals(reloaded.get("send-5").status()), "still dispatching on disk reads unknown");
  reloaded.reconcile(7, false);
  require(!reloaded.get("send-5").dispatching && reloaded.get("send-5").unknown, "interrupted dispatch reconciled to unknown");
  require("submitted".equals(reloaded.get("send-6").status()), "same boot: callbacks may still arrive");
  reloaded.reconcile(8, true);
  require("unknown".equals(reloaded.get("send-6").status()), "after a restart, missing sent callbacks are unknown");
  require("delivered".equals(reloaded.get("send-1").status()) && "failed".equals(reloaded.get("send-2").status()) && "cancelled".equals(reloaded.get("cancel-1").status()), "states survive reload");
  require(reloaded.get("send-1").bindingHash.equals(expectedHash), "binding persisted");
  String stored = new String(Files.readAllBytes(file.toPath()), "UTF-8");
  require(!stored.contains("Running late") && !stored.contains("\"5\""), "the body is never stored");
  // A damaged journal is an error, never an empty journal that would allow a resend.
  Files.write(file.toPath(), "v1|broken\n".getBytes("UTF-8"));
  throwsOn(() -> { try { new SmsSendJournal(file); } catch (java.io.IOException e) { throw new RuntimeException(e); } }, "damaged journal refused");

  // Provider mapping.
  require("incoming".equals(SmsRecords.direction(SmsRecords.INBOX)) && "outgoing".equals(SmsRecords.direction(SmsRecords.OUTBOX)) && SmsRecords.direction(SmsRecords.DRAFT) == null, "direction");
  require("received".equals(SmsRecords.smsStatus(1, -1, false)) && "read".equals(SmsRecords.smsStatus(1, -1, true)), "incoming status");
  require("pending".equals(SmsRecords.smsStatus(4, -1, true)) && "pending".equals(SmsRecords.smsStatus(6, -1, true)) && "failed".equals(SmsRecords.smsStatus(5, -1, true)), "outgoing status");
  require("sent".equals(SmsRecords.smsStatus(2, -1, true)) && "sent".equals(SmsRecords.smsStatus(2, 32, true)) && "delivered".equals(SmsRecords.smsStatus(2, 0, true)) && "sent".equals(SmsRecords.smsStatus(2, 64, true)), "delivered only from a complete report");
  require("failed".equals(SmsRecords.smsDeliveryReport(2, 64)) && "none".equals(SmsRecords.smsDeliveryReport(2, -1)) && SmsRecords.smsDeliveryReport(1, 0) == null, "delivery report");
  require("sent".equals(SmsRecords.mmsStatus(2, true)) && SmsRecords.mmsStatus(3, true) == null, "MMS never claims delivery; drafts skipped");
  require("sms:5".equals(SmsRecords.messageId(false, 5)) && "mms:5".equals(SmsRecords.messageId(true, 5)), "stable IDs");
  require(SmsRecords.threadRow("thread:12") == 12 && SmsRecords.threadRow("thread:0") == -1 && SmsRecords.threadRow("thread:1 OR 1=1") == -1 && SmsRecords.threadRow(null) == -1, "thread IDs");
  require(SmsRecords.clip("ab😀", 3).equals("ab"), "clip keeps surrogate pairs whole");
  require(SmsRecords.mmsMillis(1700000000L) == 1700000000000L, "MMS seconds");
  for (File each : dir.listFiles()) each.delete(); dir.delete();
  System.out.println("PASS sms send journal");
 }
}
