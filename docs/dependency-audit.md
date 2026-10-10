# Dependency and artifact supply chain

Covers inventory items MVP-45 (dependency findings), the software part of MVP-43 (Denton
typeface rights) and the read-back tooling for MVP-46 (required checks). Everything here is
source and test evidence. It is not an APK build, emulator, device or legal result.

## Commands

```sh
node scripts/dependency-audit.mjs            # network: npm audit against package-lock.json, compared with the dispositions
node scripts/dependency-audit.mjs --write    # network: also rewrite docs/dependency-audit.snapshot.json
node scripts/dependency-audit.mjs --offline  # the committed snapshot only
node --test test/dependency-audit.test.mjs   # offline; part of npm test
node scripts/generate-sbom.mjs               # offline: artifacts/sbom/alphaphone.cdx.json
node scripts/ci/read-required-checks.mjs     # network, read-only: enforced rules on main vs the intended ruleset
```

The audit reads the registry advisory database for the lockfile (`npm audit --json
--package-lock-only`). It installs nothing and changes no dependency.

## npm advisories (MVP-45)

Audited 2026-10-10 with npm 11.18.0. Before triage `npm audit` reported 3 moderate and 1
high finding, which reduce to two advisories. No finding is in a production dependency: all
four packages are `dev` in `package-lock.json`, so none is in the web bundle or an APK
(`productionLockPackages` in `scripts/generate-licenses.mjs` and the SBOM list only
non-dev packages).

| Advisory | Severity | Package and exact path | Ships? | Vulnerable code reachable? | Disposition |
| --- | --- | --- | --- | --- | --- |
| GHSA-68fv-2mgg-jv7q, event-loop denial of service through indexed source-map section offsets | high | `source-map-js` 1.2.1 via `vite > postcss > source-map-js` and `@vitejs/plugin-react > vite > postcss > source-map-js` | No. Build tool only. | Only at build time: PostCSS parses a source map that accompanies CSS it processes. Production builds set `sourcemap: false`. A hostile map in a CSS dependency could hang a developer or CI build; it cannot affect a user. | **Fixed.** Lockfile-only bump to 1.2.2, inside PostCSS's declared `^1.2.1`. |
| GHSA-w5hq-g745-h8pq, uuid missing buffer bounds check in v3/v5/v6 when `buf` is provided | moderate | `uuid` 7.0.3 via `@capacitor/cli > xcode > uuid` | No. CLI tool only. | No. `xcode` calls only `uuid.v4()` with no arguments (`lib/pbxProject.js`). | **Exception until 2027-01-08.** |
| same advisory, reported on the parent | moderate | `xcode` 3.0.1 via `@capacitor/cli > xcode` | No | No. `@capacitor/cli` loads `xcode` only in its iOS `migrate uiscene` task. There is no iOS project; the only CLI use is `cap sync android`. | Same exception. |
| same advisory, reported on the direct dependency | moderate | `@capacitor/cli` 8.5.2 (direct devDependency) | No | No, as above. | Same exception. |

Why the uuid finding is an exception and not a fix:

- Every `xcode` release depends on `uuid ^7`, and the newest `@capacitor/cli` (8.5.3) still
  depends on `xcode ^3.0.1`. No release inside the existing ranges removes the path.
- npm's proposed fix is a downgrade to `@capacitor/cli` 8.4.3. That splits the CLI from the
  pinned `@capacitor/core` and `@capacitor/android` 8.5.2.
- An `overrides` entry forcing `uuid >= 11.1.1` is a four-major jump beneath a package that
  declares `^7`, for code that is never called.

Remove the exception when `@capacitor/cli` drops `xcode` or `xcode` moves to `uuid >=
11.1.1`, and take that release together with the matching `@capacitor/core` and
`@capacitor/android`.

### How the record is enforced

- `docs/dependency-audit.snapshot.json` is the normalised audit, bound to the SHA-256 of
  `package-lock.json`. Each finding carries its root advisory and every dependency chain
  that reaches it.
- `docs/dependency-audit.dispositions.json` is the reviewed record: `fixes` and
  time-bounded `exceptions` (at most 120 days from review).
- `test/dependency-audit.test.mjs` runs offline in `npm test` and fails when:
  - `package-lock.json` changed since the snapshot (re-run the audit with `--write`);
  - the snapshot holds an advisory, package or dependency path with no recorded exception,
    a dev-only exception now reaches a production path, or a severity rose;
  - an exception passed its `reviewBy` date, lacks its justification, or no longer applies;
  - a recorded fix regressed in the lockfile.

