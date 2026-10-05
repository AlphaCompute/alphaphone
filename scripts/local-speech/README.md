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

Both qualified ABIs, source/model hashes, licensing notices and no-eSpeak checks
remain required. Generated AAR/models are installed into `android/local-speech`.
APK builds remain separate from actual microphone, synthesis, playback and device
acceptance. See the upstream README and the product verification ledger.

## Qualified runtime and reproducibility

`android/local-speech/runtime-manifest.json` records the runtime that was qualified on
a device. It was built on macOS with NDK r28c and Homebrew CMake 4.0.3 in the workspace
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
libraries built in two different directories differ only in the 20-byte build ID, and
both have exactly the recorded size (4,042,512 bytes; an unremapped build in another
checkout gave 4,039,088). Their SHA-256 still differs from the record. The build ID is
the likely remaining difference, but the original library was not available to confirm
it. A byte-exact reproduction would need the build to run in the qualified workspace path
itself (for example the upstream `run.py --workspace` with that directory), which has not
been attempted. The x86_64 library was not rebuilt for this comparison.

`install-generated.py` compares every generated native library with the record before
installing anything. When they differ it stops, lists the differing libraries and
installs nothing. `--allow-unqualified-runtime` installs the local runtime anyway (CI uses
it for its Linux builds): the installer then rewrites `runtime-manifest.json` to describe
the local build, which Gradle's `:local-speech:preBuild` requires. APKs built this way are
build evidence only, not release candidates, and that manifest change must never be
committed. Recording a new qualified runtime needs a reviewed rebuild and device
qualification, not a hash update.
