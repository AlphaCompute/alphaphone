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

Each package was developed in its own branch from `origin/main` `c1f21e71` and merged,
in this order, into `claude/mvp-production-integration` on top of `origin/main`
`c51a07b5` (about 120 newer commits). Where main had moved code the package touched,
the integration kept main's behaviour and reapplied the package's gating to it.

| Package | Change as integrated |
| --- | --- |
| demo-flag-gate | `apps/app/src/build-flags.ts`; `vite.config.ts` constant folding, `web-dist/build-flags.json`, fixture-module swap; flag injection for `npm run dev`, Playwright, `dev-local`, `maps/dev`; legacy mock/staging state rewrite in the connection UI (kept beside main's asynchronous development identity and Cloud setup intent recovery); `scripts/audit-production-bundle.mjs` with `--expect-test-mocks`; `npm run test:browser:production`; Playwright `chromium`, `production`, `firefox` and `webkit` projects; browser CI production lane and main's Firefox/WebKit storage matrix, now selected by project |
| fixture-extraction | Prototype fixture data and images in `apps/app/src/prototype/fixtures.js`; `fixtures.empty.js` with identical export names and no image references |
| dev-surfaces-gate | `devSurfacesEnabled` gates on main's document-backed development account, agent, execution, digest, workflow and Cloud setup stores, development identity, the Cloud setup fixture component, simulator writer, location simulation, the hosted digest panel (development digest store loaded lazily) and the connection controller's development methods; staging, loopback HTTP origins and the Maps emulator gateway restricted to test mocks |
| android-release-pipeline | `build-android.mjs --test-mocks` into `artifacts/test-mocks/` and environment scrubbing otherwise; `verify-apks.mjs` checks for test-mock classes, cleartext config, fixture-package queries and the bundle audit on each APK's `assets/public`; `scripts/qualify-head.mjs` (now selecting engines by Playwright project); Android CI updates |
| android-native-hardening | `ELIZA_DEV_ALLOW_TEST_MOCKS` Gradle property and `BuildConfig` field; debug hooks in `android/app/src/testMocks`, attached to debug only when on; `ELIZAOS_*` signing and version; R8 minification and resource shrinking; base network security config; App Links template (inactive); WebView renderer-loss recovery |
| privacy-and-honest-settings | Per-connection privacy disclosure; resident redaction switches (`ELIZA_SECRET_SWAP_ENABLED`, `ELIZA_PII_SWAP_ENABLED`) on by default versus host default off; configured resident provider and model reported without the key |
| workflow-and-scan-mvp | Interrupted-run policy ported onto main's workflow intent store (outcome-unknown labels, no replay, explicit cancellation before removal, confirmed new run only for read-only digests); unsupported-scope refusal before generation; inferred poster dates, zones, all-day and repeat suggestions with disclosure |
| third-party-licenses | `scripts/generate-licenses.mjs`; notices regenerated for main's pinned elizaOS `79bda059`; Settings rendering with an unavailable fallback |
| docs-status-reconciliation | README, status, storage, runbook and qualification docs; this record; `test/docs-flag-qualification.test.mjs`. Main's removal of the obsolete verification journals and its canonical storage table were kept. |

## Integrated-head qualification

Recorded on `claude/mvp-production-integration` (2026-10-05, macOS, Node 24.15.0) after
all nine merges and the follow-up fixes. A pass here is class S or B for that source
only.

| Command | Class | Result |
| --- | --- | --- |
| `npm run verify` | S | Pass: typecheck, 467 of 467 unit tests (0 skipped), flag-off web build, bundle audit |
| `ELIZA_DEV_ALLOW_TEST_MOCKS= npm run build` and `node scripts/audit-production-bundle.mjs web-dist` | S | Pass: 244 files, `testMocks: false`; no `Mock mode`, `mode=mock`, `Jordan Park`, `Exit mock mode` or `Device controls` string in `web-dist` |
| `npx playwright test --project=production` (`npm run test:browser:production`) | S | 11 of 11 pass |
| `npx playwright test --project=chromium --workers=4` (`npm run test:browser`) | S | 1829 pass, 14 skipped, 0 failed |
| `npx playwright test --project=firefox --project=webkit --workers=4` | S | 578 of 578 pass |
| `npm run android:build` (includes `verify-apks.mjs`) | B | Pass after `agent:prepare`, `agent:build-workflow-worker`, `agent:stage-android` and a local speech AAR build: four APKs with the packaged resident runtime, no test-mock classes, clean bundle audit of each `assets/public`; releases unsigned (no `ELIZAOS_*` key here) and recorded distributable by runtime |
| `npm run android:build -- --test-mocks` | B | Pass: four APKs plus instrumentation in `artifacts/test-mocks/` only, recorded `testMocks: true` and not distributable; the distribution APKs were not rewritten. It leaves a flag-on bundle in `web-dist`, so rebuild with the switch off before any `cap sync` |
| `node scripts/qualify-head.mjs` | S/B | Not run on this head |
| `ANDROID_SERIAL=… npm run android:smoke` on distribution APKs | E | Not run |
| Upgrade from saved mock state (runbook) | E, then D | Not run |
| Signed release install and R8 behavior | E, then D | Not run (no release key here) |

The local speech AAR was rebuilt on this Mac from the documented scripts; its bytes differ
from the hashes recorded in `android/local-speech/runtime-manifest.json`, so the APKs above
are build evidence for this source only and are not release candidates. A plain
`npm run android:build` on a clean checkout fails first in Gradle's
`:app:stageLocalAgentSources` (no prepared runtime source), then in
`:local-speech:preBuild` (no speech AAR); `npm run android:build:local` stops in
`agent:stage-android` because it does not build the workflow-worker artifact.

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
