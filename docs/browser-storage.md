# Browser storage

The browser MVP must retain every committed change and its matching receipt across
tabs, reload and cancellation. Web Locks around localStorage do not establish that
property: the retained rapid-edit regression reproduced a lost WebKit update.
The browser document store admitted from upstream uses IndexedDB transactions and
revision compare-and-swap. Alpha supplies domain names and legacy recovery policy.

## Domain status

| Domain | Source integration | Qualification / remaining work |
| --- | --- | --- |
| Calendar | `browser/calendar-store.ts`; async Calendar and digest reads; revision-checked backup/reset; cross-tab refresh | Creation/recovery, queued-read cancellation, transaction abort and stable-read-revision browser suites; domain import/recovery unit tests. |
| Hosted digest result notices | `browser/hosted-results.ts`; durable rows and pending-tap token move together; cross-tab notice invalidation | Hosted-result browser suite covers notice flows, duplicate publication, pending taps and failed IndexedDB writes. |
| Owner-bound workflow drafts | `browser/workflow-drafts.ts`; awaited reads and serialized expected-value updates | Workflow-authoring browser suite covers two-tab conflicts and owner changes during pending reads. |
| Reminders and alarms | `browser/reminder-store.ts`; `browser/daily.ts` readers, writes and operation receipts; Calendar/Clock cross-tab refresh; shared backup/reset UI | Empty and unchanged polling retains document revisions. Owning Chromium and Firefox suites cover concurrent writes, atomic receipts, stale resets and interrupted recovery. Alert-sound history has its own migration and recovery boundary below. |
| Notification policy, access and history | `browser/notification-store.ts`; policy, device events and redacted history migrate together; reminder delivery and workflow-focus epoch readers await canonical policy | Preserves the active v2 or older partial v1 source for backup/reset. Unchanged reads retain authority and document revision. First reads serialize initialization across tabs. Chromium and Firefox suites cover concurrent initialization, backup/reset, failed writes, and external/focus/Calendar/hosted-result cancellation before and after commit. |
| Workflow notifications | `browser/workflow-notices.ts`, `browser/workflow-history.ts`; async canonical list/history/export and transactional delivery/compaction receipts | Owning history, lifecycle and receipt suites cover stale compaction (including identical-byte restoration), cancellation, concurrent publication and canonical/changed-legacy backups. Changed workflow callers have integration coverage; current-source hosted and engine qualification remain separate gates. |
| Development agent conversations/actions | `browser/development-connection.ts`, `browser/development-actions.ts` | Legacy. Migrate owner-specific conversations, proposal admission and action receipts; preserve selection fencing across awaits. |
| Development workflows and digests | `browser/development-workflows.ts`, `browser/development-digests.ts`, `browser/digest-storage.ts` | Legacy. Workflow/run/save receipts and source/result cursors must move as coherent documents. Direct configured-agent reads also require migration. |
| Development Cloud setup | `browser/development-cloud.ts` | Legacy. Account/session identity and setup state have synchronous callers and explicit recovery behavior. |
| Device preferences and roles | `browser/device-preferences.ts`, `browser/device.ts`; canonical writes/readback, ordered cache hydration for synchronous rendering/audio, asynchronous sensor admission and role documents | Merged to main in PR228 (`9adf615f`). Qualification pending: the consolidated Chromium/Firefox/WebKit device and workflow integration run and repository qualification on the merged head have not been recorded. Unavailable settings keep recovery reachable, mute audio and disable sensor access. Pending settings and location reads preserve cancellation. The development device controls that write these documents ship only in `ELIZA_DEV_ALLOW_TEST_MOCKS=1` builds. |
| Browser bookmarks and notification sound history | `browser/preference-documents.ts`; awaited bookmark reads/writes, cross-tab bookmark refresh and transactional sound claims; separate backup/reset controls | Merged in PR224 at source e9a421f5. All 57 Clock/storage cases pass across Chromium, Firefox and WebKit; repository verification passes 336 tests, TypeScript and web build at recorded upstream pin 8f28122d. Hosted qualification remains separate. Empty reads and unchanged sound polling do not initialize records; older bytes remain available for backup. |
| Development password provider | `browser/password-provider.ts`, `browser/preference-documents.ts`; asynchronous device status, canonical provider selection, cross-tab retirement and backup/reset | Merged to main in PR226 (`dae074d4`). Qualification pending: the last recorded run had one delayed-read fixture timeout (35 of 36) and a later partial run had four Firefox setup failures before deliberate termination; no consolidated three-engine pass is recorded. Pending dialog reads and sample-fill reads retain cancellation ownership. This is the development sample provider, present only in `ELIZA_DEV_ALLOW_TEST_MOCKS=1` builds; it is not real Proton credentials or native autofill acceptance. |
| Photo albums | `prototype/browser-camera.ts`, `browser/preference-documents.ts`; canonical album names/membership and revision checks, cross-tab catalogue refresh, exact-byte backup/reset | Merged to main in PR228 (`43812dd3`). Qualification pending: no three-engine album campaign on the merged head is recorded. `alpha.browser.albums.v1` holds album names and media membership; saved photo/video payloads remain in their separate IndexedDB store, so album metadata and media bytes are separate transaction domains and album reset does not delete media. |

