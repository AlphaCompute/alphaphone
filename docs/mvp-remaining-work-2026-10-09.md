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

Current: The integration pin is reviewed upstream password-manager head 352d7a0855, merged through PR #34835 and reachable from develop. Source preparation and consumer verification pass (454 tests, four TODOs); both variants build and all four APK audits pass. These developer APKs use an unqualified speech candidate and omit the resident runtime payload, so they are not distributable. Both variants pass the real-framework browser rejection campaign on API 35. Historical 945209d3 journal/photo evidence remains separate.

Remaining: Complete the remaining retired-pin semantic audit and product-wide browser/native regressions. Release runtime, speech, signing and device acceptance remain separate.

Done when: Reviewed upstream disposition per commit, clean source preparation and full product regression at the replacement pin.

Evidence/source: [scripts/ci/upstream-reachability.json](../scripts/ci/upstream-reachability.json), [upstream.lock.json](../upstream.lock.json), [patches/eliza/README.md](../patches/eliza/README.md).

### MVP-09 Submit and retire explicit shared patches

**P1 · integration · AP-04, AP-10, AP-11**

Current: The last applied password-manager patch is replaced by the pinned upstream module from PR #34835. Twenty-eight earlier patch files and their manifests were retired after upstream merges. No applied patch remains. Password transfer remains an unshipped reference candidate under upstream native validation.

Remaining: Finish the remaining upstream reviews and remove each patch only when its reviewed replacement is consumed.

Done when: Patch-to-upstream-PR ledger with exact output hashes, external-consumer tests and no duplicate or silently unapplied implementation.

Depends on: MVP-08.

Evidence/source: [patches/eliza/README.md](../patches/eliza/README.md).

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

Current: Contracts and review presentation recognize calendar_availability. The native guard includes availability in its snapshot, but the product execution path is not complete.

Remaining: Carry free/busy availability through provider reads, implement bounded foreground selection/execution, filter only authorized calendars, and return no event titles. Handle all-day, timezone, permission and stale-context cases.

Done when: Actual selected-provider result and exact receipt; free events excluded, all-day busy, no unrelated calendars or titles disclosed.

