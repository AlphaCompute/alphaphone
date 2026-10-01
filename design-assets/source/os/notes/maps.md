# Maps — review notes

## Review (what didn't make sense / was missing)
- The old single-file build had no Maps at all (the home icon went to an AOSP stub), so there was nothing to keep. Built from scratch.
- **Search field vs composer.** I used a dedicated floating search field at the top, with the shell pill (`chat: "hidden"`), and not `chat: "input"` + "Search or ask". Why: text typed in the composer goes to the chat overlay, which opens over the map and hides the results. A place search should land on the map and in the results sheet. Alpha stays one tap away through the pill, and every natural-language ask ("directions to…", "find coffee nearby") works through chat and deep-links back into the map. Having both a search field and a composer at the bottom would have meant two text fields.
- No invented ratings or reviews. A place shows category · area · distance, open/closed with hours computed from the real clock, and the address.
- Places match the other apps: Tartine (Guerrero St, lunch with Priya), Equinox SoMa (gym), Lumen studio (Maya's office, which is also the saved "Work"), SFO, Home (Liberty St). There are also three coffee shops near the user (Folsom St, SoMa).
- Navigation originally had no way to reach Alpha, because the pill is hidden when the view is immersive. I added an α button to the navigation bar so you can say "share my ETA with Maya" while driving.

## What's drawn
The map is SVG only. A 1200×3200 world holds the street grid, major streets, Market St diagonal, US‑101 down to SFO (with runways), parks (Dolores, Yerba Buena), and the bay edge. The route polyline uses the accent colour with a non-scaling stroke: dashed for transit, dotted for walking. Pins, the current-location dot (pulse ring) and street labels are HTML overlays positioned from world coordinates. The camera pans and zooms with a CSS transform to fit the current layer (place, route bounds, results, or following the user during navigation). Drag the map to pan (it applies on release, since the runtime has no pointermove). Recenter resets the pan. The map uses a dark palette in dark theme and always during navigation.

## Flows implemented
- **Search:** tap the field to open the sheet with category chips (Coffee / Food / Gym) and saved places. Typing filters results live. Pins appear for results. The sheet drags between peek, half and full (`api.sw` on the grabber, with pointer capture; tap cycles). Swiping down from peek closes it. No results shows "Ask Alpha", which sends the query to chat.
- **Place card:** name, category · area · distance, open/closed · hours, address. Actions:
  - Directions (with the drive time)
  - Call → phone `{num}`
  - Save / unsave (star; persisted `saved`)
  - Share → messages `{compose: true, text}`
  - Website → browser `{url}`
  Home and Work have no phone or website and are always saved.
- **Directions:** top card showing from → to, plus mode chips (drive / transit / walk / bike, each with its time). The route is drawn fitted to the screen. The sheet shows the big ETA, distance · arrival clock time, "via …", Start, and share-ETA (a draft card to the relevant person).
- **Navigation** (immersive, dark, no pill): big turn banner (left/right icon, distance to turn, street) with a "Then" tab, and a user dot that moves along the route. The bottom bar has end ✕, time left, distance · ETA, α and a voice toggle. When voice is on, each turn is spoken as a toast. The trip ends with an "Arrived" banner. End returns to the place card.
- **Saved:** Home, Work and starred places as chips on the base map and as rows in the empty search sheet.
- **Back order:** navigation → place card; directions → place card; place → results (or base); results → base; base → Home.
- **Deep links:** `{query}`, `{place}`, `{directions}` are the state keys themselves, so they need no translation. Also `mode` and `nav:false`.
- **reply() intents:**
  - "directions to / take me to / navigate to …": opens directions and reads out the mode from walk/bike/transit.
  - "how long / how far to …": answers with drive and walk times (for the gym, "leave by 7:20" to match the 7:30 calendar slot).
  - "find coffee nearby": opens results with a list card.
  - "share my ETA with maya": returns a `draft` card with `act {mod:"messages", fn:"sendDraft"}`, using the destination you're navigating to, or else the person's place.
  - "where am I", and "how long left" during navigation.
  - All of these need a directional verb plus a known place, so "move gym to tomorrow" still goes to Calendar.
- **Presets:** `maps`, `maps:search`, `maps:place`, `maps:route`, `maps:nav`.

## Shell requests
1. **build.py:** the registry probe runs `node -e <all module JS>`. With every module present that is over 200 KB and fails with `OSError: Argument list too long`. Please write the probe to a temp file and run `node file`. I verified against a private copy with that one-line change at `/tmp/agD/src/build.py`.
2. **Messages:** please honour `{compose: true, text: "…"}` (or `{compose: pid, text}`) to prefill the body. Place share sends `text`, which is ignored today.
3. **Toast:** during immersive navigation the shell toast sits over the turn banner. Consider an `immersive().toastTop` offset, or placing the toast at the bottom when `noPill`.
4. (Optional) The shell's pointer handlers could `setPointerCapture` in `sw().down`. With mouse input, a drag that ends outside the element never fires `up`. I do this in my own down handlers.

## Round 2
- **Navigation runs in the background.** It uses `ongoing` (accent chip: the turn icon plus time left, or "Arrived") and the progress timer uses `everyBg`/`stopBg`. Back or Home leaves navigation running; only End stops it. Reopening Maps from the chip or the home icon returns to turn-by-turn.
- Website opens the browser with `{url, newTab: true}`. Back from the browser returns to Maps through the shell back stack. While the browser doesn't yet support `newTab`, it still adds the page to the current tab.
- **Cross-app entry:** when Maps is opened from another app (the back stack is not empty), back exits to that app instead of walking Maps' own layers. For example: Wallet pass → Directions to SFO → back returns to the pass.
- **α:** only kept inside immersive navigation, where the pill is hidden. The no-results state follows the spec (icon + "No places", then a last row "Ask Alpha: '<query>'").
- The "Open" status uses `--fg`.
- **Street addresses:** `{query: "<street address>"}` or typing an address + Enter shows a dropped pin. San Francisco streets are placed on the drawn grid with a route and times. Mountain View and Oakland get a route off the map. Far cities (New York, Portland) show a place card without directions.
- Removing a saved place shows the shared undo snackbar.

### Shell requests (round 2)
- `api.sw(fn, opts)` does not forward `opts` to `self.sw` (`sw: function (fn) { return self.sw(fn); }`), so `{axis}` can't be used from modules yet.
- **Site:** focusing an input can scroll the window horizontally (`html` scrollLeft 99 at a 520px viewport). After that, edge swipes land off the screen, so back gestures in the test harness fail. `overflow: clip` on html/body (or a fixed stage) would prevent it.
