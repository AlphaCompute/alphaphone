# Native Calendar upstream extraction

## Current boundary

MVP completion step13 remains incomplete. The product implements Calendar provider operations in `AlphaCalendarPlugin`, `CalendarEventGuard` and `CalendarCreationStore` (386 lines combined at source0b2c032). These three classes form a complete reusable boundary: provider queries, permission handling, native confirmation, atomic revision assertions, lifecycle cancellation and durable creation reconciliation. They do not require Alpha's credential store or reminder scheduler. Extracting only a guard utility would leave the reusable behavior product-owned.

The destination is an Android library in upstream `plugins/plugin-native-calendar`, with an explicit Android contract alongside the existing Apple contract. Delivery must use a reviewed upstream revision or an explicit reproducible patch in `patches/eliza`; never edit the vendor checkout. Alpha retains a thin registration adapter named `AlphaCalendar`, preserving the existing renderer protocol.

## Configuration and compatibility

Immutable host configuration must preserve these Alpha values:

- Local account `Alpha Phone` and calendar name `alpha-phone-local`.
- Creation journal `alpha-calendar-creations-v1`.
- Creation URI prefix `alphaphone://calendar-creation/`.
- Existing display labels and color.

Retain `context.getPackageName()` for provider ownership. Preserve pending operation IDs, unknown-result handling, persistence quarantine, source/event revisions, atomic provider assertions and confirmation ownership. Do not change user storage namespaces as part of extraction. If one process supports multiple configured instances, quarantine and journal locking must be scoped to the configured store rather than accidentally shared by a static global.

Wire the library through `android/settings.gradle` and `android/app/build.gradle`; keep the production renderer in `apps/app`. Existing Android tests access private review state through `AlphaCalendarPlugin.class.getDeclaredField`; adjust their observation boundary for inherited implementation without dropping dialog-release or busy-gate assertions.

## Required external-consumer proof

A separate minimal Android consumer must import the library with a different package, account/calendar and journal, and no Alpha source dependency. Execute actual permission, provider create/read/update/delete, cancelled confirmation, concurrent-edit rejection, creation process-restart reconciliation, and unsupported external/recurring-event rejection. A second caller of a copied helper is not this proof.

Then upgrade an existing Alpha fixture without clearing storage. Verify prior calendar records and pending creation IDs survive and the same operation does not duplicate an event. Run existing CalendarFlow, CalendarCrud, CalendarRange, CalendarExternalEditor, CalendarTruncation, CalendarAgentCrud and CalendarCreationRecovery instrumented flows in both standalone and launcher variants. Keep APK build, emulator provider execution and physical acceptance distinct.

## Reminder follow-up

Reminders are a larger independent extraction: ReminderStore, ReminderEnvelope, ReminderTaps, receiver dispatch, DailyApps permission/lifecycle bridge and action-journal receipt reconciliation. Inject secure-slot storage and Activity/receiver targets through narrow host interfaces. Keep existing receiver classes as forwarding shims because persisted PendingIntents target them. Preserve channel IDs, actions, URI prefixes, storage keys and atomic record/receipt commits. Existing upstream Apple reminder policy is not an Android scheduler.

## Status

This is the source-grounded implementation and acceptance boundary, not a completed extraction. Current hosted qualification continues for source0b2c032 while this next step is prepared. Signing, physical pilot, live providers and resident execution remain independent MVP gates.

## Candidate implementation

The complete provider implementation is now staged in the additive `patches/eliza/native-calendar-android.patch`, with per-file and patch identities in `native-calendar-android.json`. `node scripts/stage-native-calendar.mjs` reproduces and verifies the library without editing `vendor/eliza`. Immutable `CalendarConfiguration` supplies host identity. A process-lifetime registry shares journal locking and failed-write quarantine by canonical preferences path; conflicting creation URI prefixes for the same journal are rejected.

