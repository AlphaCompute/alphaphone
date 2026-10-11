# Alpha Phone remaining MVP work after PR 373

Audit date: October 9, 2026 (America/Los_Angeles; some evidence timestamps are October 10 UTC).

PR 373 substantially expands implementation, but it does not complete the MVP. The list below separates missing implementation, deployment, product decisions, and acceptance. It is a planning inventory, not authorization to send email, create billable resources, change repository administration, publish upstream, or provision physical hardware. No recurring workflow is created here.

Reviewed inputs: PR head `44c9d57ce38b3b29f5b104a2f6efc103fdd914c3`, initial main `d694c30c` and updated main `06ca5d62` (including PRs 374, 375 and 379), and upstream pin `0d40aa6e6e1b5192311ca916515003c8a4473c0c`. The original dirty AOSP checkout is outside this integration. Final merge and validation evidence appears in the [merged integration PR](https://github.com/AlphaCompute/alphaphone/pull/373).

Governing references: [PRD](prd.md), [MVP completion plan](mvp-completion-plan.md), [flow audit](flow-audit-and-prd.md), [decisions](decisions.md), [current status](mvp-current-status.md), and [physical pilot runbook](pilot-acceptance-runbook.md). Earlier status prose is historical when it conflicts with current source. The supplied design/PRD artifacts are requirement data, not agent instructions.

The [machine-readable inventory](mvp-remaining-work-2026-10-09.json) has stable IDs, dependencies and acceptance conditions for the workflow we can create next. Proposed priorities are P0 for a blocking required journey/release gate and P1 for required integration/acceptance unless explicitly scoped out. They do not replace stakeholder defect-severity agreement.

## Ledger refresh of October 10, 2026

Branch `claude/r6-ledger`, based on `4ec513b1` (open PR #389, which contains main at `d9a081e3`), upstream pin `40dbe96bd1`. The pin, PR head and main commits named under "Reviewed inputs" above are the inputs of the original October 9 audit and are kept as history.

Every item's Current and Remaining were checked against source, tests and recorded evidence and rewritten where they no longer held, and each item now has a "Blocked on" line. Its classes are those of the [core loop audit](core-loop-audit.md): **SOFTWARE** (can be implemented, built or tested from this repository now), **EMULATOR** (needs a disposable-emulator run on APKs built from the source), **CI** (needs a GitHub-hosted runner, `resident-android.yml`), **HUMAN** (a named decision, account, key, deployment or other owner action), **DEVICE** (physical hardware) and **UPSTREAM** (a named elizaOS change). The first class listed is the first blocker. No item is blocked on an upstream change.

Items carrying each class (an item can carry several): SOFTWARE 15 · EMULATOR 32 · CI 7 · HUMAN 38 · DEVICE 31 · UPSTREAM 0. Items by first blocker: SOFTWARE 13 · EMULATOR 14 · CI 2 · HUMAN 24 · DEVICE 0 · UPSTREAM 0.

MVP-12 to 16, 18, 19, 48 and 53 are **implemented on open PR #388, not on main**. Their Current and Remaining text below is the pre-PR-388 text and is rewritten by that pull request; only the "Blocked on" line was added here. Until it merges, none of them is current on main.

No emulator, hosted CI, real-integration or device result exists at the current source. An emulator campaign is in progress on branch `claude/r3-packaging`; at `73b973a5` it has committed no result record. "No run is recorded" below means exactly that. What only the owner can do is listed in [owner actions](mvp-owner-actions.md); `test/docs-inventory-consistency.test.mjs` keeps this file and the JSON in agreement.

## Scope retained and deferred

Gmail, integrated passwords, persistent normal/private browser profiles, three-day Notes Trash, English OCR, both APK distributions, resident execution, signed image/recovery and physical acceptance remain in scope. Phone/SMS/Contacts/Wallet and Telegram/Discord stay deferred; preserve stock emergency facilities and retained user data. Cross-app notification mirroring is opt-in, off by default and not an MVP gate. Fully offline LLM inference and an unrestricted workflow IDE are not established requirements. Passkeys, secure lock-screen camera, full-gallery access and expanded media work need their recorded scope dispositions.

PR 379 further selects Cuttlefish image validation and a Pixel 10 hardware build, and retires production Android phone pairing. Browser/test-mocks remote transports are development infrastructure. These dispositions are reflected in MVP-03/04/17/37/41; physical acceptance and phone-off execution policy remain separate.

## Important changes to the old gap list

The incoming PR adds app-drawer/search, offline local-app entry, browser remote transport, pre-dispatch draft retention, abort/history recovery, diagnostics and substantial native/browser feature work. Do not reopen those as wholly unimplemented merely because older current-status rows say so. (Current status was refreshed on October 10 and now describes them.) They still need integrated/device acceptance. Calendar patch 0039 is already in the new pin. Main's newer Cloud voice, native credential retirement, original-room Notes replies, navigation ownership and Automations were retained during conflict resolution.

Voice remains a policy conflict: P-07 in decisions.md now says Cloud; AP-06 and other documents still say local-first/manual review, while current chat voice sends ongoing turns. No source-test pass resolves that disagreement. The four incoming manual-entry scenarios remain explicitly TODO pending disposition; they are not counted as passing voice acceptance.


## Product decisions

### MVP-01 Reconcile voice send and route policy

**P0 · decision · AP-06**
Blocked on: HUMAN: owner decision on voice send and route policy (reconcile P-01, P-07 and PRD AP-06, with pending A-04 and A-24).

Current: Flag-off builds select Eliza Cloud speech unconditionally (apps/app/src/runtime/voice-selection.ts; its own comment says this differs from P-01/P-07 as the PRD states them and needs a decision). decisions.md P-07 names Cloud as the default for chat voice, Notes transcription and read-aloud; P-01 requires record, transcribe, review, then the user sends; an ongoing Cloud conversation sends each new spoken turn (test/browser/chat-voice-mode.spec.ts). The PRD's AP-06 row still says local first with Cloud as a disclosed opt-in, and its closing section says on-device speech remains required on Android. The four manual-entry scenarios are test.todo entries in test/voice-entry-timing.test.mjs, not passing tests.

Remaining: The owner chooses the authoritative policy for chat, Notes, read-aloud and browser, including whether on-device speech is still required (A-24); then reconcile the PRD, decisions, completion plan, Settings, implementation and tests. Do not silently equate optional local code with a production local route.

Done when: One dated approved policy; all entrypoints and cancellation/consent tests match it; no unsupported latency claim.

Evidence/source: [docs/prd.md](../docs/prd.md), [docs/decisions.md](../docs/decisions.md), [apps/app/src/runtime/voice-selection.ts](../apps/app/src/runtime/voice-selection.ts), [apps/app/src/prototype/voice-adapter.ts](../apps/app/src/prototype/voice-adapter.ts), [test/voice-entry-timing.test.mjs](../test/voice-entry-timing.test.mjs).

### MVP-02 Resolve powered-off execution A-09

**P0 · decision · AP-11**
Blocked on: HUMAN: decision A-09.

Current: Resident schedules cannot execute on a powered-off phone, and hosted execution while the phone is off does not exist. A scheduled time that passes while the host is not running is recorded once as missed and never run later, and a missed record never replaces the last brief (test/digest-occurrence-delivery.test.mjs, test/browser/dev-digest-schedule.spec.ts, test/browser/journey-d-digests.spec.ts; development scheduler, class S). The flag-off Android panel says schedules run on the phone and cannot run while it is off (test/browser/journey-core-loops.production.spec.ts).

Remaining: The owner either formally amends the DoD to resident missed-occurrence recovery or funds two genuinely hosted loops. Under the amendment, the remaining evidence is emulator and device (MVP-38); under hosted loops, the service does not exist.

Done when: Approved amendment and corresponding evidence, or two distinct hosted terminal results while the phone remains powered off and one delivery each on reconnect.

Evidence/source: [docs/mvp-completion-plan.md](../docs/mvp-completion-plan.md), [docs/decisions.md](../docs/decisions.md).

### MVP-03 Pin Pixel 10 hardware inputs and release authority

**P0 · decision · AP-14**
Blocked on: HUMAN: decisions A-01 (exact SKU, Android version, device inputs) and A-06 (signing owner, release key, update and rollback authority).

Current: docs/android-and-aosp.md names Cuttlefish as the image validation target and Pixel 10 as the hardware build target. The exact Pixel 10 SKU, Android version and device, kernel and vendor inputs are not admitted. android/release-signer.json records signerSha256 "unset" and no last release, so no release can be marked distributable.

Remaining: Close A-01/A-06 for Pixel 10: exact SKU/variant, Android version, device tree/blobs/kernel, signing/update custody and recovery/support owner. Keep Cuttlefish evidence separate; do not relabel another Pixel product. Preserve stock recovery and emergency access.

Done when: Named owners and immutable source/device/signer manifest sufficient for reproducible image and rollback work.

Evidence/source: [docs/prd.md](../docs/prd.md), [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md), [android/release-signer.json](../android/release-signer.json), [docs/implementation-plan.md](../docs/implementation-plan.md), [docs/on-device-agent-plan.md](../docs/on-device-agent-plan.md), [docs/android-and-aosp.md](../docs/android-and-aosp.md).

### MVP-04 Freeze services accounts and billing

**P1 · decision · AP-03, AP-04, AP-09**
Blocked on: HUMAN: decisions A-02, A-07, A-15, A-16, A-20 and A-26.

Current: Production Android uses resident execution with Eliza Cloud sign-in and credit checks for billed inference. With test mocks off the native transport admits only https://api.eliza.app (ConnectionRoutes.java, JVM-tested, not run in an APK), so no Android build reaches a Cloud agent host. Direct Cerebras and browser/test-mocks remote transports remain separate development paths. No real Cloud sign-in, credit check or Gmail grant has been exercised; the Google code exchange returns 401 (docs/cloud-production-validation.md).

Remaining: Close A-02, A-07, A-15, A-16, A-20 and A-26: confirm the billed inference endpoint, pilot account provisioning, Gmail scopes and usage semantics. Document any retained development provider profile separately. Retired phone pairing and hosted-agent enrollment are not production prerequisites.

Done when: Documented supported service matrix; approved non-secret operator provisioning procedure and matching real-service tests.

Evidence/source: [docs/decisions.md](../docs/decisions.md), [docs/cloud-production-validation.md](../docs/cloud-production-validation.md), [docs/implementation-plan.md](../docs/implementation-plan.md), [docs/on-device-agent-plan.md](../docs/on-device-agent-plan.md).

### MVP-05 Agree measurable voice latency acceptance

**P1 · decision · AP-06, AP-15**
Blocked on: HUMAN: decision A-10, after MVP-01; DEVICE: latency samples on the selected phone.

Current: The six-second target and the manual review requirement are inconsistent. No latency sample exists for any route or device. Timing helpers and an aggregation script exist (apps/app/src/runtime/voice-timing.ts, scripts/aggregate-voice-latency.mjs); the entry-point marks they need are among the test.todo cases in test/voice-entry-timing.test.mjs.

Remaining: Close A-10 with start/end boundaries, inclusion of review time, cold/warm definitions, percentile, task set and failure accounting. Wire real entrypoint marks rather than only helper-level records.

Done when: At least the agreed sample set per route/device, raw timings and failures retained; no fabricated first-audio mark.

Depends on: MVP-01.

Evidence/source: [docs/mvp-completion-plan.md](../docs/mvp-completion-plan.md), [apps/app/src/runtime/voice-timing.ts](../apps/app/src/runtime/voice-timing.ts), [scripts/aggregate-voice-latency.mjs](../scripts/aggregate-voice-latency.mjs).

### MVP-06 Set remaining optional feature boundaries

**P1 · decision · AP-10, AP-12**
Blocked on: HUMAN: decisions A-11 to A-19, A-22 and A-25.

Current: Several design surfaces exceed the frozen MVP. Current behavior for each is stated in decisions.md: alarms are a handoff to Android Clock (A-11), passkeys are not implemented (A-12), third-party cookies are blocked (A-13), only the Alpha browser is trusted for fills (A-14), no secure camera (A-17), Photos shows only Alpha-captured media (A-18), no backup and no in-app erase (A-19), and the app rotates with a landscape layout for Home only (A-22). Four further decisions were recorded on 2026-10-10: a production Maps provider (A-23), whether on-device speech is still required (A-24), recoverability of deleted Calendar events and reminders (A-25) and Cloud agent host admission on Android (A-26).

Remaining: The owner dispositions A-11 through A-19, A-22 and A-25. A-23 belongs to MVP-31, A-24 to MVP-01 and MVP-23, and A-26 to MVP-04. Keep optional features separate from mandatory release gates.

Done when: Each item has a chosen scope or explicit deferral, user-visible unavailable behavior and restoration gate.

Evidence/source: [docs/decisions.md](../docs/decisions.md), [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md).

### MVP-07 Refresh the requirement and evidence ledger

**P1 · documentation · AP-01, AP-02, AP-04, AP-05, AP-07**
Blocked on: SOFTWARE: reconcile docs/mvp-browser-review.md and docs/mvp-completion-plan.md, and take PR #388's inventory entries when it merges; HUMAN: voice policy decision (MVP-01) before the A-04, A-10 and AP-06 wording is final.

Current: Refreshed on 2026-10-10 against upstream pin 40dbe96bd1 from source, tests and recorded evidence: docs/mvp-current-status.md, docs/requirements.json, this inventory, the evidence statements in docs/decisions.md, and the false statements in README.md, docs/ci-cost-policy.md and docs/prd.md. docs/mvp-owner-actions.md lists what only the owner can do. test/docs-requirements-consistency.test.mjs and test/docs-inventory-consistency.test.mjs keep the ledgers and the two inventory files in agreement.

Remaining: docs/mvp-browser-review.md and docs/mvp-completion-plan.md were not reconciled in this refresh. The A-04, A-10 and PRD AP-06 wording cannot be made final until the voice policy is settled (MVP-01). The entries for MVP-12 to 16, 18, 19, 48 and 53 keep their pre-PR-388 text here and are rewritten by that pull request.

Done when: Every AP and retained F/J journey has current implementation, test class, exact source/artifact, remaining gate and owner; no old failure is called current without reproduction.

Depends on: MVP-01.

Evidence/source: [docs/mvp-current-status.md](../docs/mvp-current-status.md), [docs/requirements.json](../docs/requirements.json), [docs/mvp-browser-review.md](../docs/mvp-browser-review.md).

## Upstream and runtime integration

### MVP-08 Upstream the pin-only commit series

**P1 · integration · AP-04, AP-10, AP-11**
Blocked on: SOFTWARE: reviewed pin move for upstream pull request 34888, then an APK build at that pin; EMULATOR: default instrumentation campaign at the pin.

Current: The pin is elizaOS commit 40dbe96bd1fc2603aaff655cd52d0ab899704e2c: upstream.lock.json and the submodule agree, and scripts/ci/upstream-reachability.json records it as identical to develop on 2026-10-10 with no pin-only commit and 25 merged upstream pull requests. It includes the password manager, password transfer and Keystore text frames. Repository verification at this pin is recorded in docs/mvp-current-status.md. No APK build and no emulator run is recorded at this pin; the last developer APK builds are at product commit 1de85a13 (pin 4148a166) and are not distributable. Upstream pull request 34888 (shared notification delivery receipts) merged after the pin and is not consumed.

Remaining: Move the pin to consume upstream pull request 34888 when it is reviewed, build the four APKs at the resulting pin and run the product-wide browser and native regressions. Whether the retired-pin semantic audit named by the original item was completed is not re-verified at this source. Release runtime, speech, signing and device acceptance remain separate.

Done when: Reviewed upstream disposition per commit, clean source preparation and full product regression at the replacement pin.

Evidence/source: [scripts/ci/upstream-reachability.json](../scripts/ci/upstream-reachability.json), [upstream.lock.json](../upstream.lock.json).

### MVP-09 Submit and retire explicit shared patches

**P1 · integration · AP-04, AP-10, AP-11**
Blocked on: EMULATOR: native qualification of the consumed modules at the pin.

Current: No patch remains. The patches directory and the patch tooling are gone (9475074c, PR #385) and Alpha consumes the merged password-manager, password-transfer and Keystore modules directly from the pin. The host registers password transfer and uses the shared count-only client.

Remaining: Nothing is left to submit or retire. Integrated native qualification of the consumed modules at the pin remains (password transfer has browser-fixture evidence only). Two upstream changes identified by the core-loop audit are not submitted: the native Calendar review dialog should name the account and state that no attendees change, and Gmail search pages should carry a mailbox revision; neither blocks a step.

Done when: Patch-to-upstream-PR ledger with exact output hashes, external-consumer tests and no duplicate or silently unapplied implementation.

Depends on: MVP-08.

Evidence/source: [password-provider-setup.md](password-provider-setup.md).

### MVP-10 Consume shared media implementation

**P1 · integration · AP-10**
Blocked on: EMULATOR: photo and capture instrumentation on APKs built at the current pin.

Current: Alpha uses the shared owned-media module for photo edits, filters and capture publication, preserving alpha storage names and media paths. Compilation at the current pin is not re-verified at this source. Seven photo-filter preview and export cases passed on an emulator at d3dc9977 (pin 945209d3); that result is historical.

Remaining: Build both APK variants at the current pin and run the capture, edit, save-copy and installed-data instrumentation (PhotoEdit, PhotoFilter, PhotosBatch, PhotosTrash, PhotosMultiShare, Video and CameraScan are registered with the runner; no run is recorded at the current source).

Done when: Both APK variants compile; selected capture/edit/save-copy and process-death instrumentation pass with exact output bytes.

Depends on: MVP-09.

Evidence/source: [android/settings.gradle](../android/settings.gradle), [upstream owned-media library](https://github.com/elizaOS/eliza/pull/34691).

### MVP-11 Consume shared notification journal and browser candidates

**P1 · integration · AP-11, AP-12**
Blocked on: EMULATOR: journal, notification and browser-session instrumentation at the current pin.

Current: The shared notification mirror is included in Gradle behind Alpha storage and component identities. Browser policies use pinned helpers. Alpha delegates journal transitions to the shared engine and retains product result policy and Clock approval. Journal persistence, replay refusal and history redaction passed native tests in both variants at d3dc9977 (pin 945209d3); that result is historical. Notification approval receipts reject a stored digest that does not match their content (PR #385).

Remaining: Qualify installed notification policy and history and browser sessions at the current pin (ActionJournal, Notifications, HostedResultNotice, BrowserSignins and the browser storage-format campaign; no run is recorded at the current source); finish site-permission consolidation without weakening receipt or owner semantics.

Done when: No duplicate effect or stale approval after migration; browser bridge isolation and notification privacy remain intact.

Depends on: MVP-09.

Evidence/source: [android/settings.gradle](../android/settings.gradle), [shared action journal](https://github.com/elizaOS/eliza/pull/34727).

### MVP-12 Finish foreground Calendar availability

**P1 · implementation · AP-09**
Blocked on: SOFTWARE: implemented on open PR #388, not on main; EMULATOR: CalendarAvailabilityInstrumentedTest (on that pull request) has never run; HUMAN: owner confirms the two busy defaults named in PR #388 (cancelled and declined events are not busy, and free/busy-level calendars are offered).

Current: Contracts and review presentation recognize calendar_availability. The native guard includes availability in its snapshot, but the product execution path is not complete.

Remaining: Carry free/busy availability through provider reads, implement bounded foreground selection/execution, filter only authorized calendars, and return no event titles. Handle all-day, timezone, permission and stale-context cases.

Done when: Actual selected-provider result and exact receipt; free events excluded, all-day busy, no unrelated calendars or titles disclosed.

Evidence/source: [apps/app/src/runtime/device-actions.ts](../apps/app/src/runtime/device-actions.ts), [upstream device-review contracts](https://github.com/elizaOS/eliza/pull/34699).

### MVP-13 Finish folder notification and capture context selection

**P1 · implementation · AP-04, AP-10**
Blocked on: SOFTWARE: implemented on open PR #388, not on main; EMULATOR: folder grants, MediaStore Photos, notification listener and native Camera paths have never run; DEVICE.

Current: Selection contracts exist, but folder/notification selections are not fully wired. native-adapter passes a generic wrapper to askAboutCapture while its public function expects an item identity.

Remaining: Audit every retained source adapter, preserve exact selected identity/revision, implement folder and notification review scope, and correct native capture/category routing. Keep unsupported operations visibly unavailable.

Done when: Switch/delete/revoke during review cannot send a neighboring item; native Camera/Photos and folder selection complete their intended journey.

Evidence/source: [apps/app/src/prototype/native-adapter.ts](../apps/app/src/prototype/native-adapter.ts), [apps/app/src/prototype/camera-adapter.ts](../apps/app/src/prototype/camera-adapter.ts), [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md).

### MVP-14 Expose Use in email through the actual assistant UI

**P1 · implementation · AP-09**
Blocked on: SOFTWARE: implemented on open PR #388, not on main; HUMAN: Gmail grant (MVP-35) and the attachment question under A-15; DEVICE.

Current: Inbox defines useInEmail, but no other product caller is present in the audited tree. A helper test is not a visible control.

Remaining: Connect the reviewed assistant result to the exact selected email/local draft, with conflict protection and account identity. Clarify whether selected Files/Photos become attachments or require the picker.

Done when: A user can review and insert a suggestion into the intended draft; edited drafts are not overwritten and no message sends automatically.

Evidence/source: [apps/app/src/prototype/inbox-cloud-adapter.ts](../apps/app/src/prototype/inbox-cloud-adapter.ts), [apps/app/src/prototype/agent-adapter.ts](../apps/app/src/prototype/agent-adapter.ts).

### MVP-15 Complete full Trash recovery

**P1 · implementation · AP-10, AP-15**
Blocked on: SOFTWARE: implemented on open PR #388, not on main; EMULATOR: NotesTrashBackstop and NotesStorageDurability have never run; DEVICE.

Current: Trash preserves notes and voice recordings for three days. Full storage currently refuses deletion and directs the user to empty Trash.

Remaining: Add the separately confirmed permanent-delete escape where required, preserving exact note/audio ownership and failure recovery. Qualify expiry across process death and clock changes. Qualify the consumed upstream capacity fix: existing Trash must remain readable, restorable and purgeable after a later host lowers its limits. Current limits are unchanged; the fix merged in [upstream PR 34649](https://github.com/elizaOS/eliza/pull/34649) and is included in the pin.

Done when: Full-storage recovery does not silently lose another note; deletion/restore/expiry converge for the exact text and audio under interruption. A document created under larger limits can be read and reduced under smaller limits; only new additions enforce capacity.

Depends on: MVP-09.

Evidence/source: [apps/app/src/prototype/notes-trash-adapter.ts](../apps/app/src/prototype/notes-trash-adapter.ts), [apps/app/src/prototype/agent-adapter.ts](../apps/app/src/prototype/agent-adapter.ts), [docs/browser-storage.md](../docs/browser-storage.md).

### MVP-16 Reuse the resident agent from the assistant surface

**P1 · implementation · AP-04, AP-05**
Blocked on: SOFTWARE: implemented on open PR #388, not on main; EMULATOR: AssistantResidentReuseInstrumentedTest (on that pull request) has never run; DEVICE.

Current: ACTION_ASSIST has its own renderer/bridge; startup still follows resident connection admission. Per-Activity cancellation was preserved in this merge.

Remaining: Separate attaching to an admitted running resident from restarting it. Opening/closing assistant must not retire Home work, enroll another owner or restart active inference.

Done when: Native dual-Activity test records unchanged runtime identity, correct owned-work cancellation and preserved conversation across repeated assistant invocations.

Evidence/source: [apps/app/src/runtime/connection-ui.tsx](../apps/app/src/runtime/connection-ui.tsx), [apps/app/src/runtime/local-agent.ts](../apps/app/src/runtime/local-agent.ts), [android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java](../android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java).

### MVP-17 Qualify retained browser development transports

**P1 · integration · AP-03, AP-11**
Blocked on: HUMAN: decision A-02 (whether remote pairing stays a supported route) and a real private remote host to pair with.

Current: HTTPS remote browser transport exists as development infrastructure; direct Cloud sign-in is honestly unavailable for this origin. The development host has a separate credential-reference bridge. Synthetic flag-off coverage (test/browser/connection-boundaries.production.spec.ts): saved mock, staging, Cloud, plain-HTTP local, development and on-device selections open the chooser signed out with no request; refused pairings (wrong role, identity or instance mismatch, expired session, used code, pairing disabled, non-HTTPS address) store nothing and connect nothing; unverified device enrollment grants no phone actions; unconfirmed revocation is reported as unconfirmed.

Remaining: Record the supported browser development scope. Its account return, storage degradation, revoke and Automations behavior have synthetic flag-off coverage only; no real private remote host has been paired. Keep unsupported Cloud sign-in unavailable unless that route is separately approved and implemented with an admitted origin/server bridge. Do not add browser Cloud login as a production Android MVP prerequisite.

Done when: Flag-off browser can complete only advertised routes; host-only references never leak or masquerade as bearer tokens; account changes fence pending work.

Depends on: MVP-04.

Evidence/source: [apps/app/src/runtime/native-connection.ts](../apps/app/src/runtime/native-connection.ts), [apps/app/src/browser/cloud-connection.ts](../apps/app/src/browser/cloud-connection.ts), [apps/app/src/runtime/cloud-protocol.ts](../apps/app/src/runtime/cloud-protocol.ts), [docs/implementation-plan.md](../docs/implementation-plan.md), [docs/on-device-agent-plan.md](../docs/on-device-agent-plan.md).

### MVP-18 Wire missing native runner phases

**P1 · integration · AP-11**
Blocked on: SOFTWARE: implemented on open PR #388, not on main (on main WorkflowApprovalNotice has a runner registry entry and WorkflowLegacyReminderUpgrade is listed as run by no runner); EMULATOR: neither runner has run on an emulator.

Current: WorkflowLegacyReminderUpgradeInstrumentedTest and WorkflowApprovalNoticeInstrumentedTest exist without the required runner coverage.

Remaining: Add installed-upgrade coverage and an approval-notice phase, including immutable APK/test pairing and explicit failure propagation.

Done when: Runner executes both classes on both flavors; verifies exact scheduled item/approval across upgrade, process death, account change and notification tap.

Evidence/source: [scripts/test-installed-upgrade.mjs](../scripts/test-installed-upgrade.mjs), [android/app/src/androidTest/java/ai/elizaresearch/alphaphone](../android/app/src/androidTest/java/ai/elizaresearch/alphaphone).

### MVP-19 Complete the daily overview contract

**P1 · implementation · AP-07**
Blocked on: SOFTWARE: implemented on open PR #388, not on main; HUMAN: Gmail grant (MVP-35) for real Inbox data; DEVICE.

Current: Main Home cards use current Calendar, workflow/automation and loaded Inbox metadata. The PR Home summary helper does not by itself prove every source/timestamp/brief reaches this newer layout.

Remaining: Map the requirement to actual cards: source attribution, freshness, loading/empty/error/retry, overdue reminders and latest retained brief. Preserve the no-background-mail-read boundary unless policy explicitly changes.

Done when: Real provider transitions render correctly; counts and times correspond to fetched data; no fixture avatar, fake brief or hidden mail fetch.

Evidence/source: [apps/app/src/prototype/data-adapter.ts](../apps/app/src/prototype/data-adapter.ts), [apps/app/src/prototype/template.html](../apps/app/src/prototype/template.html), [apps/app/src/prototype/inbox-cloud-adapter.ts](../apps/app/src/prototype/inbox-cloud-adapter.ts).

## Native and user journeys

### MVP-20 Qualify both installed variants and HOME

**P0 · acceptance · AP-02, AP-15**
Blocked on: EMULATOR: default campaign and `--variants launcher --home-role --classes SettingsRoles,LauncherHome`; DEVICE: physical HOME, recovery and emergency routes.

Current: No APK build is recorded at the current pin, so nothing is installed. The instrumentation runner has a HOME-role phase (--home-role) that selects the launcher APK as HOME on an owned emulator, requires a cold start through the HOME key, runs SettingsRoles (role removed, declined and accepted) and LauncherHome (drawer search, three installed apps with HOME returning each time, stock dialer, Android Settings and the default-Home chooser) and restores the original holder; both classes are refused without it. The phase is tested against a scripted adb only (test/android-instrumentation-runner.test.mjs). No run is recorded at the current source.

Remaining: Build source-matched standalone and launcher APKs with their instrumentation, then run the default campaign and the HOME-role campaign on an owned emulator; then cold launch, role changes, stock settings and recovery, upgrade and default-role changes on a phone.

Done when: Current emulator reports for both flavors and separate physical run; no role trap or system emergency/recovery regression.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md), [scripts/android-instrumentation.mjs](../scripts/android-instrumentation.mjs).

### MVP-21 Qualify resident lifecycle and account isolation

**P0 · acceptance · AP-03, AP-04**
Blocked on: CI: dispatch resident-android.yml (jobs native and recovery-ui) on the candidate commit; HUMAN: owner-only Cerebras key file for the resident instrumentation; DEVICE: reboot, network loss and lock on a phone.

Current: Host and JVM fixtures exercise admission, owner context and credential retirement. They do not prove packaged native execution. The process-kill classes (PrivateResidentSocket, ResidentStreamTransport, ResidentWorkflowCrash) and the credential-slot class (Connection) run only in the two dispatch-only jobs of .github/workflows/resident-android.yml, which refuse to run outside a GitHub-hosted x86_64 runner; no passing run of either job is recorded. ResidentService with real inference needs an arm64 emulator and an owner-only Cerebras key file (scripts/android-resident-instrumentation.mjs); no run is recorded at the current source.

Remaining: Run resident start/restart, socket/auth/IPC, overlapping Activity teardown, credential replacement, logout, network loss, reboot, killed worker and pending native receipt recovery.

Done when: No old-owner output/action, duplicate effect or leaked process; current native runtime/process evidence and conversation IDs retained.

Depends on: MVP-20.

Evidence/source: [docs/local-agent-development.md](../docs/local-agent-development.md), [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

### MVP-22 Qualify chat draft history and navigation continuity

**P0 · acceptance · AP-05, AP-15**
Blocked on: EMULATOR: chat continuity on an installed APK (Shell includes a soft-keyboard layout check, Assistant and Flow are registered, none has a recorded run); DEVICE.

Current: Source and browser tests cover pre-dispatch retention (no agent, expired session, offline setup, Stop before the post), unknown post-dispatch outcome, Stop with one cancel and one reconciliation shown in the chat, double submit, owner change mid-reply, history paging and restore on connect, reply/edit/truncate, and draft retention across Home, Back and a viewport resize.

Remaining: Exercise the same paths on an installed APK with the HOME role and on a target device: real soft-keyboard resize, system Back/Home, drawer/assistant overlays, resident restart mid-reply and concurrent owner changes. No instrumentation result exists for these at the current source.

Done when: Text survives every pre-dispatch failure; no implicit resend; selection/history/scroll remain bound to the intended conversation.

Depends on: MVP-20.

Evidence/source: [apps/app/src/prototype/agent-adapter.ts](../apps/app/src/prototype/agent-adapter.ts), [apps/app/src/runtime/local-agent.ts](../apps/app/src/runtime/local-agent.ts), [apps/app/src/runtime/remote-protocol.ts](../apps/app/src/runtime/remote-protocol.ts).

### MVP-23 Admit a functionally passing speech runtime

**P0 · acceptance · AP-06**
Blocked on: HUMAN: decision A-24; EMULATOR: LocalSpeechInstrumentedTest on arm64-v8a and on an x86_64 host.

Current: Committed qualification is failed: android/local-speech/qualified-runtime-manifest.json records functionalAcceptance.passed false (LocalSpeechInstrumentedTest, 1 of 2 failed on arm64-v8a; x86_64 not executed). A later arm64 candidate is recorded but not admitted. Flag-off builds do not use on-device speech (P-07), and whether it is still required is pending decision A-24. A rebuild of the runtime at pin 352d7a08 is described on branch claude/r3-packaging (scripts/local-speech/README.md at 73b973a5) as source and build evidence only, with both ABIs not executed; it is not on main.

Remaining: If A-24 keeps on-device speech required: rebuild at the current pin, execute the unchanged functional suite on arm64-v8a and on an x86_64 emulator or device (this host is arm64 and no workflow runs the test), and admit the exact candidate through the qualification process. If A-24 drops the requirement, retire the distribution build's qualified-speech input instead.

Done when: Both ABI reports match the artifact hash/source; manifests updated only from passing evidence; strict build accepts the same bytes.

Evidence/source: [android/local-speech/qualified-runtime-manifest.json](../android/local-speech/qualified-runtime-manifest.json), [android/local-speech/runtime-manifest.json](../android/local-speech/runtime-manifest.json), [scripts/local-speech/README.md](../scripts/local-speech/README.md).

### MVP-24 Run physical speech and interruption acceptance

**P0 · acceptance · AP-06, AP-15**
Blocked on: HUMAN: decisions MVP-01 and A-10; DEVICE: physical microphone, speaker and Bluetooth campaign.

Current: No current human microphone/speaker/Bluetooth campaign was produced here.

Remaining: Qualify microphone permission/revoke, silence/long speech, corrections, audio focus, wired/Bluetooth routing, lock/background, cancel during ASR/TTS and stale playback. Test offline local speech if retained by policy.

Done when: Unedited physical audio evidence, no unintended upload or overlapping capture/playback, transcript/output quality and agreed latency samples.

Depends on: MVP-01, MVP-05, MVP-23.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md), [docs/combined-voice-roundtrip.md](../docs/combined-voice-roundtrip.md).

### MVP-25 Finish Notes and voice-recording lifecycle

**P1 · acceptance · AP-10**
Blocked on: EMULATOR: `--classes NotesTrashBackstop,NotesStorageDurability,NotesSecureStorage` and `scripts/test-native-restart.mjs notes`; DEVICE.

Current: Text, checklist, link and voice notes and transactional recovery exist. In the browser build a saved voice note offers a calendar event draft and created records link back to the note (test/browser/note-calendar-handoff.spec.ts), and a full Trash refuses a deletion without losing data (test/browser/notes-trash-full.spec.ts). The native classes NotesTrashBackstop, NotesStorageDurability and NotesSecureStorage are registered with the runner and the notes restart campaign exists; no run is recorded at the current source.

Remaining: Test creation/edit/search/import/export, native encryption, dictation selection, audio/save failure, summary revision, Trash/restore/expiry and installed-data upgrades on the release candidate.

Done when: Exact note/audio bytes survive promised transitions; failed writes remain unsaved; no duplicate note after retries or unrelated source disclosure.

Depends on: MVP-20, MVP-23.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md), [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md).

### MVP-26 Qualify Calendar CRUD and recurrence

**P1 · acceptance · AP-09**
Blocked on: EMULATOR: `scripts/test-calendar-regression.mjs --case=CalendarCrudInstrumentedTest`, then `--case=CalendarAgentCrudInstrumentedTest`; DEVICE: a real synced calendar account.

Current: Native Calendar comes from the pinned upstream plugin plus direct-save options; whether it compiles at the current pin is not re-verified at this source. The browser review of an agent calendar change states the calendar and account, the times in the event's zone against the phone's, the all-day state and attendees (test/calendar-agent-review.test.mjs, test/browser/journey-b-voice-note-actions.spec.ts); on Android the second review is the plugin's own dialog, which names the calendar and the time but not the account or attendees. Browser fixtures do not prove Android provider state, and CalendarCrud and CalendarAgentCrud have no run at the current source.

Remaining: Create/read-back/edit/delete in a real selected writable calendar; all-day, cross-midnight, DST, travel zone, recurrence scope, invitations/RSVP, read-only, revoke and lost response. Decide any unsupported required subflow explicitly.

Done when: Exact provider IDs/revisions and read-back, scoped invitations separately reviewed, no duplicate create after timeout.

Depends on: MVP-12, MVP-20.

Evidence/source: [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md), [apps/app/src/prototype/calendar-adapter.ts](../apps/app/src/prototype/calendar-adapter.ts).

### MVP-27 Qualify Reminders and Clock separately

**P1 · acceptance · AP-09, AP-11**
Blocked on: EMULATOR: `--classes ClockHandoff,ClockRepeatDays,ReminderLifecycle`, `--classes RealClock --clock-exclusive`, `scripts/test-reminder-one-off.mjs`, `scripts/test-reminder-recovery.mjs`; CI: ClockAgentReview and ReminderTapProcessDeath in resident-android.yml job recovery-ui; HUMAN: decision A-11; DEVICE: audible ringing, vibration and Do Not Disturb.

Current: Reminders have local schedules; Clock is a reviewed Android handoff, not confirmed ringing. On the stubbed Android path one approval sends one handoff, a cancelled review sends nothing, a time-zone change retires the request and a missing Clock app is reported without claiming an alarm (test/browser/journey-core-loops.production.spec.ts). ClockHandoff, ClockRepeatDays, RealClock and ReminderLifecycle are registered with the runner and the one-off and recovery reminder campaigns exist; no run is recorded at the current source.

Remaining: Exercise lead None/numeric, snooze/complete/reopen/cancel, recurrence, reboot/timezone, permission/DND/Doze and force-stop. Separately observe Clock set/show/snooze/dismiss and actual ring/vibration.

Done when: Delivery receipts and exact deep links; no reminder-as-alarm guarantee; actual audible alarm evidence or approved scope change.

Depends on: MVP-06, MVP-20.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md), [docs/mvp-completion-plan.md](../docs/mvp-completion-plan.md).

### MVP-28 Qualify native Browser and downloads

**P1 · acceptance · AP-10**
Blocked on: EMULATOR: default campaign, the BrowserReading classes, BrowserPageQuestion, `--test-mocks --classes BrowserDownload,BrowserFlow` and `scripts/test-native-restart.mjs signin`; DEVICE.

Current: Persistent isolated normal tabs, ephemeral private tabs and reviewed downloads exist. The runner covers BrowserSignins, BrowserFlow, BrowserContinuity, BrowserDownload, the four BrowserReading classes and BrowserPageQuestion, and the restart runner has the signin case for sign-in persistence and private-tab cleanup; no run is recorded at the current source. The last recorded download pass is "Build47, 2026-09-30" with no commit.

Remaining: Run sign-in/restart/private cleanup, pop-ups/app links, upload/download exact bytes, cookies across same/cross-origin redirects, closed private tab cancellation, provider errors and hostile content/bridge isolation.

Done when: Current installed WebView evidence; no credential forwarding to redirect origins; private history absent after close; exact authorized file only.

Depends on: MVP-20.

Evidence/source: [android/app/src/main/java/ai/elizaresearch/alphaphone/BrowserDownloads.java](../android/app/src/main/java/ai/elizaresearch/alphaphone/BrowserDownloads.java), [docs/browser-download-integration.md](../docs/browser-download-integration.md).

### MVP-29 Qualify integrated password manager and optional provider

**P0 · acceptance · AP-10**
Blocked on: EMULATOR: `--test-mocks --classes BrowserAutofill` and `--classes PasswordBrowserFill`; HUMAN: decision A-06 (release signer), decisions A-12 and A-14, and a Proton Pass test vault with synthetic credentials; DEVICE: release-signed device.

Current: The pinned shared password module supplies native vault management and app Autofill. Three Android consumer tests passed upstream at 352d7a0855 (upstream pull request 34835). Integrated browser Autofill is unavailable because ordinary WebView lacks native per-field origins; Show and Copy remain available. Alpha's own native save and fill flow was recorded at d3dc9977 as failing before save or unlock and has not been re-run. BrowserAutofill (test-mocks APK) and PasswordBrowserFill are registered with the runner; no run is recorded at the current source. No release signer exists, so nothing can be qualified on a release-signed device.

Remaining: On release-signed devices test enablement, synthetic credential save/update/fill, biometric unavailable/lock/cancel, exact top-level origin, iframe, app certificate, tab/process switch, disable/re-enable and optional Proton Pass.

Done when: No secret in model context/logs; correct-origin fill and wrong-origin refusal recorded. Passkeys remain separate until explicitly scoped and implemented.

Depends on: MVP-03, MVP-06, MVP-28.

Evidence/source: [docs/password-provider-setup.md](../docs/password-provider-setup.md), [docs/browser-autofill-integration.md](../docs/browser-autofill-integration.md).

### MVP-30 Qualify Files Camera Photos Scan and OCR

**P1 · acceptance · AP-10**
Blocked on: EMULATOR: `--classes CameraScan,FilesTree`, `scripts/test-native-restart.mjs document`, `scripts/test-native-permissions.mjs camera`; DEVICE: physical camera, real documents and storage volumes.

Current: Source implements selected media, browser and native paths, recent and search, and scan and PDF handling. Native Camera offers image selection into scan review and the multi-page scan builder (apps/app/src/prototype/camera-adapter.ts, scan-document.ts). CameraScan and FilesTree are registered with the runner and the document restart and camera permission campaigns exist; no run is recorded at the current source. The capture and category selection gaps are closed on open PR #388, not on main (MVP-13).

Remaining: Run provider URI retention/revoke, native capture/cancel/retake, volume/low-storage, gallery refresh, non-destructive edits, exact share/export, video interruption and English OCR on real documents. Resolve category/capture selection gaps first.

Done when: Correct MIME/bytes/identity and recoverable failures; no privileged HTML execution or neighboring-image upload. Real OCR task quality documented.

Depends on: MVP-10, MVP-13, MVP-20.

Evidence/source: [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md), [docs/photos-owned-media.md](../docs/photos-owned-media.md).

### MVP-31 Finish regional Maps deployment and travel acceptance

**P1 · integration · AP-10**
Blocked on: HUMAN: decision A-23, then an HTTPS Maps gateway supplied as VITE_MAPS_BASE_URL; EMULATOR: `scripts/maps/test-native-recovery.mjs` and `scripts/maps/test-native-navigation.mjs` against the regional fixture gateway; DEVICE: GPS navigation.

Current: No flag-off build has a Maps provider: VITE_MAPS_BASE_URL is unset and the emulator gateway exists only in test-mocks builds (apps/app/src/maps/regional-provider.ts), so a production user reads "Connect a Maps provider to search places and plan routes." and no route is produced. With a synthetic provider, an event's address enters Maps once, several candidates wait for a choice, "Back to event" returns to the originating event and the travel-mode buttons expose their state (test/browser/journey-j04-schedule-travel.spec.ts, maps-event-return.spec.ts). The pin includes the reviewed great-circle projection correction (upstream pull request 34650); integrated navigation acceptance remains open.

Remaining: The owner chooses and licenses a production Maps provider (A-23) and supplies an HTTPS gateway as VITE_MAPS_BASE_URL. Then verify build configuration, location permission and accuracy, reroute and stale result, offline and no route, background navigation and stop behavior, and qualify date-line and high-latitude routes and maneuver ordering.

Done when: J04 event-to-route on selected hardware with explicit origin/route, correct live guidance and truthful regional/offline limits. Date-line progress agrees with the existing geodesic distance calculation and never invents an off-route detour.

Depends on: MVP-04, MVP-20, MVP-09.

Evidence/source: [docs/maps-regional-validation.md](../docs/maps-regional-validation.md), [apps/app/src/prototype/maps-adapter.ts](../apps/app/src/prototype/maps-adapter.ts).

### MVP-32 Qualify workflows approvals and result delivery

**P1 · acceptance · AP-11, AP-12**
Blocked on: EMULATOR: `scripts/android-workflow-native.mjs` and `--classes WorkflowApprovalNotice,HostedProcessRestart`; CI: ResidentWorkflowCrash and WorkflowNoticeProcessDeath in resident-android.yml; HUMAN: inference credential for generated-candidate quality; DEVICE.

Current: Typed phone workflows are manual-triggered; digest scheduling and Automations have distinct contracts. Unknown outcomes are retained and never replayed; a lost Run or Save request can be resent once by the owner under its original identity (docs/agent-integration.md; test/browser/workflow-interruption-recovery.spec.ts, workflow-outcome-unknown.spec.ts). The phrase filter for calls, messages, payments, contacts and code refuses before generation and the typed catalog bounds the rest. WorkflowApprovalNotice and HostedProcessRestart are registered with the runner, the native workflow campaign exists, and the process-death classes run only in hosted CI; no run is recorded for any of them at the current source.

Remaining: Exercise generated candidate quality, Use/Save/Run separation, capability denial, approvals, cancellation, worker death, run history, pending effect/receipt gaps and migrated definitions. Do not advertise scheduled arbitrary workflows from digest support.

Done when: No duplicate external effect or invented receipt; every interrupted run has an explicit disposition and exact history on reconnect.

Depends on: MVP-18, MVP-21.

Evidence/source: [apps/app/src/runtime/phone-workflow-authoring.ts](../apps/app/src/runtime/phone-workflow-authoring.ts), [docs/mvp-current-status.md](../docs/mvp-current-status.md).

### MVP-33 Qualify settings and notification truthfulness

**P1 · acceptance · AP-12**
Blocked on: EMULATOR: `--classes SettingsSystemFacts,SettingsFlow`, the HOME-role campaign for SettingsRoles, and `scripts/test-native-permissions.mjs settings`, `channels` and `notice-denied`; CI: ReminderTapProcessDeath and WorkflowNoticeProcessDeath in resident-android.yml job recovery-ui; HUMAN: decision A-06 for any update check; DEVICE.

Current: Tiles and Settings rows read the Wi-Fi, Bluetooth, airplane mode, location, mobile data and Do Not Disturb states Android reports to an ordinary app, hand off to the matching Android page and re-read on return; unreported states are shown as a handoff. Channel and app-notification denial are read back from Android. About shows the packaged version and states that no update check exists. Diagnostics are redacted by construction. All of this has source and renderer-contract coverage on the flag-off bundle; physical state, each image's Settings pages and OS delivery are not established here.

Remaining: On an installed APK and then a device, check each settings destination and readback (SettingsSystemFacts, SettingsFlow and SettingsRoles through the runner; SettingsNative, NotificationChannels and the denied-notice case through scripts/test-native-permissions.mjs; then by hand), channel denial and re-enable, lock and Doze, exact result or reminder tap after process death (hosted CI only), revoke during work and the redacted export. No run is recorded at the current source. Update availability needs an update authority (A-06) before anything can be shown. Keep mirroring off by default and outside the MVP gate.

Done when: No simulated toggle or success; channel-disabled history still available; wrong-owner/deleted notification target fails safely.

Depends on: MVP-20, MVP-32.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md), [apps/app/src/prototype/settings-adapter.ts](../apps/app/src/prototype/settings-adapter.ts).

## Live integrations

### MVP-34 Qualify production Cloud inference and approved provider profiles

**P0 · deployment · AP-03, AP-04**
Blocked on: HUMAN: a designated Eliza Cloud test account with credits, and a pilot Cerebras key in the owner-only key file (decisions A-02 and A-20); EMULATOR: `scripts/android-resident-instrumentation.mjs` on an arm64 emulator once the key exists; DEVICE.

Current: Synthetic transports and historical local inference do not establish the current release service path. No real Eliza Cloud sign-in, credit check, top-up, expiry or revocation has been exercised; renderer coverage is against a stubbed bridge (test/browser/production-surface.spec.ts, connection-boundaries.production.spec.ts). ResidentService with real inference runs through scripts/android-resident-instrumentation.mjs and has no recorded run.

Remaining: Operator provisions approved production Cloud accounts/credits; verify actual Qwen model, provider health, expiry/revoke/wrong owner, credit failure/top-up and account replacement during requests. Qualify direct Cerebras only as a separately retained profile. Keep credentials out of logs and audit artifacts.

Done when: Current source-bound real round trip, correct billing/model identity and controlled recovery; no inference-ready claim from a saved credential alone.

Depends on: MVP-04, MVP-21.

Evidence/source: [docs/cloud-production-validation.md](../docs/cloud-production-validation.md), [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

### MVP-35 Deploy and authorize Gmail end to end

**P0 · deployment · AP-09**
Blocked on: HUMAN: an operator with access to the deployed Eliza Cloud Worker fixes the Google code exchange, then authorizes a designated test Google account under the A-15 scope set.

Current: The Google code exchange returns 401 (docs/cloud-production-validation.md; the client secret binding is the documented hypothesis), so no real mailbox has been reached. Client and synthetic Gmail routes cover threads, attachments, drafts, send, archive, Trash and undo, and read state. Deployed managed endpoints and real mailbox behavior remain open.

Remaining: Resolve OAuth exchange/approved redirect, deploy supported route/capability versions, consent least scopes, load threads/attachments, account-switch/revoke, provider drafts and archive/trash/read-state.

Done when: Real selected mailbox read and mutation receipts, correct scope/account isolation and no unsupported controls.

Depends on: MVP-04.

Evidence/source: [docs/cloud-production-validation.md](../docs/cloud-production-validation.md), [apps/app/src/runtime/cloud-protocol.ts](../apps/app/src/runtime/cloud-protocol.ts).

### MVP-36 Qualify email send and ambiguous outcomes

**P0 · acceptance · AP-09**
Blocked on: HUMAN: Gmail grant (MVP-35), then the owner authorizes one exact recipient and message; EMULATOR: `--classes InboxOperationJournal,MailAttachment` and `scripts/test-native-restart.mjs inbox`.

Current: The client supports reviewed provider-bound sends. Against a synthetic provider the review lists From, To, Cc, Bcc, body and attachments, the dispatched request equals the reviewed one, an edited or moved draft cannot be confirmed, a reply naming another request is refused, a lost response is never resent and a confirmed send removes the retained local copy (test/browser/journey-f-reviewed-send.spec.ts, journey-f-email-notifications.spec.ts, scripts/test-inbox-sent-cleanup.mjs). Fixture sends do not establish external delivery. InboxOperationJournal has no run at the current source.

Remaining: After MVP-35 and an explicit authorization for the exact test recipient and message, verify one real send, reply and forward with attachments, the sent receipt and lost-response reconciliation.

Done when: Exactly one authorized delivery; uncertain result never auto-resends; local draft remains distinct from provider draft.

Depends on: MVP-14, MVP-35.

Evidence/source: [docs/mvp-completion-plan.md](../docs/mvp-completion-plan.md), [apps/app/src/runtime/inbox-operation.ts](../apps/app/src/runtime/inbox-operation.ts).

### MVP-37 Verify retired phone pairing and retained development boundaries

**P1 · acceptance · AP-03, AP-04**
Blocked on: CI: Connection in resident-android.yml job recovery-ui; EMULATOR: `--test-mocks --classes ConnectionChooser` and the default campaign on a flag-off APK; HUMAN: a real Eliza Cloud account for live self-revocation.

Current: PR 379 retires production Android phone pairing and adds a controller guard. Browser and test-mocks transports remain for development; existing credentials/history must be preserved. connectRemote now refuses every caller on production Android and the native transport rejects the pairing route (ConnectionRoutes.java, JVM-tested and compiled, not run in an APK). A stubbed-bridge production-bundle test shows a saved remote, local or Cloud-agent selection is neither paired nor restored, its credential slot is not written or removed, and a Cloud sign-in starts the resident agent instead.

Remaining: Verify on an installed flag-off APK that Android rejects pairing without network mutation or automatic reconnection, preserves old remote credentials and history, and uses resident execution with Cloud provider authorization. The native route and origin guards are JVM-tested and have not run in an APK; the credential-slot class (Connection) runs only in hosted CI. Qualify retained browser and test-mocks transport ownership, expiry, revoke and recovery separately. Real hosted-agent deployment is optional scope, not a phone MVP prerequisite.

Done when: Production Android cannot pair or silently restore a remote primary agent; old data remains intact. Retained development transports cannot bypass owner, expiry or device-action boundaries.

Depends on: MVP-04, MVP-21.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md), [apps/app/src/runtime/remote-protocol.ts](../apps/app/src/runtime/remote-protocol.ts), [docs/implementation-plan.md](../docs/implementation-plan.md), [docs/on-device-agent-plan.md](../docs/on-device-agent-plan.md).

### MVP-38 Qualify digests under the approved execution policy

**P1 · acceptance · AP-07, AP-11**
Blocked on: HUMAN: decision A-09, then the Gmail grant (MVP-35) and an inference credential (MVP-34) for real sources and output; SOFTWARE: rerun `npm run agent:test-digest-restart` at the current pin; EMULATOR: `--classes HostedProcessRestart`; CI: WorkflowNoticeProcessDeath in resident-android.yml job recovery-ui; DEVICE: battery saver, Doze and lock.

Current: Local durable scheduling and hosted-result controls exist. The explicit missed record is implemented and tested: one missed occurrence, never run later, never replacing the last brief; morning and evening schedules, DST, overlap, revoke, edit and disable are covered with the development scheduler (test/browser/dev-digest-schedule.spec.ts, journey-d-digests.spec.ts). A resident worker killed at an admission or execution boundary created no duplicate result in one host run with a synthetic model at upstream 352d7a08 (npm run agent:test-digest-restart); it was not repeated at the current pin and is in no automated lane. A-09 is undecided.

Remaining: After A-09: for the resident path, rerun the digest restart check at the current pin, run HostedProcessRestart on an emulator and the notice process-death class in hosted CI, then real provider sources and a real model on a phone. The hosted path would need a service that does not exist.

Done when: Distinct source-backed terminal outputs and exactly one visible delivery per occurrence, under the approved scope.

Depends on: MVP-02, MVP-34, MVP-35.

Evidence/source: [docs/mvp-completion-plan.md](../docs/mvp-completion-plan.md), [apps/app/src/runtime/hosted-digests.ts](../apps/app/src/runtime/hosted-digests.ts), [docs/implementation-plan.md](../docs/implementation-plan.md), [docs/on-device-agent-plan.md](../docs/on-device-agent-plan.md).

## Release and security

### MVP-39 Stage the complete admitted resident runtime

**P0 · release · AP-02, AP-04**
Blocked on: SOFTWARE: `npm run android:build:local` at the current pin with the embedding host staged; HUMAN: decision A-24 (the strict build needs qualified speech or the requirement retired); EMULATOR: speech qualification (MVP-23) if A-24 keeps it.

Current: No build with the staged resident runtime is recorded at the current pin. `npm run android:build:local` chains the input check, agent:prepare, agent:build-workflow-worker, agent:stage-android and android:build; plain android:build stops before Gradle when an input is missing. Gradle's verifyEmbeddingHost requires the reviewed ARM64 embedding host libraries described by android/embedding-host/qualified-host.json, which are not in Git. A distribution build also requires qualified speech assets, which do not exist (MVP-23). Licences no longer stop this step (decision P-09): on 2026-10-10 the runtime was prepared, the workflow worker built and the payload staged at this pin, and `node scripts/generate-licenses.mjs --packaged-runtime` ran to completion on it with exit 0 (660 entries, every one of the 550 bundled agent and workflow-worker packages listed, 66 entries flagged). Before P-09 the same command stopped on 24 entries. That run is notice generation on a staged payload; it is not an APK build.

Remaining: Stage the embedding host from its qualification receipt, build and stage the pinned resident runtime and workflow worker, generate packaged notices and source stamps, then run the strict build and verify-apks for both flavors with no unpackaged or unqualified override.

Done when: All four intended distribution artifacts pass strict checks with no unpackaged/unqualified overrides; installed resident uses those exact bytes.

Depends on: MVP-23.

Evidence/source: [scripts/prepare-local-agent.mjs](../scripts/prepare-local-agent.mjs), [scripts/stage-local-agent-runtime.mjs](../scripts/stage-local-agent-runtime.mjs), [scripts/build-android.mjs](../scripts/build-android.mjs).

### MVP-40 Produce controlled signed artifacts and verified links

**P0 · release · AP-14**
Blocked on: HUMAN: decision A-06, then the release owner creates the key, sets the ELIZAOS_* signing values in the signing service and publishes assetlinks.json on an owned domain.

Current: android/release-signer.json records signerSha256 "unset"; every recorded release APK is unsigned. Provisioning, pilot update and AOSP staging refuse a release that verify-apks does not mark distributable (scripts/release-blockers.mjs). The custom scheme callback is not verified HTTPS App Links; android/app/src/main/assetlinks.template.json is a template.

Remaining: Operator sets release signer/version, protects key custody, publishes approved assetlinks for the real host, enables reviewed manifest filter and verifies installed link association.

Done when: Signed exact APK hashes/certificate/version and working domain verification on both variants; no secrets in the evidence bundle.

Depends on: MVP-03, MVP-39.

Evidence/source: [android/release-signer.json](../android/release-signer.json), [android/app/src/main/assetlinks.template.json](../android/app/src/main/assetlinks.template.json), [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

### MVP-41 Build and boot the full AOSP product

**P0 · release · AP-14**
Blocked on: HUMAN: decision A-01 and a Linux builder with the AOSP source (MVP-03, MVP-40); DEVICE: Pixel 10 hardware for the physical build.

Current: Cuttlefish is the selected virtual image validation target; Pixel 10 is the hardware build target. APK compilation proves neither image build nor boot. Separately owned AOSP work remains outside this review.

Remaining: On the separate Linux builder, lock Cuttlefish source/tools and matching host package, stage admitted signed Alpha artifacts, build and boot the full image. Separately admit exact Pixel 10 device/kernel/vendor inputs and build its product; no Pixel 10 installer before admission and no relabeled Pixel 11/tegu/grizzly target.

Done when: Cuttlefish build IDs, hashes, source lock and boot evidence cover product placement, signer, HOME, resident startup, authenticated inference, approvals, history and recovery. Pixel 10 has independently verified source/build evidence; physical flashing, hardware and signed recovery acceptance remain separate gates.

Depends on: MVP-03, MVP-40.

Evidence/source: [docs/architecture.md](../docs/architecture.md), [docs/prd.md](../docs/prd.md), [docs/implementation-plan.md](../docs/implementation-plan.md), [docs/on-device-agent-plan.md](../docs/on-device-agent-plan.md), [docs/android-and-aosp.md](../docs/android-and-aosp.md).

### MVP-42 Prove signed upgrade rollback and data preservation

**P0 · release · AP-14, AP-15**
Blocked on: HUMAN: decision A-06 (rollback design and signed artifacts); EMULATOR: `scripts/test-installed-upgrade.mjs` from agreed baselines; DEVICE.

Current: No signed update or recovery drill exists. scripts/pilot-update.mjs installs a newer versionCode over an existing install and refuses a non-distributable release; rollback is not offered (its header and its result say so, pending A-06). The installed-upgrade runner exists (scripts/test-installed-upgrade.mjs) and has no recorded run at the current source.

Remaining: Upgrade from agreed installed baselines including old mock selection; verify namespaces/Keystore/data migrations, interrupted update, rollback authorization, recovery and support runbook.

Done when: Observed recovery on selected device with preserved promised data and no reopened mock surface or replayed side effect.

Depends on: MVP-40, MVP-41.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

### MVP-43 Resolve Denton distribution rights

**P0 · release · AP-01, AP-14**
Blocked on: HUMAN: decision A-21.

Current: Denton (apps/app/public/denton-300.woff2) is a proprietary commercial typeface marked "All rights reserved" with no licence recorded. It is not open-source software, so decision P-09 (open-source licences are flagged, never blocking) does not cover it. It stays listed in the notices, flagged proprietary-no-licence-recorded and printed as a LICENCE FLAG warning. One separately named check, unresolved-font-licence, remains: the production bundle audit prints it as a named release blocker without failing developer builds, and the release gates refuse a release while it stands. Whether that check keeps blocking is one constant, UNRESOLVED_FONT_LICENCE_BLOCKS_DISTRIBUTION in scripts/licence-policy.mjs (default: it blocks). docs/dependency-audit.md records where Denton is referenced, that Fraunces is not yet a complete fallback, and the steps for either choice.

Remaining: The owner obtains app and web embedding rights and records the evidence, or approves replacing Denton with Fraunces (the replacement and layout recheck are then software work), or decides that an unresolved Denton licence is reported without blocking (the constant above). Denton is the only open-source-policy exception in the app's own notices; the resident runtime payload also carries one package under non-commercial terms (@metamask/sdk, flagged non-open-source-terms), recorded in docs/dependency-audit.md.

Done when: No unresolved commercial font rights in a distributable artifact; notice inventory matches final packaged bytes.

Evidence/source: [licenses/unverified-allowlist.json](../licenses/unverified-allowlist.json), [scripts/generate-licenses.mjs](../scripts/generate-licenses.mjs), [docs/decisions.md](../docs/decisions.md), [scripts/licence-policy.mjs](../scripts/licence-policy.mjs), [scripts/font-license-blockers.mjs](../scripts/font-license-blockers.mjs).

### MVP-44 Requalify privacy and outbound redaction

**P0 · acceptance · AP-03, AP-04, AP-10**
Blocked on: HUMAN: inference credential (MVP-34) for the resident redaction run; EMULATOR: ResidentEgressRedaction through `scripts/android-resident-instrumentation.mjs`; DEVICE.

Current: Native launches enable upstream secret/PII swapping; host defaults differ. Synthetic filters are not a universal secret detector.

Remaining: Run source-matched resident redaction on emulator then device; probe browser vault/OTP/recovery content including plain text, selected notes/mail/files, diagnostics and connection changes. Audit actual launch config and outbound boundaries.

Done when: No test secret exits its allowed boundary; approved-context provenance and per-route processing/retention disclosures match execution.

Depends on: MVP-21, MVP-29, MVP-34.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md), [docs/market-research/13-redaction-integration.md](../docs/market-research/13-redaction-integration.md).

### MVP-45 Triage dependency and artifact supply chain findings

**P1 · security · AP-03, AP-14**
Blocked on: SOFTWARE: Gradle dependency verification metadata and an SBOM for the release candidate (needs MVP-39).

Current: Triaged on 2026-10-10 (docs/dependency-audit.md): the 3 moderate and 1 high npm findings reduce to two advisories, both in development-only packages that ship in no bundle or APK. The high one was fixed by a lockfile bump; the moderate one is a recorded exception until 2027-01-08. test/dependency-audit.test.mjs binds the record to the hash of package-lock.json. `node scripts/generate-sbom.mjs` writes a deterministic CycloneDX document offline.

Remaining: The SBOM records no hashes for the 71 Gradle coordinates (no dependency verification metadata) and does not cover the staged resident runtime or scan APK bytes; generate and attach it for the release candidate. Remove the exception when @capacitor/cli drops the affected path or on its expiry date.

Done when: Recorded vulnerability dispositions and reproducible locked dependencies, with relevant regressions passing.

Evidence/source: [package-lock.json](../package-lock.json), [upstream.lock.json](../upstream.lock.json), [scripts/generate-licenses.mjs](../scripts/generate-licenses.mjs).

### MVP-46 Install the agreed required-check ruleset

**P1 · administration · AP-14**
Blocked on: HUMAN: the repository owner installs the "Main required checks" ruleset.

Current: scripts/ci/required-checks-ruleset.json holds the intended ruleset and scripts/ci/read-required-checks.mjs reads the enforced state back without changing it. Read back on 2026-10-10 for this refresh: only "Default branch baseline" is active (deletion, non-fast-forward, pull request); "Main required checks" is not installed, so Repository verification, Browser MVP result and Android foundation result are not required.

Remaining: The repository owner installs the ruleset (the script prints the command), confirms with the read-back, and opens one controlled pull request showing that a missing or failing check blocks the merge.

Done when: Read-back of enforced rules and a controlled PR demonstrating missing/failing checks prevent merge.

Evidence/source: [scripts/ci](../scripts/ci), [test/ci-required-checks.test.mjs](../test/ci-required-checks.test.mjs).

### MVP-47 Run final exact-head qualification

**P0 · qualification · AP-01, AP-02, AP-03, AP-04, AP-05, AP-06, AP-07, AP-09, AP-10, AP-11, AP-12, AP-14, AP-15**
Blocked on: HUMAN: release signer (A-06) and the decisions that gate MVP-39 and MVP-40; EMULATOR: every campaign in docs/core-loop-audit.md on the candidate's APKs; CI: resident-android.yml on the candidate commit; DEVICE.

Current: Current review results qualify only their named source and evidence classes. release-05/release-15 and final merged-main qualification remain separate from branch CI.

Remaining: After all relevant fixes, run full repository/browser/storage-engine/native/runtime/build/release gates on the exact selected merge/release commit and archive immutable APK/test pairs and logs. Resolve every failure rather than inheriting past green totals.

Done when: All required gates pass for one recorded candidate; exceptions are explicit approved scope changes, not unexplained skips.

Depends on: MVP-39, MVP-40, MVP-44, MVP-45.

Evidence/source: [docs/mvp-current-status.md](../docs/mvp-current-status.md), [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

## Pilot and handoff

### MVP-48 Complete accessibility and resilience acceptance

**P0 · acceptance · AP-15**
Blocked on: SOFTWARE: implemented on open PR #388, not on main (software part); EMULATOR: Accessibility, TextScale and Rotation instrumentation have no recorded run; HUMAN: decision A-22; DEVICE: TalkBack, Switch Access and physical large text.

Current: Browser checks cover selected geometry and interaction; no current physical TalkBack/large-text campaign is recorded here.

Remaining: Test every retained primary/subview and error state with TalkBack, large font, keyboard/touch, contrast, rotation/landscape, gesture navigation, offline, process death and full storage. Define supported sizes and fix clipping/focus traps.

Done when: Independent task completion without inaccessible primary controls or persistent crash/ANR on selected hardware.

Depends on: MVP-06, MVP-20.

Evidence/source: [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md), [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

### MVP-49 Execute all five cross-app journeys

**P1 · acceptance · AP-07, AP-09, AP-10, AP-11**
Blocked on: EMULATOR: campaigns 2, 6, 7, 8, 9, 10 and 14 of docs/core-loop-audit.md; HUMAN: Gmail grant (MVP-35), inference credential (MVP-34) and a Maps provider (A-23); DEVICE: the final device image.

Current: Each of J01 to J05 has an end-to-end browser journey driven through rendered controls with the development profile and synthetic providers (test/browser/journey-j01, journey-b for J02, journey-j03, journey-j04, journey-j05) and a flag-off assertion (test/browser/journey-core-loops.production.spec.ts). This is class S evidence only. docs/core-loop-audit.md classifies every step: J01 6 of 9 closable steps evidenced, J02 (loop B) 17 of 23, J03 8 of 9, J04 8 of 8, J05 7 of 8. For a production user J03's attachment half is blocked on the Gmail grant and J04 ends at an honest unavailable state because no Maps provider exists.

Remaining: Run the open emulator steps (J01-6, J01-7, J01-10, J03-7, J05-2 and loop B's six), then each journey end to end with real selected data on the final device image. Record unsupported subflows rather than substituting a mock.

Done when: Unedited demonstrations and exact receipts/source identities; no automatic send/save or silently changed source.

Depends on: MVP-24, MVP-25, MVP-26, MVP-30, MVP-31, MVP-35.

Evidence/source: [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md).

### MVP-50 Provision four units and obtain user acceptance

**P0 · acceptance · AP-14, AP-15**
Blocked on: HUMAN: decision A-01, four purchased units and a distributable release (A-06); DEVICE.

Current: The pilot runbook has four unit rows, all pending and not run. scripts/provision-unit.mjs provisions a unit and refuses a release that is not distributable; no phone SKU is chosen and no unit exists.

Remaining: Provision four independently identified units, record image/APK/runtime/model/signer versions, execute mandatory journeys/performance/stability per unit, agree P0/P1 definitions and resolve the issue list with stakeholders.

Done when: Four complete evidence manifests, no open blocking defect, explicit target-user acceptance and named support/recovery owner.

Depends on: MVP-41, MVP-42, MVP-47, MVP-48, MVP-49.

Evidence/source: [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

### MVP-51 Deliver reproducible operational handoff

**P1 · delivery · AP-14**
Blocked on: HUMAN: completes after the pilot (MVP-50); DEVICE.

Current: Source, runbooks, provisioning and update tooling (scripts/provision-unit.mjs, scripts/pilot-update.mjs), the dependency audit and the SBOM generator exist. Rollback is not offered. They do not constitute a completed pilot handoff.

Remaining: Deliver reviewed upstream references, app/OS build and provisioning instructions, dependency/license inventory, service/backend guide, privacy/retention statements, release manifests, backup/export policy, rollback instructions, demos and final issue dispositions.

Done when: An independent operator can rebuild/provision/recover and execute acceptance without undocumented credentials or steps.

Depends on: MVP-50.

Evidence/source: [docs/mvp-completion-plan.md](../docs/mvp-completion-plan.md), [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

## Platform scope

### MVP-52 Resolve and implement AOSP listening and hardware invocation

**P0 · decision and implementation · AP-06, AP-12, AP-14**
Blocked on: HUMAN: owner confirms release scope and approves the listener ADR (decisions.md foundation decision 8); SOFTWARE: implementation after the ADR; DEVICE: image and device evidence.

Current: decisions.md includes an AOSP always-on-listening direction requiring a new ADR; a foreground microphone button or ACTION_ASSIST Activity does not implement it.

Remaining: Confirm its release scope, approve the narrowly privileged listener architecture that supersedes the nonprivileged rule only where required, then implement consent, mic indicator, stop/revoke, lock/background behavior and supported hardware-key invocation. Do not turn it on implicitly.

Done when: Approved ADR/scope disposition; image/device privacy, battery, audio-focus, screen-lock and reliable stop evidence for each retained entrypoint.

Depends on: MVP-01, MVP-03, MVP-41.

Evidence/source: [docs/decisions.md](../docs/decisions.md), [docs/market-research/12-aosp-always-on-listening.md](../docs/market-research/12-aosp-always-on-listening.md), [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

### MVP-53 Close the complete installed-app library behavior

**P1 · implementation and acceptance · AP-01, AP-02, AP-15**
Blocked on: SOFTWARE: implemented on open PR #388, not on main; EMULATOR: the HOME-role campaign and LauncherLibraryInstrumentedTest (on that pull request) have never run; HUMAN: decision A-22; DEVICE: physical HOME role, work profiles, real install and remove.

Current: The PR adds drawer/search and native app launch; enumeration alone does not complete the F02 app-library contract.

Remaining: Check and finish favorites/order persistence, real icons, package add/remove refresh, duplicate labels, disabled/unexported components, locked work profiles, no-handler/error states and return-to-HOME. Decide launcher landscape behavior with the broader rotation policy.

Done when: Source-matched installed app tests and physical role acceptance; exact intended package/component opens and stale inventory cannot create fabricated success.

Depends on: MVP-06, MVP-20.

Evidence/source: [docs/implementation-plan.md](../docs/implementation-plan.md), [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md).

## Suggested sequence for the next workflow

1. Resolve MVP-01 through MVP-06 and refresh the requirement ledger. Most native qualification can proceed independently of optional scope decisions.
2. Complete upstream/module and foreground integration in MVP-08 through MVP-19; deploy the approved account/service paths in MVP-34 through MVP-38.
3. Admit speech and packaged runtime, then sign a candidate. Run source/browser checks continuously and native acceptance on immutable artifact pairs.
4. Qualify the selected full image, update/recovery, privacy, accessibility and cross-app journeys.
5. Run final exact-head qualification and the four-unit pilot; deliver operational handoff.

For each work item, the future workflow should record a named owner, dependencies, branch/PR, exact source/artifact identity, acceptance commands or human procedure, evidence class, result, and any explicit scope decision. A source test, APK build, emulator HOME test, full AOSP boot, real service exchange and physical/user acceptance are separate result fields. None substitutes for another.
