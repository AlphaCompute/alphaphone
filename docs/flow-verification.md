# Current checkpoint — Build57, 2026-09-30

Build57 passes `npm run verify`, Android lint and all four APK builds with matching before/after source fingerprints. Six app/test APKs are archived alongside the explicit debug regional Maps endpoint configuration.

- Both native capability/tile probes pass with real decoded regional PBF bytes. Both Maps UI flows fail before tile requests: Android URL parsing gives an empty hostname for the fixed custom-scheme tile URL, which the guard rejects. Controlled CDP diagnosis is archived; source correction requires another build.
- Both browser host-reload tests still fail the old-profile deletion assertion. Chromium retains loaded profile instances until process exit; immediate profile-scoped data purge and actual process-restart deletion are being implemented and must be independently proved.
- Both real external-calendar flows now pass cancellation and return/reopen but fail `ACTION_SET_TEXT` on a node observed during the transition to Edit. A fresh editable-node wait is pending validation. No completed external save claim.
- Build56 package inspection verified all four APK identities, provider-secret absence and debug-only synthetic autofill. Release Maps request code rejects without invoking the HTTP worker. This is static package evidence, not deployed/runtime acceptance.
- Build56 route screenshot files were adb error text. Their names and receipt flags have been corrected; no valid native route screenshot exists yet.

The following checkpoints retain earlier evidence and failures; the [current product status](mvp-current-status.md) is the current remaining-work inventory.

# Current checkpoint — Build55, 2026-09-30

Use the [current product status](mvp-current-status.md) for the remaining domain inventory. Builds53–55 passed required repository verification, Android lint and four APK builds, with archived app/test APKs and matching source fingerprints. This does not establish complete product acceptance.

- Build53 full smoke reported 58 methods per variant. Both failed only Google's traffic challenge; all other executed cases passed, including repeated native autofill. Both cold render checks and launcher HOME-role verification passed. Gated methods remain separate.
- Build54 passed real browser tab/history continuity and separate-process bookmark restoration/removal on both variants. No automatic website load occurred on restart.
- Build55 native updates ran seven actual tests per variant: browser continuity, all four native audio/dictation cases, and reminder capacity protection passed. Host-reload profile namespace rotation failed both; a listener-registration correction is pending another build. Keep these combined matrices marked failed.
- Build51's 15 real-agent context cases passed both variants. Build52 standalone added captured-video identity successfully; later provider failures were confirmed Cerebras TPM429. Build54 isolated-history setup failed before any model POST; a navigation-helper race was corrected. Build55 paced context verification passed all 16 actual responses on both variants, with exact wire context and Wallet zero outbound; original failures remain archived.
- External Etar editing is still not accepted. Verified official APK bytes/signature are installed; actual chooser and optional contacts permission paths exposed successive test-control issues. Build55 standalone reached cancel/return but failed native Back injection; launcher was blocked by the alternate contacts denial button. Corrections await another build.
- Rendered fixture checks pass rate-limit display/explicit retry/no automatic replay and bookmark hydration retry/concurrency. Actual regional OSM tiles/search/routes are verified in a desktop browser; Android maps transport remains in progress. None of these fixture/desktop checks proves Cloud, enclave or physical-device acceptance.

Historical checkpoints follow with their original scope and failures.

# Build 45 checkpoint — 2026-09-30

The [current product status](mvp-current-status.md) is the complete domain inventory. The product and full native matrix remain **not accepted**. Results apply to archived APKs; Build46 source changes have not yet been executed at this checkpoint.

- Required repository verification, Android lint and all four APK builds passed. Exact app/test APKs, build logs, manifest and matching input fingerprints are archived in `test-results/prototype-build45/`.
- Full smoke reported 54 cases and three failures per variant. Both failed Google search because it reached `/sorry/index`, and the connection chooser inert-state assertion returned null. Standalone also returned null for composer-above-keyboard geometry; launcher timed out navigating to Messages in the all-app lifecycle flow. These remain terminal failed suites in `test-results/prototype-build45/full-smoke/`, even though subsequent source/test repairs are prepared. Reported counts do not imply every gated live test executed.
- Both variants passed the fresh rendered/resumed Home checks; the launcher HOME-role check passed. Standalone was not assigned HOME. Emulator shell/HOME evidence does not prove a full AOSP image or physical Pixel acceptance.
- Focused native updates passed both variants: actual Android synthetic-provider autofill/host exclusion/overlay cancellation/cleartext refusal (one flow each), plus all five CalendarProvider flows (create/edit/recreation, UTC all-day handling, DST-gap refusal, exact repeated-hour endpoints with edit handoff, and overnight/multi-day clipped touch segments). Evidence: `test-results/prototype-build45/native-updates/`. No real Proton vault/passkey or Cloud provider acceptance follows from synthetic autofill.
- Build44 reminder recovery passed both variants: revoked notification permission is visible, explicit retry reschedules, an actual changed boot ID is recorded, and an external observer sees scheduled→posted with a real notification after reboot without restarting app instrumentation or assigning HOME. Evidence: `test-results/prototype-build44/reminder-standalone/` and `reminder-launcher/`. This replaces the failed Build43 harness result only for the named Build44 test.
- Visual comparisons must record decoded assets, source identities, dimensions, fixed masks and capture failures. See [visual verification](prototype-visual-verification.md). Presentation-fixture comparisons do not establish native integration acceptance.
- Build46 adds native Downloads/document-tree work and full-suite test repairs. Compilation, both-variant execution and final regression results are pending. Latest enclave candidate signing/PCR admission, live Cloud/Gmail/voice, full AOSP boot and physical-device acceptance remain open.

---

# Build 42 checkpoint — 2026-09-30

- Required repository verify, Android lint and all four APKs passed; matching before/after input fingerprints are archived with app/test APKs. The first compile failure (hidden UserHandle API in the autofill test) remains archived separately.
- Both variants passed the full actual Cerebras-proposal → explicit approval → note/reminder/Settings/HTTPS browser → recreation → encrypted terminal receipt test. This validates the local patched runtime only, not Cloud or enclave.
- Both variants passed all video byte-range/header/playback/finalization assertions, real photo capture/share and native browser picker/upload/cancellation.
- Both new offline Notes UI runs exposed the same native crash: a secureRead bridge callback queued during Activity teardown submitted to a terminated worker. Guarded rejection is implemented for the next build; no passing offline Notes claim yet.
- Autofill tests both stopped before provider mutation because Android persisted an empty disabled-provider value. The test incorrectly accepted only missing/null or a component. Exact empty-value restoration is being corrected; actual framework fill remains unverified.

---

# Current verification checkpoint — build 41, 2026-09-30

The complete, actively maintained domain inventory is [current product status](mvp-current-status.md). The product remains incomplete. Results below describe exact archived builds, not subsequent source changes.

- Build41 repository verification, Android lint and all four APKs passed with matching before/after input fingerprints.
- Build40 both variants passed selected-document replacement, restoration/forget, provider-aware rename and real two-page PDF rendering/malformed rejection; saved Maps places and own-app notifications also passed. Build39 separately passed document grants across genuine process restart and revoked-grant refusal.
- Build41 both variants passed foreground location using continuing injected emulator GPS, accuracy display, native watch release and no implicit restart. This is neither a map provider nor physical GPS acceptance.
- Build41 media: photo and browser upload/cancellation passed both variants. Video returned exact range bytes but duplicate Content-Length failed the complete playback test; native response-header correction awaits a rebuilt APK. Standalone audio passed; launcher playing-state assertion failed. A cleanup-ownership fix and native playback-start receipt assertions await rebuild.
- Build39 both variants passed real Cerebras-approved note, native reminder and Settings navigation, including recreation. Expanded Build41 browser action reached its exact URL and isolated native page, but expected text had moved into the external page title; assertion correction awaits rebuild. Launcher failed private pairing setup before instrumentation. Neither expanded run is a pass.
- New Notes recording without Cloud uses native capture, manual transcript review and durable audio saving. Browser flow fixtures pass; its new complete native UI test is pending.
- Unsigned enclave candidate is packaged, checksummed and measured; signing and attestation admission remain unresolved. Existing enclaves were not replaced. See [enclave report](enclave-candidate-validation.md).
- Cloud infrastructure/auth source findings are in [Cloud report](cloud-production-validation.md). Live account credits, authorization, agent reuse/provisioning, Gmail and voice are not verified.
- Current emulator uses a headless software-rendered Pixel-class AVD following a host-GPU stall. Computer Use still reports the Mac locked. Automated results do not establish visible manual or physical-device acceptance.

