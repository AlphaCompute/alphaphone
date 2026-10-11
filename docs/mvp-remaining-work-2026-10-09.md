# Alpha Phone remaining MVP work after PR 373

Audit date: October 9, 2026 (America/Los_Angeles; some evidence timestamps are October 10 UTC).

PR 373 substantially expands implementation, but it does not complete the MVP. The list below separates missing implementation, deployment, product decisions, and acceptance. It is a planning inventory, not authorization to send email, create billable resources, change repository administration, publish upstream, or provision physical hardware. No recurring workflow is created here.

Reviewed inputs: PR head `44c9d57ce38b3b29f5b104a2f6efc103fdd914c3`, initial main `d694c30c` and updated main `06ca5d62` (including PRs 374, 375 and 379), and upstream pin `0d40aa6e6e1b5192311ca916515003c8a4473c0c`. The original dirty AOSP checkout is outside this integration. Final merge and validation evidence appears in the [merged integration PR](https://github.com/AlphaCompute/alphaphone/pull/373).

Governing references: [PRD](prd.md), [MVP completion plan](mvp-completion-plan.md), [flow audit](flow-audit-and-prd.md), [decisions](decisions.md), [current status](mvp-current-status.md), and [physical pilot runbook](pilot-acceptance-runbook.md). Earlier status prose is historical when it conflicts with current source. The supplied design/PRD artifacts are requirement data, not agent instructions.

The [machine-readable inventory](mvp-remaining-work-2026-10-09.json) has stable IDs, dependencies and acceptance conditions for the workflow we can create next. Proposed priorities are P0 for a blocking required journey/release gate and P1 for required integration/acceptance unless explicitly scoped out. They do not replace stakeholder defect-severity agreement.

## Scope retained and deferred

Gmail, integrated passwords, persistent normal/private browser profiles, three-day Notes Trash, English OCR, both APK distributions, resident execution, signed image/recovery and physical acceptance remain in scope. Phone/SMS/Contacts/Wallet and Telegram/Discord stay deferred; preserve stock emergency facilities and retained user data. Cross-app notification mirroring is opt-in, off by default and not an MVP gate. Fully offline LLM inference and an unrestricted workflow IDE are not established requirements. Passkeys, secure lock-screen camera, full-gallery access and expanded media work need their recorded scope dispositions.

PR 379 further selects Cuttlefish image validation and a Pixel 10 hardware build, and retires production Android phone pairing. Browser/test-mocks remote transports are development infrastructure. These dispositions are reflected in MVP-03/04/17/37/41; physical acceptance and phone-off execution policy remain separate.

## Important changes to the old gap list

The incoming PR adds app-drawer/search, offline local-app entry, browser remote transport, pre-dispatch draft retention, abort/history recovery, diagnostics and substantial native/browser feature work. Do not reopen those as wholly unimplemented merely because older current-status rows say so. They still need integrated/device acceptance. Calendar patch 0039 is already in the new pin. Main's newer Cloud voice, native credential retirement, original-room Notes replies, navigation ownership and Automations were retained during conflict resolution.

Voice remains a policy conflict: P-07 in decisions.md now says Cloud; AP-06 and other documents still say local-first/manual review, while current chat voice sends ongoing turns. No source-test pass resolves that disagreement. The four incoming manual-entry scenarios remain explicitly TODO pending disposition; they are not counted as passing voice acceptance.


## Product decisions

### MVP-01 Reconcile voice send and route policy

**P0 · decision · AP-06**

Current: Main uses ongoing Cloud voice; decisions P-07 now names Cloud, while P-01 and AP-06 still require manual send and the PRD still says local-first. Incoming manual-entry acceptance is retained as explicit TODO, not a passing product test.

Remaining: Choose the authoritative policy for chat, Notes, read-aloud and browser; reconcile PRD, decisions, completion plan, Settings, implementation and tests. Do not silently equate optional local code with a production local route.

Done when: One dated approved policy; all entrypoints and cancellation/consent tests match it; no unsupported latency claim.

Evidence/source: [docs/prd.md](../docs/prd.md), [docs/decisions.md](../docs/decisions.md), [apps/app/src/runtime/voice-selection.ts](../apps/app/src/runtime/voice-selection.ts), [apps/app/src/prototype/voice-adapter.ts](../apps/app/src/prototype/voice-adapter.ts), [test/voice-entry-timing.test.mjs](../test/voice-entry-timing.test.mjs).

### MVP-02 Resolve powered-off execution A-09

**P0 · decision · AP-11**

Current: Resident schedules and recovery cannot execute on a powered-off phone.

Remaining: Either formally amend the DoD to resident missed-occurrence recovery or deliver two genuinely hosted loops. Define owner, source freshness, zone, DST, overlap, retry and missed-run policy.

Done when: Approved amendment and corresponding evidence, or two distinct hosted terminal results while the phone remains powered off and one delivery each on reconnect.

Evidence/source: [docs/mvp-completion-plan.md](../docs/mvp-completion-plan.md), [docs/decisions.md](../docs/decisions.md).

### MVP-03 Pin Pixel 10 hardware inputs and release authority

**P0 · decision · AP-14**

Current: PR 379 selects Cuttlefish for image validation and Pixel 10 for the hardware build. Exact Pixel 10 SKU/device/kernel/vendor inputs and the release signer are not qualified by this integration.

Remaining: Close A-01/A-06 for Pixel 10: exact SKU/variant, Android version, device tree/blobs/kernel, signing/update custody and recovery/support owner. Keep Cuttlefish evidence separate; do not relabel another Pixel product. Preserve stock recovery and emergency access.

Done when: Named owners and immutable source/device/signer manifest sufficient for reproducible image and rollback work.

Evidence/source: [docs/prd.md](../docs/prd.md), [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md), [android/release-signer.json](../android/release-signer.json), [docs/implementation-plan.md](../docs/implementation-plan.md), [docs/on-device-agent-plan.md](../docs/on-device-agent-plan.md), [docs/android-and-aosp.md](../docs/android-and-aosp.md).

### MVP-04 Freeze services accounts and billing

**P1 · decision · AP-03, AP-04, AP-09**

Current: Production Android uses resident execution with Cloud sign-in and credit checks for billed inference. Direct Cerebras and browser/test-mocks remote transports remain separate development paths; service authorization is not live-qualified.

Remaining: Close A-02/A-07/A-16/A-20: confirm the billed inference endpoint, pilot account provisioning, Gmail scopes and usage semantics. Document any retained development provider profile separately. Retired phone pairing and hosted-agent enrollment are not production prerequisites.

Done when: Documented supported service matrix; approved non-secret operator provisioning procedure and matching real-service tests.

Evidence/source: [docs/decisions.md](../docs/decisions.md), [docs/cloud-production-validation.md](../docs/cloud-production-validation.md), [docs/implementation-plan.md](../docs/implementation-plan.md), [docs/on-device-agent-plan.md](../docs/on-device-agent-plan.md).

### MVP-05 Agree measurable voice latency acceptance

**P1 · decision · AP-06, AP-15**

Current: The six-second target and manual review requirement are inconsistent; this merge supplies no physical latency samples.

Remaining: Close A-10 with start/end boundaries, inclusion of review time, cold/warm definitions, percentile, task set and failure accounting. Wire real entrypoint marks rather than only helper-level records.

Done when: At least the agreed sample set per route/device, raw timings and failures retained; no fabricated first-audio mark.

Depends on: MVP-01.

Evidence/source: [docs/mvp-completion-plan.md](../docs/mvp-completion-plan.md), [apps/app/src/runtime/voice-timing.ts](../apps/app/src/runtime/voice-timing.ts), [scripts/aggregate-voice-latency.mjs](../scripts/aggregate-voice-latency.mjs).

### MVP-06 Set remaining optional feature boundaries

**P1 · decision · AP-10, AP-12**

Current: Several design surfaces exceed the frozen MVP.

Remaining: Disposition A-11 through A-19 and A-22: alarm ownership, passkeys, third-party cookies, trusted browsers, attachments/labels, secure camera, gallery scope, backup/erase and landscape. Keep optional features separate from mandatory release gates.

Done when: Each item has a chosen scope or explicit deferral, user-visible unavailable behavior and restoration gate.

Evidence/source: [docs/decisions.md](../docs/decisions.md), [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md).

### MVP-07 Refresh the requirement and evidence ledger

**P1 · documentation · AP-01, AP-02, AP-04, AP-05, AP-07**

Current: Current-status rows still describe no drawer, no offline entry, no browser transport and early draft consumption although this PR adds those paths; it also cites the previous pin and obsolete patch 0039.

Remaining: Reconcile requirements.json, current status, browser review and completion plan against the merged commit. Retain historical results as historical. Update the misleading pending A-04 and A-10 wording after voice policy is settled.

Done when: Every AP and retained F/J journey has current implementation, test class, exact source/artifact, remaining gate and owner; no old failure is called current without reproduction.

Depends on: MVP-01.

Evidence/source: [docs/mvp-current-status.md](../docs/mvp-current-status.md), [docs/requirements.json](../docs/requirements.json), [docs/mvp-browser-review.md](../docs/mvp-browser-review.md).

## Upstream and runtime integration

### MVP-08 Upstream the pin-only commit series

**P1 · integration · AP-04, AP-10, AP-11**

Current: The integration pin is merged upstream commit 4148a1660921a354ece2badf25a79a2398a51058, including the password manager and password transfer. The submodule and lock agree and the pin is reachable from develop. Consumer verification passes 443 tests with four TODOs, all eight password-manager browser cases pass, and both variants build with all four APK audits passing. These developer APKs omit the resident payload and use unqualified speech bytes; they are not distributable. Integrated native transfer and device acceptance remain pending. Earlier source, browser and native results remain scoped to their recorded commits.

Remaining: Complete the remaining retired-pin semantic audit and product-wide browser/native regressions. Release runtime, speech, signing and device acceptance remain separate.

Done when: Reviewed upstream disposition per commit, clean source preparation and full product regression at the replacement pin.

Evidence/source: [scripts/ci/upstream-reachability.json](../scripts/ci/upstream-reachability.json), [upstream.lock.json](../upstream.lock.json).

### MVP-09 Submit and retire explicit shared patches

**P1 · integration · AP-04, AP-10, AP-11**

Current: Alpha consumes the merged password-manager and password-transfer modules directly. The final reference patch and its manifest are removed; no applied or reference patch remains. The host registers password transfer and uses the shared count-only client. Integrated product qualification at the replacement pin remains pending.

Remaining: Finish the remaining upstream reviews and remove each patch only when its reviewed replacement is consumed.

Done when: Patch-to-upstream-PR ledger with exact output hashes, external-consumer tests and no duplicate or silently unapplied implementation.

Depends on: MVP-08.

Evidence/source: [password-provider-setup.md](password-provider-setup.md).

### MVP-10 Consume shared media implementation

**P1 · integration · AP-10**

Current: Alpha uses the shared owned-media module for photo edits, filters and capture publication, preserving alpha storage names and media paths. Both library variants and targeted host adapter compilation pass.

Remaining: Complete both APK builds and selected capture/edit/save-copy and installed-data instrumentation at this composition.

Done when: Both APK variants compile; selected capture/edit/save-copy and process-death instrumentation pass with exact output bytes.

Depends on: MVP-09.

Evidence/source: [android/settings.gradle](../android/settings.gradle), [upstream owned-media library](https://github.com/elizaOS/eliza/pull/34691).

### MVP-11 Consume shared notification journal and browser candidates

**P1 · integration · AP-11, AP-12**

Current: The shared notification mirror is included in Gradle behind Alpha storage/component identities. Browser policies use pinned helpers. Alpha delegates journal transitions to the shared engine and retains product result policy and Clock approval. Journal persistence, replay refusal and history redaction passed native tests in both variants.

Remaining: Qualify installed notification policy/history and browser sessions; finish site-permission consolidation without weakening receipt or owner semantics.

Done when: No duplicate effect or stale approval after migration; browser bridge isolation and notification privacy remain intact.

Depends on: MVP-09.

Evidence/source: [android/settings.gradle](../android/settings.gradle), [shared action journal](https://github.com/elizaOS/eliza/pull/34727).

### MVP-12 Finish foreground Calendar availability

**P1 · implementation · AP-09**

Current: Software path implemented; no Android run. A foreground executor is registered and `calendar.availability-read.v1` is negotiated on paired, Cloud and resident connections (not the browser development profile). The owner picks 1 to 16 calendars with none preselected, sees the exact free/busy result and shares it; the same read repeats before sharing and any difference fails with no result. Android reads only the chosen calendars from CalendarProvider with a projection limited to start, end, all-day, availability and status (`CalendarAvailabilityReader.java`), and the action journal has its own bounded policy for the answer; the browser build reads the in-app calendar. Free events are excluded, all-day events follow the owner's civil day, and a time-zone disagreement, denied permission, stale context or changed calendar fails closed. No title, calendar name or account enters the journal, receipt or chat. A proposal that cannot be reviewed from the current screen is named in chat instead of dropped. Evidence: Node, JVM (SQLite stand-in for CalendarProvider) and browser tests against synthetic agent routes. Android sources and `CalendarAvailabilityInstrumentedTest`: compiled by Gradle for both variants (developer and instrumentation APKs without the runtime payload); not run on an emulator or device. See [calendar availability](calendar-availability.md).

Remaining: Run the Android path on an emulator and a device: the instrumented reader test, the permission prompt (including WebView visibility while it shows), the review inside the WebView, synced and multi-account calendars, a declined invitation and a time-zone change mid-review. Produce and consume one availability receipt with a real agent. Owner to confirm two engineering defaults: cancelled events and declined invitations are not busy, and calendars at free/busy access level are offered. NEEDS upstream: an availability-carrying selected-calendar read in `plugin-native-calendar` so the Alpha-side reader can be removed, and a journal result bound that fits the 200-interval contract. The notes_search, notes_named, calendar_named and reminder_named reviews stay un-negotiated and fail closed.

Done when: Actual selected-provider result and exact receipt; free events excluded, all-day busy, no unrelated calendars or titles disclosed.

Evidence/source: [apps/app/src/runtime/device-actions.ts](../apps/app/src/runtime/device-actions.ts), [upstream device-review contracts](https://github.com/elizaOS/eliza/pull/34699), [docs/calendar-availability.md](../docs/calendar-availability.md), [apps/app/src/runtime/calendar-availability.ts](../apps/app/src/runtime/calendar-availability.ts), [android/app/src/main/java/ai/elizaresearch/alphaphone/CalendarAvailabilityReader.java](../android/app/src/main/java/ai/elizaresearch/alphaphone/CalendarAvailabilityReader.java).

### MVP-13 Finish folder notification and capture context selection

**P1 · implementation · AP-04, AP-10**

Current: Implemented in the renderer; no Android run. Folder identity is published as an opaque tree id with a session-local listing revision (never the provider string that embeds name and size), only while that folder is the visible Files subview. `Ask Alpha about this folder` reviews the loaded entry names and types of that one folder and reads it again before use, so a deleted, added, renamed or replaced entry or revoked access adds nothing. Own, unredacted notifications offer a reviewed question whose row is re-listed before the draft is placed; mirrored rows from other apps and lock-redacted rows offer none. Capture routing is corrected: Camera asks about the live frame, the Photos viewer about the exact open item (id and revision re-checked), and a typed Photos search is not treated as a capture. A saved photo or video is identified by a session-local revision instead of the library's added time and size; a renamed selected document gets a new revision. Evidence: Node and browser tests (`test/context-selection.test.mjs`, `test/browser/context-selection.spec.ts`); the folder revoke and withheld-notification cases are stubbed at the plugin boundary. See [context selection](context-selection.md).

Remaining: Android acceptance on an emulator and a device: SAF folder grants and revocation, MediaStore-backed Photos, the notification listener and the native Camera. A photo changed by another process during an open review is not detected until the library refreshes. On Android every Alpha notification is listed as own, so hosted-result notices offer the question there. Inbox mail context review was not re-audited.

Done when: Switch/delete/revoke during review cannot send a neighboring item; native Camera/Photos and folder selection complete their intended journey.

Evidence/source: [apps/app/src/prototype/native-adapter.ts](../apps/app/src/prototype/native-adapter.ts), [apps/app/src/prototype/camera-adapter.ts](../apps/app/src/prototype/camera-adapter.ts), [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md), [docs/context-selection.md](../docs/context-selection.md), [apps/app/src/prototype/context-selection.ts](../apps/app/src/prototype/context-selection.ts).

### MVP-14 Expose Use in email through the actual assistant UI

**P1 · implementation · AP-09**

Current: Implemented in the renderer; fixture evidence only. A finished plain agent reply offers `Use in email` in its message-actions menu while Inbox is the app behind the conversation. A review dialog shows the From account, the exact destination (reply, open draft or new email), the effect and the exact text. The destination is bound by a renderer-only token over the Cloud session, account, open message and its history id, and the draft's identity and content; a stale token, a changed reply or session, a locked phone or another app in front inserts nothing. Draft text is never replaced: an open draft that already has text only offers `Add below existing text`. Nothing is prepared or dispatched to the provider; sending still goes through the composer and the provider review. Selected Files and Photos are not attached (the documented picker-only policy, stated in the dialog). Evidence: `test/use-in-email-review.test.mjs`, sections 7 to 7c of `scripts/test-inbox-attention-flow.mjs` and `test/browser/use-in-email.spec.ts`, all with a synthetic Cloud client and agent.

Remaining: Acceptance on an installed APK and a device with a real Gmail account and a real agent reply, including TalkBack, system Back and the status-bar inset. No flag-off browser spec drives the control. The action is offered only while Inbox is behind the conversation. Owner decision still open (related to A-15): whether selected Files or Photos may ever become attachments of a suggestion.

Done when: A user can review and insert a suggestion into the intended draft; edited drafts are not overwritten and no message sends automatically.

Evidence/source: [apps/app/src/prototype/inbox-cloud-adapter.ts](../apps/app/src/prototype/inbox-cloud-adapter.ts), [apps/app/src/prototype/agent-adapter.ts](../apps/app/src/prototype/agent-adapter.ts), [apps/app/src/prototype/use-in-email-review.ts](../apps/app/src/prototype/use-in-email-review.ts), [apps/app/src/prototype/inbox-drafts.ts](../apps/app/src/prototype/inbox-drafts.ts), [docs/inbox-provider-completion-plan.md](../docs/inbox-provider-completion-plan.md).

### MVP-15 Complete full Trash recovery

**P1 · implementation · AP-10, AP-15**

Current: Implemented; browser and policy evidence, no Android run. Trash preserves notes and voice recordings for three days. A full Trash (policy limits or the native slot cap) refuses a deletion before any effect with a typed refusal and opens `Trash is full` with Cancel, Open Trash and a separately confirmed `Delete forever without Trash`. The permanent path removes only the exact refused record found in saved storage, under the deletion lock, with no Undo; a note changed since the refusal is left alone and another view's Trash copy is kept. A voice note's recording is erased only by the operation that owns its audio trash, and an interrupted permanent voice deletion stays under review and finishes once when Notes next renders. An approved agent notes_delete reports the refusal and never takes the permanent path. Lowered limits: an over-limit Trash stays readable, restorable and purgeable and only additions are refused (policy tests against the pinned upstream policy and a browser test). Expiry holds across a backwards clock, restarts and process death at the write-ahead and erase steps in the browser build. Three native backstop cases were added to `NotesTrashBackstopInstrumentedTest.java`: compiled by Gradle for both variants (developer and instrumentation APKs without the runtime payload); not run on an emulator or device.

Remaining: Run the full-Trash dialog, permanent delete, interrupted-erase recovery and the new instrumented cases on an emulator and a device. NEEDS upstream: `JsonCredentialSlots` read and write must admit an existing slot above a lowered limit and writes that shrink it, with the matching allowance in `AlphaCredentialStore.requireCapacity`; until then `notes-trash:v1:device` must not be lowered below 32 MiB. A clock moved forwards can still purge early (upstream wall-clock policy). An interrupted permanent voice deletion has no startup or native backstop. The ordinary move-to-Trash path can replace another browser view's newer Trash row from a stale view (browser build only). The byte-limit refusal is covered only in Node.

Done when: Full-storage recovery does not silently lose another note; deletion/restore/expiry converge for the exact text and audio under interruption. A document created under larger limits can be read and reduced under smaller limits; only new additions enforce capacity.

Depends on: MVP-09.

Evidence/source: [apps/app/src/prototype/notes-trash-adapter.ts](../apps/app/src/prototype/notes-trash-adapter.ts), [apps/app/src/prototype/agent-adapter.ts](../apps/app/src/prototype/agent-adapter.ts), [docs/browser-storage.md](../docs/browser-storage.md), [apps/app/src/runtime/notes-trash-policy.ts](../apps/app/src/runtime/notes-trash-policy.ts), [apps/app/src/prototype/voice-adapter.ts](../apps/app/src/prototype/voice-adapter.ts), [test/browser/notes-trash-recovery.spec.ts](../test/browser/notes-trash-recovery.spec.ts).

### MVP-16 Reuse the resident agent from the assistant surface

**P1 · implementation · AP-04, AP-05**

Current: Implemented in source; no Android run. `ResidentAttachment.java` decides whether a surface attaches to the running resident: only when the runtime is listening, nothing is retiring, the enrollment belongs to it and is not expiring, and the stored provider admission generation is the one the process launched with. An attach does not advance the epoch, clear the enrollment, pair, start the service or change launch ownership; it supersedes only the calling surface's own work, and any doubt falls back to the ordinary start. The renderer no longer stops and rebinds an unchanged Cloud provider when the assistant opens; the credit gate still runs first. Evidence: a JVM contract of the real class, a renderer contract and source guards (`test/resident-attachment.test.mjs`). `AssistantResidentReuseInstrumentedTest`: compiled by Gradle for both variants (developer and instrumentation APKs without the runtime payload); not run on an emulator or device.

Remaining: Run `AssistantResidentReuseInstrumentedTest` on both variants, then a packaged-runtime ARM64 campaign showing that a live inference stream and a real enrollment survive repeated assistant open and close (the instrumented test uses a synthetic runtime, enrollment and streams). Two surfaces that start before any enrollment exists still supersede each other; after the last surface is destroyed the next open pairs again. Whether re-registering the same installation disturbs the other surface's device work is unverified.

Done when: Native dual-Activity test records unchanged runtime identity, correct owned-work cancellation and preserved conversation across repeated assistant invocations.

Evidence/source: [apps/app/src/runtime/connection-ui.tsx](../apps/app/src/runtime/connection-ui.tsx), [apps/app/src/runtime/local-agent.ts](../apps/app/src/runtime/local-agent.ts), [android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java](../android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java), [android/app/src/main/java/ai/elizaresearch/alphaphone/ResidentAttachment.java](../android/app/src/main/java/ai/elizaresearch/alphaphone/ResidentAttachment.java), [test/resident-attachment.test.mjs](../test/resident-attachment.test.mjs).

### MVP-17 Qualify retained browser development transports

**P1 · integration · AP-03, AP-11**

Current: HTTPS remote browser transport exists as development infrastructure; direct Cloud sign-in is honestly unavailable for this origin. The development host has a separate credential-reference bridge. Synthetic flag-off coverage (test/browser/connection-boundaries.production.spec.ts): saved mock, staging, Cloud, plain-HTTP local, development and on-device selections open the chooser signed out with no request; refused pairings (wrong role, identity or instance mismatch, expired session, used code, pairing disabled, non-HTTPS address) store nothing and connect nothing; unverified device enrollment grants no phone actions; unconfirmed revocation is reported as unconfirmed.

Remaining: Record the supported browser development scope and qualify its account return, storage degradation, revoke and Automations behavior. Keep unsupported Cloud sign-in unavailable unless that route is separately approved and implemented with an admitted origin/server bridge. Do not add browser Cloud login as a production Android MVP prerequisite.

Done when: Flag-off browser can complete only advertised routes; host-only references never leak or masquerade as bearer tokens; account changes fence pending work.

Depends on: MVP-04.

Evidence/source: [apps/app/src/runtime/native-connection.ts](../apps/app/src/runtime/native-connection.ts), [apps/app/src/browser/cloud-connection.ts](../apps/app/src/browser/cloud-connection.ts), [apps/app/src/runtime/cloud-protocol.ts](../apps/app/src/runtime/cloud-protocol.ts), [docs/implementation-plan.md](../docs/implementation-plan.md), [docs/on-device-agent-plan.md](../docs/on-device-agent-plan.md).

### MVP-18 Wire missing native runner phases

**P1 · integration · AP-11**

Current: Runner phases wired; exercised only against a synthetic adb. `scripts/test-installed-upgrade.mjs` runs `WorkflowLegacyReminderUpgradeInstrumentedTest` on both distributions after the candidate verify phase and admits the candidate app and instrumentation APK as one verified pair from `artifacts/apk-manifest.json` before the device is leased. `scripts/android-workflow-native.mjs` runs both `WorkflowApprovalNoticeInstrumentedTest` methods on both distributions. Both runners re-check before any install that the archived bytes are still the admitted pair; receipts record the candidate hashes and the failed phase, and a skipped, failed or incomplete campaign exits non-zero. Evidence: `test/installed-upgrade-runner.test.mjs` and `test/native-campaign-evidence.test.mjs`. See [verification](verification.md).

Remaining: Run both runners on an emulator for both variants; no emulator run of either exists. Add a native phase for approval notices across process death and account change: only the JVM contract and the renderer's other-account routing cover them. The baseline pair is hash-pinned only for the duration of a run, and `scripts/android-instrumentation.mjs` has no registry entry for the two classes.

Done when: Runner executes both classes on both flavors; verifies exact scheduled item/approval across upgrade, process death, account change and notification tap.

Evidence/source: [scripts/test-installed-upgrade.mjs](../scripts/test-installed-upgrade.mjs), [android/app/src/androidTest/java/ai/elizaresearch/alphaphone](../android/app/src/androidTest/java/ai/elizaresearch/alphaphone), [scripts/android-workflow-native.mjs](../scripts/android-workflow-native.mjs), [docs/verification.md](../docs/verification.md).

### MVP-19 Complete the daily overview contract

**P1 · implementation · AP-07**

Current: Implemented in the renderer; synthetic provider data only. The Calendar card names its source and when this app read it, distinguishes a failed read, access off and not connected, leaves out calendars hidden in Calendar, and marks overdue reminders, which stay first. The Workflows card shows when its list loaded. The Inbox card shows the account and the last completed provider read, and Home still reads no mail. A fourth card shows the latest retained scheduled-digest result only when one is retained for the current connection; an occurrence recorded as missed, overlapping or unavailable is never shown as a brief, and showing or opening the card runs nothing. The flag-off build shows no fixture avatar or fake brief. Evidence: `test/home-cards.test.mjs`, `test/browser/home-daily-overview.spec.ts` and its production spec. See [daily overview](daily-overview.md).

Remaining: Real provider transitions on an installed APK and a device: real Gmail, the device CalendarProvider and a real scheduled digest, plus TalkBack reading of the new descriptions. No single test runs from an agent digest result to the card. An overdue reminder still hides the next event on the card, and the lookup of a device calendar's name has no test.

Done when: Real provider transitions render correctly; counts and times correspond to fetched data; no fixture avatar, fake brief or hidden mail fetch.

Evidence/source: [apps/app/src/prototype/data-adapter.ts](../apps/app/src/prototype/data-adapter.ts), [apps/app/src/prototype/template.html](../apps/app/src/prototype/template.html), [apps/app/src/prototype/inbox-cloud-adapter.ts](../apps/app/src/prototype/inbox-cloud-adapter.ts), [docs/daily-overview.md](../docs/daily-overview.md), [apps/app/src/prototype/home-cards.ts](../apps/app/src/prototype/home-cards.ts).

## Native and user journeys

### MVP-20 Qualify both installed variants and HOME

**P0 · acceptance · AP-02, AP-15**

Current: Four developer APK builds pass inspection; this is not installation or HOME-role evidence.

Remaining: Install source-matched standalone/HOME and paired instrumentation; test cold launch, role accept/deny/revoke, opening three installed apps, repeated HOME, stock settings/recovery, upgrade and default-role changes.

Done when: Current emulator reports for both flavors and separate physical run; no role trap or system emergency/recovery regression.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md), [scripts/android-instrumentation.mjs](../scripts/android-instrumentation.mjs).

### MVP-21 Qualify resident lifecycle and account isolation

**P0 · acceptance · AP-03, AP-04**

Current: Host/JVM fixtures exercise admission, owner context and credential retirement. They do not prove packaged native execution.

Remaining: Run resident start/restart, socket/auth/IPC, overlapping Activity teardown, credential replacement, logout, network loss, reboot, killed worker and pending native receipt recovery.

Done when: No old-owner output/action, duplicate effect or leaked process; current native runtime/process evidence and conversation IDs retained.

Depends on: MVP-20.

Evidence/source: [docs/local-agent-development.md](../docs/local-agent-development.md), [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

### MVP-22 Qualify chat draft history and navigation continuity

**P0 · acceptance · AP-05, AP-15**

Current: Source and browser tests cover pre-dispatch retention (no agent, expired session, offline setup, Stop before the post), unknown post-dispatch outcome, Stop with one cancel and one reconciliation shown in the chat, double submit, owner change mid-reply, history paging and restore on connect, reply/edit/truncate, and draft retention across Home, Back and a viewport resize.

Remaining: Exercise the same paths on the emulator HOME role and a target device: real soft-keyboard resize, system Back/Home, drawer/assistant overlays, resident restart mid-reply and concurrent owner changes.

Done when: Text survives every pre-dispatch failure; no implicit resend; selection/history/scroll remain bound to the intended conversation.

Depends on: MVP-20.

Evidence/source: [apps/app/src/prototype/agent-adapter.ts](../apps/app/src/prototype/agent-adapter.ts), [apps/app/src/runtime/local-agent.ts](../apps/app/src/runtime/local-agent.ts), [apps/app/src/runtime/remote-protocol.ts](../apps/app/src/runtime/remote-protocol.ts).

### MVP-23 Admit a functionally passing speech runtime

**P0 · acceptance · AP-06**

Current: Committed qualification has failed/pending functional acceptance. A later ARM64 candidate is evidence, not admitted bytes; x86_64 remains unqualified. Local available AAR hash differs from the committed runtime manifest.

Remaining: Rebuild with reviewed deterministic synthesis patch, execute unchanged functional suite on both ABIs, investigate failures and admit exact candidate/models/notices through the qualification process.

Done when: Both ABI reports match the artifact hash/source; manifests updated only from passing evidence; strict build accepts the same bytes.

Evidence/source: [android/local-speech/qualified-runtime-manifest.json](../android/local-speech/qualified-runtime-manifest.json), [android/local-speech/runtime-manifest.json](../android/local-speech/runtime-manifest.json), [scripts/local-speech/README.md](../scripts/local-speech/README.md).

### MVP-24 Run physical speech and interruption acceptance

**P0 · acceptance · AP-06, AP-15**

Current: No current human microphone/speaker/Bluetooth campaign was produced here.

Remaining: Qualify microphone permission/revoke, silence/long speech, corrections, audio focus, wired/Bluetooth routing, lock/background, cancel during ASR/TTS and stale playback. Test offline local speech if retained by policy.

Done when: Unedited physical audio evidence, no unintended upload or overlapping capture/playback, transcript/output quality and agreed latency samples.

Depends on: MVP-01, MVP-05, MVP-23.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md), [docs/combined-voice-roundtrip.md](../docs/combined-voice-roundtrip.md).

### MVP-25 Finish Notes and voice-recording lifecycle

**P1 · acceptance · AP-10**

Current: Text/checklist/link/voice notes and transactional recovery exist.

Remaining: Test creation/edit/search/import/export, native encryption, dictation selection, audio/save failure, summary revision, Trash/restore/expiry and installed-data upgrades on the release candidate.

Done when: Exact note/audio bytes survive promised transitions; failed writes remain unsaved; no duplicate note after retries or unrelated source disclosure.

Depends on: MVP-20, MVP-23.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md), [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md).

### MVP-26 Qualify Calendar CRUD and recurrence

**P1 · acceptance · AP-09**

Current: Native Calendar consumes the new pin plus direct-save options; browser fixtures do not prove Android provider state.

Remaining: Create/read-back/edit/delete in a real selected writable calendar; all-day, cross-midnight, DST, travel zone, recurrence scope, invitations/RSVP, read-only, revoke and lost response. Decide any unsupported required subflow explicitly.

Done when: Exact provider IDs/revisions and read-back, scoped invitations separately reviewed, no duplicate create after timeout.

Depends on: MVP-12, MVP-20.

Evidence/source: [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md), [apps/app/src/prototype/calendar-adapter.ts](../apps/app/src/prototype/calendar-adapter.ts).

### MVP-27 Qualify Reminders and Clock separately

**P1 · acceptance · AP-09, AP-11**

Current: Reminders have local schedules; Clock is a reviewed Android handoff, not confirmed ringing.

Remaining: Exercise lead None/numeric, snooze/complete/reopen/cancel, recurrence, reboot/timezone, permission/DND/Doze and force-stop. Separately observe Clock set/show/snooze/dismiss and actual ring/vibration.

Done when: Delivery receipts and exact deep links; no reminder-as-alarm guarantee; actual audible alarm evidence or approved scope change.

Depends on: MVP-06, MVP-20.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md), [docs/mvp-completion-plan.md](../docs/mvp-completion-plan.md).

### MVP-28 Qualify native Browser and downloads

**P1 · acceptance · AP-10**

Current: Persistent isolated normal tabs, ephemeral private tabs and reviewed downloads exist.

Remaining: Run sign-in/restart/private cleanup, pop-ups/app links, upload/download exact bytes, cookies across same/cross-origin redirects, closed private tab cancellation, provider errors and hostile content/bridge isolation.

Done when: Current installed WebView evidence; no credential forwarding to redirect origins; private history absent after close; exact authorized file only.

Depends on: MVP-20.

Evidence/source: [android/app/src/main/java/ai/elizaresearch/alphaphone/BrowserDownloads.java](../android/app/src/main/java/ai/elizaresearch/alphaphone/BrowserDownloads.java), [docs/browser-download-integration.md](../docs/browser-download-integration.md).

### MVP-29 Qualify integrated password manager and optional provider

**P0 · acceptance · AP-10**

Current: The pinned shared password module supplies native vault management and app Autofill. Three real Android consumer tests passed on a clean checkout at 352d7a0855, with exact APK hashes and cleanup evidence in upstream PR #34835. Integrated browser Autofill is unavailable because ordinary WebView lacks native per-field origins. Show and Copy remain available; successful browser filling is not qualified.

Remaining: On release-signed devices test enablement, synthetic credential save/update/fill, biometric unavailable/lock/cancel, exact top-level origin, iframe, app certificate, tab/process switch, disable/re-enable and optional Proton Pass.

Done when: No secret in model context/logs; correct-origin fill and wrong-origin refusal recorded. Passkeys remain separate until explicitly scoped and implemented.

Depends on: MVP-03, MVP-06, MVP-28.

Evidence/source: [docs/password-provider-setup.md](../docs/password-provider-setup.md), [docs/browser-autofill-integration.md](../docs/browser-autofill-integration.md).

### MVP-30 Qualify Files Camera Photos Scan and OCR

**P1 · acceptance · AP-10**

Current: Source implements selected media, browser/native paths, recent/search and scan/PDF handling.

Remaining: Run provider URI retention/revoke, native capture/cancel/retake, volume/low-storage, gallery refresh, non-destructive edits, exact share/export, video interruption and English OCR on real documents. Resolve category/capture selection gaps first.

Done when: Correct MIME/bytes/identity and recoverable failures; no privileged HTML execution or neighboring-image upload. Real OCR task quality documented.

Depends on: MVP-10, MVP-13, MVP-20.

Evidence/source: [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md), [docs/photos-owned-media.md](../docs/photos-owned-media.md).

### MVP-31 Finish regional Maps deployment and travel acceptance

**P1 · integration · AP-10**

Current: Route selection and guidance integration exists; source tests do not qualify production map data or physical navigation. The previous projection reported a point at longitude 179.5 on a route from 179 to -179 as 55.6 km off route. The pin includes the reviewed geodesic correction; integrated navigation acceptance remains open.

Remaining: Provision approved TLS endpoint and licensed data coverage, verify build configuration, location permission/accuracy, reroute/stale result, offline/no route, background navigation and stop behavior. The great-circle projection fix from [merged upstream PR 34650](https://github.com/elizaOS/eliza/pull/34650) is in the pin; qualify date-line/high-latitude routes and maneuver ordering.

Done when: J04 event-to-route on selected hardware with explicit origin/route, correct live guidance and truthful regional/offline limits. Date-line progress agrees with the existing geodesic distance calculation and never invents an off-route detour.

Depends on: MVP-04, MVP-20, MVP-09.

Evidence/source: [docs/maps-regional-validation.md](../docs/maps-regional-validation.md), [apps/app/src/prototype/maps-adapter.ts](../apps/app/src/prototype/maps-adapter.ts).

### MVP-32 Qualify workflows approvals and result delivery

**P1 · acceptance · AP-11, AP-12**

Current: Typed phone workflows are manual-triggered; digest scheduling and newer Automations have distinct contracts. Unknown outcomes are retained.

Remaining: Exercise generated candidate quality, Use/Save/Run separation, capability denial, approvals, cancellation, worker death, run history, pending effect/receipt gaps and migrated definitions. Do not advertise scheduled arbitrary workflows from digest support.

Done when: No duplicate external effect or invented receipt; every interrupted run has an explicit disposition and exact history on reconnect.

Depends on: MVP-18, MVP-21.

Evidence/source: [apps/app/src/runtime/phone-workflow-authoring.ts](../apps/app/src/runtime/phone-workflow-authoring.ts), [docs/mvp-current-status.md](../docs/mvp-current-status.md).

### MVP-33 Qualify settings and notification truthfulness

**P1 · acceptance · AP-12**

Current: Tiles and Settings rows read the Wi-Fi, Bluetooth, airplane mode, location, mobile data and Do Not Disturb states Android reports to an ordinary app, hand off to the matching Android page and re-read on return; unreported states are shown as a handoff. Channel and app-notification denial are read back from Android. About shows the packaged version and states that no update check exists. Diagnostics are redacted by construction. All of this has source and renderer-contract coverage on the flag-off bundle; physical state, each image's Settings pages and OS delivery are not established here.

Remaining: On an emulator and then a device, check each settings destination and readback (SettingsSystemFacts, SettingsNative, SettingsFlow, SettingsRoles and NotificationChannels instrumentation, then by hand), channel denial/re-enable, lock/Doze, exact result/reminder tap after death, revoke during work and the redacted export. Update availability needs an update authority (A-06) before anything can be shown. Keep mirroring off by default and outside MVP gate.

Done when: No simulated toggle or success; channel-disabled history still available; wrong-owner/deleted notification target fails safely.

Depends on: MVP-20, MVP-32.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md), [apps/app/src/prototype/settings-adapter.ts](../apps/app/src/prototype/settings-adapter.ts).

## Live integrations

### MVP-34 Qualify production Cloud inference and approved provider profiles

**P0 · deployment · AP-03, AP-04**

Current: Synthetic transports and historical local inference do not establish the current release service path.

Remaining: Operator provisions approved production Cloud accounts/credits; verify actual Qwen model, provider health, expiry/revoke/wrong owner, credit failure/top-up and account replacement during requests. Qualify direct Cerebras only as a separately retained profile. Keep credentials out of logs and audit artifacts.

Done when: Current source-bound real round trip, correct billing/model identity and controlled recovery; no inference-ready claim from a saved credential alone.

Depends on: MVP-04, MVP-21.

Evidence/source: [docs/cloud-production-validation.md](../docs/cloud-production-validation.md), [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

### MVP-35 Deploy and authorize Gmail end to end

**P0 · deployment · AP-09**

Current: Historical code exchange returned 401. Client and synthetic Gmail routes cover many operations, but deployed managed endpoints and real mailbox behavior remain open.

Remaining: Resolve OAuth exchange/approved redirect, deploy supported route/capability versions, consent least scopes, load threads/attachments, account-switch/revoke, provider drafts and archive/trash/read-state.

Done when: Real selected mailbox read and mutation receipts, correct scope/account isolation and no unsupported controls.

Depends on: MVP-04.

Evidence/source: [docs/cloud-production-validation.md](../docs/cloud-production-validation.md), [apps/app/src/runtime/cloud-protocol.ts](../apps/app/src/runtime/cloud-protocol.ts).

### MVP-36 Qualify email send and ambiguous outcomes

**P0 · acceptance · AP-09**

Current: Client supports reviewed provider-bound sends; fixture sends do not establish external delivery.

Remaining: After explicit authorization for the exact test recipient/message, verify To/Cc/Bcc/From, attachments, reply/forward, sent receipt and lost-response reconciliation. Cover changed draft and incorrect returned provider ID.

Done when: Exactly one authorized delivery; uncertain result never auto-resends; local draft remains distinct from provider draft.

Depends on: MVP-14, MVP-35.

Evidence/source: [docs/mvp-completion-plan.md](../docs/mvp-completion-plan.md), [apps/app/src/runtime/inbox-operation.ts](../apps/app/src/runtime/inbox-operation.ts).

### MVP-37 Verify retired phone pairing and retained development boundaries

**P1 · acceptance · AP-03, AP-04**

Current: PR 379 retires production Android phone pairing and adds a controller guard. Browser and test-mocks transports remain for development; existing credentials/history must be preserved. connectRemote now refuses every caller on production Android and the native transport rejects the pairing route (ConnectionRoutes.java, JVM-tested and compiled, not run in an APK). A stubbed-bridge production-bundle test shows a saved remote, local or Cloud-agent selection is neither paired nor restored, its credential slot is not written or removed, and a Cloud sign-in starts the resident agent instead.

Remaining: Verify flag-off Android rejects pairing without network mutation or automatic reconnection, preserves old remote credentials/history, and uses resident execution with Cloud provider authorization. Qualify retained browser/test-mocks transport ownership, expiry, revoke and recovery separately. Real hosted-agent deployment is optional scope, not a phone MVP prerequisite.

Done when: Production Android cannot pair or silently restore a remote primary agent; old data remains intact. Retained development transports cannot bypass owner, expiry or device-action boundaries.

Depends on: MVP-04, MVP-21.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md), [apps/app/src/runtime/remote-protocol.ts](../apps/app/src/runtime/remote-protocol.ts), [docs/implementation-plan.md](../docs/implementation-plan.md), [docs/on-device-agent-plan.md](../docs/on-device-agent-plan.md).

### MVP-38 Qualify digests under the approved execution policy

**P1 · acceptance · AP-07, AP-11**

Current: Local durable scheduling and hosted-result controls exist. The proposed resident missed-occurrence replacement for powered-off hosted loops still needs an explicit acceptance disposition.

Remaining: Implement the selected A-09 path: resident missed-run recovery, or separately authorized hosted execution if that scope is retained. Exercise morning/evening input provenance, worker restart, duplicate occurrence, revoke/edit/disable/overlap/DST and reconnect acknowledgements.

Done when: Distinct source-backed terminal outputs and exactly one visible delivery per occurrence, under the approved scope.

Depends on: MVP-02, MVP-34, MVP-35.

Evidence/source: [docs/mvp-completion-plan.md](../docs/mvp-completion-plan.md), [apps/app/src/runtime/hosted-digests.ts](../apps/app/src/runtime/hosted-digests.ts), [docs/implementation-plan.md](../docs/implementation-plan.md), [docs/on-device-agent-plan.md](../docs/on-device-agent-plan.md).

## Release and security

### MVP-39 Stage the complete admitted resident runtime

**P0 · release · AP-02, AP-04**

Current: Source-only runtime preparation and developer builds are not packaged-runtime qualification.

Remaining: Build/bundle the pinned resident runtime and workflow worker, stage native executable/assets/policy, generate packaged notices and source stamps, then run strict android:build and verify-apks for both flavors.

Done when: All four intended distribution artifacts pass strict checks with no unpackaged/unqualified overrides; installed resident uses those exact bytes.

Depends on: MVP-23.

Evidence/source: [scripts/prepare-local-agent.mjs](../scripts/prepare-local-agent.mjs), [scripts/stage-local-agent-runtime.mjs](../scripts/stage-local-agent-runtime.mjs), [scripts/build-android.mjs](../scripts/build-android.mjs).

### MVP-40 Produce controlled signed artifacts and verified links

**P0 · release · AP-14**

Current: This review built unsigned releases; release-signer.json is not qualified. Custom scheme callback is not verified HTTPS App Links.

Remaining: Operator sets release signer/version, protects key custody, publishes approved assetlinks for the real host, enables reviewed manifest filter and verifies installed link association.

Done when: Signed exact APK hashes/certificate/version and working domain verification on both variants; no secrets in the evidence bundle.

Depends on: MVP-03, MVP-39.

Evidence/source: [android/release-signer.json](../android/release-signer.json), [android/app/src/main/assetlinks.template.json](../android/app/src/main/assetlinks.template.json), [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

### MVP-41 Build and boot the full AOSP product

**P0 · release · AP-14**

Current: Cuttlefish is the selected virtual image validation target; Pixel 10 is the hardware build target. APK compilation proves neither image build nor boot. Separately owned AOSP work remains outside this review.

Remaining: On the separate Linux builder, lock Cuttlefish source/tools and matching host package, stage admitted signed Alpha artifacts, build and boot the full image. Separately admit exact Pixel 10 device/kernel/vendor inputs and build its product; no Pixel 10 installer before admission and no relabeled Pixel 11/tegu/grizzly target.

Done when: Cuttlefish build IDs, hashes, source lock and boot evidence cover product placement, signer, HOME, resident startup, authenticated inference, approvals, history and recovery. Pixel 10 has independently verified source/build evidence; physical flashing, hardware and signed recovery acceptance remain separate gates.

Depends on: MVP-03, MVP-40.

Evidence/source: [docs/architecture.md](../docs/architecture.md), [docs/prd.md](../docs/prd.md), [docs/implementation-plan.md](../docs/implementation-plan.md), [docs/on-device-agent-plan.md](../docs/on-device-agent-plan.md), [docs/android-and-aosp.md](../docs/android-and-aosp.md).

### MVP-42 Prove signed upgrade rollback and data preservation

**P0 · release · AP-14, AP-15**

Current: No current signed OTA/recovery drill is supplied by this review.

Remaining: Upgrade from agreed installed baselines including old mock selection; verify namespaces/Keystore/data migrations, interrupted update, rollback authorization, recovery and support runbook.

Done when: Observed recovery on selected device with preserved promised data and no reopened mock surface or replayed side effect.

Depends on: MVP-40, MVP-41.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

### MVP-43 Resolve Denton distribution rights

**P0 · release · AP-01, AP-14**

Current: Denton is still listed in the unverified license allowlist despite the PRD naming Fraunces.

Remaining: Obtain valid app/web embedding rights and record evidence, or replace bundled Denton usage with the approved open fallback and recheck layout. Verify all shipped fonts/models/native dependencies.

Done when: No unresolved commercial font rights in a distributable artifact; notice inventory matches final packaged bytes.

Evidence/source: [licenses/unverified-allowlist.json](../licenses/unverified-allowlist.json), [scripts/generate-licenses.mjs](../scripts/generate-licenses.mjs), [docs/decisions.md](../docs/decisions.md).

### MVP-44 Requalify privacy and outbound redaction

**P0 · acceptance · AP-03, AP-04, AP-10**

Current: Native launches enable upstream secret/PII swapping; host defaults differ. Synthetic filters are not a universal secret detector.

Remaining: Run source-matched resident redaction on emulator then device; probe browser vault/OTP/recovery content including plain text, selected notes/mail/files, diagnostics and connection changes. Audit actual launch config and outbound boundaries.

Done when: No test secret exits its allowed boundary; approved-context provenance and per-route processing/retention disclosures match execution.

Depends on: MVP-21, MVP-29, MVP-34.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md), [docs/market-research/13-redaction-integration.md](../docs/market-research/13-redaction-integration.md).

### MVP-45 Triage dependency and artifact supply chain findings

**P1 · security · AP-03, AP-14**

Current: npm install reported 3 moderate and 1 high audit findings; counts are advisory and not an exploitability disposition.

Remaining: Identify exact affected dependency paths/reachability, apply compatible fixes or reviewed time-bounded exceptions, check native/model provenance and release SBOM. Do not blindly upgrade the pinned platform.

Done when: Recorded vulnerability dispositions and reproducible locked dependencies, with relevant regressions passing.

Evidence/source: [package-lock.json](../package-lock.json), [upstream.lock.json](../upstream.lock.json), [scripts/generate-licenses.mjs](../scripts/generate-licenses.mjs).

### MVP-46 Install the agreed required-check ruleset

**P1 · administration · AP-14**

Current: Ruleset preparation exists; repository enforcement is a separate administrative state.

Remaining: Have repository owner review/install the intended required contexts and protection rules; ensure renamed/sharded checks cannot be omitted or bypassed silently.

Done when: Read-back of enforced rules and a controlled PR demonstrating missing/failing checks prevent merge.

Evidence/source: [scripts/ci](../scripts/ci), [test/ci-required-checks.test.mjs](../test/ci-required-checks.test.mjs).

### MVP-47 Run final exact-head qualification

**P0 · qualification · AP-01, AP-02, AP-03, AP-04, AP-05, AP-06, AP-07, AP-09, AP-10, AP-11, AP-12, AP-14, AP-15**

Current: Current review results qualify only their named source and evidence classes. release-05/release-15 and final merged-main qualification remain separate from branch CI.

Remaining: After all relevant fixes, run full repository/browser/storage-engine/native/runtime/build/release gates on the exact selected merge/release commit and archive immutable APK/test pairs and logs. Resolve every failure rather than inheriting past green totals.

Done when: All required gates pass for one recorded candidate; exceptions are explicit approved scope changes, not unexplained skips.

Depends on: MVP-39, MVP-40, MVP-44, MVP-45.

Evidence/source: [docs/mvp-current-status.md](../docs/mvp-current-status.md), [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

## Pilot and handoff

### MVP-48 Complete accessibility and resilience acceptance

**P0 · acceptance · AP-15**

Current: Renderer software pass done in Chromium; no device campaign is recorded. A dependency-free audit (`test/browser/accessibility-audit.ts`) checks names, roles, focus, contrast, 24px targets, clipping and tab order over the live, fixture and subview states of every retained view in light and dark, at an emulated 200% text size and in 915x412 landscape, and over the flag-off bundle; a coverage guard fails if a retained view or scrim popup leaves the sweep. Fixed from it: Camera controls in landscape, Maps sheets, the Browser find bar, dark-theme connection buttons, the recovery screen (it scrolls, dismisses orphan dialogs and focuses Reload), ten menus and sheets that left the page in the tab order, an unannounced toast, and clipping at 200% text. Supported sizes and limits are in [renderer accessibility checks](accessibility-renderer-checks.md).

Remaining: Device acceptance is entirely open: test every retained primary view, subview and error state with TalkBack, Switch Access, physical large font (WebView text zoom differs from the emulation), keyboard and touch, rotation, gesture navigation, offline, process death and full storage on selected hardware. Known software gaps: titles shortened at 200% text (Camera, Photos, the Home calendar card), a focused control can sit partly under the floating composer, a toast raised under a top-layer dialog is not announced, and landscape with 200% text and provider-connected states are not swept. Landscape policy remains owner decision A-22.

Done when: Independent task completion without inaccessible primary controls or persistent crash/ANR on selected hardware.

Depends on: MVP-06, MVP-20.

Evidence/source: [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md), [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md), [docs/accessibility-renderer-checks.md](../docs/accessibility-renderer-checks.md), [test/browser/accessibility-sweep.spec.ts](../test/browser/accessibility-sweep.spec.ts).

### MVP-49 Execute all five cross-app journeys

**P1 · acceptance · AP-07, AP-09, AP-10, AP-11**

Current: J01 poster-to-calendar, J02 voice-to-note/reminder, J03 document analysis, J04 schedule-to-travel and J05 web-research-to-note have source-level pieces.

Remaining: Run each end to end with real selected data, explicit source review, separate save/effect approval, changed-source rejection and recovery on the final device image. Record unsupported subflows rather than substituting a mock.

Done when: Unedited demonstrations and exact receipts/source identities; no automatic send/save or silently changed source.

Depends on: MVP-24, MVP-25, MVP-26, MVP-30, MVP-31, MVP-35.

Evidence/source: [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md).

### MVP-50 Provision four units and obtain user acceptance

**P0 · acceptance · AP-14, AP-15**

Current: The pilot runbook still has four pending unit rows.

Remaining: Provision four independently identified units, record image/APK/runtime/model/signer versions, execute mandatory journeys/performance/stability per unit, agree P0/P1 definitions and resolve the issue list with stakeholders.

Done when: Four complete evidence manifests, no open blocking defect, explicit target-user acceptance and named support/recovery owner.

Depends on: MVP-41, MVP-42, MVP-47, MVP-48, MVP-49.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

### MVP-51 Deliver reproducible operational handoff

**P1 · delivery · AP-14**

Current: Source and runbooks are available but do not constitute a completed pilot handoff.

Remaining: Deliver reviewed upstream references, app/OS build and provisioning instructions, dependency/license inventory, service/backend guide, privacy/retention statements, release manifests, backup/export policy, rollback instructions, demos and final issue dispositions.

Done when: An independent operator can rebuild/provision/recover and execute acceptance without undocumented credentials or steps.

Depends on: MVP-50.

Evidence/source: [docs/mvp-completion-plan.md](../docs/mvp-completion-plan.md), [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

## Platform scope

### MVP-52 Resolve and implement AOSP listening and hardware invocation

**P0 · decision and implementation · AP-06, AP-12, AP-14**

Current: decisions.md includes an AOSP always-on-listening direction requiring a new ADR; a foreground microphone button or ACTION_ASSIST Activity does not implement it.

Remaining: Confirm its release scope, approve the narrowly privileged listener architecture that supersedes the nonprivileged rule only where required, then implement consent, mic indicator, stop/revoke, lock/background behavior and supported hardware-key invocation. Do not turn it on implicitly.

Done when: Approved ADR/scope disposition; image/device privacy, battery, audio-focus, screen-lock and reliable stop evidence for each retained entrypoint.

Depends on: MVP-01, MVP-03, MVP-41.

Evidence/source: [docs/decisions.md](../docs/decisions.md), [docs/market-research/12-aosp-always-on-listening.md](../docs/market-research/12-aosp-always-on-listening.md), [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

### MVP-53 Close the complete installed-app library behavior

**P1 · implementation and acceptance · AP-01, AP-02, AP-15**

Current: Implemented in source; no Android run. Entries are launcher activities identified by package, activity and Android user (`LauncherLibrary.java`), and a launch re-resolves that exact component and is refused with a reason when the row is stale, after which the drawer re-reads the device. Entries from other profiles are listed with their profile and locked state and are refused while paused or locked. An open drawer re-reads on package and profile changes and when Alpha returns to the foreground. Rows that share a label show their package, activity or profile. Favorites and their order persist in WebView storage and are shown only for entries the device lists now. Evidence: `test/home-launcher.test.mjs` and `test/browser/home-app-library.spec.ts` against a native stub. Android sources and `LauncherLibraryInstrumentedTest`: compiled by Gradle for both variants (developer and instrumentation APKs without the runtime payload); not run on an emulator or device. Details are in the MVP-53 software status section at the end of this document.

Remaining: Emulator and physical HOME-role runs; a real work profile (paused, locked and unlocked), private space and clone profile; real install, remove and disable while the drawer is open; return from three native apps, HOME while a task runs, and rotation. `LauncherHomeInstrumentedTest` matches the exact label `Open Settings` and needs checking on an image with two Settings entries. Favorites live only in the drawer and do not move to a new phone. NEEDS upstream: make `SystemLauncherApps` component- and profile-aware so `LauncherLibrary.java` can be replaced. Launcher landscape behavior remains owner decision A-22 (MVP-06).

Done when: Source-matched installed app tests and physical role acceptance; exact intended package/component opens and stale inventory cannot create fabricated success.

Depends on: MVP-06, MVP-20.

Evidence/source: [docs/implementation-plan.md](../docs/implementation-plan.md), [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md), [apps/app/src/prototype/home-launcher.ts](../apps/app/src/prototype/home-launcher.ts), [android/app/src/main/java/ai/elizaresearch/alphaphone/LauncherLibrary.java](../android/app/src/main/java/ai/elizaresearch/alphaphone/LauncherLibrary.java).

## Suggested sequence for the next workflow

1. Resolve MVP-01 through MVP-06 and refresh the requirement ledger. Most native qualification can proceed independently of optional scope decisions.
2. Complete upstream/module and foreground integration in MVP-08 through MVP-19; deploy the approved account/service paths in MVP-34 through MVP-38.
3. Admit speech and packaged runtime, then sign a candidate. Run source/browser checks continuously and native acceptance on immutable artifact pairs.
4. Qualify the selected full image, update/recovery, privacy, accessibility and cross-app journeys.
5. Run final exact-head qualification and the four-unit pilot; deliver operational handoff.

For each work item, the future workflow should record a named owner, dependencies, branch/PR, exact source/artifact identity, acceptance commands or human procedure, evidence class, result, and any explicit scope decision. A source test, APK build, emulator HOME test, full AOSP boot, real service exchange and physical/user acceptance are separate result fields. None substitutes for another.

## MVP-53 software status, 2026-10-10

Implementation added on branch `claude/r2-app-library`; acceptance parts stay open.

- Entries are launcher activities identified by package, activity and Android user (`LauncherLibrary.java`); labels never identify. Same-label entries show their package, activity or profile.
- A launch re-resolves the exact component and is refused with a reason (`not-installed`, `disabled`, `no-launcher`, `profile-locked`, `profile-unavailable`) when the row is stale; the drawer then re-reads the device. A failed read clears the list.
- Favorites and their order are saved on the device (`alpha.launcher.favorites.v1`) and shown only for entries the device lists now.
- An open drawer re-reads on Android package/profile changes (`appsChanged`) and when Alpha returns to the foreground.
- Evidence: `test/home-launcher.test.mjs`, `test/browser/home-app-library.spec.ts` (native stub, not Android). The Android sources, including `LauncherLibraryInstrumentedTest.java`, were compiled with `javac` against the SDK only: no Gradle build, lint, APK, emulator or phone run.
- Other profiles list real launcher activities only: Alpha's own copy and Android's app-details stand-in for apps without a launcher activity are left out and refused.
- Still open: emulator and physical HOME-role runs, a real work profile (paused and locked), real install/remove, return from three native apps, and launcher landscape behavior (A-22 owner decision).
- Review additions, 2026-10-10: rows that would still read alike get their full identity (package, activity, profile number); a Phone shortcut whose handler is gone is re-resolved after the refused open; native `launch` rejects a non-text `activityName` or `user` instead of reading it as absent. Same evidence class as above: Node and stubbed-bridge browser tests, `javac` only for Android.
- Integration, 2026-10-10: `npm run android:build -- --allow-unpackaged-runtime` compiled these sources and `LauncherLibraryInstrumentedTest` into developer and instrumentation APKs for both variants (no runtime payload, unqualified local speech runtime). This is APK-build evidence only: still no lint, emulator or phone run.
