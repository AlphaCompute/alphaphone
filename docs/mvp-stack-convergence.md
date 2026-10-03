# Combined resident and browser implementation — October 3, 2026

The initial candidate combined resident/browser product head `763001bb3cd61625bda033986c36b4ae9aa16536` with the separately developed integration head `3871831619e72a7c4714b80dfba78d461b16f4de` (PR 23). Both histories are preserved. The MVP remains incomplete; this is a combined-source qualification, not installed Android or full product acceptance.

## Implementation reconciled

- Preserve the current typed workflow generator, explicit Use/Save/Run transitions, resident browser reading, credential protection, calendar preferences and recent phone layout fixes.
- Integrate cancellable browser voice registration, expired Cloud session recovery, Gmail grant selection, durable reminder-edit recovery, workflow save-error persistence and shared supported-view contracts.
- Integrate the exact-process resident shutdown and launcher survival patches, isolated native fixture controls and recovery qualification tooling. These native changes are source/test work; no Android build was run in this pass.
- Reconcile the runtime on pinned upstream `92fc988bbc2502b6dab5976014973bbe510b5045`. Three former consumer patches are already incorporated upstream and must not be applied twice. Preserve the newer security, typed workflow and ownership patches.
- Rebase the Stage 1 invalid-source test fixture onto the new base without changing neighboring retry expectations. The first rebase was too broad; its failed test output is retained and the corrected fixture passes.

## Evidence

| Check | Result and scope |
| --- | --- |
| `npm run verify` | 223/223 repository tests, zero skipped, TypeScript and production web build pass. The source-preparation fixture successfully replays the final patch composition using a local Git cache. |
| Runtime campaign | 487 tests across 13 files pass, including credential/PII handling, Stage 1 repair, owner migration and approval receipts. |
| Browser campaign | All 294 combined Chromium/WebKit cases pass at the repository phone viewport (412 × 915); 34 earlier focused cases passed. The initial broad temporary configuration passed 292/294 at desktop width; two phone-width assertions failed because the temporary viewport was wrong. Correcting the configuration passes all 20 owning workflow cases. No product layout change was needed. |
| Actual local host | Isolated owner enrollment, one agent, embedded workflow status, Whisper and Kokoro all ready. A real hosted-model approved synthetic note action produced zero notes before approval and exactly one afterward; restored contacts and exact saved record survived reload. |
| Outbound redaction probe | Six captured request-body boolean checks contained no raw synthetic email, phone or credential suffix. Both swap switches were enabled only for this isolated probe; this does not qualify arbitrary secrets or all model behavior. |
| Prepared source | Consumer manifest `7c80a10cbaecde14a627739e01e7b4e68f2e7e006dd140a3da9e3f9d626a49c7`; prepared metadata `d33a76c5b8fa8b47e64fbc6f07da7fcc999e4ecd01d99ebcc5965601749c1c58`. All required source bytes verified. |

Evidence is retained under `artifacts/calendar-preferences-review/test-results/stack-convergence/`, including unsuccessful preparation/test attempts. Dependencies were cloned using APFS copy-on-write from an existing host and reconciled against the new frozen Bun lockfile with lifecycle scripts disabled. This is not a clean dependency-install or native compilation qualification.

## Remaining delivery and acceptance

The combined implementation is published in [PR 133](https://github.com/AlphaCompute/alphaphone/pull/133), implementation commit `ca40a0566d81844820b7ac3ceba29e98a12a8d9d`. Its hosted browser campaign is pending; remote main is not synchronized merely by opening a PR. The root checkout has been fast-forwarded and browser development restarted on the verified combined runtime at port 5317, retaining the existing profile and redaction-off defaults. On October 3 at 20:36 UTC, owner authentication, one agent, embedded workflows, Whisper and Kokoro all reported ready. Initial readiness returned 503 during startup; the subsequent completed check passed.

The [current status matrix](mvp-current-status.md) remains the complete requirement index. Current native IPC/lifecycle, installed distribution identity, physical speech/alarms, actual authorized Cloud/Gmail journeys, signed AOSP and device/user acceptance remain separate open gates. Android builds remain excluded by the current request. Browser/controlled-port fixtures do not close these gates.


## Consolidated delivery — October 3

The final consolidation includes every head in the 132-open-PR inventory, plus the locally committed resident spawn/journal changes (`60ad38f`) and Calendar, mail cancellation, voice preparation, Maps dataset and shared Clock executor changes (`c9c253f`). Merge commits retain all source histories. Runtime manifests preserve the newer credential and workflow patches while adding enabled-view negotiation, reminder timing, the SIGSYS compatibility fix and the shared Clock executor. The calendar layout fixture now explicitly uses UTC, matching its fixed civil-date assumptions.

The user requested merging and fixing the entire stack before one final verification campaign. The earlier local campaign was intentionally stopped; its failures and traces remain in `test-results/full-browser-convergence/`. The mock digest trace records a Vite connection loss and reload. The audio case stalled before the deletion assertion and during browser teardown; its product assertions remain unchanged. The previous exact `ec3ac54` hosted campaign passed 1,210 cases with 12 explicit skips. That result does not qualify this newly combined source.

The final campaign is pending: repository verification, complete browser coverage on a dedicated server, and composed runtime source/contract qualification. Android builds remain excluded by the user's request. Local development will retain its existing owner profile and local speech settings when restarted on the consolidated runtime.

The worktree inventory also found older, uncommitted native qualification/extraction experiments. They remain preserved in their original worktrees; they are not silently treated as current production implementation. Native Calendar extraction still requires its independent-consumer and storage-migration qualification before replacing the product bridge. Device, provider, signed-image and user acceptance remain open as detailed in the current requirement matrix.
