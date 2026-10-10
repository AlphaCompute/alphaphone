# Alpha agent integration contract

Alpha owns its renderer, view policy, connection choices and approval UI. Shared
runtime and protocol implementations come from the revision in `upstream.lock.json`.
The primary deployment is an Android-resident agent with explicitly configured
inference; Cloud and remote agents are separate supported connection paths.
See [architecture](architecture.md), [local agent setup](local-agent-development.md)
and [current product status](mvp-current-status.md) for deployment and acceptance limits.

## Renderer boundary

`apps/app/src/runtime/alpha-client.ts` is the browser-safe integration boundary.
Its public state contains connection status, pending work, nonsecret identity and
versioned view context. Subscriptions return an unsubscribe callback. View and
selection changes must call `setViewContext`; selected-object metadata contains
opaque identifiers and revisions, not file bodies, credentials or hidden content.

`send` requires a verified transport and an allowed, nonsensitive context. Present
the exact proposal before calling `approve`.

Draft preservation is not yet complete. The composer
(`prototype/agent-adapter.ts`) consumes the conversation-bound draft and clears the
input before it connects or dispatches. A failure before dispatch, such as no
selected agent connection, a changed screen or a changed agent, leaves the text only
in the user bubble, not in the composer. The required behavior, still open, is to
consume the draft only after dispatch succeeds, to restore the text after any
pre-dispatch failure, and to offer a history check rather than a blind resend after
an interrupted stream. Typed drafts survive navigation, resize and restart only while
they remain unsent; the [current status](mvp-current-status.md) tracks the remaining
gap.
Agent prose never authorizes an action. `cancel` retires pending UI work and
proposals; it cannot roll back an already dispatched effect. `disconnect` retires
the transport, but credential revocation belongs to its authentication controller.
`attachVerifiedTransport` is a trusted composition API, never a login form or a
capability exposed to third-party web content.

Context changes and connection epochs reject late replies and approvals. Copy
reviewed inputs and bind them to identity, selection, expiration and target
preconditions. An ambiguous write requires receipt reconciliation; do not retry
its effect automatically. In-memory proposal consumption alone is not durable
execution deduplication.

## Connection and service ownership

`runtime/connection-ui.tsx` owns the chooser and connection controller.
`runtime/native-connection.ts` adapts native HTTP and credential operations;
`AlphaConnectionPlugin` supplies encrypted Android credential storage. Public
selection preferences and conversation mappings are not authentication evidence.
Restoring a saved choice requires fresh authenticated verification. Protocol code
may access credentials through its injected store; this is not a claim that
credentials never enter JavaScript memory.

| Domain | Authority | Lifetime |
| --- | --- | --- |
| Cloud services | Verified environment, account and service session | Independent of a separately paired agent; sign-out retires account-bound requests and data |
| Agent target | Verified origin, owner, agent and conversation | Target changes retire pending chat, proposals and target-bound results |
| Local development bridge | Explicit loopback host and temporary debug token | Debug-only acceptance lane; not production authentication |
| Offline or mock | Explicit user selection | No implicit live connection or fixture action promoted to a real effect |

`getCloudClient()` and `getCloudEnvironment()` use the independent service session.
Gmail and Cloud speech must bind that session; a remote agent selection does not
itself authorize access to Cloud account data. OAuth consent is not consent to
send mailbox contents to another agent. Sign-out, account replacement, revoked
authority and target changes must reject stale callbacks against the relevant
captured identities.

Conversation selection is scoped to origin, owner and agent. Explicit restoration
checks conversation membership and accepts historical user/assistant text, not
executable historical actions. Context prefixes are removed only when they match
the exact current envelope. The controller rejects histories over 2,000 records;
a bounded server response is not proof of complete archival recovery.

## Actions and workflows

`runtime/device-actions.ts` consumes the admitted upstream device-action contract.
Remote/local enrollment binds the installation key to origin, owner and agent.
Unsupported hosts may retain typed chat without device authority. Exact proposals
must pass identity, digest, expiry, operation-union and current-context checks.

Reserve the native journal before claiming an effect. Persist an accepted claim
before dispatch, then persist its terminal receipt before acknowledgment. Lost
claim responses, interrupted writes and duplicate entries require reconciliation,
not execution replay. Receipt synchronization repeats the receipt only. A reminder
receipt establishes scheduling, not delivery; opening a browser establishes the
navigation request, not successful page loading or content observation.

`runtime/workflow-protocol.ts` handles capability discovery, typed draft generation,
remote definitions, reviewed runs, cancellation and execution receipts. Generation
must retain selected read scopes and admitted operations. Run admission uses
expected versions and submission reconciliation when the host advertises those
capabilities. An unknown response must not trigger another submission: the phone
first reads the exact submission receipt. Only when the agent reports no run for that
submission ID may the owner confirm sending the same request again under the same ID
and reviewed version, which the agent admits at most once; an agent without
submission identities is never sent a repeat. If the workflow version changed before
any admission, the request can no longer be admitted and is closed as not run. Pause does
not cancel an existing run; a queued receipt is not successful completion.
Execution updates use explicit receipt reads. Approval and cancellation correctness
does not depend on a continuous event stream; a dropped connection requires an
authoritative receipt read before presenting the outcome.
See [workflow lifecycle](workflow-lifecycle-validation.md) and
[mobile workflow packaging](mobile-workflow-packaging.md) for the owning contracts.

## Cloud mail and voice

The Inbox adapter binds requests to the verified service session, account and
query. Its 25-to-50 result expansion is bounded search, not mailbox pagination.
Changing account/query or signing out discards stale results. Read grants do not
imply send grants; send/reply requires exact recipient/body review, account binding,
provider receipts and unknown-outcome recovery. Attachments require explicit
review before saving or handing data to another app.

