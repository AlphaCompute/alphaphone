# Prototype calendar integration

The original prototype supplies the calendar, timeline, event form and detail presentation. `AlphaCalendarPlugin` bridges the product renderer to Android CalendarProvider. This implementation does not imply a connected Google, Microsoft or CalDAV account.

## Implemented flow

1. Opening the app reads calendars only if Android has already granted calendar permission. It never prompts during startup.
2. Selecting Device calendars explicitly requests READ_CALENDAR and WRITE_CALENDAR. Denial leaves the calendar disconnected.
3. The agenda loads actual expanded event instances from 31 days before through 335 days after the refresh time. It caps the result at 2,000 events and reports truncation. Native reminders share the timeline.
4. New event defaults to On this phone. The destination chips also include writable device account calendars and Reminders. Typing does not persist an event.
5. Explicit Save requests access if necessary, validates the event, creates the product's local calendar only when first needed, then inserts the event. It reads back title, body, location, calendar ID, start and end before reporting success. A write whose result cannot be verified is not automatically repeated. The user must refresh and inspect the calendar before trying another save.
6. Returning from another app refreshes the provider data. Failed refresh retains previously loaded events with a stale-status message.
7. Edit/Delete on native event details opens that event's Android Calendar URI with its occurrence start/end. Android Calendar owns recurring-event and account semantics. If no handler exists, the product says that the event could not be opened.
8. The assistant receives selected native event identity and a locally tracked revision, without automatically copying its body into the conversation.

## Explicit remaining gaps

Recurring-event creation, invitations, conferencing and event alerts require the native calendar app. This form prevents those unsupported combinations from being reported as saved. Full inline editing/deletion, account sync setup, calendar visibility/color editing, range pagination and proper multi-day/all-day rendering remain to implement. Native account calendars are populated by the user's installed sync provider; no provider or account is silently created. Selecting an event for agent context does not yet authorize the agent to read or mutate it.

## Verification

`CalendarFlowInstrumentedTest` exercises the real event form, checks that typing has no effect, saves one UUID-labelled event, inspects CalendarProvider, recreates the Activity, and verifies the agenda reloads it. Cleanup deletes only that test's event. Device results must identify the tested revision and APKs; see [verification gates](verification.md).

A subsequent UX correction (not in build 13) opens the saved event's original detail screen after the provider refresh, matching the prototype's completion flow. The post-write refresh supersedes any older refresh instead of being skipped while one is running. Its E2E assertion now requires that detail screen before Activity recreation. These changes await the next APK/device run.

### Home agenda follow-up (next APK after build 14)

The Home calendar card now selects the earliest ongoing/upcoming real provider event or native reminder from the already-loaded calendar state. Its title/time and tap destination identify that actual event; no entity is synthesized when the list is empty. Long titles are limited to three lines inside the original card. The native data refresh, app clock update and resume path drive the card. This does not add account sync, a wider provider query range, or all-day/multiday layout support. Device verification is pending for the new Home entry flow.