---

# Historical verification checkpoint — build 28, 2026-09-29

- Build 28: required repository verification and all four APK builds passed. Scoped calendar edit/conflict plus encrypted credential/native HTTP lifecycle instrumentation passed on launcher (2 tests). Standalone failed both cases during WebView startup: one JavaScript callback timeout and one main-thread dispatch timeout. Chromium renderer exits were logged around teardown; cause is not established. The launcher result verifies the corrected collection-URI calendar update path, including conflicting external edits. Evidence: `test-results/prototype-build28/connection/`.
- Build 27: compilation failed on an interim `AtomicFile.exists()` call in the new connection plugin; current code uses `openRead()`/base-file checks. Build 26 built successfully but both calendar edit cases failed because Android rejects a selection on the item-specific event URI. These failures remain recorded.
- Live provider and host evidence: Cerebras `qwen-3.8-27b` answered the arithmetic probe. The pinned Eliza development transport passed approval-gated note/reminder-proposal and selected-context host checks. A separate real Eliza app host from the existing milady checkout passed machine-session pairing, conversation creation, arithmetic chat and persisted history. None establishes Cloud login, enclave release identity, Android connection UI or voice acceptance.
- Current implementation is ahead of build 28: startup/Settings connection chooser, explicit mock mode, native Cloud capture/STT/TTS, account-switch cancellation and local app-host phone tests have been added. Build 29 is in progress. Later source refinements require a fresh build before device acceptance. No Cloud credit/account mutation or enclave deployment has been made.


- Build 25: required verification and all four APK builds passed. Both variants passed the new Settings E2E test: real battery service values, correct Android battery settings handoff, refresh after return, and real device model/build in About. Battery fixtures were reset and read back at the emulator’s original 100%. The full standalone suite reported 28 tests with two failures (Google traffic challenge and a main-thread timeout opening Browser in the all-app lifecycle case); launcher reported 28 tests with Google only. Other enabled cases passed, including Settings and sharing. Four opt-in cases skipped per variant. Fresh Home rendering and launcher HOME role passed. The isolated lifecycle rerun passed once in each variant; the four-case connected real-agent/camera-permission matrix also passed in each variant. These reruns do not erase the full-suite failure or establish its cause.
- Build 24: both full variants reported 27 tests with one failure each, Google’s traffic challenge. All other enabled cases passed, including real separate-UID share reading, share cancellation, camera recreation and second-document selection; four opt-in cases skipped per variant. Both fresh Home rendering and launcher HOME role passed.
- Build 23: standalone reported three failures (Google search, camera recreation, second-document preview); launcher reported Google search only. Those failures remain preserved separately and are not rewritten as passes.
- Current manual verification: after restarting only the Pixel emulator, Computer Use pointer input recovered. Battery → Android Battery Saver → return, real About information, and captured photo → Android share chooser → cancel → same photo were observed. In-app Back sometimes leaves the prior screen visible; touch-based regression passed in both variants, but the manual delay remains unexplained. These observations cover only these flows.


- Build 22: required repository verification and all four APK builds passed. Both full device variants completed with one failure each: Google search returned its `/sorry/index` traffic challenge, not search results. All other enabled cases passed; the four opt-in cases subsequently passed in each variant. The HTTP document/retry-link, loading completion, HTTPS history/isolation, camera, calendar, files and Home checks passed. The suite status remains failed because search acceptance is unresolved.
- Build 21 full matrix finished with failures: standalone had two (completed-page loading/secure-indicator state and real Google search), launcher had one (Google search). Both passed the new HTTP 503 document/retry-link case, fresh Home rendering and launcher HOME-role checks. Artifacts are preserved separately in `test-results/prototype-build21/full-smoke/`. A failed external search is not waived into a passing suite.

- Target: Pixel 10 or comparable **phone**; current AVD uses the available Pixel 9 profile, API 35 AOSP ARM64. The unrelated tablet emulator is not part of acceptance.
- Build 20: required repository verification and all four Android APKs passed. Current hashes/logs are archived in `test-results/prototype-build20/`.
- Build 20 focused standalone: three E2E tests passed (controlled browser stall/stop/reload, camera/agent/photo return, and selected-file/agent return). Real Eliza host integration also passed selected ID/revision propagation and malformed-selection rejection, plus exact note/reminder proposal checks.
- Build 20 full runs on host GPU and software rendering were incomplete due to Android graphics-pipe ANRs. Software rendering did not resolve the issue. Traces and partial results are preserved, not counted as passes.
- After reinstalling the test packages and explicitly bringing the host-GLES/no-Vulkan phone window forward, the assistant startup/close suite passed in 1.096 seconds. The full matrix then passed: standalone 26 reported tests in 80.958s and launcher 26 in 73.859s, with four opt-in assumption skips each. Fresh Home rendering and launcher HOME role passed. Evidence: `test-results/prototype-build20/full-smoke-visible/`.
- Build 20 opt-in matrix: standalone and launcher each passed four real-agent/camera-permission cases against the updated Eliza development backend.
- Earlier baseline: build 18 also passed both variants, with four opt-in assumption skips per variant. Build 18 launcher opt-in real-agent/permission suite also passed four tests. These results do not qualify later changes automatically.
- Visual fixture baseline: 136 pairs, matching dimensions, 104 with zero thresholded interior difference, maximum 0.0134%; reference font-request failures and fixed masks qualify this evidence. It is not all-flow acceptance.
- Still open: production pairing/providers, real mailbox/account flows, full workflows, password fill/passkeys, camera video/OCR/analysis, actual captured-speech transcription on the emulator, full product AOSP boot and physical-device/user acceptance.

Detailed results below are chronological. Earlier “pending” and “current” wording applies only to its named historical build.

---

# Build 11 checkpoint — historical

- Build 11: `npm run verify` and `npm run android:build` passed. Both standalone/launcher debug and unsigned release APKs are recorded in `test-results/prototype-build11/manifest.json`. These build results do not establish runtime acceptance.
- Build 10 standalone full instrumentation: 22 tests, 3 failures. Browser HTTPS/history/tab isolation, camera JPEG capture/readback/viewer, contacts provider write/readback, reminders, and document selection passed their cases. The three failures were lifecycle/WebView timeouts in FlowInstrumentedTest and PrototypeFlowInstrumentedTest. The Mac locked during the later run and the emulator subsequently stalled on ordinary shell/activity commands; causation is not proven. No passing launcher run is claimed for this checkpoint.
- Full deterministic visual comparison: 136 pairs, matching dimensions, 104 pairs with zero thresholded interior difference, maximum changed-pixel percentage 0.0134. Fixed masks and the reference font-request failure remain documented in `prototype-visual-verification.md`.
- Restarted real Eliza text backend: host note/reminder proposal contract, authentication, duplicate and sensitive-context rejection passed after disabling unsupported embedding handlers. This is not Android live-agent acceptance.
- Build 11 source adds browser selected-tab/document revision context, deduplicates native browser hide calls, preserves last-known reminders on failed refresh, rejects stale refresh results, and keeps presentation status out of edited reminder bodies. Device retesting is pending.

The Pixel-class emulator is being restarted without a data wipe using SwiftShader to isolate the host graphics/runtime stalls. Full AOSP boot, physical Pixel acceptance, production identity/providers, and all-flow completion remain open.

---

# Flow verification evidence

Evidence snapshot: 2026-09-29. This report records observed results, not completion inferred from source. The target is a **Pixel 10 or comparable phone**. Current emulator: `alpha_flow_pixel_20260929`, Pixel 9 profile, API 35 AOSP ARM64, 1080 × 2424 at 420 dpi. Pixel 10 hardware, the full product AOSP image and production services remain unverified. Earlier tablet work is historical and does not qualify the phone target.

