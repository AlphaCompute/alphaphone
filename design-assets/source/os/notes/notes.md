# Notes — review + changes

## What was wrong in the old Notes
- **Header plus only opened chat** with "Take a note: " pre-filled. Touch alone couldn't make a note. Now the plus opens a real editor (title `<input>` + `<textarea>` body) and saves as you type. A note left empty is dropped when you go back.
- **Tapping a note did nothing useful.** Text notes put "About X:" in chat, and recordings sent "Summarize my last recording". There was no detail view. Every kind now has one: an editor (text and checklist), a voice-note page and a link-clip page.
- **Recorder had pause, mark and stop.** Mark saved nothing and nothing read it back, so I dropped it. The controls are now **discard** (with undo), **stop and save**, and **pause/resume**. The recorder is immersive (`noPill`), so the pill never covers the controls.
- **Stopping a recording only showed a toast.** There was no way to reach the transcript or summary. Now stop opens the new voice note directly. It shows a short "Alpha is summarizing" skeleton, then the summary, the action items (a checklist) and the full transcript with speakers.
- A recording can't be lost by accident. The back gesture during recording stops and saves it, and leaving the app (Home) also saves it, with a toast.
- The list didn't support pinning, search or checklists. Now pinned notes come first (pin icon on the card), search is a header icon that turns into an inline field, and checklists are a kind of note.

## Flows implemented (all verified by flow script)
- **List:** two-column masonry, read row by row so pinned notes stay on top. Card kinds: text, checklist (live boxes), voice (waveform, length, to-do count) and link clip.
- **New note:** plus → editor → type title and body → back → the note appears in the list. Editor header has checklist toggle, pin, share and delete. Delete returns to the list with an **Undo** snackbar (5 s).
- **Checklist:** toggle converts lines to items and back. Items can be checked, edited inline and removed; "Add item" takes Enter or +.
- **Dictation:** a mic button at bottom right of the editor streams a scripted sentence into the body (or into a new checklist item). A pulse ring shows while it listens; tap to stop.
- **Record:** blue mic FAB (or `{record:true}`, or "start recording") opens the recorder. It shows a big timer, a live level waveform and transcript lines arriving with speaker chips (You / MC / SO). Pause greys out the timer and freezes it.
- **Voice note:** editable title, playback bar (play/pause, fake progress, tap a transcript line to seek), and Alpha summary. Action items can be checked off; the calendar button adds the open ones and shows a toast, and its icon becomes a check. Full transcript follows.
- **Share (any note):** a bottom sheet offers Messages (`messages {compose: firstSpeaker, text}`) or Email (`inbox {compose: {to, subject, body}}`). For a voice note the body is the summary plus "Next:" items.
- **Link clip:** highlights as serif pull quotes, plus a domain chip that opens `browser {url}`.
- **Back order:** sheet → sub-page → search → Home. During recording, back = stop and save.
- **Deep links:** `{open}`, `{record:true}`, `{compose:true}`. Presets `notes:editor`, `notes:rec` and `notes:voice`.
- **reply():**
  - "take a note: …", "note …", "jot down …" and "remember …" add a note (note card → opens it, via `then`).
  - "start recording" / "record this meeting" → recorder.
  - "summarize my last recording" and "what did we decide in the design sync" → summary card (`go` opens the note).
  - With a note open: "make this a checklist", "summarize this note", "share the action items with Maya" (draft card).
- **actions:**
  - `notes.save(card)` saves `card.body`/`card.bullets` as a new note. Other apps can use it for their summary cards; Files does.
  - `notes.sendShare`.

## Shell requests
1. **build.py fails with the full module set.** `node -e probe` raises `OSError: Argument list too long` once modules pass about 128 KB. Write the probe to a temp file and run `node file.js`. I built and tested from a mirror holding only messages, inbox, notes and files.
2. **Summary card button:** when a `summary` card has `go` and no `act`, its button still reads "Save to Notes" (bookmark) but opens the source. Please show an open-arrow (or hide the button) when there is no `act`.
3. **Test harness page scroll:** clicks in `test.js` sometimes scroll `document.documentElement` sideways (scrollWidth 676 vs 520 viewport), which breaks later edge-swipe backs. My flow resets `scrollLeft` before each tap. Suggest `overflow: clip` on html/body in the site build, or the same reset inside `h.tap`/`h.swipe`.
4. **Messages share contract:** the contract `messages {compose}` has no way to pass text. I pass `text` (messages' draft key), and it works today. Please add it to the contract.

## Round 2 (SPEC.md + review)
- **Recording keeps running in the background.** The tick uses `api.everyBg`, and `ongoing` shows a red "● m:ss" status chip that returns to the recorder. Only Stop or ✕ (discard, with undo) ends a recording; back = stop and save. Removed stop-on-leave.
- **No FABs.** Record is now a header `.ib` (waveform) next to "+". Search moved to a filled search bar at the top of the list, which keeps the header at 2 icons. Dictation is a mic `.ib` in the editor header; it fills with the accent while listening.
- **Recorder:** ✕ at the top left discards (undo via the shared snackbar). The "•••" row is gone: the first line starts right away and the current line types out as it's "spoken". The live dot is red; paused is grey. Controls: stop and pause/resume.
- **Voice note:** α mark instead of the sparkle; the "3 action items" label is gone. The calendar action is a chip ("Add to calendar" → "On calendar") at the bottom of the action-items card.
- **Shared snackbar:** `api.toast("<title> deleted" / "Recording discarded", {undo})`. My own undo bar is removed.
- **Search:** live filter, then an empty state (28px icon + "No matches"), then an "α Ask Alpha: '<query>'" chip that sends "Find my notes about <query>". A new `reply` handles that (1 hit opens the note; several hits open the list filtered).
- Share sheet follows the sheet spec (grab handle, serif title, ✕/scrim/back) and hides the pill. Share to Inbox/Messages relies on the shell back stack; back from compose returns to the note.
- Shell requests 1–2 above are resolved (build fixed; the summary card shows an open arrow for `go`). Still open: 3 (the harness horizontal scroll; my flow resets it) and 4 (`messages {compose, text}` in the contract).
