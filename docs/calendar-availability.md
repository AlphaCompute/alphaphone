# Foreground Calendar availability (MVP-12)

"Am I free at 3pm Tuesday?" is a `calendar_availability` device operation. The phone
answers it in a foreground review and shares busy times only. This page records what is
implemented and what is still unproven. It is not acceptance evidence.

## Flow

1. The agent proposes `calendar_availability` with an exact UTC window (at most seven
   days) and the phone's time zone. The phone offers the capability
   `calendar.availability-read.v1` only when the agent lists it.
2. The proposal card is shown on Home or Calendar while the phone is unlocked and the
   request's time zone equals the phone's. Otherwise the owner sees a notice naming the
   reason, and the action cannot be approved.
3. After approval and the journal claim, the phone asks for calendar read permission and
   lists the calendars it may read. Nothing is preselected. The owner ticks one to
   sixteen calendars; unticked calendars are not read.
4. The phone reads only those calendars, bound to the source revisions the owner saw,
   and shows the exact answer: free or busy, each busy time, and how many events marked
   free were ignored.
5. On "Share with agent" the same read runs again. If the answer differs, nothing is
   shared and the owner is asked to review again. Otherwise the reviewed result is
   journaled and uploaded as the receipt.

Cancelling, pressing Back, leaving the app, locking the phone, changing screen,
reconnecting or changing time zone ends the review with a failed receipt that carries no
result.

## What is shared

The receipt is the shared `CalendarAvailabilityResult`: the window, `free` or `busy`,
busy intervals with `allDay` and `tentative` flags, the number of calendars read and the
number of ignored free events. Calendar names, accounts, event titles, descriptions,
places and attendees are not in it. The Android reader does not query those columns, and
the renderer rejects any provider row that has a field other than `start`, `end`,
`allDay` and `availability`.

## Rules

- Events marked free are ignored and counted. Tentative events are busy and flagged.
- An all-day event blocks the owner's whole local date, not the UTC date.
- Cancelled events and invitations the owner declined do not count as busy. This follows
  common free/busy practice and is an engineering default, not an owner decision.
- More than 200 events in the window, or more than 64 readable calendars, fails the
  check instead of returning a partial answer.
- In the browser the only source is the in-app calendar. Its events have no "show as
  free" setting, so each one is busy.

## Source

| Part | Path |
| --- | --- |
| Executor and provider boundary | `apps/app/src/runtime/calendar-availability.ts` |
| Review dialogs | `apps/app/src/prototype/calendar-availability-review.ts` |
| Android provider read | `android/app/src/main/java/ai/elizaresearch/alphaphone/CalendarAvailabilityReader.java` |
| Android bridge methods | `availabilitySources` and `readAvailability` in `AlphaCalendarPlugin.java` |
| Browser provider read | `apps/app/src/browser/calendar.ts` |
| Contract and result computation | `vendor/eliza/packages/contracts/src/device-reviews.ts` (pinned, unchanged) |

## Tests

- `test/calendar-availability.test.mjs` runs `scripts/test-calendar-availability-flow.ts`:
  the executor and the real `DeviceActions` client over a synthetic provider.
- `test/browser/calendar-availability.spec.ts`: the renderer, review dialogs, journal
  orchestration and the browser in-app calendar, with synthetic agent routes.
- `CalendarAvailabilityInstrumentedTest`: the Android reader against the device
  CalendarProvider with calendars the test creates. It needs calendar permission from
  the runner.

## Still open

- The Android path has not been run on an emulator or device in this change: the
  permission dialog, the review inside the Android WebView, synced accounts, a declined
  invitation and a mid-review time-zone change are unverified.
- No real agent has produced or consumed an availability receipt against this build.
- The provider read lives in the Alpha app because the pinned shared calendar readers do
  not return availability. Moving it into the shared calendar plugin needs an upstream
  change.
- Device and owner acceptance of the wording and flow are separate gates.
