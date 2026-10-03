# Upstream patch migration

The product is migrating all maintained Eliza changes to reviewed `elizaOS/eliza` PRs. Do not retire a local patch merely because a PR exists: it must be merged, included in the pinned upstream commit, and qualified with both Alpha distributions. Historical patches require semantic coverage review before archival.

## Current disposition

| Change | Upstream disposition | Product adoption |
| --- | --- | --- |
| Hosted digest route registration | [PR #33104](https://github.com/elizaOS/eliza/pull/33104) merged as `bb669a907283269c1640967765e44931074b3a84`; exact-head hosted run 37073425370 passed | Pin and integration verification pending |
| Android secure-store broker socket override | [PR #33212](https://github.com/elizaOS/eliza/pull/33212), head `e90495c489cdf6e447acaa59a27024aa1ea5a47f` | Review completed; hosted checks pending |
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
