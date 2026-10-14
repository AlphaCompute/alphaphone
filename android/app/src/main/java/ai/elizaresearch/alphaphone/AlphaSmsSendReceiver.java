package ai.elizaresearch.alphaphone;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Receives the sent and delivery PendingIntents of reviewed native SMS sends (issue #421). Declared,
 * not exported, only in the launcher manifest; every broadcast is ignored unless the AOSP image
 * capability holds. Being in the manifest, callbacks still reach the journal after Alpha's process
 * has been stopped, so a send is not misreported because the app was closed.
 *
 * "sent" is recorded only from a sent callback whose result is Activity.RESULT_OK. A delivery callback
 * only records that a report arrived; its outcome is the provider status the platform wrote from it.
 */
public final class AlphaSmsSendReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context, Intent intent) {
  if (intent == null || !AlphaImageCapability.verified(context)) return;
  String action = intent.getAction(), operation = intent.getStringExtra(AlphaSms.EXTRA_OPERATION);
  int index = intent.getIntExtra(AlphaSms.EXTRA_INDEX, -1);
  boolean sent = AlphaSms.ACTION_SENT.equals(action), delivered = AlphaSms.ACTION_DELIVERED.equals(action);
  if ((!sent && !delivered) || operation == null || !SmsSendJournal.OPERATION.matcher(operation).matches() || index < 0) return;
  final boolean ok = getResultCode() == Activity.RESULT_OK;
  final Context app = context.getApplicationContext();
  final PendingResult pending = goAsync();
  try {
   AlphaSms.WORK.execute(() -> {
    try {
     SmsSendJournal journal = AlphaSms.journal(app);
     boolean changed = sent ? journal.sentResult(operation, index, ok) : journal.deliveryReported(operation, index);
     java.util.Set<String> reconciled = AlphaSms.reconcile(app);
     if (changed || reconciled.contains(operation)) AlphaSms.updated(operation);
     for (String other : reconciled) if (!other.equals(operation)) AlphaSms.updated(other);
    } catch (Exception unrecorded) {
     // The journal keeps its last durable evidence; the send stays unconfirmed rather than guessed.
    } finally {
     pending.finish();
    }
   });
  } catch (java.util.concurrent.RejectedExecutionException closed) { pending.finish(); }
 }
}