## Early prototype migration acceptance status — historical

The exact-reference renderer has replaced the older application below. Its visual evidence is in [prototype visual verification](prototype-visual-verification.md). The 68 presets in both themes were captured; the fixed-clock follow-up removes animation timing differences. This is visual fixture coverage, not live integration acceptance.

`/tmp/alphaphone-prototype-verify6.log` and `/tmp/alphaphone-prototype-build6.log` record successful required verification and all four APK builds, including the new camera and contacts modules. Build 6 still inherited the obsolete CAMERA permission removal, discovered after the build; it is not camera-ready. Permission-policy and subsequent source changes require another build.

The first prototype instrumentation run (`/tmp/alpha-prototype-native-first.log`) ran three tests: note create/edit/recreate/delete/undo passed; the live prompt test failed because multiline text was supplied to a single-line field; the physical Back test lost its WebView callback. The prompt and Back synchronization were corrected. The next live run (`/tmp/alpha-prototype-live5.log`) was terminated after stalling. Its captured stack (`/tmp/alpha-stall-trace.txt`) places it at line 70, after the actual model proposal, no-write-before-approval, explicit approval and exact saved-body assertions, waiting in `Instrumentation.waitForIdleSync` during navigation. This is partial evidence, not a passing end-to-end run. The final `Process crashed` status followed the diagnostic force-stop. Tests now use bounded main-thread dispatch instead of this unbounded idle wait; rerun is pending.

The phone emulator subsequently displayed an Android system-process ANR. It was restarted with 4 GiB guest RAM instead of 2 GiB, without wiping user data. This does not establish that all stalls were resource-related. Current native camera, contacts, reminders, selection, voice and both distribution variants still require fresh test results on the current source.

## Historical pre-prototype acceptance status

**NOT PASS: phone smoke 2 (voice2 artifacts).** `../test-results/android/standalone-instrumentation.txt` (historical generated evidence) and `/tmp/alphaphone-phone-smoke2.log` report `Tests run: 12, Failures: 1`. The sole failure is `ShellInstrumentedTest.bundledRendererAndNativeBridgesWork`: “Native installed-app handoff must open Settings” at line 74. Subsequent assistant/source changes are not included in this tested build.

The previous smoke failed earlier at reminder scheduling (`scheduled` expected, `failed` returned). That failure is superseded for this build: all five `DailyAppsInstrumentedTest` cases now pass, including real notification posting and tap-to-exact-reminder focus. The actual MediaStore/DocumentsUI file-selection regression also passes, as does debug native microphone capture and private-draft discard. These are individual passing flows within a still-failing suite.

The smoke script stops on standalone failure, so this run does not establish launcher instrumentation, fresh-launch rendered HOME or HOME-role acceptance. There is no successful `test-results/android/result.json` in this snapshot. `../test-results/android/failure-activity.txt` (historical generated evidence) and `../test-results/android/failure-crashes.txt` (historical generated evidence) are retained. The normal smoke run skipped gated live-model cases. A subsequent explicitly enabled standalone live-model run passed as recorded below; it does not repair the Settings smoke failure or qualify the launcher.

| Boundary | Observed result | Evidence and limit |
| --- | --- | --- |
| Android distribution artifacts | Four variants recorded: standalone/launcher × debug/release-unsigned; package, launcher/HOME flags, debuggable and bundled web payload inspected | [APK manifest](../artifacts/apk-manifest.json) recorded voice2 at `2026-09-29T21:58:35.793Z`; the path may be overwritten by later builds. The preserved hashes below identify that build; later source edits/rebuilds require separate acceptance. Release outputs are unsigned, not production-signed releases. |
| Release debug boundary | Debug classes/network resource present only in debug artifacts; absent from release artifacts; release cleartext/debuggable checks false | `../test-results/release-boundary.json` (historical generated evidence), covers the preceding build (standalone debug `65576942…`, launcher debug `273bd84e…`), not the voice2 hashes below. Recheck on the new build; APK inspection does not prove deployed security. |
| Phone standalone smoke | **FAIL** at Settings native handoff | 12 tests, one failure; live-model cases gated/skipped. |
| Reminder notification and tap | **PASS in smoke 2 standalone** | Real scheduling, notification, tap/context and exact reminder focus regression passed. Launcher and broader reboot/device delivery remain separate. |
| Actual document selection | **PASS in smoke 2 standalone** | Real MediaStore fixtures selected through DocumentsUI; read A, select B, stale A preview/copy absent, read B, clear selection. |
| Debug microphone capture/discard | **PASS in smoke 2 standalone** | Native recording creates and discards a private audio draft. This does not prove captured speech transcription or production ASR. |
| Phone launcher/HOME smoke | **NOT VERIFIED by this run** | Standalone failure halted the distribution loop. |
| Android real Eliza note flow | **PASS on installed voice2 standalone** | `../test-results/phone-manual/live-eliza-first.json` (historical generated evidence) and `../test-results/phone-manual/live-eliza-first.txt` (historical generated evidence): `OK (1 test)`, 5.785 seconds. Request → real Eliza model proposal → visible exact body → explicit approval → saved note body → Activity recreation/persistence passed. Installed APK SHA-256 `fbaf3ea8d8cac2764688215f92210bd389eaa4debac7f7a42915b4dba264e197`. This is development transport/authentication, not production authentication, launcher coverage or later app-selector/assistant changes. |
| Real model and approval | **PASS at host HTTP boundary only** | `../test-results/development-agent.json` (historical generated evidence), `21:53:34.470Z`, model `qwen-3.8-27b`: unauthenticated 401; health/chat 200; proposal received; no write before approval; explicitly approved temporary host note verified; duplicate 409; sensitive input 400. Not Android execution or production identity. |
| Actual transcription engine | **PASS at host helper boundary only** | `../test-results/local-asr.json` (historical generated evidence), `21:53:08.110Z`: whisper.cpp transcribed “Please remember to water the plants tomorrow morning.” exactly from a 2.645125-second test recording. Not phone microphone capture. |
| ASR HTTP transport | **PASS at host loopback boundary only** | `../test-results/local-asr-http.json` (historical generated evidence), `21:53:37.197Z`: real transcript, HTTP 200, unauthorized 401, duplicate 409, invalid audio 422. No Android microphone/provider acceptance implied. |
| Native companion installation | **PASS for installation only** | `../artifacts/native-apps/phone-install-results.json` (historical generated evidence): hash-rechecked Organic Maps, Thunderbird, Proton Pass and development Chromium installed successfully. Accounts, credentials and agent bridges are separate. |
| Launcher AOSP admission | Historical local staging checks passed | `../test-results/aosp-admission.json` (historical generated evidence), `19:29:41.959Z`: launcher admitted, standalone and unsigned input rejected. Not an image build/boot. |
| Native companion AOSP staging | Three actual pinned APKs validated and staged | [Distribution report](native-app-distribution.md): hash/package/version/signer validation, nonprivileged presigned imports; existing-output and bad-hash rejection checked. No Soong build or image boot. |
| Hosted CI | Historical success records only | Saved runs `36619646338` at `0867c05d647a49ac0a66457f3483050c9ceb1d92`, and `36620911360` at `799929863e5df1f26cf4731fa93edeb594cdd139`. Neither is evidence for subsequent working-tree changes. Live CI has not been refreshed for this report. |

Recorded APK SHA-256 values for voice2, independently rehashed at the smoke2 update. These identify the tested build; newer files at the same artifact paths must not be substituted as evidence for this run. The subsequent live-model result used the installed voice2 standalone debug APK, while the final phone app-selector/assistant build and its rerun remain pending:

```text
standalone-debug             fbaf3ea8d8cac2764688215f92210bd389eaa4debac7f7a42915b4dba264e197
standalone-release-unsigned  9fe855c5f337a6592d0a9fa6019ca2b32e8c4a1a8e7e5a4a0893805e483bf7ce
launcher-debug               7eae97a025f3d310c3287897ba180f02caf4dfcc3e909dacb4425f77bc1ae634
launcher-release-unsigned    3a4767985bebb0d773b18a9312f769bc59345c5aa056d340a8516cc4166cdea6
```

