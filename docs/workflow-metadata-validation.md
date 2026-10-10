# Workflow Change: name and description

The existing Change button now opens the prototype builder's name/save layout for name and description only. Live mode hides trigger, step, account, source-generation and palette controls. Mock mode, present only in `ELIZA_DEV_ALLOW_TEST_MOCKS=1` builds, retains its original builder. Save validates a nonempty name of at most200 characters and a description of at most4000 characters. It does not run, enable, disable or reschedule the workflow.

## Durable mutation contract

Explicit patch `patches/eliza/0008-workflow-metadata-mutations.patch` applies after0007; exact base/hash and migration scope are in `workflow-metadata-source-base.json`. It adds `workflow.metadata_mutations` to the normal plugin schema. Existing definitions, execution records and schedules are unchanged by migration.

The server advertises `metadataMutationProtocol:1`. `POST /api/workflow/workflows/:id/metadata` accepts only UUID `mutationId`, `expectedVersionId`, `name` and `description`. Extra fields, including source, are rejected. One transaction locks the exact workflow, revalidates owner, checks any existing mutation identity, compares the current version, captures the previous revision, changes only the two permitted fields and stores an immutable receipt. It does not call scheduling or execution services. A duplicate identical mutation returns that same receipt; changed input under the same identity is409. A conclusively stale, never-applied mutation returns the identity-bound `WORKFLOW_METADATA_NOT_APPLIED` refusal.

`GET /api/workflow/workflows/:id/metadata-mutations/:mutationId` is owner scoped and returns that immutable receipt or null. The phone writes only mutation ID and reviewed version into an origin/owner/agent/workflow-scoped lock before submitting; name and description content are not persisted there. A lost response, malformed response or generic409 retains the lock. Reopening the workflow performs an exact GET; null is still unresolved, not permission to send another save. Only an exact receipt or correctly identity-bound definite refusal clears the lock. It then reads the current workflow independently, so a historical receipt is not presented as proof that no later edit exists.

Account/view changes abort the active request and clear its visible editor. An uncertain save remains scoped to the original account and reconciles by GET when that account returns. Existing servers without the advertised contract truthfully refuse phone editing. Existing broad legacy update/activation routes are not claimed to have acquired CAS semantics through this patch.

## Evidence

- Owning upstream plugin typecheck passes. `metadata-mutations-e2e.test.ts`:25 actual HTTP/PGlite assertions including8 concurrent identical requests→1 version/revision, owner404, stale refusal identity, conflicting-key409, source-field400, unchanged other definition fields, no executions, dropped committed response, close/reopen exact receipt and no duplicate revision.
- `scripts/test-workflow-metadata-host.mjs`: actual paired isolated47854 on the existing approval profile proves normal additive migration,8 concurrent requests→1revision, preserved source and all other definition fields, zero executions, stale/refused requests. `--restore` after an actual host process restart proves changed PID and identical durable receipt. Evidence: `test-results/workflow-metadata/{real-host,real-restart}.json`.
- `scripts/test-workflow-metadata-ui-flow.mjs`: actual adapter/protocol HTTP flow proves restricted builder, content-free retained intent, lost-response lock, renderer recreation and exact GET without replay, definite-refusal versus generic409 behavior, and account switch while save is pending.
- Existing run and approval adapter fixtures still pass. Approval itself passed actual native Build71 both variants; see [approval validation](workflow-approval-validation.md).

## Native acceptance — Build72 passed both variants

The wrapper that produced this result was removed on October 8 with the other aggregate smoke runners, at the owner's request; the result below is historical. No repository runner reproduces it today. A re-run installs a matching archived app/test APK pair on an owned disposable emulator and invokes the method directly with `adb shell am instrument -w -e class ai.elizaresearch.alphaphone.WorkflowMetadataInstrumentedTest#metadataChangeLostResponseReconcilesWithoutAnotherSave -e workflowMetadata true ai.elizaresearch.alphaphone.test/androidx.test.runner.AndroidJUnitRunner`, against the same kind of paired isolated fixture. A direct run does not repeat the wrapper's host-side checks listed below, so it is a different result and must be recorded as one.

The Build72 wrapper supplied `workflowMetadata=true` to `WorkflowMetadataInstrumentedTest#metadataChangeLostResponseReconcilesWithoutAnotherSave`, checks archived app/test hashes, forwards through47855→47854 with a fixed non-loopback address, and requires unauthenticated401 before pairing. It creates a uniquely named inactive synthetic arithmetic workflow but never runs it. Actual phone Change edits name and description, encounters a deliberately dropped committed save response, retains the lock across Activity recreation, and reconciles by GET. The wrapper verifies1POST, at least1lookup, exactly1revision,0executions, unchanged source/schedule/activation and exact new values/version. The test restores the previous phone selection and encrypted credential slot; the private pairing fixture is removed. Inactive fixture definitions remain as uniquely identified test history.

Primary47840 and47848 were preserved. Cloud workflow management, enclave deployment, arbitrary workflow authoring, trigger edits and source-generation review remain separate work. A launcher APK test here does not assign HOME or prove full AOSP boot.

Build72 terminal evidence: `test-results/prototype-build72/workflow-metadata/result.json` records both standalone and launcher passed with1POST/1GET/1revision/0executions, unchanged source/schedule/activation, and unauthenticated proxy401. APK/test hashes:

- standalone: `537719807752a305ff326a5697c9cf68ac77059a8dc2f69ad72b7dd4e5b1e7e7` / `fadb5db79c1372d8f7fe76c82b1cfa73f8898e4b27c9062df59a801ea07d0ab7`.
- launcher: `153fbd780843d01fb1dea741e952103f84121164d0ec1a91621b04db9702fdc9` / `3154b7f046d2d687e4c1d63da64a660e0ff9e8185727238b4f3f79ff83f5fa55`.

This is native local-agent metadata editing and Activity recreation, not HOME-role, phone reboot, Cloud or enclave acceptance.
