# Remaining workflow flows after the Build69 freeze

This plan is a source audit, not an implementation or deployment claim. No
services or APK sources were changed for it. The reference requirement is F15
in `docs/flow-audit-and-prd.md`: describe → editable trigger/steps → account and
permission review → preview/test → exact-version approval → enable, with real
approval, cancellation, restart and uncertain-effect recovery.

## Implementation update after this audit

The approval slice described below is now implemented in explicit upstream patch0007 and the phone receipt UI. Its real HTTP/canonical-store, account-switch and actual process-crash evidence are in [workflow approval validation](workflow-approval-validation.md). Build71 native approval acceptance passed both variants. The numbered gaps below preserve the Build69 audit baseline; items2–3 have the scoped implementation just linked. Name/description-only Change now has a scoped version-bound mutation implementation and host/client proofs in [metadata validation](workflow-metadata-validation.md), with Build72 native execution passed in both variants. Other authoring, safe source review, activation/version race, trigger and Cloud/enclave gaps remain open.

## What is actually qualified

| Flow | Current evidence | Boundary |
|---|---|---|
| List/detail, reviewed manual run, history, activation confirmation and pause | Build48 archived native tests, both variants | Existing workflows on local agent; no phone authoring |
| Explicit running-execution cancellation | `test-results/prototype-build67/workflow-cancellation/result.json`, both passed | Exact current receipt, actual47840 terminal cancellation, prior connection restored; no effect rollback |
| Lost accepted run response → retained unknown status → Activity recreation → exact-key reconciliation | `test-results/prototype-build68/workflow-submissions/result.json`, both passed; each records1POST,1lookup,1execution | Actual47848 through response-dropping loopback proxy; arithmetic fixture; Activity recreation is not process-kill acceptance |
| Atomic admission, version refusal and process restart | `test-results/workflow-submissions/real-host.json`, `real-restart.json`; patches0004/0006 | Eight requests admitted one run, typed refusal, changed PID and same run receipt; not exactly-once external effects |
| Durable cancellation recovery | `test-results/workflow-cancel-recovery/prepare.json`, `verify.json`; patch0005 | Cancel acknowledged while running, hard-stop/restart, no held synthetic effect; positive control proves witness; isolated47848 only |
| Local speech | Build63 paired TTS and Build65 paired Whisper tests, both variants | Native decode/upload/review/edit/playback with synthetic recording ingress; no real microphone ASR acceptance, Cloud or enclave inference |
| Agent context | Build55/66 local conversation/action evidence; workflow getter supplies only ID/version | Context observation does not authorize execution or upload workflow source |

The controller still returns no workflow client for a selected Cloud agent
(`connection-ui.tsx:getWorkflowClient`). Neither Cloud workflows nor the signed
enclave deployment are accepted by the local evidence above. Local Whisper
routes are explicitly local/local-only and cannot be relabeled enclave support.

## Source-backed gaps

1. **New / Change / Delete are unavailable.**
   `workflow-adapter.ts:unsupported` wires all three to the same truthful toast;
   its returned `builder:false` never enters the prototype builder. The server
   has generate, deploy, PUT update and DELETE routes. Generation calls the
   selected text model and returns executable Smithers source. A method for
   modifying a draft exists in `WorkflowService`, but there is no corresponding
   modification endpoint in the inspected route table.
2. **Approval decisions are absent from the phone.**
   `WorkflowExecution.approvals` has run/workflow/node/iteration, pending or
   decided status, prompt and timestamps. `WorkflowProtocol.runResult` drops
   this collection, and the receipt renders only event summaries/output/error.
   Server POST `/api/workflow/executions/:run/approvals/:node/:iteration` exists.
3. **Approval truth spans two existing stores.**
   `embedded-workflow-service.ts:decideApproval` sends a control command first,
   then updates the Postgres execution projection and resumes the run.
   `smithers-runtime.ts:createSmithersControlScript` calls Smithers
   `approveNode`/`denyNode` on the workflow's durable SQLite store. In pinned
   `@smthrs/engine/src/approvals.js:resolveApprovalNode`, a transaction locks and
   validates the node is waiting for approval before persisting its decision;
   this is real protection, not an arbitrary unvalidated control API. However,
   process loss between that decision and the Postgres projection update can
   leave the phone's receipt stale. Resending the POST is not reconciliation.
4. **Creation/update/activation lack reviewed mutation admission.**
   The existing update facade preserves ownership, but its PUT and activation
   routes have no atomic expected-version precondition or idempotent mutation
   identity. Client GET-then-POST cannot close that race. Patch0004 protects
   manual run admission only. `deployWorkflow` treats an existing ID as update;
   it is not an idempotent new-creation contract.
5. **Declared step descriptions are not a permission boundary.**
   `validateSmithersSource` checks required import/default export and rejects
   obsolete package names. It does not prove declared steps correspond to
   executable behavior or restrict filesystem/network capabilities. The worker
   imports source before running the workflow, so top-level code can act before
   any Smithers approval node. A model-generated friendly step list cannot
   justify automatic deployment, preview, enabling or execution.
