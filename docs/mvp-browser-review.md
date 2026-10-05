# Browser implementation review

The product renderer lives in `apps/app`; shared platform code comes from the
reviewed `vendor/eliza` pin. The primary agent runs on Android, with a local host
for browser development. Hosted inference is separate from local orchestration.
See [architecture](architecture.md), [MVP scope](mvp-scope-and-gap-report.md) and
[current requirement status](mvp-current-status.md) for product boundaries.

This inventory describes available behavior and remaining qualification. It is
not a claim that every feature or the current main revision has passed acceptance.

## Local speech restart checkpoint — 2026-10-05

The browser dev launcher now reads owner-only `local-speech.json` defaults from
its private agent profile, so restarting without the original shell environment
retains the installed Whisper/Kokoro assets. Explicit environment overrides still
win. Unsupported settings, credentials, symlinks and shared-access files fail
closed; existing asset admission and cold-start warmup remain in place.

Qualified on consumer base `15f9338f` with upstream `95924e90`: all 631 repository
tests, type checking, production build and bundle audit passed. A plain `npm run
dev` cold process start reported Whisper and Kokoro ready. The actual browser
capture/transcription/synthesis journey passed in 15.3 seconds, including playback
completion, stop and disconnect. The owner, agent and 18 conversation IDs were
unchanged across that test. This is host/browser evidence; no Android build or
physical-device acceptance was performed for this change. See
[local development](local-agent-development.md) for persistent settings.

## Surface inventory

| Surface | Implementation | Remaining acceptance |
| --- | --- | --- |
| Home and settings | Product-owned preview, themes, assistant dock, agenda, device development controls | Native boot, lock, HOME role and actual system controls |
| Connection and assistant | Resident/native IPC, local development host, optional Cloud/remote sessions, conversation history, reviewed proposals and receipts | Real owner/provider authorization, revoke, process recovery and complete task journeys |
| Voice | Recording review, manual transcript fallback, explicit local/agent routes, owned playback and cancellation | Transcript quality, six-second latency target, physical microphone/speaker/Bluetooth and lifecycle |
| Inbox | Account-bound Gmail adapter and operation journal; disclosed local draft/attachment simulator | Real provider grants, approved read/send journeys, account isolation and uncertain-outcome recovery |
| Calendar | Persistent events, zoned/all-day dates, recurring series and overrides, preferences, local guest/meeting UI, alerts, backup and reviewed reset | Transactional storage below; partial-damage salvage, live-agent series, real invitations/conferencing and provider sync |
| Reminders and Clock | Shared native reminder engine, browser reminders, Done/Snooze/repeats, foreground alarm ownership and native Clock handoff | Physical audibility, Doze/OEM delivery, reboot, DND and hardware time-zone changes |
| Browser | Development iframe, bookmarks, navigation, reviewed reading; isolated native browser surface | Cross-origin access limits, real password-provider/passkey/autofill behavior and release WebView lifecycle |
| Camera and Scan | Capture/import, local OCR, reviewed text/links/calendar suggestions, multipage drafts, perspective correction, page-edge suggestions and searchable PDF | Physical camera/torch/permissions, OCR language/photo quality, edge quality and interrupted capture |
| Photos | IndexedDB library, stable pagination, albums, batch actions, edit-as-copy and video editing | Physical capture, external providers, catalog scale and interrupted saves; clearing site data removes browser media |
| Notes and Files | Browser-local text/audio/documents, reviewed selected content, exact-byte import/export; native secure Notes and SAF | Native provider differences, interrupted writes, cross-app attachments and physical audio; no Notes sync is promised |
| Workflows and digests | Authoring, approval, cancellation, receipts/results, schedules and reviewed upstream worker/runtime | Current-source resident scheduling, interruption/restart, result delivery and real account sources; a powered-off phone cannot execute locally |
| Notifications | Owner-bound notices, receipt recovery and Calendar/reminder integration | Current-source native background/channel behavior and physical delivery |
| Phone/SMS/Contacts and Wallet | Disabled shipping routes; explicit development simulation | Scope disposition before enabling production routes; simulations do not establish telecom, payment or external-message acceptance |

## Browser storage

The [storage ownership map](browser-storage.md) defines each canonical domain,
its recovery boundary, independent preference contracts and native
Clock handoff history. Shared IndexedDB
transactions bind changes to receipts and revisions. Initialization must use the
same serialization boundary as edits and preserve an existing revision.

