# Current-pin native speech candidate

On October 15, an isolated x86_64 Cuttlefish instance ran real Paradee TTS and Phonon-2 ASR through the shared voice JNI. The existing 25-sentence roundtrip passed: 215 words, zero edits, WER 0. Synthetic audio totaled 72.825 seconds. TTS real-time factor was 0.122; ASR factor was 0.099. Instrumentation completed in 16.101 seconds. These fixed synthetic sentences are not a held-out ASR corpus or acoustic measurement.

Both x86_64 and ARM64 engines built and executed successfully. The same fixed synthetic test passed on a physical Pixel 10a (ARM64, API 37): 25 sentences, 215 words, zero edits, TTS real-time factor 0.138, ASR factor 0.163, and 22.715 seconds instrumentation time. The two isolated qualifier packages were absent before installation and removed after the report was retrieved. No microphone, speaker, network, HOME or product settings were used or changed. The engine was rebuilt from Eliza `968348d792d3d36df129bc53bd85cebed47d0830` and native fork `3e5f73922ee804806a2e955b50843a5042e6e401` with NDK 28.2. It has its own measured bytes, different from the earlier author-built candidate in `android/voice-host/qualified-voice-host.json`. That record and its `qualified:false` state are unchanged. This result must not be used to admit different engine/JNI hashes.

## Harness repair

The pinned qualification test did not compile: it called removed `ParadeeVoice.open(Bundle)` and `NativeAsr.open(Bundle)` methods and an obsolete two-argument `transcribe`. The test-only [patch](../../../patches/eliza/voice-qualification-current-api.patch) uses the current constructors and 16 kHz transcription signature. It was applied to an external copy of the test Java files, never to `vendor/eliza`. Runtime, model, native and threshold sources were unchanged. The repair is submitted as [elizaOS/eliza #36302](https://github.com/elizaOS/eliza/pull/36302). This patch is not in the product native patch manifest and is not applied to product builds.

## Reproduction and artifacts

The stable local archive `/home/shaw/Android/alpha-qualification/2026-10-15-native-968348` contains the APKs, engine and qualification build records, model inventory, Gradle override, test-only patch, staging helper and logs. `candidate.json` records their sizes and hashes. The APK includes the exact model bytes named in the current speech manifest. The separate qualification package is `ai.eliza.voicequalify`; it has no network or microphone permission.

The archive was moved across Btrfs subvolumes using reflink copies, with all original archive hashes verified before removal of the temporary original. Native engines and both ABI APKs are retained there.

1. Use a clean checkout of the exact upstream and native pins outside the product vendor checkout. Build with the authenticated consumer wrapper, NDK 28.2, two build jobs, `--abi x86_64`, a fresh `--out` and the hash-pinned existing model cache. The upstream builder emits TTS assets; it does not emit a complete ASR bundle.
2. Assemble a fresh qualification-only input bundle. Verify every model and notice against the product's current speech manifest and every engine file against the wrapper build record. Include the Phonon-2 model and Silero model. Record the resulting manifest and files. The archived staging helper does these checks and does not change any product host record.
3. Build `packages/app/scripts/paradee-voice/qualify` with Java 21, Gradle 8.13 and Android Gradle Plugin 8.13. The archived Gradle override selects the ABI (x86_64 or arm64-v8a) and substitutes only the externally patched test Java sources. Set `-PelizaParadeeNativeDir` to the fresh qualification bundle. Run `assembleDebug assembleDebugAndroidTest`.
4. On the reserved disposable Cuttlefish instance, install the test-only app and test APK with `adb install -t`. Run `adb shell am instrument -w -r -e class ai.eliza.voicequalify.ParadeeRoundTripTest ai.eliza.voicequalify.test/androidx.test.runner.AndroidJUnitRunner`. The initial smoke adds `-e limit 1`; the recorded complete roundtrip omits it.
5. Retrieve `/sdcard/Android/data/ai.eliza.voicequalify/files/paradee-roundtrip.json` and retain the instrumentation exit status. The committed reports contain only the fixed synthetic sentences.

## Limits

This is candidate JNI execution on one x86_64 emulator and one ARM64 physical device using fixed synthetic PCM. It does not prove physical microphones, speaker playback, echo cancellation, interruption, always-on listening, SystemUI indication, networked agent turns, physical latency, battery/thermal endurance, a new full AOSP image or user acceptance. The run does not change an Alpha HOME role or install a product APK. It does not close #413, #397, #423, #424 or #395.