The independent Gradle consumer at `scripts/fixtures/native-calendar-consumer` imports this module with a different package and registration and no Alpha source dependency. Its provider-recovery test adds concurrent store-instance and configuration-isolation coverage. Alpha still uses the original implementation until the candidate's compilation, provider flows and migration are qualified. The extraction is not complete merely because a patch and fixture exist.

### October 3 candidate evidence

- The independent consumer and its instrumentation APK compile with JDK 21 and the installed Android SDK. The initial Android Studio JDK 25 attempt failed at Gradle compatibility; a subsequent fixture settings mistake was fixed before the successful build. Neither failure was a library compile failure.
- Actual CalendarProvider recovery passes in owned AVD `alpha_root_workflow_taps_20261003`, disposable user 38. The test verifies concurrent independent instances, same-ID recovery without a second insertion, ambiguous/missing marker handling, separate journals and rejection of conflicting prefixes. Original user 0 was restored; user 38 and both fixture packages were removed and verified. Evidence: `test-results/native-calendar-consumer-1791062946573`.
- Fixture APK SHA-256: `e2462df1b20a0a115e350ae8ac4010648a8c09be79e5db1b8e73477960d0d0b6`; instrumentation SHA-256: `0aaf324cbd94c4998cf8c5008691ed4958ad701c91f570c4b9de032029718f04`.
- Preserve the first failure: disposable ephemeral user 36 returned `unknown` rather than `saved` on its first creation. Its cause is not established. Added synthetic row diagnostics did not reproduce it in users 37 and 38; later passing runs do not erase that uncertainty. User 36 removal completed asynchronously. User 37 passed provider assertions but exposed premature cleanup while the user remained running; an explicit stop and removal were verified separately. The runner now stops its owned user before removal.
- Product verification passes 225 checks plus typecheck and web build. This is not acceptance of the new library through Alpha: production still uses its original Calendar implementation.

Remaining gates include the initial transient result diagnosis, registered bridge permission/dialog/lifecycle flows, actual process death, TypeScript/publication contract, production adapter wiring, both distribution builds and lossless upgrade validation. Do not mark MVP step 13 complete from this evidence.

### Registered bridge qualification

The independent consumer now passes the actual WebView → registered `ConsumerCalendar` → inherited Java plugin path. The complete flow starts with no Calendar permission, accepts the system permission dialog, creates/reads/updates/deletes provider events under native confirmation, rejects a stale revision, rejects deletion after a provider edit while confirmation is open, and cancels on both Cancel and Activity pause. The test verifies the review gate and dialog are released before accepting terminal results. Evidence: `test-results/native-calendar-consumer-1791063146790` (owned user 41).

The separate workflow read-permission callback also passes from an ungranted state, followed by actual `workflowCalendars`; it is not inferred from already-granted permission. Evidence: `test-results/native-calendar-consumer-1791063182878` (owned user 42). Both campaigns restored/resumed user 0, stopped/removed the exact owned user, and removed the fixture packages. The shared instrumentation APK hash is `50667c608fe34226491a8e3ca971eec3b96c8a006974f1ebf90c73d238321bd2`.

Retained failures: user 39 submitted a later request before Activity focus returned and received `unavailable`. The test now waits for actual focus between operations. User 40 still used the preceding instrumentation APK because the incremental build reused it; that result cannot validate the changed fixture. A forced rebuild, disabled VFS watching, and inspection of compiled methods established the tested source before users 41/42. The cleanup runner now waits for the original Activity to resume before stopping the owned user. Its preflight checks retained package registrations across all users to avoid replacing another user's shared fixture code.

These results close registered bridge permission, reviewed CRUD, conflict and pause checks for this external consumer. They do not close the earlier transient creation investigation, process-death/upgrade acceptance, Alpha migration, both product distributions or the public TypeScript/package contract.

### Public package and external consumption

