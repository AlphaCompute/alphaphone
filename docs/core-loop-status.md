# Core loop status in the browser build

This records whether each core MVP loop completes start to finish through the rendered
UI of the browser build, as driven by one journey spec per loop in `test/browser`.
Loop definitions: [completion plan](mvp-completion-plan.md) journeys A–F and
[flow audit](flow-audit-and-prd.md) J01–J05.

**Evidence class: source/test (S) only.** Every journey runs the development profile
(`?mode=dev`, test mocks on) with the development agent profile where an agent is needed.
The agent answers with a saved scripted reply and its proposals are authored through the
"Development device actions" control; providers (microphone, Cloud transcription, speech
output, mail provider, Maps provider, web pages, camera) are synthetic fixtures. A passing
journey is not APK, emulator, AOSP image, real-integration or physical-device evidence and
does not qualify any row in [current status](mvp-current-status.md) beyond class S.

Run one journey at a time: `npx playwright test test/browser/journey-<id>-<slug>.spec.ts --project=chromium --workers=2`.

Column meaning: **Browser** = the step completes through rendered controls in the named
spec (yes / partial / no). **Native-only** = the step, or the part named, cannot be
exercised in the browser build by design. **Human or device** = what still needs a person
(sign-in, keys, owner decision) or physical hardware.

## A. Boot, connection choice and retained conversation

Spec: `journey-a-conversation.spec.ts`

| Step | Browser | Native-only | Human or device |
| --- | --- | --- | --- |
| Boot to Home with typed and talk entry points, no agent selected | yes | Cold boot into Alpha HOME, HOME role, recovery/emergency routes | Device boot and HOME-role selection |
| Connection choice (Settings → Agent connection → development profile) | yes (development profile only) | Android Welcome dialog, native `AlphaConnection` bridge | Cloud sign-in, agent selection/provisioning, remote pairing with a real account (A-02) |
| Typed conversation | yes | — | Real model quality |
| Switch Notes / Calendar / Browser and keep the same conversation | yes | — | — |
| Cancel a pending reply (Stop): the chat says once that the agent may still finish, the composer stays empty and nothing is resent | yes | — | — |
| One automatic check about 15 s after Stop reads the agent's history exactly once and reports the outcome (here: the agent did not record the message); the Check for reply card re-reads history and never posts | yes | Explicit cancel on the resident runtime | A real agent that finishes or confirms the cancel after Stop (controlled-transport cases are in `chat-continuity.spec.ts`; no real agent is exercised) |
| Send again after cancelling | yes | — | — |
| Reload and recover exactly one result per accepted request, none for the cancelled one | yes, after an explicit history restore | Process kill/restart, resident runtime restart | Network switch, token expiry/revocation, account change |

Open items:

- With the development profile, the visible chat is not restored by itself after reload;
  the user restores it with Load conversations → Restore conversation (asserted in the
  journey). Restoring a saved remote conversation on reconnect is covered with a
  controlled transport by `chat-continuity.spec.ts`, not by this journey, and no real
  remote or Cloud agent is exercised.
- Spoken requests are not part of this journey (see B for recording).

## B. Voice → note → calendar event and reminder (J02)

Spec: `journey-b-voice-note-actions.spec.ts`

| Step | Browser | Native-only | Human or device |
| --- | --- | --- | --- |
| Record in Notes (synthetic microphone, real recorder and retained-audio store) | yes | Native recorder and permission | A physically spoken note, microphone quality |
| Transcribe, correct the transcript, Save note | yes (closed Cloud transcription fixture) | On-device Whisper | Real recognition quality; Cloud account sign-in |
| Reload, reopen, read aloud / stop reading | yes (synthetic speech output) | Native synthesis | Audible playback, interruption, latency (A-10) |
| Review transcript with the agent, save reviewed summary note | yes | — | Real agent answer quality |
| Reminder from the note ("Review reminder draft" → Calendar form → Save) | yes | Native reminder scheduling | OS notification delivery, snooze from the notification, reboot |
| Calendar event from the note ("Review calendar event draft" → Calendar form → Save; nothing is written before Save) | yes | Android CalendarProvider accounts | Provider read-back, attendees |
| Saved reminder and event show "From note: <current title>" and "Open note" opens that exact recording, after reload and after an edit | yes (`note-calendar-handoff.spec.ts` covers a deleted, replaced, renamed or edited note) | The link for a device-calendar event (see open items) | — |
| Agent-proposed reminder and event, each reviewed and approved, with receipts | yes | Native action journal | A real agent choosing to propose them |
| Reload: every record exists exactly once | yes | — | — |
| Edit and delete the event and the reminder; the event deletion has one review step and Cancel deletes nothing | yes | The Android "Delete calendar event?" dialog | — |

