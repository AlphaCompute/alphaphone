# Browser implementation review

The product renderer lives in `apps/app`; shared platform code comes from the
reviewed `vendor/eliza` pin. The primary agent runs on Android, with a local host
for browser development. Hosted inference is separate from local orchestration.
See [architecture](architecture.md), [MVP scope](mvp-scope-and-gap-report.md) and
[current requirement status](mvp-current-status.md) for product boundaries.

This inventory describes available behavior and remaining qualification. It is
not a claim that every feature or the current main revision has passed acceptance.

## Surface inventory

| Surface | Implementation | Remaining acceptance |
| --- | --- | --- |
| Home and settings | Product-owned preview, themes, assistant dock, agenda, device development controls | Native boot, lock, HOME role and actual system controls |
| Connection and assistant | Resident/native IPC, local development host, optional Cloud/remote sessions, conversation history, reviewed proposals and receipts | Real owner/provider authorization, revoke, process recovery and complete task journeys |
| Voice | Recording review, manual transcript fallback, explicit local/agent routes, owned playback and cancellation | Transcript quality, six-second latency target, physical microphone/speaker/Bluetooth and lifecycle |
| Inbox | Account-bound Gmail adapter and operation journal; disclosed local draft/attachment simulator | Real provider grants, approved read/send journeys, account isolation and uncertain-outcome recovery |
| Calendar | Persistent events, zoned/all-day dates, recurring series and overrides, preferences, local guest/meeting UI, alerts, backup and reviewed reset | Transactional storage below; salvage/import, live-agent series, real invitations/conferencing and provider sync |
| Reminders and Clock | Shared native reminder engine, browser reminders, Done/Snooze/repeats, foreground alarm ownership and native Clock handoff | Physical audibility, Doze/OEM delivery, reboot, DND and hardware time-zone changes |
| Browser | Development iframe, bookmarks, navigation, reviewed reading; isolated native browser surface | Cross-origin access limits, real password-provider/passkey/autofill behavior and release WebView lifecycle |
| Camera and Scan | Capture/import, local OCR, reviewed text/links/calendar suggestions, multipage drafts, perspective correction, page-edge suggestions and searchable PDF | Physical camera/torch/permissions, OCR language/photo quality, edge quality and interrupted capture |
| Photos | IndexedDB library, stable pagination, albums, batch actions, edit-as-copy and video editing | Physical capture, external providers, catalog scale and interrupted saves; clearing site data removes browser media |
| Notes and Files | Browser-local text/audio/documents, reviewed selected content, exact-byte import/export; native secure Notes and SAF | Native provider differences, interrupted writes, cross-app attachments and physical audio; no Notes sync is promised |
| Workflows and digests | Authoring, approval, cancellation, receipts/results, schedules and reviewed upstream worker/runtime | Current-source resident scheduling, interruption/restart, result delivery and real account sources; a powered-off phone cannot execute locally |
| Notifications | Owner-bound notices, receipt recovery and Calendar/reminder integration | Current-source native background/channel behavior and physical delivery |
| Phone/SMS/Contacts and Wallet | Disabled shipping routes; explicit development simulation | Scope disposition before enabling production routes; simulations do not establish telecom, payment or external-message acceptance |

## Calendar storage

