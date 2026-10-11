# Verification guide

Verification applies to the exact source revision, upstream pin and artifacts tested.
This guide defines the gates; it is not a passing test report. See the
[current capability status](mvp-current-status.md), [completion plan](mvp-completion-plan.md)
and [pilot runbook](pilot-acceptance-runbook.md) for remaining product acceptance.

## Source and packaging

Run `npm ci` and `npm run verify` with the toolchain documented in the README.
Prepare the pinned speech assets using [local speech setup](../scripts/local-speech/README.md),
then run `npm run agent:prepare`, `npm run agent:build-workflow-worker`,
`npm run agent:stage-android` and `npm run android:build` with JDK 21 and the configured Android SDK. Plain
`npm run android:build` requires an earlier `npm run agent:prepare` and, for release
verification, `npm run agent:stage-android`.
Validate standalone and launcher distributions, each as debug and unsigned release,
including instrumentation builds, lint and APK inspection. A partial `ELIZAOS_KEYSTORE_*`/
`ELIZAOS_KEY_*` set fails the build. `verify-apks` marks a release distributable only when it
is signed by the certificate recorded in `android/release-signer.json` (`unset` until the
release keys exist) and its versionCode exceeds that file's last recorded release; a signed
release with another certificate or a non-advancing versionCode fails verification.
The committed notices carry only the umbrella runtime entry, so a staged runtime in a
development checkout never makes them stale. `node scripts/generate-licenses.mjs --packaged-runtime`
adds Bun (with its JavaScriptCore LGPL notice and source offer) and every npm package bundled
into the staged agent and workflow worker; the resident workflow runs it after staging, and an
APK built without that step does not carry those notices, and `verify-apks` never marks such a
release distributable. `--check` lists the staged runtime's
entries when one is present. Record the product commit,
`upstream.lock.json` revision, generated input provenance and APK hashes.
Unsigned release APKs require controlled signing before distribution.
The gates downstream of `verify-apks` read that record back through
`scripts/release-blockers.mjs` and name every unresolved blocker: pilot provisioning and
update (`scripts/provision-unit.mjs`, `scripts/pilot-update.mjs`) and AOSP staging
(`scripts/stage-aosp.mjs`) refuse a release that is not distributable, and
`scripts/qualify-head.mjs` records the blockers and reports `releasesDistributable: false`
while one remains. Only the debug emulator rehearsal (`--build debug`) and `--development`
staging of a debug APK proceed without a distributable release, and both are decided from
the APK file, not only its manifest row: `--development` refuses a non-debuggable APK that has
no distributable release row (a missing manifest, a row for other bytes or a row relabelled
`debug` admits nothing), and provisioning and update refuse an APK whose own web-bundle flag,
build type, packaged runtime or signing certificate contradicts the row that admitted it.
`apk-manifest.json` is an unsigned record: speech qualification and licence blockers cannot be
re-derived from the APK, so for those the manifest written by `verify-apks` is the evidence and
must come from the build being installed.

## Browser behavior

Run `npm run test:browser` for the affected flows and inspect the generated reports
and screenshots under `test-results/`. The browser workflow also exercises storage
contracts in Firefox and WebKit. Record the browser, project, test selection and
fixture profile. `scripts/storage-specs.mjs` is the shared storage-spec inventory
for browser lanes and `scripts/qualify-head.mjs`. Qualification requires every
listed spec to execute, passing terminal attempts, matching report counts and no
runner errors, skipped tests or flaky results. A simulated adapter test verifies
its contract, not a live provider.
Visual acceptance requires decoded reference assets and comparable capture geometry;
see [visual verification](prototype-visual-verification.md).

## Android and integrations

Aggregate smoke suites and CI smoke jobs were removed at the owner's request.
For separate native acceptance, use an owned disposable emulator to exercise both APK
variants, native bridge behavior and actual launcher HOME selection and restoration.
Retain terminal instrumentation results and cleanup outcomes. A build or successful
install cannot substitute for these checks.

