# Alpha Phone physical pilot acceptance

This runbook implements the handoff procedure in steps 14–15 of the [MVP completion plan](mvp-completion-plan.md). It is an execution template, not acceptance evidence. No physical unit, signed image, OTA, latency target or stakeholder signoff is marked passed by this document. Use the current [product status](mvp-current-status.md) to select the candidate; historical emulator results cannot fill physical-unit cells.

## Release entry conditions

Assign an operator, reviewer, support owner and rollback owner before provisioning. Record references to the authorized signing and device-management mechanisms; never copy keys, credentials or recovery codes into the evidence bundle. Select the exact Pixel SKU, hardware revision, Android image and supported device tree. “Pixel 10 or similar” is the product direction, not a claim that every Pixel build is supported.

Freeze the app commit, pinned Eliza source/patch identities, speech/model manifests and generated runtime manifest. Complete `npm run verify` and `npm run android:build`, retain both distribution outputs and test APKs, and obtain successful required CI results for the candidate commit. Identify the separately signed release APK and OS image. Debug signing, unsigned release compilation and launcher-overlay staging are not production image acceptance.

Before changing a physical unit, obtain the owner's consent to the exact provisioning/reset operation and preserve any required personal data using the approved recovery method. Use designated test accounts and synthetic content. Keep stock emergency and recovery access available. Do not flash an image until exact hardware compatibility, signing authority and recovery instructions are established. This runbook deliberately supplies no guessed flashing, bootloader or signing commands.

## Per-unit evidence record

Create one private record for each of four units, using aliases `unit-a` through `unit-d`. Keep raw serial numbers and personal account identifiers out of public PRs. All four rows start **not run**.

| Unit | SKU / hardware / Android fingerprint | App SHA / APK SHA / signer / versionCode | OS image SHA / runtime manifest | Local owner-agent binding evidence | Test report / video / reviewer | Status |
| --- | --- | --- | --- | --- | --- | --- |
| unit-a | pending | pending | pending | pending | pending | not run |
| unit-b | pending | pending | pending | pending | pending | not run |
| unit-c | pending | pending | pending | pending | pending | not run |
| unit-d | pending | pending | pending | pending | pending | not run |

Each run record includes UTC start/end, operator, exact source/artifact identities, network/provider route, engine/model versions, relevant permission/channel state, expected result, observed result, and evidence paths. Use stable synthetic object/run IDs to relate UI, native storage and agent receipts. Record failures and skipped cases explicitly; a missing artifact is unverified. Capture reviewed screens and redacted status/receipt data, not passwords, tokens, OTPs, vault content or unrelated private notifications.

## Execute on every unit

Perform the following with the release launcher selected as HOME. Qualify the standalone distribution separately on a designated compatible device with its own APK/source identities; it is an alternate installation of the same package, not a second simultaneous app. Preserve user data when switching only if the signed update path explicitly supports it.

