# Daily overview on Home (AP-07, MVP-19)

This maps the daily overview requirement to the cards Home actually renders. It describes
source behavior and browser tests only. It is not APK, emulator, AOSP image, real-provider or
device acceptance evidence; those gates stay open in [current status](mvp-current-status.md).

## Cards

| Card | Source | Attribution and freshness shown | States |
| --- | --- | --- | --- |
| Calendar (`data-alpha-home-calendar`) | Device calendars read by the Calendar adapter (the app's own calendar in a browser), plus overdue reminders from the reminder store | Calendar name beside the date, `Read <time>` beside the event time; the full sentence is the card's accessible description | Loading, no upcoming events, results limited to the first 2,000 events, read failed with `Open Calendar to retry`, access off, not connected |
| Overdue reminder (same card) | Reminders that are due and not done (`overdueReminders`) | Header `Overdue reminder` or `N overdue reminders`, `Due <time>`; description names the reminder store | Stays first on the card until the reminder is completed, snoozed or cancelled |
| Workflows (`data-alpha-home-workflows`) | Workflow list from the connected agent; the unified automations list after the user opens Workflows | `Loaded <time>` under the status line once a list was loaded for the current connection | Connect agent, loading, empty, failed with retry, partial, last loaded |
| Inbox (`data-alpha-home-inbox`) | Metadata of the Inbox page the user loaded in Inbox | Account label and `Read <time>`; `From loaded messages` when the page was partial | Connect email, open to check or load, updating, no unread email, failed with `Open to retry · last read <time>`, reconnect |
| Latest brief (`data-alpha-home-brief`) | Newest scheduled-digest result retained in this app for the current connection (`latestRetainedDigest`) | Agent name and `Ran <time>` or `Failed <time>` | Absent when no result is retained; a failed run shows its error text. Opens the scheduled digests list |

Times are when this app read the data on this device. They are not provider sync times.
A read from an earlier day shows its date.

## Boundaries

- Home never reads mail. The Inbox card changes only after the user loads or refreshes Inbox,
  and it never shows message bodies. `test/browser/home-daily-overview.spec.ts` counts provider
  reads while Home is rendered, re-rendered and refocused.
- The brief card shows a retained result. Showing or opening it runs nothing.
- No card has fixture avatars, a placeholder brief or sample agenda text outside builds made
  with `ELIZA_DEV_ALLOW_TEST_MOCKS=1`.
- New-mail notifications and background mail checks depend on open decision A-05 and are not
  implemented.

## Tests

- `test/home-cards.test.mjs`: presentation of every card state.
- `test/browser/home-daily-overview.spec.ts` (development lane, synthetic provider data).
- `test/browser/home-daily-overview.production.spec.ts` (flag-off build, fresh profile).

## Still open

- Real Gmail, device-calendar and scheduled-digest transitions on an installed build.
- Calendar access denied and device calendar names are Android-only states with unit coverage
  but no instrumented or device run.
- TalkBack reading of the card descriptions on a device.
