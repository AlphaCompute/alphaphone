# Phone prototype — app module contract

An interactive prototype of an agentic Android phone ("Alpha Compute phone, powered by elizaOS").
The agent is called **Alpha** (renamable). Target: Pixel 11 Pro portrait, screen **412 × 915** CSS px.
Everything is chat/voice-first, but every app must also work fully by touch.

Root: `/tmp/claude-0/-home-claude/e69a58fa-b2c6-5e36-812a-e26aace8e829/scratchpad/os/`

```
shell.html        device, home, lock, shade, chat, status bar, rail (DON'T EDIT)
shell.js          IC icons, PEOPLE, helpers, VIEWS registry, Component (DON'T EDIT)
modules/<key>.js  your app logic      (you own these)
modules/<key>.html your app markup    (you own these)
notes/<key>.md    your review notes   (you write these)
build.py          python3 build.py --out /tmp/<you>     -> /tmp/<you>/Main.dc.html + /tmp/<you>/site
test.js           NODE_PATH=$(npm root -g) node test.js /tmp/<you>/site <port> /tmp/<you>/shots [presets…] [--flow flow.js]
```
Reference module: `modules/calendar.js` + `modules/calendar.html` — copy its pattern exactly.
Previous single-file version (for existing markup of inbox, notes, browser, workflows, settings, chat cards, styles):
`/tmp/claude-0/-home-claude/e69a58fa-b2c6-5e36-812a-e26aace8e829/scratchpad/artifact-files/92f96d09-6a45-4d70-b7ad-83ee49c858bb/project/Main.dc.html`

## The template format (Design Component, `.dc.html`) — hard rules
- Holes are **dotted lookups only**: `{{photos.items}}`, `{{p.name}}`, `{{ic.back}}`. Never expressions (`{{a + b}}`, `{{!x}}`, `{{fn()}}` fail silently). Compute everything in `render()`.
- All your holes are namespaced under your key: `{{<key>.something}}`. Shared holes you may use: `{{ic.<icon>}}`, `{{name}}` (agent name), `{{back}}` (shell back).
- `<sc-if value="{{cond}}" hint-placeholder-val="{{false}}">…</sc-if>` and `<sc-for list="{{list}}" as="x" hint-placeholder-count="3">…</sc-for>` (always include the hint attrs). Inside a loop, `{{x.field}}` and `{{$index}}`.
- Events: `onClick="{{x.fn}}"`, `onChange`, `onKeyDown`, `onPointerDown/Up`. Handlers are functions you return from `render()`. For per-item handlers, attach a function to each list item.
- Attribute `x="{{path}}"` passes the raw value; `x="a {{p}} b"` interpolates into a string. Styles: inline `style="…"`, and a hole inside a style string is fine for state-driven values (`style="transform: translateX({{x.tx}}px); {{x.css}}"`).
- Close every element, quote every attribute. Real `<button>` for anything tappable (never onClick on a div/span), `aria-label` on icon-only buttons. `<input>` with `value` + `onChange`. No `<form>`, no `<select>`, no `<iframe>`, no `<img>` (draw photos, maps, cards with CSS/SVG shapes and color blocks), no emoji, no external URLs.
- The HTML parser rules apply: **never put block elements (div, h1, button with divs…) inside `<p>`**; use divs.
- Icons: inline stroke SVG `<svg class="i" viewBox="0 0 24 24" style="width: 20px; height: 20px"><path d="{{ic.name}}"></path></svg>` (stroke comes from the `.i` class; `fill: currentColor` in style for solid). Existing icons are in `shell.js` IC. Add new ones in your module file: `IC.shutter = IC.shutter || "M…";` (single `d` path, 24×24 grid, stroke style). Prefix new icon names with your key if generic (e.g. `IC.mapsRoute`).
- Available classes: `.i` icon, `.serif` (Fraunces light display), `.mono` (spaced caps — use sparingly), `.ib` 44px round icon button, `.tap` press state, `.scr` hidden scrollbar, `.enter` rise-in animation (sub-pages), `.drop` drop-in, `.dot` blink, `.bar` waveform bar anim, `.ring` pulse ring.
- CSS variables: `--bg --s1 --s2 --s3 --line --fg --mut --acc (Alpha Blue #0000FF) --acct (accent for text/icons) --scrim --shc`. Light and dark theme both must work — use vars, never hard-coded greys (except immersive black views like camera).

