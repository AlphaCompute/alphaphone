# Inbox provider completion

Email/Gmail is in MVP scope (product decision, October 7, 2026). This plan dates from September 30. The current boundary below records what the October 7 change implemented. It is still not acceptance evidence: real OAuth, Cloud deployment and a real mailbox remain open. The existing prototype remains the visual contract; offline encrypted local drafts must continue working independently of Cloud authentication.

## Current boundary (October 7)

The cloud adapter (`apps/app/src/prototype/inbox-cloud-adapter.ts`) and `runtime/cloud-protocol.ts` now provide the following against the managed owner connector:
- account-scoped search with the provider's opaque `nextPageToken` (Load more) and an `in:sent` Sent view;
- automatic load on open, plus Refresh;
- threads and single-message reads;
- reviewed send, provider draft, archive/trash/undo and attachment operations through `inbox-v1`, with durable receipts and no automatic re-send;
- `POST /api/v1/eliza/google/disconnect` behind a confirmation and a read-back (`runtime/gmail-mailbox.ts`), exposed in Inbox and Settings → Connections;
- classified offline, revoked-grant and stale (409) failures, each with an explicit Retry;
- Notes sharing into a prefilled local draft;
- a From switcher for more than one connected account.

The upstream inbox-v1 operations could not change read state, so [`patches/eliza/0037-gmail-inbox-read-state.patch`](../patches/eliza/0037-gmail-inbox-read-state.patch) adds reviewed `mark-read`/`mark-unread` kinds, a `readState` capability and the receipt-kind migration. It was tested in an isolated upstream worktree and is not deployed. Until a deployed server advertises `readState`, opening a message does not mark it read, and the Home unread badge reflects loaded Inbox pages only.

The September 30 findings below are kept as written for their date.

## Verified boundary (September 30)

At that time `apps/app/src/prototype/inbox-cloud-adapter.ts` exposed bounded account-scoped search and single-message reading, plus encrypted local compose/reply drafts. Its archive/delete/forward actions deliberately did not mutate mail. `runtime/cloud-protocol.ts` consumed `/api/v1/eliza/google/accounts`, `/gmail/search` and `/gmail/read` under the managed owner connector. Current source in `~/v3/packages/cloud/api/v1/eliza/google/gmail/read/route.ts` authenticates the organization/user and delegates the selected grant to the managed connector. This route is not a thread, attachment or sending contract. Local source inspection does not establish the deployed Worker revision.

Gmail provides full-thread retrieval through [threads.get](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/get). Its [draft resource](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts) has an immutable draft ID, replacement update, send, and permanent draft deletion. [messages.send](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send) returns a Message on success and sends to the MIME recipient headers. The inspected send contract does not advertise an idempotency-key parameter. Therefore Alpha must not infer exactly-once delivery from its own request ID.

## Required implementation

1. Extend the managed Cloud connector through a reviewed upstream change, not a phone-side Google token store or an arbitrary URL proxy. Every endpoint derives organization/user from authentication and validates the selected grant and required capability. Keep Google refresh/access tokens server-side. Publish protocol capabilities so older deployments produce an explicit unavailable state.
2. Add a selected-thread endpoint returning ordered bounded messages, exact provider IDs, body representation and attachment metadata. Reuse the prototype's existing detail/attachment layout. Treat message bodies as inert text by default; do not execute HTML or fetch remote tracking images. Long threads need an explicit truncation/paging contract rather than silently dropping messages.
3. Add explicit attachment retrieval bound to grant, message and attachment ID. Check declared and actual byte limits and MIME type; generate an opaque short-lived reference. Download only after the user's selection. Native open/share uses a scoped content URI and reports handoff separately from consumption. Do not attach bytes to the agent automatically.
4. Preserve local drafts and add distinct provider-draft save/update/readback. Persist the returned draft ID and canonical content digest. Before replacing a remotely changed draft, require review; a preflight digest comparison is not a provider-wide atomic compare-and-swap guarantee. Do not silently overwrite an edit made concurrently in Gmail. Draft deletion is permanent at the provider and needs an explicit destructive confirmation; local discard must not imply remote deletion.
5. Implement compose, reply, reply-all and forward as reviewable drafts with explicit From account, To/Cc/Bcc, subject, body and attachment list. Bind reply headers and thread identity to the selected provider message. Reject header injection and invalid/ambiguous recipients. Preserve the exact reviewed MIME digest when creating the operation.
6. Give send and mailbox mutations durable owner/grant/request receipts with prepared, dispatched, succeeded, rejected and outcome-unknown states. Serialize one admitted operation per request ID, but never equate that with Gmail-side deduplication. After response loss or process death, query the exact operation and available provider evidence; never issue a second send automatically. A provider success receipt is not proof that a recipient read or received the email.
7. Archive removes INBOX; delete moves to Trash with an explicit undo path where supported. Permanent deletion is a separate confirmed operation. Return exact changed message IDs and read back affected labels. Reconcile partial results individually. Do not silently mutate an entire conversation from a selected-message action.
8. Attach selected message/thread context to the agent only through an explicit content review. Show the selected account and destination agent. Agent drafting may produce suggestions; it cannot bypass the same final recipient/content review and mutation receipt path.

## Verification sequence

Use a closed synthetic HTTP provider for actual Cloud route/database integration, with two owners and grants, real MIME parsing and controlled response loss. Then exercise the exact phone UI against that service in both distributions: account switch and revocation during fetch, multi-message thread, attachment cancel/open, local/provider draft distinction, stale remote draft, MIME recipient review, duplicate confirmation, lost send response, process restart and canonical receipt lookup. Require zero second send dispatches during recovery and no unselected content in agent context.

Real acceptance separately requires normal Cloud login and working Gmail OAuth, an explicitly authorized test mailbox/recipient, actual provider draft/readback and approved send/reply, label changes and recovery. The current Google code-exchange401 and pending Cloud organization-key approval remain external gates. Do not send real mail merely because the synthetic flow passed. Preserve existing local drafts if those gates remain unresolved.
