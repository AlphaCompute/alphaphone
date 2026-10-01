# Files — review + changes

New app; there was no Files in the old prototype. Design choices:
- **Top level:** no superheader. Five location tiles (Downloads, Documents, Receipts, Recordings, Photos → opens the Photos app) and a storage tile with a bar and "218 GB free". Below them, the five most recent files. Search is a header icon that turns into an inline field and searches across folders.
- **Folder:** a sub-page with a back button and the folder name. Three icon actions: sort (date ↔ name, highlighted when set to name), list ↔ grid, and select. There is no breadcrumb: back walks up (Northpoint → Documents → Files).
- **File types** show as colored chips with icons: PDF red, doc blue, image green, audio purple, archive amber. These are the only non-token colors.
- **Preview:**
  - PDF/doc: fake paper pages, with a real key/value table on page 1 (the term sheet has actual terms). Paper is slightly dimmed in dark mode.
  - Receipt: a mono receipt slip. Photo: a drawn image.
  - Audio: waveform with play, plus **Transcribe** → creates or opens a voice note in Notes.
  - Archive: contents list.
  - Header actions: share, move, delete. The file name is the rename button.
- **Ask Alpha** is a labelled FAB on the preview. It shows a skeleton, then an inline summary card with a "Save to Notes" bookmark (uses `notes.save`).

## Flows implemented (all verified by flow script)
- Browse locations and folders, including a nested folder, in list or grid, sorted by date or name.
- Open → preview → **rename** (inline input keeps the extension; Enter or ✓ saves, Esc or back cancels).
- **Move:** a bottom sheet of folders, with a check on the current one, then a toast.
- **Delete** shows an Undo snackbar that restores the file at its old position.
- **Share:** a sheet with Messages (`messages {compose, text}`) or Email (`inbox {compose: {to: sender, subject, body, attach}}`).
- **Select mode:** the header becomes ✕, a count (tap to select all), share, move and delete. Rows show check circles. Multi-delete has undo.
- **Back order:** sheet → rename → preview → select mode → folder → parent folder → search → Home.
- **Deep links:** `{folder:"Downloads"|"Documents"|"Receipts"|"Recordings"|"Northpoint"}` and `{open:fileId}`. `termsheet` exists (Inbox's attachment opens it). Presets `files:folder` and `files:preview`.
- **reply():**
  - "find the term sheet" → file card, opens the preview.
  - "show my receipts" / "total my receipts" → opens Receipts.
  - "summarize this pdf/file" (or "…the term sheet") → summary card with Save to Notes, and the inline summary is marked as shown.
  - "what's taking up space".
  - "send this to Jordan" (with a file open) → draft card.

## Notes / shell requests
- The Inbox attachment is named `Northpoint_TermSheet_v3.pdf` (212 KB). Per the brief, the file is "Term sheet v3.pdf"; I matched the size at 212 KB. Inbox could rename its attachment to match.
- Global "find the term sheet" can be answered by Inbox first if its `reply` matches "term sheet" (ORDER puts inbox before files). It works while Files is open.
- The same build.py and test-harness scroll issues as in notes.md.

## Round 2 (SPEC.md + review)
- **One accent.** The coloured type tiles are gone. Chips are `--s2` with `--fg` glyphs, a distinct shape per type (PDF: page with a block; doc: page with lines; image, audio wave, zip), and the type named in the subtitle. The grid thumb is `--bg` on the `--s2` card.
- **No Ask Alpha FAB.** The preview has one content-specific chip under the meta line, "α Summarize"; it shows the inline summary with the α mark and Save to Notes. `suggestions()` includes "Summarize this file".
- **Shared snackbar** with object names: "Northpoint_TermSheet_v3.pdf deleted", "3 files deleted". Undo restores files at their original index.
- **Folder header** now has 2 icons: a "View and sort" menu (List/Grid, Newest first/Name, with checks; closes by scrim or back) and Select. The folder title is serif 26.
- The term sheet file is renamed to **Northpoint_TermSheet_v3.pdf** (id `termsheet`, 212 KB) to match Inbox. Search and the "find …" reply ignore punctuation and case, so "term sheet" finds it.
- **Search** ends with an "α Ask Alpha: '<query>'" chip. The new "find <file>" reply opens the file; "find the term sheet", receipts and summarize are kept.
- The move and share sheets follow the sheet spec and hide the pill. The back stack covers Files → Messages/Inbox/Notes (Transcribe) → back.
