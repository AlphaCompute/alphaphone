# Android and AOSP build contract

## Artifact identities

Package: `ai.elizaresearch.alphaphone`. Version source: `app.config.json`, overridden by
`ELIZAOS_VERSION_CODE` (positive integer) and `ELIZAOS_VERSION_NAME` when set. AOSP module: `AlphaPhone`.
Standalone and launcher variants share data and signing identity within this product.
Use `adb install -r` to replace them. Do not uninstall a real user's app to switch variants.

`npm run android:build` builds debug-signed debug artifacts and release artifacts for both
flavors, Android instrumentation APKs and Android lint, all with
`ELIZA_DEV_ALLOW_TEST_MOCKS` off. Release APKs are signed only when all four `ELIZAOS_*`
signing values below are present; otherwise they are `*-release-unsigned.apk`.
`android:verify` (`scripts/verify-apks.mjs`) inspects compiled package IDs, HOME/LAUNCHER
filters, debug flags and signatures, the absence of test-mock classes, cleartext network
configuration and fixture-package queries, and runs `scripts/audit-production-bundle.mjs`
on each APK's extracted `assets/public`. These checks inspect APK bytes, not source
strings alone.

Gradle's `stageLocalAgentSources` step reads the prepared resident runtime source in
`artifacts/local-agent-resident-<commit>`, and release verification requires the staged
runtime payload (without it `scripts/verify-packaged-runtime.py` exits 3). On a clean
checkout `npm run android:build:local` runs the whole chain: an input check, `agent:prepare`,
`agent:build-workflow-worker`, `agent:stage-android` and `android:build`. Gradle's
`:local-speech:preBuild` also needs the speech AAR from
[local speech setup](../scripts/local-speech/README.md). `npm run android:build` checks all of
these first (`scripts/android-build-preflight.mjs`) and exits 2 with the command to run instead
of failing inside Gradle. `npm run android:build -- --allow-unpackaged-runtime` is the developer
path: it needs only `agent:prepare` and records release APKs without the payload as
`distributable: false`.

`npm run android:build -- --test-mocks` passes `-PELIZA_DEV_ALLOW_TEST_MOCKS=1` and writes
only to `artifacts/test-mocks/`. It attaches `android/app/src/testMocks` (DevelopmentAgent
and voice plugins, synthetic autofill service, loopback cleartext config, fixture-package
permission and queries) to debug variants and sets `BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS`;
`DailyApps.surfaceInfo().developmentBuild` reports that field. Release variants never
receive the source set. Without `--test-mocks` the build script removes both
`ELIZA_DEV_ALLOW_TEST_MOCKS` and `VITE_ELIZA_DEV_ALLOW_TEST_MOCKS` from its child
environment. Test-mocks APKs are never distribution or acceptance artifacts.
Instrumentation cases that need a loopback HTTP fixture server or the DevelopmentAgent
plugin assume `BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS`: flag-off distribution debug
APKs skip them. The CI job that ran them on test-mocks APKs was removed on October 8 with
the other smoke suites, so they now run only in a direct instrumentation run of a
test-mocks build on an owned disposable emulator.

Release variants are minified and resource-shrunk with R8 using
`android/app/proguard-rules.pro`, which keeps Capacitor plugin reflection targets,
upstream native plugins and manifest-instantiated components. Retain each release's
`android/app/build/outputs/mapping/<variant>Release/mapping.txt` with the distributed APK
to symbolicate crashes. An R8 build passing APK verification is not installed-release
behavior evidence: exercise the signed release on an emulator and a device as separate
gates.

## Signing

Development uses the Android debug keystore outside the repository. Release signing uses
the upstream names `ELIZAOS_KEYSTORE_PATH`, `ELIZAOS_KEYSTORE_PASSWORD`,
`ELIZAOS_KEY_ALIAS` and `ELIZAOS_KEY_PASSWORD`, supplied by the signing service or CI
secret store. Gradle signs only when all four are set (a partial set is reported by name
and produces unsigned APKs); values are never printed. Alternatively, a release owner
may zipalign/sign the unsigned release APK with the controlled application key. Either
way, verify with `apksigner` and supply an independently reviewed descriptor. Keep keys
in the signing service/CI secret store. No production signing material is created
by setup. Pin app certificate and versionCode across APK and OS releases.

```json
{
  "schemaVersion": 1,
  "brand": "alphaphone",
  "moduleName": "AlphaPhone",
  "packageName": "ai.elizaresearch.alphaphone",
  "apkSha256": "64 lowercase hex characters from the signed APK",
  "certificateSha256": "64 lowercase hex characters from the approved signer"
}
```

