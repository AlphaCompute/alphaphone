# Android and AOSP build contract

## Artifact identities

Package: `ai.elizaresearch.alphaphone`. Version source: `app.config.json`. AOSP module: `AlphaPhone`.
Standalone and launcher variants share data and signing identity within this product.
Use `adb install -r` to replace them. Do not uninstall a real user's app to switch variants.

`npm run android:build` builds signed debug and unsigned release artifacts for both
flavors, Android instrumentation APKs and Android lint. `android:verify` inspects
compiled package IDs, HOME/LAUNCHER filters, bundled web assets, debug flags and debug
signatures. These checks inspect APK bytes, not source strings alone.

## Signing

Development uses the Android debug keystore outside the repository. A release owner
must zipalign/sign the unsigned release APK with the controlled application key,
verify with `apksigner`, and supply an independently reviewed descriptor. Keep keys
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
