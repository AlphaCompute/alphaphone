# Alpha Phone (alphaphone)

Independent Android UI on Eliza. This repository contains a working launcher-shell
foundation and the implementation plan for the complete product. Agent pairing,
voice and domain workflows are **not connected yet**; the UI says so explicitly.

- [Working PRD](docs/prd.md)
- [Detailed implementation plan](docs/implementation-plan.md)
- [Architecture and upstream ownership](docs/architecture.md)
- [Requirements and open decisions](docs/decisions.md)
- [Verification results and remaining gates](docs/verification.md)
- [Source/design provenance](docs/sources.md)

## Setup

```sh
git clone --recurse-submodules https://github.com/eliza-research/alphaphone.git
cd alphaphone
npm ci
npm run verify
npm run dev
```

Use Node 24.15.0 and JDK 21. Native builds require Android SDK platform 36 and
build-tools 36.0.0. Set `JAVA_HOME` and `ANDROID_HOME` on Linux; the scripts also
recognize the usual macOS Homebrew JDK/Android SDK locations. The Gradle 8.13
wrapper is hash-pinned. No Eliza root dependency installation or package
publication is required for this shell.

```sh
npm run android:build
# Signed debug APKs and unsigned release APKs are in artifacts/.
# Install either standalone-debug.apk or launcher-debug.apk for this product.
adb install -r artifacts/standalone-debug.apk
# The launcher flavor can be selected from Android's default Home app settings.
adb install -r artifacts/launcher-debug.apk
```

The variants intentionally share `ai.elizaresearch.alphaphone` and replace one another.
The other product uses a different package and can be installed alongside this one.
Release APKs are intentionally unsigned; do not distribute debug-signed builds as production.

## Emulator verification

```sh
ANDROID_SERIAL=emulator-5554 npm run android:smoke
```

Use a disposable emulator. This installs both flavors in turn, runs real WebView
and native bridge instrumentation, selects and verifies the launcher HOME role,
and restores the original HOME role. Reports/screenshots go to `test-results/android`.
CI first prepares a disposable stock-HOME fixture with explicit phone/tablet geometry;
that setup script refuses to run outside GitHub Actions unless explicitly emulated.

## AOSP integration

```sh
npm run aosp:stage -- --apk artifacts/launcher-debug.apk --development
```

This invokes the Eliza OS custom-launcher admission helper and emits a new vendor
add-on under `artifacts/aosp/`. Copy that directory under an AOSP `vendor/` directory
and inherit its `product.mk` from the selected product. See [build instructions](docs/android-and-aosp.md)
for signing, default-home policy and the full image verification boundary.

## Layout

`apps/app` owns this product's UI. `android` owns its packaging and launcher bridge.
`vendor/eliza` pins shared platform/native/OS code. `base/eliza-app` is the complete,
immutable original app import for migration; its old scripts are not this project's
entrypoints. `design` preserves the supplied references. Use root npm scripts.

GitHub Actions builds both variants, runs emulator instrumentation and uploads
artifacts. A successful APK job does not establish full AOSP image or physical
hardware acceptance. See the verification record for what was actually run.
