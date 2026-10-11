# Gesture zones and Alpha's notifications panel

This page says which swipes belong to Android and which to Alpha, and how Alpha's own
notifications are opened. It records the behaviour in source as of round 8
(`apps/app/src/prototype/model.js`, `template.html`, `phone.css`) and the tests that hold it.
Browser tests are Chromium on a development or production build. They are not emulator,
TalkBack or device evidence; the emulator check is named at the end and has not been run at
this source.

## What was wrong

On the launcher flavor, which draws under Android's status bar, a downward swipe that started
on the very top edge opened Android's notification shade and a swipe that started a little
lower opened Alpha's notifications (round 7: a start 131 device pixels down opened Android's,
a start further down opened Alpha's). Two different panels answered one gesture, told apart by
a few pixels. Alpha's panel also had no control at all: it could only be opened by a swipe, so
it could not be reached with a keyboard, a switch or TalkBack.

## What the requirement says

- [PRD](prd.md), explicit limits: "Android status shade, lock screen, secure wallet gestures,
  default phone/SMS handling and system-wide assistant invocation are OS/role work, not CSS
  inside a launcher."
- [Flow audit](flow-audit-and-prd.md), native strategy: "Android owns lock, shade, permission
  dialogs, role selection, secure prompts, picker, camera/handoff and default apps".
- Flow audit, F14: "Notification history is a product view of known events, not a replacement
  system shade."

So the top-edge swipe is Android's, and Alpha's list is a product view that needs its own,
visible way in.

## The zones

| Zone | Owner | What happens |
| --- | --- | --- |
| A downward swipe from the top edge of the screen (the status bar) | Android | Android opens its own shade. Alpha does not respond: no downward swipe that starts above or beside the handle opens Alpha's panel, in any view, in any presentation. |
| The "Notifications" handle at the top of Alpha Home | Alpha | Opens Alpha's notifications. See below. |
| Inside Alpha's open notifications panel | Alpha | A swipe up closes it. A horizontal swipe on a row dismisses that notice. |
| A swipe in from the left or right edge | Android (gesture navigation) | Android delivers Back. In the browser build the same swipe within 30px of an edge goes Back. |
| A swipe up from the bottom edge | Android (gesture navigation) | Android delivers HOME; the launcher flavor shows Alpha Home. |
| A swipe up on Alpha Home, away from the bottom edge | Alpha | Opens the conversation sheet. |

The former gestures "swipe down from the top 90px of any view" and "swipe down anywhere on
Home" are removed. They were the ones that competed with Android's status bar.

## The handle

- A button labelled "Notifications" with a bell, centred at the top of Home, above the cards.
  Its accessible name is "Open notifications"; it names the panel it controls
  (`aria-controls`) and is in the tab order.
- Target size: at least 44 by 44 CSS pixels (it is 44 high and at least 120 wide), at every
  supported text size.
- Position: below the status bar in every presentation. The standalone app's page starts
  below Android's bars. The launcher flavor reserves 44px for the bar and Home adds padding;
  when Android reports a taller bar (`--native-top-inset`, set by `MainActivity` from the
  system bar inset), Home's top padding grows so the handle starts at least 12px below it.
- Ways to open: a tap or click; Enter or Space when it has focus; the accessibility click
  action (what TalkBack's double tap and Switch Access send); a pull down that starts on the
  handle. `touch-action: none` on the handle gives the pull to the page instead of scrolling
  Home.
- While the panel is open, Home is inert and hidden from assistive technology and focus is
  inside the panel. Close, Android Back, Escape and a swipe up close it; focus returns to the
  handle unless something else was opened from the panel.
- The handle shows no count. The panel reads Android's list when it opens; a number on Home
  would be a count nobody has just read.

The handle exists on Home only. From inside an app view the way to Alpha's notifications is
Home; Android's own shade is available everywhere from the top edge.

## Tests

| Test | Lane | Shows |
| --- | --- | --- |
| `test/browser/notifications-handle.spec.ts` | `npm run test:browser` | In the standalone and launcher presentations: the handle's name, size and position; tap, Enter, Space, accessibility click and pull-from-handle open the panel; Close, Back and Escape close it and focus returns; swipes from the top edge, inside the status bar band, beside, above and below the handle, in the middle of Home and inside an app view open nothing; a taller status bar inset moves the handle down; the handle keeps its target at 200% text. |
| `test/browser/accessibility-sweep.spec.ts`, `accessibility-sweep.production.spec.ts` | both lanes | Home with the handle passes the name, role, focus order, contrast, target size, clipping and overlap rules, at the default size, at 200% text and in landscape. |
| `test/browser/settings-truth.production.spec.ts`, `root-view-states.spec.ts`, `fixtures-empty-runtime.spec.ts` | both lanes | Open the panel through the handle (they used the removed top-edge swipe). |
| `AccessibilityInstrumentedTest.homeShadeSettingsAndComposerAtDoubleFontScale` | emulator | A swipe from the top edge leaves Alpha's panel closed; a swipe beside the handle opens nothing; the accessibility click action on the handle opens the panel; a pull from the handle opens it. Compiled at this source, not run. |

## Left to the owner

Recorded in [core loop status](core-loop-status.md#gesture-zones-and-the-notifications-panel-round-8),
not decided here:

- Whether, on the AOSP image, Alpha's notices and quick-settings tiles should live in
  Android's shade (a SystemUI change in the image) instead of in a panel inside Home.
- Whether Home should also open Android's shade on a downward swipe, as stock launchers do
  (that needs `EXPAND_STATUS_BAR` and a decision that Alpha drives the system shade).
