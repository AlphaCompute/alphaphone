# Daily overview on Home (AP-07, MVP-19)

This maps the daily overview requirement to the cards Home actually renders. It describes
source behavior and browser tests only. It is not APK, emulator, AOSP image, real-provider or
device acceptance evidence; those gates stay open in [current status](mvp-current-status.md).

## Cards

| Card | Source | Attribution and freshness shown | States |
| --- | --- | --- | --- |
| Calendar (`data-alpha-home-calendar`) | Device calendars read by the Calendar adapter (the app's own calendar in a browser), plus reminders from the reminder store | Calendar name beside the date, `Read <time>` beside the event time; the full sentence is the card's accessible description. An upcoming reminder shows `Reminder` and the reminder store's read time instead of a calendar's | Loading, no upcoming events, results limited to the first 2,000 events, read failed with `Open Calendar to retry` (opening Calendar from the card reads it again), access off, not connected |
| Overdue reminder (same card) | Reminders that are due and not done (`overdueReminders`) | Header `Overdue reminder` or `N overdue reminders`, `Due <time>`, `Read <time>` of the reminder store; description names the reminder store | Shown before any event, including one already in progress, until it is completed or cancelled or its due time moves to the future. A snoozed reminder that keeps its original due time stays listed |
| Workflows (`data-alpha-home-workflows`) | Workflow list from the connected agent; the unified automations list after the user opens Workflows | `Loaded <time>` under the status line once a list was loaded for the current connection; the source is named in the accessible description only | Connect agent, loading, empty, failed with retry, partial, last loaded |
| Inbox (`data-alpha-home-inbox`) | Metadata of the Inbox page the user loaded in Inbox | Account label and `Read <time>`; `From loaded messages` when the page was partial. The time is the completed first-page read; loading more pages or changing read state in Inbox does not move it | Connect email, open to check or load, updating, no unread email, failed with `Open to retry · last read <time>`, reconnect |
| Latest brief (`data-alpha-home-brief`) | Newest scheduled-digest result retained in this app for the current connection (`latestRetainedDigest`) | Agent name and `Ran <time>`, `Failed <time>`, or `Did not run <time>` for a retained result that records a skipped occurrence (missed time, overlapping run, expired or revoked source) | Absent when no result is retained; a failed run shows its error text. Opens the scheduled digests list |

Times are when this app read the data on this device. They are not provider sync times.
A read from an earlier day shows its date.

## Boundaries

- Home never reads mail. The Inbox card changes only after the user loads or refreshes Inbox,
  and it never shows message bodies. `test/browser/home-daily-overview.spec.ts` counts provider
  reads while Home is rendered, re-rendered and refocused.
- The brief card shows a retained result. Showing it reads nothing and runs nothing. Opening it
  opens the scheduled digests list, which syncs retained results with the agent as it does when
  opened from Settings; it does not run a digest.
- No card has fixture avatars, a placeholder brief or sample agenda text outside builds made
  with `ELIZA_DEV_ALLOW_TEST_MOCKS=1`.
- New-mail notifications and background mail checks depend on open decision A-05 and are not
  implemented.

## Tests

- `test/home-cards.test.mjs`: presentation of every card state.
- `scripts/test-inbox-cloud-flow.mjs` (run by `test/adapter-contracts.test.mjs`): the Inbox read
  time across a first page, a later page and a refresh.
- `test/browser/home-daily-overview.spec.ts` (development lane, synthetic provider data).
- `test/browser/home-daily-overview.production.spec.ts` (flag-off build, fresh profile).

## Still open

- Real Gmail, device-calendar and scheduled-digest transitions on an installed build.
- Calendar access denied and device calendar names are Android-only states with unit coverage
  but no instrumented or device run.
- TalkBack reading of the card descriptions on a device.