## Manual phone computer-use observations

The parent agent reported these observations from CUA interaction with the native emulator window. They are scoped to the actions below, not all screens in the related apps.

- **Browser default:** Chromium selected as default through Android Settings. This is the official development snapshot described in the distribution report, not the owned production Chromium build or agent bridge. Default selection alone does not prove page navigation, autofill or agent observation.
- **Maps:** Alpha query `Park` opened Organic Maps first launch. Location permission was denied. World overview data, approximately 70 MB, was downloaded; the resulting search showed the exact query `Park`. Returning via Android Home and the app drawer preserved Alpha's `Park` query. `../test-results/phone-manual/maps-search-location-denied.png` (historical generated evidence). This establishes that particular launch/search/denial/return flow; routing, precise location, downloaded regional maps and offline route acceptance remain open.
- **Camera:** Native camera opened its initial location-tag prompt, and location tags were switched off. **Capture not yet verified**: no claim of shutter capture, returned photo, preview or save acceptance.

## Remaining checks before broad acceptance

1. Diagnose Settings native handoff and rerun both standalone and launcher/HOME phone smoke on rebuilt current source, retaining the now-passing reminder regression.
2. Retain the now-passing selected-document and native recording/discard regressions in the current-source rerun and qualify them in the launcher variant.
3. Exercise phone microphone capture through transcription/confirmation; repeat the now-passing real Eliza proposal/approval/persisted-note flow on the final app-selector/assistant build and launcher variant. Production identity/authentication remains separate from this development integration.
4. Finish camera capture/return, photo selection, file persistence, note editing/draft recovery, schedule/provider handoffs, settings denial/recovery and accessibility/keyboard/back-stack flows against the [PRD](flow-audit-and-prd.md) and [implementation matrix](flow-implementation-plan.md).
5. Authenticate only operator-provided test mail/calendar/vault accounts for live integration acceptance; independently qualify owned Chromium, agent identity, revocation, updates, full AOSP build/boot and physical Pixel 10 behavior. Unavailable providers and missing production integrations remain explicit blockers, not passing fallbacks.

Update this ledger when new evidence arrives. Preserve failed-run context and identify the replacing artifact hashes and phone target instead of retroactively treating the failed run as a pass.

## Build 11 manual voice investigation

The SwiftShader Pixel emulator booted and accepted both APK installs. Android System UI raised an ANR after boot; selecting Wait recovered it. Computer Use opened Notes and the exact prototype recorder, started native capture, observed the microphone indicator/timer, stopped capture, and explicitly requested local transcription. The first authenticated gRPC microphone injection returned success, but the app received `[BLANK_AUDIO]`, so speech capture/transcription acceptance failed and no note was saved. A second injection attempt failed and the emulator process subsequently exited; the cause has not been established. Do not equate successful injection RPC with captured speech.

The host ASR helper now rejects all-zero decoded PCM and silence markers. A real synthesized-speech plus silent-WAV regression passed: the phrase was transcribed correctly and silence was rejected. Evidence: `test-results/local-asr.json`; these checks do not prove Android microphone input. The running backend predates this last ASR fix and must be restarted before repeating the HTTP/device flow.

### Calendar provider work and build 11 investigation

A native CalendarProvider adapter and real provider-backed form E2E test have been added; see `prototype-calendar-integration.md`. They are not included in build 11. Build 11's running standalone suite has failed root Back (still RESUMED after the assertion deadline) and file-picker cancellation (no result). Browser, camera capture, contact creation, reminder notification/tap, reminder form and development microphone draft checks reached their successful terminal test events. This is partial evidence, not a suite pass. Test cleanup now preserves the original failure as primary instead of masking it with a second WebView timeout.

The visible emulator audio-injection crash has a concrete native stack in the macOS diagnostic report: `audio_forwarder_enable` → `QemuAudioInputEngine::start` → `QemuAudioInputStream` → `EmulatorControllerImpl::injectAudio`. Injecting before an active recorder crashed the emulator; this does not establish a product recorder failure. The earlier active-recording injection returned successfully but produced `[BLANK_AUDIO]`, so the full captured-speech flow remains unverified. Local ASR now rejects zero PCM and non-speech marker output. Spoken-file and silence regression checks passed after this fix, as did the host HTTP ASR test; host results do not prove emulator microphone capture.

Build 11 was subsequently stopped after `dumpsys input` proved that the focused window was `Application Not Responding: com.android.systemui`. The input snapshot, crash buffer and TestRunner events are saved under `test-results/prototype-build11`. Root Back/file-picker failures from this run cannot distinguish product behavior from input intercepted by that dialog. The suite did not finish; launcher was not reached. The next run uses a visible Pixel emulator with host GPU rendering instead of headless SwiftShader, and includes debug-only Back dispatch/renderer-result logging.

### Build 12 focused results and reminder race

Both debug/release variants built successfully and repository verification passed. On the visible host-rendered Pixel, `calendarFormPersistsOneRealEventAcrossRecreation` passed its real CalendarProvider and recreation assertions. Root Back also passed with debug logging proving native dispatch and the renderer's unhandled-root result. The notification test then found a real refresh race: a later calendar/resume refresh could supersede the notification-triggered reminder fetch and drop its requested detail navigation. The adapter now retains the pending reminder ID until the latest successful fetch consumes it; build 13 must validate this change. Host GPU rendering showed blank native surfaces despite live DOM tests, so this configuration is not visual acceptance.

The revised HTTP ASR test also explicitly posts silent WAV audio through the authenticated endpoint and verifies HTTP 422. Report: `test-results/local-asr-http.json` (`silenceHttpStatus: 422`).

Build 12's focused run ended with 7 tests / 2 failures: reminder notification detail navigation, and file-picker cancellation. Calendar create/recreate, root Back, invalid-target validation, capability inventory, and reminder form create/delete passed. The failed picker run had `Application Not Responding: com.android.documentsui` holding focus (saved in `test-results/prototype-build12/input-at-picker-anr.txt`). Build 13 contains the reminder-navigation race fix and clears cached calendar rows after permission denial/revocation. Its required repository verification and four APK builds passed; device results remain separate.

Renderer troubleshooting continued after build 13: `swangle` drew the initial native launcher but startup produced another System UI ANR; the product later remained blank. No build-13 device pass is claimed from it. The next configuration disables Vulkan while using host GLES, following Android's documented Chromium rendering workaround: https://developer.android.google.cn/studio/run/emulator-troubleshooting?hl=en . This is emulator configuration only, not a production rendering workaround.

### Build 13 visible Pixel calendar check

With `-gpu host -feature -Vulkan`, the prototype home screen and Calendar became visible. Computer Use opened Calendar, opened New event, entered `Qazx` using the actual Android on-screen keyboard, explicitly saved to On this phone, observed “Event saved and verified in Android Calendar”, scrolled to the 8–9 PM event and opened its detail. The displayed date, time, title and local calendar matched. `manual-calendar-detail.png` records the final screen in `test-results/prototype-build13`. Host keyboard text injection did not enter text in this emulator; on-screen typing did. This manual check covers local event create/read/detail, not native editor deletion, account sync, invitations, recurrence or agent mutation. The focused automated calendar/navigation suite is now rerunning on the same configuration.

The manual event was independently read from CalendarProvider: ID 2, title `Qazx`, start 1790726400000, end 1790730000000. Cleanup constrained deletion by all of ID, title and start time; a follow-up active-record query returned no result. The first build-13 instrumentation invocation lacked the installed test package after emulator restart and did not execute tests. The test APK was reinstalled and the actual focused run started at 19:10:50 local time.

Build 13 focused standalone run completed successfully: `OK (7 tests)` in 68.335 seconds, including real calendar creation/recreation, reminder notification/detail, root Back, invalid-target rejection, native capability inventory, reminder create/delete, and Android file-picker cancellation. Exact output is `test-results/prototype-build13/calendar-navigation-standalone.txt`. This confirms the pending-reminder navigation fix in this run and resolves the earlier file-picker failure under the no-Vulkan configuration. The complete standalone/launcher smoke run is now in progress; this focused pass does not stand in for it.

