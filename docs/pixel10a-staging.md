# Pixel 10a staging and release signing

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
is described below. Omitting `--target` retains the existing product staging
behavior and production gates.

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

## Production staging

`--target pixel10a --production` stages the `alpha_stallion_phone-cp2a-user` product
from the production descriptor `android/aosp/pixel10a-product.json`. Before any source,
factory archive or APK is read it refuses, naming each gap, while:

- any descriptor value is `UNSET` or a placeholder;
- `sourceLock.sha256` does not pin the exact bytes of `android/aosp/pixel10a-source.json`,
  or that lock is still marked `developmentOnly` (admitting the inputs for release is a
  reviewed change to both files);
- `android/release-signer.json` has no reviewed APK release signer, or
  `signer.platformCertificateSha256` is not the reviewed image platform certificate;
- the descriptor claims `releaseQualified` or `deviceAcceptanceVerified`. Both stay `false`:
  they are release and device evidence, never staging inputs.

```sh
npm run aosp:stage -- --target pixel10a --production \
  --apk /absolute/launcher-release.apk --apk-manifest /absolute/apk-manifest.json \
  --descriptor /absolute/reviewed-launcher.json \
  --listener-apk /absolute/sense-release.apk --listener-descriptor /absolute/reviewed-listener.json \
  --aosp-source /absolute/prepared/stallion-source \
  --factory-image /absolute/stallion-cp3a.261005.005-factory-d1d25502.zip \
  --output /absolute/new-alpha-overlay
```

The launcher must be a release that `verify-apks` recorded as distributable, and it is
re-judged against the committed release signer at staging time; the source verification,
listener, camera and provisioning checks of production staging all apply. The overlay adds
`release-avb.mk`: verified boot on, `SHA256_RSA4096` for vbmeta and the chained
`vbmeta_system`/`vbmeta_vendor`, and the platform security patch as rollback index. It names
no key; the image builds with the AOSP test AVB key and is re-signed below. Whether the board
configuration honours these values is image-build evidence, not staging evidence.
`physical-product.json` records the descriptor hash with `imageBuilt`, `imageSigned`,
`releaseQualified` and `deviceAcceptanceVerified` all `false`.

## Release signing, OTA and compatibility record

On the Linux image host, after the production image build, sign the unsigned target-files
and build the OTA with the AOSP releasetools (`otatools` `bin/`) and a decrypted release key
directory in the upstream layout (`vendor/eliza/packages/os/android/signing`: `<name>.pk8`
plus `<name>.x509.pem` for `releasekey`, `platform`, `shared`, `media`, `networkstack`,
`sdk_sandbox`, `bluetooth` and `nfc`; `avb.pem` and `avb_pkmd.bin`):

```sh
node scripts/sign-aosp-release.mjs \
  --target-files /absolute/unsigned-target_files.zip --target-files-sha256 <from the build record> \
  --keys-dir /dev/shm/keys --releasetools /absolute/otatools/bin \
  --apk-manifest /absolute/apk-manifest.json --out /absolute/new-release-dir \
  [--incremental-from /absolute/previous-signed-target_files.zip] [--dry-run]
```

It runs `sign_target_files_apks -o -d KEYS` with the `avb` key for vbmeta and each chained
partition, then `ota_from_target_files -k KEYS/releasekey`, copies the public `avb_pkmd.bin`
(enrolled on a device with `fastboot flash avb_custom_key avb_pkmd.bin` before
`fastboot flashing lock`), and writes `release-record.json`: build fingerprints and versions,
security patch levels, vbmeta image hashes, payload hash and OTA metadata, release
certificate digests and the APK signer digests from `apk-manifest.json`. The record
generator also runs on its own: `node scripts/aosp-release-record.mjs --signed-target-files
ZIP --ota ZIP --out NEW_FILE`.

Keys are supplied only at signing time and never committed. The key directory must be an
absolute path outside every Git working tree with mode 0700; private keys are passed to the
releasetools by path and never read by the script. It refuses, before running any tool, on
any `UNSET` descriptor or channel value, a target-files hash that differs from the build
record, a missing key file, or a platform certificate, OTA certificate or AVB public key that
differs from the reviewed digests in the product descriptor and
`android/aosp/pixel10a-ota-channel.json`. `--dry-run` prints the exact commands and every
problem and runs nothing. APEX payload key mapping and HSM-backed signing helpers are not
wired yet; review the build's APEX list against the key manifest before a real signing.

`android/aosp/pixel10a-ota-channel.json` is the one signed update channel: authority, release
owner, the OTA certificate and AVB key digests, `downgradeAllowed: false`, the stock factory
image for recovery, a known-good release slot and the drill record. A signed release is not
distributable while the known-good release is unset or any signed-update, interrupted-update,
compatible-rollback or stock-recovery drill is not `passed`; the script prints those as
`NOT DISTRIBUTABLE`. Drill results are recorded from executed drills, never by software.

`node --test test/aosp-release-signing.test.mjs` exercises these refusals, the command lines
and the record with mocked releasetools and throwaway certificates. It is not a signed image,
an image boot, an applied OTA, or a rollback or recovery drill.
