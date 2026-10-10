import { test, expect } from '@playwright/test';
import { auditPage, auditTabOrder, auditTree, format } from './accessibility-audit';
import { FAILURE_STATES, LIVE_STATES, MOCK_STATES, setTextScale } from './accessibility-states';

// MVP-48, renderer part. Every retained primary view, subview and failure screen is checked for
// accessible names and roles, keyboard reachability, focus order and traps, contrast, pointer
// target size, 200% text and landscape. This is Chromium on a development server. It is not a
// TalkBack, Switch Access, physical large-font, rotation or device pass; those remain open.
test.describe.configure({ mode: 'parallel' });

const STATES = [...LIVE_STATES, ...MOCK_STATES, ...FAILURE_STATES];
// Deliberate single-line ellipsis and line clamps on previews of user content are allowed: the
// full text is one tap away and is exposed whole to assistive technology. Hard clipping is not.
const blocking = (lines: string[]) => lines.filter(line => !line.startsWith('text-truncated:'));

for (const theme of ['light', 'dark'] as const) {
  for (const state of STATES) {
    test(`names, roles, focus and contrast: ${state.name} (${theme})`, async ({ page }) => {
      await state.open(page, theme);
      const found = format([
        ...await auditTree(page),
        ...await auditPage(page, { contrast: true, targetSize: 24, clipping: true }),
        ...await auditTabOrder(page),
      ]);
      expect(blocking(found), blocking(found).join('\n')).toEqual([]);
    });
  }
}

for (const state of STATES) {
  test(`200% text is not clipped: ${state.name}`, async ({ page }, info) => {
    test.fixme(!!state.largeTextOpen, state.largeTextOpen);
    await state.open(page, 'light');
    await setTextScale(page, 2);
    const found = format(await auditPage(page, { clipping: true }));
    await info.attach('truncated', { body: found.filter(line => line.startsWith('text-truncated:')).join('\n') || 'none', contentType: 'text/plain' });
    expect(blocking(found), blocking(found).join('\n')).toEqual([]);
    // Names and focusability must survive the reflow too.
    const tree = format(await auditTree(page));
    expect(tree, tree.join('\n')).toEqual([]);
  });
}

test.describe('landscape', () => {
  // A touch phone on its side (the Android WebView path in main.tsx).
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 915, height: 412 } });
  for (const state of STATES) {
    test(`landscape keeps every control on screen: ${state.name}`, async ({ page }) => {
      await state.open(page, 'light');
      const found = blocking(format([...await auditPage(page, { clipping: true }), ...await auditTree(page), ...await auditTabOrder(page)]));
      expect(blocking(found), blocking(found).join('\n')).toEqual([]);
    });
  }
});