Closed in the browser build:

- Notes → Calendar event: a saved voice note offers "Review calendar event draft"
  beside "Review reminder draft". Both open a Calendar draft only; nothing is written
  until Save in Calendar.
- Back-reference: a reminder or event saved from a note draft is linked to that note
  (note id, recording id and the reviewed revision; no note content and no title).
  Calendar shows "From note: <title>" with "Open note", where the title is read from
  the note as it is now, so a renamed note is shown under its current name. The action
  opens that note only if exactly one note still has that id and recording; otherwise
  it opens nothing and says so. A note that is in Trash, deleted or replaced is shown
  as "From a note that is no longer in Notes" with no title. A note
  edited since is opened with a notice. The link is created once at Save, is never
  changed by a later hand-off, and is removed when the record is deleted.
- Browser "Delete event" now shows one review step that names the event, like the
  Android plugin's "Delete calendar event?" dialog. Cancel, Back, Escape, hiding or
  locking the app delete nothing, and an event changed during the review is not deleted.

Still open:

- Device-calendar events are not linked to their note in the Android build:
  CalendarProvider row ids are assigned by the provider and can be reused, and the
  pinned native Calendar plugin stores no Alpha field on an event. Reminder links use
  the reminder's own id and the same store on Android, but no Android run exists.
  NEEDS upstream: a stable per-event identity (or an extended property) returned by
  `list` in plugin-native-calendar.
- The contract documents ([notes document flows](notes-document-flows.md),
  [calendar contract](calendar-reminder-contract.md), flow audit J02) do not describe a
  note back-reference or a calendar-event hand-off from a note. The behavior above is
  implemented from the J02 loop description and should be written into the contract
  by its owner.
- Reminder deletion from the detail page is still immediate ("Reminder cancelled").
  It was not changed.

Pending owner decision (recorded here, not in decisions.md):

- **Calendar deletion recoverability.** PRD AP-15 / MVP-48 suggest "no unrecoverable
  user-data loss" as P0, and Notes has a Trash. Calendar has neither a Trash nor Undo
  for provider-backed events. What was implemented is only parity with the existing
  Android behavior (one review step before an irreversible delete), using the review
  dialog Calendar already uses for "Delete repeating series". No retention window,
  Trash or Undo was added. The owner should decide whether deleted events and
  reminders need a recoverable state, for how long, and whether reminder deletion
  needs the same review step.

## C. Alarms

Spec: `journey-c-alarms.spec.ts`

| Step | Browser | Native-only | Human or device |
| --- | --- | --- | --- |
| Agent proposes a Clock handoff; review shows the exact request and no result claim | yes | — | — |
| Approve once; receipt records only that the handoff was opened | yes | The Android Clock intent (set/show/snooze/dismiss) and its "Alpha cannot confirm an alarm was changed" wording | Whether an installed Clock app created the alarm |
| Second reviewed handoff (show) opens the development Clock on that alarm | yes (development Clock) | Android Clock UI | — |
| Reload: exactly one alarm | yes (development Clock record) | — | Reboot persistence |
| Ring, snooze, ring again, dismiss | yes (foreground page, fixed clock) | Actual ringing, snooze, dismiss in Android Clock | Sound, vibration, DND, Doze, DST/time-zone change, no-handler and denied cases |
| Restart: dismissed alarm stays dismissed; receipts retained | yes | — | — |

Alarm ownership is pending owner decision A-11; the journey asserts the current handoff
behavior and decides nothing.

## D. Scheduled digests

Spec: `journey-d-digests.spec.ts`

