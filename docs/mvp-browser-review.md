# MVP implementation and design review — October 1, 2026

October 1 architecture change: the user has selected an **Android-resident agent instead of Nitro/TEE hosting**. The [on-device agent plan](on-device-agent-plan.md) supersedes cloud-only and enclave-primary requirements below. Agent execution and model inference are separate decisions; inference placement remains pending. Historical evidence is retained. Powered-off-phone execution needs explicit scope reconciliation.

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

Additional local-runtime work remains: native token streaming is not exposed by the consumer bridge. A source audit found that the Android mobile bundler explicitly stubs `@elizaos/plugin-workflow` and its plugin collector excludes it. Thus the native bridge's workflow forwarding is implemented but the staged mobile payload cannot yet host these workflows. Removing the stub alone is insufficient: qualify the dependency closure, reviewed phone operations, persistence and lifecycle before claiming device workflow support. Native process execution and recovery remain unqualified. The historical remote-loop and enclave rows below are superseded for the primary executor by the on-device plan; they must not be counted as requirements to deploy Nitro. Local schedule catch-up and optional powered-off remote execution remain separate acceptance decisions.

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
| Remote morning/evening loops with phone off | Workflow authoring, schedules, result outbox and reconnect protocols exist; historical localhost scheduler/provider passes remain scoped. Concurrent runtime qualification is tracked in the current ledger. | Two actual remote scheduled occurrences with server-accessible grants while phone is off, host interruption recovery, and exactly-once reconnect/history evidence. |
| Enclave release, identity and rollback | Canonical patches and release/deployment records exist. Keep the vendor pin unchanged until reviewed current runtime qualification and signed release inputs are available. | Qualified Linux source/image, approved signing/KMS path, deployed source/measurement identity, auth negative cases and rollback. Browser health checks cannot close this. |
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
| Connection/account | Cloud enrollment/agent selection, owner-bound remote pairing, explicit local development, offline and mock modes; secure native credentials | Browser has no Android credential vault. Test controller/HTTP contracts with disclosed fixtures. Real Cloud callbacks, provisioning, Gmail grants, revocation and enclave admission require actual service configuration and provider acceptance. Never store production tokens in browser localStorage to bypass the vault. |
| Assistant | Pill/input/sheet/full layouts; retained view context, history, cancellation, reviewed device actions and receipts | Audit keyboard/focus/viewport continuity and disconnected errors. Existing local Cerebras history/receipt evidence does not prove current Cloud deployment. |
| Voice | Explicit local versus selected-agent/cloud route, recording review, transcription and playback, cancellation | Browser cannot qualify packaged Android speech. Six-second target, microphone/speaker/Bluetooth, semantic transcription accuracy and background interruption remain open. Earlier speech errors remain recorded. |
| Inbox | Cloud Gmail adapter, drafts, attachment handling and encrypted operation journal | Disconnected view is honest; live provider authorization and delivery remain open. Browser fixtures exercise drafts and account isolation without sending mail. |
| Calendar | CalendarProvider range fetch, selected source/revision, timed event create/edit/delete, external editor handoff, DST checks | Browser shows native capability boundary. Native recurrence/attendee edits retain system handoff. Provider sync, process recovery and actual cross-account behavior need native/service evidence. |
| Reminders/tasks | Durable native scheduling, Done/Snooze, recurrence, receipts and recovery | Do not claim background ringing from a browser timer. Confirm source CRUD/selection contracts; actual reboot/Doze/OEM delivery remains separate. |
| Clock/alarms | Reviewed native Clock set/show/snooze/dismiss handoff | Historical alarm tests are scoped evidence. Sound, vibration, DND, reboot/time-zone and physical audibility remain gates. |
| Browser | Alpha chrome, isolated Android page surface, tabs/history/bookmarks, file handoffs, reviewed page reading | Browser development can test chrome and adapter contracts, not the isolated Android renderer. Real vault/passkey/autofill qualification and maintained production WebView stability remain open. |
| Camera | Native photo/video capture and media permission paths | Browser currently reports unavailable; do not show camera fixtures as live input. Scan/OCR and broader content understanding are not completed. |
| Photos | Owned media list, albums, favorite/trash/restore, share, edit-as-copy/filter flows | Native tests retain exact-byte evidence. External libraries, interrupted writes, larger collections and physical capture remain open; advanced editing is outside core MVP priority. |
| Maps | Regional provider, selected place/route context, location handling and saved places | Honest disconnected state. Production TLS/provider configuration, broader regions and physical navigation remain open; no global navigation claim. |
| Notes | Browser-local text store; encrypted native store, revision-bound actions, audio/documents and restart recovery | Real browser text import/download, create/edit/search/delete/reload and empty/search messaging are implemented and covered by browser tests. No synced Notes service is claimed. |
| Files | Native selected-document/folder access, persistence, previews/PDF and reviewed content boundaries | Browser has no Android SAF. Test selection/context contracts; provider differences and interrupted writes remain native gates. |
| Workflows/digests | Typed authoring, approval, cancellation, durable receipts/results, schedules and reconnect acknowledgements; canonical patch series | Test editor/HTTP contracts and error states. Prior real scheduler/Cerebras localhost campaign is not remote powered-off-phone acceptance. Two remotely hosted loops, deployed source access and reconnect delivery remain open. |
| Settings | Accounts, voice/agent choice, privacy, display, native permissions/notifications, device facts and digests | Audit all settings pages and actual readback; unsupported browser controls must be honest. Enclave status must remain unverified absent admission evidence. |
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
| Cloud/enclave/provider integration | Unaccepted | Needs deployed configuration, actual account authorization and service evidence. |
| Speech/native/device/AOSP/user acceptance | Outside this browser execution pass | Keep open in current acceptance ledger; Android builds explicitly skipped. |

## Remaining product acceptance

The MVP is not accepted as complete. Beyond browser development, the remaining gates are: authenticated deployed Cloud journey; real Gmail/provider permissions; signed enclave deployment and source identity; two remotely hosted loops while the phone is powered off and exactly-once reconnect results; qualified password-provider integration; packaged speech correctness and measured latency; maintained production browser stability; native task/calendar lifecycle cases; signed device image/update/rollback; physical Pixel hardware and user acceptance. These cannot be closed with browser screenshots or mocked services.

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
