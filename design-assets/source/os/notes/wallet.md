# Wallet — review notes

## Review (what didn't make sense / was missing)
- The old build had no Wallet (it was an AOSP stub). The only prior reference was the "receipts → add amount to Wallet" workflow, which fits the transaction list here.
- **Cards are brand-neutral.** No network logos. Each card is a coloured slab with a name, `•••• last4`, a chip block and a contactless mark. Alpha Blue (#0000FF) is the default. The others are Work (graphite, credit) and Household (stone). New cards get navy/graphite.
- **No section headers** ("Cards", "Passes"). The shapes tell them apart. Cards are an overlapping stack with the default in front. Passes are rows with a big serif title (SFO → JFK, Night Signals, Transit with its balance).
- **Transactions line up with the other apps:**
  - Tartine lunch (today)
  - Equinox SoMa monthly membership
  - GPU Reserve compute credits (Work card)
  - Sightglass / Philz / Blue Bottle coffee (the same shops as Maps)
  - The SFO → JFK flight on the Work card (it matches the boarding pass)
  - Transit reloads
- The side-key double-press cannot be detected from a module. Pay is instead reachable three ways: the contactless button in the header, Pay on a card's detail page, and "pay with my work card" in chat.

## Flows implemented
- **Pay** (`{pay:true, card?}`; immersive, dark, no pill):
  1. The screen shows the card. Swipe or tap the dots to switch; locked cards are skipped.
  2. Fingerprint button ("Touch to pay"), then "Hold near reader" with pulse rings.
  3. After about 1.9 s: success check, amount and merchant. The transaction is added to that card's list (persisted).
  4. Done, or the screen auto-closes after about 5 s.
  Back or ✕ cancels at any stage.
- **Card detail** (sub-page; `{open: cardId}`): the card, then a big Pay button and an α button. α asks "How much did I spend on my X card this week?", which gives a per-card summary. Below that:
  - Transactions with icon, merchant, day (Today / Yesterday / weekday / date), note and amount
  - Lock card toggle (locked cards are desaturated with a lock icon, and can't pay)
  - Default card toggle
  - Remove card: a confirm sheet with scrim; ✕, scrim or back cancels. Removing the default promotes another card.
- **Add card** (`{add:true}`, "+" in the header):
  1. Choose Scan or Type it in.
  2. Scan: an in-app dark scan frame. It auto-detects after 2.2 s and fills number and expiry, or you can pick "Type it in".
  3. Form: a live card preview, number (grouped by 4), MM/YY (slash added automatically) and name. Continue is disabled until the number is at least 15 digits and the expiry is valid; tapping it anyway shows a toast.
  4. Verify: a 6-digit code field. Alpha autofills it from Messages after 1.5 s ("Filled from Messages"), or you type it.
  5. The card is added to the persisted `cards` and its detail opens.
  Back steps are scan → choice, form → choice, verify → form, choice → closed.
- **Boarding pass** (`{open:"bp"}`): the route in big serif (SFO / JFK), then boards / departs / arrives / gate / seat / group, then a perforation and a QR-like block (SVG path on white, finder squares). "Add to calendar" shows a toast and becomes "In calendar" (persisted). A pin button opens Maps `{directions:"sfo"}`.
- **Event ticket** (`{open:"ticket"}`): Night Signals at The Warfield, date, doors, section, QR, add to calendar.
- **Transit** (`{open:"transit"}`): balance and a "+ $20" button, which reloads from the default card and records it on that card, plus recent trips.
- **reply() intents:**
  - "how much did I spend this week": a summary card with the total, the biggest merchant, the Equinox renewal and GPU Reserve. It can be per card ("on my work card", or "this card" while in detail).
  - "pay with my work card" / "pay": opens the pay screen on that card, and refuses a locked card.
  - "show my boarding pass": a gate/seat answer, a card, and the pass opens.
  - "add a card": opens the choice.
  - "lock / unlock my X card" (applied by `then`).
  - "transit balance".
- **Presets:** `wallet`, `wallet:card`, `wallet:pay`, `wallet:add` (prefilled form), `wallet:pass`.
- **Persist:** `cards` (with transactions, lock and default), `transit`, `trips`, `calAdded`, `pays`.

## Shell requests
1. **Side key:** double-press the side key to open `wallet {pay:true}` (the standard Android wallet gesture). A module can't see the key.
2. **Calendar:** a way to add an event from another app, for example `api.setView("calendar", {add: {title, t, d, day}})`. The calendar's events are a hard-coded constant today, so "Add to calendar" only shows a toast and marks the pass.
3. **Summary card:** the shell's `summary` card always shows a "Save to Notes" bookmark. With only `go` set, that button navigates instead. It would help to render the bookmark only when `act` is present, and make the card tappable via `go`.
4. The same `build.py` ARG_MAX problem as in maps.md. The full build currently fails with every module present.

## Round 2
- **Secure mode** (`api.secure`, from double-pressing the side key on the lock screen): only the pay screen renders. No card switching or dots, no list, detail, passes or add pages. Done, auto-close, ✕ and back all call `api.home()`, which the shell turns into a return to the lock screen. The preset `wallet:secure` simulates it.
- **Visual spec:**
  - Passes list uses sans 16/600 titles and a sans balance.
  - The card-settings group has 56px rows with no dividers.
  - The α button next to Pay was removed; the pill covers card questions through `suggestions()`.
  - The remove-card confirm sheet was replaced by immediate removal with the shared undo snackbar ("Work •••• 7703 removed · Undo").
- **Add card:**
  - Spec fields: filled `--s2`, 56px tall, 16px radius, leading icon, placeholder as the label.
  - New CVV field.
  - Inline validation: Luhn check shows "Check the card number"; the expiry shows "This card has expired" or "Use MM/YY".
  - The commit button is now the header "Next" / "Verify" pill, disabled until valid (`aria-disabled`). The bottom button is gone.
  - The scanned number is now Luhn-valid (4000 1234 5678 9017).
- **Add to calendar:** now calls `api.open("calendar", {add: {title, off, t, d, where, cal}})`. The calendar hasn't honoured `add` yet in my last run; it opened with its own suggestion card.
- Wallet → Maps directions to SFO passes only `{directions}`, so back returns to the pass.
