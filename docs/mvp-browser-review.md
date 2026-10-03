# MVP implementation and design review — updated October 3, 2026

Latest full integration checkpoint: **1,000 browser tests passed, 10 skipped** in hosted run **37098785119**, at exact commit `cce1359d8821869fe4af445c2f888439372ec6b7` (PR #34). All three shards succeeded. The skipped cases require a local speech host; 11 separate local speech cases passed against the restarted host. This covers the scan and redaction source checkpoint, not the subsequent reload repair or development bundle. The MVP goal remains open.

Latest targeted checkpoint: the [local workflow enrollment ownership repair](#october-3--workflow-enrollment-owner-binding-and-live-acceptance) now passes isolated database/approval tests, the existing device REST lifecycle test, and actual local-host phone-step cancellation and approved Notes-write journeys. Repository verification passes 120 checks, type checking and the web build. Full integrated browser qualification remains open after the Clock-fixture failure recorded below; its correction passes 12 repeated cases.

October 1 architecture change: the user has selected an **Android-resident agent instead of Nitro/TEE hosting**. The [on-device agent plan](on-device-agent-plan.md) supersedes cloud-only and enclave-primary requirements below. Agent execution and model inference are separate: the current implementation runs orchestration locally and uses hosted Cerebras inference. Historical evidence is retained. Powered-off-phone execution needs explicit scope reconciliation.

## Local runtime implementation — October 1

The primary connection now starts a local agent: native Android IPC on the device, or the real Eliza app host behind a private loopback bridge in browser development. Reproducible source preparation, Android mobile bundle/ABI staging, secure native provider configuration, local owner enrollment, conversation history and the existing device-action approval/receipt flow are wired. Browser development has durable profile-backed device enrollment and action journaling. See [commands, source pins and exact remaining acceptance](local-agent-development.md).

This first implementation uses local orchestration with hosted Cerebras inference. It does not claim offline LLM operation, Android process execution, powered-off schedule execution or completion of the remaining external integration gates.

### Local development restart and integration audit

At source `ce57cbf`, the browser and agent were restarted together with `npm run dev:local`. Both loopback listeners returned, and the actual connection chooser restored **Connected · On this computer · development** without Cloud sign-in. Local and remote `main` matched that source before this report update.

The same live audit uncovered an unresolved integration defect: opening **Workflows** reports a request failure. A read-only request through the development bridge to `/api/workflow/status` returns upstream HTTP **404**, even though the private host log reports that the workflow service initialized and its route plugin registered. The transport is wired, but that does **not** establish working local workflow management. Next work is to trace the composed host's route dispatch, reproduce the failure in the owning runtime test, and deliver a tested explicit patch if required. Do not bypass authentication or substitute a synthetic workflow response.

The follow-up traced the 404 to the upstream `lean-chat` profile, which deliberately excludes workflow. Alpha's explicit `ELIZA_LEAN_CHAT_WORKFLOWS=1` opt-in now seeds and retains that plugin while preserving user disables and the coding/PTY/browser/wallet exclusions. The explicit patch includes a regression that fails before repair and passes afterward. The host also uses upstream's `eliza-source` export condition. A live browser check then loaded **No workflows on this agent**, and the authenticated status endpoint returned 200 with the workflow engine ready. The home card now says **Review** instead of asserting disconnection; workflow copy no longer assumes remote execution.

Follow-up verification: `npm run verify` passes **42 checks**, TypeScript and the web build; the full browser suite passes **77/77**. A fresh source checkout reproduced the complete patch series and installed its frozen dependencies successfully; `npm run agent:test` passes all three workflow-selection tests against that checkout. Evidence is retained under `test-results/local-workflow-recovery/`. These are local results, not an inherited hosted check or an Android execution pass.

The next live editor check reproduced an Android-only `AlphaConnection` storage call in browser development. Workflow drafts now use the private host profile through the same origin-restricted bridge, with bounded atomic compare-and-exchange and owner/agent scope isolation. Native storage remains encrypted; browser wording explicitly discloses the unencrypted private development profile. The synthetic **Local draft recovery check** name and description survived a real browser reload. A supplied-text-only manual workflow then passed the real review and save path and returned **Workflow saved paused**. It was not executed and contains no external action. Repository verification again passes 42 checks, including stale-tab, cross-scope, size-limit, namespace and cleanup draft-storage cases.

Final follow-up browser run: **77/77 passed in 2.4 minutes** on a separate renderer port, while the real local-agent preview remained running. The first isolated-port run exposed four adapter scripts hard-coded to the live preview port; they now honor the configured test URL, and the full rerun passed. The workflow source regression also verifies both the master `workflow.enabled` switch and the plugin-entry disable. The dev server was restarted with the final source manifest; Android assembly/install was skipped.

Browser local-agent streaming now forwards bounded SSE responses through the private host bridge. Progressive text updates one message bubble; Stop aborts browser transport, late callbacks are ignored, and incomplete replies remain visibly interrupted. Action proposals are processed only after a valid terminal response. Partial and interrupted text is excluded from completed-reply speech playback. Android retains buffered IPC chat.

Streaming verification: `npm run verify` passes **43 checks**, TypeScript and the web build; the full browser suite passes **80/80**. New transport cases cover fragmented UTF-8/CRLF, malformed or missing terminal events, size limits, owner binding, abort propagation and late callbacks. Three rendered cases cover completion, cancellation and interruption. A real local-agent synthetic count request emitted one text update at **985 ms**, then completed at **988 ms**. The live browser also displayed Stop during a real reply and one final message afterward. Evidence is retained under `test-results/local-agent-stream/`. This live check used the existing prepared source via `ALPHA_ELIZA_SOURCE` while a concurrent workstream updates the source manifest; it does not qualify that workstream's new runtime or Android changes. Android builds were skipped.

Additional local-runtime work remains: native token streaming is not exposed by the consumer bridge. The [mobile workflow packaging audit](mobile-workflow-packaging.md) now maps the concrete missing plugin, dependency, worker-launch, path and lifecycle boundaries to implementation and verification steps. A source audit found that the Android mobile bundler explicitly stubs `@elizaos/plugin-workflow` and its plugin collector excludes it. Thus the native bridge's workflow forwarding is implemented but the staged mobile payload cannot yet host these workflows. Removing the stub alone is insufficient: qualify the dependency closure, reviewed phone operations, persistence and lifecycle before claiming device workflow support. Native process execution and recovery remain unqualified. The historical remote-loop and enclave rows below are superseded for the primary executor by the on-device plan; they must not be counted as requirements to deploy Nitro. Local schedule catch-up and optional powered-off remote execution remain separate acceptance decisions.

### Local digest integration repair

October 2 receipt-reader follow-up: `packaged-approval-receipts.patch` removes the remaining source-layout launch from packaged canonical approval reads and uses the shared loader/environment contract. It resolves Effect through Smithers for both default browser and packaged modes, and decodes stdout as streaming UTF-8. The new regression fails on the old implementation and passes on the patched one, covering pending/approved/denied records, Unicode review text, unchanged request digests across artifact relocation, the actual child working directory and receipt reads without importing workflow code or invoking the model. Fresh source preparation and frozen dependencies (install scripts skipped) pass nine composed-runtime tests with 94 assertions. Repository verification passes 46 checks, TypeScript and web build. Dev now uses `artifacts/local-agent-receipts-final`; the renderer and authenticated workflow status endpoint return HTTP 200. Evidence is under `test-results/workflow-worker-receipts/`. Packaged semantic compilation and mobile plugin/bundle enablement remain open; Android builds were skipped.

October 2 worker-resource follow-up: verified worker staging and a product-owned native extraction helper are implemented. The standalone stage checks current source/lock identity, all payload hashes, path/symlink boundaries and bounded sizes before writing the Android asset directory. Native startup verifies an extraction index and preserves the previous artifact after failed validation. Host-JVM tests pass against all 116 real files (8,315,153 bytes), including update and corruption recovery. Isolated real-engine control/replay tests still pass; final repository verification passes 46 checks, TypeScript and web build. Evidence is under `test-results/workflow-worker-assets/`. No Android build or device execution was performed. The mobile workflow plugin remains disabled: the approval-receipt reader and semantic source compiler still require packaged subprocess/declaration integration before enablement. See the [updated packaging report](mobile-workflow-packaging.md).

October 2 packaged executor follow-up: `packaged-workflow-worker.patch` now wires both execution and control workers to Android's packaged loader/Bun/library environment, separates artifact resources from durable state, and repairs stale dependency links atomically after an installation move. Browser launch and database paths remain compatible. A fresh `artifacts/local-agent-workers` checkout reproduced the complete source series; its frozen dependency install completed with install scripts skipped for this source-test pass. All nine composed-source tests passed, including real executor approval/replay across an installation-directory move and denial/cancellation without model execution. Repository verification passes 44 checks, TypeScript and the web build. The live dev host was restarted against this source with the existing profile; renderer, agent auth and the authenticated workflow status route returned HTTP 200. Browser automation timed out during the visual reconnection check, so no new rendered acceptance is claimed. Evidence is under `test-results/workflow-worker-launch/`. Artifact staging/extraction, mobile plugin enablement and device lifecycle remain open; no Android build was run for this change.

October 2 worker-control follow-up: the packaged artifact now exports the approval schema used by Smithers workflows. Isolated real-engine tests pass approval, denial, cancellation and signal delivery through separate processes. Pending approvals survive restart without early task execution; approval runs once, denial never runs the task, cancellation remains terminal, and a large UTF-8 signal payload survives restart and is consumed exactly once. The artifact has 115 verified files. This extends host packaging evidence to control behavior; Android payload staging, loader/environment integration, plugin enablement and device lifecycle remain open. Detailed results and the inspected native launch contract are in the [packaging report](mobile-workflow-packaging.md).

Worker packaging follow-up: the full frozen dependency installation has now completed successfully. The new `agent:build-workflow-worker` command creates a roughly 8.2 MB relocatable dependency artifact, including dynamic engine imports, 53 package provenance records and available license notices. The final `agent:test-workflow-worker` run verified 114 artifact files and executed a real SQLite-backed Smithers workflow from an isolated temporary directory, then restarted a second worker against the same run/database: both completed and the task executed exactly once. Repository verification passes all 44 checks, TypeScript and the web build. Evidence is retained under `test-results/workflow-worker-artifact/`; commands and remaining boundaries are in the [packaging report](mobile-workflow-packaging.md). This is a host packaging/replay pass; mobile artifact staging, worker launch, control-operation behavior, plugin enablement and device qualification remain open. Android builds were skipped.

The next live audit reproduced HTTP 404 from all three scheduled-digest list/result endpoints despite `hostedDigestProtocol: 1`. The workflow handlers existed but were absent from the plugin's public route table. `hosted-digest-route-registration.patch` now registers all nine implemented method/path combinations, with tests for complete registration and verified-owner dispatch. It is applied through the consumer source manifest; neither the vendor checkout nor the pristine baseline was edited. A fresh source preparation replayed the series and the five workflow-selection/route tests passed. The patched live host returned 200 for sources, loops and results, and the rendered panel reached **Synced with this agent**.

Browser digest results and uncertain mutation requests now use bounded private-host persistence with compare-and-exchange. Stale tabs cannot overwrite an observed result index or clear another pending request. Regression tests verify scope isolation, reload recovery, commit-before-ack, lost-ack replay without duplicate history, and no acknowledgement after a storage failure. Browser copy discloses unencrypted development storage; native notification controls and callback polling are excluded from this browser path. Schedule descriptions now state the actual executor requirement instead of promising execution while a local phone is off.

Local verification passed 44 repository checks with TypeScript/build, 82 full browser cases, and three focused digest UI cases after the final presentation cleanup. The live source is `artifacts/local-agent-digests`, derived from the qualified runtime manifest plus the explicit consumer patches. Frozen dependency installation was still waiting on its ffmpeg postinstall download during live qualification; the available dependencies passed the five runtime tests and started the host. This is not a full dependency-install success claim. Native workflow packaging, native result-inbox binding, real local scheduled occurrences/restart recovery, Cloud delegation and physical acceptance remain open. No recurring schedule or external account grant was enabled by this repair.

Follow-up acceptance evidence: the live browser reviewed and saved **Synthetic local digest recovery**, containing only synthetic task text. The source reappeared after a full browser reload and local connection restoration, with **Synced with this agent** visible. No recurring schedule was enabled in the normal development profile. The complete `npm run agent:test` command, including source revalidation, passed all five checks. The frozen install progressed past ffmpeg into workspace builds; full installation remains pending until its terminal result. The separate temporary-database scheduled-digest integration test subsequently passed in 385.18 seconds. Both real wall-clock schedules survived runtime/database restart, produced one persisted result each, and passed reconnect/duplicate-admission checks. Its model was synthetic and its HTTP harness called the workflow handler directly; public route registration and the real local host endpoints were verified separately. This establishes local runtime scheduling/recovery evidence, not hosted-provider, native lifecycle or powered-off-device acceptance.

Resident inbox follow-up: source review found that Android local connections incorrectly selected `NativeResultInbox`, whose native methods require a separately configured remote delivery session. Local connections now use `DigestInbox` through the bound local workflow client and existing encrypted Android storage; remote Android connections retain native background delivery. The contract test rejects any remote-inbox construction for a resident connection, then exercises saved-result recovery and lost acknowledgements through the selected local inbox. The UI explicitly identifies resident results as foreground synchronization without background notifications. Native runtime/device qualification and mobile workflow packaging remain open. This follow-up passes 44 repository checks, TypeScript/build and all three focused browser digest cases. Evidence is retained under `test-results/resident-digest-inbox/`; the scheduler log is under `test-results/local-digest-recovery/`.

## Renewed gap attack — October 1

### Notes save-failure follow-up

The `d1e85c4` hosted [Browser MVP run 36882106470](https://github.com/AlphaCompute/alphaphone/actions/runs/36882106470) completed successfully: repository verification and all **72 browser tests** passed on that exact SHA. Local and remote `main` matched on delivery readback.

A subsequent requirements-to-source audit found a remaining required Notes recovery defect: a synchronous browser storage failure or revision conflict discarded the just-entered text before the optimistic draft state was installed. Two rendered regressions reproduced the loss. The synchronous failure path now preserves the attempted draft, displays the same unconfirmed-save warning as asynchronous native failures, clears agent selection and refuses further writes. It does not overwrite a concurrent saved value or automatically repeat an uncertain write. Both cases pass after repair, including navigation away and back to the draft within the current session. Reload recovery is deliberately not claimed: the warning tells the user to keep this screen open because the draft is not confirmed durable. Original failures and corrected evidence are retained in `test-results/notes-save-recovery/`.

Follow-up local verification: **22/22** repository checks, TypeScript and production build pass; the complete Notes/import subset passes **15/15**. Its first broader campaign had two immediate compact-geometry assertion failures; the checks now await the same bounds and pointer-hit conditions within five seconds instead of taking a single pre-settlement sample. No bounds or hit-test requirement was relaxed. The complete hosted suite now contains 74 cases; the prior 72-case hosted result does not certify this follow-up commit.

The earlier implementation and test records below are historical snapshots, not current-head certification. The checkout has since advanced to `59255ca` with independent native/runtime work. Its Browser MVP run [36867459130](https://github.com/AlphaCompute/alphaphone/actions/runs/36867459130) passed on that exact commit. At the start of this pass, connection capability changes, Maps tests and two acceptance documents were already being edited by another workstream. That work was committed independently as `22b7475` during this review; source hashes confirm no test inputs changed during the full browser campaign. This pass does not take ownership of its native/runtime qualification.

Two additional product defects were reproduced with real rendered browser tests:

- **Keyboard/short viewport:** the conversation sheet/fullscreen used fixed 560/915px heights, placing Minimize/Expand above the visible screen when the viewport shrank to 300px. The phone now caps the conversation panel to its actual height and allows the message region to shrink. The unsent draft survives shrinking, expanding, minimizing and reopening.
- **Dark modal appearance:** Cloud/account and Scheduled Digests dialogs were siblings of the themed phone and always fell back to a white palette. The shell now shares the selected palette with the common root, including live theme changes; primary controls and active states use those same tokens.

Four additional rendered Notes journeys cover 320×568, 412×430, 915×412 and 1440×500, including actual edits, pointer hit-testing and navigation back to the retained draft. Seven compact/theme tests pass in the first corrected campaign. These viewport checks do not claim a physical Android keyboard, Android text zoom or screen-reader acceptance. Final verification for this pass is recorded separately below.

### Remaining gap ledger and concrete next actions

| Gap | Work already available / current action | Evidence required to close it |
| --- | --- | --- |
| Compact layout and modal appearance | Fixed the two reproduced defects above; expanded rendered coverage and inspect screenshots. | Owning browser cases, regular verification and exact-commit hosted CI. |
| Cloud owner login, agent selection/create, restart and revoke | Client/session/provisioning protocols and recovery tests exist. Existing Chrome and in-app Cloud tabs still present sign-in pages on this pass. Complete normal user sign-in; then inspect the intended owner/agent and run the actual product journey. | Authenticated UI plus owner-bound conversation, expiry/revocation and restart results. A loopback test or administrative account lookup is insufficient. |
| Gmail read/draft/send and provider grants | Provider adapter, account isolation, reviewed mutation and lost-response recovery exist. Continue with the user's normally authorized account after login; inspect granted scopes and a selected test message. | Real provider read and reviewed authorized mutation, with correct account and recovery evidence. No external email is sent without specific recipient/message authorization. |
| Local morning/evening loops and background delivery | Primary execution is now on device, with host-local execution in browser dev. Authoring, schedules, durable results, native delivery and renderer binding are implemented. A powered-off device cannot execute local schedules. | Qualify actual resident scheduled occurrences, interruption/restart recovery, polling and reconnect history. Optional remote execution while the phone is off requires its own configured-host acceptance. |
| Local runtime release, identity and rollback | Nitro is superseded as the primary executor. Pinned source composition, mobile runtime/worker assets, secure provider settings and native session binding exist. Historical enclave records are reference only. | Qualify the packaged runtime on the intended device, asset/source identity, authenticated IPC negative cases, interruption recovery and release rollback. Browser and host checks do not prove device acceptance. |
| Speech accuracy and latency | Capture, manual transcript route, explicit local/agent selection, cancellation and native engine plumbing exist. Retain known transcription errors; use the fixed-audio comparison to choose the next engine evaluation. | Blinded transcript quality, physical microphone/speaker/Bluetooth and measured six-second target on the intended hardware/image. No guessed model swap or remote fallback counts. |
| Password provider and production browsing | Isolated WebView and guarded autofill/page-reading boundaries exist. Official Proton provider recognition/warning and passkey support remain qualification work. | Real provider unlock/save/fill/cancel/wrong-origin and lifecycle tests on release identity; separate passkey evidence. Preserve provider warnings. |
| Native calendar/reminder/task lifecycle and receipts | Current acceptance ledger records newer paired Reminder and Maps-journal campaigns; this browser pass does not rerun or expand those claims. | Exact-source current native lifecycle/account/reboot tests and canonical receipts; physical scheduling/Doze acceptance remains distinct. Android builds stay skipped here. |
| Maps provider, coverage and navigation | Configured Monaco browser flows and approved selected-read implementation exist; runtime capability negotiation is concurrent work. | Qualified generic counterpart, configured production TLS/provider/data/license/coverage and physical navigation. A local regional fixture is not a global service. |
| Camera/Photos/Files edges | Browser photo/video capture, owned media, albums/batch actions, local licensed OCR, multipage scan review and durable document drafts are implemented at the checkpoints below. Manual four-corner perspective correction and reviewed searchable PDF export are implemented. Automatic high-contrast edge suggestions and persistent reviewed text layers are now implemented. Broader providers, physical capture and edge-detection quality, OCR quality/languages, interrupted cross-app writes and catalog scale remain gaps. | Complete the remaining browser journeys, then obtain actual provider/native evidence separately. Local OCR and synthetic-stream checks do not prove physical capture or unrestricted image analysis. |
| Upstream consolidation | Current source and patches remain separate from reviewed merged runtime/deployment state; another workstream owns discovery/Maps counterpart qualification. | Owning/root tests, reviewed public commit, consumer replay and synchronized pin/lock before production adoption. |
| Signed OS/update, four physical units and user acceptance | Packaging/staging records exist. The user explicitly excludes Android builds from this pass. | Signed image boot, hardware manifest, update/rollback, per-unit paired-agent evidence and unedited user demonstration. |
| Telegram/Discord and offline LLM scope | Requirements contain conflicting scope language. Preserve the existing MVP profile and documented deferrals; do not quietly add payloads or turn disabled prototype routes into real effects. | Explicit product disposition, followed by implementation and real acceptance if included. |

The remaining live-service and hardware gates are not waived. Browser work can repair presentation and verify production controller behavior through explicit fixtures; it cannot manufacture provider consent, release signing authority, remote deployment or physical-device results.

## Scope and evidence

This review follows the user's instruction to review the entire MVP and design, synchronize local code, complete development in the browser, and skip Android builds. The current MVP scope report governs feature inclusion; the prototype governs visual intent. Native builds, emulator HOME behavior, AOSP boots, live integrations, physical hardware and user acceptance remain distinct evidence classes.

The baseline checkout contained 979 changed/new files, including the renderer, native bridges, design assets, runtime patches and historical verification records. These were preserved in commit `611704f`. Generated artifacts, dependency directories, credentials and local Android Studio state are excluded. The configured origin is now `https://github.com/AlphaCompute/alphaphone.git`; remote confirmation is recorded in the final delivery record below. The pinned upstream checkout and pristine app baseline are unchanged.

Initial `npm run verify` passed (TypeScript, seven repository tests, production web bundle). Historical Build122 and canonical35 results are described in `current-acceptance-ledger.md`; those results have not been repeated by this browser review. Older PRD sections describe the original foundation and are not a current feature inventory.

## Complete surface inventory

| Surface | Current implementation | Browser review / remaining work |
| --- | --- | --- |
| Startup/home | Phone preview, theme/viewport recovery, context-aware assistant dock, live browser Calendar agenda and workflow cards | Compact layouts and all-day agenda dates are covered. Native boot, lock, HOME and system status remain separate device work. |
| Connection/account | Primary resident connection, browser-local Eliza host, optional Cloud/remote pairing, offline and mock modes; secure native credentials | Browser local-host startup and authenticated transport are verified. Optional Cloud owner login, grants and revoke need live acceptance; see the native ledger for separately qualified resident behavior. |
| Assistant | Pill/input/sheet/full layouts, retained context/history, cancellation, reviewed device actions and receipts | Rendered Calendar action fixtures cover create/read/update/delete/cancel. They do not prove a live model generated the right proposal or survived process death. Current live end-to-end acceptance remains open. |
| Voice | Explicit local versus selected-agent/cloud route, recording review, local speech assets, manual transcript fallback, playback and cancellation | Browser lifecycle/ownership checks pass at recorded checkpoints. Acoustic accuracy, six-second target and physical microphone/speaker/Bluetooth remain open. |
| Inbox | Gmail adapter, account-bound drafts, attachments and operation journal; local dev simulator | Browser fixtures cover draft and isolation contracts. Local draft/attachment/send/reload, reply/forward/search/archive/delete/undo and retry journeys are verified. Independent saved drafts survive another message being sent or discarded. Simulator concurrency, provider grants, authorized real mutations and recovery remain open. No mail was sent by this review. |
| Calendar | Durable browser calendar; all-day/multiday/DST edits; daily/weekdays/weekly series and occurrence overrides; visibility/color; guest responses, local meeting preview and event alerts | Recorded browser checkpoints cover these features. Complex-editor guest selection is verified at the latest checkpoint. Exact-byte Calendar backup and reviewed reset are implemented; automatic record salvage, backup import, live-agent series flows, real invitation/conferencing transport and provider sync remain open. Native edits retain their separate capability rules. |
| Reminders/tasks | Durable browser and native stores, Done/Snooze, repeats, selected actions and receipts | Browser approval/lifecycle fixtures and native acceptance records are distinct. Browser timers do not establish reboot/Doze/OEM background delivery. |
| Clock/alarms | Browser Clock creates persistent reminders, lists/deletes, rings while active and supports snooze/dismiss; native Clock handoff retained | Foreground ownership and sound-ledger behavior are tested. Physical audibility, background wake, DND, reboot and hardware time-zone changes remain gates. |
| Browser | Browser development iframe, owned navigation, stop/share, persistent bookmarks, reviewed excerpt reading and local speech; isolated Android page surface | Browser ownership and selected-content fixtures pass. Cross-origin pages may remain opaque. Native vault/passkey/autofill and production WebView acceptance remain open. |
| Camera | Browser photo/video capture, explicit microphone ownership, zoom/mirror output, image import, scan OCR and reviewed extracted links/Calendar drafts; native capture paths | Browser tests use disclosed synthetic streams. Ordered multi-page image PDF export is implemented. Physical camera/torch/permissions, one explicitly saved draft with reload and direct camera retakes is implemented; manual perspective correction, local high-contrast page-edge suggestions, reviewed searchable PDF text and persisted text layers are implemented. Broader OCR language/photo quality and unrestricted analysis remain open. |
| Photos | Browser IndexedDB media library, stable date pagination, custom albums, batch favorite/trash/restore, bounded multi-download sharing, deletion, photo edit-as-copy and video trim/crop/rotation with audio-preserving saved copies | Local persistence and rollback are covered. Clearing site data removes media. External libraries, larger-scale/provider qualification and physical capture remain open. |
| Maps | Regional provider, reviewed place/route context, location handling and saved places | Configured regional browser flows are verified; production provider/TLS/license/coverage and physical navigation remain open. |
| Notes | Durable browser text/audio/documents, local transcript review, revision-bound actions; encrypted native store | Browser import/export, edit/search/delete/reload, attachment ownership/trash/restore and playback lifecycle are covered. No synced Notes service or acoustic-quality acceptance is claimed. |
| Files | Browser-selected files/folders, previews/PDF, reviewed content and attachment boundaries; native SAF integration | Browser file/PDF fixtures pass at recorded checkpoints. Native provider differences, interrupted writes and complete cross-app attachment journeys remain separate work. |
| Workflows/digests | Typed authoring, approval, cancellation, durable receipts/results, schedules, reconnect acknowledgements and local workflow plugin/worker patches | Historical real localhost scheduler/Cerebras and worker/compiler checks exist. Current full editor/run/cancel/restart and resident background delivery require acceptance. A powered-off device cannot execute locally. |
| Settings/notifications | Device simulation controls, permissions, display/volume/DND/tones, account/voice selection, result notices and Calendar alerts | Browser control/readback and owner-bound notification fixtures exist. Calendar failure is isolated from reminders; Calendar backup/reset now has explicit confirmation and cross-tab protection; granular recovery remains open. Actual system control and hardware delivery need device evidence. |
| Phone/SMS/Contacts | Shipping routes remain disabled by the MVP profile; explicit dev mode offers local simulators and persisted Contacts | Simulator call controls/history and message send/reload/retry are verified, alongside startup recovery. Incoming/voicemail, attachment/search/delete, complete contact CRUD and nested/cross-tab behavior remain open. No telecom/default-role acceptance or real external messages are claimed. |
| Wallet/payments | Shipping entry/actions disabled; disclosed development simulation retained | Shipping scope is deferred. No credentials, payment processing, attestation or real transfers were exercised. |

This inventory summarizes implemented behavior, not whole-surface completion. The checkpoint entries below identify the tested source and evidence; the remaining gap ledger retains live-service, native and product-scope gates.

## Design review

The product retains its own electric-blue accent, light/dark tokens, Denton/Fraunces display typography, Public Sans text, lowercase mark, phone geometry and line icons. All ten enabled surfaces are reviewed independently of their native services. The reference includes 60 app fixture states plus home, boot, lock, shade, sheet, full, voice and heads-up states. Deferred reference routes are retained as design evidence and are not reopened in the shipping profile.

Confirmed browser defects before repair:

1. At 1440 × 915, width-only scaling enlarged the 412px phone to 1440px and collapsed its effective height, hiding app navigation behind the assistant dock. Desktop preview must fit the viewport while mobile retains phone-width behavior.
2. The mock banner overlaid the top of the phone. Reserve its actual height while keeping simulation disclosure visible.
3. Startup attempted unsupported native reminder/calendar refreshes and reported a misleading stale-data failure. An absent browser capability needs an accurate unavailable state, not a failure of records that were never loaded.
4. A new, empty Notes collection displayed search-specific “No matches.” Distinguish empty collection from an unsuccessful search.
5. Notes import/export advertised native operations that could not run in a browser. Add real user-selected local UTF-8 import and download, retaining exact source bytes and honest download-request wording.

## Implementation sequence and acceptance ledger

| Item | Status | Evidence / next action |
| --- | --- | --- |
| Preserve and commit all intended existing source/assets | Implemented | Baseline commit `611704f`; all seventeen object-transfer batches uploaded successfully. |
| Desktop and mock viewport repairs | Verified locally | `main.tsx`, `prototype/phone.css`; mobile/desktop bounding checks and screenshots. |
| Browser capability messaging | Verified locally | Reminder/Calendar absent-plugin guards; existing native fixture paths remain supported. |
| Notes empty/search state | Verified locally | Explicit model/template empty text. |
| Browser Notes import/export | Verified locally | Real file picker, bounded UTF-8 decoding, object-URL download, exact-byte browser test. |
| Reproducible browser suite | Verified locally | Pinned Playwright dependency; `npm run test:browser`; tests and screenshots under `test-results`. |
| Entire enabled nested design-state review | Verified locally | 102 light/dark app and shell fixture states, plus 60 production route/theme/width combinations; light/dark contact sheets visually inspected. Deferred reference features remain disabled. |
| Broader controller/adapter suites | Verified locally | Fourteen adapter contracts added to the seven existing checks; five rendered adapter campaigns added to the browser suite. |
| Current-source final verification and remote readback | Local verification passed; delivery record below | Frozen source `cf9a7e4f…` is unchanged across `npm run verify` and all 40 browser tests. |
| Optional Cloud/provider integration | Unaccepted | Needs actual account authorization and service evidence. Nitro/enclave deployment is superseded as a primary-executor requirement. |
| Speech/native/device/AOSP/user acceptance | Outside this browser execution pass | Keep open in current acceptance ledger; Android builds explicitly skipped. |

## Remaining product acceptance

The MVP is not accepted as complete. The active local-executor gates are native agent startup/chat/restart, native worker/compiler execution, resident scheduling and background result delivery, process/reboot recovery and exactly-once reconnect results. Additional gates remain for real Gmail/provider permissions, qualified password-provider integration, packaged speech correctness and measured latency, maintained production browser stability, native task/calendar lifecycle cases, signed device image/update/rollback, physical Pixel hardware and user acceptance. The optional Cloud path retains its own authenticated deployment acceptance. Nitro deployment is superseded by the selected on-device architecture. Local execution while the phone is powered off is unavailable; any optional remote execution or different missed-occurrence policy requires a separate product decision. Browser screenshots and mocked services do not close native or provider gates.

A scope decision is still needed where source requirements conflict on Telegram/Discord and offline LLM fallback. The existing profile remains in effect while browser work proceeds; no new messaging integrations or local model payloads are silently added.

### Additional defects found during contract and accessibility review

- The local speech route disabled all recording when its transcription engine was unavailable, despite the UI promising manual transcripts. An explicit **Record without transcription** option now selects local capture/manual text with no remote fallback. The voice contract exercises zero-upload offline/local/remote manual records, Cloud/paired opt-in, stale-session cancellation, transcript review and persistence failure recovery.
- Scheduled Digests used a different Back event name from the rest of the app and did not constrain keyboard focus. It now consumes `alpha-back`, makes the underlying phone inert, traps Tab, focuses the dialog and restores the trigger when closed.
- Most existing adapter checks were not included in `npm run verify`; several no longer loaded newer production imports. Fourteen checks now run with the regular test command, with actual authoring/playback code loaded into explicit boundary fixtures. A pinned TypeScript loader resolves the production extensionless imports. Five existing rendered browser adapter campaigns are included in the browser suite.
- A dedicated Browser MVP GitHub workflow now runs verification and browser tests and uploads traces/screenshots. Its hosted outcome is separate from local results.

The first browser campaign passed nine tests (60 production route/theme/width combinations plus Notes CRUD/reload, exact-byte import/export and mock exit). The nested design campaign passed twenty grouped tests covering 86 app-state/theme combinations. Five rendered adapter campaigns passed: selected agent context, bookmark retry/recovery, Inbox drafts/account isolation, Maps context and Notes document fixtures. Final combined verification follows after the accessibility and explicit manual-recording additions.

### Design/source provenance and review boundary

The review inventory contains 76 renderer/runtime source files at the initial snapshot, 117 native main-source/assets files, 143 scripts, 93 existing documents, 364 design-assets files and 60 upstream patch/manifests. Counts are inventories, not assertions that every native method was exercised. The feature matrix above is the implementation review unit.

- `design/prototype` and `design/sources` preserve the supplied original references and requirements.
- `apps/app/src/prototype/{model.js,template.html,prototype.css,asset-manifest.json}` are the active presentation extraction, with product adapters surrounding fixture behavior.
- `design-assets/prototype`, `design-assets/source/os`, `design-assets/design-canvas` and `design-assets/radical-studio` are retained design/exploration exports. They are not independently shipped application entrypoints.
- Image originals, optimized imagery, logos and walkthrough videos are preserved in the baseline sync. They are not evidence of working providers or native features.
- The light/dark contact sheets were visually inspected across all enabled app states, with shell-state captures added separately. Deferred Phone/SMS/Contacts/Wallet reference definitions remain archived and disabled by the MVP profile.

### Additional settings correction

Theme selection previously changed only transient component state. The normal app now saves the nonsecret light/dark preference, restores it on reload, honors an explicit preview query and keeps mock previews from overwriting the saved preference. Storage failure leaves the current-session theme visible and reports that persistence failed.

### Remaining execution checklist

1. Completed final frozen-source repository and browser verification; earlier failures and corrections are preserved.
2. Baseline and implementation history are now present on `origin/main`; final renderer follow-up and transfer-branch cleanup are recorded below.
3. Completed hosted readback: Browser MVP passed on `3f3f7a7ee04fea47c75503af0ed964ab257c4f33`; see delivery confirmation below.
4. Keep the listed Cloud, provider, speech, native-device and user-acceptance gates open. No Android build, emulator campaign or AOSP image work was initiated by this browser pass.


## Final local verification and delivery record

Implementation commit: `9802f03` (after baseline `611704f`). Node **24.15.0**. Source fingerprint **`cf9a7e4f28c2326a4f164cfebe49f9aa6bb1bdb88d4d429a053a2d1ac82c62d2`**, covering 287 source/config/test/assets files, unchanged when rehashed after verification.

- `npm run verify`: **passed** — TypeScript, **21/21** repository and adapter checks, production web build.
- `npm run test:browser`: **passed — 40/40**, Chromium, 4.3 minutes. This includes 60 live/offline route/theme/viewport combinations, 102 disclosed app/shell mock-state captures, five rendered adapter campaigns, Notes CRUD/search/reload, exact UTF-8 file round-trip, invalid-file/cancellation handling, mock exit, modal focus/Back, explicit manual-recording selection and theme persistence/isolation.
- Screenshots and HTML report: `test-results/browser/` and `test-results/browser-report/`. Desktop final visual: `test-results/browser-desktop-final.png`. Light/dark contact sheets were inspected; recordings and screenshots demonstrate presentation, not live providers.
- Logs/fingerprint: `test-results/browser-campaign-logs/{verify-frozen.log,browser-frozen.log}` and `test-results/browser-source-fingerprint.json`. Earlier failing test logs are retained in the campaign-log folder. The final run used frozen source; earlier runs during source edits were not accepted as final evidence.
- Non-failing build warnings remain for the large renderer bundle and duplicate static/dynamic Capacitor imports. Browser dev output reports duplicate plugin registrations from the existing multi-adapter registration pattern. Final tests report no unhandled-rejection messages. `npm audit` reports three moderate transitive native CLI dependency findings; no forced CLI downgrade was applied during this browser-only pass.
- Direct baseline pushes hit HTTP408. Seventeen incremental object transfers succeeded on a temporary branch without rewriting `main` or altering working files. The normal baseline and implementation commit history is retained.

The remaining external/native acceptance list above is unchanged. This delivery closes the identified browser defects and registers regression coverage; it does **not** certify the complete MVP or silently waive service, speech, hardware or user gates.

### Console-clean follow-up

The template renderer now normalizes React attribute names and expands padding/margin shorthand in declaration order to avoid reused-node style conflicts. The design suite now fails on console errors as well as page exceptions. After this correction, `npm run verify` passed all **21 checks**, typecheck and production build; the full browser suite passed **40/40 in 3.2 minutes**. Source fingerprint: `44b269cea60eea0c63a410635ffe59928f81c4c3fe9037ea605a52ccba8b343f` across 287 files, using the documented mapping algorithm in `test-results/browser-source-fingerprint-console-clean.json`. Follow-up logs are in `test-results/browser-campaign-logs/*console-clean.log`.

GitHub contains the exact original baseline commit `611704fdd7e7ec74ad771dd0176bac9ca659877a`, assembled from already-uploaded Git objects after HTTP transport timeouts. Main advanced without force to the original baseline, then normal Git push delivered `9802f03` and `6ea5abb`. No source history was replaced.

### Hosted delivery confirmation

Browser MVP [run 36851815606](https://github.com/AlphaCompute/alphaphone/actions/runs/36851815606) completed successfully on exact implementation SHA `3f3f7a7ee04fea47c75503af0ed964ab257c4f33`: checkout, clean dependency install, Chromium installation, repository verification, browser suite and evidence upload all succeeded. Local and remote main matched that SHA on readback. The temporary object-transfer branch was deleted after confirmation. Application source still matches fingerprint `44b269cea60eea0c63a410635ffe59928f81c4c3fe9037ea605a52ccba8b343f`; the subsequent handoff commit changes documentation only and includes the concurrently updated acceptance-ledger wording.

### UTF-8 preservation follow-up

The expanded real-browser round-trip test reproduced loss of an imported UTF-8 BOM. The decoder now retains it as text (`ignoreBOM: true`) while still rejecting invalid UTF-8 and NUL-containing files. Raw-byte download assertions cover Unicode with CRLF, a BOM-prefixed file and an empty file. All three focused browser cases pass after the fix; repository verification passes all 21 checks, typecheck and production build. The complete browser suite now contains 42 tests; its hosted outcome must be read at the new commit rather than inherited from the earlier 40-test run. Local reproduction and verification logs are retained as `test-results/browser-campaign-logs/bom-{before,after,verify}.log`.

### Cloud authorization regression coverage

The regular verification now includes the existing loopback Cloud protocol lifecycle check (owner and target validation, provisioning and session boundaries). Browser CI now includes the actual rendered delegation fixture and HTTPS callback-return check: response-loss/reload recovery without a second code exchange, account-switch isolation, reviewed revoke retries, query removal, duplicate-code rejection and denial callbacks. All 22 repository checks, typecheck and web build pass; both added browser campaigns pass. Their screenshot/build artifacts are retained under the browser test output. The complete browser suite now has 44 tests. These are synthetic local service/native-storage boundaries; real OAuth, provider grants and Android intent/Keystore acceptance remain open. Logs: `test-results/browser-campaign-logs/cloud-{browser,verify}.log`.

### Renewed-pass verification

`npm run verify` passed: **22/22** checks, TypeScript and the production web build. All eight new compact/theme cases pass, including four Notes viewports, draft preservation through sheet/full chat resizing, both digest palettes, and live theme change plus keyboard focus return for the connection dialog. Compact chat and dark digest screenshots were visually inspected.

The full local campaign completed with **70 passed / 2 failed** in 25.7 minutes. Existing Maps stale-replay and mock-light workflow-builder cases failed with a missing review message / interaction timeout; both passed unchanged in a bounded two-case follow-up (12.5 seconds). No deadline, assertion or effect boundary was weakened. This yields passing case coverage across the two runs, **not** a successful full run. All 231 recorded source/test/script inputs remained byte-identical throughout the full campaign. The exact-commit hosted Browser MVP result remains the clean-run acceptance source.

Evidence is retained in `test-results/browser-gap-review/`: original defect reproductions, corrected owning runs, verification log, original full browser report/screenshots/traces and the focused recheck. The application changes in this pass are limited to conversation height/message shrinkability and shared modal theme tokens. No Android build, deployment, provider grant, credential collection or external message was performed by this pass.

### Local workflow compiler packaging follow-up

The worker artifact now includes a symlink-free TypeScript compiler and narrowed declarations: 1,091 indexed files, 33,919,183 bytes, within the existing native extractor bounds. All twelve isolated semantic checks pass, alongside real worker controls/replay, host-JVM extraction of the full artifact and the 46-check repository verification. The compiler does not execute drafts. Source-checker subprocess integration and mobile plugin/bundle/device qualification remain open; see `docs/mobile-workflow-packaging.md`. Android builds remain excluded from this browser development pass.

### Production packaged compiler follow-up

The semantic checker now launches the packaged compiler through the shared Bun/native-loader configuration, with explicit missing-resource failures and unchanged validation bounds. Fresh composed-source tests pass ten cases/105 assertions; the browser compiler regression passes five assertions; plugin source typechecking and all 46 repository checks pass. Browser dev is running on the new source with renderer, bridge and workflow status HTTP 200. The next runtime gap is mobile plugin collection/bundle inclusion, followed by native execution qualification. See `docs/mobile-workflow-packaging.md` for the evidence boundaries.

### Android workflow inclusion follow-up

The Android runtime now includes the real workflow plugin and enables it after extracting verified compiler resources. Explicit workflow disables remain effective; desktop actuators and the iOS workflow path remain excluded. Clean workspace export resolution was fixed for the mobile bundle. The actual bundle passes isolated module and 48-route loading outside the source checkout; 13 composed runtime tests/120 assertions and all 46 repository checks pass. Native service, loader and workflow execution remain device acceptance gates. No APK was built in this pass.

### Local result replay recovery

A new persistence regression reproduced false rejection of an immutable digest result when a lost acknowledgement replay reordered nested JSON object keys. The browser/local inbox now compares JSON values structurally, retaining array order and all values as identity, and keeps the originally stored result rather than rewriting an equivalent replay. Tests require acknowledgement after equivalent replay, preserve the original serialized value, and reject changed fields or array order without acknowledging or changing saved history. This applies to the browser development store and resident foreground inbox. Native background delivery remains a separate open implementation gate.

Verification for this repair: all 46 repository checks, TypeScript and the renderer build pass; three focused rendered Scheduled digests checks pass for light/dark appearance and focus/back behavior on an isolated browser port. Original failure and corrected persistence, repository and browser evidence are retained under `test-results/digest-replay/`. The running local-agent preview was preserved. No Android build was run.

### Local result-sync cancellation

A regression reproduced storage reads and index writes from an already-cancelled digest sync. The inbox now checks cancellation before and after each storage operation, result fetch, notification callback and acknowledgement. Cancelled queued work performs no storage access; late results do not write or acknowledge. An already-dispatched write can still commit, so its record remains available for a later replay while the cancelled sync does not advance the index or acknowledge. Four focused scenarios cover these boundaries and recovery through a new sync. All 47 repository checks, TypeScript and the renderer build pass. Evidence, including the original failure, is retained under `test-results/digest-cancellation/`. These are browser/resident-foreground persistence contracts; resident background execution and native lifecycle acceptance remain open. No Android build was run.

### Resident background results: IPC transport groundwork

The new native IPC result transport verifies an existing owner/session/agent and restricts operations to result reads and acknowledgements. Host-JVM tests exercise the actual durable inbox, including commit-before-ack and replay after a lost acknowledgement, plus identity, route, cancellation and response bounds. This closes the transport implementation prerequisite, not the complete background-delivery feature: encrypted session binding, delivery-worker integration, connection lifecycle wiring, preference/UI readback and device acceptance remain open. The existing renderer background-configuration helper also has no caller; that configuration gap is now explicitly tracked rather than inferred complete from the worker implementation.

Verification for this prerequisite passes all 48 repository checks with zero skips, TypeScript and the renderer build. Evidence is retained in `test-results/resident-result-transport/`. Background scheduling remains disabled for resident connections until the remaining integration is implemented and verified.

### Resident background delivery: native binding and coordinator

The native delivery coordinator now supports the resident IPC transport and shared durable inbox using a captured existing enrollment stored through the encrypted credential store. It checks runtime, owner/session, credential and device binding, removes the resident credential on retirement and permits local result reads without a network constraint. General renderer storage APIs now deny native-only resident/provider credential slots. All 49 repository checks pass with zero skips, including host-JVM coordinator and session regressions. Renderer connection lifecycle wiring and availability controls remain open; no Android Keystore, WorkManager or real socket/device result is claimed. See `docs/mobile-workflow-packaging.md` and `test-results/resident-delivery-binding/` for details.

### Local-agent background renderer integration — 2026-10-02

Closed the missing renderer configuration path: verified connections configure native result delivery, select the native inbox only after success, and expose background polling/notification controls for resident sessions. Failed setup retires the native reservation before foreground fallback. Disconnect aborts pending setup, persists the disconnected selection, waits for native retirement and cannot accept a late setup response. Tests cover retirement while begin/configure are pending, wrong-session retirement and fallback ordering. Browser development continues to use its local profile persistence.

Validation: `npm run verify` passes 52 checks (zero skipped), TypeScript and renderer build; three Playwright scheduled-digest focus/theme checks pass on an isolated server. Evidence: `test-results/renderer-result-binding/`. No Android build ran. Native scheduling/notification/service lifecycle acceptance and the broader remaining MVP integration/device gates are still open; this closes renderer wiring, not the full MVP.

### Rendered resident-delivery follow-up — 2026-10-02

Three production-renderer browser journeys now exercise native-boundary fixtures: successful resident setup selects only the native inbox and exposes working polling/notification controls; rejected setup cancels before foreground sync and exposes its fallback; disconnect during held setup rejects the late response without syncing. The successful journey also holds native retirement and verifies that the UI waits before reporting disconnection. These tests use synthetic IPC/storage and never call a model, send a notification, or execute a workflow.

The dialog now describes the selected executor instead of showing device, browser and remote instructions together. Screenshots were inspected at 412×915. The active gap ledger above now reflects local execution and treats Nitro as superseded; historical enclave evidence remains historical. Focused browser validation passes three cases. The architecture and implementation-plan headers now describe the current local-orchestration/hosted-inference implementation, while retaining offline-model and device acceptance limits. Repository verification passes 52 checks with zero skips, TypeScript and the renderer build.

The final full browser campaign passes all 89 tests, including the three new resident-delivery journeys. The first full campaign had 88 passes and one obsolete all-modes-copy assertion; the corrected test now checks the disconnected explanation, and the resident journey explicitly checks the powered-off limitation. Final logs and focused screenshots are retained under `test-results/resident-rendered-results/`. This is production-renderer coverage with declared fixtures, not real Android IPC, notification, WorkManager, or provider acceptance. No Android build ran.


### Browser Camera and Photos implementation — 2026-10-02

Browser development now uses real MediaDevices preview and canvas JPEG encoding, with a photo library in IndexedDB. The existing Camera/Photos renderer supports local capture, reload, favorites, trash/restore, reviewed permanent deletion and an explicit JPEG download action. Storage transactions must commit before capture success is shown. Metadata mutations compare revisions, and permanent deletion rechecks the reviewed trash snapshot so a restored/changed photo is skipped. Clearing browser site data removes these photos; the UI says where they are saved. Photos are not sent to the agent or uploaded by this path.

The browser port controls stream lifetime directly: no microphone is requested, leaving or hiding Camera stops tracks, pending permission results are checked against cancellation, and preview playback has a bounded timeout. Native Android ports remain selected on device. Browser video, photo editing, custom albums, batch sharing, hardware flash/zoom/focus and OCR are not implemented by this browser port; unsupported operations reject without changing originals. This is an incremental closure of the browser-development gap, not completion of the media feature set.

Rendered tests use a synthetic canvas stream only at the MediaDevices boundary. Encoding, video playback, IndexedDB transactions, production renderer actions and the download event are real. The local test browser rejected its fake-device `getUserMedia` attempt with `NotSupportedError`, so no physical camera or real permission-acceptance claim is made. Captured and reloaded-photo screenshots were inspected. Evidence is retained under `test-results/browser-camera/`; final campaign results follow below.

The final three focused journeys cover encoded capture and reload, storage-quota failure with explicit retry, JPEG download, favorite/trash/restore, stale mutation rejection, a restored photo surviving an old delete confirmation, explicit permission retry, track release on leaving, and cancellation of a late permission result. Repository verification passes 52 checks with no skips, TypeScript and the renderer build. The final browser campaign runs against stable source; an intermediate campaign was invalidated by hot reload during the stream-lifecycle repair and is retained separately.

Final source-snapshot validation: all 52 repository checks pass with zero skips, along with TypeScript/build. The 92-case browser campaign passed 91 cases; its native-media context fixture required an explicit Android platform declaration now that ordinary browsers have their own photo store. That corrected case passes separately, preserving its private-content exclusion assertions. All 92 cases therefore have passing evidence across the full run and the focused fixture rerun; this is not a single all-green full-suite run. The fixed candidate is based on `e1ea6d4`, with code/test hashes in `test-results/browser-camera/source-snapshot.json`. Concurrent platform-plugin/browser-parity edits in the shared checkout were excluded from this candidate and remain owned by their workstream. No Android build ran.


### Browser photo editing and durable copy recovery — 2026-10-02

The browser Photos editor now implements rotation, center crop at 1.3×, and the existing seven filter choices through Canvas. Output is a new JPEG capped at a 2048-pixel longest edge; the original record and pixels are never overwritten. A no-change save creates no copy. Preview and save reject stale source revisions, and sessions expire after 15 minutes.

Each editor gets a persisted operation identity. The new photo and saved receipt commit in one IndexedDB transaction. Repeating an already-saved request returns its existing copy, including after reload; changing the parameters of that operation is rejected. Recovery retires a prepared or suspended save atomically before returning a no-copy result, preventing the old tab from committing afterward. Opening Photos now reconciles a pending copy once per entry, without reissuing the save or interfering with an active editor.

Six focused browser journeys pass with real Canvas decoding/filtering/encoding and IndexedDB: the rendered rotate/crop/Mono flow checks grayscale pixels, dimensions and byte-identical original storage; a lost successful response survives reload without duplicate copies; another tab cancels a suspended save; unchanged and stale-source edits do not create copies; an interrupted copy/receipt transaction rolls back both; and transform parameters are captured before asynchronous work so later caller mutations cannot alter the saved operation. Screenshots of the editor and saved copy were inspected. Inputs are generated test pixels, with no camera, provider, model or upload. Evidence is retained under `test-results/browser-photo-edit/`. Browser video, custom albums, batch sharing, OCR and physical-device acceptance remain open.

Final validation passes all **98 browser tests** in one campaign, plus **52 repository checks** with zero skips, TypeScript and the renderer build. The fixed candidate is based on `3351f4c`; exact code/test hashes are recorded in `test-results/browser-photo-edit/source-snapshot.json`. Concurrent platform-plugin/browser-parity work was excluded from this candidate and preserved in the shared checkout. No Android build or device acceptance is claimed.

### Browser device ports and zoned reminders — 2026-10-02

The browser development checkpoint now registers shared Capacitor identities before consumers, routes renderer adapters to browser implementations, and retains Android dispatch. It includes a local calendar/reminder store, sandboxed browser surfaces, browser file storage and download, local device settings, media ports, and an explicit development simulator for deferred apps. Development calls/messages/payments use local state rather than carrier or payment services. The detailed implementation inventory and unfinished qualification work are in `docs/browser-dev-parity.md` and `docs/browser-native-method-inventory.md`; these ports are not evidence of Android device acceptance.

Recurring reminders now resolve the saved IANA zone independently of the browser/computer timezone. The first occurrence rejects missing wall times, inconsistent alert instants, invalid dates and weekend starts for weekday rules. Future gaps advance to the first valid wall time; overlaps choose the earlier instant, matching `ReminderStore`. Alert lead remains elapsed minutes. Completion persists the next civil date, records skipped eligible occurrences and clears old snooze/posting metadata. Repeated snooze requests on the same scheduled occurrence return unchanged; old completion decisions cannot advance the new occurrence. Invalid replacements leave the original stored record intact.

Four focused host tests cover saved zones under three host timezones, spring/fall transitions, half-hour DST and skipped-day gaps, weekday/weekly schedules, missed occurrences and invalid first occurrences. Two browser journeys use real local storage and the production plugin registration with the browser in Tokyo and the reminder in New York, covering reload, completion through the DST gap, subsequent return to the requested time, snooze idempotency and invalid replacement rollback. The initial browser failure exposed an overlapping shared-checkout reminder refactor; the reconciled fixed snapshot passes both journeys. These are deterministic clock/storage checks, not delivered OS notifications or physical-device timing evidence.

Snapshot evidence is retained in `test-results/browser-recurrence/`, including source hashes, the original failure and the reconciled checks. `npm run verify` passes 56 checks with zero skips, TypeScript and the production build. The final full browser campaign passes all 106 cases in one run. The preceding campaign passed 105 and failed a test that displayed the prior Calendar week after changing the test clock; the test now mounts Calendar in the occurrence’s week before checking the rendered reminder. Both logs are retained. No Android build was run for this checkpoint. Browser scheduling still requires an open foreground-capable page; closed-browser/background guarantees, full agent-operation qualification, voice/video lifecycle and storage failures, scan/OCR, filesystem capability contracts, live providers and physical acceptance remain open. Newer edits in the shared checkout are outside this snapshot until separately verified.

### Browser microphone ownership and cancellation — 2026-10-02

The browser voice port now owns each capture's permission generation, stream, recorder, timer and completion promise separately. Starting a new capture cancels the previous one synchronously before awaiting permission. Late permission grants release their tracks; constructor/start failures, recorder errors, size failures and cancelled stops cannot retain microphone ownership or clear a newer session. Duplicate stops resolve the same clip. Page hide/visibility cancellation releases active media and closes pending transcript review. A recorder that ends on its own publishes its final usable clip; a missing stop callback fails after five seconds. Capture is bounded to 59 seconds and 16 MB, and only four completed clips remain in transient memory. Saved note audio remains in IndexedDB.

Eight host regression cases exercise overlapping permission requests, constructor/start failure and retry, cancellation during a held stop, late callbacks, duplicate/manual/automatic stops, hidden-page permission results, recorder and size errors, stop timeout, invalid limits, bounded clip retention and device-ended recording. Two browser journeys exercise the real MediaRecorder and IndexedDB with an explicitly synthetic Web Audio input: transcript review/cancellation, persistence and successful decoding after reload, denied-permission retry, pending-permission cancellation and active-track release. They neither request a real microphone nor upload audio. This qualifies capture ownership and local persistence contracts, not physical microphone/speaker/Bluetooth quality, automatic speech recognition, playback lifecycle or native device acceptance.

On a fixed snapshot based on `5b046e0`, `npm run verify` passes 66 checks with zero skips, TypeScript and the renderer build. Both focused browser journeys pass. Logs and source hashes are retained in `test-results/browser-audio/`. An intermediate build lost the shared bundler dependency during a concurrent dependency installation; final qualification uses the snapshot's own `npm ci` dependencies. A separate intermediate command used an incorrect JDK path and failed; the final command uses the correct OpenJDK 21 path and passes all host-JVM checks. No Android build was run. Newer shared-checkout work remains outside this audio checkpoint.

### Browser playback and audio-save recovery — 2026-10-02

Stored-audio reads and playback starts now have cancellable ownership and a five-second startup bound. Cancelling a pending database read settles the caller immediately and cannot create an audio player when the bytes arrive later. Cancelling a pending `play()` releases its source; a late resolution pauses that old player without affecting its replacement. End/error paths detach handlers, pause the owned player and revoke its object URL. Stale player and speech callbacks cannot announce completion for a newer request. Aborted IndexedDB saves now reject instead of leaving the save promise pending; the existing captured clip remains available for an explicit retry.

The browser local speech route explicitly selects voices whose `localService` flag is true, waits briefly for voice enumeration, and provides a text fallback error when none is available. It never silently selects a browser-reported remote voice. Prepared speech is limited to eight entries of at most 16,000 characters. This selection uses the browser's declaration, not an independent audit of operating-system speech processing. References: [SpeechSynthesisVoice.localService](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService), [HTMLMediaElement.play promise and autoplay behavior](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play).

Seven host cases exercise cancelled reads, overlapping players, late `play()` resolution, autoplay rejection, natural completion/media errors, stale callbacks, startup timeout, local-voice selection and remote-only/unavailable voice cancellation. Three browser journeys use the real MediaRecorder, IndexedDB and HTML audio player with generated audio fixtures. They cover transcript review/cancellation, aborted save and retry, reload/decoding, microphone-boundary denial and cancellation, natural stored-audio completion and pagehide URL cleanup. The playback test uses a clearly identified fixture button to supply a user gesture; it does not establish the complete Notes playback UI journey or physical speaker/Bluetooth acceptance. The first playback attempt failed because that fixture button was underneath the phone shell; the corrected visible fixture passes.

On the fixed `5ca6f15` base plus these changes, `npm run verify` passes 73 tests with zero skips, TypeScript and the renderer build; all three focused browser journeys pass. Evidence and hashes: `test-results/browser-playback/`. No Android build ran. Automatic speech recognition, physical audio accuracy/latency, the full saved-note playback UI, and the wider remaining browser/device/provider gaps remain open. Concurrent browser file/device work is preserved outside this checkpoint.

### Notes audio identity and complete browser journey — 2026-10-02

Reviewing the actual Notes save path found a browser/native contract mismatch: the renderer requires retained `audioId` to equal the recording ID, while the browser saver generated a new UUID. Port-only audio tests had not established that a recorded note could be saved through the renderer. The browser saver now retains the recording under its existing identity. An IndexedDB read/write transaction atomically checks that identity, rejects reassignment to another note, and either adds the audio once or returns its existing metadata. Replays after reload can recover the retained audio without the transient capture buffer. Transcript text remains the reviewed Notes content; retaining audio does not itself create or overwrite a note.

A new production-renderer journey records generated silent audio through the real MediaRecorder, explicitly selects manual transcription, reviews text, saves the voice note, edits its title, reloads, opens the saved note, plays to completion, deletes, uses Undo, and plays/stops the restored recording. Additional assertions recover the same audio after reload, reject another-note binding, and verify exactly one retained audio record. The three existing browser audio journeys still pass, including storage abort/retry and media cancellation. The generated audio replaces only the microphone source; this is not physical microphone/speaker or automatic speech-recognition acceptance.

Validation on fixed base `c8a1ed9`: all 73 repository checks pass with zero skips, TypeScript/build pass, and all four focused browser audio journeys pass. Evidence: `test-results/notes-audio/` and its source snapshot manifest. The restored-note screenshot was visually inspected. It also exposes a remaining design defect: the small browser storage-status label overlaps the simulated status-bar time/notch. That layout needs a dedicated repair and viewport/error-state check; functional audio acceptance does not close it. No Android build ran. Concurrent browser-file/device work remains outside this checkpoint.

### Notes storage-status layout — 2026-10-02

Closed the overlap found in the restored voice-note screenshot. Notes now reserves the original status-bar space once, lays out its storage/recovery message as a normal-height row, and places the list, editors, voice view and recording view in the remaining workspace. Longer messages expand that row instead of covering the notch, time or editor controls. The label remains an accessible live status and is not truncated. Reference states without a storage label retain their original top spacing.

Six new browser cases assert that the status is below the notch and outside the workspace in light/dark appearance at 360×740, 412×915 and 1440×500. They induce a real refused Notes storage write, check that unsaved text remains, double the status text size, and verify that Back and the retained note stay usable. Final error/large-text screenshots were inspected after disabling transient screenshot animations. Seventeen focused browser cases pass across those checks, compact editors, save failures and the complete audio journey; the two reference Notes-state campaigns also pass in light/dark themes. The final screenshot-only follow-up reruns all six new cases successfully.

`npm run verify` passes 73 checks with zero skips, TypeScript and the renderer build on fixed base `24b93a5` plus this change. Evidence and hashes: `test-results/notes-layout/`; screenshots are in the validation checkout's `test-results/status-final/`. These checks cover browser layout, including simulated enlarged status text; Android font/inset and device acceptance remain separate. No Android build ran. The other active browser-development gaps and concurrent edits remain open.

## October 2 — local Camera Scan and reviewed Notes save

The Camera Scan gap now has an implemented English OCR path using locally packaged Tesseract worker, WASM and language data. Capturing retains the real photo; recognition opens editable text and requires an explicit Save to Notes with a confirmed persistence receipt. Copy is explicit, cancellation owns worker shutdown from startup onward, and unconfirmed saves retain text without allowing duplicate submissions. See [local OCR implementation and remaining design requirements](local-ocr.md).

Browser evidence covers actual OCR execution, no remote OCR requests, worker cancellation, the full Camera-to-Notes/reload journey using a synthetic camera stream, and retained draft text after an injected unconfirmed save. Android execution, hardware accuracy, document boundary detection, semantic event/link actions, PDF export and additional languages remain open. This closes basic local text extraction and reviewed Notes saving only; it does not establish complete Scan design acceptance or MVP completion.

## October 2 — scan photo PDF export

Scan review now previews the captured page and exports a real single-page image PDF. Browser export uses Downloads; Android source uses the system document picker and exact provider readback before confirmed success. Reviewed OCR corrections remain a separate Notes save. The dialog keeps its action controls visible while the review content scrolls. See [the export contract and qualification limits](local-ocr.md#photo-pdf-export).

This implements single-page photo-to-PDF export. Automatic insertion into browser-managed Files, multipage capture, searchable PDF text, document boundaries and semantic event/link actions remain open. Android plugin wiring is implemented; only its pure-Java byte validation/readback helper is exercised here, not the Android picker or an APK.

## October 2 — reviewed links from Camera Scan

Camera Scan now derives explicit website links from actual OCR or user corrections, displays the complete normalized addresses under Review links, and opens only the selected current address after a click. Browser tabs have no opener/referrer; Android uses the existing system-browser handoff. No automatic navigation, prefetch, agent upload or canned poster URL is involved. The browser journey verifies a real OCR URL, user correction, removal of the old destination, and one explicit navigation to an intercepted test page. See [link behavior and remaining Scan requirements](local-ocr.md#reviewed-website-links).

## October 2 — Scan to reviewed Calendar draft

Camera Scan's event action now opens editable event details and hands them to the existing Calendar composer. It preserves corrected scan text as notes, suggests only explicit unambiguous ISO date/24-hour local time formats, and leaves other dates/times for review. Review in Calendar creates no event; Save event remains the explicit mutation. Browser qualification covers actual Camera/OCR, zero writes before Save, one saved event after reload, and rejection/correction of a nonexistent DST start time. See [draft behavior and semantic-extraction gaps](local-ocr.md#reviewed-event-drafts).

Final event-draft qualification: 80 repository checks, production web build, 14 combined Scan browser cases and two light/dark Calendar design-state campaigns passed. Visual inspection also prompted a full selected-date label and multiline notes in the existing Calendar composer. Android build/device acceptance remains excluded from this pass.

## October 2 — integrated browser parity checkpoint

A fixed source snapshot now passes **82 repository tests**, typecheck, production web build and the **complete 156-case Chromium browser suite**. This integrates the previously local Files/PDF/folder-import and attachment ports, device controls and full-reload behavior, notification policy/history and durable synthetic device queue, recurrence consolidation, and the recent Camera OCR/PDF/link/event-draft work. File mutations are checked for stale selections and concurrent updates; imported HTML remains sandboxed; notifications are checked for reload, policy, lock and revision boundaries. PDF and notification screens were visually inspected.

The integration review also fixed two gaps: PDF.js font/decoder/package licenses now ship byte-for-byte with their assets, and reviewed attachment previews release their dialog/object URL on shell Back, pagehide and visibility loss. A new Back test failed before the cleanup fix and passed afterward; a replaced dialog's late close cannot retire the current preview. Evidence is retained under `test-results/parity-sync/` and the fixed candidate's `test-results/` directory.

This is browser/host evidence, with synthetic device and provider fixtures where documented. No Android build ran in this pass. Concurrent hosted-result delivery edits were excluded from the snapshot and remain local pending qualification; the active report's hosted-result delivery sequence remains unfinished. Full browser parity, live-provider acceptance, device/background behavior, document boundaries and the remaining design/MVP ledger are not closed by this checkpoint.


### October 2 — browser store serialization

The shared local browser store now requires an exclusive Web Lock before reading or editing persisted state. The old unlocked fallback could lose concurrent updates when Web Locks was unavailable. Unsupported contexts now reject before initialization or mutation, with guidance to use a browser supporting Web Locks on localhost or HTTPS; existing readable data remains intact. This intentionally does not implement a weaker process-local locking fallback.

On a fixed snapshot based on `edf9f6d`, root verification passes 82 tests, TypeScript and production build. Twenty focused browser checks pass, including real same-origin cross-tab serialization, tab closure during an uncommitted edit, failed editor and quota-write recovery, and existing calendar/reminder/notification behavior. The missing-lock regression fails against the original code and passes after repair. Evidence: `test-results/browser-store/`. No Android build ran; browser storage remains subject to browser retention policy, and the broader MVP/provider/device ledger is still open.


### October 2 — browser-local reviewed excerpt speech

Browser Menu → Read aloud now works without agent pairing through an explicit excerpt review. The sandboxed frame retains its opaque origin; it does not expose an extraction bridge or fetch a second copy of the page. The user pastes up to 5,000 characters, reviews the source origin and processing disclosure, then presses Read locally. The existing browser voice port selects only voices declaring `localService`; absence of a local voice is an actionable error, with no remote fallback. The exact trimmed reviewed excerpt is passed to speech. Text is not persisted or sent to the agent. Android keeps its existing native extraction/paired-speech route.

The review supports Stop, retry, completion/error state, Close/Escape/Back and page lifecycle cancellation. Adapter ownership also binds it to the tab, document revision and active Browser view; lock, simulated background, chooser and assistant overlays retire reading. Light and compact dark layouts use the active phone theme, scrolling without horizontal overflow. This is a safe manual excerpt fallback, not automatic cross-origin article extraction.

On fixed base `a4bc62b`, 82 repository tests plus TypeScript/build pass. Fifteen focused browser cases pass, including five new speech/review cases and ten existing device/browser parity cases. The rendered Browser-menu journey works while the connection is offline and Home closes the review. Voice and website fixtures are synthetic: exact text, explicit confirmation, remote-voice rejection, stale callbacks, cancellation, compact layout and page-hide cleanup are verified; audible output quality and physical device acceptance are not. An earlier combined run timed out clicking the existing Resume control; that case passed separately and all 15 passed in the final serial run. Evidence: `test-results/browser-reading/`. No Android build ran. Automatic extraction, actual installed-voice quality and the broader MVP ledger remain open.


### October 2 — browser navigation and bookmark recovery

The browser surface now separates loading, committed and stopped state. Each host navigation owns a fresh sandboxed frame; callbacks from replaced or closed frames cannot commit another address. Stop retires the frame, increments the navigation identity, shows a visible recovery message and rejects sharing until a new load commits. A subsequent load caused by navigation inside the isolated frame invalidates address-dependent actions and explains how to recover through the address bar or external browser. The development chrome no longer displays a Secure connection badge: the opaque frame cannot verify a redirected final URL or distinguish all blocked-frame/error documents from successful load events. Native browser identity behavior is unchanged.

Bookmark edits now use the shared exclusive cross-tab store lock. A regression with 16 simultaneous saves across two browser tabs retained only two bookmarks on the original implementation; the repaired implementation retains all 16, supports concurrent removal/addition, and survives reload.

On fixed base `2941756`, root verification passes 82 tests, TypeScript and build. All 19 focused browser cases pass, covering retired callbacks, Stop/reload recovery, in-frame navigation, concurrent bookmarks, read-aloud and existing device parity. The rendered journey operates the actual address bar, Previous/Next page and menu Reload/Stop controls against intercepted fixture websites. Evidence: `test-results/browser-navigation/`. No Android build ran. General cross-origin document observation, frame-blocking detection, external site compatibility and the wider MVP/device/provider ledger remain open.


### October 2 — browser video with microphone and durable playback

Browser recording now requests microphone audio only when recording starts, owns cloned camera tracks and the microphone per session, and rejects late permission results after Stop or camera closure. Recording limits validate up to five minutes and 100 MB; duration expiry stops capture, size overflow rejects the recording, actual byte counts reach the UI, and missing stop callbacks fail after five seconds while releasing tracks. Constructor failures, cancellation and stale callbacks cannot retain microphone ownership or retire a newer session. The original camera preview remains separately owned.

Duplicate Stop calls share one completion/save promise and one IndexedDB insert. Failed storage does not publish a successful receipt or retry the insert implicitly. The saved data URL uses the base video MIME type: preserving a comma-containing codec list made an otherwise encoded audio/video clip unplayable. Downloads select the MP4 extension when the recorded MIME is MP4; Chromium WebM playback is the format exercised here.

On fixed base `bade5ad`, root verification passes 82 tests, TypeScript and build. All 10 focused camera/video browser cases pass with independent `npm ci` dependencies and Vite cache. Tests use synthetic canvas and Web Audio sources with real MediaRecorder encoding and IndexedDB. The saved clip decodes after reload with both audio and video tracks. The rendered Camera Video → Home → Photos → Play journey saves exactly one video and releases source tracks. Other cases cover duplicate Stop, duration/size limits, microphone denial and late grants, Stop during permission, quota failure, constructor failure and missing stop callback. The original implementation fails the new recording regression. An earlier shared-dependency run suffered an unexpected Vite reload; final evidence is from the isolated run in `test-results/browser-video/`.

No Android build or physical microphone/camera test ran. Zoom/flash effects on recorded and captured output, camera switching quality, camera-missing imports and the broader MVP/provider/device ledger remain open.


### October 2 — captured camera controls

Browser zoom now applies a shared centered sensor crop to photos, video frames and video thumbnails, instead of only scaling the preview. Front-camera mirroring composes with zoom and is retained in captured output. Digital zoom accepts 1×–8×; unsupported sub-1× lens requests reject rather than silently selecting 1×. Starting or switching cameras resets the displayed zoom to 1×. Transformed video owns its canvas capture track and frame timer; completion, failure, cancellation and source-ended events retire them.

Flash no longer changes CSS brightness. Where the camera exposes a torch, the browser applies the requested setting and requires the track to report it back; unconfirmed settings attempt to turn the torch off and reject. Unsupported torch or manual-focus controls report unavailability without synthetic success. This exposes a continuous hardware torch where supported, not a claim of universal strobe/flash support.

On fixed base `68e3768`, 82 repository checks, TypeScript and build pass. All 15 focused camera/media browser tests pass with independent dependencies. Tests inspect decoded photo/video pixels and thumbnails from synthetic color sources, verify mirroring, rendered zoom selection and camera-switch reset, exercise torch capability/confirmation fixtures, and verify a source-ended recording releases its processing stream. The original preview-only zoom fails the new pixel regression. Evidence: `test-results/camera-controls/`. No Android build ran. Physical optics, torch/focus capability and quality, camera-missing imports, document boundaries and the wider MVP/provider/device ledger remain open.


### October 2 — image import when Camera is unavailable

Browser Camera now has a Choose image entry point, including after permission denial or when no camera exists. The local review accepts JPEG, PNG or WebP up to 16 MB and 32 million pixels, displays a prepared preview, and requires a separate Save to Photos or Scan text action. Saving creates one JPEG copy with its longest edge bounded to 2,048 pixels and a confirmed IndexedDB write; it does not modify the selected original. Failed saves retain an unconfirmed state and cannot retry implicitly. Selection alone neither saves an image nor starts OCR.

Scan uses the selected file with the existing local English OCR, corrected Notes save, reviewed links/event drafts and photo-PDF flow. Its disclosure distinguishes a selected file from a captured photo and correctly states that choosing Scan does not copy the original into Photos. Cancel, Back, Home and visibility/page lifecycle cleanup retire the review; a bitmap decoded after departure is closed without saving or reopening UI. Native Camera behavior is unchanged.

On fixed base `30c441f`, root verification passes 82 tests, TypeScript and build. All 16 focused browser checks pass, including six new import cases, existing real local OCR and PDF regressions. The camera-unavailable fixture completes a rendered import-to-Photos/reload journey and real OCR-to-Notes/reload journey without remote model requests. Invalid/oversized files, quota failure, cancellation during decode and light/compact-dark layout are covered; screenshots were visually inspected. Evidence: `test-results/camera-import/`. No Android build ran. Multipage/document-boundary scanning, broader image analysis and remaining provider/device/MVP acceptance are still open.


### October 2 — browser Photos album lifecycle

Custom album listing now recognizes the renderer's `custom:` identity prefix. Creating an album from a selected photo validates its revision and includes that photo, rather than silently creating an empty album. Album creation/rename validates a nonempty name up to 80 characters, and unsupported operations reject before mutation instead of falling through to removal. Existing revision checks still reject stale album edits and selected media.

Album counts are derived from current nontrashed media, so trash, restore and permanent deletion agree with listed contents. Membership survives trash/restore; deleting an album preserves its media. Metadata queries discard image and video data strings from retained results instead of keeping all video payloads merely to count them.

On fixed base `6665e62`, 82 repository checks, TypeScript and build pass. All 12 focused browser cases pass: the complete rendered create-with-photo → rename → reload → remove → add → delete-album flow, count/content behavior across trash/restore/permanent deletion, invalid/stale operations, and existing capture/import regressions. The original album implementation fails the new regression. Evidence: `test-results/photo-albums/`. No Android build ran. Batch-selection/share journeys, broader media scalability and the full remaining MVP/provider/device ledger are still open.


## October 2 — chronological browser Photos pagination

The browser library previously iterated primary IDs in descending order. Video IDs
start with `v:`, so every video appeared before every photo regardless of capture
date, and pagination inherited that incorrect ordering. Browser Photos now uses
an IndexedDB compound date/identity index, created by an in-place version-1 to
version-2 migration. All media views use descending capture time with deterministic
identity ordering for equal timestamps. Page cursors retain both values, so deleting
the boundary item does not invalidate the next page. Invalid or old cursor formats
reject and require reopening the library rather than silently returning the wrong page.

Verification used an isolated source snapshot with its own dependencies:

- `npm run verify`: typecheck, 82 host tests (zero failures/skips), production build.
- 15 browser tests passed across chronological pagination, album lifecycle, photo
  editing/recovery and camera persistence/permission/cancellation.
- The new migration regression seeds a real version-1 database, then verifies 120
  mixed photo/video items across three rendered Load more pages, exact ordering,
  no duplicates, end-of-list and reload. Additional tests cover deletion of the
  cursor item, a newer insertion, malformed cursor rejection, and filtered Favorites,
  Videos, Trash and custom albums.
- Restoring the original implementation makes the chronological regression fail.
- Local evidence: `test-results/photo-order/` (verification, browser and baseline
  logs plus SHA-256 source manifest).

This qualifies browser storage and renderer behavior. Pages are live queries, not
frozen snapshots: a newly captured item appears after refreshing the first page;
concurrent filter/membership changes can change later pages. Batch selection/share,
remaining broader MVP gaps, concurrent browser parity work and real device/provider
acceptance remain open. Android builds were intentionally excluded from this pass.


## October 2 — browser Photos batch selection and outcomes

The rendered batch journey exposed two product defects: Select photos changed only
prototype state, causing real media taps to open the viewer, and the assistant pill
covered Favorite selected. The production adapter now owns button-initiated selection;
the toolbar sits above the pill with enough library/album scroll clearance. Compact
360×640 light and dark controls were exercised; the dark screenshot was visually
inspected for overlap.

Browser batch operations now validate 1–20 distinct identities/revisions and an
explicit favorite/trash/restore operation before editing. Unknown operations can no
longer fall through to restore. Valid item mutations commit in one IndexedDB
transaction: storage failure rolls back all writes and rejects the receipt. Stale or
missing items return individual conflicts; unchanged items keep their revisions.
Favorites cannot mutate trashed items. Batch downloads validate the entire selection
in one read transaction and use those captured rows, removing the later unvalidated
reread. The renderer reports downloads requested and tells the user to check Downloads
and allow multiple downloads if their browser asks. This is not a guaranteed download
completion receipt or a native share-sheet claim.

Verification in an isolated source snapshot:

- `npm run verify`: typecheck, 82 host tests, production build; zero test failures/skips.
- 11 browser tests passed: visible select/favorite/download/trash/undo/reload journey,
  compact themes, invalid/duplicate/oversized selections, stale revisions, unchanged
  revisions, transaction abort rollback, stale-share rejection, album lifecycle and
  chronological pagination regressions.
- The visible journey observed two distinct Chromium download events. It does not
  establish download policy compatibility in every browser.
- Restoring the original browser adapter makes both new invalid-operation and
  transaction-rollback regressions fail. Earlier rendered attempts caught and drove
  the selection-state and toolbar-overlap fixes rather than bypassing blocked clicks.
- Local evidence: `test-results/photo-batch/` logs and SHA-256 source manifest.

The broader MVP review, concurrent browser parity integration and real device/provider
acceptance remain active. Android builds were intentionally excluded from this pass.


## October 2 — integrated browser runtime, device and media review

This delivery brings the previously local browser parity work into the repository
alongside the qualified Camera/Photos work. The source/test snapshot was frozen at
`e081193` plus the changes identified in the local source manifest. It includes:

| Area | Integrated behavior | Evidence boundary |
|---|---|---|
| Agent results | Account/agent-bound retained result notices, publish-after-storage, durable pending taps, notification/poll preferences, disconnect and lock/resume recovery | Rendered authenticated-protocol fixture; no live account grants or workflow execution |
| Notes audio | Owner-bound metadata, exact recording retention, recoverable trash/restore, migration/expiry status, cross-tab playback retirement, editable local transcript review | Real browser recording/storage/playback; recognition-provider fixtures and manual fallback do not prove acoustic accuracy |
| Device controls | Shared shade/Settings radios, airplane restore, sensor policy, brightness/text scale, Alpha media volume and local DND/alert tones | Browser-local device model; does not control host radios or host OS volume |
| Clock | Alarm creation/list/reload/delete, due foreground handling, snooze/dismiss, revision checks, single-tab ringing ownership, recurrence advancement and bounded alert audio | Browser open/foreground lifetime; repeated schedule advancement is tested, not a complete repeat-authoring UI |
| Existing MVP/design | Full light/dark navigation, compact layouts, retained Notes/Files, Camera/photo/video/scan, media edits/albums/batches/pagination, browser navigation/read-aloud, Maps selection and workflow/approval recovery regressions | Actual renderer with real browser APIs and explicitly scoped fixtures |

Final verification passed `npm run verify` (82 tests, zero failures/skips,
typecheck and production build) and the complete **245/245 Chromium browser suite**
in 4.2 minutes on isolated port 5383. The final snapshot had its own dependencies.
Clock, hosted-result and large-text Settings screens were inspected; browser
Brightness and Sound settings labels were shortened to avoid unnecessary truncation.
No Android build ran in this review.

The first full run had 238 passes, one failure and three serially skipped cases.
The failing test reloaded immediately after clicking Pause result checks, before
its asynchronous storage commit was reflected by Enable result checks. It now
waits for that existing committed-state confirmation and still verifies recovery
after reload. All four connected-result journeys ran and passed in the final suite.
The revised Clock/DND ownership and notification sound identity changes were also
included before the final freeze.

Evidence is retained under `test-results/browser-integration/`: initial and final
logs, source manifests, post-run drift, Clock/result/large-text screenshots and a
separate simulator-corruption probe. The private `.eliza/` runtime directory is
excluded from source delivery. Later edits to Clock, its tests and related source
remain in the shared checkout; they are not certified by the frozen 245-case run.

### Remaining development and acceptance work after this integration

| Open area | Current evidence and next action |
|---|---|
| Simulator startup recovery | A disposable browser with malformed `alpha.dev.app.inbox` fails with a JSON parse error and renders no Home button. Preserve damaged data, isolate recovery per app, and add startup/reload/storage-failure regressions. This defect is outside the passing 245-case suite. |
| Complete simulator actions | Qualify Inbox draft/attachment/send/triage receipts, workflow edit/run/cancel/reload, and dev-only Phone/SMS/Contacts/Wallet transitions. Navigation coverage alone is insufficient; keep all simulated effects local. |
| Latest Clock changes | Qualify and sync post-freeze sound-ledger retention and scheduling-rejection follow-ups; inspect repeat authoring, multiple alarms and lifecycle/error paths. |
| Actual assistant operations | Exercise Calendar/reminder/selected-content proposals through the local agent, including approve, cancel, stale context, restart and ambiguous receipts; direct port tests are not full-agent evidence. |
| Browser/device edge coverage | Continue full simulator lifecycle/media and settings review, browser-family compatibility, permission/eviction recovery, speech-route quality and document/scan boundaries. Camera/photo work has advanced substantially; arbitrary image analysis and multi-page scanning remain separate requirements. |
| Live integrations | Owner login/revoke/restart, Gmail/provider grants and specifically authorized mutations, password-provider browsing, production Maps coverage and real speech latency/accuracy remain separate from fixtures. |
| Device runtime and release | Follow the current acceptance ledger for packaged on-device runtime startup/recovery, authenticated IPC, background/Doze, signing/update/rollback, AOSP and physical acceptance. This browser pass does not substitute for those gates. |

The complete MVP/design goal remains active. This checkpoint synchronizes qualified
browser implementation; it does not claim that every implementation or acceptance
item is finished.


## October 2 — recover damaged simulator storage without losing other apps

The separate startup probe from the integration review is now fixed. Browser dev
simulators previously parsed saved app JSON without a guard; one malformed Inbox
record prevented the whole shell from rendering. Each simulator now loads only its
persisted fields and validates saved root/container types before installing them.
Malformed JSON, oversized records, unknown saved fields, incompatible lists/maps and
unreadable storage isolate that app for recovery. The original record is retained;
other apps and Home remain usable. Attempts to open or write the affected app enter
recovery instead of overwriting its original data with examples.

The Saved app recovery dialog is available through Device controls and when opening
a damaged app. It downloads the captured original data, then offers a separate
explicit reset confirmation for that app. Before removal it checks that the saved
value still matches the captured record. Changed values and failed/unconfirmed
removals retain actionable recovery guidance; unreadable records cannot be reset or
exported. Reset reloads the shell and preserves the other app records. The dialog
supports Back, returns focus, and opens at its explanation rather than scrolling to
the last control. Compact 360×640 light and dark layouts were visually inspected.

Verification: **14/14** focused Chromium cases passed (four new recovery journeys and
ten existing browser parity cases), plus **82/82** repository tests, typecheck and
production build. Tests verify actual backup download contents, attempted writes to
blocked apps, all six incompatible simulator records, healthy Contacts access,
reload, explicit reset, replacement detection, failed removal and unreadable storage.
Restoring the original startup loader makes the new malformed-data regression fail.
Evidence is retained under `test-results/simulator-recovery/` with logs, screenshots
and source hashes. This is a targeted follow-up to the full 245-case integration;
it is not a claim that that entire suite was rerun on this correction. Android builds
remain skipped.

This closes the reproduced malformed-JSON startup crash and incompatible-container
cases. Complete nested record-schema validation, ordinary simulator mutation failure
and cross-tab behavior, and the remaining Inbox/workflow/call/message/contact/wallet
action matrix still require review. Concurrent Clock changes remain separate local
work pending their own qualification and synchronization. The broader MVP goal is
still active.


## October 2 — Clock follow-up and Calendar assistant qualification

The remaining Clock corrections are now qualified for synchronization. The bounded
notification sound ledger keeps currently active notices while evicting older
inactive receipts, preventing an active notice from sounding again merely because
its receipt fell out of the 500-entry history. Notification lists are themselves
bounded to 100 entries. Clock set requests now require the existing scheduler's
`scheduled` acknowledgment before reporting success; a rejected/past time produces
an actionable failure instead of a false saved-alarm receipt.

Five additional rendered Calendar journeys use the real connection chooser,
conversation/proposal handling, Calendar selection, browser provider review and local
Calendar storage. They cover create, cancel, selected-event read, update and delete,
including the durable effect receipt and event persistence after reload. The request
contains selected identity/revision rather than private event description before
approval. Connection responses and the journal boundary are fixtures. These tests do
not establish a live model/provider, device IPC, or journal persistence across actual
process death.

Verification in an isolated snapshot based on `b31552d`:

- `npm run verify`: **82/82** host tests, typecheck and production build.
- **39/39** focused browser tests: Clock, notification policy/queue, network, sensors
  and all five Calendar assistant journeys.
- Built-web Calendar→Clock fixture: explicit review before set/show/snooze/dismiss,
  zero native effects in mock mode, and Escape cleanup. Its synthetic native transport
  metadata now includes the listener methods used by the current connection adapter.
  This ran entirely in Chromium against the built web assets; no APK was built.
- Both new Clock regressions fail when the original Clock/scheduler-adapter code is
  restored, then the tested fixed source is restored without other edits.
- Evidence: `test-results/clock-sync/` logs and source SHA-256 manifest.

Generated `.eliza/` workflow runtime state is now explicitly ignored by Git. It is not
product source and was not published. The concurrent Calendar editor/preferences
work is preserved separately in the shared checkout and is not covered by this
Clock snapshot. Its remaining work includes visibility/color settings, richer event
fields/recurrence/alerts, exact multi-day/all-day/DST editing and selected-event
navigation. The simulator action/schema matrix and live/device acceptance gates also
remain open; the full MVP goal remains active.


## October 2 — Calendar preferences, date editing and exact navigation

Browser Calendar visibility and color now persist atomically, update the rendered
agenda, and synchronize across tabs. Failed writes keep the saved preference and
show retry guidance. Hiding a calendar changes presentation without deleting events
or changing the agent's selected source identity.

All-day, multi-day and daylight-saving-spanning events have a browser editor with
explicit time zone, inclusive all-day end dates, revision checks and cancellation.
Unchanged repeated clock times retain their original occurrence; edited ambiguous
times use the first occurrence, and nonexistent civil times require correction.
The editor preserves event metadata and reload persistence. Recurrence and event
alert delivery remain separate unfinished work.

Opening an event by ID loads its actual date and selects its detail, including an
explicit request for a hidden-calendar event. Returning to the agenda preserves the
hidden preference. Missing events reject the request, and delayed navigation is
cancelled when the user leaves Calendar. Successful assistant mutations refresh the
Calendar after the action journal finish and receipt attempt.

Qualification used an isolated snapshot based on `6db9306`:

- **26/26** browser journeys: preferences, complex dates, exact event navigation,
  assistant create/cancel/read/update/delete and existing browser parity.
- **82/82** repository tests, typecheck and production web build.
- Existing native Calendar CRUD and delayed-query adapter fixtures passed in the
  host; these use synthetic platform boundaries.
- The exact future-event navigation regression fails against the original browser
  Calendar implementation. The verified source was restored afterward.
- The editor screenshot was inspected at 412 × 915. Evidence and SHA-256 source
  manifest are retained in `test-results/calendar-sync/`.

The first incomplete snapshot failed because the imported editor file was missing;
its failure is superseded by the complete-source results above. No Android build
ran in this synchronization pass. Live-agent acceptance, Calendar recurrence,
invitations/video/alerts, reminder assistant journeys, simulator mutation/schema
coverage and the broader provider/device acceptance ledger remain open. The latest
full browser-suite checkpoint remains `a9845d0`; this is a targeted qualification.


## October 2 — Calendar conversion and cancellation

Review found that changing a timed event to all-day subtracted 24 hours from its
end and used UTC dates instead of the displayed civil dates. A short evening event
could acquire an end before its start. Toggling also restored the original values,
discarding unsaved date edits. Converting all-day back to timed could shift the
selected dates into the preceding local day.

The editor now converts the current displayed dates, treats midnight ends as
exclusive, preserves the unsaved timed draft across an unchanged toggle round trip,
and creates local midnight boundaries when the all-day dates change. Its selected
time zone persists through conversion. A spring daylight-saving day correctly
becomes a 23-hour timed interval. Cancellation while waiting for the Calendar Web
Lock is verified to leave the stored event unchanged.

On isolated base `3b85ba6`, **15/15** browser checks and **82/82** repository tests,
typecheck and production build pass. Three conversion regressions fail against the
previous editor. Evidence and source hashes: `test-results/calendar-conversion/`.
Concurrent recurrence work was preserved in the shared checkout but excluded from
this qualification. No Android build ran. The remaining MVP and acceptance ledger
stays open.


## October 2 — simulator save recovery and full browser checkpoint

The browser development simulators previously persisted their entire app document
on every state change, including navigation, search and unsaved form edits. A full
or unavailable storage area could therefore prevent users from even opening an
editor. Only patches that change a persisted field now attempt a durable write.
This applies to Phone, Messages, Contacts, Inbox, Workflows and Wallet simulators.

Failed persistent changes show actionable storage guidance and abort the handler
before publishing success or replacing the current state. The rendered Contacts
journey verifies opening and typing with storage denied, retaining the original
bytes and unsaved draft on failure, then saving exactly once after retry and
retaining the new contact across reload. The failure still propagates as a
sanitized event-handler error in the development console; the shell stays usable.
These are development simulations and make no external calls or provider writes.

Qualification on an isolated snapshot based on `3f7a665`:

- **16/16** focused browser checks: save recovery, damaged-data recovery and browser
  parity. Both new regressions fail against the previous simulator adapter.
- **82/82** repository tests, typecheck and production web build.
- Final complete browser run: **274/274 passed**. The first complete run had 271
  passes and three interaction failures: agent-context fixture state disappeared,
  a bookmark menu became unstable, and a Clock button detached. All three passed
  an unchanged isolated rerun and the unchanged complete rerun. The cause of these
  intermittent failures is not established; both full logs are retained.
- Evidence: `test-results/simulator-save/`, including the initial/final full logs,
  focused investigation, before-fix failures and source SHA-256 manifest.

Calendar recurrence implementation is advancing separately in the shared checkout
and was excluded from this frozen snapshot. Remaining work includes its rendered
create/edit/delete-series integration, event invitations/video/alerts, actual local
agent reminder/Calendar/restart journeys, deeper simulator record validation and
cross-tab mutation behavior, complete simulated action flows, multi-page scanning,
live providers and device acceptance. No Android build ran in this pass. A complete
browser-suite pass does not establish completion of the entire MVP/design ledger.


## October 2 — Calendar series and all-day agenda

Browser Calendar now persists daily, weekday and weekly series and expands the
requested range into stable occurrence identities. Creation uses the existing
repeat controls. Individual occurrence edits and deletions preserve sibling dates;
explicitly reviewed Edit series and Delete series controls operate on the whole
schedule. Edited occurrences remain intact when the schedule moves, and deleted or
overridden dates are excluded from regeneration. Whole-series deletion removes
its overrides. Series revisions reject conflicting changes made during review.

Selected-occurrence agent operations retain the exact target identity; replay
returns the existing durable receipt. The rendered application journeys and direct
browser-provider review tests establish those local paths, not a live-model or
Android-provider result. Range expansion is bounded, includes overlapping events,
and retains saved time-zone behavior over spring gaps, autumn overlaps, half-hour
transitions and quarter-hour zones. Workflow reads use the expanded range.

This review also found and fixed two all-day defects: new provider records dropped
the all-day flag, and Home rendered the previous date in western time zones and
expired those events at UTC midnight. Provider writes now retain the flag and reject
invalid all-day types or partial-day boundaries. Home uses local civil-day boundaries
for all-day scheduling, displays the intended date, and keeps the event visible
through the local evening. A Los Angeles browser journey verifies single and daily
all-day events across reload, including the spring transition weekend.

Qualification on an isolated snapshot based on `9f5e121`:

- **43/43** focused browser journeys: recurrence calculation, rendered series
  creation/occurrence changes/reload, explicit series scope/cancellation/conflicts,
  all-day provider/Home behavior, prior Calendar editor/navigation/preferences,
  assistant fixtures and browser parity.
- **82/82** repository tests, typecheck and production web build.
- Existing Calendar CRUD and delayed-range native-adapter host fixtures pass.
- New all-day provider regressions fail against the pre-fix save path, and the Home
  agenda regression fails against the previous Home adapter. A duplicate-text
  selector and the test's simulated date-transition refresh were corrected before
  the final passing browser run.
- Evidence: `test-results/calendar-series-sync/`, with logs and source SHA-256
  manifest. The last full-suite result remains the 274-case simulator-save checkpoint.

Newer meeting/invitation work is preserved locally and excluded from this frozen
snapshot. Remaining Calendar and MVP work includes event-alert delivery, meeting
and invitation equivalents, fuller recurring-target assistant and cross-tab
lifecycle journeys, complete simulator behavior/schema coverage, actual local-agent
restart acceptance, scanning and the provider/device gates. No Android build ran in
this qualification pass; the overall goal remains active.


## October 2 — Calendar meeting preview and local responses

Browser Calendar saves attendee selections and the video option, retains them during
normal event editing, and displays the saved values after reload. Join opens an
owned local media preview. The visible disclosure states that other people are not
connected and camera/microphone media stay on the page. This is browser development
functionality; no invitations, guest messages, recording or remote call transport
are created, and it does not establish production conferencing or invitation support.

Camera and microphone access requires explicit controls. Leave, Back, background,
replacement and device lifecycle cleanup retire owned streams; late camera grants
are stopped. Ended camera and microphone tracks now reset their controls so the user
can make a fresh request. Microphone capture uses the existing shared sensor-policy
lease. The inspected phone-width dialog keeps its disclosure and controls visible.

A local guest-response editor records Added, Invited, Going, Maybe or Declined only
after Save; its disclosure makes clear that no invitation or response is sent.
Cancellation preserves the prior value. Revision checks reject changed guest lists,
failed writes preserve the record, removing a guest removes their saved response,
and changing a recurring guest response affects only the selected occurrence.

Qualification on an isolated snapshot based on `a1603e6`:

- **36/36** browser checks, covering rendered attendee/video creation and editing,
  response changes/removal/reload, recurring occurrence isolation, stale responses,
  failed writes, owned media lifecycle, existing Calendar flows and sensor policy.
- **82/82** repository tests, typecheck and production web build.
- Calendar CRUD and delayed-range native-adapter host fixtures pass.
- The ended-track recovery regression fails when the cleanup listeners are removed.
- The new response fixture was corrected to use a minute-aligned event for the
  standard editor and wait for committed storage after removing a guest.
- Evidence: `test-results/calendar-meeting-sync/`, including terminal logs, source
  SHA-256 manifest and the inspected meeting screenshot.

Attendee/video editing in the complex-date editor, Calendar event alerts, real
provider invitations/conferencing, broader assistant/restart and cross-tab journeys,
and the rest of the MVP/design acceptance ledger remain open. The latest full-suite
checkpoint is still the 274-case simulator-save run. No Android build ran in this pass.


## October 2 — Calendar alerts and notification isolation

Browser Calendar now saves None, At start, 10 minutes before and 1 hour before
alerts from the event form and complex-date editor. Due alerts appear in the existing
notification shade and open the exact event. The Calendar channel can suppress them.
Dismissing a repeating alert affects one occurrence, survives reload and does not
replay merely because the title changes. Rescheduling invalidates an old notice.
All-day alerts resolve the civil date in the saved time zone, falling back to the
browser zone for older records without one; western and eastern zone boundaries are
covered. Notices catch up within a bounded 24-hour window while the browser is open.
This does not establish background delivery after closing the browser or on a device.

Review reproduced a separate availability defect: malformed Calendar storage made
the entire notification list throw, blocking unrelated reminders and actions. The
notification provider now reports Calendar availability separately and preserves
other notices. The shade shows a Calendar-specific warning once per failure episode.
The damaged bytes remain untouched; dismissal of a healthy reminder still works.
Calendar data repair and deeper schema recovery remain separate work.

Qualification used an isolated snapshot based on `519bf5d`:

- **48/48** focused browser checks: alerts, all-day boundaries/reload, damaged-data
  isolation and visible warning, guest responses, series/editor/conversion,
  Clock, notification queue and policy.
- **82/82** repository tests, typecheck and production web build.
- Calendar CRUD and delayed-range native-adapter host fixtures pass.
- The storage-isolation regression fails against the previous notification provider.
  The frozen snapshot already included the all-day timing correction and passed
  both new zone-boundary tests before the isolation fix.
- The initial focused run had 43 passes and two series interaction timeouts; traces
  show mid-test page reloads. Separate build and verification probes did not reproduce
  them. The complete focused rerun passed unchanged. Root cause remains unresolved;
  initial and final evidence is retained in `test-results/calendar-alerts-sync/`
  alongside source hashes and the before-fix failure.

Newer complex-event guest editing and additional alert tests in the shared checkout
were preserved outside this frozen snapshot. Remaining work includes their
qualification, fuller assistant/restart and cross-tab coverage, production provider
invitation/conferencing, browser data recovery, scanning and the broader MVP/device
acceptance ledger. The latest full-suite checkpoint remains the 274-case run at the
simulator-save checkpoint. No Android build ran; the overall goal remains active.


## October 2 — complex Calendar guests and integration review

This checkpoint starts from `04d5b8a` and adds attendee and local meeting selection to the all-day, multiday, DST and recurring-event editors. A saved attendee missing from the directory remains selectable; removing an attendee removes only that person's response. Occurrence changes preserve sibling guest lists. Failed persistence keeps the draft, and cancellation leaves the stored record unchanged. Whole-series editing passes the directory through the existing scope review. These controls edit local state; they do not send invitations or connect other participants.

The initial full browser run finished **309 passed, 1 failed**. The failure was a real renderer integration gap: the complex editor received an empty directory, displayed the saved ID `maya` and omitted other contacts. The corrected model now exposes Calendar's contact choices to the adapter, which supplies them to both occurrence and series editors. The four guest-editor scenarios then passed in the shared checkout. The corrected frozen snapshot passed **310/310 browser tests** in five minutes and **82/82 repository tests**, TypeScript and the production web build. Source hashes were checked after the runs and did not change. The phone-width screenshot was inspected for layout and the corrected contact name.

The report's complete surface inventory was also refreshed: browser video/OCR, Photos albums/batch operations, Calendar series/alerts and Clock behavior are no longer described as wholly unimplemented. The inventory continues to separate those browser capabilities from live integrations and native acceptance. New reminder-assistant, recurring-assistant, cross-tab and Files/Inbox changes appearing after the freeze remain unqualified by this checkpoint.

Evidence is retained in `test-results/calendar-guests-sync/`, including the initial failure trace, test logs, editor screenshot and source hashes. No Android build ran in this synchronization pass. The full MVP goal remains active; live-agent end-to-end behavior, Calendar repair, complete simulator/Files/Inbox journeys, external-provider acceptance and the remaining product/device gates are still open.


## October 2 — reminder and recurring Calendar actions, file-picker ownership

Based on `46dc9b5`, this checkpoint integrates the browser reminder assistant journeys, recurring Calendar proposal scope, cross-tab stale-editor rejection and file-picker/Inbox attachment ownership changes. Reminder create/read/update/complete/snooze/cancel and recurring completion use the rendered proposal, approval, journal and receipt path against real browser storage. A detected stale reminder revision now returns a definite rejection before mutation instead of entering the generic unknown-outcome path. Browser receipts no longer describe Android delivery; successful native receipt guidance remains conditional on the native platform.

Recurring Calendar action reviews explicitly say **This occurrence only**. Read/update/delete/cancel/stale scenarios retain the expanded occurrence identity through the receipt, preserve neighboring dates and avoid replaying an already-applied effect. The cross-tab case rejects an occurrence save after another tab changes its series. These tests control the connection and journal boundaries: they establish renderer/provider integration, not a live agent's proposal quality, real process-death recovery or Android scheduling.

File/folder pickers now have one active owner. Replacement, Back, page retirement and device lifecycle cancel the pending consumer; detached input changes and late directory grants cannot resume it. Directory read failures leave no partially imported tree. Import commits check cancellation, and late selection creation releases its temporary URL. Inbox also releases selected-file access after copying and validating an attachment, whether the file is accepted, rejected or its consumer retires. Completed imported files remain in the local Files store.

Verification on the frozen source: **37/37** integrated browser cases plus **4/4** existing Inbox/agent-context/cloud-delegation adapter cases; **82/82** repository tests, typecheck and production build. The device-action contract fixture passed with `node --experimental-transform-types --import tsx scripts/test-device-actions.mjs`; invoking it without the project loader first failed to resolve an extensionless TypeScript import. Three negative-control cases failed against the previous Inbox/reminder controllers: both attachment acceptance paths leaked the selection, and stale reminder rejection had the wrong outcome classification. The changed-source hashes matched after testing. Logs and source manifest are retained in `test-results/assistant-files-sync/`.

No Android build or external messaging ran in this pass. Current simulator/Inbox changes appearing after this snapshot remain pending. The next browser work includes complete local Inbox draft/attachment/send/triage and simulator durability, Calendar storage recovery, and real local-agent action/restart acceptance. Live-provider and device acceptance gates remain open; the full goal remains active.


## October 2 — local Inbox drafts, attachments and recipient validation

Based on `d36aa21`, the explicit browser development Inbox now saves/restores drafts with reviewed PDF/image/TXT bytes, Cc/Bcc and confirmed discard. Local send persists the message, reply marker and saved-draft removal before closing the composer. Failed storage leaves the composer available; retry writes one message. The sent attachment survives reload and opens with the original bytes. Temporary selected-file access is released. This is local simulation: the tested journey made no external HTTP requests and no email was delivered to a provider.

The review reproduced a recipient validation hole: a malformed literal address accepted as a chip could bypass the Save/Send checks. Both actions now validate every selected recipient against a literal-address format or a known contact with an address. The regression failed before the fix and passes afterward; a selected contact also survives save/reload/send. Literal address chips display their actual addresses rather than an unknown-person label. Editing a saved draft now displays **Unsaved local draft** while leaving the previously saved bytes unchanged until Save is chosen.

Final frozen verification: **51/51 browser tests** covering Inbox, picker cleanup, simulator save/recovery, browser parity and the light/dark design states; **82/82 repository tests**, TypeScript and production web build. The phone-width composer screenshot was inspected. The initial three Inbox cases passed; an intermediate run after the validation fix had three passes and one navigation-interrupted failure at the initial Compose click. Its trace was retained, and the subsequent owning and final frozen campaigns passed. No cause is asserted for that unexpected reload. Source hashes matched after the final run. Evidence is retained in `test-results/inbox-simulator-sync/`.

The Inbox remains a local development simulator, separate from connected Gmail. Reply/forward/search/triage, cross-tab simulator mutations and deep saved-record recovery still need qualification. Calendar repair, live local-agent action/restart behavior, external services and device acceptance remain in the full goal. No Android build ran in this synchronization pass.


## October 2 — Inbox triage and independent saved drafts

The isolated review starts from `8e88f4a`. Rendered local Inbox journeys now verify body search, archive/undo/delete through reload, reply identity and source-only replied flags, and forwarding exact reviewed attachment bytes to a newly chosen recipient. No external mail is sent. The existing tests also cover local send failure/retry, draft reload, recipient validation and explicit discard.

A new regression reproduced a data-loss defect: save one draft, close its composer, compose and send another message, and the first saved draft disappeared. Saved drafts now have independent local identities. Save updates the matching draft while retaining others; send and confirmed discard remove only the current composer's draft. Each saved draft has its own restore control. Older drafts receive an identity on explicit restore, and subsequent saves update that draft without creating a duplicate. This does not yet solve simultaneous writes from multiple tabs.

Verification: **13/13 Inbox browser journeys** and **6/6 simulator save/recovery checks**, plus **82/82 repository tests**, typecheck and production build. The new separate-message regression fails on the previous implementation and passes with the fix; additional cases cover two saved drafts, discarding one, and restoring/updating a legacy draft. Frozen input hashes matched after verification. Logs and source manifest are retained in `test-results/inbox-triage-sync/`.

Newer Camera, reminder and Cloud work in the shared checkout is preserved and is outside this tested snapshot. The dated Cloud validation records normal website sign-in separately from phone credential exchange and identifies a personal-agent onboarding contract gap; neither this browser Inbox fixture nor that website login closes Cloud phone acceptance. Simulator cross-tab writes and deep recovery, Calendar repair, live local-agent actions/restart, provider and device gates remain open. No Android build ran in this pass, and the full MVP goal remains active.


## October 2 — Camera screen light and reminder edit cancellation

The frozen snapshot starts from `3687b67` and includes the pending Camera and reminder changes. In the explicit browser development profile, a camera without torch capability now offers **Screen light**. The owned white viewfinder illumination is separate from the captured pixels; normal browser mode still rejects unsupported hardware torch activation. Off, Home, camera replacement, page retirement, visibility loss and source termination remove the overlay. The phone-width screenshot was inspected and the controls remain visible. Display illumination efficacy and physical camera behavior are not established by the synthetic stream test.

Reminder title/body edits with an unchanged schedule use the selected-record update contract rather than rescheduling. They preserve the saved time zone, recurrence, occurrence identity, snooze and history, including a resolved DST gap. Explicit time edits still select a new schedule. Stale targets reject; an unconfirmed response blocks another save until the reminder is reopened for review.

The review reproduced an additional cancellation race: closing the editor while the operation hash was being prepared still dispatched the mutation. The controller now checks the same live component/editor and visible page immediately before dispatch. A retired save also releases its original owner's busy state rather than a replacement component's state. The regression expected zero dispatches, observed one before the fix and passes afterward. It does not promise cancellation after a mutation has already been dispatched.

Verification: **33/33 browser checks** covering reminder recurrence/edit boundaries, cancellation, reminder assistant actions, Camera lighting/controls and video; **82/82 repository tests**, TypeScript and production build. Input hashes matched after the runs. Evidence and the screen-light screenshot are retained in `test-results/camera-reminder-sync/`. Concurrent commit `e62ca37` incorporated the exact tested reminder source/test changes; this integration preserves that commit. No Android build ran in this browser pass.

Current multi-page Scan work appearing after the freeze remains pending. Camera focus interaction and video editing, simulator concurrency/deep recovery, Calendar repair, live local-agent and Cloud onboarding acceptance, provider integrations and device gates remain open. The full goal stays active.


## October 2 — multi-page Scan documents

Starting from `a5d9dca`, browser Scan review now opens an ordered image document. Users can add, replace, reorder and remove pages before exporting one PDF. Each page retains its portrait/landscape orientation. Bounds are 1–20 pages, 16 MB per input image, 64 MB total input, 32 million pixels per image and the existing 8 MB export limit. OCR corrections remain separate Notes text; this is an image-only PDF rather than a searchable-text claim. Direct additional camera captures and durable draft documents are not implemented by this checkpoint.

The builder owns its preview URLs, pending picker and conversion cancellation. Closing during conversion releases a late bitmap without calling the exporter. Back closes the document before the parent text review. A conversion failure allows retry before export; a lost response after export retains the pages and blocks another attempt in that review, with an explicit instruction to check Downloads. The added failure-boundary tests verify both cases.

Verification: **23/23 document, picker, single-page PDF, Scan link and Calendar-draft browser cases**, plus **5/5 local OCR cases**; **82/82 repository tests**, TypeScript and production web build. The real downloaded two-page fixture was rendered with Poppler and visually inspected: blue landscape followed by red portrait, with intact image geometry and margins. The review screenshot was also inspected. Input hashes matched after testing. Logs, PDF, renderings, screenshot and source manifest are retained in `test-results/scan-document-sync/`.

This is browser/host evidence. No Android build ran in this synchronization pass. New Camera focus work in the shared checkout is preserved separately. Durable multi-page drafts, direct camera retakes, page-edge correction, searchable PDF/language quality, video editing, simulator concurrency/recovery, Calendar repair and live-agent/provider/device acceptance remain open. The full goal remains active.


## October 2 — Camera focus and driver ordering

Based on `9d58a23`, browser Camera taps now select a viewfinder-relative focus target. The hardware request accounts for the cover crop, zoom and front-camera mirror. A matching reported focus mode and point are required before displaying confirmed camera focus. Otherwise the development target remains an explicitly local interaction; no optical refocusing or image-pixel change is claimed. Replacement, zoom, Home, page retirement, hidden pages and ended streams remove the owned target.

A new rapid-selection regression found that retiring old UI replies was insufficient: two driver requests could finish out of order, leaving the hardware on the old point while the newest indicator showed success. Requests now serialize per camera track. Retired queued targets do not dispatch; a replacement track has its own queue and can proceed while the old driver is pending. The regression failed with the old final point and passes with the latest point after repair. A separate case verifies retirement and independent replacement-track progress.

Verification: **28/28 browser Camera focus/lighting/control/video/import cases**, **82/82 repository tests**, TypeScript and production build. The phone-width focus indicator screenshot was inspected. Final source hashes matched after testing; logs, before-fix regression and screenshot are retained in `test-results/camera-focus-sync/`. No Android build ran in this pass. Hardware lens quality and browser-family behavior still need actual device evidence.

New browser video-editing files appeared after the snapshot and remain separate pending work. Durable scan drafts/direct retakes, page correction/searchable PDF, simulator concurrency/deep recovery, Calendar repair and live-agent/provider/device acceptance remain open. The full goal stays active.


## October 2 — Video saved-copy editing

Browser Photos now opens a video editor with start/end trim, 90-degree rotation, center crop and preview. Export re-encodes locally with audio from the saved file, without requesting a microphone. A stable operation receipt and source revision bind the saved copy; the original remains unchanged. Copy and receipt publish atomically, and replay resolves the existing result. Back, Home, page retirement and reload recovery retire interrupted saves. Cancellation also settles suspended audio startup and releases its context and output tracks.

Review found that a synchronous MediaRecorder startup failure bypassed promise cleanup and retained its export deadline. A new failure-injection regression reproduced one pending deadline before repair. Startup now enters the same terminal cleanup path as asynchronous encoder errors; the regression verifies failure, no deadline, and ended output tracks.

Verification: **28/28 browser tests** covering video editing/capture, photo editing and batch operations; **82/82 repository tests**, TypeScript and production build. The editor tests decode real audio samples and duration, check transformed dimensions, original byte preservation, replay/reload, quota rollback, stale revision rejection and interruption. The phone-width editor screenshot was inspected. Synthetic camera and microphone inputs exercise real browser codecs and IndexedDB. The initial 9-case shared-checkout run was exploratory; final evidence comes from the isolated snapshot based on `19f9429`. Logs, failing regression, screenshot and input/final hashes are retained in `test-results/video-edit-sync/`. No Android build ran in this pass.

Codec fallback where these browser APIs are absent, browser-family and long/portrait/silent-source qualification, durable Scan drafts/direct retakes, page correction/searchable PDF, simulator concurrency/deep recovery, Calendar repair and actual local-agent/provider/device acceptance remain open. The full goal stays active.


## October 2 — Calendar recovery and integration audit

Browser Calendar now offers recovery directly from a load-error screen and through Device controls. It preserves the original bytes until explicit reset, downloads an exact-byte backup, and requires a second confirmation before removing local events, preferences and action receipts. Reset uses the same cross-tab lock as Calendar writes, compares the current data with the reviewed snapshot, and cancels if the dialog closes or retires before the lock is acquired. It refuses reset without Web Locks. Other app data remains unchanged. A reset renews the source revision, rejecting proposals bound to the deleted source. This is backup and reset, not automatic salvage or backup import.

A frozen full-suite run at `c8b4555` completed with **376/378 passing**. The meeting test reloaded before its asynchronous rename committed; it now waits for the durable title before reload. The Clock failure test restored storage while a delete could still be pending and attempted a second delete; alarm controls now disable immediately during writes, and the test waits for the failed operation to settle. A deterministic held-lock case verifies the disabled control and preservation of the alarm after a failed write. The original two failures reproduced in a focused rerun; meeting then passed, and Clock passed twice in isolation. An intermediate broader run hit a separate Clock navigation timeout, retained in the log.

The updated base includes committed personal Cloud onboarding and Calendar fixture changes through `38fced1`. **42/42 targeted browser checks** passed across recovery, Calendar meetings/alert isolation, Clock, Cloud onboarding fixtures and cross-tab storage; **83/83 repository tests**, TypeScript and production build passed. The recovery dialog was inspected at phone width. No live Cloud provisioning or Android build was performed by this pass.

Storage interruptions remain explicit: the first integration process exited during disk exhaustion; the no-trace rerun produced the 376/378 result. A later targeted startup failed with ENOSPC and succeeded on retry. The final 399-case integration rerun then terminated during another disk shortage, after a recovery case reported failure but before its failure artifact or final summary could be written. That interrupted case is not counted as a pass or diagnosed as a product defect without usable evidence. The small Scan button change accidentally copied from concurrent work was excluded before the final production build. Logs and source hashes are retained in `test-results/full-video-integration/` and `test-results/calendar-recovery-sync/`. A complete current-source full-suite pass remains outstanding.

Concurrent Scan draft/direct-retake work remains separately pending. Further work includes stable full integration validation, automatic Calendar salvage/import, simulator concurrency/deep recovery, searchable PDF/page correction, actual local-agent workflow/action journeys, provider integration and physical/user acceptance. The full goal stays active.

Final synchronization validation: after rebasing onto `5268ad0` (including the committed workflow-context repair), **26/26 browser checks** passed across Calendar recovery, meetings, Clock, storage and the actual workflow-run composer fixture. **83/83 repository tests**, TypeScript and production build passed again. The complete full-suite gate remains outstanding. This pass preserves the separately pending Scan files.


## October 2 — Scan drafts and retakes

Camera now opens document review without selecting a new image. Review can save one revision-bound draft per browser profile in IndexedDB, load its ordered image blobs after reload, or delete the saved draft while retaining the open review. Loading over unsaved pages asks for confirmation. Capture new page and per-page Retake open a nested camera review; only Use captured page adopts the JPEG. Capture owns cloned preview tracks or its own requested stream, preserving the parent preview and stopping late grants after cancellation.

Review reproduced a transaction-boundary defect: cancelling after IndexedDB queued a draft write still committed it. Transactions now listen for cancellation until completion and abort queued saves and deletes. Two regressions assert that cancelled writes publish no draft and cancelled deletion preserves the saved revision and exact bytes. Revision conflicts and quota failures remain rejected without a false saved status.

Verification on the frozen snapshot based on `4e2eb43`: **17/17 browser tests**, **83/83 repository tests**, TypeScript and production web build. Cases include document order/PDF export, draft reload through Camera, stale revisions, deletion preserving the review, quota/cancellation, adopted retake pixels, denial/retry, Back/page retirement and cloned-track ownership. The reviewed capture and loaded-draft phone layouts were inspected. An initial retake test sampled the old page before decoding completed; it now waits for adoption and enabled review controls. A concurrent test improvement adds an explicit source-URL change assertion; the merged camera suite passed **4/4**. An initial PDF-download timeout ended with the app at Home; the cause was not established, and two subsequent combined runs passed. Logs, source hashes, screenshots and the failing cancellation regression are retained in `test-results/scan-draft-sync/`. No Android build ran in this pass; the parity document retains separately authored historical packaging evidence.

Remaining Scan work includes page-edge correction, searchable PDF/language quality, richer document organization and browser-family/physical camera qualification. The complete current-source browser suite, simulator concurrency/deep recovery, actual local-agent workflow/action journeys, provider integration and device/user acceptance remain open. Concurrent workflow changes are preserved separately. The full goal stays active.

Final synchronization: rebased onto `11e5073`, which admits reviewed workflow navigation. **20/20 combined Scan and workflow-navigation browser checks** passed, followed by **83/83 repository tests**, TypeScript and production build. The full-suite gate remains open.


## October 2 — Full browser integration checkpoint

The isolated snapshot based on `2846ee2` completed one uninterrupted **412/412 browser test run** in 5.7 minutes. Trace recording was disabled to reduce disk pressure; assertions and screenshot output remained enabled. A subsequent **83/83 repository test run**, TypeScript and production web build passed. This supersedes the previous incomplete full runs for this source snapshot, including Calendar recovery, Clock writes, video copies, Scan drafts/retakes, Inbox journeys, design states and workflow context/navigation fixtures.

The only executable change beyond that commit is hosted-result test cleanup: release a held route, wait for route handlers to drain, close the page, then remove its temporary storage. This prevents asynchronous route callbacks from accessing a deleted fixture directory. Input hashes still match the frozen files. Evidence is retained in `test-results/current-browser-integration/browser.log`, `verify.log`, `input.json` and the integration screenshot directory. The separate parity document's historical native/package campaigns remain attributable to their recorded snapshots; no Android build ran here.

Read-only live-host checks also returned authenticated HTTP 200 for owner identity, workflow status and workflow listing. The local workflow engine reported ready with manual submission protocol 1 and one saved workflow. This is service readiness evidence, not a successful live author/edit/run/cancel/restart journey. In-app browser attachment timed out, so no rendered live-host acceptance is claimed by this checkpoint.

Remaining work includes current Phone/Messages simulator persistence and failure paths, deeper simulator validation and concurrency, Scan page correction/searchable PDF/language quality, browser-family media qualification, actual local-agent workflow and selected-action journeys, production provider integration and device/user acceptance. Newly appearing model-selection, connection UI, simulator and native-test edits are excluded from the frozen run and preserved for follow-up. The complete MVP/design goal remains active.


## October 2 — Phone and Messages persistence

Development Phone now clears active-call ownership and stops its background timer only after saving the ended-call history. Development Messages clears the typed composer only after its message is persisted. Failed storage leaves hangup retryable and preserves typed message text. Successful retry saves one history entry or one matching message. These simulators remain development-only; no carrier call or SMS was made.

Both failure-path regressions fail against the previous implementation: End call remains visible after retry, and the failed message text is empty. Restoring the tested source reproduces the passing frozen hash. The combined Phone/Messages, Inbox triage, Contacts save and saved-app recovery suite passed **16/16 browser tests**. **83/83 repository tests**, TypeScript and production build passed. Successful Phone/Messages journeys assert no external HTTP traffic. Evidence and before-fix failures are retained in `test-results/phone-messages-sync/`.

This source is based on `78dba2e` plus two ordering changes and new tests. The full 412-case checkpoint predates these changes. The parity document retains another campaign's separately scoped packaging evidence; this pass skipped Android builds. Concurrent Wallet, model-selection, connection, reminder-proposal and native-test work is preserved outside this snapshot. Incoming/voicemail flows, richer message/contact actions, Wallet/workflow simulation, simulator concurrency/deep validation, live-agent/provider acceptance and physical/user qualification remain open. The full goal stays active.


## October 2 — Development Wallet persistence

Development Wallet now saves transit credit with its matching transaction, and simulated payment completion with the transaction and payment count. Each operation uses one persisted state update. Card add/lock/default/remove and reload journeys use predefined development tokens and collect no card credentials. Shipping payments remain deferred.

Review found an additional failure: a rejected simulated payment save remained on the processing screen indefinitely. A new rendered regression fails before repair. On failure, the simulator now cancels pending completion timers and returns to confirmation, preserving stored bytes and requiring explicit retry. The regression verifies unchanged storage after failure and exactly one transaction/count after retry.

The frozen snapshot based on `8983362` passed **15/15 browser checks** across Wallet, Phone/Messages, Contacts save and saved-app recovery. **83/83 repository tests**, TypeScript and production web build passed. Logs, source hashes and the failing regression are retained in `test-results/wallet-sync/`. Rebase onto `6b29d12` adds only completion-plan documentation. No real payment service, carrier operation or Android build ran in this pass. Historical packaging evidence in the parity document remains scoped to its author's snapshot.

The full 412-case checkpoint predates these simulator changes. Cross-tab simulator concurrency and deep validation, remaining message/contact/workflow actions, actual local-agent/provider journeys, Scan correction/searchable PDF and physical/user acceptance remain open. Concurrent Contacts, connection/model, proposal, research and native work is preserved separately. The full goal remains active.


## October 2 — Development Contacts persistence

Development Contacts creates UUID-backed identities in both form and local intent creation, preventing same-name contacts created at the same clock value from colliding. Rendered checks cover creation, editing fields, favorite state, deletion, Undo and reload. A failed edit retains the typed draft while the stored original remains unchanged.

Review reproduced an additional recovery defect: Undo cleared its action before trying to restore a deleted contact, so storage failure removed the retry route. Contact restore now catches that failed write and presents a fresh Undo action. It checks for the original identity before inserting, preserving exactly one record. The regression fails before repair and passes afterward, verifying that failed restoration leaves the stored contact absent and explicit retry restores its original identity and fields.

The frozen snapshot based on `8dc086b` passed **14/14 browser tests** across Contacts, Phone/Messages and simulator save/recovery. **83/83 repository tests**, TypeScript and production build passed. Evidence, source hashes and before-fix failure artifacts are retained in `test-results/contacts-sync/`. This pass performs no external contact sync or telecom action and skips Android builds. The full 412-case integration checkpoint predates these changes.

Remaining work includes simulator cross-tab concurrency and deep saved-record validation, remaining incoming/message/workflow actions, real local-agent/provider journeys, Scan page correction/searchable PDF, browser-family media qualification and physical/user acceptance. Concurrent model/connection, proposal, research and native work remains outside this snapshot. The full goal stays active.


## October 2 — Simulator writer ownership

The synchronous development app reducers previously wrote complete saved documents without cross-tab ownership. One development tab now holds an origin-wide Web Lock for Phone, Messages, Contacts, Inbox, Workflows and Wallet writes. Other tabs can read; saves are refused with an explanation, preserving the local draft. Closing the writer and reloading another tab acquires fresh ownership and reads the current saved data. Page retirement immediately revokes the old writer, and unavailable Web Locks refuse persistence.

Every write also compares the stored bytes with the exact snapshot parsed at startup or last written by that owner. An out-of-band replacement is retained, with a reload/copy-draft message instead of overwriting it. This is single-writer protection, not concurrent multi-tab editing or automatic merge. Those broader capabilities remain separate work. Calendar, Notes and other dedicated browser stores retain their existing storage contracts.

Validation on the isolated snapshot based on `f18a7ce`: **20/20 simulator browser checks** (Contacts, Phone/Messages, Wallet, save/recovery and the two-tab journey), followed by **17/17 Inbox and conflict checks**. Four ownership tests cover stale-tab rejection plus handoff, out-of-band replacement, missing Web Locks and page retirement. **83/83 repository tests**, TypeScript and production build passed. An exploratory pre-fix run failed the stale-tab draft assertion; source changed before its process completed, so it is not treated as a clean negative-control run. Logs and final source hashes are in `test-results/simulator-concurrency-sync/`. No Android build ran.

Concurrent incoming-call changes in the shared simulator file are preserved but excluded from this snapshot. Deep saved-record validation, richer simulator journeys, actual local-agent/provider execution, Scan correction/searchable PDF and device/user acceptance remain open. The full 412-case run predates this writer change. The full goal stays active.


## October 2 — Development incoming calls and voicemail recovery

Device controls can inject a local incoming call. Repeated injection brings the existing incoming or active call forward instead of starting a second one. Answer/end records one incoming history entry; decline commits missed-call history and its simulated voicemail together. Screening retains its local transcript after a rejected save and permits explicit retry. Reload restores saved history and voicemail without reviving an active call. These are development simulations, not carrier calls, real caller screening or external message delivery.

Review reproduced a voicemail Undo defect: a failed restore consumed the retry action. Restore now offers Undo again on failure and checks the original identity before inserting. A rendered regression failed before the fix and passed afterward, confirming unchanged storage after failure and exactly one restored original record after explicit retry and reload.

The isolated snapshot based on `7a551d2` passed **19/19 browser checks** covering incoming calls, voicemail, Phone/Messages, simulator ownership, save failure and saved-data recovery. **83/83 repository tests**, TypeScript and the production web build passed. Source hashes, logs and the negative-control screenshot are retained in `test-results/incoming-call-sync/`. An earlier four-test shared-checkout run also passed but is supplementary evidence only; it included unrelated pending voicemail playback and copy changes. The frozen checkpoint excludes those changes. The subsequent rebase adds only completion-plan documentation from `955c939`. No Android build ran.

The requested development restart was also completed: Vite on 5317 and the real local Eliza host on 47849 are listening, with authenticated browser-bridge owner lookup returning HTTP 200. Local orchestration still uses hosted inference. This is connection evidence, not live model/tool or physical-device acceptance.

Remaining work includes actual voicemail audio/playback ownership, deeper simulator record validation and message/workflow journeys, live local-agent/provider actions, Scan correction/searchable PDF, browser-family media qualification, and native/device/user acceptance. Concurrent confidentiality-copy, provider/model, proposal, research and native changes remain outside this checkpoint. The full 412-case browser run predates this change; the entire MVP goal remains active.


## October 2 — Development voicemail transcript reading

Development voicemail now reads its exact stored transcript through the existing local browser voice implementation. The control says Read voicemail/Stop reading, accepts only local-service voices and returns to a retryable state on unavailable speech. It does not fetch or play a carrier recording. Leaving Phone, deleting or switching the selected message, changing tabs, page retirement, hidden-page state and incoming calls retire playback. Stale completion callbacks cannot end a newer read.

Review reproduced a device-state mismatch: the shared voice engine stopped while voicemail continued to show Stop reading. The new regression fails before repair. Device-state retirement now clears the voicemail owner and UI state, permitting explicit replay. Visual review also caught the fixed prototype recording duration and progress bar, which did not measure text-to-speech playback. Development transcript reading now displays Local transcript/Reading transcript instead. The prototype recording presentation remains available for its original reference flow.

The isolated snapshot based on `d50f55b` passed **26/26 browser checks** spanning voicemail, incoming calls, Notes audio lifecycle and reviewed reading. After the display correction, **13/13 affected voicemail/incoming-call checks** passed; **83/83 repository tests**, TypeScript and production web build passed again. Speech-engine fixtures prove lifecycle behavior and exact transcript selection, not acoustic output or actual device voice availability. Evidence and before-fix screenshot are retained in `test-results/voicemail-audio-sync/`. The rebase adds only completion-plan documentation from `7c92213`. No Android build ran.

Remaining scope includes carrier voicemail integration and acoustic/browser-family acceptance, deeper simulator validation and message/workflow flows, actual local-agent/provider action journeys, Scan correction/searchable PDF, and native/device/user acceptance. Concurrent Messages, confidentiality-copy, provider/model, proposal and research edits are preserved outside this snapshot. The full 412-case integration checkpoint predates these changes; the entire MVP remains unfinished.


## October 2 — Development Messages lifecycle

Development Messages assigns identities to newly sent local messages. Delayed simulated replies check that their originating message still exists before adding typing state or a reply, preventing a deleted thread from being recreated by its pending callback. Conversation Undo restores only the deleted thread and unread marker, preserving newer messages elsewhere; if a new conversation already exists for the same contact, it preserves that newer conversation. Failed photo send retains the attachment tray for explicit retry. Search is checked against sent text after reload.

Review reproduced lost retry after failed conversation Undo. Restore now offers Undo again on failure. Failed swipe deletion also resets the transient slide so the still-stored row returns onscreen for retry. The new retry journey exposed a second defect: the longer error toast covered the composer Send button. Messages now positions toasts above the composer; the same test passes with normal pointer clicks while sending another message before retrying Undo. Failure screenshots and logs are retained.

The frozen snapshot based on `aff1241` passed **20/20 browser checks** across Messages lifecycle, Phone/Messages, simulator ownership, storage failure and recovery. **83/83 repository tests**, TypeScript and production web build passed. Evidence and source hashes are in `test-results/messages-lifecycle-sync/`. The first regression failed before Undo repair; the first combined run passed 19 cases and exposed the toast overlap, then all 20 passed after that layout fix. These are local simulations; no SMS, carrier, remote recipient or Android build is involved.

Pending local attachment/draft work remains separate, along with deep saved-record validation, real local-agent/provider action journeys, Scan correction/searchable PDF, browser-family media qualification, and native/device/user acceptance. Concurrent confidentiality-copy, provider/model, proposal and research work remains outside this checkpoint. The full 412-case run predates these changes, and the entire MVP goal remains active.


## October 2 — Development Messages attachments and drafts

Development Messages supports reviewed PDF, image and UTF-8 TXT attachments, explicit local draft save/restore, and retained attachment preview after reload. Files use the existing type/content, size and digest checks. Sending stores the selected bytes and text together and removes the recipient's saved draft in the same write; failed persistence retains the current text and attachment. Saved Messages documents now allow the same 12-million-character bound as Inbox, with a matching pre-save check on the attachment/draft path. This does not establish deep validation of every saved nested record.

The picker already rejected late selection after Home or device-state retirement. Review found a separate race after selection: asynchronous file validation could finish after device retirement and still attach its result. A regression holding digest validation fails before repair. Device-state changes now invalidate the review generation and refresh idle controls; a late completion is discarded. Hidden-page/page retirement also releases busy state, and disposal removes the new listener.

The frozen snapshot based on `23e06af` passed **20/20 browser checks** across six attachment/draft journeys, Messages lifecycle, Phone/Messages and saved-app recovery. Checks include exact UTF-8/CRLF bytes through save/reload/send/preview, failed send plus explicit retry, invalid replacement preserving the existing file, text-only draft removal, late picker selection and late validation. **83/83 repository tests**, TypeScript and production web build passed. Evidence, source hashes and the failing validation-race screenshot are in `test-results/message-attachments-sync/`. Rebase adds only completion-plan documentation from `f5c4c94`. No carrier transport, external recipient or Android build ran.

Remaining scope includes deep saved-record validation, broader independent-draft and large-media acceptance, actual local-agent/provider action journeys, Scan correction/searchable PDF, browser-family media qualification, and native/device/user acceptance. Concurrent confidentiality-copy, provider/model, proposal and research changes are preserved outside this snapshot. The full 412-case integration checkpoint predates these changes; the entire MVP remains unfinished.


## October 2 — Simulator integration and reminder-time review

The complete committed browser suite passed **454/454 tests in 10.3 minutes** on `18969d2`. The checkout stayed frozen through the run; this integrates all committed Phone, Messages, Contacts, Wallet, writer-ownership and prior browser functionality, including the new voicemail and attachment paths. Evidence, source identity and retained artifacts are in `test-results/browser-integration-18969d2/`. This supersedes the earlier 412-case checkpoint for committed browser coverage, but does not cover pending root edits, real providers, physical hardware or user acceptance.

The pending development-backend reminder action now accepts localDateTime plus timeZone instead of asking the model to calculate epoch milliseconds. Review reproduced an ambiguity: the same fall-back wall time identified two different instants, yet the resolver silently chose one. The resolver now compares candidates from neighboring zone offsets, accepts exactly one matching instant, and rejects skipped, impossible or repeated local times. Ambiguous input returns a clarification request and adds no proposal. The runtime prompt and proposal acceptance harness use the same parameter contract.

Five isolated tests cover ordinary seasonal offsets, a fractional-hour zone, malformed/skipped times, one-hour and half-hour repeated times, rejection without a proposal, and an exact future proposal with preserved context revision. The ambiguity regression fails before repair and passes afterward. The final integrated candidate passed **88/88 repository tests**, TypeScript and the production web build. Rebase adds only completion-plan documentation from `bdcd6a6`. Evidence and source hashes are in `test-results/reminder-time-review/`. This is the development backend proposal path; no live model request, actual scheduling or Android build is claimed here.

A separate live availability check found the previous dev process had exited with code 143. The local stack was restarted; browser-bridge owner lookup and workflow status both returned HTTP 200, with owner role and workflow manual-submission protocol 1. That establishes recovered authenticated availability, not an executed workflow or a live approved device action. Initial failure and recovered status evidence are retained separately.

Concurrent confidentiality-copy, provider/model, redaction and research changes remain outside this checkpoint. Deep saved-record validation, full real-agent/provider journeys, Scan correction/searchable PDF, browser-family media qualification, native process/device and user acceptance remain open. The full MVP goal remains active.


## October 2 — Privacy copy and real navigation coverage

Settings now calls the page Privacy & data, matching local-agent architecture rather than enclave hosting. Reference/mock seed copy no longer asserts enclave sealing or passed attestation. Outside mock mode, the actual Privacy page states that redaction is not connected and the on-device model is not loaded. Prototype permission counts, activity totals and memory sizes are replaced with Review access/Not connected. This is disclosure correction, not implementation of redaction, privacy inventory, memory management or offline inference. Mock mode remains explicitly labeled simulated data and actions.

Review found a material test-coverage error in the pending confidentiality suite: `start=` is honored only in fixture/mock mode, so non-mock cases were repeatedly checking Home. The corrected real-mode tests click visible controls and assert the active view, then navigate Settings pages explicitly. Mock-state checks remain separate. The original interrupted run is not treated as broad real-screen evidence.

On the frozen snapshot based on `7130ead`, **90/90 corrected browser checks** passed: 28 real production/development journeys, 54 labeled mock previews and eight Messages attachment tests. After removing the additional unverified Privacy counts, **28/28 affected real-screen checks** passed. Screenshots initially caught transitions; two final Privacy checks wait for finite animations, pass, and produce visually inspected settled layouts. **88/88 repository tests**, TypeScript and web build passed. The added PNG test verifies retained binary bytes and decoded dimensions after reload; the PDF test verifies the downloaded original bytes and one-page document. Evidence and source hashes are in `test-results/privacy-copy-sync/`. Rebase adds only completion-plan documentation from `a6a5078`.

The full 454-case browser checkpoint predates these changes. Pending local Workflow execution, provider/model, runtime redaction and research changes remain outside this snapshot. Actual privacy inventory/redaction integration, deep saved-record validation, live agent/provider journeys, Scan correction/searchable PDF, browser-family media qualification and native/device/user acceptance remain open. No Android build ran, and the full MVP goal remains active.


## October 2 — Development workflow execution and recovery

Development mode now executes a bounded set of actual local operations instead of fabricating a successful run from its labels. A run saves its identity and workflow definition before effects, persists the in-flight step and each completed output, and retains cancellation/failure/interruption receipts across reload. Reload never automatically replays an uncertain effect. Run again creates a new run identity. Supported sources are explicit Messages, Inbox, Contacts and today's Calendar; DND updates the browser device. Local Send stores simulator Messages/Inbox copies with step-bound IDs, checks an existing receipt before another write, and rejects mismatched replay content. These are local fixture copies, not carrier or external email delivery.

Review reproduced a false success: the pending Write implementation called a truncated input a summary. That regression fails before repair. Generative Write steps now report that a connected agent is required and produce no invented completed step. Unsupported filtered/ranged reads (new messages, overnight inbox, multi-day calendar) fail rather than silently substituting all records or today's events. Oversized read output is rejected intact rather than truncating serialized records. Workflow history reserves space before an effect; failed intent/destination persistence prevents the next effect. This dev subset does not implement all palette labels, schedules, generative steps or the separate real-agent workflow engine.

The executor passed **11/11 initial browser checks**, then **14/14** with the pending local delivery and journal-capacity changes included. A separate **14/14** persistence/concurrency/workflow-context subset passed. Cases cover held-step cancellation, interrupted reload without replay, action failure, new receipts on Run again, false-condition skipping, failed intent persistence, unsupported summary/read failures, exact local destination copies, idempotent receipt inspection, failed destination writes and capacity refusal. Evidence and source hashes are retained in `test-results/workflow-executor-sync/`. An initial repository verification passed 88 tests, TypeScript and web build; the expanded snapshot's first rerun hit a 10-second javac timeout in the unrelated native scoped-stop harness. The rerun without the parallel browser workload passed **88/88 repository tests**, TypeScript and the production web build.

The stopped development services were restarted with the prepared local Eliza source. Authenticated owner lookup and `/api/workflow/status` returned 200 (OWNER, smthrs, manual-submission protocol 1). The existing in-app browser was reloaded and its real Workflows listing displayed the retained paused development draft. No draft was executed and no external message was sent. This proves restored live availability, not a new live workflow execution or device acceptance.

Pending model-selection, opt-in runtime redaction and research edits remain separate. Remaining development includes deep nested saved-record validation, real-agent author/run/cancel/restart journeys and supported writing/actions, privacy inventory and redaction integration, Scan correction/searchable PDF, browser-family media qualification, and provider/native/device/user acceptance. Android builds remain skipped at the user's direction; the goal remains active.


## October 2 — Real workflow list controls

Live browser inspection found on/off controls attached to status/loading, removed-history navigation and workflow rows whose click merely opened a review. The real-agent list now shows Active/Paused/Removed status text only for actual workflows; status and navigation cards no longer imply an activation state. Detail-view activation and its review remain in place. Mock and development lists retain their functional local switches.

The real-renderer regression fails before repair and passes afterward. **23/23 targeted browser checks** passed across execution context, approved workflow navigation, mock authoring/scope and the local executor; **88/88 repository tests**, TypeScript and production web build passed. The actual local-agent list was reloaded and visually inspected with its retained paused draft and no false switches. Evidence and source hashes are in `test-results/workflow-list-review/`.

A stale live transformed module initially hid the change. Updating the copied source files' modification times refreshed the server and browser; the existing source-edit/reload regression passed separately (**1/1**). No reload-plugin defect or repair is claimed. Pending model selection, redaction and research changes remain outside this checkpoint, and the overall remaining-gap ledger remains open. No Android build or live workflow execution ran.


## October 2 — Host model selection

The pending shared model default is integrated across the development, local app-host, voice, reviewed-workflow and combined launchers. Review found a configuration mismatch: an existing profile could retain one model while the child environment received the new default/override. The host launchers now derive both small/large environment values from saved direct Cerebras routing. New profiles use the shared selection consistently. Malformed model IDs and explicit overrides conflicting with saved routing fail before spawning a runtime; existing profile bytes are preserved. The standalone development-backend wrapper preserves the more specific ALPHA_DEV_MODEL selection.

Three regression cases execute the real local app-host launcher with a temporary Git source/profile, synthetic key and recording child process. They verify new-profile selection, distinct saved small/large models without rewriting the profile, and refusal of malformed/conflicting overrides before any child starts. The uncorrected pending launchers fail the regression; the final snapshot passes **91/91 repository tests**, TypeScript, production web build and launcher syntax checks. Evidence/source manifests are in `test-results/model-selection-review/`. No model-provider call, Android build or new device acceptance is claimed. Historical provider discovery evidence in the agent integration document is not replaced by current defaults.

Remaining work includes the concurrent generative local-workflow and redaction changes, full real-agent/provider execution journeys, deep saved-state validation, Scan correction/searchable PDF, browser media qualification, research review and native/device/user acceptance. The full goal remains active.


## October 2 — Workflow Notes and notification actions

Development workflows can read the durable Notes store and save an explicit Note step using the normal persistence path. Step IDs bind receipts to exact content: replay returns the same saved note, changed content under the same ID is rejected, failed saves do not record a completed step, and a newer Notes revision is preserved. This stores supplied prior-step output; generative summaries still require the separate connected-agent implementation.

Notify steps retain their exact text and operation identity in a browser notification journal. Notices appear in the normal shade, open Workflows, and retain opened/dismissed state across reload and matching replay. Locked/background views redact content and refuse actions; disabled delivery refuses both open and dismiss. These are browser-local notifications, not evidence of physical Android/background delivery.

A targeted regression reproduced cancellation after notification preparation but before the actual storage write. The shared browser store accepts an optional cancellation signal, checks it before work and immediately before commit, and passes it to the Web Lock request so queued cancellation settles without waiting for the lock holder. Existing callers keep their prior behavior. The failing pre-repair result saved a notice after cancellation; the repaired test leaves storage untouched.

The corrected affected subset passed **42/42 browser checks** across workflow execution, notifications/queue behavior and Notes save recovery. The first broader run passed 39 checks and failed one new UI test because it expected an external-notification combined label for an own notification; the assertion now follows the real separate title/body markup. **91/91 repository tests**, TypeScript and production web build passed. Evidence, original failures and source manifests are in `test-results/workflow-actions-review/`. The four additional concurrently supplied notification cases also passed (**4/4**), covering retained/opened replay, queued cancellation, shade Clear all and failed persistence.

The notification journal is bounded at 200 retained receipts and currently has no archive/export UI; it refuses additional publication at capacity. Deep saved-record validation, generative workflow steps, real-agent/provider acceptance, redaction integration, Scan correction/searchable PDF and native/device/user acceptance remain open. Concurrent runtime and research changes remain outside this checkpoint. Android builds remain skipped; the full MVP goal remains active.


## October 2 — Workflow speech

The development Read it aloud step uses the browser's local voice path and waits for its own utterance completion before executing later steps. Playback now has an explicit stopped event and an utterance identity; cancellation, device retirement, playback errors or replacement fail/cancel the old step. Cleanup cannot stop another consumer's replacement utterance. Cancellation while local voices are loading prevents late playback, and the browser voice selection continues to exclude remote-only voices. The helper has a bounded completion deadline and removes its event listeners on exit.

The frozen snapshot passed **36/36 browser checks** across local workflow execution, workflow speech and voicemail playback. Six speech-specific cases verify completion ordering, cancel/error/retirement, replacement ownership and cancellation during voice loading. The first campaign passed 35 checks and had a setup timeout in an existing notification workflow case: its page returned to Home while waiting for the row. The same frozen suite passed on rerun; the initial failure log is retained and no specific root cause is claimed. **91/91 repository tests**, TypeScript and web build passed. The playback unit expectation now explicitly verifies the old utterance's stopped event and the replacement's ended event. Evidence/source hashes are in `test-results/workflow-speech-review/`. Browser speech-engine fixtures establish event/lifecycle behavior, not physical audio quality or hardware acceptance.

Review of the separate pending egress patch found an unsafe exception: an object created with AbortSignal.prototype bypasses the swap walker, preserving a raw synthetic identifier in serialized output. The targeted source-level probe is retained in `test-results/redaction-boundary-review/`; it is not evidence of an actual provider transmission. That patch and automatic redaction enablement remain uncommitted until repaired and independently verified. The newer pickup-triggered workflow changes are also outside this snapshot. Other gaps in the ledger remain open, and no Android build ran.


## October 2 — Redaction control-object boundary

The pending egress patch fixes an actual integration failure: the secret/PII data walkers normalized request AbortSignal objects into plain records, breaking cancellation-aware model calls. It also lets the two opt-in swap master switches fall back to host environment settings when no explicit runtime setting exists. Explicit runtime settings retain precedence. This patch is now part of the composed source preparation for both local host and Android packaging; enabling it in launchers is a separate step.

Review reproduced four failures in the original proposed exception: forged AbortSignal prototypes bypassed secret and PII swapping, a proxy's prototype trap executed, and a genuine signal carrying added text bypassed swapping. The corrected helper uses Node/Bun's non-executing proxy detection, admits only the native signal prototype with no own string properties or accessors, and checks its native aborted getter. All other objects remain inside the bounded descriptor-only data walkers. Clean controller/combined signals retain identity and cancellation behavior. Decorated signals are treated as data instead of becoming a redaction bypass.

The original candidate passed seven runtime cases but failed the four new regressions. The final isolated core passed **14/14 tests**, including real AgentRuntime dispatch with a recording provider handler, environment/setting precedence, substitution/restoration, cancellation propagation and proxy/accessor non-execution. A separate **Bun** check confirms both walkers preserve clean cancellation and redact forged/decorated inputs without executing proxy traps. The helper passed strict standalone TypeScript checking. The full patch series reproduced in a fresh source directory; its entire core source tree matched the tested copy byte for byte. Patch and all five output hashes are recorded in the consumer manifest. Evidence is in `test-results/redaction-boundary-review/`.

The final product snapshot passed **91/91 repository tests**, TypeScript and production web build. No real model-provider payload, deployed/browser-agent enablement, APK, physical Android execution or complete PII coverage is claimed. Automatic native enablement and development-backend opt-in edits remain outside this checkpoint. Remaining work includes qualifying enabled host/device configuration, reply/action restoration and cancellation through the actual app, updating Privacy from measured capabilities, and the other open MVP gaps. The goal remains active.


## Guarded host redaction qualification (October 2)

Setting both upstream switches `ELIZA_SECRET_SWAP_ENABLED=true` and `ELIZA_PII_SWAP_ENABLED=true` now opts the browser host launcher into both swap layers only after full composed-source verification. Invalid or partial selections and unqualified source fail before profile creation or child launch. The default remains off; process metadata records the requested mode, not a coverage claim.

Fresh pinned dependency installation and source re-verification succeeded. The isolated real host authenticated through the production Vite bridge and completed chat, but the synthetic email drafting probe returned a `__ELIZA_SECRET_…__` placeholder. A repeat request was also refused as a credential. This is a failed restoration acceptance check: the assistant reply boundary restores PII surrogates but does not restore secret-swap placeholders. Do not enable both layers in the user-facing session until safe reply restoration is implemented and tested, including protection against restoring actual provider credentials. Device enablement remains unqualified and was not included in this checkpoint.

Validation: five launcher tests pass, and product verification passes (93 tests, TypeScript and browser bundle). Evidence is in `test-results/redaction-boundary-review/launcher-verify.log`, `launcher-tests.log`, `install.log`, and `live-bridge.json`. No Android build or provider-wire capture was performed. The earlier pairing probe was unsuitable for this host's machine-session path; the production bridge was used for the decisive result.


## Personal-data reply restoration repair (October 2)

The new `egress-user-reply-restoration.patch` restores personal data captured by the secret detector at both the final assistant reply boundary and the visible stream boundary. Model-facing stream text remains substituted. Configured credentials, detected credential classes, overlapping credential values, and unresolved current-session placeholders remain redacted. Tool-parameter restoration remains separate. Secret classification takes precedence even when the same value was first recognized as contact data.

Evidence: 22 focused tests pass, including prior cancellation-control tests, session isolation, credential precedence and streamed placeholder splits. Fresh full-series preparation, pinned installation and source re-verification pass for `redaction-qualified-source-v4`. Product verification passes all 93 tests, TypeScript and the web bundle. The live production Vite bridge plus actual host/provider restored the synthetic email in streaming progress and terminal output. A buffered controlled prompt explicitly preserving opaque contact placeholders also restored correctly and persisted a two-message conversation.

Remaining: the ordinary buffered drafting probe had the model output `[secret omitted]` instead of retaining the contact placeholder. The patch cannot restore text the model discarded; contact-versus-credential placeholder semantics need further work before default enablement. The detection grammar is also not comprehensive: the initial lowercase unquoted `password=value` regression was outside the existing detector grammar; the precedence test uses its supported JSON credential form. Keep both swap layers off in the main development session pending broader model/action/restart qualification. Android enablement and physical-device acceptance remain unverified; no Android build was run.

Evidence: `test-results/redaction-boundary-review/reply-stream-tests.log`, `reply-product-verify.log`, `reply-prepare-v4.log`, `live-bridge-after-restoration.json` (ordinary buffered failure), `live-buffered-controlled-restoration.json` (controlled buffered pass), and `live-stream-after-restoration.json` (streamed pass). These are host/provider observations, not a capture of provider-bound traffic or proof of every PII category.


## Browser workflow input and continuation review (October 2)

Reviewed and delivered the pending browser-development workflow inputs: today/tomorrow/three-day/Monday-week Calendar ranges with civil all-day boundaries and DST handling; active meeting conditions; unread Messages reads and sender filtering; reply-to-sender with source validation and recipient-bound receipts; managed Files content/metadata reads; explicit supplied development results for unconstrained Write instructions; and foreground/unlocked pickup-gated speech. Writing via the dialog is labeled development input and logged as a supplied result, not model generation. Local Messages/Inbox sends do not contact an external service.

Files retain import/change timestamps where available and preserve unknown dates on legacy records. Recent input explicitly means the latest twenty managed files. Text decoding is bounded and strict; binary/oversized content is reported as metadata. Cancellation and revision checks reject late/stale reads. Review reproduced two defects: unread counts exceeding actual incoming rows silently returned incomplete input, and an all-files source growing beyond 2,000 during a read could pass its final revision check. Both now fail with a recovery/narrow-source message before reporting a complete input. The original negative controls fail twice; both repairs pass in the final campaign.

Validation: the initial frozen campaign passed 72 browser cases. The final expanded campaign passes 99 cases covering workflows, Files, Messages lifecycle, voicemail and notifications, plus one additional actual Power/Unlock pickup case. Its first attempt wrongly expected Power to switch directly from home to off; the corrected test follows the existing home→lock→off sequence and passes with no product relaxation. Product verification passes all 93 tests, TypeScript and the web build. The supplied-result dialog screenshot was visually inspected. Inputs, negative controls, terminal logs and final hashes are recorded under `test-results/workflow-inputs-review/`. A later independently added Messages swipe regression was preserved outside this checkpoint.

These are browser-development local execution checks. Real model-generated writing, autonomous trigger scheduling, external messaging, Android motion detection, hardware speech and complete resident-worker acceptance remain separate gaps. This checkpoint does not run Android builds or claim physical-device acceptance.


## Swipe continuation and Maps sharing review (October 2)

Fixed a reproduced Messages interaction defect: the 350ms guard suppressing a swipe's synthetic click also suppressed a separate deliberate tap. A new in-content pointer gesture now clears the old guard while the swipe's own completion still installs it. The regression fails on the previous source, then passes with the fix. Eighteen focused Messages/Inbox/Calendar browser cases and repository verification pass.

Maps place and ready-route sharing now use an explicit selection snapshot. Place payloads include exact coordinates and an OpenStreetMap link; routes include their actual origin/destination, mode, distance/duration, instructions, traffic disclosure and attribution. The flow uses the browser share API when available, then clipboard on non-cancellation failure, with selectable/downloadable exact text when neither succeeds. Cancellation does not silently switch transport; leaving, hiding, retiring or changing the selected route retires pending fallback work. Download URLs are revoked on dismissal. The fallback dialog was visually inspected. These tests use recording browser APIs and a disclosed route provider fixture; they do not prove Android OS share-sheet delivery or live provider coverage.

Sixteen Maps browser cases pass. After rebasing onto the concurrent reminder-deletion delivery, the combined source passes all 93 repository tests, TypeScript and the browser bundle, plus 34 browser cases covering Maps, Messages and reminder-deletion recovery. Evidence: `test-results/swipe-tap-review/` and `test-results/maps-sharing-review/`, including the negative regression, merged terminal logs, input/final hashes and rendered fallback screenshot. No Android build, external message, provider credential change or production Maps coverage claim is included.


## Workflow run-history recovery (October 2)

The development workflow journal previously stopped at its capacity limit with instructions to export/remove history but no corresponding control. Workflow detail now exposes **Workflow history**, with an exact JSON snapshot download and a two-step reviewed removal of finished run logs/outputs. Workflow definitions, running/interrupted/unknown-status records and independent destination receipts remain intact. Any running workflow disables cleanup; changed state requires a fresh review. Writes use the existing origin-wide simulator writer lease and persisted-snapshot comparison, so stale tabs and storage failures cannot overwrite newer history. This manages browser-development history only, not the host agent database.

Six new browser cases verify exact downloaded bytes, confirmation, reload persistence, receipt preservation, stale storage, failed writes, active-run blocking, download cleanup, and recovery from a genuinely full journal followed by a successful new run. The first cleanup check exposed delayed object-URL revocation after closing; changing the test wait alone did not fix it. Explicit Close/Back/Escape/retirement now synchronously release the dialog, listeners and download URL, with idempotent handling of the later close event. The final campaign passes all 40 history/executor/result cases. Repository verification passes 93 tests, TypeScript and the web bundle. The history dialog was visually inspected. Evidence and exact input/final hashes: `test-results/workflow-history-review/`.

The separate 200-entry workflow-notification receipt limit still needs an archive/recovery design that preserves idempotency. This change does not delete those receipts, implement model writing/autonomous scheduling, or establish Android acceptance. Android builds remain skipped.


## Foreground Maps voice guidance (October 2)

Maps now speaks the current validated route instruction through local speech playback, with mute/enable and explicit retry after a speech failure. A single shared helper scopes cancellation and cleanup to its own playback/request so an old Maps or workflow operation cannot stop a newer consumer. Guidance retires on departure, backgrounding, provider changes, inaccurate/off-route fixes and arrival; delayed voice availability and retired location callbacks cannot restart it. This remains foreground guidance using local platform voices, not background navigation.

Review reproduced a false off-route defect: the previous calculation measured only route vertices and rejected a fix midway along a straight segment. The calculation now measures bounded great-circle segments, including duplicate-point and date-line cases. The original midpoint regression fails before the repair. Twenty-four Maps/geometry/share browser cases and fifteen workflow speech cases pass. Repository verification passes all 93 tests, TypeScript and the web build. Logs and frozen input/final hashes are under `test-results/maps-voice-review/`. Browser speech and location are recording fixtures; this does not establish Android hardware speech, live routing accuracy or physical-device navigation acceptance. Android builds remain skipped.


## Regional Maps development launcher (October 2)

Added `npm run dev:maps` to supervise the prepared regional router, gateway and browser app, with explicit data/Java/Python/port checks, child ownership, failure cleanup and readiness checks for all three services. Data preparation remains a separate explicit operation. This standalone Maps command does not start another local agent; the existing local-agent browser session on port 5317 remains healthy.

A real prepared Monaco launch on isolated port 5389 returned 24 Casino search results and a 337.045m walking route with 13 instructions; the browser rendered the search results and its screenshot was inspected. A second invocation refused occupied ports while the original gateway stayed healthy. SIGINT exited 130 and released all owned ports. Invalid/reserved ports and missing data fail preflight. An isolated disappearing-Python fixture exercised spawn failure and router cleanup. The initial hypothesis that the existing exit listener mishandled spawn failure was disproved: both variants returned failure correctly, so that unnecessary change was removed. Vite readiness is now verified before printing the success URL. Repository verification passes 93 tests, TypeScript and the web build. Evidence: `test-results/maps-launcher-review/`. This proves prepared regional development startup/search/routing, not global coverage, Android builds, background navigation or physical-device acceptance.


## Browser reading sources and speech ownership (October 2)

Read aloud can now prefill a review with bounded public page text when CORS permits access. Requests omit credentials and referrers, reject redirects and unsupported content, enforce a 256KiB streamed byte limit and strict UTF-8, and stop after five seconds. HTML is parsed inertly, without executing scripts or loading embedded resources; article/main text excludes hidden/non-content elements. Review is limited to 5,000 characters with explicit truncation disclosure. The user can edit or paste and must confirm before local speech. Blocked, oversized or unreadable sources retain manual paste; late fetches cannot overwrite edits or reopen closed reviews. This is public source extraction, not authenticated-page access or an exact extraction of the isolated rendered frame.

Review reproduced two independent ownership defects: closing a replaced page-reading session, or leaving replaced development voicemail, stopped another consumer's audio. Both negative controls fail on the old implementations. Reading and voicemail now share scoped playback cancellation with Maps/workflows, including loading, stop/retry, completion, failure and retirement. Voicemail continues to read disclosed local transcripts rather than claiming a real recording.

The final combined reading/source/Maps/workflow campaign passes 44 browser cases; the voicemail repair passes another 15 voicemail/reading cases (six overlap). The earlier combined campaign retained two Maps setup timeouts before speech assertions while verification ran concurrently; the sequential campaign passes without relaxed assertions. Stream limits, malformed UTF-8, actual no-CORS server rejection, timeout fallback and cross-consumer ownership are explicitly checked. The compact dark reading dialog was visually inspected. Final repository verification passes all 93 tests, TypeScript and the web bundle. Inputs, negative controls, terminal logs and final hashes are under `test-results/reading-source-review/`. These are browser-platform and recording-fixture checks, not hardware speech or Android acceptance; Android builds remain skipped.


## Browser video encoder fallback and trim preservation (October 2)

Video copy export now tries supported explicit encoders and retains the browser default as a final choice when support probing, allocation or startup fails. Returned media uses the actual encoder/container type. Failure and cancellation clear the deadline, stop output tracks and release the audio context; no microphone is requested during export.

Review reproduced a trim regression in the pending implementation: starting recording only after playback acknowledgement discarded the opening audio. A controlled 400ms acknowledgement delay reduced a selected 0.8-second clip to 0.36 seconds of decoded audio. Recording now starts before playback; the same regression passes its decoded-duration bounds. This retains encoder fallback without losing the selected opening.

Fourteen video-edit browser cases pass, including real encode/decode, non-silent audio, dimensions, original-byte preservation, idempotent receipts, cancellation, stale sources, failed storage, reload recovery and all three fallback paths. Sixteen surrounding camera/video/import cases also pass. The rendered Photos editor was separately exercised and visually inspected. Repository verification passes all 93 tests, TypeScript and the web build. Evidence, the negative control, input/final hashes and screenshot are under `test-results/video-codec-review/`. These use synthetic media sources with actual Chromium codecs and IndexedDB, not device codec/microphone acceptance. Android builds remain skipped.


## Dated workflow inputs and durable note dates (October 2)

Added browser-development reads for today's Notes, overnight Inbox, overnight Inbox with today's Calendar, and daily/weekly Calendar–Notes–sent-mail combinations. Today uses local civil midnight boundaries; weeks begin Monday. Overnight explicitly spans the previous day at 18:00 through the current day at 09:00, capped at the current time. Notes use actual modification/creation timestamps; received and sent mail use recorded timestamps, with legacy timestamp-valued sent keys accepted. Unknown dates are excluded and counted as undated, not guessed from display labels. New browser notes/mail and real content edits retain durable timestamps; pinning a legacy note does not invent its creation date.

Review reproduced two defects and retained negative controls. An approved unchanged Notes update stamped an old record as modified today; it now preserves the original date and exact revision. Overnight reads included soft-deleted mail; both standalone and combined reads now exclude deleted and archived records. Actual changed note content still advances the timestamp included in the returned revision.

The expanded campaign passes 65 workflow/Calendar/Messages/Inbox/Notes browser cases. After integrating concurrent mock-admission changes and correcting a TypeScript annotation, another 16 date/mock-admission cases pass. Final repository verification passes all 93 tests, TypeScript and the web build. Evidence and input/final hashes: `test-results/workflow-dates-review/`. The local-agent bridge on port 5317 remains HTTP 200. Newer edits to two root simulator files were preserved outside the tested checkpoint. These reads operate on browser-local development records; they do not establish external mail access, autonomous scheduling, model-generated summaries or physical-device acceptance. Android builds remain skipped.


## Reviewed local receipt workflows (October 2)

Browser-development receipt steps now ask the user to choose a local Inbox attachment and, for an expense entry, supply its merchant, USD amount and development Wallet card. The attachment is validated again before each destination effect. Files stores exact bytes in a Receipts folder and commits the file and operation receipt in the same IndexedDB transaction; matching replay never duplicates or recreates a deleted file, and conflicting replay fails. Wallet retains a separate exact receipt and local expense record, not a payment. Journal context stores source identity/checksum rather than attachment bytes. Completed steps remain visible if a later destination fails. Receipt dates age by local civil days, while existing fixture dates remain unchanged.

Two negative controls reproduced defects: caller mutation during checksum calculation could save different bytes under the original checksum, and deleted mail could still supply a receipt. Save inputs and selected attachment data are now snapshots; deleted sources are excluded from selection and revalidation. The database upgrade preserves existing files, fails with an actionable message while another tab blocks it, and can retry after that owner closes.

The final integrated campaign passes 44 receipt/Files/executor browser cases, including concurrency, exact replay, deletion tombstones, duplicate names, rollback, cancellation, stale sources, storage failure and reload. The first journey failure was a test navigation error: Wallet overview requires opening the selected card before inspecting its transactions; that was corrected without weakening data assertions. Separate New York DST and compact dark-layout checks pass; both review controls are reachable by scrolling, and the rendered dialog was inspected. Repository verification passes all 93 tests, TypeScript and the web build. Evidence: `test-results/workflow-receipts-review/`. A newer root workflow edit is preserved outside this tested checkpoint. This remains explicitly supplied local receipt handling, not automatic receipt extraction, an autonomous email trigger, live banking or physical-device acceptance. Android builds remain skipped.


## Development location and Home conditions (October 2)

Device controls now supports browser location or explicitly supplied development coordinates/accuracy, a saved Maps Home place and its radius. Normal browser mode ignores development coordinates. Coordinate mode supplies foreground fixes without requesting host geolocation; sensor-off/background retirement stops its watch. The local workflow condition “I'm not at home” compares a fresh fix with the saved Home radius, rejects an accuracy interval overlapping the boundary, and rejects Home/radius changes during the check before continuing later actions.

Review found and reproduced a cancellation leak hidden by an earlier test name: a granted permission waiting for a fix was covered, but a pending permission request retained its temporary browser watch after cancellation. Browser permission acquisition now has an opaque request ID and scoped cancellation from the location session. Cancelling one request leaves another owner active. Native platform permission acquisition retains its existing API path; no Android permission-sheet cancellation claim is made.

The first location/Maps campaign retained two setup timeouts caused by an additional page navigation before condition assertions; the next 25-case campaign passed without relaxed assertions. The final campaign passes 27 cases, including the failing-before/fixed-after permission regression, request isolation, stale Home, near/away/uncertain outcomes, background/sensor retirement, persistence and Maps voice regression. Repository verification passes all 93 tests, TypeScript and the web bundle. The location editor was visually inspected. Inputs, logs, negative control and screenshot: `test-results/workflow-location-review/`. A newer root workflow edit remains preserved outside this checkpoint. These are foreground browser/development-coordinate checks, not physical GPS, autonomous geofencing or Android acceptance. Android builds remain skipped.


## Connected-agent workflow writing (October 2)

Foreground development workflows now send generic Write instructions and the preceding step's exact input to the connected agent. Returned text becomes the next step input. Offline mode retains the explicit supplied-result dialog. Empty, oversized and action-proposal responses fail instead of becoming a result; proposals are not admitted for client approval. Cancellation owns only its generation request, and navigation, workflow edits and external storage changes prevent stale results from advancing destination effects. This text-only client contract does not establish that every upstream server tool is disabled.

A real host-local resident-agent probe, using the configured hosted model provider, generated a synthetic marker and saved exactly that returned text to browser Notes. This proves the browser-to-local-runtime path; it is not offline model inference or Android acceptance. The rendered journey exposed a long-instruction overflow (right edge 5970px in a 412px viewport). The workflow card now wraps long content and its failing-before/fixed-after layout regression passes.

The initial agent/offline campaign passed 21 cases. After the layout correction, 21 of 22 passed; the remaining case failed during setup because an additional navigation detached its Run button. That unchanged case subsequently passed three repetitions. The navigation instability remains unresolved and its failed log is retained. Repository verification passes 93 tests, TypeScript and the web bundle. Evidence, live probe, negative layout control and hashes are in `test-results/workflow-agent-review/`. This closes foreground generation plumbing, not autonomous scheduling, every model/tool integration or physical-device acceptance. Android builds remain skipped.

After integrating the concurrent Clock handoff checkpoint, all 37 combined workflow/Clock browser cases and repository verification (96 tests, TypeScript and web bundle) pass. This additional passing campaign does not erase the earlier intermittent navigation failure.


## Workflow notification history recovery (October 2)

Workflow history now exports the exact saved notification document and offers a confirmed action to free notification space. Opened/dismissed notices become compact SHA-256 receipts; active notices retain their text. The receipt and active rows change in one Web Locks serialized storage write. Matching replay remains dismissed/opened, conflicting text is rejected, and stale snapshots, backgrounding, cancellation or storage failures cannot partially archive records. Saved records are validated before use; malformed documents remain downloadable without being overwritten. History is reachable from the development workflow list even with no saved workflows.

The 200 retained-text-row ceiling is now recoverable by reviewing/dismissing and compacting notices. Compact receipts deliberately remain in browser storage to preserve idempotency and therefore still consume the browser's finite storage quota. Export preserves text before removal; compaction does not promise unlimited storage or restore deleted text.

Review reproduced a Unicode comparison defect in the first compact-receipt implementation: raw UTF-8 encoding collapsed different lone surrogate characters. Digests now hash JSON-encoded strings, preserving exact JavaScript text distinctions. The negative control is retained. The first campaign also exposed test navigation and ambiguous status selectors after adding notification history; selectors now name the corresponding status area without relaxing assertions. Final integrated coverage passes 43 browser cases, plus a separate cancellation-during-hashing case. Repository verification passes 96 tests, TypeScript and the web bundle. The rendered dialog was visually inspected. Evidence, hashes and screenshot are in `test-results/notice-history-review/`. Android builds remain skipped; external-provider, autonomous workflow and device/user gates remain open.


## Urgency-gated workflow notifications (October 2)

The foreground development step “A notification, only if urgent” now evaluates its actual input through the connected agent, requiring exactly an urgent boolean and a bounded nonempty reason. Malformed results fail before notification publication. Offline mode asks for explicit development review. The decision and its source are persisted before any notification effect; a non-urgent decision omits the notice and continues later steps. Cancellation, lifecycle retirement and changed workflow/storage state prevent late publication.

Two actual host-local resident-agent journeys passed with the configured hosted model: a synthetic ongoing service outage produced one exact-input notification, while a routine healthy-services report containing “urgent” only as a category label produced none. These are bounded semantic examples and local orchestration evidence, not comprehensive model quality, offline inference or Android acceptance. Rendered results were inspected.

The first snapshot accidentally included an in-progress trigger integration without its dependencies; that run was stopped and its log retained. The final independently frozen urgency checkpoint passes 32 browser cases, including offline/connected decisions, invalid JSON, failed decision persistence, stale storage and Back/Home/background/incoming-call/Escape cancellation. Repository verification passes 96 tests, TypeScript and the web bundle. Evidence and source hashes are in `test-results/workflow-urgency-review/`. Concurrent trigger work remains outside this checkpoint.

Hosted browser shard 3 for the preceding agent checkpoint completed with 247 passing cases and two failures: Scheduled digests displayed a verified-connection status while offline, and the stale-session proposal-recovery fixture lost its pending promise. Its log is retained as `ci-shard3.log`; these failures remain open and no full hosted pass is claimed. Android builds remain skipped locally.


## Browser plugin bootstrap and hosted-CI follow-up (October 2)

Hosted CI exposed a bootstrap regression: the mock-admission import ran before browser plugin registration, so runtime modules claimed Capacitor plugin identities without their browser implementations. Normal Scheduled digests displayed a spurious verified-connection warning and DeviceApps was unavailable. The digest failure reproduced locally before the repair. Browser implementation registration now runs before runtime imports, preserving the first-registration contract without suppressing errors or changing the feature assertions.

All 60 distinct affected browser cases pass: MVP views, device controls, notification launch identities, hosted-result journeys/receipts, proposal recovery and mock-admission barriers. The two original shard-3 cases also passed ten repetitions each. The stale-session proposal promise failure has not reproduced (11 passing post-change executions), so its original cause remains unconfirmed. The earlier hosted-result journey timeout and device-controls failure are retained in the downloaded shard-2 log; passing local runs do not establish a full hosted pass. Repository verification passes 96 tests, TypeScript and the web bundle. Logs and source hashes: `test-results/hosted-browser-fixes/`.

The browser workflow now carries the existing reviewed three-shard configuration from the resident qualification branch, with separate artifacts and fail-fast disabled. This partitions the entire suite instead of allowing one job to exceed its 20-minute ceiling; no tests are excluded. New exact-head hosted results are still required. Android builds remain skipped locally.


## Durable foreground workflow triggers (October 2)

Browser development now detects enabled civil-time schedules, incoming messages/email, Calendar event boundaries and saved Home/Work transitions. First observation and changed definitions/places establish a baseline. Seen occurrences and queued jobs are persisted before execution; claiming a job and recording run intent share the simulator writer's single persisted document. Reload retains queued work, and a second tab cannot claim it through a different writer. Interactive steps wait until their workflow is open. Local incoming-message/email controls provide durable source records for browser development.

Trigger jobs bind their source identity and content hash. Reads/replies retain the triggering sender or mail, scheduled dated reads use the occurrence time, and edited sources fail before use. Three failing-before/fixed-after checks are retained: deleted mail no longer generates a trigger; triggered receipt review now excludes unrelated and sent-mail attachments; consecutive synchronous app writes merge from the latest persisted snapshot so a later write cannot erase the earlier incoming record. Source snapshots also capture incoming storage revisions before asynchronous collection.

The initial browser campaign had two assertions against a nonexistent run.input field; they now inspect the actual saved Notes body. Final integrated coverage passes 87 browser cases spanning triggers, reload, queued review, disabling, location, urgency, source changes, cross-tab ownership, receipts and failure/cancellation behavior. Eleven pure detector cases cover civil schedules/DST, bounded catch-up, Calendar edges, location uncertainty, identity/capacity rejection and deleted mail. An additional storage-failure probe passed without a product change. Incoming controls were visually inspected. Evidence, negative controls and hashes: `test-results/workflow-trigger-review/`.

After rebasing onto the concurrent Clock-readiness checkpoint, repository verification exposed a stale fake-device fixture. It now supplies the required bound-user keyguard fields and intercepted Clock terminal results while asserting that real-alarm flags remain absent. Final verification passes 114 tests, TypeScript and the web bundle; earlier failures remain logged. These are browser foreground triggers with persistent queues and local development effects. They do not prove closed-browser execution, Android background services, live mail/SMS, offline inference, or device/user acceptance. Queue/event history remains bounded and its capacity errors need user recovery; the broader goal remains active. No Android build or emulator run was performed.


## Incoming development attachments (October 2)

Incoming email controls now accept reviewed local attachments, retaining their exact bytes and checksums through Inbox, the attachment viewer, triggered Files storage and the local Wallet receipt journey. Selection is atomic: invalid replacements preserve the previous selection, failed delivery retains the draft for retry, and newer selection or lifecycle retirement rejects late reads. Up to five files/5 MiB may be selected, subject to attachment validation and the existing browser-store quota when delivered. This is a local development inbox, not real email delivery or live banking.

Review reproduced and fixed a stale progress message: removing an existing attachment during a pending replacement cancelled that replacement but left “Reading attachments” displayed. Removal now reports the remaining selection. The failing control is retained. Compact dark layout was inspected using the maximum valid 120-character filename; the first layout fixture exceeded that existing name limit and was corrected without changing validation.

Initial combined campaigns retained setup failures caused by extra page navigation. Failure-only CDP document-navigation and Vite reload diagnostics were added, without relaxing assertions. The final ten attachment cases pass three repetitions (30 runs). Surrounding trigger/receipt checks and all 32 concurrent reminder-review cases passed across the integrated campaigns; the extra-navigation cause remains unresolved. Repository verification passes 114 tests, TypeScript and the web bundle. Evidence, screenshots, input copies and final hashes: `test-results/incoming-attachment-review/`. Android builds remain skipped.

Separately, all three hosted browser shards completed successfully for the earlier plugin-bootstrap SHA `8e6359f3c7cc53c3adbcf642d102df7865d50c4f`: https://github.com/AlphaCompute/alphaphone/actions/runs/37055252131 . Its exact-head result is retained in `hosted-plugin-checkpoint.json`. This closes that checkpoint's full browser CI gate, not the newer trigger/attachment checkpoints or Android/device acceptance.

## Automatic foreground generation and speech (October 2)

Enabled connected text generation and urgency checks for queued browser workflows while Home or another ordinary view is open. Automatic requests use a workflow-only context without the current screen selection, wait behind an active chat, and own their cancellation signal. Ordinary navigation does not cancel them; sensitive screens, lock/background, disconnect and explicit run cancellation invalidate the request. Manual generation retains its view-bound cancellation. Offline model steps still require their explicit result review. This is foreground development automation, not closed-browser or Android background scheduling.

Supported automatic speech can wait for pickup and for an occupied speaker without stopping another consumer. Playback completion gates subsequent effects; cancellation, replacement, lock and reload preserve the existing interruption boundaries. Review reproduced a missing-recording failure that left playback marked busy and blocked queued speech. Failed playback now clears its own state only while it still owns the playback generation, preserving a later replacement. The failing regression is retained in `test-results/automatic-workflow-review/speaker-negative.log`.

Validation: 79 workflow cases and 20 shared audio/Maps cases passed on the frozen candidate, covering exact generated Notes output, workflow-only context, chat contention, late results, lifecycle cancellation, trigger identity, offline review, pickup, speech ownership and failure recovery. The first 17-case campaign passed; an accidental overlapping diagnostic launch exited because its port was already occupied and was rerun after the campaign ended. Automatic model behavior in these new tests uses an injected transport; this checkpoint does not add real-provider automatic-generation or physical-speaker acceptance. The live development local-agent bridge returned HTTP 200 on port 5317. Android builds remain skipped.

Repository verification passed all 114 tests, TypeScript and the production web build. Logs and frozen-source hashes are retained under `test-results/automatic-workflow-review/`. Hosted checks for this new checkpoint remain pending; prior full hosted-browser success at `8e6359f` is not evidence for these newer changes.

## Independent foreground workflow progress and CI regression repair (October 2)

A workflow waiting for pickup no longer blocks every other queued workflow. Dispatch excludes only an already-running instance of the same definition's flow; later occurrences of that flow remain queued. Shared Notes, model generation and automatic speech operations use cancellable browser locks. Model steps wait for an active request without cancelling it, and automatic speech prepares one utterance at a time so a group of pickup workflows cannot evict each other's prepared speech. Independent work can finish while another workflow waits. This remains browser foreground execution, with existing single-writer ownership and durable per-run receipts.

Six concurrency cases cover pickup plus unrelated progress, simultaneous Notes destinations, same-flow occurrence ordering, two connected generation results, ten pickup consumers, and cancellation while waiting behind a held Notes lock. Together with automatic generation, speech and trigger regressions, 44 browser cases passed. Eight history/Contacts cases passed three repetitions (24 executions). The generation and voice fixtures do not establish live-provider or physical-device behavior.

Hosted browser runs `37056781954` (PR #8) and `37058387118` (PR #9) each failed the same two older assertions: a Contacts save test counted unrelated scheduler persistence, and a run-history export test compared the definition/run export with the entire state including newly persisted trigger cursors. Updated the Contacts injection to its actual store, retaining failed-save/draft/retry assertions and the separate transient-write test. Stabilized the history clock and baseline, compared the documented export fields, and explicitly asserted that cleanup leaves trigger state intact. Failed hosted logs and repeated local evidence are retained in `test-results/workflow-concurrency-review/`; these local corrections do not establish a new hosted pass.

Repository verification passed 114 tests, TypeScript and the web build. Android builds remain skipped. Hosted verification and the broader outstanding acceptance work remain open.

## Browser lock-control visibility consistency (October 2)

Audited notification privacy through actual power, Wake and fingerprint controls. The ordinary power-off path passed unchanged. A separate DOM edge-case regression then inserted a hidden matching lock button before the visible Wake control: the old first-match guard returned workflow text with `canOpen: true` and admitted notice actions. This is evidence for the hidden-control ordering case, not evidence that ordinary power-off already leaked content.

Added a shared browser lock-control visibility check that examines every matching control. Applied it to workflow/ordinary/hosted notification guards, location admission, transcription and workflow review dialogs, Clock foreground admission and hosted-result synchronization. Existing background/visibility/mock and Android branches remain in place. The regression verifies redaction and rejected open/dismiss while powered off, then restoration of the unchanged notice after wake and unlock.

All 105 related browser cases passed: notifications, hosted results, location, Clock, local transcript review, workflow result/urgency/receipt review and the new edge-case regression. Failed and passing controls are retained under `test-results/browser-foreground-review/`. These browser DOM checks do not establish physical Android lock-screen acceptance.

Repository verification passed 114 tests, TypeScript and the web build. Hosted checks for this checkpoint remain pending; Android builds were skipped.

## Calendar-bound browser focus workflow (October 2)

Implemented the development deep-work workflow: an active Calendar block owns a temporary focus policy, incoming Maya messages can appear, other arrivals are retained for the end summary, and the supported end notification contains the supplied/generated summary. Focus policy is separate from manual Do Not Disturb, so cancellation or expiry cannot undo the user's manual setting. Overlapping runs retain their independent ownership and deduplicate the allowed message. Reload retires the old policy and marks its run interrupted rather than replaying a summary. Calendar deletion, workflow edits and disabling release focus. Offline summary input waits until the owner opens the workflow; connected summary generation follows the existing agent path.

Review reproduced and corrected two issues: sent mail was treated as missed incoming activity, and malformed workflow storage propagated exceptions into otherwise independent device-state reads. Outgoing mail is excluded. An unreadable focus policy now cannot own device state, while its source bytes remain available for recovery. The first summary test also used a text-content assertion for a textarea; it now checks the actual input value.

All 84 integrated browser cases passed, including eight focus cases and existing concurrency, trigger, notification, Clock, executor and simulator-recovery cases. Original failures and the final campaign are retained in `test-results/workflow-focus-review/`. This qualifies the local development workflow and reviewed offline summary; it does not establish real incoming provider delivery, physical Android focus enforcement, closed-browser scheduling or live-model focus-summary acceptance.

Repository verification passed 114 tests, TypeScript and the web build. Hosted verification remains pending. Android builds remain skipped.

Before publication, incorporated the newer focus-policy epoch recheck after asynchronous source reads and workflow-definition validation while waiting for summary review. The combined frozen candidate passed **89 browser cases, including 13 focus cases**, with coverage for external notification revocation, connected fixture summary timing, lock redaction, Calendar edits and failed focus-intent persistence. The phone-width summary-review screenshot was inspected; all fields and actions remain within the viewport. The earlier 84-case run remains historical evidence for the initial candidate.

Combined-candidate repository verification also passed all 114 tests, TypeScript and web build.

## Hosted browser follow-up: recovery polling and Calendar test gate (October 2)

PR #11 browser runs split failures across two cases: the pull-request run `37060659132` failed dismissal of saved-app recovery, while push run `37060636037` timed out in delayed Calendar navigation. Other shards passed independently; this was not a single all-green hosted run. Downloaded terminal logs are retained in `test-results/hosted-followup-review/`.

A deterministic regression reproduced recovery reopening after the user dismissed it and foreground polling resumed with an invalid workflow store. The scheduler now checks workflow recovery readiness before polling; explicit recovery remains available and original bytes are preserved. Healthy workflow scheduling is separately exercised. A second controlled regression reproduced the Calendar fixture deadlock by overlapping another list call: each call replaced the sole release callback. The fixture now shares one gate across reads and still requires the delayed open to return cancelled after Home. This is a fixture correction, not evidence of a Calendar application race fix.

Calendar/recovery suites passed five repetitions (50 executions), followed by 33 healthy trigger/focus cases. Both original failing controls are retained. A disk-full test launch was recovered by removing reinstallable node_modules from four inactive review checkouts (`browser-video-review`, `camera-controls-review`, `photo-albums-review`, `clock-sync-review`); source and evidence were retained. The active local-agent source and dependencies were preserved, and its browser bridge subsequently returned HTTP 200. Android builds remain skipped; new hosted verification remains pending.

Repository verification passed all 114 tests, TypeScript and the production web build.

The shared branch then advanced with `deada57` (Calendar/reminder creation and audio-deletion recovery). Rebased this correction onto that commit, retaining its explicit Calendar creation identity in the test. The combined browser run passed **89 cases**, including creation readback, lost-response reconciliation, audio deletion/restoration, native-fence fixtures, trigger/focus scheduling and both CI corrections. This verifies the browser and mocked boundary cases in the combined source; it does not independently qualify the parent's native instrumentation or APK. Earlier repeated runs remain evidence for the pre-rebase candidate.

Combined-source repository verification passed all 114 tests, TypeScript and web build.

## Focus-source reconciliation and notification history minimization (October 2)

Focus now refreshes previously captured incoming messages from their current records and removes archived/deleted incoming mail from the active capture. It checks the Messages/Inbox storage snapshots again after asynchronous notification reads; changed sources are retried instead of committing stale contents. External notifications contribute app/receipt metadata with a generic received marker rather than copying notification title/body into new workflow captures. Collection-policy revocation still removes their captured entries. This does not rewrite historical run records.

Retained failing controls show the previous capture kept stale message/email contents, copied external notification text into run history, and retained a stale message when it changed during a held notification read. The first race fixture attempted to intercept the Capacitor proxy and did not intercept the implementation; it was corrected to instrument the browser implementation before deriving the race evidence.

All 59 integrated browser cases passed, including focus reconciliation/lifecycle, concurrency and newly covered queued-agent contention, trigger dispatch and notification policy. Evidence is in `test-results/focus-reconciliation-review/`. PR #12's terminal browser failure was also inspected: it is the same delayed Calendar fixture timeout corrected in PR #14, not a new lock-control failure. Hosted verification of the current combined changes remains pending; Android builds remain skipped.

Repository verification passed all 114 tests, TypeScript and the web build.


## October 2 — Files byte storage and receipt source matching

New browser Files imports and workflow attachments now store ArrayBuffer bytes in IndexedDB and reconstruct Blob objects for selection, text/PDF reads, downloads and attachments. Older Blob-backed entries remain readable; public file metadata excludes both payload representations. Directory reads finish before the atomic write so a failed or cancelled read leaves no partial folder. Mutation transaction errors now preserve an available underlying storage error.

A WebKit control run against the prior committed Files implementation failed during the binary import. The revised implementation passed **38 Chromium cases and 38 WebKit cases**, covering exact binary bytes across rename/move/reload, cancelled delayed file and directory reads, failed directory reads, PDF rendering, legacy upgrade/retry, receipt rollback, and replay tombstones. The Chromium campaign comprised the existing 34 cases plus four added cases; WebKit ran all 38 together. Historical Blob compatibility is exercised in Chromium; WebKit upgrade fixtures use byte-backed rows because this tested WebKit environment cannot persist the old Blob representation.

Receipt selection now compares normalized source IDs consistently with its existing final source validation, allowing a string workflow-trigger ID to resolve a numeric Inbox ID. A new collision test verifies that adding an equivalent string ID before confirmation is rejected without a Files write. This remains a local Inbox/Files/Wallet development flow, not external mail delivery or a payment.

`npm run verify` passed **114 tests**, TypeScript and the web build. Evidence: `artifacts/calendar-preferences-review/test-results/files-storage-review/` (`browser.log`, `added-browser.log`, `webkit.log`, `webkit-negative.log`, `verify.log`, frozen inputs). Android builds were skipped. Hosted results for this checkpoint are pending; the overall MVP goal remains open.


## October 2 — Focus policy follows workflow step order

The focus executor previously enabled its temporary DND policy when it persisted the run, before executing any step. Removing the DND step still silenced notifications; moving it after an interactive Write silenced them while waiting; an explicit off step did not release the temporary policy. Three retained negative controls reproduce those behaviors.

Focus now owns DND only after the on step persists its policy flag. The off step clears that flag before applying the requested device setting. This preserves step order, cancellation cleanup, independent manual DND and overlapping focus ownership. Historical records with no policy flag cannot silently activate one.

**48 browser cases passed** across focus, foreground triggers and workflow concurrency, including all three new ordering regressions. `npm run verify` passed **114 tests**, TypeScript and the web build. Evidence: `artifacts/calendar-preferences-review/test-results/focus-order-review/`. Android builds skipped; hosted verification pending.

Hosted follow-up remains open: PR #14 push run `37064572768`, shard-2 job `111029042033`, passed 303 cases and failed `dev-notifications.spec.ts` while waiting for “Select Mail (browser.mail)”. The terminal job log is retained in the same evidence directory. Its cause is not yet established; other jobs were still running when inspected. This is not an all-green hosted checkpoint.


## October 2 — Notification settings acknowledge pending writes

Investigation of PR #14's hosted app-choice timeout found that notification settings ignored subsequent clicks while a policy write/refresh was pending, while still rendering those controls as enabled. A deterministic held-write regression reproduces that enabled state. This is consistent with the hosted symptom; the log alone does not prove its exact timing.

Notification policy controls now expose a native disabled state and “Working…” while the operation is pending, then rerender as enabled after success or failure. A handler guard also prevents stale handlers from changing choices during that interval. Other Settings navigation rows remain enabled.

The notification suite passed **30 executions** (10 cases repeated three times), including the previously failing full settings-to-shade journey, delayed policy persistence and failed-write recovery. **25 additional Settings/sensor/MVP navigation cases passed**, covering light/dark and compact/wide layouts. `npm run verify` passed **114 tests**, TypeScript and the web build. Evidence: `artifacts/calendar-preferences-review/test-results/notification-settings-review/` with retained negative control and frozen inputs. Android builds skipped; new hosted verification remains pending.


## October 2 — Full browser qualification and history test budget

The complete committed snapshot `2d6c424f87af4baa151f1714a486009e04ad006a` passed **927/927 browser tests in 17.1 minutes**, with two workers and an isolated renderer on port 5388. Evidence: `artifacts/calendar-preferences-review/test-results/full-browser-2d6c424/`. Live development renderer and authenticated local-agent bridge both returned HTTP 200 during the campaign. The suite uses browser fixtures where documented; it does not establish physical-device or real-provider acceptance.

PR #14 pull run `37064595888` also completed all three browser shards successfully at its exact head `a3b6ff702edf837488d85b4892b6c80a69e00c9e`. Its separate push run had two failures. The notification-choice race was addressed in PR #18. The shard-3 trace shows all 399 notification writes and compaction returning the expected values in 23.7 seconds, followed by a 3.4-second reload; the 30-second overall test deadline expired during final replay evaluation. The full-capacity scenario now has a scoped 60-second budget with every operation and assertion retained. No production behavior or performance target was changed.

All **11 notification-history cases passed** after that adjustment. `npm run verify` passed **114 tests**, TypeScript and the web build. Evidence: `test-results/history-budget-review/` in the review checkout. Android builds skipped. Newer pending source and native/provider/user acceptance remain outside the 927-case checkpoint; the overall MVP goal remains open.

The report/test-budget checkpoint was then rebased onto `54a8229`, which adds browser reading restrictions and password-provider setup. The combined source passed **73 affected browser cases** (reading, provider setup, notifications and history) and all **114 repository tests**, TypeScript and web build. This targeted qualification does not expand the earlier 927-case claim to the newer source. Native/provider fixtures do not establish installed Proton or Android execution. Rebased logs are retained under `test-results/history-budget-review/`.


## October 2 — Timestamp-based video export

Browser video editing now uses pinned Mediabunny 1.61.0 with WebCodecs to encode selected media timestamps independently of playback acknowledgment and audio-clock delays. It trims, rotates and crops locally, retains source audio, and preserves the existing media-element/MediaRecorder fallback when timestamp codec support is unavailable. Blob URLs are owned and revoked by export/review lifecycles. MPL license and source-location notices ship under the public licenses directory.

A known-color/known-tone source verifies only the selected green frames and 880 Hz interval survive a 0.25–0.75 second trim, including decoded output at 0, 0.2 and 0.45 seconds and bounded audio duration. With the timestamp path removed but the revised loading path retained, the control fails because the exported clip has no decoded frame at 0.45 seconds. A separate control against the prior committed source also fails. These logs are retained, not replaced by the passing result.

**37 Chromium browser cases passed** across video edits, source preservation, exact receipt replay, transactional failure, cancellation/reload, codec fallback with audio, Photos edits/albums and camera controls. The boundary case passed again after improving its missing-frame diagnostic. `npm run verify` passed **114 tests**, TypeScript and the web build. Evidence: `artifacts/calendar-preferences-review/test-results/video-timestamp-review/`, including frozen inputs, dependency installation, negative controls and terminal checks.

These synthetic media fixtures exercise real browser codecs and storage, not physical-camera quality or Android encoding. Cross-browser timestamp-codec support and fallback precision remain bounded by the available engines; this campaign does not claim WebKit or device acceptance. Android builds skipped; hosted verification pending.


## October 2 — Browser recording codec and byte persistence

Browser capture now chooses a supported audio encoding from Opus WebM, Opus Ogg and MP4, falling back to the browser default if none is advertised. Newly retained recordings store ArrayBuffer bytes in IndexedDB and reconstruct Blobs for playback. Metadata excludes both payload representations. Transcript edits and deletion/restore preserve the bytes; expiry clears bytes and transcript while retaining the operation receipts that prevent replay. Older Blob recordings remain readable.

**27 Chromium cases passed** across capture, Notes recording/reload/playback, legacy audio, deletion recovery, stale operations and expiry. **Three WebKit cases passed**, including the full rendered Notes record/review/save/reload/play/restore journey, exact binary bytes through transcript edits and restore, and failed byte-read atomicity. The prior storage implementation fails the retained WebKit control with “Recording change could not be saved.” Chromium retains coverage of legacy Blob records; this does not claim WebKit can create those historical records.

`npm run verify` passed **114 tests**, TypeScript and the web build. Evidence: `artifacts/calendar-preferences-review/test-results/audio-byte-review/` with frozen inputs, terminal results and negative control. The audio sources are synthetic browser streams, so these checks do not prove physical microphone quality or agent ASR. The separate connected-voice routing changes are not included in this checkpoint. Android builds skipped; hosted checks and full device/provider acceptance remain open.

## October 2 — Real host-agent ASR configuration

The host launcher now passes verified installed Whisper assets to the agent's standalone ASR provider. `ALPHA_LOCAL_ASR=auto` (default) enables the provider when the standard assets exist; `off` disables it and `required` fails startup when assets are missing. Explicit `ALPHA_WHISPER_BIN` and `ALPHA_ASR_MODEL` paths must be absolute. The launcher checks executable access, bounded binary size and the supported tiny.en model's exact size and SHA-256 before enabling it. It does not download assets. This host configuration is separate from Android's packaged runtime.

On this Mac the defaults are `/opt/homebrew/bin/whisper-cli` and `~/.cache/alphaphone-asr/tiny.en/ggml-model.bin`. To repeat the real service check, launch an isolated profile with `ALPHA_LOCAL_ASR=required ALPHA_REMOTE_PORT=47859 ALPHA_REMOTE_PROFILE=<private-absolute-directory> npm run agent:local`, then run `scripts/test-agent-asr.mjs` with the same port/profile variables. The test uses locally synthesized fixture speech and never uploads user recordings. An existing prepared runtime source can be selected with `ALPHA_ELIZA_SOURCE`.

The isolated agent returned `ready:true` and transcribed “Please remember to water the plants tomorrow morning.” verbatim. Duplicate requests returned 409, invalid WAV and silence returned 422, and an invalid credential returned 401. Sanitized evidence is retained in `artifacts/calendar-preferences-review/test-results/host-asr-review/runtime.json`; it contains no enrollment credentials. Configuration unit checks cover missing, explicitly disabled, relative and incompatible assets.

This closes host ASR startup configuration only. Browser-to-agent binary voice transport, actual speech-output readiness, Android microphone/runtime execution and device acceptance remain open. The browser's manual transcript-review fallback does not establish agent ASR parity. Android builds remain skipped at the user's direction.

`npm run verify` passed **116 tests**, TypeScript and the web build for this checkpoint. The runtime test passed against an isolated agent on port 47859; it did not restart the live development agent or establish hosted CI status.

## October 2 — Browser development ASR transport

The host-owned development bridge now accepts only the exact Whisper status and transcription routes for speech. Transcription carries bounded canonical base64 WAV bytes through the browser's same-origin JSON envelope and forwards raw bytes with a request ID to the authenticated agent. Speech requests require the selected owner ID; mismatches fail before dispatch. Credentials stay on the host. The bridge rejects malformed payloads, route/method confusion and oversized audio, bounds speech responses to 128 KiB, and aborts the upstream request when the browser disconnects.

Synthetic HTTP contracts verify exact bytes (including a 2 MiB boundary payload), owner rejection, cross-origin rejection, canonical encoding, required request IDs and upstream cancellation. A separate real-service run passes synthetic spoken audio through this bridge to the actual isolated Whisper agent: the expected sentence was transcribed, duplicate requests returned 409 and malformed/silent WAV returned 422. Invalid credentials were independently rejected by the agent with 401. Reproduce the latter with `node --import tsx scripts/test-agent-asr.mjs --bridge` and the isolated profile/port environment described above. Evidence: `artifacts/calendar-preferences-review/test-results/agent-speech-bridge-review/`.

This transport is not yet wired into the rendered recording flow. Browser PCM conversion and voice selection, actual agent TTS and Android/device acceptance remain open. The live development stack was restarted with verified host ASR enabled and its renderer returned HTTP 200 on port 5317; that restart preceded this transport checkpoint. No Android builds were run.

`npm run verify` passed **117 tests**, TypeScript and the web build on the frozen transport checkpoint. Hosted verification remains separate and pending.

## October 2 — Rendered browser recording to local-agent transcription

Browser voice now converts captured recordings to bounded mono PCM16 WAV at 16 kHz and sends them through the host-owned speech bridge when a real resident development agent is selected. The browser protocol requires its real host bridge, so injected simulator profiles cannot acquire this capability. Requests capture the owner/session, abort on cancellation or disconnect, and reject late or mismatched results. The recording flow labels the action “Transcribe on this computer”; retained audio and reviewed transcripts remain browser-local until the user chooses a subsequent action. Browser speech playback still uses an installed local browser voice, not agent TTS.

The real-service browser test uses normal `connectionController.startLocal()` enrollment and a locally synthesized spoken fixture fed into a real browser MediaRecorder. It decodes and resamples the captured recording, posts it through the development bridge to the isolated Whisper agent, and verifies the expected sentence in the rendered transcript review screen. No transcript or transport response is substituted in that test. Four additional cases verify stereo resampling/duration, rendered synthetic-transport transcription, cancellation and disconnect rejection. The connected cases require `VITE_LOCAL_AGENT=1`; the real-service case additionally requires `ALPHA_SPEECH_FIXTURE` pointing to a synthetic WAV. They are explicitly skipped when their development prerequisites are absent.

Existing recording regressions passed **11 cases**, including manual transcript review, microphone release, byte persistence, failed reads and the Notes save/reload/play/restore journey. Four host-dependent cases were explicitly skipped in that offline run. A frozen combination with the concurrently edited connection/voice screens passed **seven voice cases**, including the actual local agent, and **eight simulator connection cases** in their normal offline development profile. An initial mixed-profile run was stopped after identifying the incompatible first-run modal setup; its logs are retained separately.

That combined campaign also exposed a real bug: browser agent retirement called the Android-only hosted-background plugin. The pause path now has the same Android platform guard as configuration. The profile-switch/history test failed with the missing-plugin error before this fix and passed afterward. This checkpoint preserves the separate in-progress simulator UI changes rather than committing them as part of speech integration.

`npm run verify` passed **117 tests**, TypeScript and the web build after the guard fix. Evidence, frozen inputs, the real rendered transcript screenshot and terminal logs are retained under `artifacts/calendar-preferences-review/test-results/browser-agent-recording-review/`. Agent TTS readiness, native/physical microphone and device acceptance, hosted checks and the broader remaining MVP requirements are still open. Android builds were skipped.

## October 2 — Host TTS dependency and readiness qualification

The current lean host profile excludes `plugin-local-inference`, so the agent TTS status is unavailable even though local browser speech works. Enabling the full plugin would also register unrelated model handlers. The next integration needs an explicit voice-only provider with startup readiness, request ownership and cancellation; changing text or embedding routing is not required to enable speech.

A real installed Kokoro FFI library was found at `/Users/shawwalters/v3/plugins/plugin-local-inference/native/llama.cpp/build-desktop-metal/bin/libelizainference.dylib`, with model/voice assets at `~/.cache/eliza/android-smoke-models/aux/tts/kokoro`. This is a development dependency from another checkout, not a newly packaged or released library. The runtime reports ABI 16. The available voice is `af_bella`; the preferred `af_same` preset is absent. No voice/model was downloaded and no upstream checkout was edited.

`scripts/test-host-kokoro.mjs` now provides a reproducible real Kokoro → WAV → independent local Whisper check. Run it with Bun's `--no-install --conditions=eliza-source`, `ALPHA_ELIZA_SOURCE` pointing to prepared source, `ELIZA_INFERENCE_LIBRARY` and `ELIZA_KOKORO_MODEL_DIR` set to the installed assets. It fingerprints the native library, model and voice; requires the synthetic sentence to transcribe exactly; and checks that a request cancelled before synthesis emits no audio. It never uses user recordings or text.

The original upstream smoke failed its unchanged 700 ms first-audio gate at **831 ms**. The independent roundtrip also failed cold-start timing at **809 ms**, while its warm trials took **556/546 ms** and all transcripts matched. These failures remain retained. With explicit `--warm`, a discarded “Ready.” synthesis took **530 ms** before the timed trials; subsequent speech took **691/576/557 ms**, all transcripts matched, and the pre-cancelled request emitted zero samples. This is a bounded host measurement with a small first-trial margin, not a general performance guarantee or mobile acceptance. The script keeps separate cold/warm reports and returns failure when any timed trial exceeds 700 ms.

Evidence is under `artifacts/calendar-preferences-review/test-results/host-tts-review/`. This checkpoint proves usable local speech assets and motivates explicit initialization before readiness; it does not connect agent TTS to HTTP or browser playback, prove cancellation during native synthesis, or close device acceptance. Those implementation steps remain open. Android builds remain skipped.

A final run explicitly forced the in-process FFI backend, preventing an ambient `KOKORO_BACKEND=fork` setting from selecting HTTP. Its warm-up took **463 ms** and the three checked trials took **664/626/645 ms** with exact transcripts and zero pre-cancelled samples. `npm run verify` passed **117 tests**, TypeScript and web build. The host-TTS implementation is still in progress; these are dependency/readiness measurements, not a completed provider.

## October 2 — Authenticated agent-host Kokoro service

`standalone-kokoro-host.patch` adds explicit `/api/tts/kokoro/status` and `/api/tts/kokoro` routes to the local app host. A paired owner session is required, including for status; a root credential alone is not accepted. The provider runs in a host-owned worker with a reduced environment and a dedicated bounded output pipe. It verifies the configured native-library fingerprint and pinned model/voice hashes, forces in-process FFI, warms the model before readiness and returns PCM16 WAV. Text/embedding routing and the pinned vendor checkout are unchanged.

Requests accept only bounded text and a request ID, sanitize non-speech markup, reject replay and concurrent admission, and bound both request and audio sizes. Cancellation kills the native worker, rejects unfinished audio and clears readiness. The next request initializes a new worker. Worker output is checked against the pending request ID; diagnostics and credentials are not forwarded as audio responses.

Host configuration is explicit: `ALPHA_LOCAL_TTS=required`, `ALPHA_TTS_LIBRARY=<absolute installed library>` and `ALPHA_TTS_MODEL_DIR=<absolute model directory>`. The default `auto` mode stays disabled without an explicitly configured library; `off` disables it. Model/voice checksums must match the qualified assets. `scripts/test-agent-tts.mjs`, with an isolated `ALPHA_REMOTE_PROFILE` and `ALPHA_REMOTE_PORT`, exercises the actual authenticated endpoint and independently transcribes its audio with local Whisper.

A fresh `agent:prepare --source-only` reproduced the complete patch series and verified every expected source hash. Existing dependencies were linked from the diagnostic checkout, then the prepared-source guard passed again; this is not a new dependency install or native build. The reproduced host returned intelligible speech, 409 for duplicate IDs, 422 for oversized/hidden-only/unsupported/null payloads, 400 for malformed JSON, 401 for invalid credentials and 403 for an unpaired root credential. During an observed in-flight synthesis, cancellation terminated the exact worker PID; a different worker became ready and the next synthesis succeeded.

Product `npm run verify` passed **119 tests**, TypeScript and web build. The app-host typecheck, changed-module lint and **nine route-policy tests** passed. Full upstream `bun run verify` was attempted and stopped at the existing `plugin-assistant` lint failures, outside this six-file patch; it is not claimed green. Evidence remains under `artifacts/calendar-preferences-review/test-results/host-tts-review/`, including fresh preparation, terminal checks and the reproduced HTTP result.

The working provider is isolated on port 47869. Live browser dev has not switched to this new source/provider, and the renderer does not yet request or play this endpoint's WAV output. Browser transport/playback, broader hosted qualification and Android/device acceptance remain open. The PR stays draft while that wiring continues. Android builds were skipped.


## October 2 — Browser playback through the real local agent

The development bridge now permits only the exact Kokoro status and synthesis endpoints, validates the selected owner and request ID, bounds text and WAV sizes, verifies response identity/type and cancels the upstream call when the browser disconnects. The renderer validates the returned envelope and ties each prepared audio clip to its selected agent session. Browser voice plays actual Blob audio with the existing media volume and lifecycle controls. Connection retirement clears prepared audio and stops playback. Agent synthesis failures remain visible; they never silently invoke the browser voice. Offline browser speech remains available through its existing explicit path.

The rendered real-service journey passed using normal local-agent enrollment: synthetic speech entered a real MediaRecorder, local Whisper produced the expected transcript, and local Kokoro returned audio that the actual browser player played to completion. A second playback stopped through the rendered Stop audio control, and a third stopped when the connection changed to offline. Six synthetic transport cases passed for pending cancellation, disconnect, wrong request ID, invalid audio, unavailable service and stale prepared-session rejection, with no browser-voice fallback. Ten existing offline audio journeys also passed.

The bridge contract independently passed exact-byte/owner validation, malformed request and response rejection, bounded output and upstream cancellation. Product `npm run verify` passed **120 tests**, TypeScript and web build. The initial run exposed the isolated voice unit harness's missing connection-controller dependency; updating that fixture restored its existing playback cases. Evidence is retained in `artifacts/calendar-preferences-review/test-results/browser-agent-tts-review/`, including the real rendered transcript screenshot and terminal results. These checks establish host browser speech, not hardware microphone, Android execution, general synthesis performance or device acceptance. Android builds were skipped. Hosted exact-head checks and the broader MVP gaps remain open.


The live development stack was restarted at `http://127.0.0.1:5317/` against the reproduced TTS source with both speech providers required. The renderer returned HTTP 200, and the production host-owned bridge returned `ready:true` for standalone Whisper and Kokoro. The existing private profile and hosted text-model configuration were preserved. A frozen composition with the other in-progress browser UI changes passed **11 speech cases** and **22 simulator connection/action cases**. An earlier run against the actively changing working tree had three detached-control timeouts; those results are retained rather than presented as passes. The separate UI changes remain outside this speech commit. These checks do not close the broader MVP goal or exact-head hosted qualification.


## October 3 — Scan draft storage across browser engines

Cross-browser review reproduced three WebKit failures in the existing scan draft implementation: saving for reload/PDF export, revision-conflict handling and retention after cancelled deletion all failed with “Draft storage interrupted.” The old implementation stored Blobs directly in IndexedDB. New drafts store versioned ArrayBuffer page bytes and MIME types, then reconstruct Blobs on read. Historical Blob drafts remain readable and upgrade only on an explicit save. Page ordering, total/page size limits and the existing revision-bound atomic write/delete behavior remain enforced.

Byte conversion completes before opening the transaction; cancellation or a failed read cannot publish a partial draft. The transaction rechecks the saved revision after conversion, so a newer writer wins while an older writer is still reading bytes. Stored record shape is validated before use or replacement. The rendered flow remains Save document draft → reload → Camera → Scan document → Load saved draft → Download document PDF.

The frozen scan campaign passed **26 Chromium cases** across document review, drafts, camera capture and PDF export, and **16 WebKit cases** across document review and drafts. One historical-Blob setup case is explicitly skipped in WebKit because that engine cannot write the old representation; Chromium verifies its exact-text read/upgrade. New cases check exact binary bytes/MIME/order after reload, failed byte reads, cancellation during serialization and a competing newer save. Existing cancellation-during-write/delete and quota cases pass. The loaded WebKit draft was visually inspected and its real PDF download completed.

`npm run verify` passed **120 tests**, TypeScript and the web build. Failing controls, passing terminal logs and rendered screenshots are retained under `artifacts/calendar-preferences-review/test-results/scan-draft-byte-review/`. This closes the reproduced browser draft-storage defect; page correction/searchable PDF, OCR quality, physical capture, provider/device acceptance and the broader MVP remain open. Android builds were skipped. Speech PR #27's exact-head browser workflows were still running at this checkpoint; no hosted success is claimed.


## October 3 — Reviewed scan page perspective correction

Each document page now has a Correct page action. The review supports dragging four corners or entering accessible horizontal/vertical percentages, resetting the selection, previewing and explicitly adopting the result. A projective transform with bilinear sampling straightens the selected quadrilateral. Crossing, out-of-bounds, degenerate and tiny selections are rejected. Input limits remain 16 MB and 32 million decoded pixels; working images and corrected output are capped to a 2048-pixel longest edge. The original photo and any previously saved draft are unchanged until their respective explicit document actions.

Changing corners invalidates the previous preview. Correction yields during processing so cancellation can interrupt it. Back closes only the nested correction review; page retirement closes both reviews. Late bitmap results are closed, image URLs are revoked, and cancellation cannot adopt a new page. Applied corrections become the current document page and persist only through Save document draft. Reloaded corrected drafts export through the existing real PDF path. Preview/source images are bounded to the compact viewport; the corrected preview scrolls into view, and light/dark controls were inspected.

The integrated scan regression campaign passed **33 Chromium cases** and **23 WebKit cases**, with the existing historical-Blob creation fixture explicitly skipped only in WebKit. After final control styling and theme-fixture correction, **nine correction cases passed in each engine**. The projective pixel test uses a synthetic trapezoid with independent horizontal color markers, distinguishing the expected perspective sample from a simple linear crop. Additional cases cover dragging, invalid selections before decode, cancellation during pixel processing and held decode, unchanged original bytes after cancel, stale-preview invalidation, nested Back, URL release, adoption/save/reload/PDF export and compact light/dark layout.

Final `npm run verify` passed **120 tests**, TypeScript and web build. Evidence is retained in `artifacts/calendar-preferences-review/test-results/scan-correction-review/`. This implements manual edge correction, not automatic page detection or a claim of physical camera/OCR quality. Searchable PDF, broader language/scan quality and the other MVP/provider/device gates remain open. Android builds were skipped; hosted verification remains distinct.


## October 3 — Reviewed searchable scan PDFs

Document review now offers Download searchable PDF. It runs the existing local English OCR engine on each current page, including adopted corrections and the current page order. Each detected line has an editable review field. Export adds only those reviewed lines as invisible positioned text over the image pages; clearing a line excludes it from search without removing text visible in the image. Notes corrections and image-only saved document drafts remain separate. This review is for the current export; text-layer edits are not yet persisted as a reusable draft.

The optional text-layer export validates page alignment, line counts, text lengths and normalized bounds, snapshots the reviewed data before asynchronous work, and uses the existing PDF size limit. Text rendering is invisible; horizontal scaling fits each reviewed line to its recognized position. The bundled standard PDF font supports the Western Latin character set. Unsupported characters fail before export dispatch and leave the review editable; there is no silent replacement. OCR remains English only. Image-only PDF export retains its existing behavior and has no text layer.

Cancellation owns the OCR worker. Back closes only the searchable review. Closing after an export has been dispatched records an unconfirmed result and disables another export from that document review. Malformed positions or unsupported text fail before dispatch, so the user can correct and retry. Page-image URLs are released when the review closes.

The integrated Chromium scan/OCR/document/correction campaign passed **32 cases**. The final **seven searchable-PDF cases passed in both Chromium and WebKit**. Tests use real local OCR, edit/exclude reviewed text, extract the actual downloaded PDF, verify reordered pages, compare rendered pixels of image-only and searchable PDFs exactly, cancel worker startup, reject invalid/unsupported layers, retry after character correction and retain uncertain dispatch outcomes. No remote model requests occurred during the real OCR/export test. The review was visually inspected. The initial run lost its review before the text assertion; the fixture now waits for the mounted app before opening the document. Test renderer import/cleanup mismatches and empty PDF extraction line-break items were also corrected. All original failures are retained with the passing runs.

`npm run verify` passed **120 tests**, TypeScript and web build. Evidence is under `artifacts/calendar-preferences-review/test-results/searchable-scan-review/`. Automatic edge detection, persistent text-layer drafts, broader OCR/font/language and physical document quality remain open. Android builds were skipped.

## October 3 — Hosted browser failures requiring follow-up

Browser workflow run **37094935245** finished with failure at speech head `4ca8cd246671f08483789cd07cfafcf6359e9e24`. Repository verification passed in the hosted shards, but four browser cases failed: encoded camera crop pixels, notification/installed-app identity (`DeviceApps` web implementation), HOME-role persistence presentation, and the connected retained-output/notification journey. These are unresolved hosted results, not a green full-suite claim. Terminal logs and exact-head job metadata are retained in `test-results/browser-agent-tts-review/hosted-failure.log` and `hosted-final.json` inside the review checkout. The next audit must reproduce and repair the owning behavior or fixture, then requalify the current head.


## October 3 — Browser registration cycle and hosted failure repair

The speech adapter's direct import of the connection controller reintroduced an initialization cycle: the controller imported native plugin declarations before the browser registration module could install its implementations. `DeviceApps`, `ElizaSystem` and the retained-result inbox were affected. Moving the live speech binding to a dependency-free browser module lets main bind the controller only after browser implementations have registered. The binding forwards current session changes, so cancellation and stale-session checks remain active.

The notification app-identity and HOME-role cases both failed locally before this repair. All **20 device/notification cases** passed afterward. The retained-output journey passed with the repair and failed again when the old voice import was restored as a negative control; the final **nine camera/retained-output cases** passed after restoring the fix. **Eleven local-agent speech cases**, including actual host transcription/playback/session retirement, passed. Repository verification passed **120 tests**, TypeScript and web build.

The hosted camera sample failure did not reproduce in five unchanged local repetitions. Its check now waits for `requestVideoFrameCallback` before reading decoded pixels; `play()` alone was not a frame-presentation gate. Encoded crop colors, thumbnail colors and stream release assertions remain unchanged. This strengthens the check; it is not evidence of a repaired encoder defect or a hosted pass. The retained-output fixture also avoids masking the original failure if cleanup finds the page already closed.

An initial offline speech regression campaign passed 20 cases and failed one before Run could be clicked. Its trace shows an unexpected second document navigation; the cause remains unproven. The unchanged complete campaign then passed **21 cases** without concurrent checks. Both runs are retained. This intermittent reload remains a separate verification concern rather than a claimed product fix.

Evidence is under `artifacts/calendar-preferences-review/test-results/browser-hosted-repair/`, including the downloaded hosted trace, local negative controls and final logs. Separate in-progress browser-development changes remain outside this checkpoint. Exact-head hosted requalification and the wider MVP work remain open. Android builds were skipped.

A frozen combination with 45 pending development files was also tested: device/notification/retained-output checks passed 23 of 24, with the remaining case returning to Home before notification settings opened. Speech passed 2 of 11; cancellation/transcription controls and all six TTS transport/session contracts failed, including a browser-voice fallback. These combined-state failures are unresolved and are not covered by the isolated checkpoint passes above. Logs and immutable overlay snapshots remain under `test-results/browser-hosted-repair/combined-*` and `frozen-combined/`. The temporary overlay was restored afterward; no pending development files are included in this repair.

Unchanged serial reruns of that same frozen combination passed **all 24 device/notification/retained-output cases** and **all 11 speech cases**, including real host transcription and playback (`combined-device-serial.log`, `combined-speech-final.log`). An intermediate speech run omitted the fixture environment variable and correctly skipped the live case; it is not counted as live acceptance. The earlier TTS trace fetched both timestamped and unversioned `connection-ui.tsx` modules, consistent with separate controller instances in the fixture. This narrows the investigation but does not prove what triggered invalidation or resolve the intermittent reload. Both failed and passing evidence remain retained. The pending source bundle is still outside this PR.


## October 3 — Persist reviewed scan text with document drafts

Searchable PDF review now offers **Keep reviewed text**. It returns corrected and intentionally cleared lines to the document without exporting. **Save document draft** persists those positional lines atomically with the ordered image bytes and revision. Loading a draft presents the saved lines for review without rerunning OCR; only pages without a saved layer are recognized. Downloading a searchable PDF also keeps its reviewed lines available for an explicit draft save.

Page objects carry their own layers through reorder/removal. Replacing, retaking or adopting a corrected image creates a new page without the old layer. Cancelling either review preserves the previous image and text. Old image-only drafts remain readable. Stored layers are bounded and validated on read/write and cloned before asynchronous image serialization, so invalid input, stale saves and subsequent caller edits cannot overwrite a valid draft.

Verification: **28 integrated Chromium cases** for searchable PDF, document manipulation, perspective correction and new text drafts; **nine Chromium storage cases**; **12 WebKit cases** with the existing legacy-Blob setup case explicitly skipped. The new cases extract text from the actual saved/reloaded PDF, block OCR workers to prove saved corrections are reused, replace an image and run real OCR for its new text, and check cancellation, correction adoption, stale revisions and mutation during save. Repository verification passed TypeScript, 120 tests and the web build. The rendered searchable review was inspected. Evidence is under `artifacts/calendar-preferences-review/test-results/scan-text-draft-review/`.

This closes persistent reviewed-text drafts. Automatic edge detection, broader OCR/font/language support and physical document quality remain open. Browser registration PR #31 hosted requalification was still running at this checkpoint; these targeted passes do not qualify the full suite or the separate pending development bundle. Android builds were skipped.


## October 3 — Local page-edge suggestions

Scan correction now offers **Detect page edges**. A bounded local detector estimates background luminance from the image border, segments contrasting connected regions, fits convex quadrilaterals and declines competing candidates. It handles both lighter and darker pages. Detection updates only the four editable corners; **Preview correction** and **Use corrected page** remain separate actions. No image or saved draft changes just because detection runs. A declined detection leaves manual adjustment available.

Input limits match scan correction (16 MB and 32 million decoded pixels); detection downsamples to at most 320 pixels on its longest side, releases decoded bitmaps, yields to cancellation and ignores late results after closing. Existing correction adoption clears stale text layers; cancellation preserves both original image bytes and saved text.

Verification: **21 Chromium cases** covering detection, perspective correction and persistent text; **12 WebKit cases** covering detection and text persistence. Synthetic light/dark trapezoids exercise corner accuracy, blank/circular/two-page images exercise rejection, rendered review exercises preview/adoption and original-byte preservation, and delayed decode/processing cancellation exercises cleanup. The suggested-corner screen was visually inspected. Repository verification passed **120 tests**, TypeScript and web build. Evidence: `artifacts/calendar-preferences-review/test-results/scan-edge-review/`.

Automatic suggestions are now implemented for high-contrast quadrilateral pages. This is not general photo-quality acceptance: low contrast, shadows, clutter, unusual shapes and physical capture quality still require a representative image corpus and device review. Manual corners remain available. Broader OCR/fonts/languages and hosted full-suite qualification remain open. Android builds were skipped.


## October 3 — Lowercase credential assignment redaction

The pinned runtime reproduced three failures: a lowercase unquoted `password=value` remained in model-facing text, an email subsequently assigned as a password could still be restored as personal data, and buffered/streamed lowercase assignments exposed the synthetic credential. Restoring only the old stream guard after repairing the shared detector reproduced two failures, independently proving that both changes are needed.

The explicit `egress-credential-assignments.patch` adds case-insensitive matching for named credential assignments to the shared log/secret detector and updates the streaming assignment opener. It deliberately retains the existing uppercase environment grammar instead of making all suffix matches case-insensitive: ordinary names such as `monkey`, `donkey` and `turnkey` remain ordinary text. Existing value-length, exemption, nonce/session and tool-restoration boundaries are unchanged.

Validation: five direct Bun cases pass **583 assertions**, including all split points and a long credential spanning the stream carry window. The owning redaction/control/reply suites pass **36 tests**, both in an isolated copy and after fresh pinned full-series source preparation. The patch and three final source/test hashes are recorded in the consumer manifest; source verification passes again after tests. Product verification passes **120 tests**, TypeScript and web build. Evidence: `artifacts/calendar-preferences-review/test-results/redaction-grammar-review/`. The initial Vitest config-path error and both negative controls are retained.

This closes the reproduced lowercase-assignment grammar defect, not all redaction acceptance. Contact-versus-credential placeholder semantics, broader detector coverage, real provider-bound capture, action/restart behavior and Android acceptance remain open. The main development session keeps both swap layers off and continues using its previously qualified running source; no live credential, provider-wire or device result is claimed. No Android build or full upstream verification was run for this patch.


## October 3 — Restart on the latest verified local runtime

The development stack was restarted from the newly composed `artifacts/calendar-preferences-review/artifacts/redaction-grammar-reproduced` runtime, preserving the existing `browser-agent` private profile. Filesystem clones supplied its pinned root and workspace dependency directories; the complete source was reverified afterward. A runtime import probe resolves the new core entrypoint and confirms the lowercase credential fix. An early probe during incomplete dependency preparation failed on missing packages; it was not a runtime-source mismatch or a successful launch.

The new owned host started at **2026-10-03T05:05:02.597Z**, PID **22364**, port **47849**. Its source-manifest SHA-256 is `7195f9fdd14841ceed3f1ce0ee36df6b89271e2d1be4d6ef7e5d2514ab48ffcf`. The renderer is at `http://127.0.0.1:5317/`. The authenticated production bridge verified owner access, exactly one agent, ready Whisper and Kokoro providers, and workflow status `ready`. The existing in-app browser visibly restored **Connected · On this computer · development** after reload.

All **11 browser speech cases** passed against this restarted live host, including actual synthetic microphone capture/transcription, synthesized playback, stop/cancel and session retirement. Evidence, sanitized process metadata, readiness readback and the actual connection screenshot are under `artifacts/calendar-preferences-review/test-results/runtime-restart-review/`. The renderer includes separately pending development edits; this focused connection/speech result does not qualify that entire bundle.

Both swap switches remain off pending broader redaction acceptance. Orchestration and speech run locally; the configured text model still uses hosted inference. This restart does not establish offline LLM, Android execution or physical-device acceptance. No Android build ran.

## October 3 — content-aware development reloads

The pending development bundle's initial 85-case campaign failed 18 connection/workflow cases. Traces recorded unexpected document reloads and timestamped module imports while the frozen source bytes and mtimes remained unchanged. Delayed filesystem notifications are consistent with this evidence; their operating-system origin was not independently instrumented.

The Vite reload hook now fingerprints the initial source tree and ignores unchanged file notifications. Actual non-CSS edits still reload bootstrap; actual CSS edits still update in place. A new regression fails against the original hook and passes after repair, alongside the existing real-edit/state-preservation test (2/2). The frozen bundle rerun passes 85/85 in 2.3 minutes. This demonstrates the reproduced notification repair and this campaign, not every historical reload cause.

Evidence: `test-results/dev-bundle-review/` contains the original and repaired browser campaigns, frozen path/byte snapshots, reload regression evidence, hosted registration results and repository verification. The 53 pending paths were restored out of the review checkout after qualification; this repair does not silently publish their product changes. Android builds and device acceptance were not run.

## October 3 — Development profiles and integration repair

The reviewed frozen bundle adds explicit local/Cloud/remote sample profiles, account-separated conversation histories and scripted replies, Cloud setup scenarios, local password-provider selection, typed workflow authoring/execution and durable receipts, approval-bound phone steps, digest schedules, source read grants and result recovery. These are browser development implementations. Sample Cloud accounts and password-provider state perform no external provisioning, billing or real credential operations. Real local-agent execution remains separately available.

The first complete-suite attempt was stopped after a reproducible integration defect: the development chooser had hidden the existing real local/remote pairing controls. It recorded **257 passed, 7 failed, 2 interrupted, 10 skipped and 805 not run**. Six failures were missing pairing controls; the seventh was ENOSPC during a design screenshot. The interrupted recurring Calendar cases were waiting for the same control. Shared pairing forms now appear in both choosers. Existing rendered pairing/action journeys pass without replacing their actual connection/controller path with sample profiles: **25/25** focused cases and **50/50** broader Clock, Calendar recurrence, reminder and design cases. The original campaign is retained and is not presented as passing.

The 53-path bundle was frozen before review; newer Files/content-question edits and later changes in the shared checkout are outside this snapshot. Publication of this review preserves those newer working-tree bytes. Evidence and the exact frozen path list are under `test-results/dev-bundle-review/`. Full integrated qualification and real provider/device acceptance remain open.

## October 3 — Real local workflow execution and retained result

The actual browser-local Eliza host compiled and saved a manual typed workflow with supplied synthetic text and a compose-draft step. Browser Run review launched execution `a8a2c72a-a5fb-4994-8d5a-d24218ff8410` for workflow `bf71c1f9-aae1-4e49-99da-2f952f69ca14`. The engine returned `finished`, recorded `RunFinished`, and produced `Verified: LOCAL_WORKFLOW_ACCEPTANCE complete`. The rendered result and execution history survived browser reload; a settled screenshot was inspected.

This used the existing local host on port 47849, browser on 5317 and freshly composed runtime recorded in the restart checkpoint. No model step, external effect or provider mutation was included. Process restart, cancellation, live-model proposal generation and reviewed phone-action recovery remain separate acceptance work. Evidence: `test-results/live-workflow-review/`. Initial harness attempts assumed no first-use chooser and a simulator-style `succeeded` terminal status; those harness assumptions were corrected from actual UI and engine output without rerunning the completed workflow.

## October 3 — Hosted Clock review fixture and integration status

PR #36 hosted run `37100013656` failed in the dismiss-Clock development-action case: the asynchronously opened ringing-alarm modal intercepted the approval click. The fixture now waits for that real modal, closes it with Close Clock, verifies the alarm remains posted and then reviews the agent action. All four Clock handoffs pass three repetitions (**12/12**). This does not bypass approval or disable alarm presentation.

The full local rerun ended with exit 1 after logging case 612 and no final test summary. The captured log ends with the Node version without a conclusive fatal diagnostic; no full pass or proven cause is claimed. Hosted shard 1 failed the Clock fixture; shards 2 and 3 were cancelled. Evidence is under `test-results/dev-bundle-review/` (`full-fixed.log`, `hosted-shard1.log`, `clock-modal.log`). Full qualification remains open.

A separate real-local phone-step check exposed HTTP 409 during workflow validation despite accepted device registration. Investigation found canonical workflow ownership and paired-device subject identity diverge. An explicit enrollment-binding patch is being qualified in isolated composed source; it is not yet deployed or claimed accepted. Ordinary supplied-text execution remains verified independently.

## October 3 — Workflow enrollment owner binding and live acceptance

A real paired local owner could register its device but received HTTP 409 when validating a workflow with a phone step. Device enrollment used the authenticated pairing identity, while local workflow routes used the canonical runtime owner. Supplied-text workflows did not exercise this boundary.

`workflow-device-owner-binding.patch` adds an explicit nullable workflow-owner binding to enrollment. Only a verified local OWNER session binds the canonical owner; Cloud identities and non-owner sessions keep their own subject. Existing nullable rows retain their previous subject scope until an authenticated registration supplies the binding. The device key is checked before binding changes. Workflow validation and dispatch require the exact agent, workflow owner, installation, enrollment, protocol and revocation state. The queued approval still targets the paired device subject, preserving renderer owner checks and existing canonical workflow history. No caller header or body field selects the binding.

The new real-PGlite regression fails before the fix and passes after it. The fresh composed source passes three new cases with 24 assertions covering wrong-key rebinding, agent/owner/enrollment isolation, Cloud/non-owner authority, legacy rows, revocation/protocol, exact approval subject, replay and cancelled-run rejection. The existing device approval REST lifecycle test passes 410 assertions, including restart and duplicate-claim behavior. Fresh source preparation and repository verification pass; vendor remains untouched.

Browser dev restarted with `artifacts/workflow-owner-reproduced-v2` at 2026-10-03 05:54:06 UTC after a private profile backup. Authenticated owner, workflow readiness, Whisper and Kokoro all pass. The earlier execution `a8a2c72a-a5fb-4994-8d5a-d24218ff8410` remains visible with its original output after this process restart. Run `f10f031d-7209-4c3e-901f-ec291c3ee9f9` reached visible phone-step approval, was cancelled through the UI, created no sample note and retained cancellation after reload. A separately reviewed and confirmed Notes-write run, `d3addb6f-e00f-493d-b6b6-b9530581566d`, saved the exact synthetic text and reached `finished`; history survived reload. Settled screenshots were inspected.

Evidence: `test-results/live-workflow-review/`, including before/after database logs, composed-source tests, existing REST test, readiness, execution receipts and browser traces. The test harness was corrected to normalize specs as the real editor does and recognize the engine's `waiting-approval` state; earlier harness failures remain recorded. These are actual host orchestration and browser Notes effects with synthetic supplied text. Live-model-generated proposals, Android/native execution, suspended-run process-death recovery, provider integrations and device acceptance remain open. No Android build was run. Egress redaction remains off pending its separate acceptance.


## October 3 — Reviewed content questions and browser media parity

The next 26-path snapshot closes explicit browser-development dead ends for selected Files/PDF text, photo text/descriptions, unsaved camera frames, and Files/Photos search questions. Content is bounded and editable before entering the existing conversation draft; Send remains a separate action. Image OCR runs locally and only reviewed text enters the draft. Closing, navigation, selection retirement and cancelled recognition prevent stale composition; previews and workers are released. This is text/OCR-assisted questioning, not unrestricted vision inference.

Microphone bars now measure the recording session's already-admitted stream and retire their audio context when recording stops or is cancelled. Photo filters have a pixel fallback for browsers without Canvas filter support. Home attention routes to Inbox and counts only active unread messages, preserving the count through reload.

Independent review passed repository verification (TypeScript, 120 tests and web build) and 42 Chromium cases across camera/video, files, content review, search, compact layout, Calendar boundaries, filters and metering. The initial campaign had 40 passes and two failures: one screenshot could not be written because the disk was full; the other assertion ambiguously matched both an Inbox row preview and its open message. The test now checks the actual message heading and Back to inbox control. The complete 42-case rerun passed. An additional 15 WebKit cases passed for selected text, real local photo OCR, cancellation, search/unread persistence, portable filters and recording-meter teardown. Evidence and the frozen path/hash manifest are under `test-results/content-media-review/`; original failures are retained.

These focused campaigns do not qualify the full integration suite. Hosted checks for the previous workflow-owner commit remained in progress at this checkpoint. No Android build ran in this review; author-reported Android checkpoints in the parity document are separate evidence. Production/native content-analysis routing, live-provider acceptance and physical-device behavior remain separate gaps.


## October 3 — Browser Files batch operations and archive path repair

Browser-managed Files now supports selecting rows, downloading their exact bytes in a ZIP, moving the selection in one transaction, and confirming permanent deletion. Stale revisions, destination collisions and nonempty-folder deletion reject the whole batch. Folder downloads preserve paths and UTF-8 names. Native folder operations keep their existing per-file path and explicit unsupported-bulk response; no native bulk implementation is claimed.

Review reproduced a filename-validation defect: whitespace-padded dot names passed validation before being trimmed into `.` or `..`. Names are now normalized before validation. The ZIP boundary independently rejects dot segments, absolute/drive paths, backslashes, NULs, empty segments and duplicate paths. The regression fails on the original snapshot and passes after repair. The rendered download is opened by Python's independent ZIP reader, verifies CRCs, and compares exact UTF-8 content before the move/delete/reload journey.

Verification: repository typecheck, 120 tests and web build passed; 10 Chromium and eight WebKit cases passed across bulk operations, Files/PDF, selected-content questions and path rejection. Initial rendered tests used the wrong destination accessible name; the corrected test uses the existing `Move into Destination` label. Negative and initial logs remain under `test-results/files-bulk-review/`, alongside frozen inputs. This closes browser-managed batch operations, not arbitrary provider/native bulk actions or full-suite qualification. No Android build ran.


## October 3 — Workflow Describe route and full hosted checkpoint

The explicit browser-development typed editor now opens an editable conversation draft from its empty-workflow Describe action. It does not send automatically or copy private draft fields into the message. The workflow name and description survive the conversation and reload. This restores a conversation entry point; natural-language generation of validated typed steps remains unimplemented by this route. Native behavior retains its existing limitation.

The six-path snapshot also includes the Files same-folder move guard, nested Unicode/empty-directory ZIP acceptance and the latest parity notes. Repository verification passed (120 tests, TypeScript, web build), followed by 11 Chromium and 11 WebKit cases. The original Describe test incorrectly expected the empty-workflow action after adding a step; it now follows the actual reference UI and verifies retained metadata. Evidence: `test-results/workflow-describe-review/`.

Hosted browser run `37101611900` completed successfully on exact workflow-owner commit `2fdd84a5808896b2489040c279f689108ddd2117`; all three shards and their repository verification passed. Its full log is retained in the same evidence directory. The ten browser cases requiring a local speech host remain skipped on hosted CI and retain separate actual-host evidence. This qualifies the integrated development-profile, Clock and owner-binding checkpoint, not the subsequent content/media, bulk Files or Describe commits. No Android build ran in this review. Current-head full-suite and real-provider/device acceptance remain open.


## October 3 — Actual model-backed workflow and readable retained output

The real host-local agent compiled and ran supplied synthetic text through `model_draft`. Workflow `f5f7cb5a-1257-4aec-be61-b484ac673378`, execution `df36dc92-8b87-4a1c-8793-40ccbb4d52e9`, finished with the model-generated sentence: “The fictional team plans to review the prototype on Tuesday under the reference ALPHA_MODEL_42.” Orchestration ran locally; configured text inference remained hosted. No external message or provider mutation was requested.

Rendered review exposed raw JSON containing both the final answer and intermediate input. The protocol now presents plain string output directly and extracts final text only from a single `typed-steps` envelope bound to the same run. Unknown/mixed structures retain their JSON representation. The existing 4,000-character display limit applies after extraction, so intermediate metadata cannot consume the final answer's display allowance. Run/version identity and execution history remain separate.

The regression failed before repair and passes after it; six Chromium workflow/output/context cases and repository verification (120 tests, TypeScript, build) pass. The live renderer initially served its cached old module, despite the on-disk fix. The owned stack was restarted at 2026-10-03 06:26:40 UTC with the same source manifest and private profile (runtime PID 79084). The original completed run survived this process restart; reopening it rendered the exact readable sentence, and the settled screen was inspected. No model rerun was needed. Evidence: `test-results/live-model-workflow-review/` and `test-results/workflow-output-review/`.

This closes a real model-drafting execution and completed-result restart/display check. It does not prove model-generated typed proposals, suspended phone-step process-death recovery, Android execution, offline inference or provider/device acceptance. No Android build ran. Runtime redaction switches remain off pending their separate qualification.


## October 3 — Pending approval survives abrupt local-agent death

Execution `4e54897f-b35a-4c81-995e-4cbd10a875b2` reached `waiting-approval` for a supplied-text Notes write. While the browser context remained open, the owned runtime PID 79084 was terminated with SIGKILL. The development supervisor stopped its renderer, and the same verified source/profile restarted at 2026-10-03 06:30:19 UTC (runtime PID 85484). Authenticated OWNER, one agent, workflow readiness, Whisper and Kokoro were rechecked successfully.

The browser reloaded, reopened the same waiting execution and exposed the phone-step approval. Explicit Approve then Confirm completed it. Exactly one note titled `Restart approval synthetic note` contained the expected synthetic text; the run reached `finished` and retained its history after another reload. The settled history screen was inspected. Evidence: `test-results/workflow-restart-approval-review/`, including the pre-crash waiting receipt, post-restart readiness and final receipt. This is abrupt host-local runtime death and browser Notes recovery, not Android process/background acceptance or a crash during the write/receipt commit itself.

The Scheduled digests focus-restoration fixture now opens its triggering button through keyboard focus and Enter, so both engines have the same meaningful focus-restoration precondition. It passes three repetitions each in Chromium and WebKit. The current-source output/context case additionally renders a typed result while asserting intermediate input is absent and the conversation handoff contains only the run/version identity. Author-reported complete Chromium evidence and newer WebKit campaign limits are retained in `docs/browser-dev-parity.md`; their frozen-source boundaries remain explicit. No Android build ran.


## October 3 — Browser Files storage usage

The Files storage panel now reports the browser origin's actual usage/quota estimate in explicit development mode, with its fraction capped at 100 percent. Missing, rejected or invalid estimates fall back to exact managed-file byte counts read in one IndexedDB transaction; the capacity bar is hidden because that fallback cannot establish total capacity. Labels distinguish browser storage from managed files and do not claim physical device capacity.

While Files is active and visible, refreshes are serialized; leaving invalidates pending results and reentry requests fresh data. Verification passed eight Chromium and eight WebKit cases covering estimate changes, missing/rejected/invalid estimates, exact UTF-8 byte counts, import/delete/reload and existing bulk-file/ZIP regressions. Repository verification passed TypeScript, 120 tests and web build. Evidence and frozen hashes: `test-results/storage-usage-review/`. Full current-head and native/provider capacity acceptance remain separate; no Android build ran.


## October 3 — Model-generated chat action and Calendar media fixtures

The actual local agent received a synthetic chat request to create `Synthetic proposal acceptance` with body `ALPHA_CHAT_ACTION_42`. It generated a device-action proposal through its normal model/tool path. The rendered proposal showed the exact title/body; no note existed before approval. Approving the visible action created exactly one browser Notes record with that body, and reload retained a single copy. The proposal screenshot was inspected. No queued-development action or transport fixture generated this proposal. Evidence: `test-results/live-chat-action-review/`. Orchestration remained local with hosted text inference; this does not establish all Calendar/reminder actions, external effects or Android acceptance.

Calendar meeting fixtures now retain a stable `navigator.mediaDevices` object before installing their synthetic streams, making the same lifecycle checks usable in WebKit. Eight cases pass in each engine, covering attendee persistence, rendered meeting entry/exit, camera/microphone denial and retry, ended-track recovery, late permissions, Back/background teardown, and local guest-response cancellation/stale revisions. Evidence: `test-results/meeting-media-review/`. These are local-only preview rooms and synthetic media; no remote participant was contacted and no real invitation was sent. No production media behavior changed and no Android build ran.


## October 3 — Live Calendar proposal and model-facing format guidance

An actual-agent Calendar request initially returned `Invalid Calendar operation` with no proposal and no event. The contract requires canonical UTC timestamps with exactly three millisecond digits, while its model-facing start/end schemas previously said only `string`. The original rejected raw tool arguments were not captured, so their precise invalid field is not asserted. A separate request spelling out the exact fields and canonical timestamps succeeded through both approval layers.

`calendar-tool-format-guidance.patch` documents canonical start/end instants and the IANA review timezone in the tool schema, and makes Calendar refusal feedback actionable without reflecting private arguments. Validation is not relaxed. Fresh full-series source composition, source recheck, five direct contract checks, the real database/REST approval test (410 assertions), and repository verification (120 tests, TypeScript/build) pass. The first upstream test invocation omitted the source export condition and failed module resolution; the corrected source-conditioned invocation passed. Vendor remains untouched.

The dev stack restarted on `artifacts/calendar-format-reproduced` at 2026-10-03 06:48:12 UTC (PID 22780), using the existing private profile and source manifest `2b54b7335bfc0976682b3ed84d1298153c58879826317cfd5abd5b78bbe7a166`. Authenticated OWNER, one agent, workflows, Whisper and Kokoro report ready. Replaying the original less-prescriptive request now generated a reviewable Calendar proposal. The event was absent before action approval and before the separate Calendar confirmation; confirmation saved the exact 2026-10-04 15:00–15:30 UTC interval and synthetic description once, and reload retained it. Both review screens were inspected. This is one live replay, not a reliability-rate claim. Text inference remains hosted, orchestration local, and no invitation was sent.

Evidence: `test-results/live-calendar-action-review/` preserves the initial failure, canonical-request check and updated-runtime replay; `test-results/calendar-format-review/` preserves source/test/readiness logs. Hosted run `37103133453` ultimately cancelled with only shard 1 successful; it is not full-suite qualification. The earlier 1,071-pass workflow-owner checkpoint remains the last complete hosted result recorded here. No Android build ran.

The production provider inventory was also corrected to 17 plugin classes and 159 annotated methods: the first extractor omitted Calendar's synchronized `save`. The replacement inventory checks every annotation count and source hash, excluding debug/test-only plugins. It proves method routing coverage only, not native acceptance.


## October 3 — Host journal reminder recovery

The host-backed browser journal now recovers an admitted reminder attempt from the original retained reminder receipt. The renderer verifies the operation hash and account/session/device binding, then reads the receipt without executing the operation. The host compares the complete prior journal entry before replacing an unknown/applying outcome with validated success. Stale entries and changed bindings reject; missing receipts remain unknown, and terminal results remain immutable.

Independent review passed two Chromium and two WebKit cases through the actual Vite storage bridge and browser reminder store with an isolated synthetic profile. Checks cover applied/missing receipts, wrong bindings, stale compare-and-exchange input, idempotent recovery, unchanged effect-store bytes and journal persistence after reload. Repository verification passed TypeScript, 120 tests and web build. The incoming-attachment diagnostic hook now opens a CDP session only in Chromium; ten WebKit attachment lifecycle/content cases passed without suppressing any product assertions. Evidence and frozen hashes: `test-results/host-reminder-review/`.

This closes the host-storage recovery route, not native process-death/provider acceptance or a fresh model-generated reminder journey. Existing actual-host Notes/Calendar evidence is separate. Newer sensor and surface-copy test edits were preserved outside this snapshot. No Android build ran.


## October 3 — Current workflow assertions and hosted runtime allowance

Inspection of cancelled hosted run `37103133453` found two independent issues. GitHub annotations explicitly state that shards 2 and 3 exceeded the 20-minute job limit. Shard 2 nevertheless reached its test summary: 365 passed and three failures. Those failures expected JSON quotation marks around plain workflow output after the readable-output change. The assertions now require the actual unquoted final text; approval, receipt synchronization, duplicate prevention and reload assertions remain intact.

The browser job limit is now 35 minutes, allowing setup, the expanded suite and artifact upload. The three shards, fail-fast policy, per-test timeouts and test assertions remain unchanged. Increasing this limit is not a passing CI result; the new exact head still requires terminal hosted qualification. The timeout annotations and full shard log are retained under `test-results/surface-sensor-review/`.

Targeted verification passed 15 workflow/output cases in Chromium and 15 in WebKit. The sensor fixture retains a stable mediaDevices object in WebKit; seven sensor cases plus a 14-entry-surface copy check pass in each engine. The copy check visits the visible entry views and rejects known native-only limitation strings; it does not qualify every nested control or physical sensor. Initial setup and one repository-verification attempt hit transient ENOSPC. Neither is counted as a pass. The subsequent repository retry passed TypeScript, 120 tests and web build. No Android build ran.


## October 3 — Actual-agent reminder creation

The normal host-local agent generated a `create_reminder` proposal for synthetic browser data. The first run showed the requested title and October 4, 2026 16:00 UTC due time; no matching reminder existed before approval. Approval created exactly one scheduled reminder at the exact instant, and reload retained it. The proposal screenshot was inspected. A second unconstrained response included the word “due” in the title; the exact-title assertion failed and that failure is retained. Explicitly quoted title and dueAt fields subsequently produced the exact requested record. This is bounded live execution evidence, not a model extraction reliability claim.

Evidence: `test-results/live-reminder-action-review/` retains scripts, traces, rendered proposals and result receipts. Selected-reminder completion remains unqualified: one attempt stopped at harness Calendar date navigation, a subsequent repeated creation reported an approval-key conflict, and the final creation retry timed out without a visible proposal. These failures are preserved separately and are not passing completion evidence. The approval-key conflict requires investigation of operation-key scoping across distinct browser installations and chat turns; strict conflict rejection must remain intact. Orchestration remains host-local with hosted text inference. The reminders are isolated synthetic browser data; no external notification or Android/background delivery is established. No Android build ran.
