# Third-party license sources

`scripts/generate-licenses.mjs` builds `apps/app/public/licenses/third-party-notices.json`
(`[{name, version, license, source, text, flags, obligations?, textSource?}]`) and
`THIRD_PARTY_NOTICES.txt` beside it. Vite copies both into `web-dist/licenses/`, so they ship in
the web bundle and in every APK's `assets/public`.

```sh
node scripts/generate-licenses.mjs                    # regenerate
node scripts/generate-licenses.mjs --check            # fail if stale or an input is broken
node scripts/generate-licenses.mjs --packaged-runtime # also list the staged resident runtime (after agent:stage-android)
node scripts/generate-licenses.mjs --refresh-android  # re-resolve the Gradle runtime classpath (needs SDK/JDK)
node --test test/licenses.test.mjs test/runtime-licenses.test.mjs test/font-license.test.mjs
```

## Policy: licences are included and flagged, never blocking

Owner decision P-09 (`docs/decisions.md`, 2026-10-10): an open-source dependency licence never
stops a build and is never a release blocker. Every licence text and notice still ships, and
anything copyleft, unknown or unverified is flagged with what it obliges. The policy lives in
`scripts/licence-policy.mjs`; `docs/dependency-audit.md` lists the flags and where they appear.

- Generation never fails on what a licence is. It exits 0 and prints each flag as
  `LICENCE FLAG <flag>: <package>@<version> (<licence>)` on standard error.
- A package with no licence file gets the canonical text of its declared licence from
  `<SPDX id>.txt` in this directory, `textSource: "spdx-canonical"` and the flag
  `licence-text-missing-from-package`. A copyleft package whose licence file only names its
  licence gets the canonical text appended (`"package-and-spdx-canonical"`).
- A package that declares no licence is identified from its own licence file or README and
  flagged `unverified`; if that fails, its licence is `UNKNOWN` and it is flagged
  `unknown-licence`. A licence file that reserves all rights or limits use is flagged
  `non-open-source-terms`.
- Generation fails only on broken input: a package that is not installed, an unreadable or
  corrupted `package.json`, a pinned licence copy or core that drifted from its recorded hash,
  a stale Android classpath snapshot, a malformed `font-licenses.json` record.
- A flag is a record of what was found. It is not legal review and not a clearance.

The one exception is a proprietary font with no recorded licence (the Denton typeface). It is
not open-source software, so P-09 does not cover it; see `font-licenses.json` below.

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
  or a license copy changes until the pins are updated (a broken input, not a licence category).
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

Canonical texts, named by SPDX identifier and used when a package ships no licence file (or,
for a copyleft licence, a file that only names it): `0BSD.txt`, `Apache-2.0.txt`,
`BSD-2-Clause.txt`, `BSD-3-Clause.txt`, `ISC.txt`, `MIT.txt`, `MPL-2.0.txt`, `Unlicense.txt`,
`GPL-2.0.txt`, `GPL-3.0.txt`, `LGPL-3.0.txt` (used together with `GPL-3.0.txt`, which it
supplements) and `AGPL-3.0.txt`. `OFL-1.1.txt` is the text for OFL fonts and `ODbL-1.0.txt`
for map data. The BSD, 0BSD and Unlicense texts carry no copyright line; the entry names the
author from the package manifest. The GNU texts are the Free Software Foundation's own
(`GPL-3.0.txt` SHA-256 `3972dc97…b36986`, `LGPL-3.0.txt` `da7eabb7…464768`, `GPL-2.0.txt`
`8177f975…880643`; `AGPL-3.0.txt` is the FSF Markdown rendering). A licence with no text here
is still listed and flagged, with a sentence saying its text is not held; add
`<SPDX id>.txt` to supply it. `mediabunny-MPL-2.0.txt` and `tessdata-APACHE-2.0.txt` remain the
sources for the existing mediabunny and OCR notices.

`unverified-allowlist.json` and `packaged-runtime-allowlist.json` (items that exist only in a
staged runtime) record the reason for each item whose licence could not be established from
shipped metadata, and for the Denton typeface. They gate nothing: an item is listed and flagged
`unverified` whether or not it has an entry, and the reason is printed as its obligation note.
A missing or stale entry is printed as a `LICENCE NOTE`. A reason is not legal sign-off. Font
entries carry the exact file hash, which the `unresolved-font-licence` check uses to find the
font in a built payload.

`font-licenses.json` records an obtained embedding licence for a font whose own metadata names
none (licensor, licensee, scope, evidence, exact file hashes). It is empty until the owner
obtains one. Until then the Denton typeface is listed as `proprietary, no licence recorded`,
flagged `proprietary-no-licence-recorded`, and reported by the one separately named check
`unresolved-font-licence`. Whether that check keeps a release `distributable: false` is the
constant `UNRESOLVED_FONT_LICENCE_BLOCKS_DISTRIBUTION` in `scripts/licence-policy.mjs`
(default `true`); see `docs/dependency-audit.md` and decision A-21.

Prototype design images are not part of production builds; their licensing is recorded in
`apps/app/src/prototype/README.md`.