Voice capture, ASR, reply generation and TTS have separate ownership and consent.
A transcription is an editable draft, not an automatic message or saved note.
Bind remote speech to the selected service identity; retire late capture/upload/
playback results after cancellation or account changes. Do not upload hidden
context or history as an implicit side effect of read-aloud. Local speech setup
and its evidence are documented in [local agent development](local-agent-development.md)
and [local speech build instructions](../scripts/local-speech/README.md).

## Development runtime

`backend/runtime.ts` composes the pinned runtime with Alpha's development character,
allowed proposals and local conversation identity. It deliberately registers only
the configured Cerebras text provider: no embedding handlers, fake vectors or
semantic-recall claim. Conversation history remains stored. `backend/loader.ts`
authenticates source before bundling through the upstream consumer resolver.

```sh
npm ci --prefix backend --ignore-scripts --legacy-peer-deps
npm run agent:dev
```

Use an already authorized environment with `CEREBRAS_API_KEY` and
`CEREBRAS_BASE_URL`; do not store credentials in the repository or APK. The host
prints an owner-only temporary token file path. For an owned debug emulator,
`node scripts/configure-dev-agent.mjs` provisions the debug bridge and port reverse.
`npm run agent:diagnostic` explicitly selects the direct-model diagnostic path,
which has no runtime conversation memory. For the full local host and resident
runtime, follow [local agent setup](local-agent-development.md).

`bun run backend/test-runtime.ts` is separate live acceptance: it uses a private
fixture for real model turns, new-process history, cancellation and proposal-only
actions. `scripts/test-dev-agent.mjs` exercises the host protocol and an approved
temporary host note fixture. Neither proves Android UI execution. Local ASR's
host-only and HTTP checks are in `scripts/test-local-asr.mjs`.

## Verification boundaries

Loopback HTTP fixtures verify protocol and lifecycle behavior, not live accounts,
provider grants or native disk durability. Repository tests and APK builds do not
establish emulator HOME behavior, resident process recovery, AOSP boot or physical
device acceptance. Retain evidence tied to the tested source and artifacts.
Required live checks include authentication/revocation, account and owner isolation,
conversation recovery, unknown-write reconciliation, real approved actions,
mail grants and receipts, voice interruption, and offline/mock isolation.

Native arithmetic workflow acceptance (`WorkflowInstrumentedTest`, opt-in argument
`workflows=true`) previously ran through a dedicated wrapper. That wrapper and the
other aggregate smoke runners were removed on October 8 at the owner's request, so
there is no current repository runner for this case. A re-run needs an owned
disposable emulator, a matching archived app/test APK pair, an OWNER session from
ordinary pairing and the exact inactive arithmetic-only fixture created and inspected
with `scripts/test-real-workflow.mjs`. Invoke the instrumentation method directly
with `adb shell am instrument`. A direct run does not repeat the wrapper's host-side
list/detail and source checks, so record it as a different result from the archived
runs. Keep the fixture free from concurrent edits. Never pass session credentials as
arguments, and never reuse a historical workflow UUID as proof of current admission.
The isolated native workflow campaign that does exist is
`node scripts/android-workflow-native.mjs` (see [verification](verification.md)).

## Ownership and recovery invariants

- Voice preparation captures the initiating view, agent and Cloud identity, and
  connection mode. Success and failure both recheck ownership before navigation
  or fallback. Navigation, hidden/pagehide and unmount retire outstanding probes;
  returning to a view does not revive them. A pending note save locks its reviewed
  transcript; a late completion cannot close a newer recording or publish an old
  error. An authorized committed write remains persisted after UI cancellation.
- Cloud delegation submits completion once, then reconciles through read-only
  status. Uncertain pending state remains recoverable; no automatic resubmission.
  Recheck ownership after secure-store operations. Session expiry clears only the
  matching binding, while ordinary failures must not masquerade as expiry.
- Gmail reads capture the selected account, grant, session and operation. Retiring
  them prevents late draft/undo/receipt updates. Cancelling an inbox, search or
  connection read preserves unsaved edits; full teardown belongs to owner change
  or unmount. Restoring a grant does not silently fetch or send mail.
- Authenticated device enrollment negotiates an owner/agent/device-bound view
  profile revision. Discovery, proposal review and execution all enforce it.
  Unknown legacy negotiation grants no additional authority. Lost conditional
  updates are reconciled by reads, never blindly replayed.
- Notification taps retain opaque encrypted tokens bound to exact owner, agent,
  execution/occurrence and revision. Opening a tap only resolves its target;
  it never approves, executes or completes it. Failed capture remains retryable;
  consumption requires the exact pending token. Bounded ledgers fail closed
  rather than evicting pending or deduplication history. Public credential APIs
  must not expose native authority namespaces.
- Reminder creation persists its identity and original receipt before effects.
  Due time, alert lead and civil recurrence remain independently reviewed; no-alert
  records neither request alert permission nor schedule alarms. Edits preserve
  completed history and require explicit review for another occurrence. Snooze
  changes delivery time without rewriting the original schedule. Clock handoff
  receipts distinguish dispatch from confirmed alarm state; targetless actions
  require manual target selection in Clock.

Qualification must preserve those boundaries: notification recovery sends the
original PendingIntent once and observes readiness within the existing deadline;
unknown publication receipts are polled without reposting. Process-death tests
prove the exact old process is absent and a new process receives the original tap;
Activity recreation and force-stop are different cases. Native crash diagnostics
retain only bounded numeric attribution for the exact worker, preserve the primary
failure and cleanup, and never weaken seccomp or SELinux to obtain a pass.
