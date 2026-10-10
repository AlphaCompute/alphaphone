# Renderer accessibility checks (MVP-48, software part)

This describes what the browser tests check for accessibility and layout resilience,
the sizes they treat as supported, and what they cannot show. It covers the renderer
only. TalkBack, Switch Access, a physical large-font pass, device rotation, gesture
navigation, process death and full storage on hardware remain device acceptance in
`docs/pilot-acceptance-runbook.md` and are not closed by anything here.

## What runs

| Spec | Lane | Scope |
| --- | --- | --- |
| `test/browser/accessibility-sweep.spec.ts` | `npm run test:browser` | Every state in `test/browser/accessibility-states.ts`: live (no connection, no data), fixture (populated lists and open subviews) and the two recovery screens |
| `test/browser/accessibility-sweep.production.spec.ts` | `npm run test:browser:production` | The live states against the flag-off production bundle |
| `test/browser/accessibility-audit.spec.ts` | `npm run test:browser` | Each rule fires on a seeded defect and stays quiet on corrected markup |
| `test/browser/accessibility-resilience.spec.ts` | `npm run test:browser` | Behaviour behind the defects the sweep found |

The checks live in `test/browser/accessibility-audit.ts` and need no added dependency.
Names, roles and focusability are read from Chromium's accessibility tree, which is the
tree Android WebView hands to TalkBack. Geometry, contrast and clipping are measured in
the page.

| Rule | Meaning |
| --- | --- |
| `accessible-name` | A control, dialog or image is exposed without a name |
| `keyboard-focusable` | An exposed control cannot take focus |
| `aria-hidden-focus`, `focus-in-hidden-content` | Focus can enter content hidden from assistive technology |
| `click-without-control` | A click handler sits on an element that is not a control |
| `aria-reference` | A label or description reference does not resolve to exactly one element |
| `focus-trap`, `focus-not-visible`, `focus-order-unbounded` | Tab stops moving, lands on an invisible element, or never returns |
| `target-size` | A pointer target is smaller than 24 by 24 CSS pixels (WCAG 2.5.8) |
| `contrast` | Text is below 4.5:1, or 3:1 for large text, against what is painted behind it |
| `text-clipped`, `text-off-screen`, `label-overflows-control` | Text is cut through, leaves the phone sideways, or spills out of its control |
| `control-off-screen`, `control-unreachable` | A control leaves the phone, or sits outside the screen with no scroller |
| `text-truncated` | Reported, not failed: a deliberate ellipsis or line clamp |

## Supported sizes

These are the sizes the sweep holds the renderer to. They are test definitions, not a
product commitment; the landscape decision is still A-22 in `docs/decisions.md`.

- Portrait 412 by 915, light and dark: all rules.
- Text at 200%, portrait: clipping rules and names. Android applies large text as WebView
  text zoom (the in-app text size multiplied by the system font scale), so 200% is the
  system's largest font at the default in-app size. The existing large-text specs cover
  150%, the largest in-app size.
- Landscape 915 by 412 on a touch phone: clipping rules, names and tab order.

Truncation policy: a single-line ellipsis or line clamp on a preview of user content
(a mail snippet, a file name in a list, a note preview) is allowed, because the full text
is one tap away and is exposed whole to assistive technology. Text that is cut through
without an ellipsis is a failure. At 200% the app title in the Camera and Photos headers
and the Home calendar card title are shortened with an ellipsis; this is recorded as an
open item, not a pass.

## Limits

- Large text is emulated by multiplying every declared pixel font size. WebView text zoom
  also scales pixel line heights, and CSS cannot read the zoom factor, so the fixes are
  layout rules (wrap, grow, or hide a whole line) and a device pass is still required.
- Contrast is not computed for text over photographs, video, gradients or blur; the
  camera, photo and map overlay specs cover those surfaces.
- The map canvas is a pannable surface: labels and pins outside the frame are not
  failures. Places are also listed in the results sheet.
- Landscape is checked in a mobile-emulated Chromium viewport. Android rotation, insets
  and state restoration are covered by `RotationInstrumentedTest` on an emulator and
  still need a device.
- The 200% check of Notes Trash is marked `fixme`: its heading is cut by a fixed-height
  header. That screen belongs to the trash-recovery work (MVP-15).
- The sweep visits states reachable without a provider, permission or account. Dialogs
  and flows that need one are covered by their own accessibility specs.
