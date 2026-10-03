# Combined resident and browser implementation — October 3, 2026

## October 3 speech and upstream-adoption follow-up

PRs 136 and 137 are merged at `8053d04f3d6fe553fdab5de98ecfd5ad64718c9b`, pinning upstream `2fe9f510501863af97bda887e2870158b3a3e2b2` without local runtime patches. The initially reviewed migration lacked the newly landed Kokoro warming change; the final pin preserves it through a per-host lifecycle, and the source-based regression checks cover startup, retry, isolation and shutdown. Its exact-source full browser campaign is [37160959650](https://github.com/AlphaCompute/alphaphone/actions/runs/37160959650), currently running. The earlier c8e91b8 campaign was superseded, not accepted as a full pass.

Before adoption, all 259 repository tests, TypeScript and the web build passed on the PR 136 source. A fresh runtime started its native speech worker before any speech request; the real browser recording/transcription/playback/completion/Stop/disconnect journey passed in 16.2 seconds. Browser dev restarted with the existing owner profile and verified ready at 23:07:50 UTC. That live runtime predates the newly merged upstream pin; restart and cold browser qualification of the new runtime remain open.

The [current requirement matrix](mvp-current-status.md) records concurrent unmerged client extraction and physical/provider/release acceptance. This follow-up supersedes the older speech-readiness-only, runtime-patch and empty-queue statements below. It does not claim the entire MVP is complete.


## Current delivery checkpoint

Production main and the root checkout are synchronized at `6b33e26a516b9f76a3a06cff58f7b1c661399839`, including PR 134's Home/digest and lock-summary corrections. The exact-source full browser campaign is [37156018384](https://github.com/AlphaCompute/alphaphone/actions/runs/37156018384); it succeeded across all three shards with **1,318 passed and 14 profile-dependent skips**, plus **9 passed** in the separate synthetic local-agent profile. Earlier campaigns below are historical and were superseded. All 255 repository tests, TypeScript and the web build pass for the corrected source, along with 22 focused browser cases. The current 33-patch runtime has 488 passing runtime/security cases plus the Clock-export and authenticated device-action checks.

The renewed worktree audit found three additional Calendar extraction commits at `6ff1ae7c1993069ca813bd5beaefdc72e59fb4a3`, now published to `codex/native-calendar-package-snapshot`. This preserves the package and independent-consumer work without substituting an unfinished Alpha migration for production code. The originating checkout still owns that migration and upgrade validation. Other registered worktree heads are already ancestors of main; uncommitted experiments and generated evidence remain preserved.

The existing local agent profile is running with owner authentication, one agent, embedded workflows, Whisper and Kokoro ready as of October 3 at 21:42 UTC. Consumer manifest remains `711ca293e205857b5b3097983ee13a4f5131c33a84e33fe945bcecb11262aea7`. Cerebras provides hosted text inference; both redaction switches retain their previously selected off state. Native, physical, provider and release acceptance remain open in the requirement matrix below.

## Earlier candidate history

The initial candidate combined resident/browser product head `763001bb3cd61625bda033986c36b4ae9aa16536` with the separately developed integration head `3871831619e72a7c4714b80dfba78d461b16f4de` (PR 23). Both histories are preserved. The MVP remains incomplete; this is a combined-source qualification, not installed Android or full product acceptance.

## Implementation reconciled

- Preserve the current typed workflow generator, explicit Use/Save/Run transitions, resident browser reading, credential protection, calendar preferences and recent phone layout fixes.
- Integrate cancellable browser voice registration, expired Cloud session recovery, Gmail grant selection, durable reminder-edit recovery, workflow save-error persistence and shared supported-view contracts.
- Integrate the exact-process resident shutdown and launcher survival patches, isolated native fixture controls and recovery qualification tooling. These native changes are source/test work; no Android build was run in this pass.
- Reconcile the runtime on pinned upstream `92fc988bbc2502b6dab5976014973bbe510b5045`. Three former consumer patches are already incorporated upstream and must not be applied twice. Preserve the newer security, typed workflow and ownership patches.
- Rebase the Stage 1 invalid-source test fixture onto the new base without changing neighboring retry expectations. The first rebase was too broad; its failed test output is retained and the corrected fixture passes.

## Earlier candidate evidence

| Check | Result and scope |
| --- | --- |
| `npm run verify` | 223/223 repository tests, zero skipped, TypeScript and production web build pass. The source-preparation fixture successfully replays the final patch composition using a local Git cache. |
| Runtime campaign | 487 tests across 13 files pass, including credential/PII handling, Stage 1 repair, owner migration and approval receipts. |
| Browser campaign | All 294 combined Chromium/WebKit cases pass at the repository phone viewport (412 × 915); 34 earlier focused cases passed. The initial broad temporary configuration passed 292/294 at desktop width; two phone-width assertions failed because the temporary viewport was wrong. Correcting the configuration passes all 20 owning workflow cases. No product layout change was needed. |
| Actual local host | Isolated owner enrollment, one agent, embedded workflow status, Whisper and Kokoro all ready. A real hosted-model approved synthetic note action produced zero notes before approval and exactly one afterward; restored contacts and exact saved record survived reload. |
| Outbound redaction probe | Six captured request-body boolean checks contained no raw synthetic email, phone or credential suffix. Both swap switches were enabled only for this isolated probe; this does not qualify arbitrary secrets or all model behavior. |
| Prepared source | Consumer manifest `7c80a10cbaecde14a627739e01e7b4e68f2e7e006dd140a3da9e3f9d626a49c7`; prepared metadata `d33a76c5b8fa8b47e64fbc6f07da7fcc999e4ecd01d99ebcc5965601749c1c58`. All required source bytes verified. |

Evidence is retained under `artifacts/calendar-preferences-review/test-results/stack-convergence/`, including unsuccessful preparation/test attempts. Dependencies were cloned using APFS copy-on-write from an existing host and reconciled against the new frozen Bun lockfile with lifecycle scripts disabled. This is not a clean dependency-install or native compilation qualification.

## Earlier delivery checkpoint and remaining acceptance

The combined implementation is published in [PR 133](https://github.com/AlphaCompute/alphaphone/pull/133), implementation commit `ca40a0566d81844820b7ac3ceba29e98a12a8d9d`. Its hosted browser campaign is pending; remote main is not synchronized merely by opening a PR. The root checkout has been fast-forwarded and browser development restarted on the verified combined runtime at port 5317, retaining the existing profile and redaction-off defaults. On October 3 at 20:36 UTC, owner authentication, one agent, embedded workflows, Whisper and Kokoro all reported ready. Initial readiness returned 503 during startup; the subsequent completed check passed.

The [current status matrix](mvp-current-status.md) remains the complete requirement index. Current native IPC/lifecycle, installed distribution identity, physical speech/alarms, actual authorized Cloud/Gmail journeys, signed AOSP and device/user acceptance remain separate open gates. Android builds remain excluded by the current request. Browser/controlled-port fixtures do not close these gates.


## Consolidated delivery — October 3

The final consolidation includes every head in the 132-open-PR inventory, plus the locally committed resident spawn/journal changes (`60ad38f`) and Calendar, mail cancellation, voice preparation, Maps dataset and shared Clock executor changes (`c9c253f`). Merge commits retain all source histories. Runtime manifests preserve the newer credential and workflow patches while adding enabled-view negotiation, reminder timing, the SIGSYS compatibility fix and the shared Clock executor. The calendar layout fixture now explicitly uses UTC, matching its fixed civil-date assumptions.

The user requested merging and fixing the entire stack before one final verification campaign. The earlier local campaign was intentionally stopped; its failures and traces remain in `test-results/full-browser-convergence/`. The mock digest trace records a Vite connection loss and reload. The audio case stalled before the deletion assertion and during browser teardown; its product assertions remain unchanged. The previous exact `ec3ac54` hosted campaign passed 1,210 cases with 12 explicit skips. That result does not qualify this newly combined source.

The final campaign is pending: repository verification, complete browser coverage on a dedicated server, and composed runtime source/contract qualification. Android builds remain excluded by the user's request. Local development will retain its existing owner profile and local speech settings when restarted on the consolidated runtime.

The worktree inventory also found older, uncommitted native qualification/extraction experiments. They remain preserved in their original worktrees; they are not silently treated as current production implementation. Native Calendar extraction still requires its independent-consumer and storage-migration qualification before replacing the product bridge. Device, provider, signed-image and user acceptance remain open as detailed in the current requirement matrix.


### Pre-attention campaign checkpoint — superseded

The combined product landed through PR 133 and PR 123. Main is `18e36220276b9cc6c4cd592fd5db9da1ea1cac29`; the additional local review merge has an identical Git tree. The live queue readback is zero open PRs. Redundant stacked PRs were closed after verifying that their exact heads are ancestors of main. The repository requires pull requests for changes to main; rejected direct pushes did not alter that rule.

Local verification passes all 255 repository tests, TypeScript and the production web build. The initial run passed 254 tests and failed one source-reproduction fixture because an interrupted local cache had no admitted Git object. That cache was preserved, and the sole owning test passed against a valid existing object cache. Runtime verification passes 488 stage-one/security/ownership tests, one source-and-published Clock export test, and one authenticated HTTP/durable SQL device-action lifecycle test. No test assertion was weakened.

The complete browser campaign is [37155265419](https://github.com/AlphaCompute/alphaphone/actions/runs/37155265419), on exact main 18e3622. All three shards passed repository verification and entered the browser suite. This campaign was superseded and cancelled after the attention corrections merged; it is not terminal qualification of the corrected source. Redundant branch campaigns were cancelled instead of repeating the same work locally.

The final local runtime reproduces all 33 declared patches. Consumer manifest: `711ca293e205857b5b3097983ee13a4f5131c33a84e33fe945bcecb11262aea7`; prepared metadata: `eec3fd5d6f991872dfe94ba15e1deee0e7d79605e7bf48499e1a465d69897a14`. Existing dependency directories were cloned with APFS and the frozen Bun installation completed with no dependency changes and lifecycle scripts disabled. This is reproducible source and checked dependency reuse, not a clean native build.

Browser development restarted at port 5317 against this runtime, retaining the existing browser-agent owner profile and redaction-off settings. At 21:34:10 UTC, authenticated owner access, one agent, embedded local workflows, standalone Whisper and Kokoro were ready. The actual app rendered in the in-app browser. The model remains hosted Cerebras; local orchestration and local speech do not imply offline text inference.

Evidence is retained under `test-results/remaining-integration/`, including source reproduction, the initial failure and corrected owning check, runtime tests, readiness and PR disposition records. Android builds were not run locally in this pass. The requirement matrix still lists real-provider, native lifecycle, physical-device, release and user-acceptance gaps; this checkpoint does not claim the full MVP is accepted.


### Completion audit against the numbered implementation plan

This audit preserves all fifteen plan items. A delivered implementation, a controlled test, and product acceptance are separate states. The resident-agent change governs execution placement; it does not supply evidence for a powered-off process or a physical device.

| Plan item | Implemented or verified in the consolidated browser pass | Still not proved or completed |
| --- | --- | --- |
| 1. Source and scope reconciliation | Current MVP profile, deferred routes, resident execution and hosted-model distinction are documented and implemented. | Final messaging/Telegram/Discord disposition and stakeholder acceptance of the complete retained scope. |
| 2. Stable target and native environment | Browser development is running on the merged renderer and reproduced local runtime. | Physical target identity and current installed-image acceptance. Android build work is excluded from this pass. |
| 3. Session and capability contract | Owner authentication, durable device-action lifecycle and enabled-view negotiation are implemented; current real HTTP/SQL contract test passes. | Generic upstream publication and independently qualified production/native consumers. |
| 4. Cloud and remote onboarding | Optional connection, grant, expired-session and owner-fencing implementations are merged. | Actual authorized account onboarding, revocation and provider-specific deployment acceptance. Local startup does not require these optional services. |
| 5. Conversation and context | Current stage-one, security and owner/receipt tests pass; browser lifecycle coverage is in the final campaign. | End-to-end physical network/background/process interruptions and broad real task quality. |
| 6. Speech and latency | Current local host reports Whisper and Kokoro ready; recording/review/playback ownership fixes are merged. | Physical microphone, echo/Bluetooth, language quality and measured latency target. Readiness alone is not speech accuracy. |
| 7. Notes and native CRUD | Durable browser operations, reviewed agent effects, audio ownership and recovery implementations are merged. | Current device storage/voice journey and migration acceptance. |
| 8. Calendar, reminders and Clock | Explicit reminder timing, durable reminder links, Calendar ownership fixes and the shared reviewed Clock executor are merged. Current HTTP/SQL lifecycle and public Clock export checks pass. | Actual provider/OS alarm behavior, time-zone/reboot/DND coverage and physical delivery. |
| 9. Schedules and result outbox | Local workflow engine is ready; durable occurrence, result and reconnect code and earlier real local schedule evidence are retained. | Current physical lifecycle and power-loss acceptance; a powered-off device cannot execute locally. Optional powered-off remote execution needs its own scope and deployment. |
| 10. Notifications and approvals | Exact review/receipt identity, asynchronous durable native I/O and recovery implementations are merged; controlled tests are retained. | Current native lock/permission/process behavior and physical notification delivery. |
| 11. Browser and passwords | Navigation, selected reading, sensitive-source rejection and provider setup/status are implemented. | Release-image WebView/provider compatibility, actual vault save/fill/unlock and passkey journeys. |
| 12. Email | Account-bound reads, drafts, attachments, cancellation and reviewed provider mutations are implemented. | Real Gmail grants and authorized read/draft/send/revoke/unknown-result acceptance. No test result authorizes sending real mail. |
| 13. Upstream consolidation | All inventoried product PRs and committed local fixes are merged; 33 explicit runtime patches reproduce. Vendor and baseline checkouts are unchanged. | Shared upstream publication and complete generic native extraction. Uncommitted native Calendar/extraction experiments remain preserved, not adopted as qualified production code. |
| 14. Deployment and metering | Local executable source and owner/runtime identity are verified. Nitro is optional under the resident architecture. | Signed app/runtime/image release, update/rollback, independent setup and required production usage/metering acceptance. |
| 15. Pilot handoff | Current implementation report, source history, failure evidence and test records are retained. | Four physical-unit manifests, unedited demonstration, user/stakeholder acceptance and final P0/P1 disposition. |

The final browser campaign at corrected main 6b33e26 has now succeeded as recorded at the top of this report. Its explicit skipped profiles remain separately accounted for; the result does not close physical, provider or release acceptance.


### Subsequent visual corrections

Direct rendered review found that mock Home showed three attention items while opening a digest with only one retained MVP item. It also found deferred Messages counts in the mock lock summary. Home and the digest now share filtered fixture rows; the lock summary filters by enabled view and exposes accessible Email/Calendar count labels. The production adapter clears fixture avatars. The current correction passes all 18 MVP browser cases, four browser/native-chrome fixture cases, all 255 repository tests, TypeScript and the web build. The corrected Home and lock views were visually checked. These changes landed in PR 134 at main 6b33e26. The older 18e3622 campaign was cancelled; the current campaign is linked at the top of this report.

### Final browser result and skip accounting

Run 37156018384 is terminal **success** at exact source `6b33e26a516b9f76a3a06cff58f7b1c661399839`. Shard 1 passed 434 cases with 10 skips, shard 2 passed 440 with four skips, and shard 3 passed all 444. All three repository verification steps passed. The separate local-agent profile passed nine controlled recording/playback cases. Its synthetic responses qualify the browser contract, not actual speech recognition quality.

The fourteen main-suite skips consist of those nine profile cases, four host-storage reminder-recovery cases, and one actual-host synthetic-WAV speech case. The latter requires its own real-host evidence; it is not silently counted as passed. Complete job metadata, original logs and summary extraction are retained under `test-results/remaining-integration/final-ci-*`. No Android build was run in this browser-focused pass.

The four host-storage reminder-recovery cases subsequently passed in a dedicated isolated profile on port 5347, using the same application source. They verify applied versus unknown outcomes, exact binding, stale-entry rejection, no reminder-state replay and durable reload. Evidence: `test-results/remaining-integration/host-recovery-browser.log` and its browser report. The user's existing agent profile was not used for these fixture writes.
