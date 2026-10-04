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

The [browser storage migration map](browser-storage-migration.md) records the
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
