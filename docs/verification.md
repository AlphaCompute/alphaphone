# Verification record — 2026-09-29

## Passed locally

| Check | Result and scope |
| --- | --- |
| Source provenance | All 2,344 original app files and supplied design assets match SHA-256 manifests |
| Source dependency | Clean pinned Eliza submodule; uncommitted source is rejected |
| Web | Strict TypeScript, four foundation tests and production Vite build pass |
| Native build | Standalone + launcher, signed debug + unsigned release, instrumentation APKs all build |
| Android lint | Zero errors; 6 warnings in launcher debug report (tool-version/orientation, backup compatibility, generated/inherited resources, and Alpha vector complexity where applicable) |
| APK inspection | Correct independent package ID, LAUNCHER in both modes, HOME only in launcher, local web payload, correct debug flags and valid debug signatures; removed camera/WRITE_SETTINGS permissions absent |
| Device tests | Both variants pass real Android instrumentation: renderer mount, installed-app enumeration, Eliza system status, build identity, HOME eligibility, actual keyboard open with visible input/Send, and native Settings handoff |
| HOME | Launcher assigned HOME and resumed through the hardware HOME event; original emulator HOME holder restored after the run |
| Offline | Local emulator Wi-Fi and cellular data disabled during both variant tests |
| AOSP admission | Real signed launcher accepted; standalone and unsigned release rejected without staged output; seven upstream admission unit tests pass at the updated pin |
| Visual | Reviewed actual device home screens; separate product branding/layout and visible native controls |

Test host: macOS arm64, Node 24.5.0, OpenJDK 21.0.10, Gradle 8.13, Android compile/target SDK 36 and build-tools 36.0.0. CI uses pinned Node 24.15.0/JDK 21. Device: disposable AOSP API 35 arm64 emulator; 1080 × 2400 pixels, density 420, portrait. No physical device was used.

Evidence: [instrumentation](evidence/launcher-instrumentation.txt), [device results](evidence/result.json), [APK manifest](evidence/apk-manifest.json), [AOSP admission results](evidence/aosp-admission.json), [build input hashes](evidence/build-inputs.json), [standalone screenshot](evidence/standalone.png), [launcher screenshot](evidence/launcher.png). Hashes describe the local setup artifacts and source files at this validation point; subsequent edits/builds require fresh evidence.

## Local artifact hashes

| Artifact | SHA-256 |
| --- | --- |
| standalone-debug.apk | d794032b57bd76a9d15dd1eaa80938bc44ac0abffca3608369174cdc47bc8ffd |
| standalone-release-unsigned.apk | 932d64100a5e18a7ce8a1eded21c20b040a3ce08f689f3eb5942237ce5076fae |
| launcher-debug.apk | 8f5e779fafd62eb33c5c19ea8957b4f9b183f8ed499963c7697e1a0edbeb2533 |
| launcher-release-unsigned.apk | 2246b941b2ade0296d339cad1d8ae27027a7299d9024cfab17e1d221166c7860 |

Files are generated under `artifacts/` and intentionally excluded from Git. CI uploads its independently built artifacts and reports. Release artifacts are **unsigned**, not installable production releases until controlled signing. The app is a functional local launcher shell; agent pairing, voice and domain workflows remain unconnected.

The local build-input snapshot predates the CI fixture correction below. That correction changes test setup and diagnostics, not the compiled application source.

## CI fixture correction

A fresh hosted SDK emulator initially used `com.android.sdksetup` as HOME. Restoring that temporary setup role failed; the harness now preserves any original test failure and clears stale outputs. `prepare-ci-emulator.mjs` provisions only a disposable GitHub Actions fixture, chooses the stock Launcher3, enables the test software keyboard, wakes and keeps the fixture awake, and sets explicit product display geometry. A freshly wiped local emulator reproduced a missing keyboard while asleep; the fixture now explicitly wakes before testing input. The additional local retry was interrupted after a WebView timeout during heavy host load; it is not counted as a passing run. This is fixture preparation, not evidence of production enrollment. Alpha uses 1080 × 2400 pixels at density 420; senior-care uses 1280 × 800 at density 160.

The first hosted Alpha instrumentation tests passed before the cleanup failure. Senior-care's keyboard assertion failed on the default small phone display; the verified senior target is the 16:10 tablet fixture. Small landscape phones are not a supported senior-care layout in this foundation. Keep the real keyboard assertion enabled on the supported tablet geometry.

The dependency pin was subsequently advanced to `760ad0f18ad6e34581f696642434215e397ccbc5` to include upstream validation of action/category element roles. The original local APK evidence remains a historical build snapshot; the exact-head CI build validates the final pin.

## Hosted checks

The [Android foundation workflow](https://github.com/eliza-research/alphaphone/actions/workflows/android.yml) repeats the source/web/build/APK/HOME tests on Linux with an x86_64 emulator. At the time this record was written, final hosted verification was still running. Check the run for the exact commit; local success is not a hosted result.

Shared change: [elizaOS/eliza#32936](https://github.com/elizaOS/eliza/pull/32936). Seven focused admission tests pass at the updated pin; the original change also passed focused TypeScript and Biome checks. Upstream required checks must be evaluated at its latest head; the full monorepo `bun run verify` was not run locally.

## Recovered findings

Android lint found source-manifest merge declarations that needed explicit exported/removal treatment. Device review found a wrapping clock, inherited dark system-bar background, overlapping inset handlers, and an overly short HOME startup wait. The senior-care real-keyboard check exposed a hidden composer; the helper now keeps controls in the resized viewport with independently scrolling conversation content. These findings were fixed and the affected checks rerun.

## Not established by these results

- Full Linux AOSP product build and Cuttlefish boot of that exact custom image. The staged Soong/product files have not been exercised by an image build.
- Selected physical hardware, radios/audio/microphone, suspend/resume, full accessibility acceptance, recovery and signed OTA/rollback.
- Production app signing, official store/distribution approval or device-owner provisioning.
- Real owner/agent pairing, conversation, voice, connectors, secure observation or product workflows.
- Product decision gates, supported biller/provider behavior and real-user acceptance in the PRD and implementation plan.

A source check, SDK emulator pass or generated AOSP overlay cannot establish those outcomes.
