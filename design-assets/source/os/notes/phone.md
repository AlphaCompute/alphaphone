# Phone: review notes

## What didn't make sense or was redundant
- **Four tabs is one too many.** A Favorites tab repeats the favorites already kept in Contacts, and on an agentic phone most calls start from chat ("call Dad"). Favorites are now a row of avatars at the top of **Recents**, and the phone has 3 tabs: Recents, Keypad, Voicemail. The `{tab: "favorites"}` link opens Recents.
- **A title plus a separate tab bar was redundant.** The title is the current tab's name. The three tab icons form a segmented control on the right of the same header row, so nothing sits near the pill at the bottom.
- **Recents labels** such as "Mobile" and "Outgoing call" are gone. A direction arrow with the time and duration says the same thing. Missed calls show the name and arrow in the accent color.
- **Contact details inside Phone** would duplicate Contacts. The info button opens Contacts `{open}`. For an unknown number it opens Contacts `{add: {phone}}` with the number filled in.

## What was missing on an agentic phone (added)
- **Alpha notes in Recents.** Calls Alpha took notes on, or screened, show a one-line α summary under the row (for example the Jordan term-sheet call, and a spam call Alpha declined).
- **Alpha button during a call.** It shows a live transcript, and when the call ends the summary is saved to that call's Recents entry, with a toast.
- **"Alpha answers" on an incoming call.** Alpha screens the call. Transcript lines appear live, then a summary card, and you can still pick up or hang up. The ringing screen also shows a line of context ("Probably about the 3:00 design review").
- **Declining a call leaves a voicemail**, which shows up about 2.6 s later with a toast. The home icon badge shows while any voicemail is unheard.
- **Back during a call minimizes it** instead of ending it or doing nothing. A blue call banner (name, timer, end button) appears above the tabs, and tapping it returns to the call.
- **Return to the caller:** `{call, ret: {view, patch}}`. Contacts passes `ret`, so ending a call started from a contact returns to that contact. Other apps can ignore it, and the call then ends on the previous Phone tab.
- **Keypad:** the display formats the number as you type. It suggests a contact from digits in their number or from T9 on the first name, and tapping the suggestion fills the number. Pressing Call with nothing typed fills the last number you called (redial).
- **Undo snackbar** when you delete a voicemail.

## Flows implemented
1. Recents: tap a favorite or a row to call back; the info button opens Contacts (or a new-contact form for an unknown number).
2. Keypad: type digits, see the suggestion, delete, call a contact or a raw number, and end the call to return to Keypad.
3. Outgoing call (immersive): "Calling…" with a pulse, connected after 2.4 s, then a running timer. Controls are mute, keypad (DTMF digits), speaker, hold ("On hold · m:ss") and α notes (live transcript). End adds a Recents entry and returns to the previous tab.
4. Back order during a call: in-call keypad first, then minimize to the banner. The banner can restore the call or end it.
5. Incoming (`phone:incoming`): accept; decline (missed call, then a voicemail arrives); reply (quick-reply sheet, closed by ✕, scrim tap or back, and "Write…" opens Messages `{compose}`); Alpha answers (screening transcript and summary, then pick up or hang up).
6. Voicemail: expand a row (marks it heard), play and pause with simulated progress, call back, message, delete with undo, and back collapses the row.
7. Chat: "call maya", "call dad", "call maya back", "Call Dr. Patel's office" (matched from the voicemail label), "who called", "check voicemail" / "summarize my voicemail", and "take notes" / "hang up" during a call. The last two are only reachable by voice, because the pill is hidden during a call.
8. Links: `{call: id}` starts the call once, `{num}` calls a raw number, `{tab}`, `{incoming: id}`.
9. `onLeave`: ends and logs an active call, logs a ringing call as missed, and stops every timer.

## Shell requests
- **build.py:** the jump-probe runs `node -e <whole script>` and fails with E2BIG (argument list too long) now that most modules exist. Send the script on stdin instead: `subprocess.run(["node"], input=probe, …)`. I used a local copy that does this (/tmp/agB/build_local.py).
- **Shared global scope:** all modules run in one script scope. `photos.js` also defined `phFirst`, which overrode mine and crashed Phone. I renamed my helpers to the `pn*` / `PN_*` prefix and my icons to `IC.phone*`. Suggest wrapping each module in an IIFE in build.py.
- **The shell's `call` chat card hard-codes the initials "MC".** Use `{{m.c.ini}}`; Phone sends `ini` on the card. The card's button calls `phone.actions.hangup`.
- **No way to keep a call across apps.** A status-bar call chip would let a call survive leaving Phone. For now `onLeave` ends and logs the call, as the brief asks.
- **test.js:** some clicks leave the page scrolled sideways, and then `h.back()` swipes land outside the viewport. My flow resets `scrollLeft` after each tap; the harness could do this in `geo()`.

## Round 2 changes
- **Calls continue in the background.** Phone declares `ongoing`: a green chip in the status bar shows the running timer ("Calling…" while connecting). An incoming call shows "Incoming · Maya" and keeps ringing after Home is pressed. While Alpha is screening, the chip reads "Alpha · Maya". Call, connect and screening timers use `everyBg`/`laterBg` and stop with `stopBg`. Only End, Decline or Hang up end a call. `onLeave` now only stops voicemail playback and un-minimizes the call, so the chip opens straight to the call screen. Starting a new call while one is live logs the old call first.
- **Unknown numbers:** the row's info button becomes an add-person icon labelled "Add <number> to contacts". Unknown voicemails also get an add-person button. Both open Contacts `{add: {phone}}`.
- **Voicemail:** the action buttons are 44px `.ib`, and their icons line up with the text column. Delete uses the shell's `api.toast("Voicemail from Dad deleted", {undo})`; the app's own snackbar is gone.
- **Colors:** end and decline are red; accept, dial and the in-app call banner are green; unread and tab dots use `--acct`. The reply sheet has a 28px top radius, a grab handle and a serif 26px "Reply" title.
- **Returning to Contacts after a call:** the `ret` behavior stays, because it adds something the back stack doesn't. When a call started from a contact ends, the phone returns to that contact automatically and removes Phone from the back stack, so a later back never lands on an empty dialer. Calls started from other apps (Messages and so on) rely on the shell back stack.
