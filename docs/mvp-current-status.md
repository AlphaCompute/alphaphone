# Current MVP status

The MVP is not complete. This index separates implemented capabilities from
remaining acceptance work. Source ownership is defined in
[architecture.md](architecture.md); browser capabilities and their limits are
listed in [browser-dev-parity.md](browser-dev-parity.md) and
[mvp-browser-review.md](mvp-browser-review.md).

## Product boundaries

- The primary agent runs on Android. Browser development uses a private local
  host. Cloud and remote pairing are optional paths, not local-startup prerequisites.
- Local orchestration does not imply local inference. The configured text model
  uses hosted Cerebras; Whisper/Kokoro speech has separate host and Android paths.
- A powered-off phone cannot run its resident agent. Acceptance of missed-occurrence
  recovery in place of powered-off execution remains an explicit product decision.
  Optional remote execution needs separate qualification.
- Notes, Calendar, Reminders, Browser/password-provider integration, notifications,
  assistance, workflows, digests, Files and capture remain in scope. Gmail remains
  an integration gap. Phone, SMS, Contacts and Wallet are deferred by MVP policy;
  development fixtures do not change that scope.
- Production builds are the live app. Mock mode, prototype fixtures, the development
  profile, device controls, simulated apps and debug-only native hooks exist only in
  builds made with `ELIZA_DEV_ALLOW_TEST_MOCKS=1` (`npm run dev`, Playwright, explicit
  test-mocks builds). The production web build and all four distribution APKs are built
  with the switch off. The web build is a development/preview surface and the APK
  payload, not a separate product. See the
  [production readiness record](production-readiness-2026-10-04.md).

## Capabilities and remaining acceptance

