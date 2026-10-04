# Reproduce local speech assets

The engine and pinned runtime/model tooling live in
`vendor/eliza/packages/app/platforms/android/local-speech` and
`vendor/eliza/packages/app/scripts/local-speech`. These small wrappers preserve
Alpha's build commands and stage generated files under `.eliza/local-speech`,
without writing into the upstream checkout. Each workspace is locked against
concurrent commands.

From the repository root, with CMake and Android NDK 28 available:

```sh
python3 scripts/local-speech/acquire-downloads.py
python3 scripts/local-speech/make-lexicon.py
python3 scripts/local-speech/build-no-espeak.py --abi arm64-v8a --ndk "$ANDROID_NDK_HOME" --jobs 2
python3 scripts/local-speech/strip-runtime.py --abi arm64-v8a --ndk "$ANDROID_NDK_HOME"
python3 scripts/local-speech/build-no-espeak.py --abi x86_64 --ndk "$ANDROID_NDK_HOME" --jobs 2
python3 scripts/local-speech/strip-runtime.py --abi x86_64 --ndk "$ANDROID_NDK_HOME"
python3 scripts/local-speech/verify-source.py
python3 scripts/local-speech/prepare-assets.py
python3 scripts/local-speech/assemble-runtime.py
python3 scripts/local-speech/install-generated.py --repository "$PWD"
```

Both qualified ABIs, source/model hashes, licensing notices and no-eSpeak checks
remain required. Generated AAR/models are installed into `android/local-speech`.
APK builds remain separate from actual microphone, synthesis, playback and device
acceptance. See the upstream README and the product verification ledger.
