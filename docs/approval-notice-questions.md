# Ask Alpha about a workflow approval notice

Own workflow approval notices now offer **Ask Alpha** alongside their ordinary
open behavior. Ask opens the existing excerpt review; the user may edit the
excerpt, choose **Use in conversation**, and then send the resulting draft.
It does not approve, deny, retry, or run the waiting workflow step.

The question contains only the redacted title and body already shown in that
notification. It does not disclose the pending operation's private details.
Android requires unlock for the action on supported versions, and the native
bridge independently requires an unlocked foreground activity.

The opaque PendingIntent resolves through the encrypted workflow route and its
owner-bound delivery receipt. Capture and consumption refuse expired approval
questions. Withdrawing the approval or changing owners invalidates the action.
After process recreation, the queued question is revalidated against its live
notice and authenticated workflow/run before review. Explicit Cancel returns the
question to its untapped state while leaving the approval waiting. A missing
notice cannot supply an excerpt; the ordinary route still fails safely if the
workflow or run has disappeared.

Local JVM regressions cover persistence, owner changes, expiry, withdrawal,
Cancel and no replay. Android instrumentation covers the action, redacted excerpt,
Cancel preserving the approval, and cancellation of both old PendingIntents.
These checks do not establish physical-device notification acceptance.

## Remaining issue #449 work

The Calendar/reminder lane uses shared Eliza code, not `WorkflowNoticePoster`:

- `plugins/plugin-native-reminders/android/src/main/java/ai/eliza/plugins/reminders/ReminderStore.java`
  publishes due notices and owns their existing Done/Snooze actions.
- `ReminderConfiguration.java` defines action/URI namespaces and fingerprinted
  ownership. Extend it with an optional question action without changing old
  clients' default behavior or sharing PendingIntent identities with decisions.
- `ReminderTaps.java`, `ReminderEngine.java` and `ReminderPlugin.java` own durable
  occurrence routes and their capture/consume boundary. Add an explicit question
  purpose, preserving recurrence/occurrence identity and never calling `decide`.
- Alpha's `AlphaReminders.java` supplies the product configuration. Its reminder
  renderer adapter must re-read the exact current reminder/source revision before
  showing the same excerpt review and before composing; deleted, rescheduled,
  completed or differently owned targets must not contribute stale content.

Calendar notices published by Android's Calendar provider belong to that system
publisher. Extending their notification actions requires the admitted AOSP
Calendar integration; generic external notification content is not an authorized
substitute for an Alpha-owned, source-bound question.

Review those upstream changes, consume the reviewed pin, and execute the existing
missing-target, process-death, recurrence and owner/account campaigns. Issue #449
remains open until those publishers and actual Android acceptance are covered.
