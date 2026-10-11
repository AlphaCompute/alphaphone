# Dependency and artifact supply chain

Covers inventory items MVP-45 (dependency findings), the licence flags of decision P-09, the
software part of MVP-43 (Denton typeface rights) and the read-back tooling for MVP-46
(required checks). Everything here is source and test evidence. It is not an APK build,
emulator, device or legal result.

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

## Licence flags (P-09)

Owner decision [P-09](decisions.md#october-10-owner-product-decision) (2026-10-10): an
open-source dependency licence never stops a build and is never a release blocker. Every
licence text and notice still ships, and anything copyleft, unknown or unverified is
flagged with what it obliges. "Included and flagged" is all that is claimed here. It is not
legal review, and nothing here shows that an obligation a flag names has been met.

`scripts/licence-policy.mjs` holds the flags, the classification of licence expressions and
the obligation notes. `scripts/generate-licenses.mjs` applies them.

| Flag | Given to | What the entry's obligation note says |
| --- | --- | --- |
| `copyleft-strong` | GPL, AGPL (also EUPL, OSL) | The licence text and copyright notices ship in the entry; the complete corresponding source must be available at that exact version, at the stated source URL; conditions on a larger work that contains the component are not assessed. |
| `network-copyleft` | AGPL | The source offer extends to people who use the component over a network. |
| `copyleft-weak` | LGPL, MPL, EPL (also CDDL, CPL) | LGPL: text and notices ship, source must be available, and the user must be able to replace the library. MPL and EPL: source of the covered files, with changes, stays available under the same licence. |
| `share-alike-data` | ODbL, CC-BY-SA | Attribution, and a derived database shared publicly keeps the same licence. |
| `unknown-licence` | No licence found, or an identifier that is not recognised | Nothing recorded shows that use is permitted. `license` is `UNKNOWN` when nothing was declared or found. |
| `non-open-source-terms` | A licence file that reserves all rights or limits use, or a manifest that says `UNLICENSED` | These are not open-source terms; P-09 does not cover the item. |
| `licence-text-missing-from-package` | A package with no licence file, or a copyleft package whose file only names its licence | The canonical text held in `licenses/<SPDX id>.txt` is used (`textSource: "spdx-canonical"`) or appended (`"package-and-spdx-canonical"`). |
| `unverified` | Items whose licence is not established from shipped metadata, and packages whose licence was identified from their licence file or README because the manifest declares none | The recorded reason. |
| `permissive-not-previously-listed` | A permissive licence recognised from the SPDX list that was not on the project's earlier accepted list (for example BlueOak-1.0.0, Unlicense) | Its text and notices stay with copies. |
| `proprietary-licence-held-outside-repo` | A bundled proprietary font recorded on the owner's statement that the licence is held outside the repository (Denton) | Proprietary, not open source, not redistributable under an open-source licence; the licence document was not seen; `unresolved-font-licence` reports it resolved-by-owner-statement. |
| `proprietary-no-licence-recorded` | A bundled font that states no open licence and has no record in `licenses/font-licenses.json` (none today) | Proprietary; no licence recorded; reported unresolved by `unresolved-font-licence`. |

With alternatives (`A OR B`) the least encumbered alternative is the one reported. OFL-1.1
fonts are listed without a flag: they ship unmodified.

Where the flags appear:

- `third-party-notices.json`: every entry has `flags`; a flagged entry has `obligations`
  (`[{flag, note}]`).
- `THIRD_PARTY_NOTICES.txt`: a summary before the first entry lists every flagged package
  under each of its flags, and each flagged entry has `Flags:` and `Obligation (...)` lines.
- Build output: `LICENCE FLAG <flag>: <package>@<version> (<licence>)` on standard error
  from `generate-licenses.mjs`, `audit-production-bundle.mjs`, `verify-apks.mjs` and
  `generate-sbom.mjs`. They are warnings; the exit status is not affected.
- `apk-manifest.json`: verify-apks records `licenceFlags` on each APK row from that APK's
  packaged notices. `scripts/release-blockers.mjs` does not read it.
- SBOM: every component has `alphaphone:licence-expression` and `alphaphone:licence-flags`.
- Settings, Open source licenses: a flagged entry shows its flags and obligation notes.

Generation still fails on broken input: a package that is not installed, a `package.json`
that cannot be read, a pinned licence copy or OCR core that no longer matches its recorded
hash, a stale Android classpath snapshot, a malformed font licence record.

### Run on the staged resident runtime

On 2026-10-10, at upstream pin `40dbe96bd1`, the runtime was prepared, the workflow worker
built and the payload staged (`npm run agent:prepare`, `agent:build-workflow-worker`,
`agent:stage-android`), and `node scripts/generate-licenses.mjs --packaged-runtime` ran on
it. Before P-09 this command stopped on 24 entries. Result: exit 0, 660 entries, of which
550 are npm packages bundled into the agent or the workflow worker (518 package directories
named by the agent bundle and 53 workflow-worker dependencies, 550 distinct name and version
pairs, none missing), no entry without text, 66 entries flagged. This is notice generation
on a staged payload on a development machine. No APK was built from it, and the packaged
notices were not committed: the committed notices are the form without a staged runtime
(109 entries, 15 flagged), which `test/licenses.test.mjs` checks byte for byte.

| Flag | Entries (660 total) |
| --- | --- |
| `copyleft-strong` | 3 |
| `network-copyleft` | 1 |
| `copyleft-weak` | 3 |
| `share-alike-data` | 1 |
| `unknown-licence` | 1 |
| `non-open-source-terms` | 1 |
| `licence-text-missing-from-package` | 35 |
| `unverified` | 24 |
| `permissive-not-previously-listed` | 2 |
| `proprietary-no-licence-recorded` | 1 |

That run predates the Denton record below: Denton was then the one
`proprietary-no-licence-recorded` entry. With the record it is the one
`proprietary-licence-held-outside-repo` entry instead; the totals do not change. The run
was not repeated after the record was added.

An entry can carry more than one flag, so the column adds up to more than 66.

The 24 entries that used to stop the command, as they are now listed:

| Package | Licence | Flags |
| --- | --- | --- |
| `ffmpeg-static` 5.3.0 | GPL-3.0-or-later | `copyleft-strong` |
| `ua-parser-js` 2.0.10 | AGPL-3.0-or-later | `copyleft-strong`, `network-copyleft` |
| `rpc-websockets` 9.3.10 | LGPL-3.0-only | `copyleft-weak`, `licence-text-missing-from-package` (its licence file only names the LGPL; the LGPL and GPL texts are appended) |
| `sax` 1.6.1 | BlueOak-1.0.0 | `permissive-not-previously-listed` |
| `@metamask/sdk` 0.33.1 | UNKNOWN | `unknown-licence`, `non-open-source-terms` |
| `exif-parser` 0.1.12 | MIT, identified from its licence file | `unverified` |
| `text-encoding-utf-8` 1.0.2 | Unlicense, identified from its licence file | `unverified`, `permissive-not-previously-listed` |
| `@lit-labs/ssr-dom-shim` 1.6.0 | BSD-3-Clause | `licence-text-missing-from-package` (canonical text used) |
| 16 `@smthrs/*` 0.35.0 packages (agents, components, db, driver, engine, errors, graph, memory, observability, react-reconciler, sandbox, scheduler, scorers, time-travel, tool-context, vcs) | MIT, identified from each package's licence file | `unverified` |

`@metamask/sdk` is not open source. Its licence file (ConsenSys Software Inc., "All rights
reserved") grants a licence for non-commercial use only, with a limit on monthly active
users. P-09 rests on the dependencies being open source, so it does not cover this package.
It is listed with its own terms, flagged, and not blocked; whether the product may ship it
is an open question for the owner, and removing it from the agent bundle would be an
upstream elizaOS change. It was not assessed here.

Bun is flagged `copyleft-weak` as well as `unverified` because it statically links
JavaScriptCore (LGPL). The other copyleft entries (`mediabunny`, MPL-2.0; the pdf.js
Liberation fonts, GPL-2.0-only with the font exception) are in the committed notices too.

## Denton typeface (MVP-43)

`apps/app/public/denton-300.woff2` (SHA-256 `7e9341445b0bf2ec7f75e4a5d4dd4a677e9d2341f67ddcf766db92a21f310e05`)
is a commercial face imported from the design prototype. Its metadata says "All rights
reserved" and names no licence. It is proprietary, not open-source software, so the
open-source part of decision P-09 does not cover it.

Decision A-21 is closed. On 2026-10-10 the owner stated that Alpha Compute owns the Denton
font and that the licence is not in this repository, and that the font check is flag-only
([P-09](decisions.md#october-10-owner-product-decision)). The font was not replaced.

What is recorded is that statement, in `licenses/font-licenses.json`:

```json
{"name": "Denton typeface", "sha256": ["7e93…0e05"], "license": "LicenseRef-Commercial-Font",
 "evidence": "held-outside-repository", "holder": "Alpha Compute (owner statement, 2026-10-10)",
 "basis": "owner states the licence is held; the licence document is kept outside this repository",
 "recordedOn": "2026-10-10"}
```

No licence document, name, number, date, scope or terms is in the repository, and none was
seen in this work. The record has no field for them and none was invented. Consequences:

- The notice entry has the licence `LicenseRef-Commercial-Font`, says the face is
  proprietary and not redistributable under an open-source licence, prints the holder, the
  basis and "Evidence: held outside this repository", and is flagged
  `proprietary-licence-held-outside-repo`. It prints as a `LICENCE FLAG` line.
- The SBOM component carries the same licence and flag, `alphaphone:open-source` `false`
  and `alphaphone:licence-evidence`.
- The record covers only the listed bytes. Another font file, or a changed Denton file, is
  not covered by it.

The one follow-up that would complete the record: a reference to the licence document
(where it is held or its register entry; never the document itself, and no secrets) in a
`reference` field of the record. The notice then prints it. This is optional and blocks
nothing.

### Where Denton is referenced

| Place | Reference |
| --- | --- |
| `apps/app/src/prototype/prototype.css` line 7 | The only `@font-face` for `Denton`; the only URL for the file |
| `apps/app/src/prototype/prototype.css` line 8 | `.serif{font-family:'Denton','Fraunces',Georgia,serif;font-weight:300}`; `.serif` is used 89 times in `template.html` |
| `apps/app/src/prototype/template.html` | 36 inline `Denton, Fraunces, Georgia, serif` stacks, and one `Denton, Georgia, serif` (line 1275) |
| `apps/app/src/prototype/asset-manifest.json` | Source URL, size and hash of the file |
| `licenses/font-licenses.json` | The owner-statement record for "Denton typeface", by exact hash |
| `apps/app/public/licenses/` | Generated notice entry flagged `proprietary-licence-held-outside-repo` |
| `scripts/generate-licenses.mjs` | Reads every font under `apps/app/public`; no Denton-specific code |
| `scripts/prototype-capture.mjs` line 111 | Records `document.fonts.check('300 30px Denton')` in capture output |
| `test/licenses.test.mjs`, `test/font-license.test.mjs` | Use Denton as the proprietary-font example |

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

### If the font is ever replaced

Replacing Denton with Fraunces was the alternative under A-21. It was not chosen. The facts
above about Fraunces stand if it is revisited: an upright Fraunces 300 face would have to be
added (`apps/app/public/fonts/`, `prototype.css`, `asset-manifest.json`), line 7 of
`prototype.css` and the font file removed, the Denton record deleted from
`licenses/font-licenses.json`, the notices regenerated, and heading layout and the visual
baselines rechecked.

### The font check

`scripts/font-license-blockers.mjs` runs the one separately named licence check,
`unresolved-font-licence`, on a built payload. It sorts proprietary fonts into two lists:

- Resolved by owner statement: a file with the bytes recorded in `licenses/font-licenses.json`
  under evidence `held-outside-repository`, wherever it sits and whatever the notices say; or
  a typeface the payload's notices flag `proprietary-licence-held-outside-repo`, when the
  listed file still has the listed hash.
- Unresolved: a typeface the notices flag `proprietary-no-licence-recorded` (or carry the
  earlier `license unverified` marking), a listed font file whose bytes no longer match the
  hash its notice lists, or a file with the bytes of a font listed by hash in
  `licenses/unverified-allowlist.json`. A different or swapped font file is therefore
  reported as unrecorded.

Open-source licence flags are never part of this check.

Whether an unresolved font blocks is one constant, `UNRESOLVED_FONT_LICENCE_BLOCKS_DISTRIBUTION`
in `scripts/licence-policy.mjs`. Its default is `false` (the owner's "flag only"). Setting it
to `true` makes the check strict again.

| | `false` (default) | `true` |
| --- | --- | --- |
| Check runs and is recorded on each APK row (`fontLicenceCheck`: `status`, `items`, `resolved`) | yes | yes |
| Denton as recorded: `LICENCE FLAG (reported, not blocking) unresolved-font-licence: resolved-by-owner-statement: …` | printed, not blocking | printed, not blocking |
| A font with no record: line printed | `LICENCE FLAG (reported, not blocking) unresolved-font-licence: …` | `RELEASE BLOCKER unresolved-font-licence: …` |
| A font with no record: row `licenceBlockers` | empty | the unresolved items |
| A font with no record: release `distributable` | not affected | `false` |
| A font with no record: `scripts/release-blockers.mjs` (provisioning, pilot update, AOSP staging, head qualification) | does not name it | names it and refuses the release |

- `scripts/verify-apks.mjs` never fails verification because of the check, under either
  setting.
- `scripts/audit-production-bundle.mjs` prints the same lines for `web-dist` and still
  passes.

Both settings are covered by unit tests of the shared functions
(`test/font-license.test.mjs`) and the verify-apks wiring by source assertions; neither has
been run against built APKs in this change.

Five other entries of the committed notices are `license unverified` (the Piper voice model,
Sherpa-ONNX native build dependencies, the resident runtime payload, the pdf.js QuickJS
sandbox and the ONNX Runtime Web linked components). They are flagged `unverified`, are not
fonts and are not reported by this check. Under P-09 they block nothing; they have not been
reviewed.

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
