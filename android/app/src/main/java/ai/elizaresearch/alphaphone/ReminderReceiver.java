package ai.elizaresearch.alphaphone;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Preserve the installed receiver identity and its PendingIntent routes. Dispatches exactly as the
 * shared {@code ai.eliza.plugins.reminders.ReminderReceiver} does (its onReceive is final), with one
 * addition: while "Reset Alpha data" is pending, an alarm or a boot/time broadcast posts and re-arms
 * nothing.
 */
public final class ReminderReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context, Intent intent) {
  if (AlphaDataReset.blocked(context)) return;
  AlphaReminders.engine(context).dispatch(intent);
 }
}