## Visual language
White (light) / black (dark), grey `--s2` cards with 22–30px radii, **one** accent (Alpha Blue). Titles in `.serif` 32px, body Public Sans 15–17px, secondary `--mut` 13–14px. Minimal: no superheaders, no redundant labels, no explanatory copy, icons instead of text where the meaning is clear. Touch targets ≥44px. Numbers/avatars as big simple shapes. Look at the existing screens in the old Main.dc.html and the reference calendar module and match them.

## Layout inside your app
- Your module root is `<div style="display: flex; flex-direction: column; height: 100%; position: relative">` filling the 412×915 screen.
- Status bar occupies the top 44px (drawn by the shell). Top-level header: `<div style="display: flex; align-items: center; height: 56px; margin-top: 44px; padding: 0 8px 0 20px; gap: 2px; flex-shrink: 0">` with `<h1 class="serif" …>Title</h1>` and 0–2 action `.ib` buttons. **No back chevron on the top level** (Home is the bottom bar).
- Sub-pages (detail, editor, compose…): an absolutely positioned overlay `position: absolute; inset: 0; background: var(--bg); z-index: 4` with class `enter`, header with a `‹` back button (`aria-label="Back to …"`) that closes that sub-page.
- Bottom sheets/modals inside your app: absolute panel at bottom with scrim behind; close by scrim tap, ✕, and back gesture.
- The shell draws a floating chat **pill** (α / keyboard / mic, 54px tall, centered, 26px from bottom) or **composer** (62px, 28px from bottom) over your app. Leave ≥120px bottom padding in scroll areas; don't put important controls in the bottom 100px unless you hide the pill via `immersive`.
- Full-bleed/immersive screens (camera, in-call, photo viewer, turn-by-turn) return `{ dark: true, noPill: true }` (and optionally `noStatus: true`) from `immersive()`.

## Module definition
```js
registerView("<key>", {
  title: "Photos", icon: "photo",          // home grid label + IC icon key
  aliases: ["gallery"],                     // words for "open <x>"
  chat: "hidden",                           // default chat mode when opened: "hidden" (pill) or "input" (composer)
  placeholder: "Ask about this page",       // optional composer placeholder when chat is "input"
  state: { … },                             // initial state for this app (reset every time the app is opened from Home)
  persist: ["list"],                        // state keys that survive reopening (user-created data!)
  jumps: [[null, "Photos"], ["viewer", "Photo viewer"]],   // rail shortcuts → preset(sub)
  preset: function (sub, api) { return {…statePatch}; },
  badge: function (st) { return st.unread > 0; },          // optional blue dot on the home icon
  immersive: function (st, api) { return st.viewing ? { dark: true, noPill: true } : null; },
  back: function (st, api) { if (st.open) { api.set({ open: null }); return true; } return false; },   // in-app back; false = leave to Home
  suggestions: function (st, api) { return ["…", "…"]; },  // 2–4 chat chips, context-specific
  voicePhrase: "Find photos from Saturday",                 // what the voice demo "hears" in this app
  reply: function (t, raw, api) { return null | {text, card, nav, then}; },  // agent intents (t = lowercase)
  actions: { sendDraft: function (card, api) {…} },          // handlers chat cards can call
  onLeave: function (api) {},                               // stop recordings, calls, etc.
  render: function (st, api) { return {…} }                // becomes {{<key>.*}}
});
```
`api`: `st` (your state), `set(patch)`, `get(otherKey)`, `setView(otherKey, patch)`, `open(view, patch, chat)`, `home()`, `toast(msg)`, `chat(draft)` (opens overlay with draft), `send(text)` (sends as user), `say(text, card)` (agent message + opens overlay), `sw(fn)` → `{down, up}` swipe handlers (fn(dx,dy)), `swallowed()` (true right after a swipe; guard taps), `later(fn, ms)`, `every(fn, ms)` (auto-cleared when your app closes), `stop()`, `track(on)`/`kx(on)` for toggle switches (see old Main settings markup), `person(id)`, `people`, `now` (Date), `name`, `theme`, `active`, `S` (whole shell state, read-only).