Evidence/source: [apps/app/src/runtime/device-actions.ts](../apps/app/src/runtime/device-actions.ts), [upstream device-review contracts](https://github.com/elizaOS/eliza/pull/34699).

### MVP-13 Finish folder notification and capture context selection

**P1 · implementation · AP-04, AP-10**

Current: Selection contracts exist, but folder/notification selections are not fully wired. native-adapter passes a generic wrapper to askAboutCapture while its public function expects an item identity.

Remaining: Audit every retained source adapter, preserve exact selected identity/revision, implement folder and notification review scope, and correct native capture/category routing. Keep unsupported operations visibly unavailable.

Done when: Switch/delete/revoke during review cannot send a neighboring item; native Camera/Photos and folder selection complete their intended journey.

Evidence/source: [apps/app/src/prototype/native-adapter.ts](../apps/app/src/prototype/native-adapter.ts), [apps/app/src/prototype/camera-adapter.ts](../apps/app/src/prototype/camera-adapter.ts), [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md).

### MVP-14 Expose Use in email through the actual assistant UI

**P1 · implementation · AP-09**

Current: Inbox defines useInEmail, but no other product caller is present in the audited tree. A helper test is not a visible control.

Remaining: Connect the reviewed assistant result to the exact selected email/local draft, with conflict protection and account identity. Clarify whether selected Files/Photos become attachments or require the picker.

Done when: A user can review and insert a suggestion into the intended draft; edited drafts are not overwritten and no message sends automatically.

Evidence/source: [apps/app/src/prototype/inbox-cloud-adapter.ts](../apps/app/src/prototype/inbox-cloud-adapter.ts), [apps/app/src/prototype/agent-adapter.ts](../apps/app/src/prototype/agent-adapter.ts).

### MVP-15 Complete full Trash recovery

**P1 · implementation · AP-10, AP-15**

Current: Trash preserves notes and voice recordings for three days. Full storage currently refuses deletion and directs the user to empty Trash.

Remaining: Add the separately confirmed permanent-delete escape where required, preserving exact note/audio ownership and failure recovery. Qualify expiry across process death and clock changes. Qualify the consumed upstream capacity fix: existing Trash must remain readable, restorable and purgeable after a later host lowers its limits. Current limits are unchanged; the fix merged in [upstream PR 34649](https://github.com/elizaOS/eliza/pull/34649) and is included in the pin.

Done when: Full-storage recovery does not silently lose another note; deletion/restore/expiry converge for the exact text and audio under interruption. A document created under larger limits can be read and reduced under smaller limits; only new additions enforce capacity.

Depends on: MVP-09.

Evidence/source: [apps/app/src/prototype/notes-trash-adapter.ts](../apps/app/src/prototype/notes-trash-adapter.ts), [apps/app/src/prototype/agent-adapter.ts](../apps/app/src/prototype/agent-adapter.ts), [docs/browser-storage.md](../docs/browser-storage.md).

### MVP-16 Reuse the resident agent from the assistant surface

**P1 · implementation · AP-04, AP-05**

Current: ACTION_ASSIST has its own renderer/bridge; startup still follows resident connection admission. Per-Activity cancellation was preserved in this merge.

Remaining: Separate attaching to an admitted running resident from restarting it. Opening/closing assistant must not retire Home work, enroll another owner or restart active inference.

Done when: Native dual-Activity test records unchanged runtime identity, correct owned-work cancellation and preserved conversation across repeated assistant invocations.

Evidence/source: [apps/app/src/runtime/connection-ui.tsx](../apps/app/src/runtime/connection-ui.tsx), [apps/app/src/runtime/local-agent.ts](../apps/app/src/runtime/local-agent.ts), [android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java](../android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java).

### MVP-17 Qualify retained browser development transports

**P1 · integration · AP-03, AP-11**

Current: HTTPS remote browser transport exists as development infrastructure; direct Cloud sign-in is honestly unavailable for this origin. The development host has a separate credential-reference bridge.

Remaining: Record the supported browser development scope and qualify its account return, storage degradation, revoke and Automations behavior. Keep unsupported Cloud sign-in unavailable unless that route is separately approved and implemented with an admitted origin/server bridge. Do not add browser Cloud login as a production Android MVP prerequisite.

Done when: Flag-off browser can complete only advertised routes; host-only references never leak or masquerade as bearer tokens; account changes fence pending work.

Depends on: MVP-04.

Evidence/source: [apps/app/src/runtime/native-connection.ts](../apps/app/src/runtime/native-connection.ts), [apps/app/src/browser/cloud-connection.ts](../apps/app/src/browser/cloud-connection.ts), [apps/app/src/runtime/cloud-protocol.ts](../apps/app/src/runtime/cloud-protocol.ts), [docs/implementation-plan.md](../docs/implementation-plan.md), [docs/on-device-agent-plan.md](../docs/on-device-agent-plan.md).

### MVP-18 Wire missing native runner phases

**P1 · integration · AP-11**

Current: WorkflowLegacyReminderUpgradeInstrumentedTest and WorkflowApprovalNoticeInstrumentedTest exist without the required runner coverage.

Remaining: Add installed-upgrade coverage and an approval-notice phase, including immutable APK/test pairing and explicit failure propagation.

Done when: Runner executes both classes on both flavors; verifies exact scheduled item/approval across upgrade, process death, account change and notification tap.

Evidence/source: [scripts/test-installed-upgrade.mjs](../scripts/test-installed-upgrade.mjs), [android/app/src/androidTest/java/ai/elizaresearch/alphaphone](../android/app/src/androidTest/java/ai/elizaresearch/alphaphone).

### MVP-19 Complete the daily overview contract

**P1 · implementation · AP-07**

Current: Main Home cards use current Calendar, workflow/automation and loaded Inbox metadata. The PR Home summary helper does not by itself prove every source/timestamp/brief reaches this newer layout.

Remaining: Map the requirement to actual cards: source attribution, freshness, loading/empty/error/retry, overdue reminders and latest retained brief. Preserve the no-background-mail-read boundary unless policy explicitly changes.

Done when: Real provider transitions render correctly; counts and times correspond to fetched data; no fixture avatar, fake brief or hidden mail fetch.

Evidence/source: [apps/app/src/prototype/data-adapter.ts](../apps/app/src/prototype/data-adapter.ts), [apps/app/src/prototype/template.html](../apps/app/src/prototype/template.html), [apps/app/src/prototype/inbox-cloud-adapter.ts](../apps/app/src/prototype/inbox-cloud-adapter.ts).

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

Current: Merge retains main navigation/read-reply/voice ownership alongside PR draft-dispatch/history/cancel work.

Remaining: Exercise pre-dispatch error, unknown post-dispatch outcome, stop/reconcile, history paging, reply/edit/truncate, drawer/assistant overlays, keyboard resize, Back/Home and concurrent owner changes.

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

Current: Quick setting state, diagnostics and handoffs have implementation coverage; physical state/OS delivery is not established here.

Remaining: Check each settings destination/readback, channel denial/re-enable, lock/Doze, exact result/reminder tap after death, revoke during work, redacted export, version and update availability. Keep mirroring off by default and outside MVP gate.

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

Current: PR 379 retires production Android phone pairing and adds a controller guard. Browser and test-mocks transports remain for development; existing credentials/history must be preserved.

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

Current: Browser checks cover selected geometry and interaction; no current physical TalkBack/large-text campaign is recorded here.

Remaining: Test every retained primary/subview and error state with TalkBack, large font, keyboard/touch, contrast, rotation/landscape, gesture navigation, offline, process death and full storage. Define supported sizes and fix clipping/focus traps.

Done when: Independent task completion without inaccessible primary controls or persistent crash/ANR on selected hardware.

Depends on: MVP-06, MVP-20.

Evidence/source: [docs/flow-audit-and-prd.md](../docs/flow-audit-and-prd.md), [docs/pilot-acceptance-runbook.md](../docs/pilot-acceptance-runbook.md).

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

## MVP-53 software status, 2026-10-10

Implementation added on branch `claude/r2-app-library`; acceptance parts stay open.

- Entries are launcher activities identified by package, activity and Android user (`LauncherLibrary.java`); labels never identify. Same-label entries show their package, activity or profile.
- A launch re-resolves the exact component and is refused with a reason (`not-installed`, `disabled`, `no-launcher`, `profile-locked`, `profile-unavailable`) when the row is stale; the drawer then re-reads the device. A failed read clears the list.
- Favorites and their order are saved on the device (`alpha.launcher.favorites.v1`) and shown only for entries the device lists now.
- An open drawer re-reads on Android package/profile changes (`appsChanged`) and when Alpha returns to the foreground.
- Evidence: `test/home-launcher.test.mjs`, `test/browser/home-app-library.spec.ts` (native stub, not Android). `LauncherLibraryInstrumentedTest.java` compiles but has not run on an emulator or phone.
- Still open: emulator and physical HOME-role runs, a real work profile (paused and locked), real install/remove, return from three native apps, and launcher landscape behavior (A-22 owner decision).
