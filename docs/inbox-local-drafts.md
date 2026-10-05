# Account-bound local Gmail drafts

## Storage and account boundary

Use the exact Inbox composer and detail Reply controls for explicit local drafts.
No message-send/reply-send/provider-draft endpoint is called for local drafts. Send
and attachment controls explain their unavailable capability; they do not create
synthetic Sent entries. Agent replies cannot invoke composer effects.

Existing `AlphaConnection.secureRead/secureWrite/secureRemove` stores AES-GCM data
in the app's no-backup directory with Android Keystore, per-slot authenticated
data, atomic writes/readback, a storage lock, and a 256 KiB ceiling. Reuse this
boundary with an `inbox-drafts:v1:` namespace distinct from credential slots.
Derive the slot from verified Cloud environment + user ID + organization (when
present) + exact Gmail connection ID. Never use an email label, transient agent
identity, or just a renderer-selected account name as ownership authority.

A draft records a random ID, revision, owner/account binding, literal recipient
addresses, subject, body, and optional reply source message/thread IDs. It does
not persist read message bodies, bearer credentials, people suggestions, or HTML.
Use at most one local draft per Gmail connection;
explicit replacement/discard must not silently lose an existing draft. Bound
recipients/subject/body and serialized UTF-8 bytes below the native slot ceiling.

Create/reply displays the exact From account; reply copies only the explicitly
opened message's account, message ID, thread ID, sender address and subject.
Recipients remain editable literal email addresses with CR/LF rejection. Reply
binding is preserved independently of edited subject/recipients. No background
semantic extraction or content upload occurs.

Explicit Save draft awaits native persistence before showing Saved locally.
Restore reads/validates the exact current account's slot and updates the composer
only when account/session/generation still match. Discard asks for confirmation
when persisted or nonempty, removes only that account's slot, and awaits the
receipt. Back/leave retains in-memory edits during the view's current lifetime or
shows an explicit unsaved warning rather than claiming persistence. Account
switch/sign-out hides the prior account's draft immediately; it must not write
that content into the next account's slot. Successful writes initiated before a
switch remain bound to their original slot, but cannot update the new UI.

UI controls should reuse existing compose header/body geometry. Save/restore/
discard affordances belong in existing action/chip surfaces and conditional
confirmation sheets, with narrow Inbox-only template changes if required. The
prototype's Send icon remains Send and is never relabeled into a misleading save.

## Verification

Use a fixed synthetic managed-provider fixture (never proxying to Gmail) with two
accounts and deterministic messages. Record all outbound HTTP methods/routes;
assert zero send, reply-send, or provider-draft calls for every local operation.
Native flow: compose with literal recipient, edit body, Save locally, close,
restore after Activity recreation and process restart, verify exact text;
reply preserves selected source binding; discard cancel preserves, confirmed
discard clears only that account. Inspect encrypted slot files to prove synthetic
plaintext absent without logging content or credentials.

Rendered race flows: delayed account-A load/write followed by account-B switch;
late completion must not populate/close B, dirty edits must not be overwritten by
hydration, repeated save/discard must serialize. Fixture unavailable storage must
show failure and keep edits; oversized values fail before a native write.
Mock reference screens remain fixture-only and make zero native draft calls.

Provider send idempotency, unknown-outcome reconciliation, attachments, full
remote draft CRUD, and production Gmail acceptance remain separate work. Current
local backend source returning provider IDs is not proof of deployed behavior.

## Native process verification

`InboxDraftInstrumentedTest#processPhase` uses AndroidJUnitRunner with an
explicit `inboxPhase` and run UUID. `InboxFixtureScope` validates those inputs;
`InboxFixtureActivity` and `InboxFixtureConnection` substitute a closed synthetic
Cloud/Gmail transport before WebView creation. Storage delegates to the real
native credential-slot implementation. No provider network or mail send occurs.

Build a matching test-mocks APK pair for the staging chooser used by this
fixture. Retain both APK hashes in the archive's flat `apk-manifest.json`, then
run against an owned disposable emulator:

```sh
ANDROID_SERIAL=emulator-N ALPHA_NATIVE_TEST_AVD=owned-avd ALPHA_NATIVE_TEST_ABI=x86_64 \
node scripts/test-native-restart.mjs inbox \
  test-results/inbox-archive/standalone-debug.apk \
  test-results/inbox-archive/standalone-androidTest.apk \
  test-results/inbox-standalone
```

Repeat with the matching launcher pair and a new output directory. The runner
leases the emulator, refuses existing package registrations and uses a fresh
secondary user. Set `ALPHA_TEST_HOME_PACKAGE` when the stock HOME package differs
from `com.android.launcher3`. Uncertain cleanup retains the user for recovery. The runner records prepare, restore and
cleanup phases, exact artifact hashes and process IDs. A different restore PID
is required. The retained report must prove cleanup as well as successful
save/restore; compilation alone does not qualify this flow. These are synthetic
provider tests, distinct from production Gmail, TLS, device and user acceptance.
