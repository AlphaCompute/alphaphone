# PR 373 integration review

Review started October 9, 2026 (America/Los_Angeles). PR: [373](https://github.com/AlphaCompute/alphaphone/pull/373).

## Source boundaries

Incoming head: `44c9d57ce38b3b29f5b104a2f6efc103fdd914c3`. Main was first integrated at `d694c30c`, then updated through `00be6eb233183b44c4339ce721c2ff6b25dc566f` (including PR 374's Android API fixture setup). The retained Eliza pin is `0d40aa6e6e1b5192311ca916515003c8a4473c0c`. The integration was reviewed in an isolated managed worktree; unrelated AOSP changes in the original checkout were left untouched. No upstream checkout source was edited.

The original PR description described an earlier base and voice policy. This record and the remaining-work inventory describe the reconciled implementation. Source CI is a merge gate; it is not an assertion that the MVP is complete.

## Conflict resolution and review fixes

- Resolved 37 initial conflicting paths, then the later CI workflow conflict. Retained current main's credential retirement, runtime admission, Notes replies in the original room, navigation ownership and Automations integration.
- Requalified applied patches at the retained pin. Calendar patch 0039 is already upstream and its manifest is now historical. Rebased assistant review patch 0046 and speech export patch 0065 without dropping current capabilities. Generated output remains outside `vendor/eliza`.
- Combined Activity-scoped native calls with process-wide credential invalidation. Destroying one Activity retires its work; credential changes invalidate every registered instance. Preserved ownership checks around credential binding and runtime admission.
- Fixed browser credential compare-and-set when Web Locks is unavailable, restricted automation mutation routes, rejected unsupported host credential references, and prevented partial native bridges from silently falling back to browser credential storage.
- Kept drafts until confirmed dispatch, preserved ambiguous-outcome recovery and corrected a test that reloaded before the draft-store commit completed.
- Retained current Home Inbox behavior and current compact Calendar layout; integrated the meeting indicator, drawer and landscape support. Fixed the missing landscape canvas width and the assistant-only surface's stray Minimize control.
- Preserved current Cloud ongoing voice rather than silently replacing main's behavior. Kept standalone local Notes read-aloud, cancellation/ownership protections and truthful first-audio timing. Four incoming manual-send scenarios are explicitly TODO because the product documents disagree; this is MVP-01, not passing voice acceptance.
- Hid unsupported browser Cloud login actions and retained honest unavailable copy. Refreshed license notices, upstream reachability and renderer ownership inventory.
- The first complete hosted browser run exposed further integration regressions. Fixed drawer ownership of Back, disabled unavailable proposal reviews, restored development Inbox card rows/count, preserved successful navigation after an interrupted native stream, and restored the compact Browser header’s touch target. Updated current Calendar/Automations/Clock/voice fixtures without skipping their ownership, consent, cancellation or persistence assertions. Configured Maps renderer tests now start their own synthetic provider server. Browser shards finish independently so one failure cannot cancel the remaining evidence.

## Validation and limits

`npm run verify` passed on the corrected application source with the Linux Java/Android and pinned JSON test dependencies configured: 1,274 tests, 1,270 passed, zero failed or skipped, and four explicit policy TODOs; Notes query flow, typecheck, build and production-bundle audit passed. The [PR Checks](https://github.com/AlphaCompute/alphaphone/pull/373/checks) record hosted exact-head results; they must settle before merge. Intermediate failing runs were used to identify and fix regressions; they are not passing evidence.

The later CI-regression run passed 237/248 cases; after completing fixture corrections, all 12 targeted rerun cases passed (the 11 affected cases plus the second Files viewport). Two transient standalone failures recorded `ERR_NETWORK_CHANGED` while loading local modules and passed unchanged on rerun. All nine workflow-generation and all eight recording-save ownership cases passed. These synthetic checks do not qualify live Maps or speech providers.

The previously canceled shard tails were also exercised: 25 password/provider cases passed; the 65-case workflow tail passed 55 initially and exposed stale Automations, speech and hidden-Home selectors in ten cases. Their targeted reruns cover canonical Automations reads, native notification-tap ownership, interrupted-run non-replay, separate Notify/Speak approvals, Cloud playback completion/cancellation, and execution-context redaction. No new skips or TODOs were added. A final Maps share test exposed a cleanup-observation race: a closed dialog disappears from role queries before its asynchronous close handler disposes the DOM and revokes its Blob URL. The test now waits for actual DOM removal before checking that the URL is unreadable; cleanup and the unreadability assertion are retained. A loaded local-machine run used one worker and a command-line timeout override; committed CI timeout settings remain unchanged.

Earlier observed targeted results: 96 of 101 focused browser tests passed in the first focused run. Three Maps navigation timeouts passed on isolated rerun (3/3); obsolete Home assertions were corrected to the current explicit development-fixture contract. A later integration run passed 28/32 and exposed assistant/landscape defects and a keyboard-return expectation; after correction all eight affected tests passed. The production flag-off browser suite passed 32/32 locally before the final UI correction; the hosted production suite then passed on `197fd0dc` ([job](https://github.com/AlphaCompute/alphaphone/actions/runs/38009779558/job/114087005044)).

A standard `npm run android:build` was attempted and rejected the local speech AAR: expected SHA-256 `d08bbbd90f24684cf840efcb1cb9cf84a7d8683b7018859f4cb64305b722b26f`, available `8d5c9344e7fc0b70f9f3d52f84cd57dfdb3531fe02121ae98994a2afb23d6d86`. The qualified manifest was not weakened in the PR. Using the explicit developer path with the local unqualified input manifest, `npm run android:build -- --allow-unpackaged-runtime` built and verified standalone and launcher debug/unsigned-release APKs (four APKs), plus instrumentation builds and lint. The temporary manifest was restored and canonical notices regenerated afterward.

Those APKs are **not distributable**: no packaged resident runtime, unadmitted speech bytes/functional acceptance, incomplete packaged-runtime notices, unsigned releases and unset qualified release signer. No installation, emulator HOME-role acceptance, full AOSP image boot, real-service exchange or physical/user acceptance was performed by this review. See MVP-20, MVP-23, MVP-34–42 and MVP-47–50 for the separate gates.

## Remaining MVP work

The [detailed inventory](mvp-remaining-work-2026-10-09.md) and [machine-readable inventory](mvp-remaining-work-2026-10-09.json) contain 53 items with evidence, proposed priorities, dependencies and acceptance conditions. They cover unresolved product policy, missing integration, release/runtime qualification, live-service operation and pilot acceptance. They are the input to the next workflow; no recurring automation or external service provisioning is created here.
