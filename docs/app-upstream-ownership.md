# Alpha Phone application ownership and extraction

Scope: every file in `apps/app`, including `src`, public assets and the entry HTML.
The machine-readable companion is [app-ownership-inventory.json](app-ownership-inventory.json).
Regenerate it with `node scripts/audit-app-ownership.mjs`. It records file hashes,
imports, exports, proposed owners, and line locations of product/storage/host/UI
dependencies. This is an exhaustive static inventory, not a claim that every
behavior has been semantically reviewed or migrated.

## Architectural finding

`browser` is not the application entrypoint. `src/main.tsx` first registers browser
implementations, imports the prototype renderer, and installs product adapters.
The same renderer runs in the browser and Android WebView. `browser` contains
both real browser implementations (IndexedDB files, geolocation, media capture)
and explicitly selected development simulations. These need different upstream
entrypoints and admission rules; moving the folder intact would preserve the
wrong boundaries.

There are 278 files under `apps/app`, of which 221 are under `src`: 102 browser
files, 53 runtime files, 47 prototype files, 11 Maps files and eight root files.
The largest product source files include `prototype/model.js` (5,860 lines),
`prototype/template.html` (3,934), `runtime/connection-ui.tsx` (813),
`prototype/camera-adapter.ts` (655), and `runtime/hosted-digest-ui.tsx` (609).
Several compressed source lines contain entire functions, so line count is a
poor estimate of the remaining extraction effort.

Before extraction these source files totalled 28,083 physical lines: 3,615 in
`browser`, 6,829 in `runtime`, 547 in `maps`, 15,677 in `prototype`, and 1,415 at
the source root. The import graph from `main.tsx` does not reach the old root
`style.css`, `VoiceRecorder.tsx`, or `useDevice.ts`. They should be evaluated for
retirement rather than promoted upstream as active implementation. The other
unreached source-folder files are declaration/provenance documentation.

The biggest dependency cycles are not visual styling. Connection UI also owns
session/controller state and is imported by voice, inbox and workflow consumers.
`device-actions.ts` imports product MVP policy and selected Maps state.
Development providers import production protocols, while production composition
imports development providers. Prototype adapters patch class/view methods and
reach directly into storage and native plugins. These cycles must be broken
with host interfaces before the shell can be thin.

## What stays in Alpha Phone

- Product identity: application ID, name, icons, logos, Android packaging,
  standalone/HOME distribution configuration, release metadata and AOSP product
  composition. Native capability implementation is a separate upstream concern.
- Product visual system: the Alpha glyph, icon geometry, typography, light/dark
  palettes, phone frame, launcher arrangement, conversation surfaces, sheet
  layout, animations and product copy. `prototype.css`, `phone.css`, the
  presentation parts of `model.js`/`template.html`, and public images/fonts remain
  product-owned. Imported public React scripts and `dc-lite.js` are provenance
  copies; the active renderer imports npm React and the adapted helper.
- Product defaults: enabled/deferred MVP views, app order, initial appearance,
  default provider and dataset, optional build-time endpoint, language policy,
  device geometry and application-specific review text.
- Product composition: register exactly one instance of each Capacitor plugin,
  supply native/browser providers before consumption, bind navigation/lifecycle
  events, render review dialogs and inject theme tokens. `main.tsx` should become
  composition rather than accumulating domain operations.
- Compatibility names: installed `alpha.*` storage keys, native bridge identities,
  lifecycle events and URL schemes remain explicitly configured during migration.
  They are data/ABI contracts, not reasons to keep the underlying engine local.
- Product demonstration data and reference provenance. Retain the explicit
  mock/development boundary. A generic simulator must never claim carrier,
  payment, hardware or authenticated provider success.

The current primary accent is `#0000FF`, with dark accessible text accent
`#8A93FF`; Maps currently uses `#1616d8` for markers/routes. Light backgrounds are
white/near-white and dark backgrounds are black/near-black. Denton is the primary
serif, with Fraunces/Georgia fallbacks; Public Sans is the principal sans face.
These values appear in CSS, model-generated style strings, and imperative
dialogs. They need a single product theme contract, not hard-coded upstream
copies. Map typography and route-sheet padding are now passed by Alpha.