Recovery retains exact older bytes, refuses observed changes from retired stores,
and requires a reviewed revision before reset. Tombstones prevent old data from
returning. Cancellation and account/navigation retirement still apply after every
asynchronous read. Clearing delivery records does not cancel schedules or undo
external effects; reconcile uncertain operations before creating replacements.
Browser data remains local and unencrypted. Qualification of one domain does not
establish the safety of another domain or of the real agent's runtime database.

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
- [Calendar/reminder contracts](calendar-reminder-contract.md) and [regional Maps setup](maps-regional-validation.md)
- [Local OCR](local-ocr.md), [browser autofill](browser-autofill-integration.md) and [Notes documents](notes-document-flows.md)
- [MVP completion plan](mvp-completion-plan.md), [scope and gaps](mvp-scope-and-gap-report.md) and [pilot acceptance](pilot-acceptance-runbook.md)

Production provider/TLS/data-license/coverage checks, release signing and rollback,
four physical units and user acceptance remain explicit gates. Offline-LLM and
Telegram/Discord scope conflicts require product disposition. Historical build
counts, source migrations and failed-attempt narratives are available in Git
history rather than serving as current setup instructions.

## Browser calendar backup restore

Calendar recovery accepts a selected Alpha calendar backup (domain bytes or a
recognized document envelope), validates the complete event set and previews the
count and titles before a separate replacement confirmation. It restores local
event copies with new identities and revisions, preserving recurrence, exclusions
and edited occurrences. Alerts are off; invitations are not sent. Preferences and
creation/action receipts are not imported. This avoids treating historical effect
records as new instructions. The current calendar can be downloaded first.

Replacement uses the captured document revision and older-copy bytes; newer edits
or legacy writes invalidate approval. Closing or retiring the dialog aborts a queued
write. The exact legacy copy remains available. Invalid or partially damaged files
are rejected as a whole, so selective salvage remains open. This is Alpha browser
backup recovery, not ICS/provider import or native Calendar restoration.

Calendar restore qualification: all 36 owning restore/recovery checks passed across
Chromium, Firefox and WebKit, including reviewed replacement, invalid files, stale
approval, queued cancellation and access from a healthy calendar. The 26 parser
and domain-document unit checks passed, including strict guest-response admission.
`npm run verify` passed all 644 tests, type checking, the production build and the
bundle audit before the final strict-response guard. That guard then passed the
owning unit/browser suites and type checking; the expensive unrelated runner
suite was not repeated. These results do not qualify native/device behavior or
unrelated MVP acceptance.

## Assistant draft restart recovery

Both assistant composers support bounded multiline review and IME-safe sending.
Unsent text is saved to the selected owner/agent/conversation, with offline text kept
separate. Restored drafts have no retained selected-source authority and never send
automatically. Revision conflicts show both copies; failed writes retain editable
text. Browser damaged-record recovery backs up stored bytes and current text before
confirmed reset. Android also offers backup and confirmed reset for readable records with invalid
draft schemas. Reset compares the exact captured secure-slot bytes; backup uses the
existing reviewed Android document picker with exact-byte readback. Decryption or
native read failures leave the record untouched. Physical restart/IME, encrypted-store
execution and document-provider acceptance remain open. Calendar and Reminder form recovery is tracked separately below.

Assistant draft qualification: consumer `ba3eed32` passed `npm run verify` (657
tests, type checking, production build and bundle audit), 11 production-surface
browser tests and 13 selected-source summary tests. A subsequent conversation-choice
fix passed type checking and all 81 owning draft/storage/conversation browser checks
across Chromium, Firefox and WebKit. It pins the current tab's observed choice,
including an empty choice, so another tab's saved restart preference cannot move an
unsent draft before its first send. These remain local results, not hosted CI or
native/device qualification.

Native assistant draft recovery qualification: consumer `5f4534ee` passed
`npm run verify` (657 tests, type checking, production build and a 245-file
flag-off bundle audit). All 57 affected browser checks passed across Chromium,
Firefox and WebKit. Native adapter tests used explicit bridge-contract doubles;
these results do not prove encrypted Android storage or file-provider execution.

## Unsaved Calendar and Reminder creation forms

New event and reminder forms now retain their editable fields and original creation
identities in the transactional draft store. Browser app and development profiles
use separate bindings; Android selects the existing encrypted slot adapter. Recovery
is explicit through **Resume unsaved calendar form** and never saves an item.
Civil dates are stored independently of relative day offsets, including when an
open form crosses midnight. Changing time zones prompts a review of the restored
time. Separate-creation consent is not restored. Existing pending-write journals
and provider revision checks remain authoritative for uncertain outcomes.

