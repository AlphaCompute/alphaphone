# Messages (SMS / RCS) — review notes

## What didn't make sense / was redundant / missing
- Texts used to be rows inside Inbox, and tapping one only produced a chat draft. There was no thread, no history, no way to type your own reply, and no call or contact link. Messages is now its own app with real threads.
- The heads-up "Reply" and the shade notification pointed at Inbox. They now land in `messages {thread: "maya"}`, and the draft card goes through `messages.sendDraft`.
- Missing: new conversation (person or number), sending, attachments, smart replies, and unread state that clears correctly.

## What I changed (round 2 applied)
- List: serif "Messages" with search and "+" (new message). Search swaps the header for a field with ✕ and filters by name, number and message text; when the match is in a message, that message shows as the preview. Empty state "No results", and a last row "Ask Alpha: '<q>'" that runs chat "find texts about …". Rows show an avatar, name, time, last message ("You:" / "Photo"), and an unread dot (`--acct`).
- Row swipes: left deletes the conversation with the shared undo ("Conversation with Dad deleted"). Right toggles read/unread. Vertical swipes pass through to the shell.
- Thread (pill hidden, no header divider): ‹ (shell back) · avatar + name (opens contacts) · call (opens phone). Bubbles: mine accent, theirs `--s2`, with sparse timestamps.
  - Above the composer: one α chip, "α Reply" (spec chip style), followed by the smart-reply chips.
  - Composer: + tray (camera and 4 photos), input, round ↑.
  - A scripted reply follows your message, with typing dots.
- Back: tray first, then the thread or picker. If the thread or picker was opened inside Messages, back returns to the list. If it was deep-linked (Contacts, shade, heads-up, chat, share), `back()` returns false, so the shell stack returns to where you came from (verified: Contacts › Message Jordan › back → Contacts).
- New message: a "Name or number" picker (people filter, "Text <number>" for 3+ digits).

## Flows implemented
List → thread → type/send → typing → reply → smart chip → attach tray → photo → back closes tray, then thread · α → draft card → Send → bubble in thread + "Sent to Maya" · call · contact · new message → search person → thread → back · new message → number → send · deep links `{thread: pid}`, `{compose: pid | true}` with optional `text` prefill and `attach: [fileIds]` (from files/notes/maps/browser share) · heads-up Reply → `sendDraft` · shade notification → Maya thread · search → filter → empty → Ask Alpha · swipe delete + Undo · swipe mark unread/read · Contacts → thread → back → Contacts.

Chat (`reply()`): "text maya I'm running late" / "tell dad …" (draft card), "text jordan" (opens thread), "reply to maya" / "reply for me" in a thread (draft of the top smart reply), "what did priya send" (latest message + photo count, card opens thread), "any new texts?" (digest), "find texts about/from X" (digest with tappable rows). Returns null for "tell me …", numbers and unknown names.
`actions.sendDraft(card)`: resolves `card.pid`, else the first name in `card.to`. Adds the body as a sent bubble, clears unread, triggers the scripted reply, and toasts "Sent to <first name>".
`badge()`: any unread > 0.

Presets: `messages`, `messages:thread` (Maya), `messages:new`.
Flow scripts: `scratchpad/agA/flow_messages.js`, `flow_integ.js`, `flow_share.js`.

## Shell requests
- `api.sw` drops the `opts` argument (see inbox.md). I work around it by returning `false` for vertical swipes.
- Contacts' `{open: pid}` deep link needs 2 backs to return to the thread (Contacts closes its detail to its list first).
