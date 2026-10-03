# Native calendar and reminder audit

## October 3: late deletion preserves newer navigation

A rendered negative control on `8fb1293` reproduced deletion of event A closing the subsequently selected event B. The provider mutation still targeted A; no wrong-target deletion was observed. The adapter now closes a detail only while A remains selected, Calendar remains active/visible and no new form exists. Provider data refresh remains independent of this navigation guard.

All six rendered deletion/save completion flows pass: newer event, Home, and unsaved form retention, plus the existing save-completion cases. The deletion fixtures verify exactly one remove call and that only B remains in durable Calendar data. TypeScript and the renderer build pass. Evidence: `test-results/calendar-delete-completion/{before,after.log,build.log}`. New full repository, Android/native and live-provider qualification remain pending; this is not full MVP acceptance.

Source review on 2026-09-30; findings are not emulator acceptance results.

## Scoped remediation prepared

- A reminder blocked at delivery by notification permission/channel settings used to disappear: native storage retained `permission-denied`, but the renderer filtered it out. The existing calendar detail now retains it with an explicit failed-delivery explanation. Edit → choose a future time → Save is the retry path; restoring permission alone never silently redelivers it. No new screen is introduced.
- Restore used one catch around the complete batch. Each stored reminder now restores independently; malformed records remain stored for investigation without hiding healthy records or preventing their alarms from being restored.
- New `ReminderRecoveryInstrumentedTest` and `scripts/test-reminder-recovery.mjs` coordinate real permission revoke/grant across separate processes, visible retained detail after Activity recreation, explicit existing-form retry, and an actual emulator reboot. The reboot verification does not explicitly open MainActivity or manually invoke recovery. Android may automatically launch the HOME distribution during boot, so that variant verifies product reboot recovery rather than isolating the broadcast receiver. It checks the real OS notification and a changed kernel boot ID. The fixture introduces one malformed neighboring record and removes only its own data afterward. Run separately for both distributions with matching archived app/test APKs. Source preparation does not establish these tests passed.

## Remaining concrete gaps

1. `calendar-adapter.ts` maps all-day UTC boundaries through local hours; western time zones show the previous calendar date. `model.js` does not consume `allDay` and lays out a 24-hour timed block. All-day boundaries need calendar-date semantics and a compact all-day presentation consistent with the prototype.
2. Original calendar/reminder conversion silently normalized a requested New York 2027-03-14 02:30 to 03:30. The reminder adapter now rejects invalid civil-time roundtrips before native calls; the coordinated calendar patch adds the equivalent start/end guard. `test-reminder-time-flow.mjs` passed the real adapter boundary fixture (invalid time makes zero native calls, valid neighbor makes one). Fall-back repeated times still need an explicit offset policy; native DST acceptance remains pending.
3. Native notification/scheduling exceptions retain unresolved schedules but have no bounded retry worker. Plugin load, reboot and package replacement are recovery opportunities; a failure while the app remains open can stay unresolved. Do not claim delivery from a scheduled receipt.
4. Reminder timestamps currently represent fixed instants, not floating local-time rules. Recurring reminders are explicitly unsupported. A timezone change must update displayed local times without silently changing stored instants. There is no dedicated timezone-change renderer refresh while continuously foregrounded.
5. Calendar loading is a bounded date range (31 days back, 335 days forward, 2,000 instances). Navigating outside it currently lacks a range-specific empty-state explanation.

## Verification boundaries and next flow checks

Existing native tests cover real calendar save/edit, concurrent-write conflict protection, Activity recreation, an actual inexact reminder notification, and notification tap into its exact context. They do not by themselves prove process restart, reboot, DST or permission-revocation behavior. Alarms are deliberately inexact and disclose battery-policy delays; lack of exact-alarm permission is not itself a defect.

Next checks: run the new recovery runner on standalone and launcher; then use disposable CalendarProvider all-day/DST fixtures and verify displayed dates plus actual saved epochs. Change emulator timezone with a pending reminder and verify its epoch stays fixed, refreshes local display, and posts at the same instant. Keep actual device/Doze timing acceptance separate from emulator results.

## Build43 reboot harness correction

Standalone prepare, actual permission-denied delivery, retained UI/recreation, explicit UI retry, and reboot preparation passed. A changed kernel boot ID proved an actual reboot, but the following instrumentation phase timed out without a posted receipt. This result is not a passing reboot test.

