# Round 2: consistency spec + new shell APIs (read fully before changing your modules)

Two independent reviews walked every app. Everything below is now the rule for every app. The shell has already changed accordingly.

## New shell behaviour / APIs (already live in shell.js)
- **Undo snackbar is shared.** `api.toast("Revised term sheet deleted", { undo: function () { …restore… } })` shows the one standard snackbar (bottom, inverted pill, "Undo" button, 5 s). Plain `api.toast(msg)` is unchanged. **Delete every hand-rolled snackbar/undo bar in your module** and use this. Labels name the object ("Design review deleted", "Maya Chen deleted", "3 photos deleted").
- **Background activities.** Going Home or switching apps must NOT end a call, navigation, recording or video capture any more. Declare `ongoing: function (st, api) { return st.inCall ? { label: "0:42", icon: "phone", color: "#1e9e4a" } : null; }` (icon = an IC key; color optional, default accent; green for calls, accent for nav/recording). The shell shows a chip in the status bar that returns to your app; when your app is reopened while `ongoing` is non-null, its state is NOT reset. Timers that must keep running while your app is closed must use `api.everyBg(fn, ms)` / `api.laterBg(fn, ms)` and be stopped with `api.stopBg()` when the activity ends (`api.every/later` are still cleared when your app closes). Remove the "end it on leave" behaviour from `onLeave`.
- **Cross-app back stack.** When your app calls `api.open(otherApp, …)`, the shell remembers your app; the other app's `back()` returning false now returns to your app with its state intact (not Home). So remove app-specific return hacks where the stack now covers it (keep `ret`/`from` only if it still adds something).
- **System gesture zones.** Swipes that start within 30px of the left/right edge, in the top 90px, or in the bottom 43px always belong to the shell (back / shade / home). `api.sw(fn, { axis: "x" })` forwards vertical swipes to the shell (use it for horizontally swipeable rows/cards); `{ axis: "y" }` forwards horizontal ones. If `fn` returns `false` the swipe is forwarded too.
- **Secure mode.** Camera opened from the lock screen and pay opened by double-pressing the side key run with `api.secure === true`: the shell hides the pill and the shade, and opening any app other than camera/photos/wallet sends the user back to the lock screen. In secure mode your app must not expose private data: Camera → the thumbnail may only show photos taken in this session; Wallet pay → only the pay screen, no transaction history/other cards' details.
- Chat now starts empty (no seeded history). Replies with `nav` keep the answer visible ~1.3 s, then open the app in its default chat mode. Voice commands now also perform `nav`. The fallback reply is honest ("I can't do that yet…"); make sure your domain's obvious intents are covered so they don't hit it.
- The digest card rows are individually tappable; the event card shows "+" when it has an `act`, ✓ otherwise; the summary card shows a Save button only when it has `act`, an open arrow when only `go`.
- Home "Morning brief" card opens `workflows {open: 1, run: "latest"}`; Home "Design review" card and the shade notification open `calendar {open: "c4"}`.

## Visual/interaction spec (one pattern each)
| Element | Rule |
|---|---|
| Top-level header | 56px row, `.serif` 32px title, ≤2 `.ib` icon actions (20px icons, `--fg`). No chips/tabs/second title in it (a compact segmented icon control like Phone's is allowed for app tabs). |
| Sub-page header | `‹` (`.ib`, aria "Back to …"). Detail pages: object title below in content, serif 32–38px. List sub-pages (folder, settings page): serif 26px title inline after ‹. No divider lines under headers. |
| Primary create | "+" `.ib` in the header. **No FABs** (floating buttons collide with the chat pill). |
| Save/commit | Filled accent "Save" pill in the header (height 36, radius 18, 15px/600), **disabled (`--s2` bg, `--mut` text) until the form is valid**. Send stays a round accent ↑. |
| Search | Search `.ib` → the header row becomes a filled search field with ✕ → live filter → empty state; last row "Ask Alpha: '<query>'" sends the natural-language query to chat. |
| Ask Alpha | The pill is the system-wide, context-aware entry (your `suggestions()` feed it). Do NOT add extra "Ask Alpha" buttons/FABs next to it. Allowed only: (a) one content-specific α chip for a concrete intent (e.g. "α Prep me" on an event, "α Reply" in a thread composer, "α What's this" in camera) and (b) inside immersive screens where the pill is hidden. The α glyph (Fraunces italic) is the ONLY Alpha mark — **no sparkle icons anywhere**. Chip style: height 36, radius 18, `--s2` bg, α in `--acct` then 14px/600 text. |
| Snackbar | Shell's `api.toast(msg, {undo})` only. |
| Bottom sheets | Scrim + sheet with 28px top radius and grab handle; serif 26px title; one `--mut` line max; buttons side by side (Cancel `--s2`, primary accent). Close by scrim, ✕, back. The chat pill must not cover sheet buttons (hide it via `immersive` while a sheet is open if needed). |
| Toggles | 52×32 accent track, white knob. Rows in a `--s2` group card, 56px rows, no dividers. |
| Form fields | Filled `--s2`, height 56, radius 16, leading icon, placeholder as label, 16px text. |
| Destructive | `--fg` text/icon with trash icon, never accent blue. Irreversible → confirm sheet; reversible → delete immediately + undo snackbar. |
| Empty state | Centered 28px line icon + 1–3 words in `--mut`, optional one chip action. |
| Dots / live indicators | Unread dots, live dots and small accent marks use `--acct` (not `--acc`, which is invisible on black). |
| Superheaders | None. No `.mono` labels like WHEN/READ/"Alpha can"/"3 action items". Use icons or nothing. |
| Colour | One accent. No extra hues for categories (file types, calendars, etc.) — use `--fg`/`--mut`/accent and shapes/icons to differentiate. Exceptions: red for recording/live capture and end-call, green for accept/ongoing call. |
| Lists | Sans titles 16px/600, secondary 13–14px `--mut`. No serif in list rows (serif = page titles and hero numbers only). |

## Process
Keep your existing flows working. Rebuild with `python3 build.py --out /tmp/<you>` (the build now includes all modules and works), re-run your flow scripts (update them for the new snackbar/back-stack/gesture behaviour), read light + dark screenshots, zero page errors. Then reply with a short summary of what you changed. Don't edit shell files or other apps' modules; put any remaining shell requests in your notes and your reply.
