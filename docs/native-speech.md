# Native speech

AlphaPhone consumes the shared `paradee-voice` module from its pinned Eliza
revision. `NativeAsr` and `ParadeeVoice` execute in libelizainference. The product
adapter owns PCM validation, bounded WAV output, cancellation and idle release.
It retains no transcript or credential state in the engine holder.

Run `npm run native:speech:build` with `ANDROID_HOME` set. Optionally set
`ALPHA_ELIZA_NATIVE_SOURCE` to a separate clean Eliza checkout at the exact pin
with its native submodule; the builder authenticates both source revisions. It builds ARM64 and
x86_64 libraries and Paradee assets through the upstream build script, then
stages a hash-verified ASR backend. Set `ALPHA_ASR_MODEL_DIR` to a directory with
exactly the pinned ASR files; otherwise the builder stages only the verified
Qwen3 pair from the local Eliza model cache. Outputs live in
`artifacts/native-voice`; the unchanged shared bundle stays in
`artifacts/native-voice-base`, with temporary build inputs under `.eliza`. Set
`ALPHA_SPEECH_MODEL_CACHE` to reuse converted Paradee and lexicon files; the
upstream builder checks their exact pinned hashes before copying them.

The record binds file hashes and both Eliza and llama.cpp revisions. Gradle and preflight verify
the generated inputs. This is build evidence, not device qualification. The old
Sherpa manifests are historical and cannot qualify the new runtime. A new
`android/local-speech/native-qualification.json` must bind `sourceCommit`,
`buildRecordSha256`, per-ABI native hashes (`qualifiedAbis`), the full model inventory (`assets`), and reviewed
`functionalAcceptance.abis` results for both shipped ABIs. Until those results
exist, release verification reports native speech as unqualified.

A host PCM codec test compiles the adapter against the shared Java API and checks
round-trip audio and malformed WAV rejection. Native inference, the actual JNI
bridge, microphone capture and physical-device acceptance require their own runs.

When a resident inference host is packaged, its reviewed library must match the
native voice library byte for byte. The app packages one shared inference library
and rejects mixed revisions before Gradle merges native libraries.
