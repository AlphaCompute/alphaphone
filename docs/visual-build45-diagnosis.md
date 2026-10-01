# Build45 visual comparison diagnosis

This is presentation-fixture evidence, not native device or integration acceptance. Original build45 screenshots/manifests remain unchanged. No renderer/template/native edits were made for this investigation, and no current development-server screenshots replaced archived build45 local images.

## Source and asset verification

The live [prototype](https://alpha-phone-prototype.pages.dev/) returned HTTP 200 and HTML SHA-256 `fd1ee08878c9ae8e8e0d112cc42e3b687326f290b1f86ddaca0f737cdb79afff`, exactly matching `artifacts/design-reference/index.html`. Its [Nopa hero image](https://alpha-phone-prototype.pages.dev/img/nopa.webp) returned HTTP 200, image/webp, 105,246 bytes, SHA-256 `49740a8547fe6c695be7854f3fc222bef4b85453f708616293fbff9a96a08e24`, exactly matching the bundled `apps/app/public/img/nopa.webp`. Both source versions reference that image.

The original light browser booking/agent screenshots showed a blank reference hero and the correct image locally. The dark reference already had the image. This was a capture settlement problem, not changed reference source or an app asset regression. Advancing a paused fixture clock by 700ms does not ensure actual network loading/image decoding has finished.

## Capture harness correction

`prototype-capture.mjs` now waits for decoding of visible screen `<img>` and CSS background-image resources, using a bounded host timer independent of the paused page clock. Its manifest records decoded dimensions/failures. It also records HTTP responses >=400 and treats these, image-decode failures/timeouts, page errors, and request failures as unsuccessful captures. A synthetic HTTP404-image server test confirmed that a response which does not trigger Playwright `requestfailed` still makes the capture fail with recorded HTTP status and decode failure.

Only browser:book and browser:agent were recaptured from the hosted reference, in both themes. All four decode the 1080×720 Nopa image. The hosted font request continues to fail; these rows correctly remain `ok:false` rather than being relabeled clean.

## Archived comparisons and inspection

- [Original 272-row manifest](../test-results/prototype-build45/visual/manifest.json): unchanged 136 reference/local pairs.
- [Four settled reference captures](../test-results/prototype-build45/visual-settled-reference/manifest.json): hosted reference only; same HTML snapshot hash.
- [Combined diagnostic manifest](../test-results/prototype-build45/visual-settled-comparison/manifest.json): all 136 original local captures, 132 original reference captures, four explicitly identified settled reference replacements. Every referenced PNG hash was verified when composing this manifest.
- [Diagnostic metrics](../test-results/prototype-build45/visual-settled-comparison/comparison/metrics.json) and [first contact sheet](../test-results/prototype-build45/visual-settled-comparison/comparison/contact-01.png).

Primary inspection covered original browser booking and calendar-month pairs, settled browser booking/agent images, the archived local browser-agent image, and the first contact sheet. The corrected browser booking/agent pairs have 0% pixels above the comparison threshold in both themes and rounded mean absolute channel error 0. The large ~15% browser difference disappeared without any app change.

Across all 136 pairs, dimensions match. 120 pairs have zero pixels whose RGB-channel difference exceeds 16. The largest remaining thresholded difference is 0.0209% (dark voice). Calendar month is 0.0143% in each theme; the light pair contains only 46 thresholded pixels, bounded by x30–380/y376–463 around rounded calendar control/panel edges. Primary inspection found no structural calendar-month layout displacement; the residual is consistent with rasterization at curved edges, rather than proof of a layout bug.

## Qualification

The comparison uses the existing fixed mask x=[12,width−12), y=[44,height−44), excluding status/clock and rounded frame corners. The diagnostic combines captures from different wall-clock sessions while preserving the same paused fixture date, locale, timezone, viewport, and source hash. It is not a fresh simultaneous capture of all 272 states. All 136 archived local captures are marked clean; 132 reference captures still report the external font request failure. Therefore this is strong evidence resolving the image-timing mismatch, not a claim of universally pixel-identical rendering or an error-free hosted reference. Native flows, actual data, phone screenshot acceptance, and screens outside the enumerated fixtures remain separate work.