Competing tabs require Restore or Replace, and creating a new form requires review
before replacing a retained one. Discard requires confirmation and refuses stale
receipts, without creating or deleting events. Confirmed saves clear only the matching retained
form. Storage failure leaves current text available and exposes recovery.

Creation forms and inline existing-event/reminder edit forms retain drafts in separate
slots. The separate recurring/all-day Calendar editor also retains per-event drafts,
with explicit recovery when the event is reopened for editing.
Inbox now also retains unsaved edits separately from explicitly saved drafts. Android execution and physical
process-death acceptance remain separate from browser qualification.

Runtime update PR #317 remains unqualified at `e2f62059`: hosted test-mocks
instrumentation ran 191 tests per variant, with one standalone video-playback
failure and two launcher failures (video playback and returning from the system
share chooser). These are actual assertion failures, distinct from the cancelled
browser/distribution jobs. The preserved hosted evidence was inspected without
running another Android build. Browser development remains on upstream `95924e90`.

Creation-form qualification: three record-contract tests and type checking pass.
The 92-case creation/save campaign passed across Chromium, Firefox and WebKit;
after the discard addition, all 39 form-specific cases passed across those engines.
Cases cover date rollover, cross-tab conflict, uncertain event/reminder outcomes,
explicit replacement/discard, oversized edits and damaged-form recovery without
changing saved events. The restored form was inspected at 412 × 915. The primary-checkout repository run finished with 658 of 660 tests passing: an
untracked ownership audit links to removed patches, and its previously staged Android
payload does not match the current source pin. Those historical failures remain distinguished from the clean-worktree integrated
result: consumer `baa41362` passed all 663 tests, type checking, production build
and the 245-file flag-off bundle audit. The ownership links were repaired in
PR #325; the old staged Android payload was preserved. No Android build or native
execution is claimed.

## Unsaved inline Calendar and Reminder edits

Existing-item edits retain the original Calendar expected fields/revision or exact
Reminder target separately from editable values. Restoring never creates a new item
or restores an in-memory mutation attempt. Provider revision checks and the pending
action journal still govern Save. Civil dates and the original reminder schedule
rebase together, so a title-only change after midnight does not reschedule it.
Confirmed saves clear only the matching retained form. Explicit discard cannot
erase a newer draft from another tab and leaves saved items unchanged.

Inline-editor qualification: all 63 creation/edit draft cases passed across
Chromium, Firefox and WebKit, plus 42 existing Calendar save and Reminder
edit/timing cases in Chromium. The full 663-test integrated result above includes
this implementation. Native encrypted storage and process-death remain unqualified.

## Recurring and all-day Calendar editor recovery

The separate browser editor retains per-event text, selected dates/time zone,
all-day presentation, recurrence, alerts, attendees and local meeting preference.
Reopening the event offers explicit Restore or Discard; it does not apply old edits
automatically. Retained edits keep their original event revision, so restoring an
older version cannot overwrite a newer event. Cross-tab writes require explicit
conflict review. Oversized edits remain visible, and a confirmed event save whose
draft cleanup fails disables another save and reports the cleanup failure.

The final typecheck passed. All 26 final recovery/accessibility browser cases passed
across Chromium, Firefox and WebKit, following 14 initial editor/recurrence/
accessibility regressions and 21 recovery cases before the compact-layout adjustment.
The corrected 360 × 360 restored editor was visually inspected. The earlier full
663-test result predates this modal change; its combined root verification is
deferred to the next implementation batch. No Android build was run. Inbox recovery is tracked below.

## Unsent Inbox edit recovery

Unsent edits now have a separate recovery copy bound to the exact Cloud
environment, owner, organization and Gmail connection. It retains partial
recipient input, editable text, reviewed attachment bytes and the original saved
draft revision. Resume is explicit and never prepares or sends provider mail.
A newer saved draft refuses a stale replacement; competing windows require
Restore or Replace. Failed recovery cleanup after an explicit local save is
reported without claiming the copy was removed. Damaged recovery storage can
be reset without deleting the explicitly saved draft. Browser and native
storage use the existing transactional document and encrypted-slot adapters.

Inbox qualification: all 33 browser checks passed, including the owning adapter,
account-switch/read-cancellation regressions and recovery cases across Chromium,
Firefox and WebKit. Three record validation tests and type checking also passed.
Combined root verification with the Calendar modal changes is pending. Physical-device
process recreation, native encrypted-store execution and real Gmail authorization
and provider outcomes remain unqualified by these browser fixtures.
