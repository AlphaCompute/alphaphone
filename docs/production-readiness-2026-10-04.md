# Production readiness record — October 4, 2026

This record covers the work that takes Alpha Phone out of demo mode: production builds
are the live app, and every mock, fixture and developer surface is behind one build-time
switch. It lists what changed per work package, the commands that qualify it, the
evidence class of each result, and what remains external. It is not acceptance
evidence by itself, and no result below is claimed for an evidence class it was not
observed in. The [current status](mvp-current-status.md) remains the requirement index.

## Evidence classes

Results are recorded in exactly one class. None proves another.

| Class | Meaning |
| --- | --- |
| S — source/test | `npm run verify`, unit tests, Playwright lanes, bundle audit of `web-dist` |
| B — APK build | `npm run android:build` and byte inspection by `scripts/verify-apks.mjs` |
| E — emulator | Installed APK on a disposable emulator, including HOME-role and instrumentation |
| I — AOSP image | Full image build and boot with the admitted launcher |
| R — real integration | Real accounts, OAuth grants, provider keys, domains |
| D — device/user | Physical unit and user/stakeholder acceptance |

## The switch

`ELIZA_DEV_ALLOW_TEST_MOCKS` (upstream name, from
`vendor/eliza/packages/app/scripts/dev-ui.ts`) is off unless exactly `1`. When off, the
build contains no mock mode, prototype fixture data or images, mock connection choice,
`?mode=mock`/`?fixture=1`/`?mode=dev`/`?start=` entry points, device controls, simulated
apps, local development agent (`10.0.2.2:2138`) option, Cloud Staging environment,
DevelopmentAgent fallback transport, or debug-only native hooks. This applies to the
production web build and all four distribution APKs. It is turned on only by
`npm run dev`, `npm run dev:local`, `npm run dev:maps`, the Playwright web server, the
browser CI job, `ELIZA_DEV_ALLOW_TEST_MOCKS=1 npm run build`, and
`npm run android:build -- --test-mocks` (output only in `artifacts/test-mocks/`). No
`ALPHA_*` switch was added and the Vite env prefix was not widened to `ELIZA_`.

Legacy state with the switch off: a saved `alpha.connection.selection.v1` of
`{kind:'mock'}` becomes `{kind:'none'}` and the chooser opens; a saved Cloud `staging`
service is treated as signed out; paused native notification collection resumes only
through an explicit connection choice.

## Changes by work package

Each package was developed in its own branch from the same `origin/main` base
(`c1f21e71`). The "intended change" column is the agreed package contract. Results for a
package come from that package's own report and from the merged-head qualification
below; this documentation package did not observe them and does not restate them as
passed.

| Package | Intended change | Owner-reported qualification |
| --- | --- | --- |
| demo-flag-gate | `apps/app/src/build-flags.ts`; `vite.config.ts` constant folding, `web-dist/build-flags.json`, fixture-module swap; flag injection for `npm run dev`, Playwright, `dev-local`, `maps/dev`; legacy mock/staging state rewrite in the connection UI; `scripts/audit-production-bundle.mjs` with `--expect-test-mocks`; `npm run test:browser:production` with `test/browser/production-surface.spec.ts`; browser CI | S: see package report |
| dev-surfaces-gate | Development profile, device controls, simulated apps, location simulation, development Cloud/connection/identity/workflow/digest stores, DevelopmentAgent transport and local dev agent bridge gated by `devSurfacesEnabled`/`testMocksEnabled` | S: see package report |
| fixture-extraction | Prototype fixture data and images moved into `apps/app/src/prototype/fixtures.js`; `fixtures.empty.js` with identical export names and no image references | S: see package report |
| android-native-hardening | `ELIZA_DEV_ALLOW_TEST_MOCKS` Gradle property and `BuildConfig` field; `src/debug` hooks moved to `src/testMocks` and attached to debug only when on; `ELIZAOS_*` signing and version; R8 minification and resource shrinking with `proguard-rules.pro`; base network security config; App Links template prepared (inactive) | S/B: see package report |
| android-release-pipeline | `build-android.mjs --test-mocks` into `artifacts/test-mocks/` and env scrubbing otherwise; `verify-apks.mjs` checks for test-mock classes, cleartext config, fixture-package queries and the bundle audit on each APK's `assets/public`; `scripts/qualify-head.mjs`; Android CI updates | S/B: see package report |
| privacy-and-honest-settings | Per-connection privacy disclosure; resident agent redaction switches (`ELIZA_SECRET_SWAP_ENABLED`, `ELIZA_PII_SWAP_ENABLED`) on by default versus host default off; no "data stays local" claim with hosted inference | S: see package report |
| third-party-licenses | `scripts/generate-licenses.mjs`; `apps/app/public/licenses/third-party-notices.json` and `THIRD_PARTY_NOTICES.txt`; Settings rendering with an unavailable fallback | S: see package report |
| workflow-and-scan-mvp | Workflow protocol/adapter/authoring/scope and scan-event review completion items | S: see package report |
| docs-status-reconciliation | README, status, storage, runbook and qualification docs reconciled with the flag-gated product; this record; `test/docs-flag-qualification.test.mjs` | S: below |

