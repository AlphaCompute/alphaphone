package ai.elizaresearch.alphaphone;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Preserve the installed receiver identity and its PendingIntent routes. Every intent goes to the
 * shared reminder engine, except an alarm for a reminder whose reviewed deletion is pending Undo
 * (policy P-30): that alarm is recorded by {@link ReminderDeliveryHolds} and posted only if the
 * deletion is undone or does not happen.
 */
public final class ReminderReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context, Intent intent) {
  if (intent != null && AlphaReminders.CONFIGURATION.remindAction.equals(intent.getAction())
   && ReminderDeliveryHolds.defer(context, intent.getStringExtra(AlphaReminders.CONFIGURATION.idExtra), intent.getStringExtra(AlphaReminders.CONFIGURATION.occurrenceExtra))) return;
  AlphaReminders.engine(context).dispatch(intent);
 }
}
