# Photos — notes

## Review (before building)
- The old build had no Photos app, only a "Photos" label that opened AOSP. The only link to the story was Priya's message "Sent you the photos from Saturday", so the seed library is built around that Saturday at Ocean Beach, plus a hike, a birthday in Portland, Tahoe, screenshots and a receipt. Dates are relative to today, so "Saturday" always has photos.
- No images are allowed, so every photo is a layered CSS background on a 3:4 frame, built by `phScene(scene, figs, tone)`. The scenes are beach, sea, sunset, sunset over water, mountain with a snowcap, lake, forest, park, city, night, cafe, food, whiteboard, two screenshots, receipt, poster with QR code, portrait, selfie and birthday. Head-and-shoulder silhouettes stand in for people. `phLook()` applies the saved zoom, crop, rotation and filter, so thumbnails, viewer, editor and the camera thumbnail all render the same way.
- Tabs: bottom tabs would fight the chat pill, and a segmented control adds a label row. The header is two serif words, **Photos** and **Albums**; the active one is black and the other grey. That gives a toggle with no extra row and no superheader.
- Albums would be clutter as a list of labelled sections. The page is a row of faces (People), square tiles (your albums, Favorites, Videos, places with at least 3 photos, Screenshots, Documents), and one "Recently deleted" row. An empty album is hidden.
- Search has no search field. The magnifier opens chat with "Find photos of " filled in, and results show as a blue filter chip with ✕ and a count. Back also clears the filter.
- Delete needed an Undo, and the shell toast has no action button. I built an in-app snackbar (5 s) and a Recently deleted album where tapping a photo restores it and a trash button empties the album.

## Implemented flows
- **Library**: 3 columns with 2px gaps, grouped by day. Each group has a minimal label (Today / Yesterday / weekday / "Sep 13") plus its most common places in grey. Videos show their length and favorites show a small heart.
- **Viewer** (`{dark, noPill}`): full-bleed 3:4 photo.
  - Swipe left or right moves through the list the photo was opened from (library, filter or album), with a slide-in; at the ends it bounces.
  - Tap hides or shows the controls. Swipe down closes; swipe up opens info.
  - Edge swipes and home swipes still work: they are forwarded by hand because `api.sw` stops propagation. The viewer uses pointer capture so a swipe that ends on another button still counts.
  - Top: back, day, place · time, and an α button that sends "What's in this photo?".
  - Bottom: share, favorite (filled heart), edit, info, delete. Videos have play/pause and a progress bar.
- **Info sheet**: date, time, Alpha's one-line description, place row → maps `{query}`, people chips → contacts `{open}`.
- **Editor**: rotate, crop toggle, and Original, Vivid, Warm, Cool, Mono, Fade and Noir filters with live previews. ✕ discards and ✓ saves into the item. Back cancels.
- **Share sheet**: people (tap sends and shows a toast) and apps: Messages `{compose:true}`, Mail `{compose:{subject}}`, Copy link and Files. It works for one photo or a selection.
- **Select**: hold a thumbnail (480 ms) or use the select button. The count shows as the title. The bottom bar has share, favorite (toggles all) and delete. The pill is hidden in select mode (`immersive → {noPill}`).
- **Delete**: moves to `trash` and shows Undo. In the viewer it moves to the next photo.
- **Back order**: sheet → editor → viewer (returns to Camera if opened from Camera) → select → album → filter → Albums tab → Home.
- **Deep link** `{open: id}` (also `seq`, `from`). Presets: `photos:viewer`, `photos:albums`, `photos:search`. No badge.
- **reply()**:
  - "find/show photos of maya at the beach", "saturday", "videos from tahoe", "favorites", "screenshots" filter the grid and return a result card. The parser handles people, weekdays, today/yesterday/weekend, months, types and tags/place words.
  - "make an album of the hike [called X]" creates a persistent album and opens it.
  - "send the last photo/video to maya" returns a draft card; its Send action calls `photos.sendPhoto` and shows a toast.
  - In the viewer: "what's in this photo", "favorite this", "delete this", and "make it warmer / black and white / vivid / original" (applied directly as an edit).