| Step | Browser | Native-only | Human or device |
| --- | --- | --- | --- |
| Create morning and evening schedules from a reviewed snapshot (Settings → Scheduled digests) | yes | — | Real provider sources and their consent |
| Morning occurrence runs once; result retained, shown once, acknowledged | yes (development scheduler; output is the scripted reply) | Resident and hosted workers | Real model output |
| Restart inside the scheduled minute does not admit the occurrence twice | yes | Resident restart at an admission boundary (`scripts/test-local-digest-restart.mjs`) | Worker crash on a device |
| Evening occurrence runs once for the evening schedule only | yes | — | — |
| App closed across a scheduled time: no backlog replay, never run late | yes | — | Power loss, Doze, battery |
| The missed time leaves exactly one explicit `missed` record, labelled "Missed — not run", acknowledged once, unchanged by later ticks and restart | yes | — | — |
| A missed record does not replace the last real brief that Home reads; a schedule with only a missed record has no brief | yes (asserted on the retained value Home reads; with an agent connected the Home card lists workflows) | — | — |
| Final restart: history and acknowledgement retained; nothing runs again | yes | — | — |
| Two hosted loops complete while the phone is powered off and deliver once on reconnect | not coverable | — | Owner decision A-09, then a hosted service and a powered-off phone |

Open items:

- After a long absence the development scheduler records the most recent missed
  occurrence only, while the panel text says "the first is recorded below as missed".
  The wording and the development scheduler should be reconciled by the digest owner.