Build 13 complete standalone instrumentation passed: `OK (23 tests)` in 213.325 seconds. Four opt-in cases (three live-agent cases and camera denial) were skipped by assumptions; this output does not establish those paths. The subsequent fresh-launch accessibility gate failed because it searched for visible placeholder text `Ask Alpha`, while the real Android hierarchy names that control `Open conversation`. The hierarchy contains the expected app buttons and `Open conversation`; the test now requires that actual accessible name plus Calendar, Camera, Notes and Settings. This failure prevented the script from reaching launcher. Archived evidence is in `test-results/prototype-build13`; build 14 will rerun both variants with the corrected gate and the browser/calendar follow-ups.

### Build 14 result and build 15 follow-up

Repository verification and all four APK builds passed. The Pixel standalone run passed the revised calendar create → automatic saved-detail → recreate/readback flow, camera capture/readable-image/viewer, contacts create/readback/recreation and root Back. It failed the first browser navigation callback, actual DuckDuckGo search connectivity, reminder cancellation callback and a later startup callback. DuckDuckGo connection timeouts were independently reproduced on the Mac; Google Search and example.com returned HTTP 200. The next build uses Google as its explicit-submit search default, with no automatic provider fallback.

The run was stopped after repeated unrelated WebView callback timeouts, during the native capability-inventory case; it did not complete and did not reach launcher. At this time the host load average exceeded 200, and Android recorded long frame durations. These observations do not prove every timeout was environmental. Exact test events, instrumentation output, graphics/input diagnostics and smoke output are archived in `test-results/prototype-build14`. The Pixel emulator was shut down for a fresh start before the next test pass; the other task's emulator was not modified.

Build 15 additionally changes the shell's accessibility visibility/focus handling, replaces the inherited launch icon with the prototype alpha mark, and makes Home's calendar card use real upcoming provider events/reminders. The local browser accessibility tree was manually checked through Home → Notes → conversation → Notes: hidden Home/Notes/chat controls were absent at the corresponding steps. A device accessibility/focus flow is added, but has not yet executed. Debug diagnostics now distinguish a main-thread dispatch timeout from a WebView JavaScript callback timeout and record native browser network error codes without URLs. All of these changes still require the next APK/device run; source and local-preview evidence are not emulator acceptance.

Build 15 built both variants and passed repository verification. Its fresh-Pixel focused run finished with 4 tests / 2 failures: CalendarProvider creation/recreation and shell accessibility/focus passed; both public-browser tests failed to load a remote document. Read-only inspection found the remote document remained `about:blank` while a navigation URL was pending. Android's own Internet panel reported `Connected / No internet access`, and a shell DNS lookup of example.com failed with `unknown host`. The Mac's configured first resolver was link-local IPv6; the next emulator launch explicitly selects the same host's IPv4 DNS resolver using the SDK's documented `-dns-server` option. This network repair is not yet verified.

The inspection also found a product issue independent of DNS: a pending navigation could show the lock because `loading` had not been set before network callbacks. Build 16 adds explicit pending/committed state and requires a committed HTTPS page before displaying the lock. A real `.invalid` navigation followed by a valid HTTPS page checks that transition. The full suite and launcher variant remain pending.

### Build 16 focused result and saved-photo follow-up

Repository verification and all four APK builds passed. After the Pixel emulator's cellular network became available, example.com resolved and replied from Android. The focused standalone suite then passed all four tests in 33.05 seconds: HTTPS navigation/tab isolation, real Google search, calendar create/recreation and shell accessibility/focus. The browser case includes the failed `.invalid` navigation without a secure-connection lock followed by a committed HTTPS document with the lock. Evidence: `test-results/prototype-build16/focused-standalone.txt`. The complete two-variant smoke run is still pending at this entry.

The next source revision adds an app-owned MediaStore photo catalog, with 24-row pages, bounded thumbnails and an on-demand preview. It does not request broad photo-library permission. The camera flow test now recreates the Activity, opens Photos and reads the saved capture again. Agent context carries the selected saved photo's identity/revision, not its pixels. This follow-up is not included in build 16 and has not yet passed Android build/device verification.

Build 16 complete smoke passed both standalone and launcher, including fresh-launch accessibility checks and launcher HOME role selection/restoration. Standalone reported `OK (25 tests)` in 122.402 seconds; launcher reported `OK (25 tests)` with no failures. Four opt-in cases per variant were skipped by assumptions (three live-agent cases and camera permission denial), so they are not established by this run. Full artifacts are archived in `test-results/prototype-build16/full-smoke`. Build 17 then passed repository verification and all four APK builds; its new photo-persistence and live-agent checks are running separately.

Build 17 focused standalone run passed `OK (4 tests)` in 52.898 seconds: actual CameraX capture/MediaStore readback followed by Activity recreation and reopening the saved photo; real Eliza reminder proposal/explicit approval/native schedule; and two real Eliza note proposal/approval/persistence flows. The separate revoked-camera-permission fixture passed `OK (1 test)` in 20.197 seconds, covering deny → explicit shutter retry → grant → actual preview. Evidence is in `test-results/prototype-build17`. Full two-variant smoke for this source remains pending.

Build 17 Computer Use checks: the native app drawer shows the corrected lowercase alpha icon. On the Pixel emulator, Camera displayed actual emulator-camera pixels; tapping the shutter produced the native save confirmation, and the last-photo control opened the real 1024 × 1856 image. After Home, a controlled `am force-stop` ended PID 4550 (no remaining PID); launching from the Android app drawer created PID 4756. Photos reloaded its two real owned images and the newest opened successfully in the viewer. The new manual capture is MediaStore ID 1000000040, 30,516 JPEG bytes; provider metadata and the post-restart hash are saved alongside screenshots in `test-results/prototype-build17`. This verifies an actual process restart, not only Activity recreation. It does not qualify physical camera optics or large-library pagination. The host was heavily loaded (load average about 190) and visible transitions were slow; no production latency acceptance is claimed. Full two-variant build-17 smoke is now running.

The build-17 full smoke was deliberately stopped after both browser cases passed, while the calendar test was running, to move regression testing to the newer camera correction. Its terminal `Process crashed` message comes from the controlled `am force-stop`; it is not evidence of a spontaneous product crash. The run is incomplete and did not reach launcher. Evidence is archived under `test-results/prototype-build17/incomplete-smoke` and `test-events-before-supersession.txt`.

Source review during the manual check found that the pinned camera plugin independently scales supplied width and height. The previous width-only 1024 request kept the sensor height and could stretch the saved image. Build 18 omits both size overrides, preserving original oriented dimensions; AlphaPhotos still produces bounded previews. Repository verification passed; APK/device results for this correction are pending.

### Build 18 complete native regression

Repository verification and all four APK builds passed. The Pixel AVD was restarted with `-camera-front emulated` in addition to the working host GLES/no-Vulkan/DNS configuration; this supplies an emulated front camera without opening the Mac webcam. Android boot completed, SIM reached LOADED, and example.com resolved/replied before instrumentation.

The full two-variant smoke passed: standalone `OK (25 tests)` in 110.452 seconds; launcher `OK (25 tests)` in 135.908 seconds. Each includes real capture → MediaStore readback → recreated Photos viewer. Four opt-in cases per variant remain excluded from this ordinary suite by assumptions. The launcher HOME role, foreground state and fresh accessible screen checks passed, with original HOME restored. One hierarchy acquisition reported a null root and the bounded retry recovered; the final saved hierarchy met all required markers. Reports, screenshots and result JSON are in `test-results/prototype-build18/full-smoke`; APK hashes are in its parent `manifest.json`. A separate launcher run is covering real-agent approval and camera denial/retry.

Build 18 launcher opt-in suite passed `OK (4 tests)` in 48.083 seconds: camera permission denial/retry and all three real Eliza proposal/approval cases. The latter exercise exact native reminder scheduling and persisted local notes; these remain development-session checks, not production identity acceptance.