- **Persisted**: `list`, `trash`, `albums`. Camera prepends to `list`.

## Shell requests
- **Launch regex eats queries**: `^(open|show|go to|launch) (\w+)` turns "show photos of Maya" into "Opening Photos." and drops the filter. Only treat it as a launch when nothing meaningful follows, or ask the module's reply() first.
- **Global reply order**: modules earlier in ORDER get first shot at global messages. Photos now wins "photos from today" (checked), but any module regex on a generic word ("today", "send … to") could take a photo request. Module regexes should require their noun.
- **Chat panel text selection**: an edge-back swipe that starts over the chat panel (it has `user-select: text`) sometimes selects text and shifts the page, and back doesn't fire. It is reproducible in the harness. Suggested fix: `user-select: none` on the panel while a gesture is in progress.
- **Messages deep link**: `{compose}` can't take an attachment. Suggest `{compose: personId, attach: {kind: "photo", id}}` so sharing to Messages can show the photo.
- **Toast with action**: `api.toast(msg, {label, fn})`. It would replace my in-app Undo snackbar. The current toast also covers the viewer header.
- **build.py**: E2BIG, see notes/camera.md.

## Round 2 (SPEC.md)
- **Header**: a single serif title ("Photos", or "Albums" on that tab), a compact icon toggle for Library/Albums styled like Phone's, and Search and Select buttons. The two-title header is gone.
- **Search**: the search button turns the header into a filled field with ✕. Results filter live as you type; each word only needs to match the start of a person, a place or tag word, a weekday or month, "today" or "yesterday", or a type such as videos, screenshots or favorites. Plurals work too ("sunsets"). No matches shows the standard empty state. The last row is "α Ask Alpha: '<q>'", which sends the query to chat. When Alpha filters from chat, the result still shows as a chip, now with the count inside it ("Maya · Beach 4 ✕").
- **Undo**: my own snackbar is removed. Deletes use `api.toast("Photo deleted" / "3 photos deleted" / "Video deleted", {undo})`.
- **Emptying Recently deleted** is permanent, so it now asks first in a sheet (serif title, Cancel and Delete side by side, Delete in `--fg`).
- **Select mode** hides the video-length and heart badges on thumbnails so they don't clash with the selection circles.
- **Editor** commits with the standard "Save" pill.
- **Sheets**: the empty-state icon is 28px and the album title is 26px. The chat pill is hidden while a sheet or the search field is open.
- **Gestures**: my own edge and home-swipe forwarding is removed; the shell's gesture zones now handle those, and the shade can be pulled down over the viewer. The viewer handles horizontal swipes (next/previous) and vertical ones (down closes, up opens info). In secure mode, swipe up is passed to the shell by returning false.
- **Back stack**: the viewer's ‹ button now calls the shell's `{{back}}`, and swipe-down closing triggers that same button. `phBack` returns false for a viewer opened from another app (`from` is set and the stack is non-empty), so back lands in Camera or the calling app with its state intact. The old "open Camera again" workaround is gone. `from` now defaults to "link"; tapping a photo in the grid clears it.
- **Secure mode**: Photos opened from the lock-screen camera only lists this session's captures (`camera.session`), so swiping never reaches the library. Share, info and Ask Alpha are hidden. Deleting the last session photo shows a "No photos" viewer, and back from it returns to Camera.

### Shell requests (round 2)
- `api.sw` drops its options: `sw: function (fn) { return self.sw(fn); }` should pass `opts` through. As written, `{axis}` never reaches the shell. I don't need it (I handle every direction and return false where I want the shell to act), but other apps may.
- The undo snackbar sits 40px from the bottom when there's no pill, so in immersive screens it covers the viewer's action row for 5 s. Let `immersive()` set a snackbar offset (e.g. `toastBottom: 104`).
