package ai.elizaresearch.alphaphone;

import ai.eliza.plugins.notifications.NotificationMirror;
import ai.eliza.plugins.notifications.NotificationMirrorListenerService;
import android.service.notification.StatusBarNotification;

/** Keeps the installed Android component identity and the process-wide mirror. */
public final class AlphaNotificationListener extends NotificationMirrorListenerService {
 @Override protected NotificationMirror mirror() { return NotificationAccess.MIRROR; }
 // A reset disables this component; these guards cover a late bind or event before Android unbinds it.
 @Override public void onListenerConnected() {
  if (AlphaDataReset.blocked(this)) { try { requestUnbind(); } catch (RuntimeException ignored) { /* already unbound */ } return; }
  super.onListenerConnected();
 }
 @Override public void onNotificationPosted(StatusBarNotification notice) { if (!AlphaDataReset.blocked(this)) super.onNotificationPosted(notice); }
 @Override public void onNotificationRemoved(StatusBarNotification notice) { if (!AlphaDataReset.blocked(this)) super.onNotificationRemoved(notice); }
}
