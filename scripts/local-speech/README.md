# Reproduce local speech assets

The engine and pinned runtime/model tooling live in
`vendor/eliza/packages/app/platforms/android/local-speech` and
`vendor/eliza/packages/app/scripts/local-speech`. These small wrappers preserve
Alpha's build commands and stage generated files under `.eliza/local-speech`,
without writing into the upstream checkout. Each workspace is locked against
concurrent commands.

From the repository root, with Android NDK r28c (`28.2.13676358`) and CMake `4.0.3`
first on `PATH` (`python3 -m pip install cmake==4.0.3`):

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

Both admitted ABI byte inventories, source/model hashes, licensing notices and no-eSpeak checks
remain required. Generated AAR/models are installed into `android/local-speech`.
APK builds remain separate from actual microphone, synthesis, playback and device
acceptance. See the upstream README and the product verification ledger.

## Qualified runtime and reproducibility

`android/local-speech/runtime-manifest.json` describes the installed AAR. The reviewed
native identity is stored separately in `qualified-runtime-manifest.json`.

The prior native record is preserved byte-for-byte in
`android/local-speech/baselines/qualified-runtime-manifest-before-20261008.json`.
Its ABI fields recorded `deviceExecuted: false`; they do not prove native execution.
It was built on macOS with NDK r28c and Homebrew CMake 4.0.3 in the workspace
`/Users/shawwalters/Documents/alphaphone/test-results/mvp-local-speech-staging`. Its
bytes depend on more than the source and model hashes:

- **Build path.** sherpa-onnx log calls embed `__FILE__`, so 246 absolute workspace
  paths sit in the stripped `libsherpa-onnx-jni.so`. `build-no-espeak.py` remaps its
  workspace to the qualified path through clang's `CCC_OVERRIDE_OPTIONS`
  (`-ffile-prefix-map`); the NDK's default legacy CMake toolchain file ignores
  `CFLAGS`/`CXXFLAGS`.
- **Build ID.** lld writes a GNU build ID (`--build-id=sha1`) over the unstripped output
  and `llvm-strip` keeps it. That output contains ThinLTO promoted-symbol names
  (`.llvm.<hash>`) derived from the real absolute object paths, which no prefix map
  changes.
- **CMake release.** With the same NDK and path, CMake 3.22.1 (the SDK package CI used to
  install) produces an arm64 library about 227 KB larger. The wrappers refuse any NDK
  other than `28.2.13676358` and any CMake other than `4.0.3`.
- **ZIP entry times.** The pinned tooling writes AAR entries with the current time, so no
  rebuild reproduces the recorded container hashes (`aarSha256`). Only the native
  members can be compared.

Measured on this pin: with the pinned toolchain and the remap, stripped arm64-v8a
libraries built in two different directories differ only in the 20-byte build ID. Both
ABIs match the recorded sizes exactly (arm64-v8a 4,042,512 bytes, x86_64 4,394,840; an
unremapped arm64 build in another checkout gave 4,039,088), and rebuilding in the same
directory reproduces the same bytes. The SHA-256 still differs from the record. The build
ID is the likely remaining difference, but the original library was not available to
confirm it. A byte-exact reproduction would need the build to run in the qualified
workspace path itself (for example the upstream `run.py --workspace` with that
directory), which has not been attempted.

`install-generated.py` compares every generated native library with the record before
installing anything. When they differ it stops, lists the differing libraries and
installs nothing. `--allow-unqualified-runtime` installs the local runtime anyway (CI uses
it for its Linux builds): the installer then rewrites `runtime-manifest.json` to describe
the local build, which Gradle's `:local-speech:preBuild` requires. APKs built this way are
build evidence only, not release candidates, and that manifest change must never be
committed. Recording a new native identity requires reviewed provenance and explicit execution
evidence; functional and release acceptance remain separate.

The reviewed native-byte baseline is `android/local-speech/qualified-runtime-manifest.json`.
Its version-2 record admits the rebuilt JNI/ONNX Runtime bytes for resident QA after
source, no-eSpeak, alignment and immutable model checks. ARM64 JNI/model execution was
observed on Android. x86_64 remains build-only (`deviceExecuted: false`). The old and
new JNI hashes differ; matching sizes and a path-remapped build do not prove bit equality.
The record retains exact input, APK, test and evidence hashes without account/device identifiers.

The canonical `LocalSpeechInstrumentedTest` ran two tests without microphone capture,
network or playback: the holder reuse/release test passed, while the synthesis-to-ASR
round-trip failed at the keyword `lazy` (`lady's dog` was recognized). Its assertion was
not changed. Saved PCM diagnostics recognized `lazy` with both resamplers and after the
original human/silence sequence; they do not replace the failed float-path test or
establish a causal fix. `functionalAcceptance.passed` remains **false**.

The installer continues to compare every native member with the reviewed byte record
and refuses mismatches without installing anything. It never overwrites that record.
An exact-byte QA installation is permitted even while functional acceptance is failed;
no `--allow-unqualified-runtime` flag is needed for this admitted candidate.

APK verification reports `byteMatch` and `functionalPassed` separately. `qualified` is
true only if native bytes match **and** schema version 2 records an explicit functional
pass for every packaged ABI. Failed, missing, malformed or unsupported acceptance
records fail closed. `scripts/verify-apks.mjs` requires both gates, so exact native bytes
alone cannot set `distributable: true`. Source/build/JNI QA may proceed; this admission
does not establish local speech quality, full product readiness or a release decision.
