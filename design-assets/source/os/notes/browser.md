# Browser — review notes

## What didn't work in the old screen
- The address pill only opened chat with "Go to ". You couldn't type an address, and there were no suggestions.
- There were no tabs, bookmarks, history, share or new-tab page, and only two pages. Nothing to act on.
- Agent browsing was a fixed highlight animation. It couldn't operate a page, and nothing asked the user before an irreversible action.
- Back did history, then left the app. Overlays weren't part of the back chain.

## Decisions
- **Top bar:** `‹ ›` history · address pill (lock, host, dimmed path) · a tab count square · `⋯`. The menu holds only what isn't one tap away already: Bookmark (star fills when saved), Bookmarks & history, Share, Read aloud. New tab lives in the tab switcher and in chat. **There's no find-in-page:** asking the agent ("save the key points", "summarize") covers what people use it for, and a find bar would compete with the composer.
- **Address editing is inline:** the pill turns into an input with focus and the text selected, plus a ✕. A suggestion list covers the page: "Search '…'" first, then matching bookmarks (star) and history (clock). Enter navigates. Known hosts resolve (`tables.example` → Nopa); anything else becomes a search.
- **Pages:** news article, enclave article, search results (search.example), the Nopa booking form (tables.example) and a new-tab page (search pill plus recent sites). They link to each other, and each article has a link onward.
- **Agent acting on a page:** blue outline on the page, a step banner with ✕ (take over), and a moving cursor dot. The cursor positions come from the real DOM (`data-bk` markers), and fields scroll into view if needed. It fills party, date, time, name and phone (typed character by character), then **stops with a "Confirm booking?" sheet** (Not yet / Book). Nothing is submitted without the tap. "yes / book it" in chat also confirms. Stopping partway keeps whatever was filled, so the user can finish by hand.
- **Back order:** share sheet / menu, then pending confirm ("Not yet"), then running agent (stop), then address editing, then bookmarks/history, then tab switcher, then **page history**, then Home. The brief said "history first, then sub-pages". I put open layers first, because backing through a hidden page underneath the tab switcher would be invisible to the user.
- Share goes to Messages compose with the title and URL prefilled (`{compose: personId, text}`). Copy link shows a toast.

## Flows implemented
- Link → page, `‹ ›` buttons, back gesture through history, forward.
- Address edit → suggestions → Enter (URL or search) → results → result opens the page.
- Tabs: switcher cards (preview color block, title, host, ✕), switch, close (closing the last tab opens a new tab page), new tab (opens with the address focused), recent-site tiles.
- Menu: bookmark toggle, Bookmarks & History sub-page (segmented, remove bookmark, clear history), Share sheet (favorite people, Copy link), Read aloud (toast).
- Booking by touch: guests stepper, date chips, time chips, name, phone, Book (disabled until complete), then a "You're booked" card with a code and a Change booking option.
- Booking by agent: "book a table for 2 at 7:30" (party / time / tonight-tomorrow-Fri parsed) → fills the form → confirm sheet → booked, with a toast. Also works from Home ("reserve a table for 3 at 8"). Stop/take over with ✕, chat "stop", or back.
- "Summarize this page" → summary card with Save (→ `notes.save`). "Save the key points to Notes" → agent highlights three passages, then saves a note to `notes.list`.
- Chat: go to <domain>, search for <x>, read aloud, bookmark, new tab, share (with <name>).
- Deep link `{url}`, applied on the next tick so tabs and history stay consistent. Presets: `browser:book`, `browser:tabs`, `browser:agent`.

## Verified
- Flow script: `scratchpad/agG/flow-browser.js`. It covers links, history, the back gesture, address editing, search, tabs (new / close / switch), the menu (bookmark, library, read aloud, share → Messages), agent booking with confirm, take over plus manual booking, back closing layers in order, summarize, save key points, the deep link from Home, and global booking. Zero page errors in my build and in a full 14-module build. Light and dark screenshots checked.

## Shell requests
- Same as the settings notes: build.py ARG_MAX, the harness drag scrolling the stage, and **calendar grabbing "book a table…"** from Home.
- It would help to have a shared "add note" helper (or have `VIEWS.notes.actions.save` accept any api). Right now I write `notes.list` with notes' own shape: `{id, kind:"text", title, body, pinned, when}`.

## Round 2 (SPEC.md + review)
- Tab cards: one close style (44px `--s2` ✕), and the thumbnail is inset with a 1px `--line` border, so black thumbnails stay visible in dark mode.
- There's a fade over the bottom 130px of the page, so article text no longer shows under the composer.
- The agent banner now sits in the layout between the address bar and the page, pushing the page down instead of covering the site hero. The page outline starts below it. The cursor starts on the page, not on the URL.
- `{url, newTab: true}` opens a new tab marked `ext`. Unknown domains (for example Maps "Website" → tartinebakery.com, or a typed `lumen.example`) render a generic site: a hero with the site's initial, a title from the domain, two paragraphs, and About / Hours & location / Contact links that are also generic pages. Back at that tab's first page closes the tab and returns false, so the shell's back stack returns to the source app. I verified this Maps → Website → About → back → back → Maps.
- Global chat intents ("book a table…", "go to x.example", "search the web for…") now open the browser directly in `then` instead of through `nav`. With the new 1.3 s nav delay, the reset on open was wiping the agent run. "Book a table for 3 at 8" from Home now reaches the browser (calendar removed its collision).
- The address input focuses with `preventScroll`, and every render resets any stray page scroll.
- Sheets: 28px radius, serif 26 titles, and a ✕ on the share sheet.
