# Inbox (email) — review notes

## What didn't make sense / was redundant / missing (old Main.dc.html)
- One list mixed texts, email and system alerts, with type filters (All / Messages / Mail / Alerts). Texts now live in Messages, alerts in the shade, so the type filter was redundant. The chip row is now an **account** filter.
- Tapping a row never opened the email. It jumped straight to a chat draft, so you couldn't read the email, see the attachment or act on it by touch. **Added a detail page.**
- "need" dimmed rows at 60% opacity, a second read-state signal next to the dot. Now there's one signal: unread rows are bold with a blue dot and sort first. No section headers.
- Missing: compose, forward, delete, a Sent view, undo, empty state, add-account entry, attachments, search, and support for multiple accounts.
- Archive gave only a toast. It now shows an **Undo** snackbar, and so do delete and discarding a draft.

## What I changed (round 2 applied)
- Header: serif "Inbox" with search and "+" (compose). Search turns the header into a filled field with ✕ and filters the current scope live by sender, subject and body. It has an empty state ("No results"), and the last row is "Ask Alpha: '<q>'", which sends "Find emails about <q>" to chat. Back closes search.
- Chip row holds only text chips: All · one per account from `settings.accounts` (label, or a fallback) · Sent. "Add account" moved out of the row: it's a chip in the empty state ("No mail"), which deep-links to `settings {page:"accounts", adding:true}`.
- Row: sender, a paperclip when there's an attachment, time, subject, snippet, and an unread dot (`--acct`), with unread rows sorted first. Swipe left archives through the shared snackbar ("Standup notes archived" · Undo). Swipe right has Alpha draft a reply (a draft card that sends through `inbox.sendDraft`). Vertical swipes and the edge zones pass through to the shell.
- Detail: the header has ‹ (shell back) · reply · forward · archive · delete. Below the content: subject in serif, sender (tap opens contacts), "To Work · 1:12 PM", body, attachment chips (open `files {open}`, or toast when the file is unknown), and one α chip, "α Draft reply". Archive and delete use the shared undo ("Revised term sheet deleted"); undo reopens the mail.
- Compose (pill hidden): ‹ discards through the shared undo ("Draft to Jordan discarded"). The rest is unchanged: From cycles accounts, To has chips with suggestions or a raw address, then Subject, attachments and Message, with a round accent ↑ to send.
- Back stack: sub-pages opened inside Inbox close back to the list. A mail or compose that was deep-linked (shade, Contacts "Email", Files share, chat nav) hands back to the shell (`back()` returns false), so you return to the app you came from. Undo for a draft discarded that way reopens Inbox with the draft.
- A mail is marked read when it closes or on `onLeave`. `onLeave` no longer clears `open`, so returning from Files via the stack restores the mail.

## Flows implemented
List → filter by account → Sent → search (live filter, empty, Ask Alpha row, back closes) → empty account → Add account · open → attachment → reply → discard → undo → back → back · archive/delete from detail + undo · swipe left archive + undo · swipe right → draft card → Send → appears in Sent · compose → pick person → subject/body → switch From → send · raw address · Add account → Settings · α from detail → draft card · deep links `{open: id}`, `{compose: {to, subject, body, acct?, attach?}}` (`to` may be a person id, an address or an array) · files "Share by email" arrives with the attachment chip.

Chat (`reply()`): "summarize my inbox" (summary card), "any new emails", "email jordan about X" / "email jordan saying X" (draft card with Send), "email lena" (opens compose), "reply to jordan" (in Inbox or when "email" is mentioned), "find emails from/about X" (single result → card to open it; several → digest), "archive the rest" (archives read mail), "jordan's email". Inside a mail: "draft a reply", "summarize this email", "forward to maya". In compose: "write this for me", "make it shorter" (fills the body).
`actions.sendDraft(card)`: uses `card.mid` (reply to that mail, marking it replied/read) or `card.pid`, adds the mail to Sent, and toasts "Sent to <first name>".

Presets: `inbox`, `inbox:mail` (Jordan's term sheet), `inbox:compose`.
Flow scripts: `scratchpad/agA/flow_inbox.js`, `flow_integ.js`, `flow_share.js` (they use `common.js`).

## Shell requests
- `api.sw(fn, opts)`: the api wrapper drops `opts` (`sw: function (fn) { return self.sw(fn); }`), so `{axis:"x"}` never reaches the shell. My rows return `false` for vertical swipes as a workaround.
- The draft card could show `card.subject` for email drafts when it's present.
- Cross-app note: Settings' `{page:"accounts", adding:true}` deep link needs 2 backs to return to Inbox (Settings closes "adding" to its accounts page first). The same goes for Files preview (it needed extra backs). That's the other apps' call.
