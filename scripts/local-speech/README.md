# Reproduce local speech assets

These scripts build an isolated, no-eSpeak Sherpa JNI runtime for English Whisper and lexicon-based VITS. They never change the Android SDK or vendor/eliza. Acquired archives, models and build outputs are ignored; source, explicit third-party patch, acquisition hashes and license source references are tracked.

From the repository root, with CMake and Android NDK 28 available:

```sh
python3 scripts/local-speech/acquire-downloads.py
python3 scripts/local-speech/make-lexicon.py
python3 scripts/local-speech/build-no-espeak.py --abi arm64-v8a --ndk "$ANDROID_NDK_HOME" --jobs 2
python3 scripts/local-speech/verify-source.py
python3 scripts/local-speech/strip-runtime.py --abi arm64-v8a --ndk "$ANDROID_NDK_HOME"
python3 scripts/local-speech/build-no-espeak.py --abi x86_64 --ndk "$ANDROID_NDK_HOME" --jobs 2
python3 scripts/local-speech/strip-runtime.py --abi x86_64 --ndk "$ANDROID_NDK_HOME"
python3 scripts/local-speech/prepare-assets.py
python3 scripts/local-speech/assemble-runtime.py
python3 scripts/local-speech/install-generated.py --repository "$PWD"
```

Reviewed model/source archives total about 201 MB before extraction. Models plus notices occupy about 127 MB, then the app installs a verified private copy. Both ABIs require temporary build space; allow 3 GB. The current arm64 runtime libraries occupy about 26 MB after stripping. Exact sizes and hashes are generated in each ABI's qualification.json. Runtime creation, memory use and inference latency require Android measurements.

The generic module is MIT. Dependencies retain Apache, BSD, MIT and Eigen MPL-2.0 notices. Stock GPL-containing Sherpa JNI and eSpeak data are excluded. Piper weights have MIT collection metadata and a public-domain LJSpeech dataset card; Whisper and CMUdict provenance are pinned in the acquisition manifests. Do not replace the patched AAR with a stock download.

These source checks do not imply native acceptance. Run the opt-in LocalSpeechInstrumentedTest with localSpeech=1 and networking disabled, inspect its saved JSON/WAVs, then verify real microphone/review/save/playback on both app variants. See the delivery report for the evidence actually obtained.