- The development scheduler runs only while the page is open ("Schedules run while this
  app is open"). This is not evidence for resident or hosted scheduling.

## E. Browser and credentials

Spec: `journey-e-browser-credentials.spec.ts`

| Step | Browser | Native-only | Human or device |
| --- | --- | --- | --- |
| Navigate, search, Back, Forward (test-owned local pages; search results fulfilled by the test) | yes | Isolated native WebView | Real sites |
| Second tab and switching tabs | yes | — | — |
| Reviewed page reading: only reviewed text reaches speech | yes (recording speech fixture) | Native reading and consent | Audible read-aloud |
| A page with a credential field is refused for reading and for questions | yes | Native sensitive-source checks | Real vault, OTP and recovery pages |
| Private tab is marked, kept out of history and gone after reload | yes | Ephemeral WebView profile | Sign-in does not persist after a private tab closes, on a device |
| Password manager from the Browser menu: honest "Autofill unavailable" state, development vault | yes (development vault) | Android Autofill, BiometricPrompt, Keystore vault | Enabling autofill in Android settings; save/fill on a real site |
| Development provider: install, select, unlock, fill the disposable sample, lock | yes | Proton Pass and other real providers | Provider sign-in |
| Reload: only the provider choice persists; no sample value is stored | yes | — | — |
| Sign-in persists in a normal tab across a cold start (P-04) | not coverable | yes | Emulator and device runs |
| Upload/download and external handoff | not in this journey (owning specs exist) | Android download and app-link handoff | — |

## F. Email and reconnect notifications

Spec: `journey-f-email-notifications.spec.ts` (small serial group)

| Step | Browser | Native-only | Human or device |
| --- | --- | --- | --- |
| Inbox load and open a message (development mailbox) | yes | — | Real mailbox |
| Local draft survives reload; one local send ("Sent locally", no receipt by design) | yes | Keystore-encrypted draft slots | — |
| Reviewed send against the synthetic provider: exactly one receipt and one message after reload | yes | — | Real Google OAuth grant (code exchange currently returns 401), managed Cloud routes, a real authorized send |
| Lost send response: outcome unknown, never sent again | yes | — | Real response loss against Gmail |
| A due reminder notice tapped after reload opens exactly its own event, once | yes (simulated shade) | OS notification delivery, system shade, lock-screen tap, process death between delivery and tap | Notification permission and channel settings on a device |
| A provider-confirmed send removes the saved local draft, the retained unsaved copy and the open composer of exactly that email; unknown and failed outcomes keep them | yes | Keystore-encrypted draft slots | A real authorized send |
| Two hosted digest result notices, each tapped after a restart, reach exactly their own retained result, once | yes, in `journey-f-hosted-result.spec.ts` (local-agent build on its own server; routed fixture service) | OS notification delivery, system shade, process death between delivery and tap | A real hosted worker (owner decision A-09) |

Open items:

- Closed in the browser build: a send records the local draft it came from (draft id,
  kept only on the device and never sent to the provider). When the provider confirms
  that send, each local copy of that draft that still holds exactly the sent content is
  removed and the receipt says so. A copy edited after Send, a different draft with the
  same text, a draft changed in another window, another account's draft, and every
  unknown, rejected or unsent outcome are left alone; the receipt then says a copy
  remains. A succeeded receipt that names no provider message clears nothing. When the
  open or retained copy was edited after Send, or the retained copy cannot be cleared,
  the saved draft those edits are based on is kept too. Comparison is exact (recipients,
  subject, body, attachments, reply target, forwarded originals); a copy restored to
  exactly the sent content counts as the sent email and is removed. A reload between the
  confirmation and the cleanup finishes the cleanup from the saved receipt. Cases:
  `scripts/test-inbox-sent-cleanup.mjs`. Both that script and the journey supply their
  own slot store; the removal of the saved draft relies on the platform store's
  compare-exchange (Android Keystore slots), which no run here exercises. The saved
  receipt is trusted to the same degree as the drafts stored beside it: it is not
  re-confirmed with the provider before a cleanup that resumes after a reload.
- Still open: a saved local draft that is an older version of the sent email (the user
  edited after saving, then sent) is kept and still offered, because it does not hold
  the sent content. Operations saved before this change carry no source draft and
  clear nothing.
- Closed in the browser build: the hosted result tap after a restart is a journey-level
  spec (`journey-f-hosted-result.spec.ts`) that shares the harness of
  `dev-hosted-journey.spec.ts` (`hosted-harness.ts`). It needs a local-agent build, so
  it is a separate file from the mail journey. The hosted service is a routed fixture.
- New-mail notifications are not implemented (pending decision A-05).

## J01. Poster → Calendar

Spec: `journey-j01-poster-calendar.spec.ts`

| Step | Browser | Native-only | Human or device |
| --- | --- | --- | --- |
| Scan a poster (canvas camera stream, real local English OCR) | yes | Physical camera capture | Real printed posters: focus, glare, skew, handwriting |
| Review suggestions; Cancel saves nothing | yes | — | — |
| Edit a suggestion, hand off to the separate Calendar review, leave without saving: nothing saved | yes | — | — |
| Hand off and Save in Calendar: exactly one event | yes (browser-local calendar) | Android CalendarProvider, calendar selection, scope denial | Provider account |
| Reload: the event persists once with the reviewed fields | yes | — | — |
| Home agenda card shows it and opens the same event; day view lists it once | yes | — | — |

## J03. Document analysis

Spec: `journey-j03-document-analysis.spec.ts`

| Step | Browser | Native-only | Human or device |
| --- | --- | --- | --- |
| Development incoming email with a text attachment; review it; Save to Files | yes (development mail simulator) | — | A real mailbox attachment |
| Files → open the saved document → Ask → review/trim excerpt → Use in conversation → Send | yes | Android document-provider grants | Real agent answer quality |
| Review summary note: Cancel saves nothing; edit and Save reviewed note | yes | — | — |
| Reload: one note with its source reference; Open linked source opens the exact document | yes | — | — |
| Source bytes change: the reference fails closed | yes (bytes changed directly in the Files database; no rendered control edits stored bytes) | A provider file changing under a persisted URI grant | — |
| Source deleted in Files: the reference fails closed, note unchanged | yes | Expired URI, revoked account | — |

## J04. Schedule → travel

Spec: `journey-j04-schedule-travel.spec.ts`

| Step | Browser | Native-only | Human or device |
| --- | --- | --- | --- |
| Create an event with a location through the editor | yes | — | — |
| Reopen after reload; hand its location to Maps exactly once | yes (synthetic Maps provider) | — | Production Maps gateway, licensed data |
| Explicit destination, explicit origin (manual), explicit route choice | yes | Device location as origin, turn-by-turn Start | Location permission, GPS, physical navigation |
| Return to the same event without another hand-off: "Back to event" in Maps, and system Back | yes (`maps-event-return.spec.ts` covers two events with one address, a deleted or moved event, double activation and reload) | Android system Back | — |
| Travel-mode buttons expose the selected mode (`aria-pressed`); a refused mode is not selected | yes | — | Screen-reader check on a device |
| Reload does not replay the hand-off; a new tap is one new hand-off | yes | — | — |

Closed in the browser build:

- Maps shows "Back to event" only while it was opened from an event's location and
  Calendar is the view beneath it. It checks that the exact event (id and start) still
  exists, returns to that event and removes the cross-app step, so system Back does not
  reopen Maps. It never sets a search. If the event was deleted or moved, Maps stays
  open, says so and withdraws the control. The origin is view state only: it is gone
  after a reload, after Home, and when Maps is opened from the launcher.
- The travel-mode buttons expose `aria-pressed`. Round 2's accessibility branch did not
  change these buttons, so there is no overlap.

Still open:

- The control is not offered during active guidance.
- No Android run: the return uses the same `list` call the Calendar adapter uses, but
  only the browser build was exercised.

## J05. Web research → note

Spec: `journey-j05-web-research-note.spec.ts` (two serial tests)

| Step | Browser | Native-only | Human or device |
| --- | --- | --- | --- |
| Bounded review of a public HTTPS page excerpt (test-owned page fulfilled by the test) | yes | Excerpt extraction from the isolated native WebView and its revision binding | Real-site coverage |
| Ask with the development agent; answer shown | yes | — | Real agent answer quality |
| Explicit Save: exactly one note with a source link; reopen after reload | yes | Encrypted native Notes storage | — |
| Cross-origin reading denied: pasted text is reviewed instead and still saves one linked note | yes | — | — |

## Breaks found by the audit and their disposition

| Loop | Break | Class | Disposition |
| --- | --- | --- | --- |
| A | Stop was not offered until the first streamed text arrived | product bug | Fixed in `agent-adapter.ts` (re-render once the request is pending) |
| B | A saved voice note had no Read aloud control | missing hand-off | Fixed in `voice-adapter.ts` and `template.html` |
| B | The reminder draft opened from a recording had zero duration, so Save reported a clock change | product bug | Fixed: the draft has a one-hour duration, and a form whose end is not after its start now says so (`calendar-end-after-start.spec.ts`) |
| J03 | A development Inbox attachment could be reviewed but not saved to Files | missing hand-off | Fixed in `mail-attachments.ts` and `simulated-inbox.ts` |
| E | A refused page question left the Browser menu open over the error | product bug | Fixed in `browser-adapter.ts` |
| J04 | An unavailable Bike mode reported that transit schedules were unavailable | product bug | Fixed in `maps-adapter.ts` |
| D | No explicit missed record in the browser development scheduler | gap versus proposed policy | Implemented by the workflows and digests package; journey D now asserts it |
| B | No direct calendar-event hand-off from a note; no link back to the note | missing hand-off | Fixed in `voice-adapter.ts`, `note-origin-adapter.ts`, `runtime/note-origin.ts` (browser build; device-calendar event link still open) |
| B | Browser "Delete event" deleted with no review, unlike the Android plugin | parity gap | Fixed in `browser/calendar.ts`; recoverability is a pending owner decision |
| F | A confirmed send left its local draft and unsaved copy on offer | missing hand-off | Fixed in `inbox-drafts.ts`, `inbox-provider-controls.ts`, `runtime/inbox-operation.ts` |
| F | Hosted result tap after restart had no journey-level spec | coverage gap | Added `journey-f-hosted-result.spec.ts` |
| J04 | No in-app return from Maps to the originating event; travel mode shown by color only | missing hand-off | Fixed in `maps-adapter.ts`, `calendar-adapter.ts`, `runtime/maps-event-return.ts`, `template.html` |

## What no browser journey can establish

- Sign-in and keys: Eliza Cloud sign-in, Google OAuth, Cerebras key provisioning, real
  password-provider accounts, release signing.
- Owner decisions: A-09 (powered-off scheduling), A-11 (alarm ownership), A-05
  (background notification policy), A-10 (voice latency method) and the other entries
  under [pending owner decisions](decisions.md#pending-owner-decisions).
- Hardware: microphone and speaker quality, camera capture, GPS and navigation, ringing,
  Doze and battery, reboot, lock screen, HOME role and full-image boot.
