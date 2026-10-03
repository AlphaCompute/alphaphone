# Upstream patch migration

The product is migrating all maintained Eliza changes to reviewed `elizaOS/eliza` PRs. Do not retire a local patch merely because a PR exists: it must be merged, included in the pinned upstream commit, and qualified with both Alpha distributions. Historical patches require semantic coverage review before archival.

## Current disposition

| Change | Upstream disposition | Product adoption |
| --- | --- | --- |
| Hosted digest route registration | [PR #33104](https://github.com/elizaOS/eliza/pull/33104) merged as `bb669a907283269c1640967765e44931074b3a84`; exact-head hosted run 37073425370 passed | Pin and integration verification pending |
| Android secure-store broker socket override | [PR #33212](https://github.com/elizaOS/eliza/pull/33212) merged as `6fa5a1015ab5866e283e3e7a7c772f8e800ccf14` | Reviewed head `e90495c489cdf6e447acaa59a27024aa1ea5a47f` passed hosted run 37156768822; product adoption pending |
| Egress control objects, safe user-reply restoration, credential assignments | [PR #33213](https://github.com/elizaOS/eliza/pull/33213), head `cd7f299c57d836b10ab7dcb02c224a1f353f7d07` | Review found and fixed browser util-polyfill regression; local runtime/browser checks pass, hosted checks pending |
| Native Android Calendar provider and typed package entrypoint | [PR #33214](https://github.com/elizaOS/eliza/pull/33214), head `834a05abbdb1479cc838ba178bcab3013ef8698b` | Draft; independent source review found no blocker; upstream Android consumer build and packed import/type checks pass; native flows and hosted qualification pending |
| Resident sessions, approved workflow navigation, Clock contract | [PR #33026](https://github.com/elizaOS/eliza/pull/33026) | Existing draft; remaining Android runtime gates must not be inferred from source checks |
| API 29 secure-store frame input | [PR #33216](https://github.com/elizaOS/eliza/pull/33216), head `609d430b78065baab0c2668ba62ed0f5d29bce93` | Java API compatibility and frame/transport checks pass; hosted checks pending |
| Native Android reminders engine | [PR #33217](https://github.com/elizaOS/eliza/pull/33217) | Draft; typed entrypoint and native/upgrade qualification in progress |
| Lean/mobile workflow opt-in and workspace source entries | [PR #33223](https://github.com/elizaOS/eliza/pull/33223), head `464262ed2274617fc299d40eb21d90a6eebd64b2`, stacked on #33026 | Actual Bun bundle execution and 14 HTTP/PGlite tests pass; resolver escape regression fixed |
| Cancellable authenticated Android streams | [PR #33218](https://github.com/elizaOS/eliza/pull/33218), head `a1d8e1d36c8ff7ba48c2c9b9375cd9444c6faf98` | Draft; actual production Android app and instrumentation Java compilation passed; native fixture qualification pending |
| Typed reviewed workflow generation | [PR #33220](https://github.com/elizaOS/eliza/pull/33220), head `105bc6099d5b14217a0be54668e947ca2c91cbc3` | Real HTTP/PGlite integration passes; hosted checks pending |
| Android immutable workflow source publication | [PR #33222](https://github.com/elizaOS/eliza/pull/33222), head `95746daece0dad96ee5ce5b6f4027b976371fad5`, stacked on #33026 | Five real filesystem/runtime tests pass; reviewed source preserves concurrent publication and abandoned-reservation refusal |
| Historical numbered and standalone patches | Semantic inventory in progress; PR #33002 already merged foundational changes | Do not replay wholesale or delete without coverage |
| Remaining workflow/device/reminder/voice patches | Require coherent upstream PRs; not yet retired | Pending |

## Evidence boundaries

The local inventory found 70 patch files: 36 historical numbered patches, 23 ordered runtime extras, six native/package patches, and five historical standalone patches. This count includes inactive and overlapping history; it is not 70 independent missing features.

PR #33104 was independently reviewed for route matching, authentication, body limits, and drift against develop. Its hosted checks passed at `ce249c24d440956d0280306f04e84df2a721d69d`. The author's 26-case HTTP suite result is author-reported; hosted CI does not execute that suite. Three default-cap test cases have a nonblocking assertion weakness because an unsupported field can also trigger handler rejection. The production limits and stricter explicit route caps were reviewed directly.

For the new Calendar PR, package build/typecheck/lint and existing five tests passed. Full local root verification stopped at missing scoped workspace dependencies, not a demonstrated source defect; it is not counted as passing. The source-matching Alpha extraction passed both distribution builds and baseline-to-candidate upgrade flows, but that supporting evidence is distinct from validation of the upstream package and from physical-device acceptance.

## Completion gates

1. Review every active patch and historical residual against current upstream; avoid duplicate implementations.
2. Publish coherent PRs with exact-head validation and explicit unresolved limitations.
3. Merge only after review and relevant checks; refresh the head immediately before merge.
4. Advance the pinned upstream commit through normal product integration. Remove incorporated patch references and files together, preserving an archival record for obsolete history.
5. Run `npm run verify` and `npm run android:build` for standalone and launcher. Re-run affected full-flow and upgrade tests on the phone emulator.
6. Report APK, emulator, AOSP boot, live integrations, and device acceptance separately.

## Historical inventory review

Numbered patches 0001–0035 are represented upstream or superseded by subsequent upstream implementations, including the foundational merge #33002. The standalone Cloud-session patch duplicates 0019. The combined Cloud patch is an obsolete aggregate containing both Alpha and upstream files, so it must not be submitted wholesale. Three old packaged-runtime patches need semantic comparison with the modern process-host/compiler implementation in #33026 rather than resurrection of their older environment-based design. Patch 0036 is an 867-file qualification snapshot; exhaustive semantic reconciliation is not complete and its bytes remain preserved.

Fresh normal-host checks at #33026 head `28ee31f8fc69cb3610aa92e6ae2601c496419d03` passed ten subprocess and two durable deny/cancel/restart cases. Its semantic compiler case exceeded the unchanged 15-second deadline on this host; that failure remains recorded. Full canonical [CI run 37157257406](https://github.com/elizaOS/eliza/actions/runs/37157257406) was started to obtain independent hosted evidence. The whole PR retains Android startup/recovery changes and remains draft.

Upstream Calendar consumer recovery passed on the owned phone emulator with installed APK hashes checked. The permission bridge run did not pass: the consumer lost focus, and a captured system Quickstep ANR covered the app. Cleanup restored user 0 and removed the fixture user/packages. The owned emulator was restarted before retrying; this is not Calendar bridge acceptance. Both Alpha instrumentation APK variants rebuilt successfully with the correct qualified source baseline.

The preserved 0036 manifest identifies runtime commit `ab8f9a7110ae7ddc5edd6a1e323f77e0362ec9d3`, whose tree was independently verified as `6b6a2622150bc4789598d156a001173f3ff3f2e2`. That commit is an ancestor of #33026 at `28ee31f8fc69cb3610aa92e6ae2601c496419d03`. Its current patch bytes match the historical recorded SHA-256. This establishes lineage and avoids proposing the 867-file snapshot again; it does not replace review and qualification of #33026.

After the owned emulator restart, the same upstream Calendar APKs passed `permissionAndReviewedProviderLifecycle` (70.607 seconds), with installed hashes verified and complete cleanup. The earlier failed runs remain evidence of system-focus instability, not passes. The separate workflow permission callback check is still running.

## Latest qualification checkpoint

- #33216 merged as `50989e5c30652b1e63b3c3abffc74b4082bfe35e` after exact-head hosted checks passed.
- #33214 merged as `4d12e1c0eea6f8651ee036140f091e9582d14679` after exact-head hosted checks and all three upstream consumer flows passed (recovery, permission/CRUD, workflow permission callback).
- #33026 full canonical CI run 37157257406 completed successfully. Its Android acceptance remains a separate unresolved gate.
- #33217 upstream native reminder engine flow passed on the owned emulator (10.007 seconds); installed APK hashes and disposable-user cleanup verified. Permission/bridge flow remains in progress.
- [#33226](https://github.com/elizaOS/eliza/pull/33226) ports exact resident stop and launcher preservation; latest head `d83c90ca808a73c5f1a2c513e9cef44f64343126`. The production Android compile passed; fixture execution and native survival remain unverified.
- [#33227](https://github.com/elizaOS/eliza/pull/33227) ports workflow owner binding and authenticated enabled views at `97ec4b9b3534a4fb55b2e3984777b9fa86608bc4`; seven real HTTP/SQL tests passed.
- [#33228](https://github.com/elizaOS/eliza/pull/33228) ports the reviewed Clock coordinator and accurate alarm-effect wording, stacked on #33026. Source and packed-consumer checks and focused strict typecheck passed; full package checks remain limited by sparse dependencies.
- Kokoro is ported locally with real native WAV synthesis and authenticated HTTP/SQLite lifecycle checks. Review corrected optional ABI capability probing; the final flow is rerunning before publication.

No incorporated patch has yet been retired from Alpha: merged commit adoption and both distribution qualifications are still required.

Latest follow-up: reminder permission/bridge test failed because it could not locate the system denial control; cleanup passed and engine acceptance remains separate. Kokoro final HTTP rerun failed readiness while direct native-worker initialization passed; this discrepancy must be resolved before voice qualification or merge. Earlier passes do not close either failure.

#33213 merged as `df90e84500df616bd4c170f364a3a7f1dfed13b8` after all exact-head checks passed. [#33229](https://github.com/elizaOS/eliza/pull/33229) now contains standalone Kokoro at `ff20e268184`, including host lifecycle isolation and optional ABI capability validation. After direct native worker/service checks passed, the complete HTTP/SQLite/native rerun passed. Earlier readiness failure remains a stability limitation; hosted and complete dispatcher qualification remain outstanding.

#33220 merged as `a1ae36defb0e4036b4e95d624c72325c08de25f9` after all exact-head hosted checks passed. #33227 secret-scan failed before scanning because its older candidate lacked `packages/scripts/github/install-gitleaks.sh`; the PR was updated against develop and now has head `36cc6e496678bcf2d4e33e2754e7bd745ffb846f`, requiring fresh checks/review. Reminder permission retry reproduced the missing denial-control failure; its cleanup completed. The reviewed reminder timing/creation port is undergoing real HTTP/SQL tests.

[#33231](https://github.com/elizaOS/eliza/pull/33231) now ports reviewed reminder timing/creation and tool guidance. The initial real HTTP/SQL suite passed seven tests; final typecheck and exact-head hosted checks remain pending. The patch was rebased onto #33227, which was externally merged as `646d5ddfb1ce683b3b3512dfa71d2eae58427905` during this work. #33229 was updated against develop; its README-only merge conflict preserved both speech and secure-store documentation, with new head `1914d58c5bd`.

Live upstream state now reports #33217 merged as `1fa0abdf4996efffe4f980c7ecb4c427886bae14`, and #33026 merged as `28d835905f4b8e3c3d675b12c8a28f070bb25386` from advanced head `07931f52463bb627937ab6df6f757df840471929`. These external merges do not close Alpha native acceptance; the changed resident head requires integration review. Reminder bridge failure was localized to test text matching: the installed PermissionController resource contains curly-apostrophe “Don’t allow”, while the test expected straight-apostrophe text. A resource-ID fixture correction is building. #33231 local-core typecheck diagnostic passed; hosted checks remain running.

Reminder bridge qualification now passes after the resource-ID test correction: denial, grant, create/read/update, stale-revision rejection, resume and cancellation (7.908 seconds). Production APK SHA remains `e0e17986de0e76e95caa61c580b5da1301233a9c3755dbef29013c1f064fda6d`; new test APK SHA is `af870808bdad4a6ec1d46fd3ebf3da32a9f8d1c6ad5799f7baee59fffe1cab75`. Cleanup passed. [#33234](https://github.com/elizaOS/eliza/pull/33234) carries the fixture correction. Remaining worker termination metadata patches are being ported, with only normal-exit host checks selected; no crash diagnostics are being executed.
