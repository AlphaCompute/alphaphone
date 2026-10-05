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
| Development agent conversations | `browser/development-agent-document.ts`; conversations, scripted replies and message receipts migrate together; protocol, workflow and digest consumers await canonical reads; selected-profile backup/reset | Implementation candidate. TypeScript passes. Queued account changes, Home cancellation, two-tab messages, receipt rollback and malformed backup/reset are prepared for the next browser batch. Real local-agent host data uses its separate runtime store. |
| Development action proposals and receipts | `browser/development-actions.ts` | Legacy. Migrate proposal admission and action receipts together while preserving old-owner journal completion after account retirement. |
| Development workflows and digest execution | `browser/development-workflows.ts`, `browser/development-digests.ts` | Legacy. Workflow/run/save receipts and source/result cursors must move as coherent documents. Configured-agent replies now use the separate canonical conversation document; execution state still needs migration. |
| Development digest inbox | `browser/digest-storage.ts`; one account-scoped document containing the result index, saved results and pending request slots; selected-inbox backup/reset in Scheduled digests | Implementation candidate. Exact older slot bytes are retained inside a JSON archive. Expected-value writes remain serialized; late reads and recovery are bound to the connection. TypeScript passes; The 66 inbox, live-source, schedule and delegation cases are included in the next 270-case combined development-storage and location campaign. No browser pass claimed yet. |
| Development Cloud setup | `browser/development-cloud.ts` | Legacy. Account/session identity and setup state have synchronous callers and explicit recovery behavior. |
| Device preferences and roles | `browser/device-preferences.ts`, `browser/device.ts`; canonical writes/readback, ordered cache hydration for synchronous rendering/audio, asynchronous sensor admission and role documents | Implementation candidate. Unavailable settings keep recovery reachable, mute audio and disable sensor access. Pending settings and location reads preserve cancellation; three-engine device/workflow integration and repository qualification remain pending. |
| Browser bookmarks and notification sound history | `browser/preference-documents.ts`; awaited bookmark reads/writes, cross-tab bookmark refresh and transactional sound claims; separate backup/reset controls | Merged in PR224 at source e9a421f5. All 57 Clock/storage cases pass across Chromium, Firefox and WebKit; repository verification passes 336 tests, TypeScript and web build at recorded upstream pin 8f28122d. Hosted qualification remains separate. Empty reads and unchanged sound polling do not initialize records; older bytes remain available for backup. |
| Development password provider | `browser/password-provider.ts`, `browser/preference-documents.ts`; asynchronous device status, canonical provider selection, cross-tab retirement and backup/reset | Implementation candidate. Pending dialog reads and sample-fill reads retain cancellation ownership. TypeScript passes; The initial 36-case run had 35 passes and one delayed-read fixture timeout; the corrected fixture and compact layouts produced 27 observed passes and four Firefox setup failures before deliberate termination. Consolidated qualification remains pending. This is the development sample provider, not real Proton credentials or native autofill acceptance. |
| Photo albums | `prototype/browser-camera.ts`, `browser/preference-documents.ts`; canonical album names/membership and revision checks, cross-tab catalogue refresh, exact-byte backup/reset | Implementation candidate, qualification pending. Saved media remains in its existing IndexedDB database; album reset does not delete photos/videos. Album metadata and media bytes are separate transaction domains. `alpha.browser.albums.v1` holds album names and media membership; photo/video payloads already use a separate IndexedDB store. |

This table covers the shared `readStore`/`editStore` callers, not every localStorage
key. Connection selection, prototype state and independent security/operation
stores require their own ownership and synchronization audit. Do not change a
writer while leaving its synchronous reader pointed at legacy bytes. Never add a
writable localStorage mirror to make old fixtures pass.

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