## Merged-head qualification

Run these on the merged head and record the exact commit, date and result. Until then
each row is **pending**; a package-branch pass does not qualify the merged head.

| Command | Class | Expected result | Status |
| --- | --- | --- | --- |
| `npm run verify` | S | Typecheck, all unit tests, production build | pending on merged head |
| `node scripts/audit-production-bundle.mjs web-dist` | S | No denylist hits; `build-flags.json` reports `testMocks: false` | pending on merged head |
| `npm run test:browser` | S | Development surfaces work with the switch on | pending on merged head |
| `npm run test:browser:production` | S | Production build exposes no mock/dev surface; legacy mock selection opens the chooser | pending on merged head |
| `npm run android:build` (includes `verify-apks.mjs`) | B | Four distribution APKs, no test-mock classes or cleartext config, clean bundle audit of each `assets/public` | pending on merged head |
| `npm run android:build -- --test-mocks` | B | Output only in `artifacts/test-mocks/`; distribution APKs untouched | pending on merged head |
| `node scripts/qualify-head.mjs` | S/B | Head-commit qualification record | pending on merged head |
| `ANDROID_SERIAL=… npm run android:smoke` on distribution APKs | E | Launcher HOME role and bridge on the no-mock build | not run |
| Upgrade from saved mock state (runbook) | E, then D | Chooser opens, no mock surface, collection stays paused, real data kept | not run |
| Signed release install and R8 behavior | E, then D | Signed release starts and plugins resolve after minification | not run (no release key here) |

## Commands run by this package

In the `claude/mvp-docs-status-reconciliation` worktree, based on `c1f21e71`, before the
other packages merged:

| Command | Class | Result |
| --- | --- | --- |
| `node --test test/docs-flag-qualification.test.mjs` | S | 5 of 5 pass (entry-point qualification, README contract, status gates, no production mock claim, relative links and anchors) |
| `npm run verify` | S | Exit 0: typecheck, 347 of 347 unit tests (0 skipped), production web build |

No Playwright, Android build, emulator, image, real-integration or device run was made by this package; it changed no renderer or native source. These runs cover documentation consistency and the unchanged base source only. They do
not qualify any other package's change.

## Remaining external items

These need hardware, real accounts, keys, domains or decisions, and are prepared but
open. Runbook entries are in the [pilot acceptance runbook](pilot-acceptance-runbook.md).

| Item | Prepared in software | Still needed |
| --- | --- | --- |
| Release signing | `ELIZAOS_*` signing and version inputs; unsigned output otherwise; `apksigner` and descriptor flow in [Android and AOSP](android-and-aosp.md) | Release key custody, signed APKs, signer pinning in the OS image |
| Signed update and rollback | Version inputs, runbook procedure | Two signed versions, update and rollback drill on emulator and on a device |
| App Links | Template and commented `autoVerify` filter | Owned host, published `assetlinks.json`, reviewed activation, verification on a signed install |
| Gmail | Owner/grant-aware contracts | Production OAuth client and consent, real grant/revoke/recovery |
| Cerebras key | Native secure provider setup | Program key provisioned per unit without exposure |
| Password provider | Setup/status, verified-publisher checks | Real-site save/fill/passkey on a signed build |
| Maps | `VITE_MAPS_BASE_URL`, regional gateway | Production HTTPS gateway, data licence review, physical navigation |
| Resident redaction | Defaults on in the resident agent; instrumentation test | Re-run on current APKs (emulator, then device) |
| Licences | Generated notices and Settings view | Legal review; native-app and OS-image notices |
| AOSP image | Launcher admission and overlay staging | Selected hardware target, image build and boot |
| Pilot | Runbook and per-unit record | Four physical units, latency/soak, stakeholder decisions (powered-off scheduling, Email scope) |