The verification itself interfered with recovery: Android 16's `ActivityManagerService.startInstrumentation` calls `forceStopPackageLocked` for normal instrumentation startup; only the `noRestart` path avoids that operation. See [AOSP ActivityManagerService](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/android16-release/services/core/java/com/android/server/am/ActivityManagerService.java). This establishes a harness flaw, not definitive proof that it was the only cause of the failed run.

The corrected runner performs no instrumentation or explicit app launch between reboot and the delivery witness. It reads the two specifically named preference files through debug `run-as`, extracts only the known fixture's status/timestamps, and matches its exact package/ID/tag from `cmd notification list` (which returns keys, not notification bodies; see [AOSP NotificationShellCmd](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/android16-release/services/core/java/com/android/server/notification/NotificationShellCmd.java)). Evidence retains only the fixture ID, selected status/timestamps, package stopped flag, boot IDs, and a boolean matching-notification result. It verifies the fixture is scheduled/unposted and the package is not stopped before reboot. Cleanup instrumentation starts only after the external witness has passed or failed. The old instrumentation verification phase now rejects invocation to prevent repeating this measurement error.

Runner syntax and fixture-scoped parsing checks passed. The corrected real reboot runs subsequently passed for both archived build44 distributions; see the exact evidence below.


## Corrected build44 emulator evidence

Both runs passed all six phases: prepare, permission-denied delivery, explicit retry, prepare-reboot, external reboot verification, and cleanup. The failed reminder remained visible after Activity recreation; retry used the existing Calendar Edit → Tomorrow → Save form and retained its native ID. Permission restoration alone did not redeliver the blocked reminder. Each reboot changed the kernel boot ID, then produced both a persisted `posted` receipt with `postedAt >= at` and the exact fixture notification key, without post-reboot instrumentation or an explicit Activity launch. The malformed neighboring fixture remained intact without preventing recovery.

| Distribution artifact | APK SHA-256 | Matching test APK SHA-256 | Result |
| --- | --- | --- | --- |
| build44 standalone-debug.apk | `d3972911df7ec2853734463d37ff7e738f5019dd2cfff4bae7aa5b7aad95d24c` | `387bc6059bc3771418d4aca45b5dfe54b95df6f83ca81891b5c9ce92930bc72a` | [Saved evidence](../test-results/prototype-build44/reminder-standalone/result.json) |
| build44 launcher-debug.apk | `644adc0a12d042dd08938bc4f22145e54270f2d21a531ca9d96b7dafc7507900` | `92e432e8dca770ff80c1e999c07de8c1b65c1ce01dc233935acf17826e2d460d` | [Saved evidence](../test-results/prototype-build44/reminder-launcher/result.json) |

These are two distribution-package runs on `emulator-5554`. The runner installed the launcher APK but did **not** assign or verify the HOME role: this evidence does not establish launcher-role boot behavior. It also does not establish locked-boot delivery, physical device/OEM behavior, Doze timing, channel-disable recovery, a user seeing/hearing the alert, or recovery from the notification/receipt crash window. Calendar all-day/DST acceptance is tracked separately.

## Existing-event handoff gap and Etar candidate (2026-09-30)

The parent’s Pixel emulator check found no Activity for `ACTION_VIEW content://com.android.calendar/events/1`. `AlphaCalendarPlugin.open` currently sends this standard event URI with instance begin/end extras, then reports only that `startActivity` returned; missing handlers reject honestly. `CalendarFlowInstrumentedTest` intercepts the intent with an ActivityMonitor and cancels it. That checks the outbound contract, **not** actual external Calendar UI, editing or return. The missing installed editor remains an acceptance gap.

