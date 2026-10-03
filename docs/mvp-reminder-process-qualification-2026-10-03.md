# Reviewed reminder creation and notification process recovery — October 3, 2026

## Delivered behavior

Agent proposals can now explicitly create no-alert, lead-time and recurring reminders using the generic `reminders.create.v1` capability and closed `reminder_create` operation. Title, body, due time, alert timing and recurrence are reviewed together. The existing legacy creation operation remains strict: unsupported extra fields are rejected instead of silently dropping the requested timing. The new capability is independent of selected-record reminder v2. Both native and upstream HTTP negotiation admit the full six selected capabilities and reject duplicates, unknown tokens and mixed reminder versions before transport.

The native store commits the new record and original operation receipt atomically before Android effects. Its journal operation identity is the reminder identity. Reusing that identity with a different binding or an existing unrelated row refuses. Recovery returns the original immutable result after later edits or recurrence advancement; it does not recreate the reminder. No-alert creation never arms an alarm or requests notification permission. Numeric alerts report permission denial when unavailable. An uncertain effect remains unknown and is not replayed.

Generic contracts, action schema, proposal/claim/receipt/reconcile validation and negotiated capabilities are an explicit tested upstream patch, `patches/eliza/reminder-reviewed-creation.patch`. The pinned vendor checkout is unchanged. Product rendering, Android delivery and device policy remain in Alpha Phone. Notification route forwarding and owner/session fences are preserved.

## Native flow qualification

All campaigns used the dedicated Pixel 9/API35 ARM64 emulator `alpha_root_workflow_taps_20261003` on port5570, with a fresh secondary user for each distribution. Exact APK hashes, provider identity, settled user switching, display readiness, named instrumentation results and zero skips were checked. Every successful campaign removed both disposable users and product/test packages and restored Owner0. No existing emulator, physical phone or real provider account was mutated.

| Required flow | Standalone | Launcher | Retained evidence |
| --- | --- | --- | --- |
| No-alert creation, numeric permission denial, immutable receipts and native journal recovery | Pass | Pass | `test-results/reminder-process-combined-03/reminder-none-01/` |
| Granted numeric alert timing, stale-target refusal, recurrence and historical creation replay | Pass | Pass | `test-results/reminder-process-combined-03/reminder-numeric-01/` |
| Actual native HTTP six-capability transport and zero-request invalid inputs | Pass | Pass | `test-results/reminder-process-combined/reminder-transport-01/` |
| Original notification launches absent main process and restores original route | Pass | Pass | `test-results/reminder-process-combined-04/process-death-01/` |

The process-death case runs in a separately declared test process. It publishes once through the real native implementation and reconciles the actual OS receipt without reposting. It establishes the main process, removes its tasks, rechecks exact UID/PID/start ticks/argv, sends SIGKILL, and proves main is absent. Only then does the original retained PendingIntent launch a new main process. The production main plugin captures the original token; the helper never captures it. OS notification identity/post time, delivery receipt and every route field remain unchanged. Pending order1 confirms one capture. This is ordinary process death, not package force-stop. The packaged manifests preserve the default runner and separate helper runner. CI now requires this eleventh recovery phase in both variants.

Final process APK manifest SHA256: `bbf9144fb076fce65153c02b799f35b4cf741bff6349a839d7949eaedda86d74`. Final source manifest SHA256: `9299d4f6a11580bc3d0dc9b084f106b45196712ec28d83c7654f52d018a973eb`. Reminder creation manifest: `444d474c836c3145cbe3a030be46589dae202f79148052ace4d092faddf2220e`. Native transport manifest: `1cb1b7d97d5f79ab4f5859edbf470423508174b29e9cb9d635473fa0877709c3`. Source comparisons preserve relevant renderer/native reminder/transport bytes across these runs; only unrelated diagnostics and test readiness evolved. Combined flow index: `test-results/reminder-process-combined-04/qualified-flows.json`.

Forty rendered reminder/action/notification flows pass on the exact945 composition. Final required `npm run verify` and `npm run android:build` pass, covering 218 repository checks, TypeScript, production build, both distribution variants, lint and all six APK inspections. All3,891 retained source identities remained unchanged during that run. Fresh source-only upstream preparation passes using a read-only local Git cache; all declared effective source hashes verify. Fifty-four supervisor/switch cases and the existing recovery guard suite pass.

## Retained failures and corrections

The first helper fixture used a host-JDK API unavailable in Android stubs; it now reads bytes with explicit UTF-8. Actual APK inspection caught AGP renaming the only instrumentation declaration; an explicit default declaration preceding the helper preserves both components. Initial native failures exposed immediate process-argv observation, asynchronous OS publication, and a legitimate fresh-user ReminderReceiver broadcast starting main. Bounded read-only readiness, receipt reconciliation without reposting, and removal of only the unnecessary pre-setup absence assertion address these conditions. Exact identity immediately before kill and complete main absence before the original send remain mandatory.

Reminder fixture failures exposed JSON property-order comparisons and an invalid null-write cleanup call. Structural comparisons retain exact keys, array order and scalar values; fixture cleanup uses the actual encrypted-slot removal API. These are test corrections, not relaxed product outcomes. Failed attempts and cleanup evidence remain under `test-results/workflow-process-death-qualified*` and `test-results/reminder-process-combined*`.

## Resident runtime and remaining gates

The exact e1 hosted resident native failure now records `SIGSYS` before any model request, with matching authenticated execution identity. Its forbidden syscall is not yet known. A reviewed additive upstream diagnostic retains bounded spawned PID, real UID and start time; a test-only native observer queries exact ApplicationExitInfo and, if available, extracts only numeric signal/syscall evidence from a bounded native tombstone. Missing or ambiguous evidence remains unavailable. No raw trace, arguments, environment or arbitrary failure text is exported; no seccomp or SELinux rule is weakened. This instrumentation is not a runtime repair, and Android attribution remains to be established by hosted execution.

These passes do not establish real model-driven authoring, all lock/channel conditions, reboot delivery, visible Computer Use acceptance, live Cloud/Gmail/voice, release password autofill, physical-device alarms/speech, signed AOSP boot/OTA or user acceptance. Notification history remains bounded at512 lifetime identities, failing closed at capacity. The full MVP is not complete.