`native-calendar-package.patch` adds a separate ESM-only `@elizaos/capacitor-calendar/android` entrypoint with `registerAndroidCalendar(name)` and typed native methods/results. The host must explicitly provide its registered subclass name. No Android browser simulator is registered. Existing Apple entrypoints and generated Rollup configuration remain unchanged. The package includes both Android sources and TypeScript sources so its `eliza-source` exports resolve from the tarball.

`scripts/qualify-native-calendar-package.mjs` reconstructs the pinned package plus both explicit patches, verifies source identities, compiles declarations and existing Apple bundles, creates an npm tarball, and checks a separate unpacked consumer. The consumer imports Android, verifies absent-native rejection, exercises the Apple CommonJS unsupported fallback, and compiles valid/invalid Android calls with strict declaration checking. Supply `ALPHA_CALENDAR_ROLLUP_BIN` if the plugin's declared Rollup dependency is installed outside the root. Nothing is published to a registry.

The final tarball SHA-256 is `d5c6c2a426b949985f210726a226fe1a28a50d5822e922d3ef7b0150fb4a9c29` (47 files). Qualification: `artifacts/native-calendar-package-1791063292358/result.json`. The Android consumer also rebuilt against the unpacked tarball through `-PcalendarLibraryDir=…/node_modules/@elizaos/capacitor-calendar/android`, then passed the full bridge flow in owned user 43 with verified cleanup (`test-results/native-calendar-consumer-1791063306398`). Its APK hashes match the previously tested native source, establishing identical packaged output for this consumer.

Alpha still needs its thin adapter migration and upgrade proof. Neither npm packing nor this consumer qualifies Alpha's installed-data migration, both product distributions, a physical device, or a released upstream revision.


### Alpha adapter migration and installed-data qualification

Alpha now registers a thin `AlphaCalendarPlugin` subclass of the shared native Calendar library. Gradle stages the hash-verified explicit patch before including the module. The duplicate product provider/journal/guard implementation is removed. All original account, calendar, journal, URI, permission aliases and registration identities remain unchanged.

Exact pre-migration source `6ff1ae7c1993069ca813bd5beaefdc72e59fb4a3` passed both variants' debug/release builds, lint and APK checks. Baseline artifacts and hashes are retained under `test-results/calendar-extraction/baseline-6ff1ae7/manifest.json`. An initial baseline attempt rejected changed bytes in the old prepared runtime source. That failure was preserved; a fresh source-only tree was reconstructed from the pinned Git base and verified patches, without bypassing integrity checks.

The migration candidate passes 225 repository checks, typecheck, web build, both variants' debug/release builds, instrumentation compilation, lint and APK checks. Evidence: `test-results/calendar-extraction/alpha-migration-verify.log` and `alpha-candidate-build.log`. Copied Android web assets match the completed web build byte-for-byte.

`node scripts/test-calendar-upgrade.mjs --bridge` passes both standalone (owned user 44) and launcher (owned user 45) on `alpha_root_workflow_taps_20261003`. The runner pulls and hashes installed APKs against its inputs. It seeds the legacy implementation, preserves a durable unknown creation receipt, force-stops, installs the candidate with `-r` without clearing data, and verifies unchanged provider IDs/revisions, recovery of the original receipt, no duplicate on same-ID replay, and acknowledgement. The subsequent actual Alpha WebView/native bridge passes reviewed create/read/update/delete, stale-revision rejection, cancellation and review-release assertions. Both users and fixture packages were removed; owner user 0 was restored and resumed. Evidence: `test-results/calendar-upgrade-1791063794491/{standalone,launcher}/`.

This establishes installed-data migration and post-upgrade agent Calendar operations on the emulator. It does not establish a crash during an in-flight provider write (receipt loss is modeled before a real process stop), physical-device acceptance, release publication, the remaining full Calendar regression set, or the earlier transient consumer creation diagnosis. MVP step 13 remains open for those gates and the other reusable feature extractions.