The affected presentation fixtures were recaptured against the hosted prototype: Camera (photo/video/scan), Photos (library/viewer/albums/search) and Home in both themes, 16 pairs total. All dimensions match; 14 pairs have zero interior pixels above the documented RGB difference threshold of 16. Home differs by 0.0065% (light) / 0.0078% (dark) within the fixed comparison mask. The contact sheet was visually inspected. All local captures had no page/request errors. The reference's Google font request failed in every capture, so the capture command exits nonzero and these are explicitly font-fallback-qualified comparisons, not an unqualified pixel-perfect claim. Evidence: `test-results/prototype-build18/visual/comparison/metrics.json` and `contact-01.png`. The prior 136-pair matrix remains the coverage record for unchanged fixture screens.


### Build 18 manual front-camera follow-up

Computer Use switched the Pixel-class phone emulator from Camera ID 0 to ID 1
(confirmed by Android camera service state), pressed the shutter once, observed
“Photo saved to Android Photos”, and opened the saved image. The viewer showed
960 × 1280, preserving the native front-camera aspect ratio. Both cameras are
software-emulated; no host webcam was enabled. Evidence:
`test-results/prototype-build18/manual-front-camera-saved.png` and
`test-results/prototype-build18/manual-front-photo-viewer.png`.

### Build 19 in progress: immersive agent entry

Camera, captured-photo viewer, picker-photo viewer and selected-file preview now
open the actual conversation from their agent control. The current selection
stays local and supplies identity context on a subsequent user request. Opening
the conversation sends no prompt and uploads no content; a persistent notice
explains that image/document analysis is not connected. Camera preview stops while
the conversation is open and resumes when it closes. The extended capture and
document E2E flows check these transitions. Build/device results are pending.


Build 19 initial focus: Camera capture → conversation → close/restart preview →
photo viewer → conversation → close/preserve selection passed. The document test
failed because its new selector still used “Alpha: summarize this file”; the
renderer exposes the actual label “Ask Alpha”. The test selector was corrected,
and both instrumentation APKs rebuilt. Production APKs did not change.

Network change during build 19: the Mac switched from the prior hotspot resolver
to 192.168.1.1. Restarting only `alpha_flow_pixel_20260929` with the current resolver
restored DNS and an actual Google ping. The full suite subsequently reached
Google's `/sorry/` challenge route, and the unchanged search-results assertion
failed. This is not a search acceptance pass; no challenge was bypassed.

Build 20 source in progress: native browser navigation now displays “Loading
website…” before a document commits, offers the existing Stop loading control,
and shows a retry instruction after cancellation or 30 seconds without a commit.
An actual loopback HTTP E2E fixture holds its response, exercises stop, releases
the response and verifies reload renders the returned bytes. The loopback HTTP
allowance is the existing debug-only policy; release TLS policy is unchanged.


Build 19 terminal result: standalone reported 25 tests / 1 failure in 89.166s.
The only failure was the actual Google search-results assertion after `/sorry/`
redirection. Four opt-in tests were assumption-skipped. Both updated camera and
selected-document conversation flows passed. The smoke runner correctly stopped
on this failure; build 19 launcher and post-suite HOME checks did not run. Full
output is archived in `test-results/prototype-build19/full-smoke/`.

Build 20: `npm run verify` and `npm run android:build` passed, including both
variants' debug/release APKs and instrumentation builds. Artifact hashes and logs
are in `test-results/prototype-build20/`. Focused device checks are underway.


Build 20 focused standalone device result: `OK (3 tests)` in 14.081s. The
controlled HTTP stall → visible loading → menu Stop → stopped state → Reload →
actual response flow passed. Camera chat stops/restarts preview and preserves
the capture flow; selected-file chat preserves the file and clears it on Back.
Evidence: `test-results/prototype-build20/focused-standalone.txt`.

The smoke harness now records an instrumentation failure and still checks the
other distribution variant, including a fresh HOME/start, accessible rendering
and role restoration. It writes a failed result manifest and exits nonzero if
either instrumentation run fails; no failed assertion is ignored or relabeled.
This avoids losing launcher evidence to an external search-provider failure.


Build 20 full run on host GPU did **not** complete: the assistant test first
exceeded its main-thread deadline, followed by Android input-dispatch ANRs.
The subsequent fresh-home check also stalled, so the coordinator was stopped
before the launcher variant ran. Partial output is retained under
`test-results/prototype-build20/host-gpu-smoke/`.

The Android DropBox trace for PID 3215 shows the main thread waiting in
`HardwareRenderer.setStopped` / `RenderProxy::setStopped`, with RenderThread
blocked in `QemuPipeStream::commitBufferAndReadFully` / `glGetIntegerv_enc`.
This supports investigating the emulator graphics path; it does not prove all
application lifecycle behavior is correct. The same APKs are being tested after
a restart using the installed emulator's supported `-gpu software` mode
(ANGLE/SwiftShader), retaining the same phone AVD/data and current DNS resolver.
The unrelated tablet emulator is untouched.

The smoke harness now bounds ordinary adb commands to 30 seconds, installs to
120 seconds and an instrumentation run to 10 minutes, so a stuck hierarchy query
cannot indefinitely prevent failure reporting.


Build 20 software-renderer attempt also remained incomplete. HTTPS navigation
and tab isolation passed, but assistant startup timed out, public search failed,
and another input-dispatch ANR ended instrumentation during the controlled
browser test. The new trace again contains the render-thread graphics-pipe wait.
The coordinator was stopped during fresh-home recovery, before launcher testing.
Evidence is retained in `software-smoke/` and `software-dropbox-anr.txt` under
`test-results/prototype-build20/`. No claim that software rendering fixed it.

A separate source audit found that the real Eliza runtime dropped selected-object
metadata even though the HTTP layer accepted it. The runtime now forwards only
the selected kind, opaque ID and optional revision; the HTTP layer validates the
revision. Account IDs and contents remain excluded. The runtime is explicitly
told it has no photo pixels, live camera feed, document text or page contents.

After restarting the real pinned Eliza backend, the live-provider HTTP test
passed exact note/reminder proposals, authentication and duplicate rejection,
and a synthetic photo ID/revision supplied only in view metadata was correctly
reported by the model. Malformed revision data returned HTTP 400. This verifies
metadata propagation, not image understanding or Android end-to-end delivery.
Evidence: `test-results/prototype-build20/live-host-selected-context.json`.


After the software run was stopped, the phone was restarted with host GLES and
Vulkan disabled, and its native window was explicitly brought forward. The first
focused attempt reported the instrumentation target package missing, so both
standalone test packages were reinstalled. The unchanged assistant startup/close
suite then passed `OK (2 tests)` in 1.096 seconds with no ANR since boot. This
narrows the environment/lifecycle investigation but does not establish a single
root cause. Full matrix rerun is pending in this state.


Build 20 visible-host full matrix completed successfully: standalone `OK (26
tests)` in 80.958s and launcher `OK (26 tests)` in 73.859s. Both had the four
explicitly gated live-agent/camera-denial assumptions skipped. Fresh foreground
launch and accessible Home content passed in both variants, as did launcher
HOME-role selection/restoration. The passing run is preserved separately in
`test-results/prototype-build20/full-smoke-visible/`; the preceding ANR and search
failures remain in their own artifacts. Opt-in real-agent/permission cases are
now running against the updated backend.


Build 20 opt-in real-agent/camera-permission matrix also passed: standalone and
launcher each reported `OK (4 tests)` against the restarted Eliza backend. These
cover camera deny → explicit retry/grant, real-model reminder proposal and
approval, and real-model note proposal/approval/persistence including the
prototype conversation. See `live-agent-camera-denial-{variant}.txt` and
`live-matrix.json` in `test-results/prototype-build20/`.


## Manual build 20 continuation and build 21 HTTP response fix

With the Mac unlocked, Computer Use submitted `Nasa` using the Android keyboard.
Google redirected to `/sorry/…`; search results were not observed. The browser
remained on its loading presentation, but Menu → Stop produced the correct
stopped state (`manual-search-stop.png`). No challenge was solved or bypassed.
The previous search assertion could accept a redirected response retaining the
query; build 21 now requires `/search`. The existing HTTP-error callback also
discarded website response bodies; build 21 preserves them while keeping TLS and
transport failures fatal. A controlled HTTP 503 → visible retry link → HTTP 200
flow was added. This does not establish the cause of Google's loading behavior.

