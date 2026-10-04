# Upstream consolidation

The active product is `apps/app`, not a forked copy of the upstream default UI.
It consumes Eliza agent, assistant, native and OS code through `vendor/eliza` and
`upstream.lock.json`. `packages/app` supplies runtime/native infrastructure;
Alphaphone supplies the renderer, identity, policy and packaging configuration.

## Inventory and ownership

The starting tracked inventory contained 249 Android files (about 2.4 MB), 211
scripts (about 1.6 MB), eight backend files (about 65 KB, including the lockfile),
and 221 renderer source files (about 2.5 MB). These counts include tests and
configuration; they do not measure how much independently reusable code exists.

| Area | Disposition | Why |
| --- | --- | --- |
| `base/eliza-app` | Removed; retain `eliza-app-baseline-provenance.json` | No runtime imports. Only the baseline integrity test consumed its 2,344 recorded source files (plus the import guide). Original content remains recoverable from the recorded upstream commit and product Git history. |
| `backend/loader.ts` source-export resolution | Extract shared resolver; retain pin checks and composition | Package export resolution is generic. Product pin, data directory, salt provisioning and runtime entrypoint remain Alpha configuration. |
| `backend/runtime.ts` | Keep product composition; further generalization requires an upstream host API | Selects Cerebras text-only inference, Alpha character instructions, permitted actions, owner/session initialization and proposal-only behavior. Copying this upstream unchanged would make Alpha policy a platform default. |
| `backend/proposal-action.ts` | Keep action/view policy; timezone conversion is a reusable candidate | Imports the renderer's exact view allowlist and binds proposals to its context revision. Approval UX and note/reminder schemas are product contracts. |
| `backend/run.ts`, `test-runtime.ts`, package/lock | Keep development entrypoint and consumer acceptance | These exercise Alpha's real composition and preserve its independent dependency closure. Deleting the lockfile would reintroduce reliance on an unqualified monorepo install. |
| `android/local-speech` | Shared Java/library policy upstream; local generated inputs and Gradle adapter | Namespace is already `ai.eliza.speech`; no Alpha UI or identity dependency. Preserve pinned model/runtime hashes, notices, cancellation and audio bounds. |
| `scripts/local-speech` | Shared implementation upstream; compatibility wrappers local | Build sources, patch, acquisition manifests and ABI qualification are reusable. Staging must stay outside the pinned checkout and be locked against concurrent commands. |
| `scripts/toolchain.mjs` | Reuse existing upstream `scripts/mobile/toolchain.ts` | SDK/JDK discovery is already shared, including Linux support. Alpha retains its build-tools version and minimum JDK policy. |
| `scripts/instrumentation-result.mjs` | Shared parser upstream; compatibility export local | Generic Android instrumentation protocol validation; requested classes are supplied by each consumer. |
| `scripts/build-android.mjs`, `verify-apks.mjs`, `apk.mjs` | Keep product orchestration and acceptance policy | Build both Alpha flavors, inspect package identity, deferred Contacts permissions, optional camera hardware, release signing state and payload contents. Generic APK inspection can become an upstream leaf API. |
| `scripts/prepare-ci-*`, `ci-emulator-*`, `ci-webview-*` | Keep qualified fixture adapter for now | Tightly bound to exact disposable image/provider identities, safety admission, storage topology and diagnostic evidence. A generic upstream runner needs explicit fixture configuration and equivalent negative tests. |
| `scripts/android-*`, `test-*`, browser fixtures | Keep product acceptance scenarios | Mostly exercise Alpha UI routes, approvals, storage, native bridges, account isolation and HOME behavior. Shared parsers belong upstream; product scenarios remain local. |
| `scripts/maps` | Candidate shared regional dataset service | Dataset manifest verification, indexing and routing are reusable; port to `plugin-maps` with configurable ports, dataset paths, attribution and consumer integration tests. Alpha map UI remains local. |
| `scripts/stage-local-agent-*`, `prepare-local-agent`, workflow worker tooling | Candidate upstream external-consumer build API | Already consume pinned upstream runtime. Package/socket rebinding, secure-store environment injection and identity/resource assumptions need explicit supported parameters before string-based staging can be deleted. |
| `scripts/agent-model.mjs`, development/combined host launchers | Keep product routing adapters | Cerebras routing, model/profile mismatch checks and local development policy are intentional product decisions. Shared transport/build mechanics can move behind configurable APIs. |
| `scripts/stage-aosp.mjs` | Keep product CLI adapter | Already delegates launcher admission to `packages/os/scripts/distro-android/stage-launcher-overlay.ts`. Package/version/signing/variant policy belongs to the product. |
| `scripts/prototype-*`, `compare-prototype.py`, research report generation | Keep product evidence tooling | Bound to supplied Alpha design and research assets; not Eliza platform functionality. |
| Android manifests, `MainActivity`, resources, app Gradle/config, flavor manifests | Keep | Own package identity, component registration, permissions, standalone/HOME distribution and launcher lifecycle. A shared library cannot replace a product APK entrypoint. |
| `android/notification-fixture`, `androidTest`, debug/release source sets | Keep consumer tests and development-only bridges | Evidence must exercise the installed Alpha package and preserve debug-only capabilities. |
| Renderer views, styles, assets, layouts, navigation and view allowlists | Keep | Independent product UI and identity; never import another product's renderer. |

## Next native extractions and their required contracts