```sh
npm run aosp:stage -- --apk /absolute/signed-launcher.apk \
  --descriptor /absolute/reviewed-launcher.json --output /absolute/new-overlay
```

The upstream helper rejects a package/hash/signer mismatch, absent HOME filter,
existing output directory and debug APK without the explicit development flag.
Unsigned release APKs cannot pass signature verification. It inspects a private copy
of the same bytes it stages and writes a presigned/preprocessed nonprivileged Soong
`android_app_import` plus a `PRODUCT_PACKAGES` fragment. No local-agent marker or
privileged permission whitelist is fabricated for a thin launcher.

## App Links preparation

Verified App Links for the Cloud delegation return are prepared but not active. The
manifest carries a commented `autoVerify` HTTPS intent filter, and
`android/app/src/main/assetlinks.template.json` is the `/.well-known/assetlinks.json`
template for `ai.elizaresearch.alphaphone` with a placeholder certificate fingerprint.
The `alphaphone://cloud-delegation` custom scheme remains the active return path. To
activate: choose the owned return host, publish the file with the release signer's
SHA-256 fingerprint, enable the filter and renderer HTTPS return in a reviewed change,
then verify with `adb shell pm get-app-links ai.elizaresearch.alphaphone` on an installed
signed build ([runbook](pilot-acceptance-runbook.md#external-integration-runbooks)).

## Full AOSP product integration

1. Allocate a Linux x86_64 AOSP builder with the storage/RAM required by the selected
   pinned source tree. macOS SDK builds are sufficient for APKs, not this image lane.
2. Select exact hardware/SKU, Android branch, kernel/vendor inputs and compatible
   WebView/browser. Validate upstream source locks; do not infer support from a mockup.
3. Build/sign this product's launcher; admit it with the descriptor above. Copy the
   generated directory to `vendor/alphaphone` in a clean AOSP checkout.
4. In the selected product makefile add:
   `$(call inherit-product, vendor/alphaphone/product.mk)`.
   Use the existing `packages/os/android` source locks, environment and build tooling
   for the base image. Do not claim the custom launcher satisfies the existing full
   Eliza local-inference payload validator.
5. The add-on keeps other launchers intact. Choose this app as default HOME through
   explicit device provisioning. In disposable userdebug validation,
   `adb shell cmd package set-home-activity ai.elizaresearch.alphaphone/.MainActivity` demonstrates
   selection; production must use the enrolled-device/default-role policy.
6. Build the actual product with `source build/envsetup.sh`, its pinned `lunch` target
   and `m`. No generic lunch command can substitute for an approved hardware target.
7. Boot the exact image in Cuttlefish, verify package path under `/product`, signer,
   HOME resolution after reboot, screen/IME/native bridge behavior and absence of crashes.
8. Validate the same signed release on physical hardware: radios, audio/mic, touch,
   camera, suspend/resume, charging, keys, auth/agent reconnect, accessibility and
   recovery. Then validate signed OTA and rollback. Record image/APK/source hashes.

An SDK emulator with an installed launcher is useful HOME/app evidence, but is not
proof that this product makefile built or booted in a custom AOSP image.

## Distribution boundaries

HOME is not device owner, accessibility service, overlay permission, SMS/dialer or
assistant role. Do not add a broad `privapp-permissions` list to make a test pass.
A persistent cross-app helper and secure Chromium component require their explicit
native/OS integration and signer-admission work in the implementation plan. Managed
kiosk is not enabled by default; preserve a recovery route and normal Android settings.

## Required Clock provider

The Alpha overlay explicitly includes AOSP `DeskClock` alongside its launcher. Keep this module in the selected product even when generic upstream de-bloating changes. A missing Clock handler is not successful MVP alarm acceptance. Both standalone and launcher APKs use the installed provider and expose honest unavailable results; neither bundles Clock inside its APK or owns exact-alarm delivery.

After booting the exact signed image, perform read-only handler admission for the intended Android user:

```sh
ANDROID_SERIAL=<exact-serial> ALPHA_ANDROID_USER=<user-id> node scripts/verify-aosp-clock.mjs
```

The check requires enabled `com.android.deskclock` and its set/show/snooze/dismiss activity handlers. It does not launch an alarm, change permissions, provision a device, or prove ringing. Alpha's shared manifest declares the caller SET_ALARM permission and visibility queries; Clock's own notifications/exact-alarm access remains separately verified on the image. Confirm actual set/fire/snooze/dismiss, permission denial, reboot, time-zone/DST, cancellation and DND/physical audio before claiming alarm MVP completion.

DeskClock is the real AOSP module defined in `packages/apps/DeskClock/Android.bp` and included by the standard handheld product. Pin its source through the selected image manifest; do not substitute an unreviewed downloaded APK.
