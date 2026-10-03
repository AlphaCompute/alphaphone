# MVP reminder edits, Cloud sessions and resident restart

## Product corrections

The exact `52e37fbfb7ab19a35e7b3467d0301ea4e950341e` audit reproduced reminder rescheduling overwriting a newer saved revision and retrying a committed operation after response loss. Every saved reminder edit now uses the existing revision-bound `reminder_update` operation, with its identity durably retained before dispatch. Unknown results are recovered through receipts, never automatic mutation replay. Full draft, view, visibility and component ownership checks preserve newer edits and navigation.

Metadata edits preserve the occurrence and saved civil schedule. Completed reminders keep their completion history; an explicit schedule change requires confirmation before creating a new occurrence. Rescheduling clears obsolete completion, snooze and posting markers. Cancelled native records reject updates. Permission-denied or scheduling-failed receipts do not display scheduling success, and invalid outcome receipts remain unresolved.

Confirmed Cloud session expiration during personal-agent setup now clears the exact bound Cloud service and account state. It retains durable setup intent, so fresh sign-in can discover an already accepted setup without activating another agent. Ordinary service errors do not invalidate the session. Gmail account refresh and selection require both a connected grant and the read capability, even when the connection ID stays unchanged. Restoring a grant does not automatically read the mailbox.

## Current validation

The final composition, including native restart provenance, the required reminder phase and Foundation boot-read ordering, passes pinned Node 24.15.0 `npm run verify`: 169 checks, typecheck and production build. All 3,779 recorded identities are unchanged during that final run. Workflow lint, eight recovery supervisor scenarios and existing recovery guards also pass. The 45 rendered product flows retain identical renderer/test source in this composition. Final result prose was added after verification. Evidence: `test-results/edit-session-combined-52e/final/`.

The combined product changes pass `npm run verify`: 168 checks, typecheck and production build. All 45 owning rendered flows pass in the owned worktree, with 3,772 recorded identities unchanged during qualification. One subsequently removed generated Python cache was included in that identity snapshot; it is not product source. Evidence is in `test-results/edit-session-combined-52e/`. Controlled original failures and individual packet evidence are retained in `cloud-gmail-recovery-fix`, `reminder-edit-recovery-52e` and `reminder-native-edit-52e` under `test-results`.

The native reminder implementation and expanded instrumentation compile. The owned-secondary Android recovery campaign now requires the exact reminder edit method in both distributions, grants notification permission only to its disposable fixture user, rejects skipped/wrong-method results, and retains the existing cleanup and time budgets. Eight synthetic supervisor scenarios and the existing strict recovery guards pass. This newly added native phase has not yet executed on Android.

New-source APK builds and installed Android acceptance remain pending. Local disk capacity is insufficient for another complete Android build. Browser/controller tests use controlled service boundaries and do not establish live Cloud login, Gmail authorization or real provider access.

## Hosted evidence from earlier exact commits

At exact `52e37fb`, PR browser run [37099141188](https://github.com/AlphaCompute/alphaphone/actions/runs/37099141188) passes 973 cases with four explicit skips. This predates the product corrections above.

At exact `c7eadc8c8d82338b536e161f95816c956b0a11bb`, resident run [37096808143](https://github.com/AlphaCompute/alphaphone/actions/runs/37096808143) passes its build and recovery-UI job. All three required recovery methods execute once successfully in each distribution: encrypted reminder deletion storage, Calendar creation recovery without replay, and audio deletion fencing through reload/restoration. The six actual transcripts and their artifact are retained in `test-results/candidate-c7ead-ci-audit/recovery-evidence/`.

That same run fails the resident native job. Private-peer authentication and IPC streaming pass, and actual RAM evidence confirms the unchanged hybrid floor is satisfied. A workflow worker is alive immediately after the resident crash but absent after resident restart. The failing test takes 36.625 seconds; its explicit 120-second provider timeout does not explain that result.

## Resident restart correction under qualification

Source inspection identifies blanket `pkill -f` calls in the launcher and detached-service stop path. The bundled Bun executable is shared by the resident and workflow workers, so those calls can terminate workers intended to survive a resident restart. The correction removes launcher blanket kills and limits service termination to an authenticated resident process, preserving unrelated workers.

The correction is implemented as explicit patches in `patches/eliza`. Original upstream hashes, patch hashes, effective source hashes and generated Java hashes remain independently verifiable; the pinned vendor checkout is unchanged. A fresh temporary source preparation passes the owning patch checks and real subprocess reproduction. Eleven tamper cases reject altered provenance/content. An earlier artifact-dependent test packet was rejected during review and replaced with checks inside the existing freshly prepared fixture. Actual Android worker survival remains required; these host results are not Android acceptance.

Exact52 Foundation run [37099141181](https://github.com/AlphaCompute/alphaphone/actions/runs/37099141181) builds both distributions but fails before provider download because an initial shell read of `/proc/bootconfig` is denied. The correction keeps initial fixture admission unprivileged and performs full boot-device admission after the existing `adb root` and fresh fixture checks, before scratch properties, verity, remount or provider mutations. The same full admission remains required after reboot. The owning fake transport now models shell permission denial and privilege reset across reboot; 40 provider/boot flows pass. Fresh hosted provider qualification remains pending.

## Remaining MVP gates

Full completion still requires fresh exact-source Android qualification, visible Pixel flows, resident restart/workflow acceptance, live Cloud/Gmail/voice journeys, real password-provider save/fill/unlock behavior, physical alarm/audio checks, signed AOSP boot/update/rollback, and device/user acceptance. These gates remain separate. The MVP is not complete.
