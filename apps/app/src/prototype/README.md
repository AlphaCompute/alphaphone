# Product presentation

The renderer imports React from the application dependencies and `dc-lite.js` from
this source directory. `model.js` supplies presentation state; `template.html`
and `prototype.css` define the reference layout. Product adapters own real data,
capability policy and native actions. Synthetic model behavior must not be
presented as real account, device, payment or network state.

Design source: https://alpha-phone-prototype.pages.dev/ (retrieved 2026-09-29).
Original HTML: 816757 bytes; SHA-256
`fd1ee08878c9ae8e8e0d112cc42e3b687326f290b1f86ddaca0f737cdb79afff`.
The supplied references remain under the repository's `design` directory.

`asset-manifest.json` records source URLs, sizes and SHA-256 hashes for the retained
public images and fonts. Public Sans faces use local files. The unavailable
Fraunces text subset was replaced with official Google Fonts full faces using the
same family, weights and optical axis; its recorded source describes those bytes.
Denton is the primary serif face. Original public React scripts and the unadapted
helper are not runtime dependencies and are not shipped.