`npm run test:android:instrumentation -- --owned-emulator --avd <name> --serial emulator-NNNN`
is the one documented instrumentation runner. It refuses physical devices and an
emulator that already has Alpha installed, takes the shared device lease, and for each
variant (standalone, then launcher; they share one package) installs the verified
debug APK with its instrumentation APK (`artifacts/instrumentation/<variant>-androidTest.apk`,
hashed in `apk-manifest.json`), checks the installed bytes, runs each class in its own
`am instrument` process with its explicit opt-in arguments, and uninstalls only what it
installed. `--classes NoMockProduct,Shell,StartupReadiness` names classes (short names
are expanded); the default list covers the product-surface classes; `--all` runs the
whole androidTest suite in one process; `--test-mocks` uses the separate
`artifacts/test-mocks/` pair for fixture-dependent classes such as BrowserAutofill
and the browser loopback cases. `<output>/results.json` (via
`scripts/instrumentation-result.mjs`) records per-class `passed`, `failed`, `skipped`
(every method skipped by its own assumption gate) or `missing`, bound to the commit, a
dirty flag and every installed APK's SHA-256, with raw output per class. It is labelled
emulator class E evidence and is never device or user acceptance. Process-death,
permission-changing and provider-credential campaigns (ReminderTapProcessDeath,
WorkflowNoticeProcessDeath, NotificationChannels, VoicePermissionDenied,
VoicePermissionRevoke, LocalVoiceRecordingLimit, ResidentEgressRedaction) are refused
there with the command of the campaign that owns them; text-scale, bookmark and sign-in restart
phases run through `scripts/test-native-restart.mjs`. Classes that assume a test-mocks app
build (ConnectionChooser, BrowserWebFeatures, CloudVoice and the other loopback-fixture
classes) are refused without `--test-mocks` instead of reporting `skipped`. The reading
classes that give the product a loopback HTTP speech route (BrowserReading,
BrowserSensitiveReading, BrowserIsolatedReading, BrowserUnsupportedReading) are among them:
a build without test mocks answers "Select an available speech route before reading" first,
which is the correct refusal when no HTTPS route exists.

Classes that assert a disposable secondary Android user (HostedProcessRestart,
HostedBackgroundWorker; both also need `--test-mocks` for their loopback HTTP fixture) run in
the runner's secondary-user phase. Per variant it creates a fresh user with the upstream
lifecycle helper the permission, restart and Calendar campaigns use, makes the two installed
packages available to it (`cmd package install-existing --user N`), runs each class and each
of its phases there (`am instrument --user N`), removes the packages from that user and lets
the helper switch back to the owner and remove the user. `results.json` lists each such user
under `secondaryUsers`; a user that is not proven removed fails the run and the console names
the recovery command. RealClock needs AOSP Clock's own notification permission, which the
runner grants (`grantOther` in the registry); the fixture is qualified for API 35 only.

