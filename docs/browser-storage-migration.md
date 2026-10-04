# Browser document migration

The browser MVP must retain every committed change and its matching receipt across
tabs, reload and cancellation. Web Locks around localStorage do not establish that
property: the retained rapid-edit regression reproduced a lost WebKit update.
The browser document store admitted from upstream uses IndexedDB transactions and
revision compare-and-swap. Alpha supplies domain names and legacy recovery policy.

## Domain status

| Domain | Source integration | Qualification / remaining work |
| --- | --- | --- |
| Calendar | `browser/calendar-store.ts`; async Calendar and digest reads; revision-checked backup/reset; cross-tab refresh | Original creation race passed 30 cases; cancellation passed 9 three-engine cases. Combined Calendar suite remains under qualification. |
| Hosted digest result notices | `browser/hosted-results.ts`; durable rows and pending-tap token move together; cross-tab notice invalidation | Candidate implementation; current three-engine notice flows and failed IndexedDB writes under test. |
| Owner-bound workflow drafts | `browser/workflow-drafts.ts`; awaited reads and serialized expected-value updates | Candidate implementation; adds actual two-tab conflict and owner-change-during-read checks. |
| Reminders and alarms | `browser/daily.ts`, `browser/clock.ts` | Legacy. Migrate records and operation receipts together; update Clock invalidation and permission reads. |
| Notification policy, access and history | `browser/notifications.ts` | Legacy. Reconcile initialization from the older policy key, shade queries, recovery/download and synchronous consumers. |
| Workflow notifications | `browser/workflow-notices.ts`, `browser/workflow-history.ts` | Legacy. Async history/list/export, retention/compaction receipts and interrupted delivery must move together. |
| Development agent conversations/actions | `browser/development-connection.ts`, `browser/development-actions.ts` | Legacy. Migrate owner-specific conversations, proposal admission and action receipts; preserve selection fencing across awaits. |
| Development workflows and digests | `browser/development-workflows.ts`, `browser/development-digests.ts`, `browser/digest-storage.ts` | Legacy. Workflow/run/save receipts and source/result cursors must move as coherent documents. Direct configured-agent reads also require migration. |
| Development Cloud setup | `browser/development-cloud.ts` | Legacy. Account/session identity and setup state have synchronous callers and explicit recovery behavior. |
| Device preferences and roles | `browser/device.ts` | Legacy. Brightness, volume, focus and display consumers currently read synchronously; move hydration and refresh before replacing persistence. |
| Browser bookmarks, development password provider and camera preferences | `browser/browser-surface.ts`, `browser/password-provider.ts`, `prototype/browser-camera.ts` | Legacy. Migrate all direct readers/writers and UI initialization, preserving native boundaries. |

This table covers the shared `readStore`/`editStore` callers, not every localStorage
key. Connection selection, prototype state and independent security/operation
stores require their own ownership and synchronization audit. Do not change a
writer while leaving its synchronous reader pointed at legacy bytes. Never add a
writable localStorage mirror to make old fixtures pass.

## Migration invariants

- Preserve the exact legacy bytes, including malformed or empty values. Never
  reinterpret corrupt data as an empty domain or overwrite it on startup.
- Opening an empty domain must not persist a fabricated initial document.
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