| Area | Implemented boundary | Remaining acceptance |
| --- | --- | --- |
| Local startup and ownership | Native bridge, reproducible payload preparation, owner enrollment and private browser-host transport. Shared launcher preserves existing tokens and runtime-written configuration. | Current native IPC/process lifecycle, reboot, owner isolation and installed variant identity on the intended image. See [local setup](local-agent-development.md). |
| Chat and retained context | Typed conversations, selected-source context, reviewed actions, cancellation and durable receipts. | Broad model quality, missing-detail clarification, target-device performance and complete physical user journeys. |
| Speech and recording (J02) | Editable transcript review; separate Send, summary save and reminder draft. Owned playback rejects stale completions. Resident Browser reading retains native reviewed text and uses bounded local synthesis chunks. | Physical microphone/audio quality, Bluetooth/echo, language support, interruption and latency. Host synthesis does not qualify Android playback or native permission behavior. |
| Notes, Calendar and Reminders | Durable editing, selected reads, reviewed actions and recovery. Native Calendar and Reminders delegate to shared upstream plugins while retaining product storage and provider identity. | Current installed-data upgrade, timezone/recurrence, ambiguous writes, real provider and physical-device behavior. Browser notification delivery is not alarm qualification. |
| Browser persistence | Calendar, reminders/alarms and their creation/action histories, notification policy/history, hosted-result notices, workflow drafts and pending workflow requests, workflow notification receipts, conversation restart choices, Cloud setup intents, media saved-copy requests, bookmarks and notification sound history, device preferences and roles, the development password provider, photo album metadata and the development agent, execution, digest and Cloud documents use the upstream transactional document store. Revision-bound recovery preserves exact older bytes. The contracts and owning suites are in [browser-storage.md](browser-storage.md). | Engine-by-engine qualification of each domain on the integrated head, and the remaining renderer stores (connection selection and Cloud environment, simulated location, the Clock handoff record) listed in the [remaining persistence audit](browser-storage-remaining-audit.md). The development-only documents ship only in test-mocks builds. |
| Clock | Reviewed handoff to Android Clock with truthful opened semantics. | Actual ringing, snooze/dismiss, reboot, timezone and DND behavior; Clock owns final alarm creation. |
| Typed workflows | Bounded generated candidates, separate Use/Save/Run, approved device effects and retained results. Calls, SMS, payments, Contacts, arbitrary code and email to unnamed recipients are refused on the phone before any generation request. Interrupted runs are reported as outcome unknown (or worker still running) and are never replayed: side-effecting workflows stay blocked until each interrupted run is explicitly cancelled, removal first cancels them, and only a read-only digest offers a separately confirmed new run. | Broad model reliability, real interrupted-worker behavior on the resident runtime and current compiler/runtime release qualification. Arbitrary code and an unrestricted workflow IDE remain outside MVP. |
| Notify and Speak | Native delivery ledger and executor; browser transactional notices and exact receipt recovery without reposting. | Native OS posting/audio and interrupted-delivery acceptance. Uncertain speech must not be replayed or inferred complete. |
| Digests and schedules | Local schedules, retained results, client-scoped acknowledgement and explicit outcome-unknown records after interrupted work. | Real-provider interruption, native lock/battery/Doze, physical power loss and account-source routing. Preserving an unknown outcome does not establish automatic completion after a worker crash. |
| Browser and passwords | Isolated native browsing, reviewed reading, sensitive-source rejection and provider setup/status. Password entry and filling stay with Android/provider. | Real-site password/passkey/autofill and installed isolated-world/consent behavior. Setup UI does not prove filling succeeds. |
| Gmail and accounts | Owner/grant-aware contracts and controlled provider-boundary coverage. | Real authorization, durable results, revoke/recovery and ambiguous sends. External messages require explicit recipient/message authorization. |
| Files, camera, scans and media | Selected import/export, exact-byte media, scan correction and reviewed searchable PDF flows. | Native provider/camera/storage access, real data volumes, OCR quality, languages/fonts and product usability. |
| Poster to Calendar (J01) | Suggestions for explicit English dates, times, same-day ranges and labeled venues. With the device clock as reference, year-less and weekday dates, today/tomorrow, and printed IANA or UTC-offset times (converted, with the source zone shown) are suggested; dated posters without a time are suggested all-day and repeat wording is an unticked hint. Every inference is listed; separate Calendar review and Save remain the only write. Ambiguous numeric dates and zone abbreviations stay blank. | Arbitrary-photo OCR quality, broader languages and phrasing, and native provider acceptance. Suggestions never authorize saving. |
| Document analysis (J03) | Selected-content review, separate editable summary-note approval and verified source references. Changed/deleted source files fail closed. Native references use existing selected-document access only. | Live Gmail retrieval, installed permission retention/revocation, cross-process reopening and broad PDF/image task quality. Fingerprint-only sources require reselection. |
| Schedule to travel (J04) and Maps | Selected event location enters Maps once; route choice and origin remain explicit. Stale search/navigation work is cancelled. | Production endpoint/TLS, licensed data coverage, location permissions, offline behavior and physical navigation. See [regional Maps setup](maps-regional-validation.md). |
| Web research to note (J05) | Bounded public-page or pasted-text review, separate question Send and explicit note Save with a source link. | Installed native reading/consent and real-site coverage. CORS-denied content needs user-supplied text; a link is provenance, not an immutable archive. |
| Design and accessibility | Themed bounded dialogs, visible actions, keyboard-scrollable content and large-text checks across core flows. | Complete current-source subviews, error/empty states, Pixel geometry, physical accessibility and user task acceptance. Browser assertions alone are not design approval. |
| Privacy and outbound context | Approval/context binding, native secure storage, contact references and credential redaction contracts. The resident Android agent starts with the upstream `ELIZA_SECRET_SWAP_ENABLED` and `ELIZA_PII_SWAP_ENABLED` switches on by default; the browser development host keeps both off unless both are set to `true` on qualified source. Privacy disclosure is per connection: hosted Cerebras inference is disclosed, and no connection claims that data stays local. Browser development storage is disclosed as unencrypted. | Re-run resident redaction on the current APK (emulator, then device, as separate gates) and broaden category/provider coverage. The host default stays off until its enablement campaign passes. Inspect the selected runtime's actual configuration; a past host snapshot does not prove present settings or that data stays local. |
| Release | Pinned upstream source, standalone/HOME packaging and source-admitted runtime staging. Distribution builds exclude mock/fixture/developer surfaces and debug-only native hooks; release signing and version come from `ELIZAOS_KEYSTORE_PATH`, `ELIZAOS_KEYSTORE_PASSWORD`, `ELIZAOS_KEY_ALIAS`, `ELIZAOS_KEY_PASSWORD`, `ELIZAOS_VERSION_CODE` and `ELIZAOS_VERSION_NAME` (unsigned `*-release-unsigned.apk` without all four signing values). | Controlled release key and signed artifacts, installed-data upgrade from earlier (including mock-state) installs, image/hardware qualification, App Links verification on a real domain, signed update/rollback, support and pilot acceptance. |
| Licenses | Settings renders `apps/app/public/licenses/third-party-notices.json` (name, version, license, source, text) with an explicit unavailable fallback; `THIRD_PARTY_NOTICES.txt` accompanies it. | Legal review of the generated notices, corresponding-source offers where required, and the separate native-app/OS-image notices in [native-app distribution](native-app-distribution.md). |

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

Evidence classes stay separate: (1) source/test (`npm run verify`, Playwright lanes,
bundle audit); (2) APK build and byte inspection; (3) emulator HOME-role and
instrumentation; (4) full AOSP image build and boot; (5) real integrations (accounts,
providers, OAuth grants); (6) physical-device and user acceptance. A result in one class
never stands in for another.

## Remaining external items

These cannot be completed in software from this repository; they are prepared but open:

- Release signing key custody and signed release APKs (`ELIZAOS_*` signing values held by
  the release owner), plus signed OS image, OTA/update and rollback drill.
- App Links: publishing `assetlinks.json` on an owned domain with the release signer
  fingerprint, and verifying it on an installed signed build.
- Gmail OAuth: production client/consent configuration and a real account grant,
  revoke and recovery ([runbook](pilot-acceptance-runbook.md)).
- Cerebras key provisioning for the resident agent on pilot devices, without exposing the
  key in evidence.
- Password provider real-site save/fill/passkey on a recognized browser and signed build.
- Regional Maps production gateway (HTTPS `VITE_MAPS_BASE_URL`), data licence review and
  physical navigation.
- Emulator and physical-device upgrade from earlier installs that saved mock state.
- Resident redaction re-run on current APKs; physical speech, latency, battery and soak.
- Stakeholder decisions (powered-off scheduling, Email scope), legal review of licence
  notices, and the four-unit physical pilot.

The [completion plan](mvp-completion-plan.md),
[verification gates](verification.md), [Android/AOSP guide](android-and-aosp.md)
and [on-device agent plan](on-device-agent-plan.md) define the remaining work.
No historical result or documentation cleanup waives those requirements.