**Recommended candidate for a disposable-device test: Etar 1.0.57 / versionCode 57, package `ws.xsoh.etar`.** The [official release](https://github.com/Etar-Group/Etar-Calendar/releases/tag/v1.0.57) was published July 27, 2026; GitHub release metadata lists no binary assets. Source commit is `dcc308671852a7ac7f0f3bf096ef2dab580e7b43`. The [tagged README](https://github.com/Etar-Group/Etar-Calendar/blob/v1.0.57/README.md) identifies its AOSP Calendar lineage, GPLv3 license (except separately noted components), offline CalendarProvider support and external sync-adapter requirement. Preserve notices/source obligations if shipping or modifying it; using a separate external editor does not require importing its UI into Alpha’s renderer.

The [tagged build configuration](https://github.com/Etar-Group/Etar-Calendar/blob/v1.0.57/app/build.gradle.kts) declares minSdk23, target/compile37 and no Play Services dependency. AndroidX/Material are application libraries, not a GMS account requirement. Thus API35 is eligible by declared minSdk, but actual API35 launch/edit acceptance is still untested. Etar can operate on Alpha’s device-local calendar without Google login or a sync account. Installing Etar alone does not implement Google/CalDAV synchronization.

The project README links its [F-Droid package](https://f-droid.org/packages/ws.xsoh.etar/), which lists 1.0.57 added July31 and describes the APK as **built and signed by F-Droid**. The [official F-Droid build log](https://f-droid.org/repo/ws.xsoh.etar_57.log.gz) confirms source commit `dcc308671852a7ac7f0f3bf096ef2dab580e7b43`. Candidate binary URL: `https://f-droid.org/repo/ws.xsoh.etar_57.apk`; detached signature is the same URL plus `.asc`. This is the project-linked distribution, not an upstream developer-signed GitHub APK. Keep that signer lineage when upgrading; do not overwrite another distribution’s differently signed installation.

### Published artifact pin (metadata read only)

The official [F-Droid repository index](https://f-droid.org/repo/index-v1.jar), read over HTTPS during this audit, publishes:

| Field | Value |
| --- | --- |
| APK | `ws.xsoh.etar_57.apk` |
| Bytes | `9226697` |
| APK SHA-256 | `dae01d93c8920aa63845868db2190bcc4aa6ff8410b1289de1ce27b1bb89c599` |
| Published signer SHA-256 | `3f3176c3ce189c98054ff9e1d32daecf00a41572f4c7bd2b2f80607252ddb06e` |
| minSdk / targetSdk | `23` / `37` |
| Source archive | `ws.xsoh.etar_57_src.tar.gz` |

The index declares no native ABI restriction. These are published metadata values, not locally verified APK bytes or certificates: **no APK was downloaded, installed or launched**, and the repository index JAR signature was not independently validated in this read-only research. A later installation step must verify both actual APK digest and signing certificate against the pins above and retain provenance evidence.

### Contract compatibility

The [tagged manifest](https://github.com/Etar-Group/Etar-Calendar/blob/v1.0.57/app/src/main/AndroidManifest.xml) exports `com.android.calendar.EventInfoActivity` for VIEW and `vnd.android.cursor.item/event`, and the alias `com.android.calendar.EditEventActivity` for EDIT/INSERT with item/directory event MIME types. [EventInfoActivity](https://github.com/Etar-Group/Etar-Calendar/blob/v1.0.57/app/src/main/java/com/android/calendar/EventInfoActivity.java) reads the URI’s final event ID and `EXTRA_EVENT_BEGIN_TIME` / `EXTRA_EVENT_END_TIME`; [EditEventActivity](https://github.com/Etar-Group/Etar-Calendar/blob/v1.0.57/app/src/main/java/com/android/calendar/event/EditEventActivity.java) reads the same identity/times. This matches the [Android Calendar intent contract](https://developer.android.com/identity/providers/calendar-provider#intents). The content provider resolves the event MIME type for the implicit intent; verify this with an **existing fixture row**, not a guessed ID that may not exist. Alpha currently sends VIEW, so expected first destination is details with an explicit user Edit action, not automatic mutation.

### Concrete verification plan (not yet executed)

1. Download only the pinned project-linked F-Droid APK after artifact metadata verification; check SHA-256, `apksigner verify --print-certs`, package/version/minSdk, and record both APK and signer hashes. On the disposable Pixel API35 emulator, check for a pre-existing `ws.xsoh.etar` installation/signature before installing. No accounts, sync adapter, network configuration or global default changes are needed.
2. Launch Etar normally and grant Calendar read/write through its real permission UI. Keep contacts/notifications denied unless the tested operation explicitly needs them. Confirm an Alpha-created local calendar is readable; do not create a Google account or use customer calendars.
3. Use a matching archived Alpha app/test APK pair and a unique local CalendarProvider fixture. Exercise a recurring/complex existing event and both sides of a DST repeated hour with explicit instance begin/end instants. Preserve original title, epoch, recurrence, timezone and attendee fields for fixture-scoped before/after checks. Resolve VIEW with the actual event URI and provider MIME, and EDIT separately as diagnostics; do not bypass a failed implicit Alpha handoff by forcing a component in the acceptance path.
4. Tap Alpha’s existing event editor-handoff control, **without ActivityMonitor interception**. Require foreground package `ws.xsoh.etar`, rendered unique fixture title, correct instance date/time and an actual enabled Edit control. Cancel/back must preserve every fixture field and return to Alpha’s original event. Repeat and explicitly edit a harmless fixture title through Etar Save; verify the same provider event/instance identity and updated title, then return to Alpha and verify reloaded data. Recurrence scope choice must be explicit; DST-fold exact epoch must survive cancel and a title-only edit.
5. Test permission denial/revocation and missing-handler behavior, plus recreation/return. Delete only fixture-owned rows and restore prior permissions/default handlers/install state. Run both Alpha distributions; launcher installation alone does not prove HOME-role behavior. Archive screenshots, exact artifact/signer versions, foreground Activity, fixture-scoped provider receipts and terminal results. Source compatibility, successful installation, resolver output or ActivityMonitor success are insufficient on their own.

Alpha’s designed calendar remains its daily UI. Etar is a clearly external advanced-editor fallback; do not restyle or copy its screens into Alpha to conceal the handoff. If product acceptance requires the advanced editor itself to match the prototype, implement those capabilities in Alpha separately instead of claiming an external Activity matches the design. Full AOSP preinstallation, updates/signing and physical-device qualification remain separate follow-up work.

## Completion-driven recurrence — Build 58 source, native acceptance pending

The existing Calendar form's **Once / Daily / Weekdays / Weekly** controls now select native recurrence. Once retains the existing one-shot contract and notification tag. Repeated reminders retain a pinned IANA timezone, intended local date/time and separate alert lead; the native boundary verifies that these civil fields resolve to the requested epoch. The first Weekdays occurrence must itself be a weekday. An initially nonexistent local time is rejected. A future spring gap advances to the first valid instant after the gap; a repeated clock hour uses the earlier offset once. Editing uses the current device timezone and explicitly creates a new revision; the detail identifies the stored timezone.

A repeated reminder has **one unresolved occurrence**. Notification posting, dismissal, app opening and reboot do not advance it. The reminder detail explicitly says **“Next occurrence is scheduled after Done.”** Done records completion and installs the next future civil occurrence in one durable record update. Elapsed repeat dates skipped after a late completion are counted in that receipt, not claimed completed. Snooze 10 minutes retains the same occurrence and original due time while changing its alarm deadline. Repeating the same pending snooze does not keep extending that deadline. The native notification exposes the same Done/Snooze actions. The last 32 completion receipts are retained; unresolved current occurrences are not evicted as history.

Alarm callbacks, notification actions and taps carry occurrence identity. Edits change the revision; actions for an old revision/occurrence cannot change the current reminder. A stale notification tap goes to the safe calendar destination rather than opening the replacement occurrence as though it were the original. The prototype's purely visual recurrence expansion remains disabled for these native records: it must not display future instances that have not been scheduled after Done.

Permission-denied occurrences remain visible. Explicit Snooze after permission restoration retries scheduling; merely granting permission does not advance or deliver the occurrence. Native scheduling failure is reported separately from a saved record. Boot, package replacement and system clock/timezone broadcasts reconcile scheduled records without changing their pinned civil schedule. Alarms remain inexact. Force-stop and OEM restrictions still require separate qualification. NotificationManager posting and preference receipt writes are not one atomic transaction; existing crash-window reconciliation remains a limitation, not an exactly-once delivery guarantee.

Source validation: TypeScript check and existing `test-reminder-time-flow.mjs` passed before the Build58 freeze. `ReminderRecurrenceInstrumentedTest` adds two native flows: actual near-term alarm → OS Snooze → rendered reminder Done → stale-action/recreation checks; and native schedule transitions for weekdays/weekly/DST gaps/folds/edit invalidation. These tests were not run by the implementing agent. A direct `ReminderStore.restore()` check is **not** actual reboot evidence. Existing one-shot tests remain unchanged. Build55 capacity and dictation passes do not establish recurrence acceptance.

### Planned real recurrence permission/reboot matrix

Keep Build58 inputs frozen. After the next source release, add a separate opt-in phased test and runner, preserving the existing one-shot recovery tests.

1. Install one explicitly matching archived app/test pair and record both hashes. Require a disposable emulator and retain the original notification permission. Prepare one UUID-owned recurring reminder with a real near-term civil deadline, saving only fixture ID, revision and occurrence identity for the runner.
2. Revoke the actual Android notification permission before the deadline. Observe only the named fixture record externally until `permission-denied`; no force-stop/instrumentation between scheduling and this observation. Require unchanged occurrence/revision, zero completion receipts and no exact fixture notification key. Then launch the UI phase and verify the retained denied occurrence is visible.
3. Grant permission. Read the fixture externally to prove it remains denied and unadvanced. Explicitly tap Snooze in the real detail; require the same occurrence, an approximately ten-minute deadline, and no implied completion. Prepare the reboot occurrence through an explicit native schedule/edit with a near-term civil time; record its new identity as the expected reboot fixture.
4. Require package `stopped=false`, scheduled status, no notification and zero auto-advance before reboot. Record `/proc/sys/kernel/random/boot_id`, reboot, wait for boot completion and unlock. **Do not start instrumentation or manually invoke restore/boot broadcasts before observation.** Read only the selected stored occurrence and OS notification key, requiring changed boot ID, same revision/occurrence, `posted` receipt and matching notification, with no completion/history advancement.
5. Only after this external witness succeeds, launch the action phase. Complete through Alpha's visible control; require exactly one completion and next occurrence. Submit the old occurrence and prior revision to the native decision boundary and verify no second advancement. These are native stale-decision checks, not a claim that a notification PendingIntent survived instrumentation force-stop. The separate near-term flow exercises an actual OS Snooze PendingIntent and duplicate use before recreation.
6. Clean up only fixture records/alarms/notifications, restore original permission, preserve terminal logs and receipts, and repeat for both distributions. Installing the launcher APK alone does not establish HOME-role recovery. Do not count an assumption-skipped default-suite method as this run.


### Recurrence runners prepared after Build58 archive

`ANDROID_SERIAL=emulator-N node scripts/test-reminder-recurrence.mjs APP.apk MATCHING_TEST.apk OUTPUT` runs the two ordinary recurrence methods and manages/restores the notification permission externally, avoiding self-termination from permission revocation inside instrumentation. The Java alarm test now asserts its notification prerequisite instead of changing that permission. The runner records both supplied APK hashes and verifies the original grant is restored. Existing disabled-channel state is not silently changed.

`ANDROID_SERIAL=emulator-N node scripts/test-reminder-recurrence-recovery.mjs APP.apk MATCHING_TEST.apk OUTPUT` runs `ReminderRecurrenceRecoveryInstrumentedTest#permissionAndActualRebootPhase` with explicit `recurrencePhase` values `prepare`, `denied`, `retry`, `prepare-reboot`, `after-reboot-actions`, `cleanup`. It implements the external observations above and records exact fixture identity, revision, occurrence, history count, notification-key presence and changed boot IDs without dumping notification contents or unrelated stored data. It verifies original permission restoration after cleanup. This new gate is not exercised by the default suite; execution is pending.

Parent-reported Build58 standalone evidence: both ordinary recurrence methods passed, including actual OS alarm/Snooze and visible Done/recreation. At this update launcher results were pending. The larger native aggregate had unrelated Maps/browser failures; it is not a suite pass. The real recurrence reboot/permission runner was not part of that run and remains pending.

Build60 harness alignment: only the actual inexact-alarm method now requires `recurrenceAlarm=1`, supplied by `test-reminder-recurrence.mjs`. Its due-relative wait is bounded at 13 minutes and dedicated instrumentation timeout at 16 minutes; the general smoke wrapper has a 10-minute timeout and must not run it implicitly. The civil transition method remains in the ordinary suite. An assumption-skipped alarm method is not native delivery acceptance.

## Build60/62 observed follow-through

Build60 dedicated recurrence and recovery runners pass both distributions. Recovery uses actual permission denial, explicit retry, real changed-boot-ID reboot and an external observer witnessing the same occurrence notification before instrumentation reopens Alpha. Ordinary permission restoration does not advance the occurrence. Evidence: `test-results/prototype-build60/recurrence-{standalone,launcher}` and `recurrence-recovery-{standalone,launcher}`. The older Build58 launcher timeout remains a failed historical run.

Build62 external-editor receipts pass both distributions in `test-results/prototype-build62/external-calendar/result.json`: real implicit Etar handoff, cancel unchanged, title-only save preserving row and epochs, refreshed Alpha return, fixture cleanup and unchanged timezone. Etar57 requests special exact-alarm access on every resume when it is denied; Android Back therefore loops back into Settings. The test uses an actual Home key followed by Alpha's launcher intent and explicitly labels that return method. It does not grant access or claim ordinary Back works. This overnight fixture does not qualify complex recurrence/DST-fold external edits or Cloud synchronization.
