# Third-party license sources

`scripts/generate-licenses.mjs` builds `apps/app/public/licenses/third-party-notices.json`
(`[{name, version, license, source, text}]`) and `THIRD_PARTY_NOTICES.txt` beside it. Vite copies
both into `web-dist/licenses/`, so they ship in the web bundle and in every APK's `assets/public`.

```sh
node scripts/generate-licenses.mjs                    # regenerate
node scripts/generate-licenses.mjs --check            # fail if stale, incomplete or unknown
node scripts/generate-licenses.mjs --refresh-android  # re-resolve the Gradle runtime classpath (needs SDK/JDK)
node --test test/licenses.test.mjs
```

Inputs:

- `package-lock.json` production packages (not dev, not optional platform binaries), with the license
  files from `node_modules`.
- Every font file under `apps/app/public`, identified from its OpenType name table, plus the
  declared `@fontsource/*` packages.
- pdf.js decoder, font and CMap license files that ship in `pdfjs-assets/`.
- `tesseract-core/`: license copies for the libraries statically linked into the
  `tesseract.js-core` WebAssembly cores in `ocr/` (Tesseract, Leptonica, libjpeg, libpng, LibTIFF,
  libwebp, GIFLIB, zlib, OpenLibm), pinned by `tesseract-core/sources.json` to the submodule commits
  of the `tesseract.js-core` v7.0.0 tag. Generation fails when the installed package, a shipped core
  or a license copy changes until the pins are re-reviewed.
- `android-runtime-classpath.json`: the resolved release and debug runtime classpath for both
  distribution variants. Its fingerprint covers the Gradle dependency declarations; generation fails
  when they change until the snapshot is refreshed.
- `android/local-speech/runtime-manifest.json` and the pinned upstream local-speech manifests.
  `onnxruntime-MIT.txt`, `whisper-MIT.txt`, `cmudict-BSD-2-Clause.txt`,
  `piper-ljspeech-medium-MODEL_CARD.txt` and `piper-voices-README.md` must match the SHA-256 values
  in `vendor/eliza/packages/app/scripts/local-speech/reference-manifest.json`.
- `config/browser-speech.json` for the web build's in-browser speech recognition:
  `whisper-tiny.en-onnx-MODEL_CARD.md` (the pinned ONNX conversion's model card) and
  `onnxruntime-web/ThirdPartyNotices.txt` (ONNX Runtime v1.30.0, for the libraries statically
  linked into the shipped WebAssembly) must match the SHA-256 values recorded there.
- `vendor/eliza/LICENSE` at the commit pinned by `upstream.lock.json` (read only).
- `ODbL-1.0.txt` for OpenStreetMap-derived map data served by the configured Maps endpoint.

Generic texts: `Apache-2.0.txt`, `MIT.txt` and `ISC.txt` (used only when an MIT or ISC npm package
ships no license file), `OFL-1.1.txt`. `mediabunny-MPL-2.0.txt` and `tessdata-APACHE-2.0.txt` remain the sources for
the existing mediabunny and OCR notices.

`unverified-allowlist.json` lists items whose license could not be established from shipped
metadata. An entry only lets generation proceed and must give a reason; the item stays marked
`license unverified` in the shipped notices. It is not legal sign-off. Fonts are allowlisted by
exact file hash.

`font-licenses.json` records an obtained embedding licence for a font whose own metadata names
none (licensor, licensee, scope, evidence, exact file hashes). It is empty until the owner
obtains one; see `docs/dependency-audit.md` for the Denton typeface (decision A-21) and the
release blocker reported while it is unresolved.

Prototype design images are not part of production builds; their licensing is recorded in
`apps/app/src/prototype/README.md`.
