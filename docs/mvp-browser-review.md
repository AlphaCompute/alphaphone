# MVP implementation and design review — updated October 2, 2026

Latest full integration checkpoint: **245/245 browser tests and 82/82 repository tests** at `a9845d0` on October 2. Subsequent targeted corrections are recorded below. See [the integrated report and remaining work](#october-2--integrated-browser-runtime-device-and-media-review) below. Earlier entries are historical evidence for their stated snapshots. The MVP goal remains open.

Latest browser checkpoint: [Notes status layout](#notes-storage-status-layout--2026-10-02). Evidence below is scoped to its recorded revision; newer implementation checkpoints supersede earlier unavailable-feature statements only for the capabilities explicitly verified. The MVP remains incomplete.

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
| Camera/Photos/Files edges | Basic capture/media/document workflows exist; broader providers, interrupted writes, catalog scale, OCR/scanning and analysis remain separate gaps. Prioritize required selected-content/capture recovery; advanced editing and unrestricted analysis are outside the current MVP priority. | Relevant actual provider/native flows. OCR/content analysis requires an implemented, licensed engine and explicit selected-content boundary, not prototype success. |
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
| Startup/home | Brand, clock, ten enabled app routes, context-aware assistant dock, agenda/workflow cards | Desktop scaling, mock-banner spacing and absent-native reminder messaging are fixed and covered by browser tests. Native boot, lock, HOME and system status remain device work. |
| Connection/account | Primary resident connection, browser-local host, optional Cloud/remote pairing, offline and mock modes; secure native credentials | Local browser connection is verified. Actual native startup/restart and provider/account grants remain distinct gates. Cloud callbacks and provisioning apply to the optional Cloud path; enclave admission is not a prerequisite for the selected local architecture. |
| Assistant | Pill/input/sheet/full layouts; retained view context, history, cancellation, reviewed device actions and receipts | Audit keyboard/focus/viewport continuity and disconnected errors. Existing local Cerebras history/receipt evidence does not prove current Cloud deployment. |
| Voice | Explicit local versus selected-agent/cloud route, recording review, transcription and playback, cancellation | Browser cannot qualify packaged Android speech. Six-second target, microphone/speaker/Bluetooth, semantic transcription accuracy and background interruption remain open. Earlier speech errors remain recorded. |
| Inbox | Cloud Gmail adapter, drafts, attachment handling and encrypted operation journal | Disconnected view is honest; live provider authorization and delivery remain open. Browser fixtures exercise drafts and account isolation without sending mail. |
| Calendar | CalendarProvider range fetch, selected source/revision, timed event create/edit/delete, external editor handoff, DST checks | Browser shows native capability boundary. Native recurrence/attendee edits retain system handoff. Provider sync, process recovery and actual cross-account behavior need native/service evidence. |
| Reminders/tasks | Durable native scheduling, Done/Snooze, recurrence, receipts and recovery | Do not claim background ringing from a browser timer. Confirm source CRUD/selection contracts; actual reboot/Doze/OEM delivery remains separate. |
| Clock/alarms | Reviewed native Clock set/show/snooze/dismiss handoff | Historical alarm tests are scoped evidence. Sound, vibration, DND, reboot/time-zone and physical audibility remain gates. |
| Browser | Alpha chrome, isolated Android page surface, tabs/history/bookmarks, file handoffs, reviewed page reading | Browser development can test chrome and adapter contracts, not the isolated Android renderer. Real vault/passkey/autofill qualification and maintained production WebView stability remain open. |
| Camera | Native photo/video capture; browser photo preview/capture through MediaDevices and canvas | Browser photos persist locally; browser video, scanning/OCR and analysis remain open. Tests use explicit synthetic streams and do not prove physical camera/permission behavior. |
| Photos | Native owned media, albums and edit-as-copy; browser-local capture library, favorites, trash/restore, confirmed deletion, JPEG download and rotate/crop/filter copies | Browser storage remains local and is removed by clearing site data. Custom albums, batch sharing, external libraries and large-catalog qualification remain open. Native provider and physical capture acceptance remain separate. |
| Maps | Regional provider, selected place/route context, location handling and saved places | Honest disconnected state. Production TLS/provider configuration, broader regions and physical navigation remain open; no global navigation claim. |
| Notes | Browser-local text store; encrypted native store, revision-bound actions, audio/documents and restart recovery | Real browser text import/download, create/edit/search/delete/reload and empty/search messaging are implemented and covered by browser tests. No synced Notes service is claimed. |
| Files | Native selected-document/folder access, persistence, previews/PDF and reviewed content boundaries | Browser has no Android SAF. Test selection/context contracts; provider differences and interrupted writes remain native gates. |
| Workflows/digests | Typed authoring, approval, cancellation, durable receipts/results, schedules and reconnect acknowledgements; canonical patch series | Test editor/HTTP contracts and error states. Real localhost scheduler/Cerebras evidence and isolated worker/compiler checks pass. Native scheduling, reconnect delivery, process/reboot recovery and resident background result delivery remain open. A powered-off device cannot execute locally. |
| Settings | Accounts, voice/agent choice, privacy, display, native permissions/notifications, device facts and digests | Audit all settings pages and actual readback; unsupported browser controls must be honest. Runtime location and hosted inference must remain clearly distinguished. |
| Phone/SMS/Contacts | Source retained; navigation and actions disabled by current MVP profile | Explicitly deferred. No telecom/role acceptance claimed. |
| Wallet/payments | Reference source retained; entry/action paths disabled | Explicitly deferred. No credentials, payment processing, attestation or success simulation in production. |

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
