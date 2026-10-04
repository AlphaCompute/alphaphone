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
| Calendar | Persistent events, zoned/all-day dates, recurring series and overrides, preferences, local guest/meeting UI, alerts, backup and reviewed reset | Transactional migration qualification below; salvage/import, live-agent series, real invitations/conferencing and provider sync |
| Reminders and Clock | Shared native reminder engine, browser reminders, Done/Snooze/repeats, foreground alarm ownership and native Clock handoff | Physical audibility, Doze/OEM delivery, reboot, DND and hardware time-zone changes |
| Browser | Development iframe, bookmarks, navigation, reviewed reading; isolated native browser surface | Cross-origin access limits, real password-provider/passkey/autofill behavior and release WebView lifecycle |
| Camera and Scan | Capture/import, local OCR, reviewed text/links/calendar suggestions, multipage drafts, perspective correction, page-edge suggestions and searchable PDF | Physical camera/torch/permissions, OCR language/photo quality, edge quality and interrupted capture |
| Photos | IndexedDB library, stable pagination, albums, batch actions, edit-as-copy and video editing | Physical capture, external providers, catalog scale and interrupted saves; clearing site data removes browser media |
| Notes and Files | Browser-local text/audio/documents, reviewed selected content, exact-byte import/export; native secure Notes and SAF | Native provider differences, interrupted writes, cross-app attachments and physical audio; no Notes sync is promised |
| Workflows and digests | Authoring, approval, cancellation, receipts/results, schedules and reviewed upstream worker/runtime | Current-source resident scheduling, interruption/restart, result delivery and real account sources; a powered-off phone cannot execute locally |
| Notifications | Owner-bound notices, receipt recovery and Calendar/reminder integration | Current-source native background/channel behavior and physical delivery |
| Phone/SMS/Contacts and Wallet | Disabled shipping routes; explicit development simulation | Scope disposition before enabling production routes; simulations do not establish telecom, payment or external-message acceptance |

## Cross-tab Calendar storage repair

`test/browser/calendar-creation-recovery.spec.ts`, “different tabs cannot silently
bypass a pending creation”, intermittently returns two `saved` results in Firefox
where one must be `pending-creation`. This was found in the Calendar layout review
and reproduced on merged main `cfbbe52`: 10 of 25 repeated Firefox cases failed
(`test-results/calendar-race-before/`). The affected adapter
uses `apps/app/src/browser/store.ts`: a Web Lock surrounds a localStorage
read/edit/write. The exact cause is still under investigation; do not replace the
assertion with a retry or accept two successful creations.

Storage sequencing must be qualified across browser processes, alongside receipt
identity, lost-response recovery, reload, cancellation and failed writes. Other
browser domains use the same helper, so any shared repair needs their coverage.
The Web Storage specification does not define cross-agent-cluster synchronization;
a Web Lock alone must not be treated as evidence of transactional persistence.
See the [Web Storage standard](https://html.spec.whatwg.org/multipage/webstorage.html)
and [Mozilla's snapshot-coherence discussion](https://bugzilla.mozilla.org/show_bug.cgi?id=1740144).

### Transactional repair and migration

[Eliza PR33568](https://github.com/elizaOS/eliza/pull/33568) is merged. Its
IndexedDB document API commits bytes and revision receipts together, rejects
stale compare-and-swap, retains reset tombstones and cancels asynchronous editors
without replaying them. The final shared implementation passes all three browser
engines (200 retained concurrent edits and unique receipts per engine), UI
typecheck and full upstream verification. A resident-source backport preserves
Alpha's current native reminder/runtime source; its qualification is recorded below.

Alpha's `BrowserDomainDocument` policy preserves exact legacy bytes, refuses
observed legacy changes, exposes unreadable data for backup and prevents reset
data from being reimported. Calendar now uses the document API for reads, writes,
recovery and digest inputs, with cross-tab refresh through BroadcastChannel.
Opening an empty calendar does not invent a persisted document. The original
creation-race regression passed 30 repetitions across Chromium, Firefox and
WebKit. Ten migration-policy tests and 326 repository tests passed at the first
integration checkpoint, including TypeScript and the production web build.

The integration review also found cancellation between preparing an edit and
committing its transaction. Event and guest-response editors, plus agent cancellation, now propagate their
lifetime to storage with AbortSignal. All nine cancellation cases pass across the three engines. The focused migration
batch passed 72 cases; three event-editor cases stopped at an outdated test label,
which is corrected and passes in the cancellation rerun. The full Calendar suite
is pending; original failures are retained in `test-results/transactions/`. Fixtures now inspect canonical IndexedDB documents
and inject actual IndexedDB write failures rather than modifying legacy storage.

The resident-source backport is merged as
[Eliza PR33575](https://github.com/elizaOS/eliza/pull/33575); its exact head
`50ef4984fedadae8f544103c63c27d434a4a945f` passes all 298 upstream verification
tasks and preserves the admitted native reminder/runtime source.

Other domains still use the old storage helper and remain in scope. The global
rapid-edit regression is retained; Calendar qualification does not establish
that those domains are fixed. A timer-only candidate was rejected after WebKit
lost an update. Old tabs must be closed for migration; legacy snapshot checks
are not transactions. Recovery retains the exact older copy and requires review
before resetting the canonical document.

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