Any change to `package-lock.json` therefore needs a fresh `node scripts/dependency-audit.mjs
--write` in the same change. The first date on which the test fails by itself is 2027-01-09,
when the uuid exception expires.

`source-map-js` 1.2.2 was exercised with PostCSS 8.5.28 (generate, then consume a previous
map) in an isolated install. `npm run verify` in the working tree used the shared
`node_modules`, which still held 1.2.1; a clean `npm ci` installs 1.2.2.

The pinned platform (`vendor/eliza`, `upstream.lock.json`) is outside this audit and was not
changed. Its own dependencies are resolved by the upstream workspace when the agent runtime
is prepared; they are not in this repository's lockfile.

## Release SBOM

Before this change nothing produced a machine-readable inventory with versions and hashes.
`third-party-notices.json` lists names, versions and licence texts for attribution, without
hashes; `licenses/android-runtime-classpath.json` lists Gradle coordinates only.

`node scripts/generate-sbom.mjs` writes a CycloneDX 1.6 JSON document to
`artifacts/sbom/alphaphone.cdx.json` (ignored by git; attach it to a release). It runs
offline, has no timestamp, and derives its serial number from its content, so the same
commit always yields the same bytes (`test/sbom.test.mjs`).

| Component group | Source of truth | Hash recorded |
| --- | --- | --- |
| npm production packages (web bundle, and the same bundle inside each APK) | `package-lock.json` | registry tarball SHA-512 |
| Bundled font files | `apps/app/public` | SHA-256 of the committed bytes |
| OCR WebAssembly cores | `licenses/tesseract-core/sources.json` | SHA-256 |
| Web speech model and ONNX Runtime Web files | `config/browser-speech.json` | SHA-256 |
| Android runtime classpath (71 coordinates) | `licenses/android-runtime-classpath.json` | **none** |
| Speech AAR and native libraries per ABI | `android/local-speech/runtime-manifest.json` | SHA-256 |
| Speech model and source archives, lexicon | pinned upstream `local-speech` manifests | SHA-256 |
| elizaOS | `upstream.lock.json` | git commit |

Gaps, stated in the document itself:

- Gradle artifacts have no hashes. Gradle is not run by the generator and the build has no
  dependency verification metadata (`android/gradle/verification-metadata.xml`). Enabling it
  needs a network Gradle run and a review of every artifact; it was not done here.
- The staged resident runtime (Bun, bundled agent and workflow-worker packages, PGlite, the
  musl loader) exists only after `npm run agent:stage-android`. It is verified per APK by
  `scripts/verify-packaged-runtime.py` and listed by `generate-licenses.mjs
  --packaged-runtime`; the SBOM names it as not covered.
- The SBOM is a source-pin inventory. It does not scan APK or web bundle bytes.

## Denton typeface (MVP-43)

`apps/app/public/denton-300.woff2` (SHA-256 `7e9341445b0bf2ec7f75e4a5d4dd4a677e9d2341f67ddcf766db92a21f310e05`)
is a commercial face imported from the design prototype. Its metadata says "All rights
reserved" and names no licence. Whether to license it or replace it is owner decision A-21
in [decisions.md](decisions.md). Neither choice has been made here.

### Where Denton is referenced

| Place | Reference |
| --- | --- |
| `apps/app/src/prototype/prototype.css` line 7 | The only `@font-face` for `Denton`; the only URL for the file |
| `apps/app/src/prototype/prototype.css` line 8 | `.serif{font-family:'Denton','Fraunces',Georgia,serif;font-weight:300}`; `.serif` is used 89 times in `template.html` |
| `apps/app/src/prototype/template.html` | 36 inline `Denton, Fraunces, Georgia, serif` stacks, and one `Denton, Georgia, serif` (line 1275) |
| `apps/app/src/prototype/asset-manifest.json` | Source URL, size and hash of the file |
| `licenses/unverified-allowlist.json` | "Denton typeface", by exact hash |
| `apps/app/public/licenses/` | Generated notice entry marked `license unverified` |
| `scripts/generate-licenses.mjs` | Reads every font under `apps/app/public`; no Denton-specific code |
| `scripts/prototype-capture.mjs` line 111 | Records `document.fonts.check('300 30px Denton')` in capture output |
| `test/licenses.test.mjs` | Uses Denton as its unverified-font example |

There is no preload link. `apps/app/index.html`, the Vite configuration, the bundle audit
denylist and the Android project do not name Denton. `design-assets/` and `design/` hold
reference copies that are not built into the product.

### Fraunces is not yet a complete fallback

