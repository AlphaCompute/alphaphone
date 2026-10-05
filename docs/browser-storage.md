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
| Reminders and alarms | Candidate `browser/reminder-store.ts`; `browser/daily.ts` readers, writes and operation receipts; Calendar/Clock cross-tab refresh; shared backup/reset UI | In development. Empty and unchanged polling no longer creates document revisions. Migration/recovery passes in all three browser engines; the wider integration campaign remains in progress. Alert-sound history remains a separate legacy document. |
| Notification policy, access and history | Candidate `browser/notification-store.ts`; policy, device events and redacted history migrate together; reminder delivery and workflow-focus epoch readers await canonical policy | Preserves the active v2 or older partial v1 source for backup/reset. Unchanged reads retain authority and document revision. Initial Chromium migration checks pass; combined three-engine and repository qualification is running. External/focus action cancellation and incoming-call retirement have new regression coverage. |
| Workflow notifications | `browser/workflow-notices.ts`, `browser/workflow-history.ts`; async canonical list/history/export and transactional delivery/compaction receipts | Owning history, lifecycle and receipt suites cover stale compaction (including identical-byte restoration), cancellation, concurrent publication and canonical/changed-legacy backups. Changed workflow callers have integration coverage; current-source hosted and engine qualification remain separate gates. |
| Development agent conversations/actions | `browser/development-connection.ts`, `browser/development-actions.ts` | Legacy. Migrate owner-specific conversations, proposal admission and action receipts; preserve selection fencing across awaits. |
| Development workflows and digests | `browser/development-workflows.ts`, `browser/development-digests.ts`, `browser/digest-storage.ts` | Legacy. Workflow/run/save receipts and source/result cursors must move as coherent documents. Direct configured-agent reads also require migration. |
| Development Cloud setup | `browser/development-cloud.ts` | Legacy. Account/session identity and setup state have synchronous callers and explicit recovery behavior. |
| Device preferences and roles | `browser/device.ts` | Legacy. Brightness, volume, focus and display consumers currently read synchronously; move hydration and refresh before replacing persistence. |
| Browser bookmarks, development password provider and photo albums | `browser/browser-surface.ts`, `browser/password-provider.ts`, `prototype/browser-camera.ts` | Legacy. Migrate all direct readers/writers and UI initialization, preserving native boundaries. `alpha.browser.albums.v1` contains album names and media membership; photo/video payloads already use their separate IndexedDB store. |

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

The notification permission follow-up at `1afb9368` passes 336 repository tests (zero skips), TypeScript/build, 21 focused cases across all three browser engines, and nine affected automatic-speech cases. The earlier `ecbe64bc` campaign ended with 306 passes and six failures: three destination-save fixture failures subsequently corrected and three Firefox speech timeouts whose owning cases now pass. The intermediate `84884309` campaign retained four Firefox timeouts; capacity, reload/open and the corrected delayed-read gate subsequently pass in the 21-case follow-up at unchanged deadlines. These results do not qualify other storage domains or the whole MVP.

At `98dc236f`, reminder migration and shared Calendar/reminder recovery pass 63 focused browser cases across Chromium, Firefox and WebKit, plus 336 repository tests (zero skips), TypeScript and build. Recovery now aborts pending capture/reset on device-state changes and incoming calls; eight Chromium regression cases failed before the fix. The wider 660-case reminder integration campaign remains pending at `84f3d23b`. Twelve separate host-journal recovery cases passed at `7dd6bdc1`, whose production source matches `84f3d23b`; regular browser profiles intentionally skip those host-only cases.

The notification migration candidate at `0db023fc` is in PR #222, stacked on reminder PR #220. Its initial `7c332023` source passed TypeScript and 29 Chromium cases. Six external-notification before/after-commit lifecycle regressions failed before the follow-up fix. The 237-case combined browser campaign and repository verification are pending; this is not a terminal qualification claim. Calendar alert routing and hosted-result tap cancellation were reproduced in 12 failing Chromium regressions and fixed in `7be4fa89`; their replacement combined qualification is pending.

The `0db023fc` notification candidate passed 336 repository tests with zero skips and TypeScript/build. Its 237-case browser campaign was deliberately stopped after three recording cases hit the same initial connection-chooser setup failure; it was not a passing campaign. `7be4fa89` makes that setup explicit, fences Calendar/hosted taps, and moves Calendar dismissal before navigation. Repository verification followed by one combined browser batch is running in a separate checkout. The unchanged `84f3d23b` reminder campaign continues independently and has reported Firefox timeouts; its final outcome remains pending.