Computer Use also verified Home → exact calendar-event details. One synthetic
local-only event (`Pixel-flow-review`, event ID 16) was inserted into the existing
`On this phone` CalendarProvider calendar. After app resume, Home showed its title
and time, and tapping it opened the matching 9:36–10:06 PM event detail. Screenshots
and fixture/cleanup evidence are in `test-results/prototype-build20/`. Only that
fixture was deleted. This validates agenda navigation and refresh on resume, not
manual event creation or live updates while the app remains foregrounded.

Build 21 required verification and all four APK builds passed. The manifest and
source hashes are in `test-results/prototype-build21/`. Full device matrix is
running; the earlier build 20 result does not qualify these changes.


## Build 21 result and build 22 follow-up

Build 21 full matrix completed with 27 reported tests per variant (four gated
assumption skips each). Standalone failed the secure-indicator wait after the
real HTTPS document was already visible, and both variants failed the stricter
Google `/search` assertion. Launcher passed HTTPS/history/tab isolation. Both
variants passed the controlled HTTP 503 → actual retry link → HTTP 200 flow.
Both fresh Home checks and the launcher HOME-role check passed. The overall
result remains failed.

Source inspection identified a completion-order defect: `onPageFinished` was
discarded if visual commit had not yet been reported. The later commit could
therefore leave a completed page marked loading. Build 22 retains the finished
URL and reconciles it at visual commit/progress completion, while still waiting
for visual commit before exposing page content. Android documents load-finished
and visual readiness as distinct callbacks ([WebViewClient reference](https://developer.android.com/reference/android/webkit/WebViewClient)).
The HTTP retry test now also waits for the loading-only menu action to disappear.
Google failures now include bounded origin/path/title diagnostics from the
visible child page. No CAPTCHA solving or TLS bypass was introduced.

Build 22 `npm run verify` and `npm run android:build` passed. Full device matrix
is running; see `test-results/prototype-build22/` for the exact source and APK
hashes. Build 21 failure artifacts remain unchanged.


Build 22 full matrix completed: each variant reported 27 tests, one failure
(Google search), and four explicit opt-in assumptions. The corrected HTTPS
loading/secure-indicator case passed in both. Computer Use observed the actual
Google challenge page rendered inside the Alpha browser, confirming that its
content is now visible rather than stuck behind the loading presentation.
`google-challenge-rendered.png` captures this observation; no challenge was
solved or bypassed. Full logs and result manifests are in
`test-results/prototype-build22/full-smoke/`. The connected four-case matrix is
running through the new reusable `scripts/android-connected-smoke.mjs` runner.


The build 22 connected matrix passed all four cases in each variant after fixing
the new runner's precondition setup. Its first attempt failed only because it
left CAMERA granted before the denial test; all three real-agent cases already
passed. The runner now revokes CAMERA and clears its prior decision flags before
testing denial → retry → grant. Both first-attempt and corrected-run evidence
are retained in `connected-before-fixture-fix/` and `connected/`. The corrected
manifest records each tested APK hash. Required repository verification passed
again after adding the runner.


## Build 22 manual phone acceptance slice

Computer Use entered `example.com` using the real Android keyboard, observed
the HTTPS page, tapped its Learn more link, observed IANA's Example Domains
page, then used Alpha's Back control to return to the original page. Screenshots
`manual-browser-page.png`, `manual-browser-link-destination.png`, and
`manual-browser-back.png` are in `test-results/prototype-build22/`. This proves
that public navigation slice; it does not waive the Google search failure.

Computer Use opened the native camera, waited for its emulated sensor preview,
opened Alpha and observed the preview stop, then closed Alpha and observed the
preview resume. It opened the existing 960 × 1280 captured image, entered Alpha
from the photo viewer and returned to the same image. `manual-camera-agent.png`,
`manual-camera-resumed.png`, `manual-photo-agent.png`, and
`manual-photo-return.png` record those states. No new photo was captured in this
manual slice, and no image pixels were sent to the model. Image analysis remains
unimplemented. The photo suggestions still contain prototype example-person
wording; replace those production suggestions with capability-aware text while
retaining the reference chip geometry.


## Build 23 sharing implementation — verification in progress

Files and picker-selected Photos now open the real Android share chooser through
the current native selection capability. App-captured Photos share through an
ownership-checked MediaStore ID. The outgoing URI refers to the original item,
not the preview. Only read permission is granted. The production UI does not
claim a send occurred when the chooser opens.

Required repository verification and all four APK builds passed. Expanded
Camera and SelectedDocument instrumentation observes (without intercepting) the
actual chooser intent, verifies MIME/URI/grants/original bytes, requires the
system chooser to become foreground, cancels it and checks return to selection.
Both-variant focused execution is in progress. Recipient-app delivery is not
proved by this cancellation flow.


Build 23 focused sharing matrix passed both variants: two expanded E2E cases per
variant verify actual photo capture and real document selection, original-byte
share payloads, read-only grants, foreground Android chooser, cancellation and
selection preservation. See `test-results/prototype-build23/share-matrix.json`
and per-variant logs. The full matrix is running. A follow-up test-only receiver
is being added to establish actual reading from a separate application UID,
beyond the already verified sender/chooser behavior.


### Build 23 full-suite regression findings

The standalone full suite reported 27 tests with three failures: Google search
returned the traffic challenge; camera Activity recreation remained PAUSED;
selecting the second real document did not render its expected preview. The
focused two-case sharing pass does not override these full-suite failures.
The launcher full run is still pending at this checkpoint.

Build 24 adds explicit foreground return synchronization after cancelling the
Android chooser and after returning from a test-only share recipient. The
recipient reads and hashes the original URI in a separate application UID.
This is intended to qualify Android read grants, not external email delivery.
The receiver was confirmed absent from all four production APK manifests and
present in both instrumentation APKs. Build 24 required repository verification
and Android builds passed; runtime results are pending. Production agent chips
now avoid fictional contacts and unsupported image-analysis promises.

Build 23 launcher completed with one failure, the same Google traffic challenge;
its camera recreation and second-document cases passed. Standalone still has
three failures. Both fresh Home rendering and launcher HOME-role checks passed.
Complete results are archived under `test-results/prototype-build23/full-smoke/`.


Build 24 focused sharing passed both variants, including the separate-UID local
recipient's exact original-byte SHA-256 readback. The full matrix is pending.
Build 25 adds native Settings facts and allowlisted settings-page handoffs; its
repository verification passed, while APK/device validation is pending.

Build 24 full matrix completed: both variants reported 27 tests and one failure
each (Google traffic challenge). All other enabled cases passed, including the
expanded real share recipient/cancellation paths, camera recreation and second
document selection. Four opt-in cases were skipped in each full run. Both
fresh Home rendering and launcher HOME role passed. The suite remains failed
because actual search results are not available. Evidence is preserved in
`test-results/prototype-build24/full-smoke/`.


## Build 25 full-suite result

Both variants completed on the Pixel 9-profile phone emulator. Standalone:
28 reported tests, two failures: Google traffic challenge and main-thread
dispatch timeout at Browser entry in FlowInstrumentedTest. Launcher: 28
reported tests, one failure: Google traffic challenge. Both passed the new
Settings case, sharing and all remaining enabled cases, with four opt-in skips.
The lifecycle timeout cause is not established; the launcher pass does not
turn the standalone full suite green. Complete logs are retained in
`test-results/prototype-build25/full-smoke/`.

Computer Use session reset and emulator rebinding restored capture but not
pointer input. Pointer operations still report no target window; keyboard
operations did not visibly navigate. No new manual Settings/share pass is
claimed for build 25.

## Build 25 continuation: touch checks and reboot evidence

- The connected matrix passed four cases per variant against the real development Eliza service; see `prototype-build25/connected/`. The isolated lifecycle case passed once per variant in `lifecycle-retest-*.txt`. The earlier standalone full-suite timeout remains a failed result.
- Restarting the emulator process after an input-targeting failure exposed invalid installed Alpha app and test APK ZIP files (`Zip EOCD not found`). The cause is not established; see `cold-start-package-errors.txt`. Reinstallation followed by filesystem sync and normal Android reboot preserved the exact launcher APK SHA-256, recorded in `pre-reboot-apk-sha256.txt` and `post-reboot-apk-sha256.txt`. This does not establish resilience to abrupt emulator termination.
- Computer Use observed actual battery, Android Battery Saver, and About screens (`manual-battery.png`, `manual-native-battery.png`, `manual-about.png`). Existing captured images remained visible after reinstallation/reboot. A captured image opened in the real Android share chooser; cancelling returned to the same viewer (`manual-photo-share.png`, `manual-photo-share-cancel.png`). No external recipient was selected.
- Manual taps on the in-app Back arrow in Settings sometimes left the preceding subpage visible. Android Back responded. The strengthened Settings test passed in both variants using actual Android touchscreen injection at the Back button center, DOM hit testing, and an assertion that the subpage Back button disappears. Launcher: 1 test in 5.29 seconds; standalone: 1 test in 3.8 seconds. Logs and current test/source/APK hashes are in `settings-touch-*`. The required repository verification passed again. No production source changed in this follow-up; these results do not explain or erase the manual delay.

## Connection implementation checkpoint — September 29, 2026

Source inspection covered the requested `~/v3` and `~/eliza-workspace/milady/eliza`
checkouts and the linked enclave deployment thread. Public enclave health returned
200 with readiness; private conversation/version routes returned 401. Current EIF
identity and deployment are not verified because SSH is awaiting Cloudflare login.
No enclave restart, replacement, KMS policy change or Railway credit mutation was
performed in this checkpoint.

The supplied Cerebras credential passed a live model-discovery and chat request
using `qwen-3.8-27b`. Evidence: `test-results/cloud-connection/cerebras-live.json`.
The first discovery request without an explicit User-Agent returned 403; a request
with the application User-Agent and subsequent completion returned 200. The key
is outside the repository and absent from the report.

New Cloud and remote protocol clients passed explicitly synthetic HTTP lifecycle
fixtures, including owner/session restoration, expiry, cancellation and no write
retries. Those tests do not establish a real Cloud login, paired enclave, Gmail
grant, voice session, or production account. Native encrypted storage and HTTP
bridge tests and startup UI integration are in progress. The canonical live Cloud
API created a CLI login session, but its browser page was blank during inspection;
no successful login is claimed.

Calendar build 26 compiled all variants, but both focused tests failed during edit.
Provider diagnostics rejected selection on an item update URI. Build 27 first
failed compilation while the new native connection file was still being completed;
its AtomicFile API use was corrected before build 28. Both failures remain recorded.

## Build 30 connection integration checkpoint

`npm run verify` and all four APK builds passed. `test-results/prototype-build30/source-before.json` and `source-after.json` have the same input digest; APKs and logs are archived there. The build includes startup/Settings connection selection, explicit persistent mock mode, Cloud Gmail read-only integration, model-visible bounded phone context, native encrypted credentials and Cloud voice capture/upload/playback.

The first four-case native suite was interrupted during the initial calendar case because the Pixel guest stopped answering `adb logcat`, `getprop`, and `dumpsys`. ADB still listed the device. No terminal test result was returned, and no pass is inferred. The interruption is recorded separately in `connection/interrupted.json`; only this Pixel emulator was targeted for recovery.

The actual production `RemoteProtocol` passed a host integration against the isolated real Eliza app host: pairing, verified owner session, chat response `42`, restored session, persisted two-message history and unauthenticated HTTP 401. Requests used the Android Host header to avoid Eliza's trusted-local bypass. An initial strict request exposed HTTP 403 for the emulator Host; the isolated launcher now explicitly allows `10.0.2.2` and preserves authentication. Evidence: `test-results/cloud-connection/real-client-protocol.json` and `real-remote-protocol.json`. These are host-side results, not phone, Cloud or enclave acceptance.

### Checkpoint 31 source follow-up (device verification pending)

- Separated Cloud service sign-in from the selected remote/local/Cloud agent. Agent disconnect retains Cloud services; Cloud sign-out detaches Cloud-target chat and service identity; explicit offline/mock suppresses services. Settings now projects actual account/target availability.
- Bound native Cloud STT/TTS to a locally generated credential generation. A request from the previous account cannot use a replacement credential. Added a synthetic native assertion that stale generation produces no HTTP request.
- `npm run verify` and the synthetic Cloud HTTP protocol suite passed. The native changes are not included in build30 and require a new APK build and emulator run.
- Parallel agent execution stopped at the account usage limit. Upstream device-action and enclave preparation files are preserved but have not been accepted as release-ready.

### Checkpoint 30/31 device and login update

- Build30 headless Pixel standalone: all four scoped native tests passed (calendar, encrypted connection transport, chooser/offline/mock persistence, Cloud voice fixture capture/upload/playback). Launcher: all four failed after the first WebView/main-thread timeout; this is retained as failed evidence, not a pass. See `test-results/prototype-build30/connection-headless/`.
- Build31: `npm run verify` and all four Android APK builds passed. Pre/post build source fingerprints match. Artifacts and logs archived under `test-results/prototype-build31/`. Device tests pending.
- Fresh Cloud login attempt returned an expired-session screen; API confirmed 404 and the recorded expiry was before the attempt completed. A new session reached the explicit organization API-key authorization screen after Google sign-in. Authorization is pending user confirmation; no key was received for these attempts.
- User approved Eliza and Cloudflare terms. Cloudflare sign-in currently stalls in loading state; SSH access and deployment remain unverified.

### Checkpoint 32: real phone-to-local-agent acceptance

- Build31's scoped native matrix passed all four classes in fresh instrumentation processes for both distributions on the visible Pixel emulator. This includes rejection of stale Cloud credential generations before any audio HTTP request. Evidence: `test-results/prototype-build31/connection-isolated/result.json`.
- The first real-phone local pairing run failed because Android's debug network policy omitted the emulator host `10.0.2.2`. Build32 adds that exact debug-only host; release policy remains HTTPS-only.
- Build32 passed repository verification and all four APK builds with identical before/after input fingerprints. Both Android distributions then paired through the actual chooser, received a real Cerebras reply, recreated the Activity, and received another reply from the same isolated Eliza host. Evidence: `test-results/prototype-build32/local-remote/result.json`. This is local-agent phone acceptance, not Cloud or enclave acceptance.
- Cloudflare authentication subsequently succeeded. SSH inspection confirmed four running enclaves and a healthy existing slot d. Latest-source dependency installation completed in an isolated Linux builder. No replacement image has been admitted or deployed; release signing and Terraform-managed PCR admission still need authorized access.
- Cloud organization-key authorization remains pending. No successful live Cloud account, Gmail or voice acceptance is claimed.

### Checkpoint 34: native journal and mock-mode isolation

- Build33 compiled all distributions. Its encrypted action journal passed on both variants, but calendar startup failed on both and the launcher credential test failed. Computer Use subsequently observed a persisted mock-mode session; native adapters intentionally do not initialize in that mode. These failed results remain under `test-results/prototype-build33/connection-isolated/`.
- Native flow setup now explicitly exits mock mode through the rendered control. Computer Use also exposed that the exit control overlapped the Android status bar. Build34 positions it below the actual native top inset, including on cold mock startup.
- Build34 passed `npm run verify`, all four APK builds, and all five scoped native classes on both distributions. Before/after source fingerprints match. Evidence: `test-results/prototype-build34/connection-isolated/result.json`. Journal coverage includes concurrent reservation, encrypted persistence, Activity recreation, prevention of repeated execution, immutable terminal results and scope separation.
- The patched real backend now authenticates and enrolls the device and discovers action tools, but live planning fails before proposal creation: Cerebras reports that the tool JSON schema grammar cannot compile. The real device-action test is prepared but has not passed. Synthetic journal and HTTP passes do not close this gap.
- Latest-source enclave build stopped because the source archive lacked Git metadata required by the view inventory builder. Restoring its tracked-file index is in progress; no new EIF deployment is claimed.
