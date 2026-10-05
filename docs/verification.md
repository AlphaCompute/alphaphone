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
including instrumentation builds, lint and APK inspection. Record the product commit,
`upstream.lock.json` revision, generated input provenance and APK hashes.
Unsigned release APKs require controlled signing before distribution.

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

Use an owned disposable emulator for `npm run android:smoke`. Exercise both APK
variants, native bridge behavior and actual launcher HOME selection and restoration.
Retain terminal instrumentation results and cleanup outcomes. A build or successful
install cannot substitute for these checks. See the [Android/AOSP guide](android-and-aosp.md)
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

Process-restart campaigns use `node scripts/test-native-restart.mjs` with `inbox`,
`notes`, or `document`, a matching archived APK pair and a new output directory.
Use the owned-emulator configuration in the README. Require successful prepare,
restore/verify and cleanup phases; Notes and Inbox reports also require distinct
process IDs. The selected-file native test asserts that process boundary itself.
Activity recreation alone is insufficient.

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
