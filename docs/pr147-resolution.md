# PR 147 reconciliation

Audited source: PR 147 `c4ddcbb599ac3a2b04bb2198670c058c803318a8`, main `b41be5fc6daf2cd528eeb518db88a8c2cba156ea`, and replacement PR 148 `9e532db5e31e199fb8c5be419a1a68ab8421300b`.

PR 147 was closed without merging, then reopened. During this audit its head advanced to `2acafdced0f8c927ded7ef16f0d11df2a52d162f`, which contains PR 148 head `9e532db` as an ancestor and merges newer main. The table below accounts for the original head against that reconciled replacement. Its original branch is preserved. It must not be merged wholesale over the newer consolidation: its runtime manifests, staging architecture and upstream pin were superseded. Closure is not evidence that its remaining changes landed.

## Upstream source disposition

All 70 historical patch blobs were recovered from preservation commit `d31f364d7d46cd491334d11933a96ab67f414a6a` and their SHA-256 values verified. Their 18 effective upstream PRs are merged, and each merge commit is an ancestor of the current pinned upstream `83e2a2d90a619600be56fcca237a7861644b2d4b`, verified using GitHub comparisons. PR 33235 itself was closed, not merged; its recorded replacement 33230 merged as `09698bd30668ff3748d7922279b06119d39a3bcf` and is included in the pin.

[Upstream merge evidence](pr147-upstream-audit.json) records the exact PRs and ancestry. [The reconciled migration inventory](upstream-patch-migration.json) preserves main's original entries and adds `pr147Lineage` rather than replacing conflicting historical hashes. Three historical native extraction patches were absent from main's inventory and are now recorded. Four reused filenames have distinct historical blob hashes; both identities are retained. Ancestry proves source incorporation, not current device behavior.

## Consumer changes

| PR 147 content | Resolution |
| --- | --- |
| Shared Calendar implementation and Gradle integration | Already on main through the newer upstream consolidation. Account, calendar name, journal and creation URI identities match. Main intentionally retains a small delegating creation-store compatibility adapter. |
| Independent Calendar consumer app, native tests and packaging contract | The consumer implementation/build/manifest/test files were moved into upstream `plugins/plugin-native-calendar/test/android-consumer`; do not duplicate them locally. Its README/settings use upstream-relative wiring. |
| One-APK-at-a-time build and actual packaged runtime inventory verification | Carried by PR 148 and included in reconciled PR 147, adapted to main's lock-based source stamps. Not merged at this audit checkpoint. |
| Owned-emulator Calendar regression runner, CRUD touch safeguards, optional Contacts denial and external-editor return | Carried and refined by PR 148 and included in reconciled PR 147. Not merged at this audit checkpoint. Its current-source qualification is tracked there. |
| Calendar old-to-new APK upgrade witness and runner | Restored on reconciled PR 147, allowing the retained compatibility store while still requiring the shared Calendar superclass and guard. Native execution against current candidate APKs remains required. |
| Old runtime source/consumer JSON, patch replay helper, native Calendar/reminder staging and source-source helper | Superseded by `upstream.lock.json`, direct upstream Gradle modules and current source-manifest validation. Restoring them would recreate an obsolete parallel source of truth. Reminder staging alone was never production adoption. |
| Clock import/export checks, runtime preparation and runtime launch checks | Main consumes shared source through the current pin and lock-based architecture. Do not restore old patch-export paths. |
| Resident CI source authenticity changes | Main already validates the locked commit and original/generated hashes directly, including the expanded generated source inventory. The old three-class/consumer-manifest format is obsolete. |
| Historical package qualifier and independent-consumer emulator runner | Original code remains recoverable at `c4ddcbb:scripts/qualify-native-calendar-package.mjs` and `c4ddcbb:scripts/test-native-calendar-consumer.mjs`. Both runners are restored on reconciled PR 147 with authenticated current-pin source reads. They are not product runtime dependencies. Moving reusable qualification orchestration upstream remains a follow-up; source restoration is not native acceptance. |
| Historical research, native qualification and acceptance ledgers | Preserved on the original branch. Detailed patch provenance is reconciled here. Historical passing evidence does not replace current main's acceptance ledger. |

## Completion boundary

PR 147 is source-accounted-for, but not yet merged or fully qualified: the reconciled PR 147 can land the included PR 148 work once required checks pass. The restored upgrade flow requires current native qualification, and generic package/consumer qualification runners retain the upstream ownership follow-up. Keep the original branch until those follow-ups are completed. Do not label PR 147 merged unless GitHub records a merge; an eventual superseded closure must link the actual landing PRs.

The broader [upstream consolidation inventory](upstream-consolidation.md) remains active. In particular, the native Reminder engine is upstream but Alpha adoption still needs its encrypted storage adapter and legacy PendingIntent/recovery verification. Credential, browser/files, transport and other reusable feature extractions are not declared complete by this audit. Full MVP acceptance also retains resident execution, live providers, signed image and physical/pilot gates.