| Journey | Required observations | Evidence and failure boundary |
| --- | --- | --- |
| Boot and design | Cold boot reaches usable Alpha HOME; accessible talk/type controls; exact prototype screens for all retained MVP routes; Back/Home, keyboard, large text and rotation where supported; deferred routes cannot reopen from saved state or agent proposals | Unedited recording plus screen inventory. A mock/reference screenshot alone does not prove live data or native behavior. |
| Resident startup and chat | Configure the permitted inference route without exposing its credential; start local agent without requiring Cloud login; verify runtime identity; type and speak requests; selected-view context reaches the intended conversation | Native process/IPC evidence and canonical conversation IDs. Disclose hosted Cerebras inference; local orchestration is not offline inference. |
| Lifecycle and recovery | Background, lock/unlock, lose/restore network, recreate/kill the app, restart the runtime, explicitly stop it and reboot the phone; recover admitted messages/results once under the same owner | No repeat of uncertain external effects, no stale-owner history, no false successful stop/restart. Match the current resident CI worker-survival test separately. |
| Mock isolation | Enter mock after live services pause; traverse retained routes; exit to deliberate live/offline state | No real provider/device mutation from simulated actions; native system chrome appears once; the mock banner does not obscure primary controls. |
| Speech and Notes | Real human microphone capture, denied permission, transcript review/correction, save/reopen/edit/delete, read aloud, playback interruption, silence and unavailable-engine recovery | Listener confirms speaker output. Repeat on-device STT/TTS without network; agent inference may remain unavailable offline. Prerecorded CPU-model tests do not qualify physical capture. |
| Calendar | Select an actual authorized account/calendar; create/read/edit/delete a synthetic event, all-day and recurring cases; verify provider readback, time zone and stale edit refusal | UI IDs and provider IDs agree; account isolation; permission denial and interrupted acknowledgement remain recoverable without duplicate events. |
| Reminders | Create with None and numeric alert lead; reload/edit; receive real delivery; snooze, complete/reopen/cancel, recurrence, reboot and time-zone cases | Due time and alert lead remain distinct; None requests no notification permission and schedules no delivery; notification dismissal is not task completion. Preserve exact receipts. |
| Clock | Reviewed native set/show/snooze/dismiss handoff, actual ringing, reboot and relevant DND/time-zone behavior | A listener observes sound/vibration; intended synthetic alarm is removed afterward. An intercepted intent is not ringing evidence. |
| Workflows and results | User-created morning/evening flows, explicit approval, native effect, durable run history, edit/disable/cancel, concurrency and process interruption; reconnect results and scoped notification tap | Distinct occurrence/run/result IDs, terminal receipts, no duplicate effects. Phone-off hosted execution remains a separate unresolved requirement; local missed-occurrence handling cannot be substituted silently. |
| Browser and passwords | Ordinary address/search, tabs, Back/Forward, chosen upload/download, share/cancel, approved selected-page reading, navigation during review; real selected password provider setup/save/fill/lock/cancel/disable | Child content cannot invoke privileged bridge; sensitive pages cannot reach agent/speech. Verify wrong origin, iframe and tab boundaries using synthetic credentials. Passkeys require separate provider/browser identity evidence. |
| Files, capture, photos and Maps | Select/import/export a test-owned file; camera permission/capture/cancel; reopen selected media; local/regional map search and chosen route where configured | Correct object identity, durable selected data, explicit unavailable coverage; no claim of global navigation from a regional fixture. Excluded advanced media features stay inaccessible. |
| Settings and notifications | Permission denial/recovery, notification channel disabled/re-enabled, exact task/result tap after restart, privacy controls and any accepted listening controls | Settings reflect actual native state. Listening requires its separately approved AOSP implementation, consent, visible state, stop behavior and privacy evidence; do not infer it from a microphone button. |
| Email | Email remains required unless an explicit stakeholder-approved scope amendment says otherwise. Verify Gmail account/grant isolation, full thread and draft behavior, reviewed mutations, revocation and interrupted-result recovery | Browser login is insufficient. A live send requires authorization for the exact recipient/message; otherwise retain synthetic-send evidence and leave real-send acceptance open. Resident execution does not remove account consent or the Email requirement. |
| Optional Cloud/remote agent routes | For each retained route in the approved pilot profile, complete real phone exchange and selected owner/agent, remote pairing, revoke/expiry/restart | Record the profile and any explicit scope decision; do not silently waive an earlier requirement. Do not start billable agents without the applicable spending approval. Cloud identity needed for Gmail remains distinct from choosing a remote agent. |

Run wrong-owner, revoked permission, stale target and lost-response cases against designated fixtures. An unexpected result is not a reason to replay a write. Record unknown outcome, inspect the durable receipt/provider state, and recover through the product's intended UI. Do not weaken SELinux, signature checks, browser isolation, capability gates or release security to get a pass.

## Performance and stability

Agree the task set, statistical acceptance rule and soak conditions before the acceptance campaign. Use a fixed disclosed set of simple typed/spoken tasks and record at least 20 warm and five cold observations per unit and inference route, as proposed in the completion plan. Preserve all samples and failures. Measure end of speech to first audible response, transcription duration, model first-token latency and playback completion separately. Record battery, temperature, network and runtime-start state so results can be interpreted. The six-second simple Wi-Fi voice target still needs an agreed percentile/statistical rule before signoff; report measured values without inventing a pass threshold.

Complete an agreed battery/thermal/background soak on the exact release image. Record crashes, ANRs, missed deliveries and recovery results with elapsed time and conditions. Synthetic audio, emulator speed or a single successful conversation does not replace physical latency or soak evidence.

## Signed update and recovery

The release operator records the approved old and new APK/OS identities, signing certificates, version rules and expected data migrations. Exercise the authorized signed update on a designated unit, verify resident startup, existing Notes, conversations, approvals, workflow receipts and scheduled state, then execute the approved recovery/rollback drill. Android version/signature and encrypted-data migration rules may prevent a simple downgrade; use the documented release-specific procedure. Preserve previous artifacts and recovery access until this drill passes. Verify the remaining units independently after rollout.

## Handoff and exit

A reviewer other than the implementation operator reproduces the setup and a representative complete journey using the source/setup/deployment guides and the recorded release manifest. Capture at least a five-minute unedited physical demonstration without private content. Reconcile every required journey, every failed/skipped case, and the agreed P0/P1 list against evidence from the actual candidate. Record stakeholder decisions for any explicit requirement change, including powered-off scheduling, rather than treating implementation choices as scope approval.

Deliver source and reviewed upstream references, dependency/license and speech/browser/provider provenance, app/OS build instructions, authorized provisioning guide, per-unit manifests, results and video, update/recovery procedure, support contact and the stakeholder acceptance record. All four units must be independently paired and usable. No open required P0/P1, missing physical evidence or unresolved mandatory scope requirement can be marked complete by this runbook.
