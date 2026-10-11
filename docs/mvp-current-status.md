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
- The upstream pin in `upstream.lock.json` is `40dbe96bd1`, identical to elizaOS
  `develop` when `scripts/ci/upstream-reachability.json` was recorded (2026-10-10). It
  includes the shared password manager, password transfer and Keystore text frames; no
  local source patch remains (the `patches` directory is gone). Results recorded at the
  earlier pins `945209d3`, `4148a166` and `352d7a08` are historical. No APK build and no
  emulator run is recorded at the current pin: see
  [current qualification evidence](#current-qualification-evidence).
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
  [production readiness record](https://github.com/AlphaCompute/alphaphone/blob/51c8157533353a805afd2811f4e3f41b66b7b9fa/docs/production-readiness-2026-10-04.md).

## Capabilities and remaining acceptance

Evidence class codes in the last column follow the classes defined under
[Qualification](#qualification): S source/test, B APK build, E emulator, I AOSP image,
R real integration, D device/user. "Historical" means the class was observed only on an
older build or source revision and does not qualify the current head; a row without a
class has no evidence of that kind for the current head.

| Area | Implemented boundary | Remaining acceptance | Evidence class |
| --- | --- | --- | --- |
| Home and launcher | Branded Home with clock, agenda cards from real providers and a grid of the enabled Alpha views; the launcher flavor declares the `HOME`/`DEFAULT` filter; quick-setting tiles show the switch states Android reports and open the matching Android Settings page (see Settings). An All-apps drawer with search lists the apps `DeviceAppsPlugin` reports, launches one by package, opens the stock dialer, and shows explicit empty and failed states with a manual retry (`apps/app/src/prototype/home-launcher.ts`; `home-launcher.spec.ts` and `home-native-launcher.spec.ts`, both against a stubbed bridge). A landscape layout places Home and the composer side by side and docks the conversation beside Home (`home-landscape.spec.ts`); `app.config.json` leaves orientation unspecified. | Emulator HOME-role selection, opening three installed apps and returning HOME each time: `LauncherHomeInstrumentedTest` and `SettingsRolesInstrumentedTest` run only in the runner's `--home-role` phase and have no recorded run (class E); default HOME in a full image (class I) and physical use (class D). `RotationInstrumentedTest` has no recorded run. The rest of the installed-app library contract (favorites and order, exact component and profile identity, refresh on package change) is implemented on open PR #388, not on main (MVP-53). Whether rotation ships is [A-22](decisions.md#new-decision-items). | S; E historical only |
| Local startup and ownership | Native bridge, reproducible payload preparation, owner enrollment and private browser-host transport. Shared launcher preserves existing tokens and runtime-written configuration. | Current native IPC/process lifecycle, reboot, owner isolation and installed variant identity on the intended image. See [local setup](local-agent-development.md). | S; E historical only |
| Connection choices | Android production builds open a Welcome dialog for the on-device agent: sign in to Eliza Cloud for inference credits, or "Use local apps without AI", which reaches Home with no network and persists across restart. Production Android does not pair with or restore a remote or Cloud agent: the controller and `connectRemote` refuse it, the native transport rejects the pairing route and, in a flag-off build, every request whose origin is not exactly `https://api.eliza.app` (`ConnectionRoutes.java`; a dedicated Cloud agent host is refused too, because no production Android path connects a Cloud agent, pending A-16), and a saved remote credential is not read, written or removed. The saved selection itself is ignored and is replaced once the user chooses local apps or the resident agent starts. Cloud sign-out sends Cloud's self-revocation (`DELETE /api/v1/api-keys/current`) once and says "revoked" only when Cloud confirms it; otherwise it says the token was removed on this phone only. The production web build offers remote pairing over HTTPS and Continue offline; Cloud sign-in is stated as unavailable there and a saved Cloud selection or service is signed out without a request; that sign-out also deletes a stored `cloud:production` key from the browser's secret store, best effort, and no other slot. Remote disconnect revokes the device enrollment and owner session and reports an unconfirmed revocation as such. Resident, remote, local and Cloud connections negotiate verified phone actions at enrollment; a Cloud runtime that does not advertise them stays chat-only. Synthetic coverage: `test/browser/connection-boundaries.production.spec.ts`, `test/browser/connection.production.spec.ts`, `test/connection-routes.test.mjs`. | Cloud self-revocation has not run against live Eliza Cloud, and the native route guard, origin guard and DELETE admission are compiled and JVM-tested but not exercised in an APK or on a device. The web build cannot revoke a Cloud credential. Real-device wrong-owner/origin, expired and reused token, and callback tests; managed endpoint ([A-02](decisions.md#open-decisions)). | S |
| Chat and retained context | Typed conversations, selected-source context, reviewed actions with durable receipts, and conversation-bound local composer drafts with explicit conflict recovery. Stop closes the client stream, discards the late reply and, for resident, local and remote agents, asks the agent to cancel once through upstream's `POST /api/turns/:roomId/abort`; Cloud agents and agents without that route get the in-chat notice that the agent may still finish. Either way the chat shows the state and one read of the conversation shows the reply if it finished; nothing is resent. A dropped response is reconciled once by repeating the identical request under the same client message ID. The composer keeps the text through every failure before the message is posted (no agent, expired session, offline or rate-limited conversation setup, changed screen or owner, Stop before the post), and remote, Cloud and resident connections restore the saved conversation on connect (with older pages except on Cloud). A send that fails after the post is reported as an unknown outcome with a history check, never as unsent. | Emulator and device acceptance of draft, Stop, history and Back/HOME/keyboard continuity (browser source evidence only: `test/browser/chat-continuity.spec.ts`, `test/browser/assistant-draft-dispatch.spec.ts`). The read after Stop matches the stopped message by text and time because upstream history rows do not expose the client message ID; Cloud history has no older-page cursor and no cancel route. Broad model quality, missing-detail clarification, target-device performance and complete physical user journeys. | S; R local Cerebras (historical) |
| Speech and recording (J02) | Flag-off builds use Eliza Cloud for chat voice, Notes transcription and read-aloud (P-07; `apps/app/src/runtime/voice-selection.ts` returns the Cloud route whenever test mocks are off). Signed out, voice says that Cloud sign-in is needed and captures nothing (`production-surface.spec.ts`). Editable transcript review; separate Send, summary save and reminder draft. An ongoing Cloud conversation sends each new spoken turn (`chat-voice-mode.spec.ts`), which differs from P-01's record, review, send; the conflict is MVP-01 and is not resolved here. Owned playback rejects stale completions. Resident Browser reading retains native reviewed text and uses bounded local synthesis chunks. On-device Whisper and Kokoro code is packaged but is not the flag-off route. | Failed functional acceptance: `LocalSpeechInstrumentedTest` ran 2 tests on arm64-v8a and 1 failed (the synthesized sentence was recognized as "lady's" instead of "lazy"), so `functionalAcceptance.passed` is false in `android/local-speech/qualified-runtime-manifest.json` and x86_64 runtime execution is unverified. The cause is addressed by deterministic VITS synthesis in upstream PR #34743, now included in the pin; the unchanged test then passed on an arm64 Android emulator against a rebuilt runtime candidate that is recorded but not admitted. That emulator pass is not physical-device acceptance, and x86_64 still needs an x86_64 host or device. Packaged byte identity does not waive that failure. Both ABIs must pass before speech is accepted. Physical microphone/audio quality, Bluetooth/echo, language support, interruption and latency. Manual send means the latency method or six-second target must be settled first ([A-10](decisions.md#open-decisions)). Browser-build speech recognition is in scope; any cloud route requires disclosed opt-in. Host synthesis does not qualify Android playback or native permission behavior. | S; D failed on arm64-v8a (the physical Android 16 ARM64 device recorded under `nativeExecution`, x86_64 not executed) |
| Notes, Calendar and Reminders | Durable editing, selected reads, reviewed actions and recovery. Calendar shows only calendars held by the Android CalendarProvider (on the phone or synced there by an Android account) on Android, and the browser-local calendar in the web build; calendars connected through Eliza Cloud are not shown. Native Calendar and Reminders delegate to shared upstream plugins while retaining product storage and provider identity. | Current installed-data upgrade, timezone/recurrence, ambiguous writes, real provider and physical-device behavior. Notes Trash with automatic 3-day emptying covers text, checklist, link and voice notes (P-06): a voice note's recording is trashed, restored and erased with its Trash entry, and the native 30-day audio sweep is only a backstop. Device acceptance of Trash expiry remains open. Browser notification delivery is not alarm qualification. | S; E historical only |
| Browser persistence | Calendar, reminders/alarms and their creation/action histories, notification policy/history, hosted-result notices, workflow drafts and pending workflow requests, workflow notification receipts, conversation restart choices, Cloud setup intents, media saved-copy requests, bookmarks and notification sound history, device preferences and roles, the development password provider, photo album metadata and the development agent, execution, digest and Cloud documents use the upstream transactional document store. Revision-bound recovery preserves exact older bytes. The contracts and owning suites are in [browser-storage.md](browser-storage.md). | Engine-by-engine qualification of each domain on the integrated head, and the independent preferences and native Clock handoff history described in [browser-storage.md](browser-storage.md#independent-preferences). The development-only documents ship only in test-mocks builds. | S |
| Clock | Reviewed handoff to Android Clock with truthful opened semantics. | Actual ringing, snooze/dismiss, reboot, timezone and DND behavior; Clock owns final alarm creation. | S; E historical only |
| Typed workflows | Phone-authored workflows have manual triggers only (`apps/app/src/runtime/phone-workflow-authoring.ts` accepts `trigger.kind: 'manual'`). Bounded generated candidates, separate Use/Save/Run, approved device effects and retained results. Calls, SMS, payments, Contacts, arbitrary code and email to unnamed recipients are refused on the phone before any generation request when their wording is recognized (`apps/app/src/prototype/workflow-scope.ts` is a phrase filter; the typed catalog bounds everything else). A run or save request for which the agent reports no receipt has an explicit disposition: an owner-confirmed resend under its original identity (the agent applies one submission or mutation identity at most once; agents without submission identities are never sent a repeat), closure of a run request as not run once the workflow version has changed, or closure of an edit as not saved when the agent refuses it by identity. Interrupted runs are reported as outcome unknown (or worker still running) and are never replayed: side-effecting workflows stay blocked until each interrupted run is explicitly cancelled, removal first cancels them, and only a read-only digest offers a separately confirmed new run. | Broad model reliability, real interrupted-worker behavior on the resident runtime and current compiler/runtime release qualification. Arbitrary code and an unrestricted workflow IDE remain outside MVP. | S; E historical only |
| Notify and Speak | Native delivery ledger and executor; browser transactional notices and exact receipt recovery without reposting. | Native OS posting/audio and interrupted-delivery acceptance. Uncertain speech must not be replayed or inferred complete. | S; E historical only |
| Digests and schedules | Typed workflows are never scheduled: scheduled execution exists for digests, and prompt automations keep their own separately reviewed agent schedule. Local digest schedules, retained results, client-scoped acknowledgement and explicit outcome-unknown records after interrupted work. A scheduled time that passes while the host is not running is recorded once as missed and is never run later; the panel labels it as not run. The development scheduler (test-mocks builds only) follows the pinned agent's admission: one `unavailable` record and a paused schedule for a revoked or expired source, a 120-second run window, and each occurrence settled once across clock changes. | Real-provider interruption, native lock/battery/Doze, physical power loss and account-source routing. Preserving an unknown outcome does not establish automatic completion after a worker crash. `npm run agent:test-digest-restart` (a resident worker killed at an admission or execution boundary) passed once on the host with a synthetic model at upstream `352d7a08`; it has not been repeated at the current pin and is in no automated lane. In the product profile the Home brief text is overwritten by the workflow list; the dedicated brief card is on open PR #388 (MVP-19). Running while the phone is off is [A-09](decisions.md#pending-owner-decisions). | S |
| Browser and passwords | Isolated native browsing, reviewed reading, sensitive-source rejection and provider setup/status. Implemented for P-04: normal tabs keep sign-ins in one persistent browser profile (separate from the host profile) and restore after a cold start (engineering choice); private tabs are ephemeral; Clear browsing data and per-site clearing are confirmed; pop-ups open as tabs and app links hand off to Android. Integrated password manager (P-05, shared upstream module) supplies a Keystore-bound vault, Settings management and an Android Autofill provider with exact origin/app binding and a fresh unlock per fill; Browser Autofill is unavailable without native per-field origins; Show and Copy remain available. Proton Pass remains optional. | October 7 policy is decided, not accepted: P-04 still needs emulator/device runs of the sign-in, private-tab, pop-up and app-link instrumentation; P-05 is implemented, not device-accepted. BiometricPrompt, provider selection and save prompts still require device qualification. Passkeys are not implemented. Real-site password/passkey/autofill and installed isolated-world/consent behavior. Setup UI does not prove filling succeeds. | S; E historical only |
| Email/Gmail | In MVP scope ([P-02](decisions.md#october-7-owner-product-decisions)). Owner/grant-aware contracts with controlled provider-boundary coverage. Inbox loads on open and has Refresh, provider-cursor paging (Load more) and a Sent view (`in:sent`). It offers a confirmed disconnect, in Inbox and Settings → Connections, that reads back the account state. Failures are classified as offline, revoked or stale, each with an explicit Retry. Left swipe and the archive button both go through the reviewed archive flow. Share by email from Notes opens a prefilled local draft. Compose has a From switcher when more than one account is connected. The Home unread badge reflects loaded Inbox data. Opening a message marks it read through the reviewed `mark-read`/`mark-unread` operation when the server advertises `readState`. The send review lists From, To, Cc, Bcc, body and attachments and is confirmable only while the composer still holds exactly the reviewed draft; a provider-confirmed send removes the retained local copy; Trash and its undo are reviewed operations with the same unknown-outcome rule as send; a refused or mismatched attachment is never saved (`journey-f-reviewed-send.spec.ts`, `journey-f-email-notifications.spec.ts`, `inbox-hostile-attachment.spec.ts`, `scripts/test-inbox-sent-cleanup.mjs`; all against a synthetic provider). | Real Google OAuth (the code exchange currently returns 401), deployment of the managed Cloud routes, including the pinned upstream read-state operations, and a real mailbox: send/reply, label changes, revoke and response-loss recovery. Ambiguous sends are never retried. Shared Files/Photos items are not attached automatically. External messages require explicit recipient/message authorization. | S; R open (OAuth 401) |
| Files, camera, scans and media | Selected import/export, exact-byte media, scan correction and reviewed searchable PDF flows. On Android, Camera offers image selection through the system picker straight into scan review (nothing is copied to Photos) and the multi-page scan document builder (`camera-adapter.ts`, `scan-document.ts`). | Native provider/camera/storage access, real data volumes, OCR quality, fonts and product usability. OCR covers English only for now (October 7 policy). | S; E historical only |
| Poster to Calendar (J01) | Suggestions for explicit English dates, times, same-day ranges and labeled venues. With the device clock as reference, year-less and weekday dates, today/tomorrow, and printed IANA or UTC-offset times (converted, with the source zone shown) are suggested; dated posters without a time are suggested all-day and repeat wording is an unticked hint. Every inference is listed; separate Calendar review and Save remain the only write. Ambiguous numeric dates and zone abbreviations stay blank. | Arbitrary-photo OCR quality, broader languages and phrasing, and native provider acceptance. Suggestions never authorize saving. | S |
| Document analysis (J03) | Selected-content review, separate editable summary-note approval and verified source references. Changed/deleted source files fail closed. Native references use existing selected-document access only. | Live Gmail retrieval, installed permission retention/revocation, cross-process reopening and broad PDF/image task quality. Fingerprint-only sources require reselection. | S; E historical only |
| Schedule to travel (J04) and Maps | Selected event location enters Maps once; route choice and origin remain explicit. Stale search/navigation work is cancelled. "Back to event" returns to exactly the originating event (`maps-event-return.spec.ts`), and the travel-mode buttons expose their selected state. A flag-off build has no Maps provider (`VITE_MAPS_BASE_URL` is unset and the emulator gateway exists only in test-mocks builds), so the address reaches Maps and the user reads "Connect a Maps provider to search places and plan routes."; no route can be produced (`journey-core-loops.production.spec.ts`). | A production Maps provider and its licence, which no build has ([A-23](decisions.md#new-decision-items)); then production endpoint/TLS, licensed data coverage, location permissions, offline behavior and physical navigation. See [regional Maps setup](maps-regional-validation.md). | S; E historical only |
| Web research to note (J05) | Bounded public-page or pasted-text review, separate question Send and explicit note Save with a source link. | Installed native reading/consent and real-site coverage: `BrowserPageQuestionInstrumentedTest` covers the native excerpt up to Send and has no recorded run; the agent's answer and the note save after it have no native test. CORS-denied content needs user-supplied text; a link is provenance, not an immutable archive. | S |
| Design and accessibility | Themed bounded dialogs, visible actions, keyboard-scrollable content and large-text checks across core flows. | Complete current-source subviews, error/empty states, Pixel geometry, physical accessibility and user task acceptance. Browser assertions alone are not design approval. | S |
| Settings | Settings includes connection management, per-connection privacy disclosure, third-party licences and the password manager pages. Shade tiles and Settings rows show the Wi-Fi, Bluetooth, airplane mode, device location, mobile data and Do Not Disturb states that Android reports to an ordinary app, and each opens its own Android page (Wi-Fi, Bluetooth, mobile network, airplane mode, location, Do Not Disturb, display, sound, battery, app notifications, app permissions). Alpha changes none of them; the flashlight is the only direct control. To assistive technology a handoff tile is a button named with its reported state ("Wi-Fi, on, opens Android settings"), not a toggle; only the flashlight exposes a pressed state. A state Android does not report is labelled as a handoff, never as off. About shows the packaged version and Android's install time and states that Alpha does not check for updates. Settings offers no memory-erase control ([A-19](decisions.md#new-decision-items) is undecided). | Emulator and device qualification of each Android handoff and readback: the readable settings and the pages an image provides differ by Android version and vendor, and no run exists on the current APK. An update check waits on [A-06](decisions.md#pending-owner-decisions). | S; E historical only |
| Privacy and outbound context | Approval/context binding, native secure storage, contact references and credential redaction contracts. The resident Android agent starts with the upstream `ELIZA_SECRET_SWAP_ENABLED` and `ELIZA_PII_SWAP_ENABLED` switches on by default; the browser development host keeps both off unless both are set to `true` on qualified source. Privacy disclosure is per connection: hosted Cerebras inference is disclosed, and no connection claims that data stays local. Browser development storage is disclosed as unencrypted. | Re-run resident redaction on the current APK (emulator, then device, as separate gates) and broaden category/provider coverage. The host default stays off until its enablement campaign passes. Inspect the selected runtime's actual configuration; a past host snapshot does not prove present settings or that data stays local. | S; E historical only |
| Release | Pinned upstream source, standalone/HOME packaging and source-admitted runtime staging. Distribution builds exclude mock/fixture/developer surfaces and debug-only native hooks; release signing and version come from `ELIZAOS_KEYSTORE_PATH`, `ELIZAOS_KEYSTORE_PASSWORD`, `ELIZAOS_KEY_ALIAS`, `ELIZAOS_KEY_PASSWORD`, `ELIZAOS_VERSION_CODE` and `ELIZAOS_VERSION_NAME` (unsigned `*-release-unsigned.apk` without all four signing values). | No APK build is recorded at the current pin `40dbe96bd1`. The last recorded builds of all four developer APKs, instrumentation APKs and lint are at product commit `1de85a13` (pin `4148a166`, PR #385) and at `d3dc9977` (pin `945209d3`); round 5 compiled the Java of both flavors and their instrumentation at pin `352d7a08` without assembling an APK. Each used the recorded unqualified speech candidate and `--allow-unpackaged-runtime`, so none is distributable. Whether the pinned Calendar plugin compiles at `40dbe96bd1` is not re-verified at this source. A distribution build requires qualified speech assets, the staged resident runtime and the reviewed embedding host; speech functional acceptance failed (see the Speech row). Provisioning, pilot update and AOSP staging refuse a release that `verify-apks` does not mark distributable (`scripts/release-blockers.mjs`). Then: controlled release key and signed artifacts, installed-data upgrade from earlier (including mock-state) installs, image/hardware qualification, App Links verification on a real domain, signed update/rollback (rollback is not offered by `scripts/pilot-update.mjs`), support and pilot acceptance. | S; B historical only (developer APKs at earlier pins) |
| Licenses | Settings renders `apps/app/public/licenses/third-party-notices.json` (name, version, license, source, text, flags and what each flag obliges) with an explicit unavailable fallback; `THIRD_PARTY_NOTICES.txt` accompanies it and lists every flagged entry at the top. Open-source licences are included and flagged, and never stop a build or block a release ([P-09](decisions.md#october-10-owner-product-decision)): the committed notices have 109 entries, 15 flagged, and a run on the staged resident runtime at pin `40dbe96bd1` produced 660 entries, 66 flagged, exit 0 ([dependency audit](dependency-audit.md#licence-flags-p-09)). | Included and flagged is not legal review. Still open: review of the notices; meeting the obligations the flags name (corresponding source for the GPL, AGPL and LGPL components, a replaceable library for LGPL, network source offer for AGPL); the one resident-runtime package under non-commercial terms (`@metamask/sdk`); and the separate native-app/OS-image notices in [native-app distribution](native-app-distribution.md). The Denton typeface is proprietary with no licence recorded and remains the one named licence release blocker, printed by the bundle audit ([A-21](decisions.md#new-decision-items); [dependency audit](dependency-audit.md)). | S |
| Phone, SMS, Contacts and Wallet | Deferred by MVP policy. Source and design references are retained; app entries, `open_view` destinations and agent actions are disabled. Emergency calling stays with the system. | Restoring any of them needs a recorded scope change, then native role, permission, recipient and return-to-HOME acceptance; Wallet also needs provider, key custody and transaction-approval decisions ([A-08](decisions.md#open-decisions)). | not applicable |

## PRD requirement status

Status of each [PRD](prd.md) requirement, mirrored in `docs/requirements.json` and checked by
`test/docs-requirements-consistency.test.mjs`. Status describes software, not acceptance:
*implemented* (only acceptance in other classes remains), *partial* (named software gaps remain),
*deferred* (out of the MVP by policy) or *blocked* (needs an external decision or resource).

| Requirement | Status | Status rows | Next gate |
| --- | --- | --- | --- |
| AP-01 | partial | Home and launcher; Design and accessibility | E: the runner's HOME-role phase (SettingsRoles, LauncherHome) on the launcher APK, then D on the selected phone |
| AP-02 | partial | Home and launcher; Local startup and ownership; Connection choices; Release | B: four distribution APKs build at the current pin and pass scripts/verify-apks.mjs; then E: install both modes, open apps and return HOME repeatedly |
| AP-03 | partial | Connection choices; Local startup and ownership | R and D: real-device wrong-owner and wrong-origin, expired and reused token, and callback tests against the managed endpoint (A-02) |
| AP-04 | partial | Chat and retained context; Connection choices; Privacy and outbound context | E then D: resident process restart and reconnect without duplicate messages or writes; no inference-available claim without provider health evidence |
| AP-05 | partial | Chat and retained context; Design and accessibility | E: soft-keyboard resize, Back and HOME without keyboard obstruction on an installed APK; then D |
| AP-06 | partial | Speech and recording (J02) | Owner: voice send and route policy (MVP-01) and whether on-device speech is still required (A-24); then R: Cloud speech with a signed-in account, and D: physical audio, interruption and latency (A-10) |
| AP-07 | partial | Home and launcher; Digests and schedules | S: the daily-overview cards and brief card on open PR #388 reach main (MVP-19); then R: real provider agenda and digests with loading, empty, stale and error states; then D |
| AP-08 | deferred | Phone, SMS, Contacts and Wallet | A recorded scope change, then native role, permission and return-to-HOME acceptance |
| AP-09 | partial | Email/Gmail; Notes, Calendar and Reminders | R: real Google OAuth grant, managed Cloud Gmail routes and a real mailbox; E: Calendar CRUD and agent CRUD instrumentation read back from CalendarProvider |
| AP-10 | partial | Browser and passwords; Files, camera, scans and media; Schedule to travel (J04) and Maps; Notes, Calendar and Reminders | E: browser sign-in, private-tab, pop-up and app-link instrumentation (P-04) and password-manager fill (P-05); Owner: a production Maps provider (A-23); then R and D |
| AP-11 | partial | Typed workflows; Digests and schedules | E then D: interrupted-worker behavior on the resident runtime with real receipts |
| AP-12 | partial | Settings; Privacy and outbound context; Licenses | E: each Android settings handoff and readback on an installed APK (SettingsSystemFacts, SettingsNative, SettingsFlow, SettingsRoles, NotificationChannels) |
| AP-13 | deferred | Phone, SMS, Contacts and Wallet | Provider, key custody, device security and transaction-approval decisions (A-08) before any work |
| AP-14 | blocked | Release | I and D: exact source, blob, kernel and signer lock, hardware checklist and recovery test; blocked on hardware (A-01) and signing authority (A-06) |
| AP-15 | partial | Design and accessibility; Home and launcher | E: Accessibility, TextScale and Rotation instrumentation; then D: TalkBack, large font, touch and keyboard, offline, killed process, rotation and repeated HOME navigation |

## Qualification

Run `npm run verify` and the Android build (`npm run android:build:local`; plain
`npm run android:build` stops before Gradle when an input is missing), including standalone
and launcher debug/release outputs. The production-surface gates are:

| Gate | Command | What it qualifies | What it does not qualify |
| --- | --- | --- | --- |
| Production bundle audit | `node scripts/audit-production-bundle.mjs web-dist` (`--expect-test-mocks` for a deliberate test-mocks build) | The web bundle has no mock/developer strings, fixture names, `img/` fixture images or source maps, and `web-dist/build-flags.json` reports `testMocks: false`. | Runtime behavior, APK contents (see below) or any device result. |
| Production browser lane | `npm run test:browser:production` | Rendered production build (switch off): no mock choice, no `?mode=mock`/`?fixture=1`/`?mode=dev`/`?start=` entry, no device controls; honest empty and unconnected states; legacy `{kind:'mock'}` selection opens the chooser. | Android WebView, native plugins or real accounts. |
| APK verification | `node scripts/verify-apks.mjs` (run by `npm run android:build`) | APK bytes for all four distribution APKs: identities, HOME filter, debug flags and signatures, no test-mock native classes, cleartext config or fixture-package queries, and the bundle audit on each APK's extracted `assets/public`. | Installation, emulator HOME role, image boot or device behavior. |
| Head qualification | `node scripts/qualify-head.mjs` | Repository verification, distribution builds and their audits for the exact checked-out commit. | Any later commit, hosted CI, emulator, AOSP image, real integration or device acceptance. |
| Core loop journeys | `npx playwright test test/browser/journey-<id>-<slug>.spec.ts --project=chromium --workers=2`; flag-off: `npx playwright test test/browser/journey-core-loops.production.spec.ts --project=production` | Each loop A–F and J01–J05 driven through rendered controls with the development profile and synthetic providers, and what each loop does in the flag-off bundle with the Android bridge stubbed ([core loop status](core-loop-status.md), [core loop audit](core-loop-audit.md)). | A real agent, account, provider, native plugin, APK, emulator or device. |
| Emulator instrumentation | `npm run test:android:instrumentation -- --owned-emulator --avd <avd> --serial emulator-NNNN` and the campaign runners listed in the [verification guide](verification.md) | Class E results bound to the commit and the installed APK hashes, per class. | Device or user acceptance, a custom image, or real accounts. No run is recorded at the current source. |

Results for these gates at the October 4 integrated head (source/test and APK build classes
only) are in the archived
[production readiness record](https://github.com/AlphaCompute/alphaphone/blob/51c8157533353a805afd2811f4e3f41b66b7b9fa/docs/production-readiness-2026-10-04.md#integrated-head-qualification).
That record was removed from the tree in PR #385 and describes an older source and pin; it
qualifies nothing at the current head.

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

Recorded for the ledger refresh of 2026-10-10 on branch `claude/r6-ledger`, based on
`4ec513b1` (open PR #389, which contains main at `d9a081e3`), upstream pin `40dbe96bd1`.

- Class S: `npm run verify` exited 0 at `fdac4ea1` on this branch on 2026-10-10: 548 tests,
  544 passed, 0 failed, 0 skipped, 4 TODO; typecheck, the flag-off build and the production
  bundle audit passed (395 files, `testMocks=false`), and the audit printed the Denton
  licence release blocker. That commit differs from this record only by this paragraph. Ten journey specs, the flag-off journey spec and
  the per-step classification are in [core loop audit](core-loop-audit.md): of 140 steps
  that this repository, an emulator or CI can close, 105 have a test (75%), 30 need an
  emulator run and 5 a hosted CI run; 23 further steps need a person and 13 a phone. That
  percentage measures class S evidence, not completion on a phone. The Playwright suites
  were not re-run for this refresh; PR #389 records its own runs.
- Class B: none at the current pin. The last recorded developer APK builds are at
  `1de85a13` (pin `4148a166`) and `d3dc9977` (pin `945209d3`). They used the explicit
  unpackaged-runtime option and the recorded unqualified speech input; unsigned releases
  are not distributable.
- Class E: none at the current source. The last committed emulator result is six
  journal/photo test cases across both variants on a disposable stock API 35 emulator at
  `d3dc9977` (encrypted journal persistence, Activity recreation, replay refusal, history
  redaction and seven photo filters); it is historical. Password save/fill was recorded
  there as failing before save/unlock and has not been re-run. An emulator campaign is in
  progress on branch `claude/r3-packaging`: at `73b973a5` that branch has committed test
  and runner repairs made after its first runs and no result record, so it supplies no
  evidence yet.
- CI: no passing run of the `native` or `recovery-ui` job of
  `.github/workflows/resident-android.yml` is recorded for the current source.
- Classes I, R and D: none. No AOSP image has been booted, no real account or provider
  has been used and no physical-device or user acceptance exists. HOME-role acceptance is
  also separate. Focused campaigns are in the [verification guide](verification.md); the
  commands that close each open step are in
  [core loop audit](core-loop-audit.md#emulator-and-ci-campaigns), and what only the owner
  can do is in [owner actions](mvp-owner-actions.md).

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
- A production Maps provider: none is configured in any flag-off build, and choosing and
  licensing one is pending decision A-23. Then the regional gateway (HTTPS
  `VITE_MAPS_BASE_URL`), data licence review and physical navigation.
- Emulator and physical-device upgrade from earlier installs that saved mock state.
- Resident redaction re-run on current APKs; physical speech, latency, battery and soak.
- Stakeholder decisions listed under [pending owner decisions](decisions.md#pending-owner-decisions),
  starting with powered-off scheduling (A-09) and the voice latency method (A-10); review
  of the flagged licence notices (P-09 makes them non-blocking, not reviewed) and the Denton
  typeface (A-21); and the four-unit physical pilot.
- Emulator and hosted CI campaigns: 30 core-loop steps need an emulator run and 5 a
  dispatched `resident-android.yml` run; none has a result at the current source.

The complete, ordered list of what only the owner or a person with access or hardware can
do is [owner actions](mvp-owner-actions.md).

The [completion plan](mvp-completion-plan.md),
[verification gates](verification.md), [Android/AOSP guide](android-and-aosp.md)
and [on-device agent plan](on-device-agent-plan.md) define the remaining work.
No historical result or documentation cleanup waives those requirements.
