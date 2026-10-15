# Pixel 10a development staging

The physical product is `alpha_stallion_phone`, for the exact Android 17 stallion
source and factory inputs in [the source contract](pixel10a-source-contract.md).
The following stages a new directory; it does not patch the source, build or flash
an image, or admit a production release:

```sh
npm run aosp:stage -- --target pixel10a --development \
  --apk /absolute/admitted-launcher-debug.apk \
  --aosp-source /absolute/prepared/stallion-source \
  --factory-image /absolute/stallion-cp3a.261005.005-factory-d1d25502.zip \
  --output /absolute/new-alpha-overlay
```

The input must be a flag-off launcher APK. Existing packaged test-mock exclusion,
APK manifest admission, verified APK hash and signer, product identity, lock-screen
surface checks, clock and image capability declarations remain in force. Optional
listener inputs use the same signer and speech payload checks as other development
staging. Always-on listener acceptance is still required for the MVP; omitting it
from a development overlay does not meet that requirement. Production Pixel staging
is refused even if a descriptor is supplied. Omitting `--target` retains the
existing product staging behavior and production gates.

Source verification runs before staging. Secure camera verification independently
checks its existing pinned module revisions and Camera2/SystemUI/manifest hashes.
It accepts only the exact source lock's recorded overrides; within these monitored
modules the overrides are extraction-tool files under `frameworks/base/tools/aapt2`.
It still rejects changed override bytes, additional changes, hidden index flags and
ignored source inputs. This is not an exception for camera behavior changes.

The generated overlay belongs under `vendor/alphaphone` in the already verified
source. Select `alpha_stallion_phone-cp2a-userdebug` using that source's normal
build tools. The source contract already covers the patched generated vendor files;
staging copies reference patches for review and does not apply them again.
The product retains fallback HOME during bring-up and a nonprivileged presigned
Alpha app. The read-only system eSIM flags provider accepts only system UID, itself,
or the installed system eSIM clients; it does not implement Google services.

Native staging installs byte-exact stored ARM64 JNI libraries next to the APK and
emits `config.fs` with executable modes for Bun and its loader. A resident payload
must match the current source stamp, stable Bun binary pin, complete runtime
provenance, workflow-worker closure, and native-view policy. A self-consistent
replacement Bun cannot bypass its independent binary pin. The original APK is not
rewritten. A compressed or malformed native payload is refused. Failed physical
staging removes its temporary output and leaves an existing destination untouched.

`physical-product.json`, `native-libraries.json` and the camera receipt distinguish
source/staging evidence from execution. None asserts image build, runtime execution,
release qualification or device acceptance. Full current APK verification, both
distribution variants, image build/boot, actual native speech/runtime, hardware,
update/recovery and user acceptance remain separate requirements.

Offline tests run with `node --test test/aosp-pixel10a.test.mjs` (including Python
native fixtures) and `node --test test/aosp-secure-camera.test.mjs
 test/pixel10a-source.test.mjs`. Synthetic binaries in these tests establish checks
and generated file contents, never executable APK or image acceptance.
