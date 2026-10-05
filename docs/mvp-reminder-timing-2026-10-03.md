# Reminder timing and startup recovery qualification

This follow-up audits candidate `955d109cab7990f25a7b1ea73f583670f4ffa15d`. The repairs described below are being qualified. This document does not establish Android execution, live-provider, physical-device, or AOSP acceptance.

## Confirmed gaps

Two rendered Calendar flows reproduced against unchanged candidate source. Saving a one-time reminder due at 01:00 with a ten-minute alert persisted 00:50 as both its delivery time and due time; reopening showed “Alert at start.” Selecting “None” instead persisted an ordinary scheduled notification. Native source used the same lost due-time semantics and armed AlarmManager. Browser execution establishes the rendered defect; Android behavior was source-reviewed, not executed in that reproduction.

An older resident restart campaign also returned HTTP 401 during pairing. The public `/api/auth/status` endpoint returns an instance identifier even when `authenticated` is false. Both the native test and production startup had treated an instance identifier alone as readiness. A separate exact-candidate browser failure exposed a workflow recovery warning displaced by the scheduler's generic save-error toast about 50 milliseconds later.

## Required reminder behavior

The reviewed due time and alert choice are independent persisted values. Explicit schedules carry both `dueAt` and `alertMinutes`; a number from 0 through 10080 denotes elapsed minutes before the due time, while `null` denotes no notification. Numeric schedules require `at = dueAt - alertMinutes * 60000`. No-alert schedules require `at = dueAt`. Recurring schedules must also agree with the saved civil date, time, time zone, and lead.

No-alert tasks remain `pending` with delivery mode `none`. Creation must work without notification permission, without opening a permission dialog. Restore, stale broadcasts, and completion-driven recurrence must not arm an alarm or post a notification. Done records completion and either finishes a one-time task or advances a repeat to its next pending occurrence. Snooze is unavailable until a separately reviewed edit explicitly enables an alert.

Snoozing an alert changes its actual next delivery time without changing its reviewed due time or alert lead. Selected reads therefore distinguish the current delivery deadline (`result.at`) from the original schedule (`fields.schedule.at`). Metadata edits preserve both. Schedule edits, stale-target rejection, and response-loss recovery use the same durable operation and receipt path as other reminder changes.

## Agent and compatibility contract

Explicit timing records carry `target.timingVersion: 2`. Every operation on such a target, and every update introducing explicit timing, requires the negotiated `reminders.local-record.v2` capability. The client selects v2 instead of v1 when supported. The server advertises both versions for compatibility, while retaining its existing bounded request-header limit.

Existing v1 records and historical receipts keep their original shape. They are not assigned an invented historical lead. New timing fields must not be silently removed by an older peer, omitted from a v2 schedule update, or dropped from an explicit receipt. A direct legacy scheduling call cannot overwrite an explicit timing record. Native target validation remains authoritative even if a caller omits the version marker.

The renderer also checks the native `surfaceInfo.reminderTimingVersion` before dispatching an explicit creation. An older shell could otherwise ignore unknown request fields and create an alert despite the selected “None” choice. Missing or malformed support fails before retention, permission requests, or scheduling. The selected timing marker must survive chat-context serialization, proposal review, and canonical target comparison in both directions.

The shared Eliza change belongs in the generic device-action contract, tool schema, authenticated capability gates, and model guidance. It is delivered as a hash-pinned patch against the reviewed runtime source, not by editing `vendor/eliza` or adding product-specific behavior to the agent.

## Startup and workflow recovery

Resident readiness requires strict boolean authentication with the same current native boot token before pairing. Token and lifecycle checks surround enrollment requests and cached-session publication. Only read-only readiness is polled; pair-code issuance and pairing are not automatically replayed after an uncertain response.

Workflow persistence failures must remain visible in the affected workflow detail even if a scheduler scan subsequently fails. This warning is local recovery state, not a retry or a replacement of externally edited storage. Qualification must assert both the visible explanation and preservation of the external edit, with no unapproved Notes effect.

Both candidate Foundation builds succeeded, but both emulator smoke jobs failed during WebView installation after a framework restart. Package and activity Binder publication did not establish completion of framework initialization. The revised fixture checks the current ActivityManager readiness flags, brackets them with the same `system_server` PID and start time, and requires a replacement process after restart. It restores adb root only after authenticating the disposable fixture and before reading privileged process state. Existing deadlines remain; an uncertain root request or provider installation is not replayed. Android's [ActivityManager process dump](https://android.googlesource.com/platform/frameworks/base/+/android-15.0.0_r1/services/core/java/com/android/server/am/ProcessList.java) supplies the inspected readiness state.

## Acceptance still required

- Rendered create, reload, edit, snooze, completion, recurrence, legacy compatibility, and lost-response flows against the composed product source.
- Real authenticated HTTP and durable SQL approval lifecycle for v2 capability refusal, exact receipt preservation, and duplicate-claim rejection against freshly prepared patched Eliza source.
- Both Android variants executing separate owned-user phases: notification permission denied for no-alert creation, and permission granted for numeric alerts, snooze, stale targets, and legacy receipts.
- Current resident restart and explicit-stop worker-survival campaign, including authenticated enrollment readiness.
- Full repository verification and exact-commit hosted checks. APK compilation alone does not close any device or live-integration gate.

Evidence packets are under `test-results/reminder-oneoff-lead-955`, `reminder-timing-v2-955`, `reminder-alert-native-955`, `reminder-timing-upstream-955`, `resident-auth-readiness-955`, and `browser-955-terminal` in the primary Alpha Phone checkout. The final composed bytes passed 123 rendered journeys in 3.3 minutes, TypeScript, production build, workflow lint, 20 real supervisor-loop scenarios, 24 owning WebView scenarios, and compilation of seven affected production/instrumentation Java sources. All 3,786 source identities remained unchanged; the only generated Python cache was removed after being recorded. Evidence: `test-results/timing-recovery-combined-955/`.

