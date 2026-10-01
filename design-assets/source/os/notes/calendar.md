# Calendar — review notes

## What didn't work in the reference version
- Only "today" had events; every other day was blank, so the week strip was decorative. No way to see a month.
- `+` opened chat with a canned sentence instead of a form. Touch-only creation was impossible.
- The timeline had no hour labels, so free gaps (the thing you scan for) were unreadable.
- Event detail had nothing actionable: no join, no directions, no attendee links, no edit/delete, no RSVP.
- The agent's "focus" intent also grabbed "prep", and `calendar|schedule` grabbed workflow sentences
  like "Whenever Maya texts, check my calendar" (calendar is before workflows in ORDER).

## What I changed
- **Data:** events live in state (`events`, persisted) with a day offset from today (`off`), optional
  `repeat` (daily / weekdays / weekly), `cal` (personal/work), `video`, `where`, `who`, `rsvp`, `invite`, `alert`, `notes`, `prep`.
  A week of seed events around today; Standup repeats on weekdays. `c4` = Design review 3:00 PM today is unchanged.
- **Day view:** hour gutter (7 am to 11 pm), per-calendar stripe, holds are outlined, pending invites dashed,
  overlapping events split into lanes. **Swipe the timeline left or right to change day.** Edge swipes (x<30 or >382)
  and the bottom bar zone go to the shell, so back and home still work over the timeline.
  A Today button appears only when you're off today.
- **Month:** tap the month title to drop a month grid (dots = has events). Prev/next arrows replace `+` in the header
  while it's open. The **calendar list** (color swatch + toggle per account) sits under the grid, not on its own screen.
  No separate agenda view: the day view plus month dots cover browsing, and "what's my afternoon / tomorrow" returns an agenda card from Alpha.
- **Accounts:** calendars come from `api.get("settings").accounts` (the first two map to Personal/Work, extras are appended);
  falls back to Personal (Google) / Work (Lumen). Tap the swatch to cycle colors, and use the toggle to hide or show.
- **Event detail:** title, time, day, repeat and calendar. Invite RSVP (Going / Maybe / No), video link with **Join** (toast),
  location → `maps {query}` ("Phone" becomes Call → `phone {call}`), alert, attendees → `contacts {open}` with
  Organizer/Maybe/Invited, notes, **Prep me** (sends to Alpha, returns a summary card; the bullets are then pinned inline on the event).
  Header: edit, delete (undo bar for 5 s).
- **Create/edit form (sub-page):** title, 3-week day chips, start/end steppers (15 min) with duration,
  location, video-link toggle, invite people (from contacts list if present, else PEOPLE), calendar, repeat, alert, notes.
  Save validates the title, writes to state and jumps the timeline to that day.
- **Pending invite** (Jordan, Northpoint partner dinner) shows as one dashed row under the week strip with ✓ / ✕;
  the home icon gets a badge while it's pending.
- **Agent:** afternoon/morning/tonight/tomorrow agendas; find a free hour (scans today then the next 2 days, holds it);
  "move X to tomorrow / Friday / 7:30"; "cancel X" (card restores it); "lunch with Priya next Tuesday at 1" → event card,
  tap adds it and opens that day (notes a clash if any); "prep me for X"; "accept/decline the invite".
  Workflow-ish phrases (every/whenever/turn off/run/why did…) are left for Workflows.

## Flows implemented (all walked in /tmp/agF/flow.js)
create event via form → appears · open → edit → saved · delete → undo · swipe days · Today · month open/prev/next/pick ·
hide/show a calendar · join · prep via Alpha → inline · invite accept/decline (row and detail) · chat create → add →
opens day · move / cancel / focus / agenda by chat · back closes form → detail → month in order · deep link `{open}` (`calendar:event`, `calendar:invite`).
Presets: `calendar`, `calendar:event`, `calendar:new`, `calendar:month`, `calendar:invite`. Also accepts `{day: n}`.

## Shell requests
- `build.py` fails with **"Argument list too long"** once all modules are present: the registry probe is passed
  through `node -e`. Write the probe to a temp file and run `node file.js` instead. I tested with a private copy containing only my modules.
- In `test.js`, the page is wider than the 520px viewport (scrollWidth 676). Playwright's scroll-into-view
  shifts the phone off-screen, and then `h.swipe/back` coordinates miss. My flow resets `window.scrollTo(0,0)` after taps.
  Either widen the viewport or set `overflow: hidden` on the page in `phone=1` mode.
- The `event` chat card always shows a check icon, even when it's an "add this?" card with `act`. A `+` icon or
  "Add" label when `act` is set and not done would read better.
- The shell toast isn't tappable, so each app needs its own undo bar. A shared `api.toast(msg, {undo: fn})` would be nicer.
- Other apps can read `api.get("calendar").events` (day offsets in `off`, times as decimal hours in `t`/`d`).

## Round 2
- **Routing:** restaurant phrasing ("book a table", "table for", "reserve…", "restaurant") and flights/hotels/rides are never grabbed by the "book/add" create intent, so the Browser answers them.
- **Times:** "move gym to 8" keeps the event's half of the day when am/pm is omitted, so it goes to 8 PM.
- **Editor:**
  - The avatar grid is replaced by chosen-people chips (✕ to remove) and an "Add people" chip. It opens a type-ahead on name or email; Enter picks the top match, and back or ✕ closes it.
  - Fields are filled `--s2` groups with no dividers.
  - The Save pill is 36px and stays disabled (`--s2`/`--mut`, aria-disabled) until there's a title.
- **Prep:** "Prep me" is now an α chip. The prep card uses the α glyph; no sparkle icons remain.
- **Snackbar:** deleting uses the shared `api.toast(label, {undo})`, and the hand-rolled bar is removed.
- **Timeline swipe:** now `api.sw(fn, {axis: "x"})`, and `fn` returns false on vertical swipes. The shell owns the gesture zones.
- **Accents:** dots, the now-line and prep bullets use `--acct`.
- **Chat proposal card:** it carries a pre-made event id plus `go` to that event, and shows "+" then ✓ after adding.
- **New deep link:** `{add: {title, off, t, d, where, who, notes, cal, video}}` adds the event (persisted) and opens its detail on that day. Preset `calendar:add` demonstrates it. `{open: "c4"}` from Home works, and closing the event lands on its day.

### Shell requests (round 2)
- `api.sw` in `shell.js` is `function (fn) { return self.sw(fn); }`, so the `{axis}` option is dropped. It should pass `opts` through. Until then I forward vertical swipes by returning false.
- `cardAct` returns early when a card is `done`, even if it has `go`. For an added event, the second tap should open it. Suggest: `if (c.done) { if (c.go) this.openView(...); return; }`. My cards already carry `go`.