This table covers the shared `readStore`/`editStore` callers. The raw-localStorage
key families outside that helper are audited below. Do not change a
writer while leaving its synchronous reader pointed at legacy bytes. Never add a
writable localStorage mirror to make old fixtures pass.

## Raw localStorage key audit

These keys are read and written with `localStorage` directly in the web build. On
Android, the reminder and note-audio families use the native secure store slot named in
the table instead. "Justified single writer" means one module owns every write, the value
is a small marker or selection whose loss fails closed, and no transactional coupling
with another domain is claimed. "Migration pending" means the family has coupled
readers or multi-tab writers and must move to the document store before browser
persistence is qualified.

| Key family | Owner | Writer | Readers | Disposition |
| --- | --- | --- | --- | --- |
| `alpha.workflow.pending.v1:[origin,owner,agent,workflow]` (run lock) | `prototype/workflow-adapter.ts` | Same module, before run submission; cleared after receipt reconciliation | Same module (`locked`) | Justified single writer: an owner-scoped outcome-unknown marker. A read failure is treated as locked, so automatic retry is refused. |
| `…:approval:<runId>` | `prototype/workflow-adapter.ts` | Same module, around approval decisions | Same module (`approvalLocked`) | Justified single writer; same fail-closed semantics. |
| `…:lifecycle` | `prototype/workflow-adapter.ts` | Same module, around remove/restore | Same module (`lifecycleLocked`, `pendingLifecycle` reconciliation on open) | Justified single writer; reconciliation reads the server before clearing. |
| `…:metadata` (edit pending) | `prototype/workflow-adapter.ts` | Same module, around name/description save | Same module (`metadataLocked`) | Justified single writer; a pending edit blocks another save until read-only reconciliation. |
| `alpha.photos.pending-copy.v1` (saved-copy edit pending) | `prototype/camera-adapter.ts` | Same module (set before save-as-copy, removed on reconciled completion) | Same module (edit admission and recovery) | Justified single writer: one token marks an unresolved saved copy; recovery inspects the library before clearing. |
| `alpha.browser.reminder-creations.v1` (Android: secure slot `reminder-creations:v1:device`) | `runtime/reminder-creations.ts` | Same module, compare-then-write under the Web Lock named by the key | `prototype/reminder-adapter.ts` through the module | Migration pending: the receipt is coupled to the reminder document but lives outside its transaction; the Web Lock does not establish cross-tab visibility. |
| `alpha.browser.reminder-deletions.v1` (Android: secure slot `reminder-deletions:v1:device`) | `runtime/reminder-deletions.ts` | Same module, compare-then-write under its Web Lock | `prototype/reminder-adapter.ts` through the module | Migration pending, for the same reason. |
| `alpha.browser.notes-audio-deletions.v1` (Android: secure slot `notes-audio-deletions:v1:device`) | `runtime/note-audio-deletions.ts` | Same module, under the `alpha.notes-audio-effects.v1` Web Lock | `prototype/voice-adapter.ts` through the module; reads `alphaphone:notes:v2` for readback | Migration pending: coupled to browser Notes bytes, which are themselves localStorage in the web build. |
| `alpha.connection.selection.v1` | `runtime/connection-ui.tsx` | `connection-ui.tsx` (chooser save/clear); with the switch off, startup rewrites a saved `{kind:'mock'}` to `{kind:'none'}` once | `main.tsx`, `prototype/agent-adapter.ts`, `prototype/voice-adapter.ts`, `prototype/workflow-authoring.ts`, `runtime/hosted-digest-ui.tsx`, `runtime/hosted-live-source-ui.tsx` and the development stores in `browser/` | Justified single writer for the product: a nonsecret selection; secrets stay in native secure storage. Development readers exist only in test-mocks builds. Readers re-check it after awaits. |
| `alpha.connection.conversations.v1` | `runtime/connection-ui.tsx` | Same module (conversation cache per target) | Same module | Justified single writer: a nonsecret cache of conversation IDs; a failed write is reported, and canonical history stays with the agent. |
| `alpha.connection.cloud-service.v1` | `runtime/connection-ui.tsx` | Same module (set on Cloud sign-in, removed on sign-out) | Same module | Justified single writer. With the switch off a stored `staging` value is treated as signed out. |
| `alpha.dev.app.<view>` (simulated apps) | `browser/simulated-apps.ts` | `browser/simulated-apps.ts` through its storage writer (development profile only); `browser/simulator-recovery.ts` resets a damaged record on explicit confirmation | `browser/simulator-recovery.ts` (load and validation), and direct raw reads in `browser/workflow-receipts.ts`, `workflow-focus.ts`, `workflow-trigger-runtime.ts`, `workflow-local-send.ts`, `workflow-messages.ts`, `workflow-dated-sources.ts`, `simulated-workflows.ts`, `focus-state.ts` and `digest-live-sources.ts` | Development-only, present only in `ELIZA_DEV_ALLOW_TEST_MOCKS=1` builds; the dev-surfaces gate keeps its modules out of distribution builds, so legacy values left by earlier builds are neither read nor shown. Verify on the merged head with the production browser lane. |
| `alphaphone:clock-handoff:v1` | `prototype/clock-adapter.ts` | Same module (opening, then result of the Android Clock handoff) | Same module (restores the last handoff status) | Justified single writer: a status note for the last reviewed handoff; Clock owns the alarm itself. |

