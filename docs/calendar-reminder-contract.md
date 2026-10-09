# Calendar and reminder contracts

AlphaPhone owns Calendar presentation and product choices. The pinned upstream
native Calendar and Reminders plugins own provider access and scheduling. Device
calendars require an installed sync provider for account synchronization; a local
calendar or an external editor does not establish a connected account.

## Calendar data and navigation

Calendar access is requested by an explicit user action. Typing an event does not
persist it. Save validates the selected destination and reads back the provider
result; an uncertain write must not be repeated automatically. Selected event
identity does not authorize an assistant to read or mutate its contents.

The renderer queries the visible month and adjacent months, discards superseded
responses, and distinguishes incomplete, loading, denied, stale, and failed data
from an empty day. All-day provider boundaries use UTC calendar dates rather than
local-hour conversion. Initial nonexistent civil times are rejected. See the
[range and text-size contracts](calendar-range-and-text-size.md) for limits and
native verification commands.

A late save or deletion must not close a newer event, a new unsaved form, or a
screen reached through Home. Refreshing provider data remains independent of
that navigation guard. Existing complex events use the explicit external-editor
handoff described in [external Calendar verification](calendar-external-editor-test.md).
That guide owns the editor artifact/signer pins, implicit-intent checks, exact
provider-field readback, and cleanup requirements. AlphaPhone retains its own UI
and visibly identifies the external editor.

## Reminder identity and completion

Once, Daily, Weekdays, and Weekly use native reminders. Repeated reminders retain
a pinned IANA timezone, civil date/time, and separate alert lead. The first
Weekdays occurrence must be a weekday; an initially nonexistent time is rejected.
A future spring gap uses the first valid instant after the gap, and an overlapping
hour uses the earlier offset once. Editing creates a new revision.

There is one unresolved occurrence. Posting or dismissing a notification, opening
the app, rebooting, or re-posting after reboot must not advance recurrence. Done durably records completion
and schedules the next future occurrence; elapsed dates skipped after late
completion are counted as skipped, not completed. Snooze 10 minutes preserves the
occurrence and original due time; repeating a pending snooze does not extend it.
The last 32 completion receipts are retained without discarding an unresolved
current occurrence. [One-off completion](reminder-one-off-completion.md) specifies
the corresponding non-recurring behavior.

Decisions and taps carry occurrence/revision identity. Stale actions cannot
mutate a replacement occurrence; stale taps return to a safe Calendar destination.
Permission-denied occurrences remain visible. Granting permission alone must not
redeliver or advance them; retry requires an explicit action. Malformed neighboring
records remain available for recovery without preventing healthy records from
being restored. Scheduling failure is distinct from durable storage success.

## One-off time zone policy

A one-off reminder is an absolute instant (`dueAt`, epoch milliseconds). It is not
a civil time. When the phone's time zone changes, the reminder keeps the same
instant and alarm; only its rendered wall time and Calendar day follow the new
zone (`reminderEvents` in `apps/app/src/runtime/reminder-creations.ts`). A 09:00 reminder created in New
York shows as 06:00 after moving to Los Angeles and still fires at the same moment.
Repeats are different: they keep their pinned IANA `recurrence.zone` and civil
date/time, as described above. Reschedule a one-off explicitly to keep a local
clock time after travel.

## Refusals, overdue items, reopen and to-dos

`scheduleReminder` resolves stable refusal codes: `past`, `permission-denied`,
`storage-full` and `failed` (patch `0040-reminders-lifecycle`). A full store reports
`storage-full`; it is never reported as `failed`. The renderer shows the specific
reason. It retires the pending creation only after a definite refusal **and** a
readback that confirms the ID is absent (`retireRefusedCreation`). A refused
request is never retried automatically. Refusals therefore do not accumulate toward
the 32-entry pending-creation limit. A saved row with a `permission-denied`
status is found by readback and is not retired.

`overdueReminders()` lists reminders that are due and not done, oldest first:
`posted` rows, and `scheduled` rows whose due instant has passed (delayed or
snoozed). Calendar receives them as an Overdue list.

A completed one-off can be reopened through a reviewed `reminder_update`. The
renderer then reads the reminder back and requires a new open occurrence at the
reviewed due time. "Reopen" keeps it open with no alert. "Reopen tomorrow" alerts
at the original local clock time tomorrow.

Undated to-dos (`reminderTodoVersion` 1) have no `at`, no AlarmManager entry and no
notification. They are listed without a Calendar day and can be completed,
reopened or deleted through the exact reviewed target (`todoDecision`). Reviewed
`operateReminder` operations refuse them. A retried save with the same ID and text
is idempotent.

## Reboot re-post and due channel

Android clears posted notifications on reboot. `restore` re-posts each `posted`
record once per boot (`Settings.Global.BOOT_COUNT`). The re-post uses the same
occurrence, exact target, tap route and Done/Snooze actions, and never advances
recurrence. If a posted notice cannot be re-posted, for example while notifications
are disabled, the boot is not marked and a later restore retries it.

Due reminders post on a separate high-importance channel, `alpha-local-reminders-due`.
The original `alpha-local-reminders` channel is kept. When the due channel is
first created, it keeps an owner's opt-out (a blocked original channel creates a
blocked due channel), sound and vibration. The heads-up check is emulator evidence
only.

## Native verification

Use the [verification guide](verification.md) for owned-emulator configuration,
archived app/test APKs, isolated-user runners, and retained cleanup evidence.
Run `scripts/test-reminder-one-off.mjs` and `scripts/test-reminder-recurrence.mjs`
for both distributions. The latter runs the real alarm/Snooze/visible Done flow
and the civil-time/edit-invalidation flow. Inexact delivery has a bounded native
wait of up to 13 minutes and a 16-minute instrumentation deadline; a skipped test
or a saved schedule is not delivery evidence.

The separate recovery scenarios are `scripts/test-reminder-recovery.mjs` and
`scripts/test-reminder-recurrence-recovery.mjs`. They require their own dedicated
disposable emulator and matching archived APKs. Set `ANDROID_SERIAL`,
`ALPHA_NATIVE_TEST_AVD`, and `ALPHA_NATIVE_TEST_ABI` explicitly, plus
`ALPHA_TEST_HOME_PACKAGE` for a non-default stock HOME. Pass the matching app APK,
instrumentation APK, and a new output directory to each runner. The shared harness
leases the emulator, verifies archived and installed bytes, refuses existing
packages, and scopes installation and permission changes to a fresh secondary
user. Both recovery scenarios read the current reminder envelope and witness the
real permission-denied alarm externally before starting the UI assertion phase.
Before reboot, require a scheduled,
unposted fixture with the package not stopped. Require a changed kernel boot ID
and resume the same fixture user unlocked. Observe only the named fixture's
stored receipt and notification key, including its Android user ID.
Do not start instrumentation, explicitly launch the app, or manually invoke a
restore/boot broadcast before the external delivery witness: instrumentation
startup can stop the package and cancel the alarm being measured. The recurring
permission-denial witness additionally follows the same no-instrumentation rule and must
preserve revision, occurrence, and zero completion advancement. Run the subsequent
Done/stale-action phase and fixture cleanup only after that observation.

Notification posting and receipt persistence are not atomic; these checks do not
establish exactly-once delivery. APK builds, emulator flows, HOME-role boot,
locked-boot/Doze/OEM behavior, live provider integration, a user seeing/hearing an
alert, and physical-device acceptance require distinct evidence. Record current
source and artifact identities; historical runs do not qualify newer APKs.
