# Native startup qualification — October 3

An installed `52ab225f` standalone APK reached a blank renderer on the owned Android 35 Pixel 9 emulator. Read-only WebView diagnostics recorded `TypeError: gr.addListener(...).then is not a function` with an empty root. The shared plugin helper returned Android's injected legacy plugin object, whose listener handle is synchronous, instead of the modern Capacitor proxy. The helper now caches only modern registrations, preserving the first browser implementation and shared plugin identity.

The baseline native-shaped startup case fails; the repaired production entrypoint opens with no page errors and verifies listener registration/removal. On `12f348e` plus this repair, repository verification passes all 146 checks, the 24 owning rendered flows pass, and `npm run android:build` builds standalone and launcher debug/release variants, both instrumentation APKs, and lint. Computer Use on the owned Pixel confirms app-drawer launch, connection chooser, offline home, Notes navigation, and creation of a note titled `Test` with body `Ok` through the Android keyboard. This local foundation APK does not contain the resident runtime; no resident, live-provider, cold-restart, or physical-device acceptance follows from these checks.

## Hosted failures and bounded repairs

Exact prior candidate `12f348ea17c75a171145babe7e0c5317e9aca5ad` has two successful browser runs, each with 963 passing cases. The resident build and PR-triggered foundation build pass. Their native jobs remain failed evidence:

- Recovery display admission succeeds and the first standalone storage test starts, but renderer readiness fails before storage assertions. This is consistent with the independently reproduced startup defect; its artifact does not include the JavaScript exception.
- Foundation's first successful `adb remount` emits its reboot notice on stderr. Capturing stdout alone loses the notice and correctly refuses further provisioning. A dedicated bounded remount executor now captures both streams, rejects process errors/nonzero exits/signals, and preserves all scratch, reboot, provider, and integrity gates. Its 35 owning cases pass.
- The private socket's positive control succeeds. The unrelated helper sees `ENOENT`, which Android app-data mount isolation can legitimately produce. The revised test accepts this only with a hidden target app root, a valid helper root owned by its expected UID, exact endpoint/fixture identities, failed connection, and a parent-side unchanged inode/permissions plus live byte control after the probe. Java compilation and controlled refusal cases pass; actual Android execution is still required.

The separate foundation push run failed Maven resolution before compilation. It is not rewritten as a success because the PR-triggered build passed.

## Composition and remaining gates

The next candidate combines `12f348e`, committed product `0d9a8e5`, the startup repair, and both reviewed native-test repairs. The product merge includes browser recording durability and an authenticated local-agent speech bridge; its host-side synthetic speech evidence does not prove rendered microphone/TTS or Android voice. Uncommitted main-checkout work is excluded. The nine admitted resident runtime patches, pinned upstream source, security boundaries, and required checks remain in force.

Evidence is retained under `test-results/native-plugin-startup-fix/`, `test-results/candidate-12f-ci-audit/`, `test-results/resident-12f-recovery-failure/`, and `test-results/private-peer-namespace-research/`. Earlier local host-stall, dependency-materialization, and source-fetch failures remain in their original logs. A duplicate compressed artifact was removed only after every extracted member was reverified byte for byte; the APKs and provenance remain retained.

The composed candidate passes repository verification (151 checks), 57 rendered flows covering startup, MVP navigation, hosted results, browser audio, Notes audio, video editing and receipt history, and both distribution debug/release builds, both instrumentation builds, and lint. All 3,756 source identities remain unchanged through those checks. Fresh hosted terminal results are still required. Full resident execution, Cloud/Gmail/voice journeys, password-provider filling, physical alarm/audio behavior, signed AOSP boot/update/rollback, and device/user acceptance remain open. The MVP is not complete.