The full required `npm run verify` attempt exited 7 during the provider scenario file. It emitted no definitive cause; the unchanged file subsequently passed all 24 cases. Available disk fell to roughly 0.3–0.5 GiB while another unrelated test process was active. These observations do not prove the failure cause. An unchanged retry subsequently passed all 174 repository checks and the production build. Fresh source preparation then passed, followed by `npm run android:build`: all six APKs, both debug/release distribution variants, lint, and APK verification. Documentation checkpoint prose was added after the source comparison.

The earlier exact `955d109` resident recovery job completed eight actual native executions across both distributions: reminder deletion CAS, Notes tombstone/restore fencing, CalendarProvider marker recovery, and reminder edit/receipt recovery. All eight disposable users were removed. Its separate resident native job failed on pairing HTTP 401; both Foundation smoke jobs failed at WebView installation. Those successes do not cover this batch's new timing contract.

## Exact e302 hosted and visible Pixel follow-up

Exact `e302315a0107e5c1c9a482aa9ec81a3dc1b0c261` is not fully qualified. Both hosted browser jobs finished with 1,020 passed, four explicitly skipped, and one failed. Automatic workflow persistence failure on Home lost its visible warning because only the failing workflow detail retained it. The follow-up restores a transient warning on Home, the workflow list, and another workflow detail, while preserving the persistent warning and avoiding duplicate warnings in the affected detail. All 34 owning rendered flows and TypeScript pass in isolation. A further reviewed overlay repair preserves the warning over run history and workflow builders; its nine focused flows pass. Evidence: `test-results/workflow-home-save-error-e302/`.

The resident build stopped in the fresh-source authenticated HTTP/SQL phase at an older assertion expecting five advertised capabilities. Enrollment now correctly advertises six including reminder timing v2; requests remain bounded to five. The correction asserts the exact six advertised names and preserves the request-limit tests. Full corrected hosted execution remains required.

The Foundation build passed. WebView provisioning also passed with the new framework readiness checks. Push smoke then refused its display precondition; no native instrumentation acceptance follows from this result. Its selected evidence identifies a secure keyguard state despite an awake, unlocked display. The PR smoke run separately failed two of four provider qualification cases, then timed out during general instrumentation; its retained activity evidence also shows System UI ANR. The reviewed fixture follow-up performs one planned full reboot after successful provider installation, then revalidates exact image, boot topology, storage alias, 512 MiB scratch, installed APK bytes, selection/RELRO, display security and absence of ANR. Both author and independent reviewer pass all 26 actual-script scenarios. This is a proposed fixture repair, not proof that those hosted failures are resolved. No install retry or security relaxation is introduced.

The exact e302 launcher APK was installed and its installed SHA-256 matched the local build. On the owned Pixel 9/API35 emulator, Computer Use opened Calendar, denied calendar access, selected Reminders and alert None, saved the test reminder, opened its detail, and completed it. The visible states confirmed no-alert storage and a completion receipt preserving the 04:00 due time. No notification permission prompt occurred during save. Ordinary Computer Use click delivery initially opened quick controls; stationary pointer gestures worked, and independent real touchscreen icon/card journeys passed. This is a bounded launcher emulator result, not both-variant instrumentation, physical alarm, resident worker, or live agent acceptance. Evidence: `test-results/pixel-e302-visible/`.

Live Google sign-in to Eliza Cloud succeeded in the browser. Phone callback/exchange, agent chat, Gmail grants, and voice remain unverified. Starting the Dedicated test agent remains pending the requested spending approval.

The visible Pixel campaign also entered mock mode and returned to device-backed Home (historical: since October 4 mock mode exists only in `ELIZA_DEV_ALLOW_TEST_MOCKS=1` test-mocks builds, not in distribution APKs). Android mock displayed duplicate simulated status/navigation chrome; the presentation-only correction now passes four rendered native/browser chrome flows, including lock/unlock and banner clearance. Mock entry and exit keep the existing native pause barriers. The rebuilt launcher installed successfully and its installed APK hash matches the candidate; Computer Use could not finish the new visual check because the Mac was locked. That check remains open.

The combined follow-up passes all 176 repository checks, typecheck and production build, all 41 targeted rendered workflow/mock flows, and `npm run android:build` for both distributions. All 3,786 source identities remained unchanged during qualification. Documentation was updated afterward. Exact-commit hosted execution is still required, including the corrected authenticated HTTP/SQL suite and planned-reboot fixture. Evidence: `test-results/e302-followup-combined/`.

## Native navigation assertion correction after a91

Independent source review identifies a deterministic cause of the earlier sensitive-reading failure: `AlphaBrowser.navigate` resolves the native tab state, which always includes an `error` string. Successful navigation returns `error: ""`; the fixture incorrectly treated the presence of the field as rejection. Both sensitive-URL navigation and the return navigation now require a raw string with an empty value and the exact requested session, tab ID and URL. Boolean rejection, missing/nonempty error and wrong identity still fail. The existing committed-page wait and all sensitive-reading refusal/no-outbound-body assertions remain unchanged.

The reviewed correction passes all 176 repository checks, TypeScript/build and both Android distribution builds, including instrumentation compilation. It does not change production browser behavior or explain the independent System UI ANR/share-return failure. Actual corrected native execution remains required. Evidence: `test-results/browser-navigation-state-a91/`. Current a91 CI is allowed to finish before publishing this follow-up, so its native reading fixture still contains the known assertion defect.
