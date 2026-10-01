package ai.elizaresearch.alphaphone;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Explicit alarm delivery plus system reboot/package-update recovery. */
public final class ReminderReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context, Intent intent) {
  String action = intent.getAction();
  if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) || Intent.ACTION_TIME_CHANGED.equals(action) || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) ReminderStore.restore(context);
  else if ("ai.elizaresearch.alphaphone.REMIND".equals(action)) ReminderStore.deliver(context, intent.getStringExtra(ReminderStore.OPEN_ID),intent.getStringExtra(ReminderStore.OCCURRENCE));
  else if("ai.elizaresearch.alphaphone.REMINDER_DECISION".equals(action))try{ReminderStore.decide(context,intent.getStringExtra(ReminderStore.OPEN_ID),intent.getStringExtra(ReminderStore.OCCURRENCE),intent.getStringExtra("decision"));}catch(RuntimeException|org.json.JSONException ignored){/* Persisted occurrence remains visible; no fabricated receipt. */}
 }
}