Calendar uses the reviewed upstream `BrowserDocumentStore` for IndexedDB
transactions, revision-bound replacements and reset tombstones. The previous
localStorage/Web Locks implementation could admit competing creations in Firefox;
lock ownership alone did not make a tab's storage snapshot current. The
[Web Storage standard](https://html.spec.whatwg.org/multipage/webstorage.html)
does not define cross-agent-cluster synchronization.

The product imports an existing Calendar document once and retains the original
localStorage bytes together with the imported baseline in document metadata. Subsequent edits, receipts, digest reads, backups and resets
use the IndexedDB document; there is no writable localStorage mirror. Close older
app tabs when updating: their writes to the retired store are not merged into the
new document. An observed change to that older copy stops normal access and offers
both versions for backup in recovery. Legacy snapshot checks are not transactions. Browser data remains local and unencrypted, and clearing site data
removes it.

A reset compares the reviewed revision and preserves a tombstone so reload cannot
restore the old document or authorize an old proposal. Invalid JSON remains
exportable. Failed transactions retain the saved document. Queued reads and edits
must preserve cancellation and navigation ownership; no late read may open a
retired editor or agent review.

The owning tests are `calendar-creation-recovery.spec.ts`,
`calendar-storage-migration.spec.ts` and `calendar-recovery.spec.ts`, alongside
Calendar, digest and cross-tab browser journeys. Preparation-time cancellation is
covered by `calendar-agent-transaction-cancel.spec.ts` and
`calendar-transaction-cancel.spec.ts`; `test/domain-document.test.mjs` covers the
product import and recovery policy. Other browser domains still use
`browser/store.ts` and require their own transactional-storage audit and migration;
Calendar qualification does not prove those domains safe.

The [browser storage ownership map](browser-storage.md) records the
remaining domains and their required reader, writer and recovery changes.

## Design and accessibility

Keep Alpha's product identity, light/dark tokens, display/text typography, phone
geometry and icons independent of the upstream app UI. The supplied references
remain requirements data, including deferred states; they do not authorize
activating disabled routes.

Review compact portrait/landscape layouts, large text, keyboard focus, scrolling,
visible save/cancel controls and assistant-toolbar clearance. Calendar draft
controls have a named focusable Event details region and 52 CSS-pixel minimum
control height; rendered targets must remain at least 44 pixels in the fitted
preview. Save and Back must stay reachable while fields scroll. Preserve empty,
loading, unavailable, failed and uncertain-write states as distinct outcomes.

## Qualification and evidence

Run `npm run verify` and the owning Playwright cases for changed browser paths.
The suite can select Chromium, Firefox or WebKit with `--browser`; use explicit
fixture profiles and inspect relevant screenshots. Preserve terminal failures and
source identities alongside results in `test-results/`. A passing focused run
does not replace full current-source hosted qualification.

APK assembly, emulator bridge/HOME tests, full AOSP image boots, real provider
integrations, physical-device behavior and user acceptance are separate gates.
Both standalone and launcher distributions require qualification. Do not infer
physical capture, speech quality, external delivery or provider consent from
synthetic browser fixtures.

Current operating guides and requirements:

- [Browser development capabilities](browser-dev-parity.md) and [native method inventory](browser-native-method-inventory.md)
- [Local agent setup](local-agent-development.md) and [resident execution plan](on-device-agent-plan.md)
- [Calendar/reminder audit](calendar-reminder-audit.md) and [regional Maps setup](maps-regional-validation.md)
- [Local OCR](local-ocr.md), [browser autofill](browser-autofill-integration.md) and [Notes documents](notes-document-flows.md)
- [MVP completion plan](mvp-completion-plan.md), [scope and gaps](mvp-scope-and-gap-report.md) and [pilot acceptance](pilot-acceptance-runbook.md)

Production provider/TLS/data-license/coverage checks, release signing and rollback,
four physical units and user acceptance remain explicit gates. Offline-LLM and
Telegram/Discord scope conflicts require product disposition. Historical build
counts, source migrations and failed-attempt narratives are available in Git
history rather than serving as current setup instructions.

## Development digest inbox follow-up

The development inbox now stores its result index, saved result slots and pending
request record in one account-scoped browser document. Reads and expected-value
updates share that document. Existing localStorage slot bytes remain untouched and
are preserved verbatim as string values in the migration archive; an observed
older-copy change refuses access. Connection retirement is checked after reads
and supplies cancellation to document operations.

Scheduled digests exposes a development inbox recovery dialog with an archive
backup and revision-checked reset. Reset clears local delivery/recovery records,
not agent schedules; the dialog explicitly warns users to reconcile uncertain
requests before creating replacements. A reset tombstone prevents older data
from returning. This migration does not move the separate development scheduler,
workflow execution, source-grant or configured-agent stores.

TypeScript passes. The prepared sequential qualification contains 66 cases across
Chromium, Firefox and WebKit: inbox migration/recovery plus the existing digest
storage, schedule, live-source and delegation journeys. The earlier combined
storage campaign remains live at c1f21e71; no terminal browser result is claimed
for either campaign here. Android builds remain excluded by the requested scope.

## Development conversation follow-up

Development conversations, scripted replies and message replay receipts now use
one document per profile/account. Conversation reads, configured workflow drafts
and digest generation all await the canonical document. Message pairs and their
replay receipt commit together. A full conversation refuses another pair before
exceeding the retained-message limit. The connection editor disables reply edits
while loading and discards reads retired by profile/account changes or closing.
Its Agent history recovery control remains available when data is malformed and
provides exact-byte backup plus revision-checked reset. This does not migrate or
reset the real local-agent host database, workflow execution or action journals.

The combined campaign at c1f21e71 remains running. Its Chromium location ownership
fixture failed with `callbacks[1] is not a function`: the fixture assumed both
permission requests synchronously created watches before cancellation. The
follow-up waits for both watches, then keeps the original independent ownership
and clear-watch assertions. The frozen campaign source and trace are retained.

The next sequential batch now includes 525 cases across three engines, combining
the digest inbox cases, new conversation migration cases, existing connection,
Cloud identity, content/search question, workflow authoring/phone/presentation
journeys, and device/location cases. TypeScript passes for the implementation;
this batch has been enumerated but has not yet run. No terminal qualification is
claimed for these candidates.

## Atomic import integration

PR231's atomic first-import fix is reconciled with the inbox and conversation
migrations. Its reviewed upstream pin is
`1e4c41d3f58d1f510434bd4b8e482e797eb64f7d`; the upstream delta from the prior
pin is confined to document-store initialization, its browser regressions and
API documentation. Concurrent import now preserves the existing revision and
coordinates with a pending asynchronous editor. The duplicate location fixture
fix is resolved using the explicit second-watch admission signal.

TypeScript passes for the reconciled source. The prepared next batch is expanded
to 525 three-engine cases including first import, notification/provider/album/
preference recovery and compact controls. The running c1f21e71 campaign remains
frozen at its prior pin and does not qualify this integration. Its observed
location fixture failure is retained in the campaign log and trace. No Android
build was run by this review.

## Shared development execution state

Development workflow definitions, runs, mutation receipts, phone proposals and
action journals now share one account-scoped document. Workflow admission reads
both parts from its transaction snapshot; advancing a waiting run reads its
proposal from that same snapshot. The protocol keeps its outer admission lock,
while the document store serializes all journal and workflow edits. This avoids
nested document locks and preserves independent updates to either part.

Old-account journals remain bound to their captured namespace so an already
started action can record a terminal receipt after account retirement. New
reservations and transitions into applying require the current selected identity.
Workflow edits recheck selection after asynchronous model-reply reads before
committing. Recovery downloads exact older action/workflow bytes in an archive
and resets both parts together. Its disclosure requires reconciliation of
uncertain actions first and states that reset does not undo effects. Real runtime
state and development scheduled-digest execution remain separate domains.

TypeScript passes. Eight new cases cover empty reads, concurrent workflow/action
creation, write rollback, exact legacy preservation, retired-account admission,
stale resets, joint recovery and retirement during an asynchronous run. Existing
proposal, execution, generation and receipt fixtures now read canonical documents
and inject IndexedDB failures. The next sequential browser campaign now contains
633 cases in 27 files across three engines, superseding the earlier pending batch
sizes. It remains unrun while the frozen c1f21e71 campaign continues. This is not a
claim of full MVP, hosted, native or real-provider qualification.
