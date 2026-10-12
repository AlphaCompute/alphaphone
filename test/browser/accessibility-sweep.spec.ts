import { test, expect } from '@playwright/test';
import { auditPage, auditTabOrder, auditTree, format } from './accessibility-audit';
import { CONNECTED_STATES, DEVELOPMENT_STATES, FAILURE_STATES, FIXTURE_STATES, LAUNCHER_STATES, LIVE_STATES, MOCK_STATES, setTextScale } from './accessibility-states';

// MVP-48, renderer part. Every retained primary view, subview and failure screen is checked for
// accessible names and roles, keyboard reachability, focus order and traps, contrast, pointer
// target size, 200% text and landscape. This is Chromium on a development server. It is not a
// TalkBack, Switch Access, physical large-font, rotation or device pass; those remain open.
test.describe.configure({ mode: 'parallel' });

const STATES = [...LIVE_STATES, ...DEVELOPMENT_STATES, ...MOCK_STATES, ...FAILURE_STATES];
// Deliberate single-line ellipsis and line clamps on previews of user content are allowed: the
// full text is one tap away and is exposed whole to assistive technology. Hard clipping is not, and
// neither is a cut app title: it names the screen and has room to wrap.
const appTitle = (line: string) => /^text-truncated: .*<[^>]*\bdata-alpha-app-title\b/.test(line);
const blocking = (lines: string[]) => lines.filter(line => !line.startsWith('text-truncated:') || appTitle(line));

for (const theme of ['light', 'dark'] as const) {
  for (const state of STATES) {
    test(`names, roles, focus and contrast: ${state.name} (${theme})`, async ({ page }) => {
      await state.open(page, theme);
      const found = format([
        ...await auditTree(page),
        ...await auditPage(page, { contrast: true, targetSize: 24, clipping: true, overlap: true }),
        ...await auditTabOrder(page),
      ]);
      expect(blocking(found), blocking(found).join('\n')).toEqual([]);
    });
  }
}

for (const state of STATES) {
  test(`200% text is not clipped and does not overlap: ${state.name}`, async ({ page }, info) => {
    await state.open(page, 'light');
    await setTextScale(page, 2);
    // Clipping and overlap: nothing is cut, nothing is printed over anything else, no label is
    // split mid-word and no control sits on or is cut by another box (accessibility-audit.ts rule 7).
    const found = format(await auditPage(page, { clipping: true, overlap: true }));
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
      // The landscape layout is what is being checked, not a scaled-down portrait canvas.
      await expect(page.locator('html')).toHaveClass(/alpha-landscape/);
      const found = blocking(format([...await auditPage(page, { clipping: true, overlap: true }), ...await auditTree(page), ...await auditTabOrder(page)]));
      expect(blocking(found), blocking(found).join('\n')).toEqual([]);
    });
  }
});

test.describe('landscape at 200% text', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 915, height: 412 } });
  for (const state of [...LIVE_STATES, ...MOCK_STATES]) {
    test(`landscape at 200% text keeps every control on screen, named and uncut: ${state.name}`, async ({ page }) => {
      await state.open(page, 'light');
      await expect(page.locator('html')).toHaveClass(/alpha-landscape/);
      await setTextScale(page, 2);
      await expect(page.locator('html')).toHaveClass(/alpha-large-text/);
      // Clipping covers control-off-screen and control-unreachable; the tree covers names.
      const found = blocking(format([...await auditPage(page, { clipping: true, overlap: true }), ...await auditTree(page)]));
      expect(found, found.join('\n')).toEqual([]);
    });
  }
});

// Screens the states above do not reach: the fixture lock screen and photos-empty viewer, the
// Android HOME (launcher) presentation, and states with a synthetic provider connected.
for (const state of [...FIXTURE_STATES, ...LAUNCHER_STATES, ...CONNECTED_STATES]) {
  for (const scale of [1, 2]) {
    test(`${scale * 100}% text, names, focus and contrast: ${state.name}`, async ({ page }) => {
      await state.open(page, 'light');
      if (scale !== 1) await setTextScale(page, scale);
      const found = blocking(format([
        ...await auditTree(page),
        ...await auditPage(page, scale === 1 ? { contrast: true, targetSize: 24, clipping: true, overlap: true } : { clipping: true, overlap: true }),
        ...await auditTabOrder(page),
      ]));
      expect(found, found.join('\n')).toEqual([]);
    });
  }
}