## Upstream ownership by domain

| Domain | Destination | Reusable behavior | Product seam to remove |
| --- | --- | --- | --- |
| Maps | `plugins/plugin-maps` | Controller, provider transport, coordinate/route validation, saved places, approved selected reads, route distance, location lifecycle, guidance ownership, sharing and map rendering | Storage namespace, device/speech ports, font/worker URLs, colors, route padding, regional dataset and gateway |
| Files/documents | `plugins/plugin-files`; native filesystem remains `plugin-native-filesystem` | IndexedDB transactions, revision-bound selections, import/export, ZIP, exact attachment validation, PDF rendering, workflow receipts, OCR and document scan processing | Picker cancellation, sandboxed preview/review UI, asset URLs, database namespace, archive name |
| Calendar | `plugin-calendar` and `plugin-native-calendar` | Record/recurrence model, civil-time conversion, browser provider, versioned CRUD and recovery | Editor layout, local calendar selection and storage keys |
| Reminders | `plugin-native-reminders` and existing approved device contracts | Repeat/timing validation, browser provider, durable create/delete reconciliation | Alpha editor, enabled-view policy and installation store |
| Notes | `plugin-notes` | Versioned records, migrations, uncertain-write recovery, secure persistence, audio deletion reconciliation | Legacy keys, secure-store port and Notes editor |
| Camera/photos/video | `plugin-native-camera` browser surface | Capture ownership, sensor crop, focus serialization, photo processing, video codecs/transcoding and library operations | Viewfinder, reticle style, filter presets and review UI |
| Voice | `plugin-native-talkmode` and existing UI voice contracts | Capture/PCM conversion, playback ownership, cancellation, stream fencing and speech transport | Review presentation, account port, language/recording policy and legacy native names |
| Browser/reading | `plugin-native-browser-surface` and `plugin-browser` | Isolated navigation, document observations, sensitive-content checks and owned reading | Product toolbar, theme, consent dialog and password-provider setup |
| Workflows | `plugin-workflow` | Authoring/validation protocol, reviewed admission, lifecycle receipts, trigger and execution logic | Product view policy, rendering, device ports and development-only fixture stores |
| Digests/inbox | `plugin-personal-assistant` with existing cloud/agent client contracts | Bound sources, delegation, durable result inbox, account fencing and inbox operation reconciliation | Alpha panels, provider defaults and installation identity |
| Agent connection | Existing `packages/ui` client integration and agent/cloud transports | Session state machine, authentication protocol, reconnection and stream parsing | Product view enum, UI singleton, endpoints and secure-store adapter |
| Device/notifications | Existing native system/location/settings plugins | Capability providers, lifecycle, notification ownership, permissions and device observations | Alpha shell navigation, HOME behavior, themes and notification layout |
| Development simulation | Shared client test/development harness alongside owning plugins | Durable simulated providers, fault injection and deterministic lifecycle controls | Alpha sample people/messages, view method patches and fixture admission |

Do not create one giant upstream `browser` package. Do not move Alpha's complete
prototype UI into Eliza. Shared plugins should expose browser-safe, narrow
subpaths; importing a Maps controller must not load the agent runtime, SQL,
cloud credentials or a whole UI barrel. Existing upstream Maps has agent-side
schemas/store/actions; the new client contract is an explicit compatibility
surface, not a replacement for the canonical agent schema. Converging those two
contracts requires an adapter and protocol migration, not silent field renames.

## First extraction candidate

[client-features.patch](../patches/eliza/client-features.patch) contains additive
upstream source under `plugin-maps/src/client`, `plugin-notes/src/client` and the
new `plugin-files` package.
[client-features-source.json](../patches/eliza/client-features-source.json) binds
it to the Eliza pin and patch hash. `scripts/prepare-client-features.mjs` applies
the patch into ignored `.eliza/client-features`; npm development, build,
typecheck and test entrypoints prepare that source automatically. `vendor/eliza`
and the imported baseline remain immutable.

