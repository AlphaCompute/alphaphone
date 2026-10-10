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
| Calendar event from the note | partial: only by switching the reminder draft to the "In this app" calendar | Android CalendarProvider accounts | Provider read-back, attendees |
| Agent-proposed reminder and event, each reviewed and approved, with receipts | yes | Native action journal | A real agent choosing to propose them |
| Reload: every record exists exactly once | yes | — | — |
| Edit and delete the event and the reminder | yes | — | — |

Open items (hand-off gaps, not fixed here):

- A saved voice note has no dedicated control to draft a calendar event; the only
  rendered route is the reminder draft with its calendar switched.
- A reminder or event created from a note carries the action text but no link back to
  the note it came from.
- Calendar "Delete event" deletes immediately with no confirmation or undo. Neither
  [the calendar contract](calendar-reminder-contract.md) nor the flow audit requires
  one for a direct user deletion, so this is recorded as an observation, not a defect.

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
| A hosted digest result notice tapped after reload reaches the exact result | not in this journey | — | — |

Open items:

- After a provider-confirmed send the composer's retained local copy is still offered
  ("Resume unsaved email") and the receipt says so. Nothing is re-sent automatically,
  but the user can explicitly send it again. The journey asserts this current behavior
  as a recorded gap. Any change belongs to the Inbox adapter owned by another package.
- The hosted digest result tap needs a local-agent build and its own server; it is
  covered only by `dev-hosted-journey.spec.ts`, not by journey F.
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
| Return to the same event without another hand-off | partial: only through system Back (development device control) | Android system Back | — |
| Reload does not replay the hand-off; a new tap is one new hand-off | yes | — | — |

Open items:

- Maps has no in-app control that returns to the event that opened it; "Back to apps"
  goes Home and the return path is system Back.
- The travel-mode buttons show the selected mode by color only and expose no
  `aria-pressed`. The change belongs in the shared template owned by the accessibility
  package.

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
| B, F, J04 | Hand-off gaps listed under each loop's open items | missing hand-off | Recorded, not changed |

## What no browser journey can establish

- Sign-in and keys: Eliza Cloud sign-in, Google OAuth, Cerebras key provisioning, real
  password-provider accounts, release signing.
- Owner decisions: A-09 (powered-off scheduling), A-11 (alarm ownership), A-05
  (background notification policy), A-10 (voice latency method) and the other entries
  under [pending owner decisions](decisions.md#pending-owner-decisions).
- Hardware: microphone and speaker quality, camera capture, GPS and navigation, ringing,
  Doze and battery, reboot, lock screen, HOME role and full-image boot.
