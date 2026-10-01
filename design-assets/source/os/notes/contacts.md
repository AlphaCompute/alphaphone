# Contacts: review notes

## What didn't make sense or was redundant
- **Quick actions duplicated the field rows.** Having both a row of action buttons and tappable phone, email and address rows means two controls for each action. Actions are now only the 4 round icon buttons (call, message, email, directions), shown only when the needed data exists. The field rows are plain values with an icon and no "Mobile" or "Home" labels.
- **Form labels.** The editor uses placeholders plus the same icons as the detail page, with no separate label text.
- **Delete confirmation dialog.** Replaced by immediate delete with an Undo snackbar. Undo restores the contact and reopens it.

## What was missing on an agentic phone (added)
- **α context card on the detail page**, built from Phone state: last or missed call, Alpha's call notes, and an unheard voicemail summary. Tapping it asks Alpha "Catch me up on <first name>".
- **Search** matches name, email, note and phone digits (3 or more). Back clears the search first. When nothing matches, one "+ <query>" button starts a new contact with the name (or the number, if the query has digits) filled in.
- **Birthday** shows the full month and a countdown when it's within 30 days ("October 11 · in 12 days").
- **The favorites star** feeds Phone's favorites row directly, because Phone reads `contacts.list`.
- **Chat can edit the list directly**, not just navigate to it (see below).

## Data
- `st.list` is persisted. It is seeded from `PEOPLE`, with `first`/`last`, addresses and birthdays added, plus 4 more people (Ana, Ben, Kenji, and Olivia, who is the landlord). Each entry keeps `id, name, ini, phone, email, fav, note` so other apps can use `api.get("contacts").list` in place of PEOPLE.
- New contacts get the id `<first name><number>`. Phone numbers with 10 digits are formatted on save.

## Flows implemented
1. List: live search, favorites avatar row, alphabetical groups, and a + button. Back clears the search.
2. Detail (sub-page, z-index 4): back, favorite toggle, edit, delete (with undo); call (Phone `{call, ret}`, so ending the call returns to the contact); message (Messages `{thread}`); email (Inbox `{compose: {to}}`); directions (Maps `{query: address}`); the α context card.
3. Edit or add (sub-page, z-index 5): real inputs for first and last name, phone, email, address, birthday and note, with live initials. The ✓ save button turns accent-colored once there is a name or number. Back or ‹ discards the changes and returns to the detail page (for an edit) or the list (for an add). Save updates the list, which persists, and opens the detail page.
4. Back order: editor, then detail, then search text, then Home.
5. Links: `{open: id}`, `{edit: id}` (the detail page opens underneath, so back lands on it), `{add: true}` or `{add: {first, phone, …}}` for a prefilled form (used by Phone's info button on unknown numbers).
6. Chat: "add a contact Alex Kim 415 555 0100 alex@x.com" saves directly and returns a card that opens the contact; "add a contact" with nothing after it opens the editor; "what's Maya's number / email / address", "when is Dad's birthday", "edit Jordan's email" (opens the editor), "change Maya's email to …" (saves directly), "delete Lena from contacts" (with undo), "catch me up on Maya"; and "save it" / "discard" while the editor is open.

## Shell requests
- **`api.person(id)` should check `vget("contacts").list` first**, so contacts that were added or edited show up in Messages, Inbox and other apps.
- **Maps:** `{query: "1450 Valencia St, San Francisco"}` currently shows "Nothing nearby". The Maps owner should treat a street address as a place or a directions target.

## Round 2 changes
- **Search now follows the spec pattern.** A search button in the header turns the header into a filled search field with ✕. The list filters live. With no results it shows the spec empty state: a 28px icon, "No matches", and an "Add '<query>'" chip that opens a new contact with the query filled in. The last row is "Ask Alpha: '<query>'", which sends the query to chat. Back or ✕ closes the search.
- **Editor:** Save is now a filled "Save" pill, disabled (`--s2`/`--mut`) until there is a name or a number. The fields are 56px high with a 16px radius and a leading icon; the name fields show a person icon. The avatar shows a person icon until there are initials. The list rows use 16px/600 text.
- **Delete** uses the shell's `api.toast("<Name> deleted", {undo})`; Undo restores the contact and reopens it. The app's own snackbar is gone.
- **One Alpha entry point on the detail page:** the α context card stays as the only Alpha button there; nothing else was added.
- **Back stack:** message, email and directions rely on the shell back stack (checked: back from Messages returns to the contact). Only the call keeps `ret`, so ending the call returns to the contact without leaving Phone on the back stack.