Alpha currently consumes the staged source through compatibility modules. Maps
wrappers supply the installed saved-place key, location/speech ports, regional
configuration and visual options. Files supplies its installed database name,
archive name, PDF assets, cancellable picker and sandboxed document viewer.
Document wrappers supply Alpha PDF metadata, English OCR assets and the installed
scan-draft database name. Notes wrappers retain installed current/legacy keys and
secure slots while the upstream client owns revisions, migration, compare-exchange
and uncertain-write recovery.
Existing browser tests can keep using the original module paths and exercise
the shared implementation. These re-exports are transitional compatibility
adapters, not a claim that the complete app has been moved.

The candidate is not yet a reviewed/published upstream commit or a registry
release. A patch stored in this repository is not upstream delivery. Before
publication, compose against current `develop`, reconcile manifests and package
exports/dependencies, run owning upstream checks and root verification, open the
upstream PR, and only then choose a reviewed pin update. A clean checkout must
continue to reproduce the consumer without modifying the submodule.

## Remaining dependency-ordered work

1. Qualify Maps/Files extraction: independently configured consumers, installed
   data compatibility, stale revisions, cancellation, exact bytes, durable
   receipts, location cleanup, guidance replacement and both APK variants.
2. Document algorithms (correction, edge detection, PDF, OCR, text layers, links
   and draft persistence) are now extracted. Continue with media utilities and
   document orchestration, retaining product review UI and asset policy.
3. Notes contracts and stores are extracted; Notes audio reconciliation and
   editor orchestration remain. Split calendar/reminder models and contracts.
   Preserve timezone semantics, recovery journals, uncertain-write state and
   encrypted migration acknowledgments.
4. Separate session/controller state from `connection-ui.tsx`; inject the
   product's allowed views and selected-observation resolvers into the device
   executor. Move protocol/transport code using those interfaces.
5. Move workflow, digest and inbox engines with typed host ports. Reuse existing
   upstream scheduler, approvals and receipts; simulations remain separately
   admitted and must not become another production scheduler or identity store.
6. Replace prototype method patching with product view adapters calling upstream
   APIs. Extract real domain behavior from `model.js`; retain reference fixtures
   and design provenance. Identify unreachable legacy modules before deletion.
7. Audit Android and host scripts for capability implementation that should
   accompany the plugins. Branding/package/resource/build defaults stay local.
8. Publish reviewed upstream changes and adopt a retrievable pin. Re-run root,
   browser, standalone and launcher qualification on that exact composition.

APK compilation, emulator HOME-role behavior, AOSP image boot, real provider
integration, and physical-device/user acceptance remain separate evidence gates.

## October 3 candidate validation

- `npm run verify`: passed, 261 tests and production web build.
- Maps/Files/lifecycle browser regression: 71 passed. After fixing the Files
  public declaration API, all 36 affected Files tests passed again.
- Real MapLibre worker/render/route/cleanup test: passed with explicitly
  synthetic tile responses. This does not establish real provider coverage.
- Eight portable upstream-package tests passed without an Alpha host. Maps,
  Files/documents and Notes emitted TypeScript declarations; consumer typecheck
  passed. Notes tests cover isolated namespaces, lost migration acknowledgement
  and compare-exchange conflicts.
- Before upstream packaging cleanup, document/Notes browser regressions: 62 passed.
  Qualification of the subsequent package-ready source is in progress.
- Current upstream composition is staged in the dedicated
  `artifacts/upstream-client-publication` worktree on
  `codex/shared-phone-client-features`, based on `38bc4147fb57c294cefe0d724d614f55eee7b8cb`.
  Package exports, dependencies, declarations and native test registration are
  being integrated there. Scoped lint has no errors; full upstream checks and
  publication are still pending.
- `npm run android:build`: attempted, failed with `ENOSPC` during
  `stageLocalAgentSources` and Gradle cache writes. Neither distribution is
  qualified for this candidate. The exact required resident source was prepared
  from an existing local Git cache; source-admission checks were retained.
- Real regional-provider renderer qualification could not start: the local
  dataset manifest is stale. No data manifest was resealed or check bypassed.
- `vendor/eliza` remains clean at its original pin. Upstream publication,
  upstream root checks, emulator, AOSP and physical-device acceptance are pending.

Command logs, patch hash and working-tree file hashes are in the ignored
`test-results/upstream-client-extraction/validation.json` and adjacent logs.
