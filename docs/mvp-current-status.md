# Current MVP status

The MVP is not complete. This index separates implemented capabilities from
remaining acceptance work. Source ownership is defined in
[architecture.md](architecture.md); browser capabilities and their limits are
listed in [browser-dev-parity.md](browser-dev-parity.md) and
[mvp-browser-review.md](mvp-browser-review.md).

## Product boundaries

- The primary agent runs on Android. Browser development uses a private local
  host. The production Android Welcome dialog offers Cloud sign-in for the on-device
  agent or local apps without AI. Remote pairing is retired on production Android and
  remains a browser and test-mocks development transport (see Connection choices below).
- The upstream pin in `upstream.lock.json` is reviewed head `352d7a0855`, merged
  through elizaOS PR #34835 and reachable from `develop`. It includes the shared
  password manager and retires the last applied local patch. Earlier `945209d3`
  results below remain historical. Current verification passes 454 tests (four TODOs);
  all four developer APK audits pass, and both variants pass the API 35 browser
  rejection campaign. These APKs omit the resident runtime and use an unqualified
  speech candidate; unsigned releases are not distributable.
- Local orchestration does not imply local inference. The configured text model
  uses hosted Cerebras; Whisper/Kokoro speech has separate host and Android paths.
- A powered-off phone cannot run its resident agent. Acceptance of missed-occurrence
  recovery in place of powered-off execution remains an explicit product decision
  ([A-09](decisions.md#open-decisions)).
  Optional remote execution needs separate qualification.
- Notes, Calendar, Reminders, Browser/password-provider integration, notifications,
  assistance, workflows, digests, Files and capture remain in scope. Gmail/Email is
  in MVP scope ([P-02](decisions.md#october-7-owner-product-decisions)); its software
  gaps are closed below and real-account acceptance remains open. Telegram,
  Discord, Phone, SMS, Contacts and Wallet are deferred by MVP policy; development
  fixtures do not change that scope.
- October 7 product policies are recorded in
  [decisions](decisions.md#october-7-owner-product-decisions): voice is reviewed and
  sent by the user, not auto-sent; browser tabs keep sign-ins in a persistent profile
  with an ephemeral private-tab option; an integrated password manager is an elizaOS
  upstream component, with Proton Pass optional; deleted notes (text, checklist, link
  and voice, including the voice recording) go to a Trash that empties after 3 days; the browser build gets speech recognition (local preferred,
  cloud only by disclosed opt-in); OCR is English only for now. Cross-app notification
  mirroring stays opt-in, off by default and outside MVP acceptance. These are policy
  decisions, not implementation or acceptance evidence.
- Production builds are the live app. Mock mode, prototype fixtures, the development
  profile, device controls, simulated apps and debug-only native hooks exist only in
  builds made with `ELIZA_DEV_ALLOW_TEST_MOCKS=1` (`npm run dev`, Playwright, explicit
  test-mocks builds). The production web build and all four distribution APKs are built
  with the switch off. The web build is a development/preview surface and the APK
  payload, not a separate product. See the
  [production readiness record](production-readiness-2026-10-04.md).

## Capabilities and remaining acceptance

Evidence class codes in the last column follow the classes defined under
[Qualification](#qualification): S source/test, B APK build, E emulator, I AOSP image,
R real integration, D device/user. "Historical" means the class was observed only on an
older build or source revision and does not qualify the current head; a row without a
class has no evidence of that kind for the current head.

| Area | Implemented boundary | Remaining acceptance | Evidence class |
| --- | --- | --- | --- |
| Home and launcher | Branded Home with clock, agenda cards from real providers and a grid of the enabled Alpha views; the launcher flavor declares the `HOME`/`DEFAULT` filter; quick-setting tiles show the switch states Android reports and open the matching Android Settings page (see Settings). `DeviceAppsPlugin` can list and launch installed apps, but the renderer does not call it, so Home has no all-apps drawer or search and cannot open third-party apps. | An all-apps drawer and search with honest empty and failed states. Emulator HOME-role selection, opening an app and returning HOME repeatedly (class E), default HOME in a full image (class I) and physical use (class D). Landscape layout is not implemented; orientation is left unspecified. Rotation acceptance waits on that layout or an owner decision to lock portrait ([pending decisions](decisions.md#pending-owner-decisions)). | S; E historical only |
| Local startup and ownership | Native bridge, reproducible payload preparation, owner enrollment and private browser-host transport. Shared launcher preserves existing tokens and runtime-written configuration. | Current native IPC/process lifecycle, reboot, owner isolation and installed variant identity on the intended image. See [local setup](local-agent-development.md). | S; E historical only |
| Connection choices | Android production builds open a Welcome dialog for the on-device agent: sign in to Eliza Cloud for inference credits, or "Use local apps without AI", which reaches Home with no network and persists across restart. Production Android does not pair with or restore a remote or Cloud agent: the controller and `connectRemote` refuse it, the native transport rejects the pairing route (`ConnectionRoutes.java`), and a saved remote credential is not read, written or removed. The saved selection itself is ignored and is replaced once the user chooses local apps or the resident agent starts. Cloud sign-out sends Cloud's self-revocation (`DELETE /api/v1/api-keys/current`) once and says "revoked" only when Cloud confirms it; otherwise it says the token was removed on this phone only. The production web build offers remote pairing over HTTPS and Continue offline; Cloud sign-in is stated as unavailable there and a saved Cloud selection or service is signed out without a request. Remote disconnect revokes the device enrollment and owner session and reports an unconfirmed revocation as such. Resident, remote, local and Cloud connections negotiate verified phone actions at enrollment; a Cloud runtime that does not advertise them stays chat-only. Synthetic coverage: `test/browser/connection-boundaries.production.spec.ts`, `test/browser/connection.production.spec.ts`, `test/connection-routes.test.mjs`. | Cloud self-revocation has not run against live Eliza Cloud, and the native route guard and DELETE admission are compiled and JVM-tested but not exercised in an APK or on a device. The web build cannot revoke a Cloud credential. Real-device wrong-owner/origin, expired and reused token, and callback tests; managed endpoint ([A-02](decisions.md#open-decisions)). | S |
| Chat and retained context | Typed conversations, selected-source context, reviewed actions with durable receipts, and conversation-bound local composer drafts with explicit conflict recovery. Cancellation is transport-only: Stop closes the client stream (native IPC or HTTP) and discards the late reply, but it does not ask the agent to stop, so the agent may still finish the reply and commit effects it has already started. | An explicit server cancel, or an honest 'the agent may still finish this reply' notice with one reconciliation by client message ID after a dropped stream. The composer consumes the draft before dispatch, so a pre-dispatch failure (for example no selected agent) loses the typed text from the composer; it must be consumed only after dispatch succeeds. Remote and Cloud history is not restored on connect. Broad model quality, missing-detail clarification, target-device performance and complete physical user journeys. | S; R local Cerebras (historical) |
| Speech and recording (J02) | Editable transcript review; separate Send, summary save and reminder draft. Owned playback rejects stale completions. Resident Browser reading retains native reviewed text and uses bounded local synthesis chunks. | Failed functional acceptance: `LocalSpeechInstrumentedTest` ran 2 tests on arm64-v8a and 1 failed (the synthesized sentence was recognized as "lady's" instead of "lazy"), so `functionalAcceptance.passed` is false in `android/local-speech/qualified-runtime-manifest.json` and x86_64 runtime execution is unverified. The cause is addressed by deterministic VITS synthesis in upstream PR #34743, now included in the pin; the unchanged test then passed on an arm64 Android emulator against a rebuilt runtime candidate that is recorded but not admitted. That emulator pass is not physical-device acceptance, and x86_64 still needs an x86_64 host or device. Packaged byte identity does not waive that failure. Both ABIs must pass before speech is accepted. Physical microphone/audio quality, Bluetooth/echo, language support, interruption and latency. Manual send means the latency method or six-second target must be settled first ([A-10](decisions.md#open-decisions)). Browser-build speech recognition is in scope; any cloud route requires disclosed opt-in. Host synthesis does not qualify Android playback or native permission behavior. | S; D failed on arm64-v8a (the physical Android 16 ARM64 device recorded under `nativeExecution`, x86_64 not executed) |
| Notes, Calendar and Reminders | Durable editing, selected reads, reviewed actions and recovery. Calendar shows only calendars held by the Android CalendarProvider (on the phone or synced there by an Android account) on Android, and the browser-local calendar in the web build; calendars connected through Eliza Cloud are not shown. Native Calendar and Reminders delegate to shared upstream plugins while retaining product storage and provider identity. | Current installed-data upgrade, timezone/recurrence, ambiguous writes, real provider and physical-device behavior. Notes Trash with automatic 3-day emptying covers text, checklist, link and voice notes (P-06): a voice note's recording is trashed, restored and erased with its Trash entry, and the native 30-day audio sweep is only a backstop. Device acceptance of Trash expiry remains open. Browser notification delivery is not alarm qualification. | S; E historical only |
| Browser persistence | Calendar, reminders/alarms and their creation/action histories, notification policy/history, hosted-result notices, workflow drafts and pending workflow requests, workflow notification receipts, conversation restart choices, Cloud setup intents, media saved-copy requests, bookmarks and notification sound history, device preferences and roles, the development password provider, photo album metadata and the development agent, execution, digest and Cloud documents use the upstream transactional document store. Revision-bound recovery preserves exact older bytes. The contracts and owning suites are in [browser-storage.md](browser-storage.md). | Engine-by-engine qualification of each domain on the integrated head, and the independent preferences and native Clock handoff history described in [browser-storage.md](browser-storage.md#independent-preferences). The development-only documents ship only in test-mocks builds. | S |
| Clock | Reviewed handoff to Android Clock with truthful opened semantics. | Actual ringing, snooze/dismiss, reboot, timezone and DND behavior; Clock owns final alarm creation. | S; E historical only |
| Typed workflows | Phone-authored workflows have manual triggers only (`apps/app/src/runtime/phone-workflow-authoring.ts` accepts `trigger.kind: 'manual'`). Bounded generated candidates, separate Use/Save/Run, approved device effects and retained results. Calls, SMS, payments, Contacts, arbitrary code and email to unnamed recipients are refused on the phone before any generation request. Interrupted runs are reported as outcome unknown (or worker still running) and are never replayed: side-effecting workflows stay blocked until each interrupted run is explicitly cancelled, removal first cancels them, and only a read-only digest offers a separately confirmed new run. | Broad model reliability, real interrupted-worker behavior on the resident runtime and current compiler/runtime release qualification. Arbitrary code and an unrestricted workflow IDE remain outside MVP. | S; E historical only |
| Notify and Speak | Native delivery ledger and executor; browser transactional notices and exact receipt recovery without reposting. | Native OS posting/audio and interrupted-delivery acceptance. Uncertain speech must not be replayed or inferred complete. | S; E historical only |
| Digests and schedules | Schedules are digest-only: scheduled execution exists for digests, not for typed workflows. Local digest schedules, retained results, client-scoped acknowledgement and explicit outcome-unknown records after interrupted work. | Real-provider interruption, native lock/battery/Doze, physical power loss and account-source routing. Preserving an unknown outcome does not establish automatic completion after a worker crash. | S |
| Browser and passwords | Isolated native browsing, reviewed reading, sensitive-source rejection and provider setup/status. Implemented for P-04: normal tabs keep sign-ins in one persistent browser profile (separate from the host profile) and restore after a cold start (engineering choice); private tabs are ephemeral; Clear browsing data and per-site clearing are confirmed; pop-ups open as tabs and app links hand off to Android. Integrated password manager (P-05, shared upstream module) supplies a Keystore-bound vault, Settings management and an Android Autofill provider with exact origin/app binding and a fresh unlock per fill; Browser Autofill is unavailable without native per-field origins; Show and Copy remain available. Proton Pass remains optional. | October 7 policy is decided, not accepted: P-04 still needs emulator/device runs of the sign-in, private-tab, pop-up and app-link instrumentation; P-05 is implemented, not device-accepted. BiometricPrompt, provider selection and save prompts still require device qualification. Passkeys are not implemented. Real-site password/passkey/autofill and installed isolated-world/consent behavior. Setup UI does not prove filling succeeds. | S; E historical only |
| Email/Gmail | In MVP scope ([P-02](decisions.md#october-7-owner-product-decisions)). Owner/grant-aware contracts with controlled provider-boundary coverage. Inbox loads on open and has Refresh, provider-cursor paging (Load more) and a Sent view (`in:sent`). It offers a confirmed disconnect, in Inbox and Settings → Connections, that reads back the account state. Failures are classified as offline, revoked or stale, each with an explicit Retry. Left swipe and the archive button both go through the reviewed archive flow. Share by email from Notes opens a prefilled local draft. Compose has a From switcher when more than one account is connected. The Home unread badge reflects loaded Inbox data. Opening a message marks it read through the reviewed `mark-read`/`mark-unread` operation when the server advertises `readState`. | Real Google OAuth (the code exchange currently returns 401), deployment of the managed Cloud routes, including the pinned upstream read-state operations, and a real mailbox: send/reply, label changes, revoke and response-loss recovery. Ambiguous sends are never retried. Shared Files/Photos items are not attached automatically. External messages require explicit recipient/message authorization. | S; R open (OAuth 401) |
| Files, camera, scans and media | Selected import/export, exact-byte media, scan correction and reviewed searchable PDF flows. | Native provider/camera/storage access, real data volumes, OCR quality, fonts and product usability. OCR covers English only for now (October 7 policy). | S; E historical only |
| Poster to Calendar (J01) | Suggestions for explicit English dates, times, same-day ranges and labeled venues. With the device clock as reference, year-less and weekday dates, today/tomorrow, and printed IANA or UTC-offset times (converted, with the source zone shown) are suggested; dated posters without a time are suggested all-day and repeat wording is an unticked hint. Every inference is listed; separate Calendar review and Save remain the only write. Ambiguous numeric dates and zone abbreviations stay blank. | Arbitrary-photo OCR quality, broader languages and phrasing, and native provider acceptance. Suggestions never authorize saving. | S |
| Document analysis (J03) | Selected-content review, separate editable summary-note approval and verified source references. Changed/deleted source files fail closed. Native references use existing selected-document access only. | Live Gmail retrieval, installed permission retention/revocation, cross-process reopening and broad PDF/image task quality. Fingerprint-only sources require reselection. | S; E historical only |
| Schedule to travel (J04) and Maps | Selected event location enters Maps once; route choice and origin remain explicit. Stale search/navigation work is cancelled. | Production endpoint/TLS, licensed data coverage, location permissions, offline behavior and physical navigation. See [regional Maps setup](maps-regional-validation.md). | S; E historical only |
| Web research to note (J05) | Bounded public-page or pasted-text review, separate question Send and explicit note Save with a source link. | Installed native reading/consent and real-site coverage. CORS-denied content needs user-supplied text; a link is provenance, not an immutable archive. | S |
| Design and accessibility | Themed bounded dialogs, visible actions, keyboard-scrollable content and large-text checks across core flows. | Complete current-source subviews, error/empty states, Pixel geometry, physical accessibility and user task acceptance. Browser assertions alone are not design approval. | S |
| Settings | Settings includes connection management, per-connection privacy disclosure, third-party licences and the password manager pages. Shade tiles and Settings rows show the Wi-Fi, Bluetooth, airplane mode, device location, mobile data and Do Not Disturb states that Android reports to an ordinary app, and each opens its own Android page (Wi-Fi, Bluetooth, mobile network, airplane mode, location, Do Not Disturb, display, sound, battery, app notifications, app permissions). Alpha changes none of them; the flashlight is the only direct control. A state Android does not report is labelled as a handoff, never as off. About shows the packaged version and Android's install time and states that Alpha does not check for updates. Settings offers no memory-erase control ([A-19](decisions.md#new-decision-items) is undecided). | Emulator and device qualification of each Android handoff and readback: the readable settings and the pages an image provides differ by Android version and vendor, and no run exists on the current APK. An update check waits on [A-06](decisions.md#pending-owner-decisions). | S; E historical only |
| Privacy and outbound context | Approval/context binding, native secure storage, contact references and credential redaction contracts. The resident Android agent starts with the upstream `ELIZA_SECRET_SWAP_ENABLED` and `ELIZA_PII_SWAP_ENABLED` switches on by default; the browser development host keeps both off unless both are set to `true` on qualified source. Privacy disclosure is per connection: hosted Cerebras inference is disclosed, and no connection claims that data stays local. Browser development storage is disclosed as unencrypted. | Re-run resident redaction on the current APK (emulator, then device, as separate gates) and broaden category/provider coverage. The host default stays off until its enablement campaign passes. Inspect the selected runtime's actual configuration; a past host snapshot does not prove present settings or that data stays local. | S; E historical only |
| Release | Pinned upstream source, standalone/HOME packaging and source-admitted runtime staging. Distribution builds exclude mock/fixture/developer surfaces and debug-only native hooks; release signing and version come from `ELIZAOS_KEYSTORE_PATH`, `ELIZAOS_KEYSTORE_PASSWORD`, `ELIZAOS_KEY_ALIAS`, `ELIZAOS_KEY_PASSWORD`, `ELIZAOS_VERSION_CODE` and `ELIZAOS_VERSION_NAME` (unsigned `*-release-unsigned.apk` without all four signing values). | The Calendar and native compatibility compile breaks are fixed upstream. At reviewed pin `945209d3`, source preparation, repository verification and all four developer APK builds passed on 2026-10-10, including instrumentation APKs and lint. Both variants passed journal persistence/replay/redaction and seven-filter preview/export tests on a disposable API 35 emulator. Builds used the recorded unqualified speech candidate and `--allow-unpackaged-runtime`; release APKs remain unsigned and not distributable. A distribution build requires qualified speech assets and a staged resident runtime. The pin is reachable from upstream `develop`; the previous off-branch pin is retired. Speech functional acceptance failed (see the Speech row). Then: controlled release key and signed artifacts, installed-data upgrade from earlier (including mock-state) installs, image/hardware qualification, App Links verification on a real domain, signed update/rollback, support and pilot acceptance. | S; B developer APKs only (not distributable) |
| Licenses | Settings renders `apps/app/public/licenses/third-party-notices.json` (name, version, license, source, text) with an explicit unavailable fallback; `THIRD_PARTY_NOTICES.txt` accompanies it. | Legal review of the generated notices, corresponding-source offers where required, and the separate native-app/OS-image notices in [native-app distribution](native-app-distribution.md). | S |
| Phone, SMS, Contacts and Wallet | Deferred by MVP policy. Source and design references are retained; app entries, `open_view` destinations and agent actions are disabled. Emergency calling stays with the system. | Restoring any of them needs a recorded scope change, then native role, permission, recipient and return-to-HOME acceptance; Wallet also needs provider, key custody and transaction-approval decisions ([A-08](decisions.md#open-decisions)). | not applicable |

## PRD requirement status

Status of each [PRD](prd.md) requirement, mirrored in `docs/requirements.json` and checked by
`test/docs-requirements-consistency.test.mjs`. Status describes software, not acceptance:
*implemented* (only acceptance in other classes remains), *partial* (named software gaps remain),
*deferred* (out of the MVP by policy) or *blocked* (needs an external decision or resource).

| Requirement | Status | Status rows | Next gate |
| --- | --- | --- | --- |
| AP-01 | partial | Home and launcher; Design and accessibility | E: launcher HOME-role instrumentation on both APKs, then D on the selected phone |
| AP-02 | partial | Home and launcher; Local startup and ownership; Connection choices; Release | B: four distribution APKs build and pass scripts/verify-apks.mjs; then E: install both modes, open apps and return HOME repeatedly |
| AP-03 | partial | Connection choices; Local startup and ownership | R and D: real-device wrong-owner and wrong-origin, expired and reused token, and callback tests against the managed endpoint (A-02) |
| AP-04 | partial | Chat and retained context; Connection choices; Privacy and outbound context | E then D: resident process restart and reconnect without duplicate messages or writes; no inference-available claim without provider health evidence |
| AP-05 | partial | Chat and retained context; Design and accessibility | S: composer draft survives every pre-dispatch failure; then E: resize, Back and HOME without keyboard obstruction |
| AP-06 | partial | Speech and recording (J02) | E: LocalSpeechInstrumentedTest passes on x86_64 and arm64-v8a; then D: physical audio, interruption and latency (A-10) |
| AP-07 | partial | Home and launcher; Digests and schedules | R: real provider agenda and digests with loading, empty, stale and error states; then D |
| AP-08 | deferred | Phone, SMS, Contacts and Wallet | A recorded scope change, then native role, permission and return-to-HOME acceptance |
| AP-09 | partial | Email/Gmail; Notes, Calendar and Reminders | R: real Google OAuth grant, managed Cloud Gmail routes and a real mailbox; B: the native calendar plugin compiles at the pin |
| AP-10 | partial | Browser and passwords; Files, camera, scans and media; Schedule to travel (J04) and Maps; Notes, Calendar and Reminders | E: browser sign-in, private-tab, pop-up and app-link instrumentation (P-04) and password-manager fill (P-05); then R and D |
| AP-11 | partial | Typed workflows; Digests and schedules | E then D: interrupted-worker behavior on the resident runtime with real receipts |
| AP-12 | partial | Settings; Privacy and outbound context; Licenses | E: each Android settings handoff and readback; no simulated switches |
| AP-13 | deferred | Phone, SMS, Contacts and Wallet | Provider, key custody, device security and transaction-approval decisions (A-08) before any work |
| AP-14 | blocked | Release | I and D: exact source, blob, kernel and signer lock, hardware checklist and recovery test; blocked on hardware (A-01) and signing authority (A-06) |
| AP-15 | partial | Design and accessibility; Home and launcher | E then D: TalkBack, large font, touch and keyboard, offline, killed process, rotation and repeated HOME navigation |

## Qualification

Run `npm run verify` and `npm run android:build`, including standalone and launcher
debug/release outputs. The production-surface gates are:

| Gate | Command | What it qualifies | What it does not qualify |
| --- | --- | --- | --- |
| Production bundle audit | `node scripts/audit-production-bundle.mjs web-dist` (`--expect-test-mocks` for a deliberate test-mocks build) | The web bundle has no mock/developer strings, fixture names, `img/` fixture images or source maps, and `web-dist/build-flags.json` reports `testMocks: false`. | Runtime behavior, APK contents (see below) or any device result. |
| Production browser lane | `npm run test:browser:production` | Rendered production build (switch off): no mock choice, no `?mode=mock`/`?fixture=1`/`?mode=dev`/`?start=` entry, no device controls; honest empty and unconnected states; legacy `{kind:'mock'}` selection opens the chooser. | Android WebView, native plugins or real accounts. |
| APK verification | `node scripts/verify-apks.mjs` (run by `npm run android:build`) | APK bytes for all four distribution APKs: identities, HOME filter, debug flags and signatures, no test-mock native classes, cleartext config or fixture-package queries, and the bundle audit on each APK's extracted `assets/public`. | Installation, emulator HOME role, image boot or device behavior. |
| Head qualification | `node scripts/qualify-head.mjs` | Repository verification, distribution builds and their audits for the exact checked-out commit. | Any later commit, hosted CI, emulator, AOSP image, real integration or device acceptance. |

Integrated-head results for these gates (source/test and APK build classes only) are in the
[production readiness record](production-readiness-2026-10-04.md#integrated-head-qualification).

Test-mocks builds (`ELIZA_DEV_ALLOW_TEST_MOCKS=1 npm run build`,
`npm run android:build -- --test-mocks` into `artifacts/test-mocks/`) exist for
development and instrumentation only and never qualify a distribution artifact. Exercise the owning changed contracts and inspect the
terminal hosted result for the reviewed source. Use the commit's PR and
[GitHub Actions runs](https://github.com/AlphaCompute/alphaphone/actions) for
source-specific results; old pass counts and cancelled runs cannot qualify new code.

APK assembly, emulator bridge/HOME behavior, full AOSP boot, real integrations and
physical-device/user acceptance are independent gates. A source pin rollback does
not establish installed-data or OS rollback compatibility. Browser fixture and
synthetic-provider results must remain distinguishable from real account access
and physical hardware observations.

Evidence classes stay separate: (S) source/test (`npm run verify`, Playwright lanes,
bundle audit); (B) APK build and byte inspection; (E) emulator HOME-role and
instrumentation; (I) full AOSP image build and boot; (R) real integrations (accounts,
providers, OAuth grants); (D) physical-device and user acceptance. A result in one class
never stands in for another.

### Current qualification evidence

- Class S: `npm run verify` passed at `d3dc9977` / upstream `945209d3` on
  2026-10-10: 454 tests passed, four existing TODOs, zero failures or skips;
  typecheck, build and the 395-file production bundle audit passed.
- Class B: the same source built and verified all four standalone/launcher
  debug/release APKs, both instrumentation APKs and lint. The explicit
  unpackaged-runtime option and recorded unqualified speech input make these
  developer artifacts; unsigned releases are not distributable.
- Class E: the same source passed six journal/photo test cases across both variants
  on a disposable stock API 35 emulator. This covers encrypted journal persistence,
  Activity recreation, replay refusal, history redaction and seven photo filters.
  A cold-start test dispatch race was corrected with the existing document-readiness
  probe. Password save/fill remains unqualified: its separate native flow still
  fails before reaching save/unlock. Older emulator results remain historical.
- Classes I, R and D: these checks establish no AOSP image boot, real-integration,
  physical-device or user acceptance. HOME-role acceptance is also separate.
  Focused campaigns are in the [verification guide](verification.md).

## Remaining external items

These cannot be completed in software from this repository; they are prepared but open:

- Release signing key custody and signed release APKs (`ELIZAOS_*` signing values held by
  the release owner), plus signed OS image, OTA/update and rollback drill.
- App Links: publishing `assetlinks.json` on an owned domain with the release signer
  fingerprint, and verifying it on an installed signed build.
- Gmail OAuth: production client/consent configuration and a real account grant,
  revoke and recovery ([runbook](pilot-acceptance-runbook.md)). Deployment of the managed
  Gmail Cloud routes, including the pinned upstream read-state operations
  (read state stays unavailable until the server advertises `readState`).
- Cerebras key provisioning for the resident agent on pilot devices, without exposing the
  key in evidence.
- Password provider real-site save/fill/passkey on a recognized browser and signed build.
- Regional Maps production gateway (HTTPS `VITE_MAPS_BASE_URL`), data licence review and
  physical navigation.
- Emulator and physical-device upgrade from earlier installs that saved mock state.
- Resident redaction re-run on current APKs; physical speech, latency, battery and soak.
- Stakeholder decisions listed under [pending owner decisions](decisions.md#pending-owner-decisions),
  starting with powered-off scheduling (A-09) and the voice latency method (A-10); legal review
  of licence notices, including the Denton typeface; and the four-unit physical pilot.

The [completion plan](mvp-completion-plan.md),
[verification gates](verification.md), [Android/AOSP guide](android-and-aosp.md)
and [on-device agent plan](on-device-agent-plan.md) define the remaining work.
No historical result or documentation cleanup waives those requirements.