`--home-role` is the runner's one phase that changes a device role, and it runs only with
`--owned-emulator` on the launcher variant:
`npm run test:android:instrumentation -- --owned-emulator --avd <name> --serial emulator-NNNN --variants launcher --home-role --classes SettingsRoles,LauncherHome`.
It requires one stock HOME app to hold the role before the run, runs SettingsRoles (which
removes the role, declines and accepts Android's own dialog and restores what it found),
selects the launcher APK with `cmd package set-home-activity`, force-stops it and requires
the HOME key to bring it to the foreground, runs LauncherHome (All-apps drawer, Settings,
the stock dialer, three installed apps with HOME returning each time, Android Settings and
the default-Home chooser still reachable), then puts the original holder back and reads it
back before uninstalling. LauncherHome and SettingsRoles are refused without `--home-role`,
so they cannot be reported as skipped. `results.json` records the original holder, the cold
HOME start and the restoration under `homeRole`; a run is not a pass without both. If the
original holder cannot be proven restored the run fails, nothing is uninstalled,
`home-role-recovery.json` gives the exact recovery command, and the emulator must not be
reused or deleted until it is recovered. This is emulator HOME-role evidence only: not
boot-time HOME, a custom image, or the recovery and emergency routes of a phone.

`test/android-instrumentation-runner.test.mjs` keeps the instrumentation sources reachable:
every class with an `@Test` method under `android/app/src/androidTest` or
`android/app/src/testMocks/androidTest` must have a `CLASS_REGISTRY` entry, be named by one
of the `CAMPAIGN_RUNNERS` scripts, or be listed in `NOT_RUN_BY_A_RUNNER` with the reason
(all three are in `scripts/android-instrumentation.mjs`). A new class with none of these
fails `npm test`, and so does a listed class that has since gained a runner. AccessibilityInstrumentedTest
(ATF plus TalkBack-order checks at 200% font) and RotationInstrumentedTest (which needs
the landscape layout and fails, not skips, without it) run through the same runner. See the [Android/AOSP guide](android-and-aosp.md)
and README for isolated Calendar and reminder regression/upgrade campaigns.

For native browser changes, qualify HTTPS navigation, back/forward/reload,
loading/title/address state, tab/profile isolation, and background/process recovery
on both variants. Exercise TLS failures, disallowed redirects and offline retry
against controlled endpoints. Verify renderer/profile capability admission and
that remote content cannot paint over or receive touches through host controls,
sheets or the keyboard. Phone geometry and real provider behavior require their
own evidence; desktop screenshots cannot establish native isolation.

Calendar CRUD cases run through `scripts/test-calendar-regression.mjs` with
`--case=CalendarCrudInstrumentedTest` or `--case=CalendarAgentCrudInstrumentedTest`.
Set `ALPHA_CALENDAR_TEST_SERIAL`, `ALPHA_CALENDAR_TEST_AVD`, and
`ALPHA_CALENDAR_TEST_ABI` for the owned disposable emulator. Both distributions
run by default; `--variant=standalone` or `--variant=launcher` selects one.
These cases use the built app/test APKs, isolated-user Calendar grants, and
retained instrumentation and cleanup evidence.

The native workflow campaign uses `node scripts/android-workflow-native.mjs` with
`ANDROID_SERIAL`, `ALPHA_WORKFLOW_TEST_AVD`, `ALPHA_WORKFLOW_TEST_ABI`, and
`ALPHA_BUILD_ARCHIVE`. The archive must contain both distributions' debug and
instrumentation APKs plus their filename-to-SHA256 `apk-manifest.json`. Evidence
is written to a new `ALPHA_CAMPAIGN_OUTPUT` directory beneath `test-results/`.
Set `ALPHA_TEST_HOME_PACKAGE` when the image’s stock launcher differs from
`com.android.launcher3` (for example, `com.google.android.apps.nexuslauncher` on
Google APIs images). This also applies to Calendar and permission campaigns.
The runner refuses existing product package registrations, leases the emulator,
and runs each exact method in a fresh secondary user. It retains the fixture if
package termination or cleanup cannot be proven. These synthetic read/draft tests
do not establish paired-host workflow execution.

Native permission, restart, one-off reminder, and recurrence runners share
`scripts/native-test-fixture.mjs`: AlphaPhone owns the exact archived APK pair
and SDK configuration; upstream owns the emulator lease, isolated user, strict
instrumentation admission, and cleanup. Set `ANDROID_SERIAL`,
`ALPHA_NATIVE_TEST_AVD`, `ALPHA_NATIVE_TEST_ABI`, and the fixture's stock
`ALPHA_TEST_HOME_PACKAGE`. Supply archived app/test APK paths and a fresh output
directory. Permission changes apply only to the temporary user; successful
cleanup removes that user and restores owner 0. `user-verification.json` records
the shared lifecycle, `verification.json` the instrumentation and package
cleanup, and `result.json` the product scenario. Deferred cleanup is a failure
requiring explicit recovery of the owned fixture.

`node scripts/test-native-permissions.mjs <scenario> APP.apk TEST.apk NEW_OUTPUT` sets the
permission before the app process starts and runs one exact method:

| Scenario | Permission state | What runs |
| --- | --- | --- |
| `camera` | CAMERA revoked | denial and explicit retry without a fake preview |
| `settings` | fine location revoked, coarse granted | Accounts handoff and location accuracy readback |
| `channels` | POST_NOTIFICATIONS granted | a blocked channel read back, user recovery and a real notification |
| `voice` | RECORD_AUDIO revoked | the denied recorder state, Open app settings and back, no capture file, typing in the composer still works |
| `voice-revoke` | RECORD_AUDIO granted, revoked while recording, granted again | four phases in separate processes: a baseline capture; a capture during which the runner runs `pm revoke` and requires Android to end that process mid-test; a new process that finds no capture file, no active recording and no note audio; and a capture after the grant is restored |
| `voice-limit` | RECORD_AUDIO granted | the recorder stops at its limit with the full duration decodable |
| `notice` | POST_NOTIFICATIONS granted | a redacted result notice is posted, tapped and consumed once across recreation |
| `notice-denied` | POST_NOTIFICATIONS revoked | the result stays in encrypted history, no notice is posted and none is pending |

Revoking a runtime permission kills the app process, and instrumentation runs in it, so
`voice-revoke` never asks one process to observe both sides and never force-stops the app to
imitate the kill: a recording process that survives `pm revoke` fails the campaign.
`result.json` records the revocation under `revocation`. The temporary user is removed with
its grants, so nothing is restored afterwards. None of this is microphone, speaker or
notification behaviour on a phone.

Process-restart campaigns use `node scripts/test-native-restart.mjs` with `inbox`,
`notes`, `document`, `text-scale`, `tree`, `bookmark`, or `signin`, a matching archived APK pair and a new output directory.
Use the owned-emulator configuration in the README. Require successful prepare,
restore/verify and cleanup phases; Notes and Inbox reports also require distinct
process IDs. Selected-file, text-scale, folder and bookmark native tests assert process boundaries themselves.
The bookmark case also force-stops before `verifyRemoved`, requiring removal to
survive a second process restart.
Activity recreation alone is insufficient. These campaigns are no longer automatic CI
checks. Browser campaigns require a supported WebView; the stock API 35 provider
lacks the browsing-data deletion capability required by bookmark navigation.
Retain provider admission and native phase evidence separately.

Argument-gated instrumentation methods can be skipped by a full-suite invocation.
Use the exact method and explicit gate documented in its current runner/test source;
require matching start/completion identities, a successful terminal result and no
assumptions. A class listing, source count or `OK` summary does not prove the gated
flow ran. Tests needing synthetic providers or debug hooks require separately
archived test-mocks APKs. Their results cannot qualify flag-off production behavior.

Qualify real integrations separately with authorized test accounts and explicit
user actions. Record account scope without secrets, the actual operation, provider
readback, cancellation/revocation behavior and ambiguous-outcome reconciliation.
Do not count a handoff, fixture response or unavailable-provider branch as successful
provider execution. Native recording, actual captured speech and transcription also
require separate evidence; an audio injection request alone does not prove capture.

## Image, release and user acceptance

AOSP staging validates inputs; full image acceptance requires building and booting
that exact custom image and verifying its installed package, signer and HOME policy.
An SDK emulator test does not establish a custom AOSP image boot.
Physical-device qualification must cover radios, camera/audio, suspend/resume,
accessibility, recovery and signed updates/rollback. Production signing, distribution,
device-owner provisioning and target-user task acceptance remain independent gates.

## Emulator results at 73b973a5 (2026-10-10)

Class E only (emulator instrumentation). Not physical-device, AOSP image, real-integration or
user acceptance, and not evidence for any later source.

- Emulator: AVD `r3_packaging_api36`, system image `system-images;android-36;default;arm64-v8a`
  (API 36, Android 16 `BE2A.250530.026.D1` userdebug), ABI arm64-v8a, stock HOME
  `com.android.launcher3`, WebView `com.android.webview` 133.0.6943.137.
- APKs: **developer-override builds, never distributable**: `npm run android:build --
  --allow-unpackaged-runtime` (resident runtime `NOT_PACKAGED`: the reviewed embedding host
  libraries are not on the build machine) with a speech runtime installed by
  `install-generated.py --allow-unqualified-runtime`. App: `standalone-debug.apk`
  `3bcac1ad…7ba516b`, `launcher-debug.apk` `666f7a65…c5934e`. Instrumentation APKs at `bef5cd5b`
  `2bf1dcce…` / `3bf3eef7…` (rows marked A) and at `73b973a5` `5b3cdd0e…` / `755acbc2…` (rows
  marked B). Test-mocks pair: `5b126815…` / `8c13d13a…` with `caccd38c…` / `4c0c9cc9…`.
- The fixture campaigns ran from a hand-assembled directory of those APKs with a name-to-hash
  manifest; `scripts/build-archive.mjs` needs the strict build and was not run.
- The machine was heavily loaded (load average 30 to 140), so a timeout seen once is listed as
  not reproduced rather than as a defect.

### `npm run test:android:instrumentation`

Results are standalone / launcher. "skipped" names the gate.

| Class | Result | Classification |
| --- | --- | --- |
| NoMockProduct, Shell, StartupReadiness | passed / passed (A) | |
| TextScale | passed 1 of 2 / same; restart phase skipped (`textScalePhase`, restart runner) (A) | |
| BrowserSignins | passed 5 of 6 / same; restart phase skipped (`signinPhase`) (A) | |
| BrowserContinuity | passed 1 of 3 / same; two skipped (restart runner, test-mocks) (A) | |
| BrowserFlow (flag-off) | 1 of 2 real-HTTPS tests failed / passed (A) | Environment: `submittedSearchUsesRealProviderAndRejectsExecutableAddress` needs a live `www.google.com/search` page; it failed in 3 of 6 runs. The other test passes since the lock selector fix. |
| BrowserDownload (flag-off) | skipped / skipped (test-mocks gate) (A) | |
| Video, PhotosTrash, SettingsSystemFacts | passed / passed (A) | |
| Rotation | passed / passed (B) | Two test defects fixed (see below). |
| SettingsFlow | failed (`Battery` row not found) / passed (B) | Not reproduced on launcher; standalone unresolved. |
| Accessibility | failed / failed (B) | Reaches its TalkBack order check and reports `Home at 200% font: unlabelled control` at the composer area. Open: product accessibility finding or checker limit; not triaged further. |
| NotesTrashBackstop, ClockHandoff, ClockRepeatDays, InboxOperationJournal, MailAttachment | passed / passed (A) | |
| HostedResultNotice | builders passed; posted and denied notices skipped (permission runner) (A) | |
| NotesSecureStorage | passed 1 of 2 / same; legacy migration skipped (gate) (A) | |
| LauncherHome | not applicable / passed 4 of 4 with `--home-role` (A, B) | HOME selected, cold HOME resumed, original holder `com.android.launcher3` restored and read back. |
| SettingsRoles | not applicable / failed 1 of 2 (A, B) | `homeRequestDeclineAndAcceptMatchRoleHolders`: "Home app not changed" never appears after declining Android's role dialog. Unresolved (three runs). |
| LocalAgentOfflineApps, NotesStorageDurability, ReminderLifecycle, Notifications, PasswordBrowserFill | passed / passed on rerun (B) | Each failed once on one flavor in the first run (A) under load; not reproduced. |
| FilesTree | failed twice / passed twice (A, B) | Standalone only: `Open Renamed destination` never appears and the Files view is empty. Unresolved. |
| DailyApps | failed 1 of 6 / same (A, B: three runs) | `localReminderPostsRealNotificationAndTapOpensItsContext`: the notification tap does not open the reminder's Calendar detail. Unresolved. |
| WorkflowApprovalNotice | failed 1 of 2 / same (A, B) | With the notification permission granted it posts, then fails later (`unknown` status, or the route not released). Unresolved. |
| BrowserReading, BrowserSensitiveReading | failed / failed (A) | Test precondition: without a speech route the product answers "Select an available speech route before reading" before the sensitivity check the tests expect. |
| BrowserIsolatedReading, BrowserReadingNavigation, BrowserPageQuestion (3 of 4) | failed / failed (A) | Environment: this WebView reports `JS_INJECTION_IN_FRAME_AND_WORLD=false`; the classes need isolated-world injection. |
| CameraScan | failed 2 of 2 / same (A, B) | Open: the review dialog reports "The image could not be read by the local scan engine" for the fixture pages; a picked image also left a second Photos row. Not triaged to a cause. |
| RealClock (`--clock-exclusive`) | failed / failed (A) | Environment: the fixture asserts API 35; this image is API 36. |
| HostedProcessRestart, HostedBackgroundWorker | refused by the runner | They assert a disposable secondary user no runner creates. |
| Test-mocks: BrowserDownload, ConnectionChooser | passed / passed | |
| Test-mocks: BrowserFlow | passed 5 of 5 / 4 of 5 | Same live-search dependency. |
| Test-mocks: BrowserAutofill | failed / failed in the runner; passed 4 of 4 run alone | The synthetic autofill service fills both fields through the framework every time. The intermittent failure is later: Android's suggestion popup stayed visible for ten seconds after the Menu overlay made the tab ineligible ("Overlay cancels native credential suggestion", cycle 0 or 1). Cause not isolated. |

### Fixture campaigns (fresh secondary user per run)

| Campaign | Result (standalone / launcher) | Classification |
| --- | --- | --- |
| `test-native-restart.mjs signin`, `notes`, `document` | passed / passed (A) | |
| `test-native-restart.mjs inbox` | failed / failed (A, B) | The test waited for the "Cloud services connected" heading removed in `9aa75ce1`. With the wait changed to the signed-in account summary it still times out: the synthetic sign-in never shows a signed-in account. Unresolved. |
| `test-native-permissions.mjs channels`, `settings`, `voice-limit` | passed / passed (A) | |
| `test-native-permissions.mjs voice-revoke` | passed (B) / passed (A) | The first standalone run stopped in the runner, which parsed `cat`'s "No such file" text as the marker; fixed. |
| `test-native-permissions.mjs camera` | failed / failed (A) | Test expects "Tap the shutter to retry"; the product shows "Camera access is off" with Open Android settings and Try again. Stale expectation or changed denial path; unresolved. |
| `test-native-permissions.mjs voice` | failed / failed (A) | "Record without transcription" never offered. Unresolved. |
| `test-native-permissions.mjs notice`, `notice-denied` | failed / failed (A, B) | The test reflected a plugin field that no longer exists (fixed); it now fails on a later bare assertion. Unresolved. |
| `test-reminder-one-off.mjs` | passed / passed (A) | |
| `test-calendar-regression.mjs --case=CalendarAgentCrudInstrumentedTest` | passed / passed (A) | |
| `test-calendar-regression.mjs --case=CalendarCrudInstrumentedTest` | failed twice / not run (A, B) | An event row never satisfies the visible-and-hit-testable condition. Unresolved; the runner stops before the launcher variant. |
| `test-reminder-recovery.mjs`, resident campaign (`ResidentEgressRedaction`, `ResidentService`) | not run | Recovery reboots the emulator (left for last); the resident campaign needs the packaged runtime and reads an owner-held provider key. |

### Confirmed on this image

- `AlphaDevicePlugin.snapshot()` at target SDK 36 returns `wifiEnabled`, `bluetoothEnabled`,
  `airplaneMode`, `locationEnabled`, `mobileDataEnabled`, `interruptionFilter` and
  `adaptiveBrightness`, matching `settings get global` and the Bluetooth service state, and follows
  an airplane-mode change. No read was refused.
- Closing Android's own shade did **not** refresh an open Alpha shade: while `NotificationShade`
  held window focus and after it closed, the page received no `focus`, `blur`, `visibilitychange`
  or `appResumed`, and made no new snapshot call. `MainActivity.onWindowFocusChanged` now tells the
  page. Re-measured with the fix: one `focus` event and one new snapshot call after the system shade
  closed over an open Alpha shade.
- `LocalSpeechInstrumentedTest` passed 2 of 2 on this emulator with networking off against the
  speech candidate rebuilt at this pin (recorded through `requalify-runtime.py run`; not admitted,
  x86_64 not executed).

### Defects found by these runs and fixed on this branch

Runner: classes shared app data and a left-open system shade (now cleared before each class);
secondary-user classes were run to certain failure; `WorkflowApprovalNotice` had no notification
permission; an empty listing was reported "missing" with nothing recorded; `voice-revoke` marker
polling. Tests: nine browser classes selected `svg[aria-label="Secure connection"]` after the icon
became a `role=img` span; Rotation's clipping rule failed portrait Home and compared a quoted
string; gesture tests did not settle the startup access panel; `InboxDraft` and
`HostedResultNotice` referred to removed product details.

## Evidence and reporting

Keep generated logs, screenshots and machine-readable receipts under ignored
`test-results/` or CI artifacts. Link the exact workflow run and commit when reporting
results; consult [GitHub Actions](https://github.com/AlphaCompute/alphaphone/actions)
for hosted status. Record failures, skipped cases and unavailable prerequisites along
with the passing subset. A rerun replaces evidence only for the scope it executes.
Never carry a dated APK or device result forward as proof for changed source.

Report source checks, APK builds, emulator/HOME tests, real integrations, custom
image boot and physical/user acceptance separately. Requirement evidence remains
unset until a retained, revision-bound result supports that requirement's full scope.