| Local code | Upstream owner | Required work before deletion |
| --- | --- | --- |
| `DeviceAppsPlugin` enumeration/launch | `plugin-native-system` | Add scoped launchable-app enumeration and launch helpers; preserve exported-activity checks, self exclusion, deduplication, unavailable handlers and no `QUERY_ALL_PACKAGES`. Build identity remains local. The pinned system plugin currently exposes roles/settings, not this complete list/launch contract. |
| `AlphaCalendarPlugin`, creation/deletion guards | `plugin-native-calendar` | Adopted the newer host-configured Android adapter, preserving Alpha account, calendar, label, color, journal and URI identity. Added upstream wiring and native identity tests; retained product acceptance scenarios. The original pin exposed the Apple contract; newer develop now has a separate Android adapter. |
| `ReminderStore`, receivers/taps and envelopes | `plugin-native-reminders` | Newer develop has a host-configured engine with explicit secure-store factories, resource ownership and per-envelope synchronization. Added missing native identity admission tests upstream. Alpha adoption still requires an encrypted-store adapter, exact legacy PendingIntent/storage configuration, and recovery/upgrade scenarios; do not swap these identities mechanically. |
| `AlphaCredentialStore`, renderer slots, connection/voice credentials | `plugin-native-secure-store` and shared session transport | Generalize registered credential scopes and migration, not arbitrary renderer key access. The current upstream TypeScript contract admits fixed session/runtime keys; Alpha stores additional scoped credentials and journals. Preserve Keystore/no-backup semantics and credential-generation binding. |
| Browser bookmarks/downloads/reading/password-provider surface | `plugin-native-browser-surface` | Extract isolated surfaces and approved observation/action contracts; retain origin/version/consent binding and no Capacitor bridge in third-party pages. Product navigation and account decisions remain local. |
| `AlphaFilesPlugin`, selected-document access, document export | `plugin-native-filesystem` | Support Android SAF persistable grants, exact-byte provider readback, cancellation and grant loss. Avoid replacing user-selected document capabilities with unrestricted paths. |
| Photos, filters, owned edits/video playback | Native media/camera libraries | Parameterize storage ownership and publication callbacks; preserve MIME/content checks, lifecycle, original preservation and explicit export. |
| Hosted/resident result transport, notification delivery/recovery | `plugin-native-agent` and workflow client contract | Separate transport from Alpha storage schema/routes. Retain owner/agent/session/install/enrollment binding, durable receipts, at-most-once notification dispatch and unknown outcomes. |
| `apps/app/src/runtime` transport and protocol validators | Narrow browser-safe upstream SDK exports | Protocol leaves can move without UI; route choices, connection controller state, secure credential adapters and product capability reduction stay local. Consume through explicit public exports and external-consumer tests. |

## Verification boundaries

The WebView CI failure was SystemUI waiting for SurfaceFlinger GPU context priority
across framework restart. Disabling host Vulkan passed focused qualification in run `37164442229`, but
full PR smoke reproduced the ANR. Restarting only the primary Zygote/framework
preserves SurfaceFlinger; all 38 provider tests and hosted qualification run
`37168294637` passed. Full smoke remains a separate required check. The
ANR/display/provider checks remain enabled.
Both PRs receive one browser/Android run per PR update rather than duplicate branch
push and PR runs. Push verification remains enabled on `main`.

Component tests, APK assembly, emulator HOME/bridge tests, resident-runtime tests,
full AOSP image boot, live integrations and physical-device/user acceptance are
separate results. No source move or successful APK build establishes the latter
acceptance gates. Upstream changes must be published and reviewed before the
consumer pin and local deletions are merged together; never edit the vendor
checkout to make an uncommitted extraction appear consumed.

The extraction also preserves the reviewed staging speech warmup and late-abort
worker receipt fixes from upstream PRs #33238 and #33243 when advancing to develop.
These fixes were absent from that branch despite being present in Alpha's earlier pin.

## Consolidation evidence

The main extraction merged in elizaOS/eliza#33253 and AlphaCompute/alphaphone#144.
The CI framework restart repair merged in AlphaCompute/alphaphone#143.
The native test harness follow-up merged in elizaOS/eliza#33265: calendar and reminders
are host-configured libraries, so their identity tests run without an invented
default Capacitor bridge. Existing bridge modules retain their WebView tests.

Local qualification on an isolated API 35 emulator passed calendar CRUD,
revoked-access and reviewed agent operations (3/3) for each Alpha variant.
The creation recovery/no-replay test passed (1/1 per variant) in a fresh owned
secondary user. Shared calendar identity tests passed 2/2 and reminder identity
admission passed 1/1, with no skips. No real accounts or external integrations
were connected. These native tests exercised production code unchanged by the
subsequent test-harness-only pin update.

The initial consumer verification passed all 258 tests, typechecking and the web
build; Android assembly, both debug/release variants, both instrumentation APKs,
lint and APK policy verification passed (760 Gradle tasks). Final-pin verification also passed all 258 tests, typechecking, the web build,
both debug/release and instrumentation APK variants, lint and APK policy checks.
The regenerated speech qualification manifest records the exact rebuilt ABI
bytes; source/model acquisition pins and the no-eSpeak policy are unchanged. These results do not establish a full AOSP image boot,
live integrations, or physical-device/user acceptance.

The combined integration retains the previously qualified speech AAR and its
matching runtime manifest. The native-library harness update changes no speech
source, model or generator inputs. The regenerated hashes in the original #151
branch remain historical evidence for that build; they are not substituted for
the actual binary inputs used by this combined build.