6. **Trigger policy is not exposed or fully qualified.**
   Prototype trigger objects are never submitted. Timezone, missed-run,
   overlap, retry and account-revocation semantics still need backend-supported
   descriptors and integration evidence. Legacy scheduled idempotency remains
   find-before-insert with a nonunique index; the new manual ledger deliberately
   did not claim to fix scheduled duplicate dispatch.
7. **Live progress still uses explicit receipt reads.**
   SSE currently sends a stored snapshot before subscribing and lacks a
   Last-Event-ID reconciliation contract. That can miss a transition at the
   boundary. Keep authoritative receipt polling until the stream protocol is
   repaired; do not make streaming a prerequisite for approval correctness.

## Recommended next implementation: real approval receipt and decision

This is the smallest end-to-end improvement that directly closes a missing F15
step using the existing engine, rather than introducing a second approval queue.

1. Extend the server's execution read projection to reconcile approval decisions
   against canonical Smithers approval rows. Return immutable run version,
   node/iteration and a stable request digest/revision, plus only the bounded
   fields needed for review. Never resolve identities from display labels.
2. Extend the existing decision route with exact expected run version and
   request identity; reject terminal/cancel-requested runs and stale/mismatched
   requests before dispatch. Keep the existing Smithers transactional decision
   owner. A duplicate/conflicting decision must read the committed result,
   not write another UI-only approval record. Expose a read-only decision
   receipt so a lost response can be reconciled after restart.
3. Add pending approval rows to the prototype receipt. Show the step, operation,
   account/source and precise consequence when the backend actually supplies
   them. If a required effect/account field is unavailable, explain that the
   step cannot be approved from this phone; do not invent it from prose.
   Explicit Approve or Deny opens a second exact review/confirmation state.
   Leaving the view or changing connection invalidates confirmation.
4. Persist only the nonsecret decision identity before POST. On response loss,
   show outcome unknown and allow read-only reconciliation. Do not assume a
  500 means the SQLite decision failed. Receipt UI must distinguish decision
   accepted from step completed or effect confirmed.
5. Prove with a real two-step synthetic workflow: read-only arithmetic → approval
   → one test-owned file effect. Before approval no file; Deny no file; Approve
   one file. Race Approve/Deny, duplicate taps, forged node/iteration, old
   version, wrong owner, account switch, lost response after canonical commit,
   service restart and cancelled-run decision. Verify receipt and exactly one
   effect, then both archived native variants using actual review controls.

Only after that proof should phone-triggered communication or destructive steps
be considered. The fixture does not establish email, calendar or device-action
provider authorization.

## Following slice: metadata edit, then real inactive creation

**Edit first:** activate the existing Change screen for name/description only.
The backend applies an allowlisted patch to the stored definition under an
owner/version compare-and-swap; it cannot accept a replacement source, schedule
or capabilities through this metadata route. Add a mutation receipt for a lost
response. Read back the new version and verify source/schedule/active state are
unchanged. A stale edit retains the draft, displays the server version and
requires a new explicit review; no automatic overwrite. This gives a useful
real edit flow without claiming a source editor is finished.

**Creation next:** make New enter the existing prototype builder with a locally
retained intent draft. Explicit Generate sends only the edited instruction to
the selected agent. Treat returned source/steps as an untrusted draft. Preserve
its exact source/version and accounts; show unsupported capabilities rather
than deleting steps. Saving creates an inactive, versioned draft through a
new idempotent, owner-bound creation contract. It must not invoke source,
preview it by execution, schedule it, or enable it. A stale/dropped creation
response reconciles by creation ID and cannot create another workflow.

A saved draft needs a server-enforced executable-review state: changing source,
accounts or schedule invalidates approval, and Run/Enable must refuse an
unreviewed draft. Merely hiding a button or setting `active:false` is insufficient,
because the current manual-run endpoint can execute inactive definitions.
Use existing Smithers templates/capability declarations once their enforcement
is established. Do not add a source regex that purports to sandbox arbitrary
TSX. Full source edits and generated external-effect workflows remain behind
this actual enforcement boundary.

**Delete:** use the existing button only after defining retained history and
active-run policy. Default to disable first; block deletion while an execution
is nonterminal or submission outcome unresolved. Confirm exact workflow and
account. Preserve audit receipts/decision history even when definition removal
succeeds. Provider not-found after an ambiguous delete is not evidence that
unrelated history may be removed.

## Decisions adopted for implementation planning

- Explicit refresh remains acceptable; correctness does not depend on SSE.
- Approval and saved-draft decisions are bound to exact version and account;
  changing either clears UI confirmation.
- No new automatic trigger type is enabled by opening or saving a builder.
- Draft source is not evaluated merely to create a preview.
- Metadata editing precedes full executable-source editing.
- Unknown outcomes remain visible until canonical reconciliation proves a
  result. A new attempt requires a fresh explicit decision.
- Run receipts never imply provider delivery or rollback. Cloud/enclave gates
  remain separate from the local worktree/runtime and emulator evidence.