State is plain JSON-ish (functions OK in state only if unavoidable). Keep lists in state (`persist` them) so edits/deletes/additions actually show up.

### reply() — the agent
Called with the user's message when your app is open (first) and also globally (after the open app). Match **specific** intents for your domain; return null otherwise (don't grab generic words like "show" or "what"). Return `{ text, card?, nav?, then? }`:
- `nav`: `"<view>"` or `{ view, patch, chat }` → opens after the reply.
- `then`: function run after the reply (do the side effect here, e.g. add the item to your list via `api.set`/`api.setView`).
- Chat card types the shell renders: `event {time,title}`, `agenda {rows:[{time,title,key}]}`, `digest {rows:[{ini,who,text}]}`, `note {body}`, `summary {bullets:[]}`, `draft {to, body}`, `call {who}`, `flow {name, short}`, `generic {icon, title, sub}`. Any card may have `go: {view, patch}` (tap → open) or `act: {mod: "<key>", fn: "<actionName>"}` (tap → your `actions[fn](card, api)`, card is then marked done; used for Send/Turn on/Save buttons on draft/flow/summary cards).

## Cross-app deep links (patch keys every module must honour)
| app | patch |
|---|---|
| phone | `{call: personId}` start outgoing call screen · `{tab: "recents"|"keypad"|"favorites"|"voicemail"}` |
| messages | `{thread: personId}` open conversation · `{compose: personId or true}` new message |
| inbox | `{open: mailId}` · `{compose: {to: personId, subject, body}}` |
| contacts | `{open: personId}` · `{edit: personId}` · `{add: true}` |
| calendar | `{open: eventId}` |
| maps | `{query: "text"}` · `{place: placeId}` · `{directions: placeId}` |
| photos | `{open: photoId}` · shared `list` of photos (camera prepends via `api.setView("photos", {list: …})`) |
| camera | `{mode: "photo"|"video"|"scan"}` |
| notes | `{open: noteId}` · `{record: true}` · `{compose: true}` |
| files | `{folder: "Downloads"}` · `{open: fileId}` |
| wallet | `{open: cardId}` · `{pay: true}` |
| settings | `{page: "accounts"|"character"|"privacy"|"notifications"|"wifi"|"bluetooth"|"display"|"sound"|"about"|"developer"|"connections"|"models"}` · `{page: "accounts", adding: true}` |
| workflows | `{open: flowId}` · `{create: true}` |
| browser | `{url: "…"}` |

People are shared: `PEOPLE` in shell.js (`maya, jordan, priya, sam, lena, dad`) with name, ini, phone, email, fav. Use `api.person(id)`. Contacts may add/edit people: keep your edits in contacts state (`persist`) and expose them (other apps may read `api.get("contacts").list` if present, else fall back to PEOPLE).
Accounts live in settings state: `api.get("settings").accounts` → `[{id, provider, address, mail: true, calendar: true, contacts: true}]`.

## Navigation rules (shell-enforced — design your app to fit)
- **Home**: swipe up from the bottom bar / tap it. Always. Never add a "home" or "close app" button.
- **Back**: edge swipe calls your `back()`; close the top-most sub-page/sheet first. Sub-page headers have a `‹` that does the same.
- The chat overlay sits above your app; `api.say()` opens it. Keep flows completable without chat too.

## Deliverables (per app you own)
1. `modules/<key>.js`, `modules/<key>.html` — complete, working flows (see your brief).
2. `notes/<key>.md` — short: what didn't make sense / was redundant / was missing and what you changed; list of flows implemented; any "Shell requests" (changes you need in shell.js/html — don't make them yourself).
3. Verified: `python3 build.py --out /tmp/<you>` passes, `node test.js … ` shows `ok` for all your presets, and a `--flow` script that walks every flow (taps, types, back gestures) runs with zero page errors. **Look at your screenshots** (Read the PNGs) in light theme, and check dark too with `await h.go(preset, "dark")` in your flow. Fix anything clipped, overlapping the pill, or misaligned.
Don't edit shell files or other agents' modules. Other agents are working in parallel on other apps — only build to your own `--out` dir and use your own port.