## Storage and recovery rules

- Preserve the exact legacy bytes, including malformed or empty values. Never
  reinterpret corrupt data as an empty domain or overwrite it on startup.
- Storage reads must not invent domain records. Calendar may initialize its stable
  source identity without inventing events; digest reads do not initialize it.
- Close older app tabs before migration. A later observed legacy change refuses
  access and retains both versions; legacy snapshots are not transactional.
- Reset requires reviewed captured state and a current revision. Keep a canonical
  tombstone so the retained legacy backup cannot reappear as active data.
- Edit callbacks are not replayed. Cancellation before commit aborts the pending
  transaction; an already committed result retains its receipt.
- Recheck account and UI ownership after asynchronous reads. Cross-tab notices
  invalidate views without taking over an originating action's completion UI.
- Tests must inspect the canonical store and inject actual IndexedDB failures.
  Legacy initialization fixtures should seed once, preserving reload behavior.

## Completion evidence

Keep terminal results and failed reproductions, tied to source commits. Require
real multi-document concurrency, unique receipts, malformed-byte recovery,
write failure, tab death, stale reset and cancellation cases. Run the owning UI
journeys across Chromium, Firefox and WebKit, then repository verification and
current hosted checks. Passing Calendar alone does not close the retained global
rapid-store regression or qualify another domain. Browser evidence does not prove
Android process, Keystore, reboot, Doze or physical-device acceptance.

Current integration review passes 336 repository tests, TypeScript/web build,
81 Chromium cases and 57 Firefox cases, plus standalone and launcher debug/release
APK builds. The startup regressions first demonstrated 20 writes for 20 concurrent
policy reads; initialization now writes once. Hosted CI and broader three-engine
campaigns remain separate pending evidence. This review did not rerun emulator,
AOSP boot, live-provider or physical-device acceptance.
