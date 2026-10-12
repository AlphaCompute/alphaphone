# Durable Calendar and reminder deletion

Implementation work for #414. This document describes source behavior and explicit
remaining acceptance, not a completed device or provider qualification.

A reviewed deletion records the exact target and a ten-second monotonic deadline
before any deletion. Reminder admission persists suspension in the same envelope
as the intent; delivery and rearming read that suspension. Undo removes suspension
without changing occurrence identity, due time, revision or the saved record. A due
occurrence then follows the existing delivery policy. Expiry and Undo serialize
through the native journal or browser document transaction.

Native work uses Android boot identity and elapsed time. Restart in the same boot
continues the original deadline. Unknown boot identity, reboot, or browser renderer
replacement cannot prove clock continuity, so the saved intent waits for explicit
Undo and renewed review. Owner/permission refusal pauses the intent permanently;
restoring access does not silently execute a formerly blocked deletion.

Manual operations bind the private installation and exact source. Agent review
captures authenticated native owner context off the UI thread. Confirmation fences
all provider/session/enrollment inputs without UI HTTP. Expiry obtains fresh native
authentication. A returning matching account, agent and enrollment can cancel a
retained intent after authentication, but cannot authorize an old session's write.
Visibility caching is bounded and invalidated by changed local authority inputs;
it is never write authority.

A native dispatch claim in the existing action journal survives bounded deletion
history retention. Cached renderer recovery cannot remove or replace the claim.
Only exact scope/proposal/operation-hash receipts can reconcile a terminal unknown
result. Verified deletion reports success; Undo reports the unchanged item without
a deletion result. Dispatching or missing evidence remains unknown, with no replay.
The browser development journal uses exact document receipts and CAS recovery.

The explicit shared patches are admitted by `patches/eliza/native-manifest.json`.
The pinned vendor checkout remains unchanged. The native deletion journal and
installation slots are denied to renderer credential APIs.

## Scope and evidence

The browser supports local events and series through the existing recurrence
model, and reminders. Native reminders use the shared persisted scheduler. Native
Calendar admission currently retains the existing safe direct-write boundary:
one local timed event without recurrence or attendees. Synced and recurring native
events still use Android Calendar handoff; Alpha cannot promise an Undo window for
an action performed by that external app. That portion of #414 remains open.

Focused host tests cover monotonic deadlines, process-restored journals, Undo/expiry
races, original reminder occurrence retention, revision/owner refusal, immutable
claims after 600 terminal records, and exact read-only receipt recovery. Controlled
browser UI tests cover review cancellation, delayed expiry, Undo, renderer restart,
late completion, uncertain admission responses, two-tab storage and retained legacy
unknown receipts. Exact run results are recorded with the review candidate.

Installed native proof remains required for scheduler/process-death behavior and
Calendar provider readback in both distribution variants. A shared-store native
fixture is registered as `ReminderDeletionJournal`; its fresh-store reconstruction
is not a substitute for killing and restarting the installed process. Real synced
Calendar integration and device/user acceptance remain separate.
