# Radical Studio: animated SVG export

`index.html` is Radical Studio (https://dontbefooled.ai/alpha/radical/) with one added
Export tab: **Animated SVG**. It writes the motion loop as a single SVG with SMIL path
morphs, so it plays without script in browsers, `<img>` tags and Android WebView.

- `original.html`: the live page as downloaded on 2026-09-30.
- `animated-svg.js`: the exporter.
- `patch.mjs`: injects the exporter into a fresh copy of the page.
  `node patch.mjs original.html index.html`. It fails loudly if the upstream code moved.

How it works: the loop is sampled at the chosen keys per second. Each key is the exact
frame from `buildSVG`. Every line becomes one path whose `d` morphs through the keys.
Each line is a thin strip, so its corners (the end caps) are tracked from key to key and
every span between two corners is sampled at even arc length with the same point count in
every key. Corners always morph to corners, so line ends at the centre square keep their
width between keys. Lines whose corners cannot be tracked fall back to plain resampling. Lines that are exact rotations or mirrors of another line in every
frame reuse its animation through `<use>`.

**Loop** option: *Full cycle* exports the whole timeline (rest, extend, undulate, return).
*Undulate only* holds the lines fully extended for the entire loop and makes the loop exactly
one wave cycle (1 / speed seconds, 2.63 s by default), so it undulates seamlessly forever.
It only changes the export; the document keeps its timeline.
`../brand/radical-phone-splash-loop.svg` is the Phone splash, Undulate only, 24 keys/s.
`../video/radical-phone-splash-loop-60fps.mp4` is the same loop rendered from the exact
canvas frames: 158 frames at 60 fps (one wave cycle), H.264 High, yuv420p, BT.709, CRF 18.
`-x4.mp4` is four loops back to back (10.5 s).

Limits: gradient fills and centre-square clip holes stay at their first-frame position.
Solid colours, layer opacity, background colour and wordmark position still animate.

Run locally: `python3 -m http.server 8781 --directory design-assets/radical-studio`.
