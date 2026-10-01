# Authoritative prototype presentation extraction

Source: https://alpha-phone-prototype.pages.dev/ downloaded 2026-09-29.
Original HTML: 816757 bytes; SHA-256 `fd1ee08878c9ae8e8e0d112cc42e3b687326f290b1f86ddaca0f737cdb79afff`.

`template.html` is the exact body of the original `dc-template` element. `model.js` preserves the original first inline script (all modules and presentation state) with React/DCLogic imports and Component/VIEWS/ORDER exports. `prototype.css` preserves both original style blocks except the local Denton URL becomes absolute, followed by bundled font-face definitions. `dc-lite.js` is the reference helper converted from a browser global IIFE into an imported React module using a raw template import. Its phoneSurface branch clones the original .os root with only the original data-screen child; the original full demo template remains unchanged.

`asset-manifest.json` pins every fetched public asset's URL, bytes and SHA-256. All 49 referenced local assets were fetched: 42 WebP images, two logos, Denton, dc-lite and two React scripts. Google Fonts Public Sans faces were downloaded and their font-face URLs rewritten to local public files. The reference alpha-only Fraunces generated font URL returned HTTP 400; the same official Google Fonts family/italic weights 300 and 400/optical axis request without the text subset supplied full TrueType faces instead. This fallback is recorded, not claimed byte-identical to the unavailable subset. Denton remains the primary serif face.

The original vendor scripts and helper in public are provenance copies; the application imports its existing React package and the adapted helper. This extraction deliberately retains synthetic prototype model functions; production capability adapters must prevent simulation from masquerading as real actions. No assertion of real account, device, payment, enclave, biometric or network state follows from the presentation fixtures.

Validation: all manifest entries were rehashed locally and matched; template body byte equality and model wrapper integrity checked at extraction. JavaScript syntax checks passed. Rendering and pixel comparisons are tracked separately in docs/prototype-visual-verification.md.
