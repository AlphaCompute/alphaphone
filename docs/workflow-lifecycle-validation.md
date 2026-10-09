# Workflow removal and restore

The live phone action is **Remove workflow; keep execution history**. It is not erasure and does not undo prior effects. Removal requires a second explicit confirmation. Existing nonterminal executions must be cancelled individually through their receipts first. Restore requires completed trigger cleanup and returns the definition paused; it never automatically resumes schedules.

The `Removed workflows` card provides fresh-session access to removed definitions and their retained executions. The exact definition ID and owner remain available after removal. A persistent, account-bound pending row keeps an ambiguous removal reachable even when the live list no longer contains its definition. Reopening reconciles by mutation UUID and reviewed version with GET; it never repeats POST automatically. Stored mutation intent excludes source, descriptions, credentials and execution output.

## Reviewed upstream implementation

Apply `patches/eliza/0009-workflow-lifecycle-mutations.patch` after0008. SHA256 `e2b0521bb613e5a3579cc7dd23e245ab74b431e8cf6471f9fe6f6f1b4ebf72e2`. The additive SQL table stores owner/workflow/mutation identity, expected version, operation and immutable receipt. Normal plugin schema migration creates it. No existing execution rows are deleted. Legacy destructive DELETE now returns409 and requires this reviewed path.

Definition row locking serializes lifecycle transitions with queued execution admission, metadata CAS, activation and update. Removal rejects unfinished/unsupported terminal states. The retained definition blocks background and manual admission while removed; paused definitions also reject trigger admission. Failed trigger deletion leaves durable pending cleanup and blocks restore. Startup retries exact workflow task removal. Cleanup never touches unrelated workflow tasks. Schedule synchronization is serialized within one service; an in-flight task created by another host rechecks version/state and deletes its own stale task. Durable admission still rejects a stale task while removed or paused. This does not establish distributed scheduler exactly-once delivery or cron/DST acceptance.

Endpoints under `/api/workflow`:

- GET `/status`: `lifecycleMutationProtocol:1`.
- GET `/removed-workflows`: owner-scoped removed definitions; regular list excludes them.
- POST `/workflows/:id/lifecycle`: `{mutationId,expectedVersionId,operation:"remove"|"restore"}`.
- GET `/workflows/:id/lifecycle-mutations/:mutationId`: exact immutable receipt or null, plus current lifecycle state.

Detail and execution receipt routes remain owner-scoped and readable. Typed `WORKFLOW_LIFECYCLE_NOT_APPLIED` is accepted by the phone only when workflow, mutation and expected-version identity match. Other409/network failures retain the pending lock.

## Evidence

2026-09-30: owning plugin typecheck passed. Four actual HTTP/PGlite integration tests passed98 assertions before the final duplicate guard; the final lifecycle rerun passed39 assertions: owner isolation; actual held run refuses removal before explicit cancellation; six duplicate removals one revision; retained completed execution; cleanup failure; reopened database/startup cleanup limited to the fixture; restore paused; historical duplicate receipt does not re-remove a restored definition.

`test-results/workflow-lifecycle/real-host.json`: actual paired isolated47856, forwarded non-loopback authorization, unauthenticated401, six duplicate mutations, retained completed arithmetic run, removed list and admission refusal. `real-restart.json`: changed OS process PID, same immutable receipt and completed execution, restore paused. No model call or communication effect was needed. Other local agents remained running.

`node --experimental-transform-types scripts/test-workflow-lifecycle-ui-flow.mjs`: real phone adapter/protocol against synthetic HTTP passed explicit review, lost response, component recreation, account-switch cancellation, history reachability and GET-only reconciliation. Existing approval and metadata adapter fixtures also passed.

**Build74 scoped Android acceptance passed both variants:** `WorkflowLifecycleInstrumentedTest#removedHistorySurvivesRecreationAndExplicitRestore`, opt-in `workflowLifecycle=true`. The Build74 wrapper was removed on October 8 with the other aggregate smoke runners, at the owner's request; no repository runner reproduces this result today. A direct `adb shell am instrument` run of the method with `-e workflowLifecycle true` on an owned disposable emulator is a different, narrower result because it omits the wrapper's host-side checks. The archived run required the isolated47856 owner-paired fixture, uses forwarded proxy47857 with unauthenticated401, checks archived app/test hashes, restores the previous connection and secure credential, and uses one completed synthetic arithmetic run. Activity recreation is not process-death proof. Build, emulator HOME-role, unified agent, Cloud and enclave acceptance remain separate.

Final duplicate guard: `real-historical-replay.json` verifies the revised real host preserves the restored definition byte-for-byte when returning a historical removal receipt. The39-assertion lifecycle test additionally confirms this replay does not access the task store.

Native evidence: `test-results/prototype-build74/workflow-lifecycle/result.json`, standalone and launcher instrumentation each `OK (1 test)`. Each observed2POST (remove and explicit restore),1 exact mutation GET,1 retained completed arithmetic execution and2 revisions. Source and schedule remained unchanged, restored state was paused, and the forwarding proxy rejected unauthenticated requests with401. This includes real chooser pairing, Activity recreation and navigation through Removed workflows, not a HOME-role or unified-host claim. Exact app/test APK hashes are retained in that result.
