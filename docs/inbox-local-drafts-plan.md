# Account-bound local Gmail drafts

## Build 67 scope

Use the exact Inbox composer and detail Reply controls for explicit local drafts.
No message-send/reply-send/provider-draft endpoint is called in this slice. Send
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
Use at most one local draft per Gmail connection for this bounded first slice;
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

## Build 67 source and evidence

Implemented `inbox-drafts.ts`, the Inbox adapter/composer bindings, and the narrow
`AlphaConnection.secureCompareExchange` draft namespace. Compare-and-exchange
uses the existing native storage lock, encrypted AtomicFile and readback; stale
writes/deletes return conflict without replacing newer content. Current-session
edits survive closing the composer and switching Gmail connections. Cloud
session changes clear in-memory private content; already-dispatched saves remain
bound to the original account slot and cannot update the replacement UI.

`npm run typecheck`, `scripts/test-inbox-cloud-flow.mjs`, and the rendered
`scripts/test-inbox-drafts-browser.mjs` passed locally. The rendered fixture used
fresh Vite on port 5297 and synthetic Cloud/storage boundaries: compose, explicit
save, page reload/restore/exact multiline bytes, account isolation, discard
cancel/confirm, exact reply IDs, storage failure/retry, stale-window CAS rejection,
and delayed save after Cloud account replacement. It exercises the production
composer and adapter, but does not establish Android encryption or real Gmail.
The fixture implements only account/search/read provider methods; no provider
write operation exists in its transport.

Run the rendered script with `ALPHA_INBOX_TEST_URL` set to a dedicated local Vite
origin and `ALPHA_BROWSER_MODULES` pointing to the available Playwright modules.

`ConnectionInstrumentedTest` now has two methods. The new
`localDraftCompareExchangePreservesNewerEditsAndEncryptedRecreation` exercises the
real Capacitor bridge, no-backup ciphertext, Activity recreation, exact restored
bytes, stale save/delete conflicts, malformed input and credential-namespace
rejection, then removes only its unique fixture slot. It requires no new runner
arguments. The parent owns compilation and both-variant device execution; these
native results are pending at source freeze. A full Android Inbox compose flow
with verified synthetic Cloud identity and an OS process restart is still an
acceptance gap; browser reload and Activity recreation are distinct evidence.

## Build 68 native process fixture (source; execution pending)

`InboxFixtureRunner`, `InboxFixtureActivity`, and `InboxFixtureConnection` live
only in `androidTest`. A separately declared instrumentation runner substitutes
a MainActivity subclass which replaces the AlphaConnection registration before
Bridge/WebView creation. Its transport recognizes only fixed synthetic staging
CLI-login, identity, empty agent list, and Gmail account/search/read responses;
it never opens a network connection and rejects every other URL. Secure storage
calls delegate to an actual AlphaConnectionPlugin with the same target-app
Bridge, Keystore, no-backup files and CAS. The production class remains final and
has no new fixture fields or authentication switches.

`InboxDraftInstrumentedTest#processPhase` is explicitly gated to that runner.
Prepare refuses preexisting staging credentials or a nonempty run-UUID draft
slot, backs up only the two connection selector keys, signs in through the real
staging chooser/Cloud protocol, then composes and saves through actual Inbox
controls. Restore requires a different Android PID, restores exact multiline
text, tests discard cancel/commit, saves a reply with exact source IDs, and opens
a second account's empty composer without changing the first account's draft.
Cleanup closes all fixture transport, removes only the verified synthetic token
and exact run-owned draft slot, and restores the selector keys. No account names,
private message data or credentials are written to host logs.

Parent-owned invocation, once both APKs are archived:

```
ANDROID_SERIAL=emulator-5554 node scripts/test-inbox-native-restart.mjs \
  test-results/prototype-build68/standalone-debug.apk \
  test-results/prototype-build68/standalone-androidTest.apk \
  test-results/prototype-build68/inbox-standalone
```

Repeat with the matching launcher pair. The runner requires both APK hashes to
match the same archive's flat `apk-manifest.json`, installs that pair, invokes
prepare, force-stops the target app, invokes restore, and always attempts isolated
cleanup. It records phase logs, PIDs and artifact hashes. A passing result is
native UI/storage/process evidence against a synthetic transport, not real Cloud
login, TLS, Gmail delivery or user acceptance. Syntax/source review alone is not
a passing native result; parent compilation/device results are still pending.

### Build 69 registration correction

Build 68's native attempt stopped before any test: the packaged test manifest
contained only AndroidJUnitRunner, so the separately declared runner was not
registered. This is a failed harness attempt, not an Inbox flow result.

The corrected source retains the existing AndroidJUnitRunner and every existing
runner invocation. AndroidX MonitoringInstrumentation (its superclass) already
provides `interceptActivityUsing(InterceptingActivityFactory)`; inspected local
monitor 1.8.0 bytecode confirms its `newActivity` invokes that factory before
Activity construction. The gated test installs the factory in `@Before`, before
starting MainActivity; the same test-only Activity/closed transport substitute
therefore still precedes WebView creation. `@After` finishes the fixture Activity
and restores the default factory. No Gradle runner setting, production manifest,
production authentication code or ordinary test helper changes are required.
The unsupported extra manifest entry and custom runner class are removed;
`InboxFixtureScope` contains only the explicitly validated phase/run UUID.
The host script now invokes the registered AndroidJUnitRunner. Rebuild and real
both-variant phase execution are required before this can count as passing.

## Build 69 native acceptance — completed scoped flow

Both distributions now pass all three phases against the immutable configured
Build69 archive at source fingerprint
`7c4f12ac2cc9c6606183a40a9518dd57c6d2b128a0f712b4f528a8c4d5e1750e`.
The [APK manifest](../test-results/prototype-build69/apk-manifest.json) binds the
app and instrumentation hashes; phase logs accompany each result:

| Distribution | Exact result path | Prepare → restore → cleanup PID | Result |
| --- | --- | --- | --- |
| Standalone | [test-results/prototype-build69/inbox-standalone/result.json](../test-results/prototype-build69/inbox-standalone/result.json) | 29290 → 29414 → 29521 | All phases passed |
| Launcher | [test-results/prototype-build69/inbox-launcher/result.json](../test-results/prototype-build69/inbox-launcher/result.json) | 29651 → 29766 → 29872 | All phases passed |

The actual Inbox UI saved encrypted local drafts, restored exact multiline text
in a new Android process, preserved exact reply message/thread identity, isolated
accounts, confirmed discard and completed scoped fixture cleanup. Storage used
the real native Keystore/AtomicFile/CAS implementation. Authentication and Gmail
responses came from the closed test-only protocol; no provider HTTP request,
real Gmail login, provider draft mutation or mail send occurred. This closes the
native local-draft process-restart gap identified above, not production email
acceptance. Build68's registration failure remains historical evidence.

The Build69 **unconfigured-Maps full native suite is still running** at this
update. These focused results must not be presented as full-suite, physical
phone, complete AOSP-image or complete-product acceptance. Evidence directories
are local ignored artifacts, not committed release packages.
