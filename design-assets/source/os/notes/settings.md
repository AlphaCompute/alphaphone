# Settings — review notes

## What didn't work in the old screen
- The whole character block (name, 4 voice chips, 3 sliders, 3 toggles) sat on top. Accounts, the most important thing to reach, started below the fold. Sliders in a scrolling list also get dragged by accident.
- Every row below that was a toast ("Connections", "Enclave sealed"…). No sub-pages, no back, nothing you could actually change except the theme, which a tap on "Appearance" just flipped.
- There were no accounts or connected-app permissions, even though the agent reads mail, calendar and contacts. "What can Alpha see?" had no answer anywhere.

## Decisions
- **Character becomes a compact card, not the full block.** The avatar and the editable name stay inline at the top, because renaming is the one edit people make often. It updates the shell live through `api.shell({charName})`. One row under it ("Warm · Brief · Casual ›") opens the Character page with the voice chips (tap one to hear a preview; the chip animates), the three sliders and the three toggles. Accounts is now visible without scrolling.
- **One page renderer.** Every page is data: a hero plus groups of typed rows (nav, toggle, slider, segmented, info, input, button, log, account). Each sub-page gets the same `‹` header, row style and back handling. Pages stack (`stack[0]` is the top level); you can go up to two levels deep, plus a bottom sheet.
- Grouped grey cards (`--s2`, 26px radius) with no section headers. The one exception is the small "Alpha can" caption above the access controls, which says who the permissions are for.
- **Access is one control per data type:** `Off / Read / Act`. Off turns sync off, and Act means "can send and change things, after asking". The toggles in the account list are quick icon switches for Mail, Calendar and Contacts sync.
- **Anything you can't undo gets a confirm sheet:** removing an account, wiping memory, forgetting a network. Removing an account also shows an Undo snackbar for 6 seconds and puts the account back where it was. Sheets hide the chat pill (`immersive → noPill`) so their buttons aren't covered.
- Quick settings stay in sync: Wi-Fi, Bluetooth, Airplane and Do not disturb read and write `S.q`. Brightness writes `S.bright`, and the theme writes `S.theme`.
- Row values show state, not labels: Wi-Fi shows the network name, Bluetooth shows the connected device, Privacy shows "Sealed" (or "Fallback on"), Accounts shows the count.

## Flows implemented
- Rename the agent inline or on the Character page (the shell name updates, and "Hey <name>" follows). Voice preview, sliders, toggles.
- Accounts: a list with per-type sync toggles, then account detail (Off/Read/Act per type, last sync, Remove, then a confirm sheet, then an Undo snackbar).
- Add account: provider picker (Google, Microsoft, iCloud, Other with IMAP/CalDAV/CardDAV), then sign-in (email and password; Other also asks for a server; the button stays disabled until the email is valid), or "Continue in browser" to an OAuth-style consent card with Allow. Then permissions (Off/Read/Act per type), then an "Added" confirmation that returns to the list on its own after 1.6 s, or on Done. The deep link `{page:"accounts", adding:true}` (also `addProv` + `addStep:"signin"`) opens straight to the picker, and back from there returns to the accounts list.
- Connections (Slack, GitHub, Notion, Linear, Figma, Spotify): tap one to open a sheet with its scopes and Connect or Disconnect.
- Privacy & Enclave: seal status, what leaves the device, and a link to the on-device model. Per-permission pages (mic, location, camera, contacts) list each app with a toggle. The Activity log includes the browser booking once it's confirmed, with a link to Workflow runs. Memory size, and Wipe with a confirm.
- Wi-Fi (on/off in the header, the connected network as hero, networks list, password sheet (≥8 chars), Forget), Bluetooth (connect or disconnect saved devices, pair a new one after a scan), Mobile data (data, roaming, airplane, usage).
- Display (Light/Dark segmented → shell theme, brightness → shell, text size with a live "Aa" preview), Sound (three volumes, vibrate, DND), Notifications (agent summaries plus a toggle per app built from `ORDER`), Battery, Models (Core 7B hero, cloud fallback toggle, downloads with progress), Developer (runtime stats, verbose logs, mono log, Export → Files/Downloads), About (versions, check for updates).
- Chat intents (`reply`): dark/light mode · "call yourself X" / "rename you to X" · "what can Alpha see" (summary card) · connect/add email/account (the provider picker, or straight to sign-in for gmail/outlook/icloud; "work" opens the existing work account if there is one) · remove my work account (opens the confirm sheet) · Wi-Fi/Bluetooth on/off · "connect to <network>" (asks for a password if it needs one) · brightness · text size · shorter/longer/casual/formal/ask first/act first · change your voice · wipe memory (confirm on screen) · cloud fallback · connect/disconnect <app> · notification summaries · "<page> settings" · battery.
- Deep links: every `{page}` in the contract, plus `mobile` and `battery`.

## Verified
- Flow script: `scratchpad/agG/flow-settings.js`. It covers rename (and checks the shell), theme, both add-account paths, sync toggle, remove plus undo, back order (sheet, then detail, then page, then Home), the deep link, Wi-Fi password connect and off, Bluetooth pairing, connections, privacy permissions, activity, wipe, model download, every other page, and chat intents. Light and dark screenshots checked. It passes in my minimal build and in a full build of all 14 modules.

## Shell requests
1. **`build.py` fails with all modules present:** `OSError: Argument list too long` because the whole bundle is passed to `node -e` (limit 128 KB). Write the probe to a temp file and run `node file.js`. I tested with a private copy that does exactly that.
2. **Harness:** the stage (960 px scaled) is wider than the 520 px test viewport, so `html` can be scrolled. After a control has focus, `h.back()`'s mouse drag sometimes scrolls the page by about 128 px and the swipe is lost. My flows blur and call `scrollTo(0,0)` before each back. `html,body{overflow:clip}` in the site page would fix this.
3. The toast (top 54px) sits over sub-page header titles. Consider placing it lower (for example above the pill).
4. Cross-module: **calendar's `addVerb` (`^book…`) grabs "book a table for 2 at 7:30"** when said from Home, before the browser sees it. Calendar should skip `book a table` / `reserv`.

## Round 2 (SPEC.md + review)
- The pulsing ring only appears on the Character page now, with enough padding that it doesn't get clipped or overlap the name. The Settings home avatar is static.
- Destructive rows (Remove account, Wipe memory, Forget network) use `--fg` with a trash icon. None of them are blue any more.
- Accounts list: the icon-only sync toggles are gone. Each row now shows the provider tile, the address (sans, 600), and a secondary line with label · provider · what's syncing. Per-type access lives only in the detail page. The "Alpha can" superheader is removed, and the account email in the detail is sans.
- Removing an account is reversible, so it now happens straight away with the shared `api.toast(msg, {undo})`. My own snackbar is deleted. Wipe memory and Forget network still use confirm sheets. Sheets now have a 28px top radius, a serif 26 title and a ✕.
- Sign-in fields follow the spec: filled `--s2`, height 56, radius 16, with a leading icon.
- Page scroll-shift: Playwright's click scrolls the over-tall stage document. A per-render `ref` on the module root now resets window and screen scroll, so the status bar is never clipped.
- Airplane mode now matches the shell: turning it on also turns Wi-Fi and Bluetooth off, and turning it off restores them (`prePlane` is kept in settings state). There's also an "airplane mode on/off" chat intent.
- Removed the sparkle icons (Agent summaries now uses the bubble icon; Alpha's permission row uses the user icon).
- Remaining shell request: the site page should use `html,body{overflow:clip}` so no module has to undo stray scrolling.