Fraunces is bundled and licensed under OFL-1.1 (verified from the font files' own name
tables and listed in the notices), but only as two **italic** faces, weights 300 and 400
(`apps/app/public/fonts/25bae1ffe157fa448306.ttf`, `c3c6d103fb2c49381256.ttf`). They exist
for the italic alpha mark, which Denton cannot draw.

Rendered in headless Chromium with the Denton rule removed, the upright `.serif` stack
resolves to Fraunces Italic: 40px sample text measured 451.5px, identical to explicit
Fraunces Italic, against 426.7px in Denton. With no upright face declared, the browser
uses the italic one. An upright Fraunces 300 (`@fontsource/fraunces`, already a
devDependency, OFL-1.1) measured 484.6px, 13.6% wider than Denton, so headings need a
layout recheck either way.

For this reason there is no build-time switch. A switch would also make the committed
notices disagree with the packaged bytes, and the notices are checked byte for byte
against `apps/app/public`.

### Choice (a): licence obtained

1. Add one record to `licenses/font-licenses.json`:
   `{"name": "Denton typeface", "sha256": ["7e93…0e05"], "license": "LicenseRef-Commercial-Font",
   "licensor": "…", "licensee": "…", "scope": "app and web embedding", "evidence": "…", "recordedOn": "…"}`.
   The scope must name app and web embedding; the record covers only the listed bytes.
2. Delete the "Denton typeface" entry from `licenses/unverified-allowlist.json`.
3. Run `node scripts/generate-licenses.mjs`, and update the Denton expectations in
   `test/licenses.test.mjs` and `test/font-license.test.mjs`.

No application code changes.

### Choice (b): replace with Fraunces

1. Add an upright Fraunces 300 face under `apps/app/public/fonts/` with its `@font-face`
   in `prototype.css` (same family name, `font-style: normal`), and record it in
   `asset-manifest.json`.
2. Delete line 7 of `prototype.css` and `apps/app/public/denton-300.woff2`, and the
   file's `asset-manifest.json` entry. The font stacks can stay; they fall through to
   Fraunces (line 1275 of `template.html` falls through to Georgia).
3. Delete the "Denton typeface" entry from `licenses/unverified-allowlist.json` and run
   `node scripts/generate-licenses.mjs`.
4. Update `scripts/prototype-capture.mjs` line 111, `test/licenses.test.mjs` and
   `test/font-license.test.mjs`, then recheck heading layout and the visual baselines.

### Release blocker

`scripts/font-license-blockers.mjs` reports `unresolved-font-licence` for a built payload
when its notices mark a typeface `license unverified`, or when any file in it has the
bytes of a font allowlisted by hash. Stale notices or a renamed file do not hide it.

- `scripts/verify-apks.mjs` records `licenceBlockers` on each APK row, prints
  `RELEASE BLOCKER …`, and keeps `distributable: false` on a release while one remains.
  It does not fail verification, so developer and CI builds are unaffected. Production
  AOSP staging (`scripts/stage-aosp.mjs`) already requires `distributable: true`.
  `scripts/provision-unit.mjs` records `distributable` but does not require it.
- `scripts/audit-production-bundle.mjs` prints the same line for `web-dist` and still
  passes.

The blocker clears with either choice above. The verify-apks wiring is covered by source
assertions and unit tests of the shared function; it has not been run against built APKs
in this change.

Five other notice entries remain `license unverified` (the Piper voice model, Sherpa-ONNX
native build dependencies, the resident runtime payload, the pdf.js QuickJS sandbox and
the ONNX Runtime Web linked components). They are not fonts and are not reported by this
blocker; they stay with the legal review of the notices.

## Required checks (MVP-46)

`scripts/ci/read-required-checks.mjs` reads the active rules for the default branch, every
ruleset and classic branch protection with `gh api --method GET`, and diffs the enforced
status checks, their integration binding, the up-to-date policy, enforcement, target and
bypass actors against `scripts/ci/required-checks-ruleset.json`. It changes nothing. It
exits 0 on a match, 1 on differences and 2 when the state cannot be read.

Read-back on 2026-10-10: only "Default branch baseline" is active (`deletion`,
`non_fast_forward`, `pull_request`). "Main required checks" is not installed, so none of
"Repository verification", "Browser MVP result" and "Android foundation result" is
required. Installing it is the owner's step ([ci-cost-policy.md](ci-cost-policy.md)). A
matching read-back is configuration evidence only; MVP-46 also needs a controlled pull
request showing that a missing or failing check blocks the merge.
