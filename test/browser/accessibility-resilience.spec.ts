import { test, expect, type Locator, type Page } from '@playwright/test';
import { setTextScale } from './accessibility-states';

// Behaviour behind the defects the accessibility sweep found (MVP-48, renderer part).
const offline = () => localStorage.setItem('alpha.connection.selection.v1', JSON.stringify({ kind: 'offline' }));

/** On screen and not covered: a pointer, switch or TalkBack double-tap would reach it. */
async function reachable(page: Page, control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect(async () => {
    const box = await control.boundingBox(); expect(box).not.toBeNull();
    const view = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(-.5); expect(box!.x + box!.width).toBeLessThanOrEqual(view.width + .5);
    expect(box!.y).toBeGreaterThanOrEqual(-.5); expect(box!.y + box!.height).toBeLessThanOrEqual(view.height + .5);
    expect(await control.evaluate(el => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === el || el.contains(hit); })).toBe(true);
  }).toPass({ timeout: 5000 });
}

test.describe('camera in landscape', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 915, height: 412 } });
  for (const mode of ['live', 'mock'] as const) {
    test(`every capture control is on screen and usable (${mode})`, async ({ page }, info) => {
      await page.addInitScript(offline);
      await page.goto(mode === 'mock' ? '/?mode=mock&start=camera' : '/');
      if (mode === 'live') await page.getByRole('button', { name: 'Camera', exact: true }).click();
      await expect(page.locator('html')).toHaveClass(/alpha-landscape/);
      const shutter = page.getByRole('button', { name: 'Take photo', exact: true });
      for (const control of [shutter, ...['Photo mode', 'Video mode', 'Scan mode', 'Zoom 1x', 'Back to apps'].map(name => page.getByRole('button', { name, exact: true }))])
        await reachable(page, control);
      // The viewfinder keeps the space the controls do not use, and no control sits on another.
      const finder = (await page.locator('[data-alpha-camera="viewfinder"]').boundingBox())!, capture = (await page.locator('[data-alpha-camera="capture"]').boundingBox())!;
      expect(finder.x + finder.width).toBeLessThanOrEqual(capture.x + 1);
      expect(finder.height).toBeGreaterThan(300);
      await page.screenshot({ path: info.outputPath('camera-landscape.png') });
      // Keyboard: the mode switch is reachable and operable without a pointer.
      const video = page.getByRole('button', { name: 'Video mode', exact: true });
      await video.focus(); await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: /recording/i }).first()).toBeVisible();
      // Back to portrait: the portrait stack returns unchanged.
      await page.setViewportSize({ width: 412, height: 915 });
      await expect(page.locator('html')).not.toHaveClass(/alpha-landscape/);
      await reachable(page, page.getByRole('button', { name: 'Photo mode', exact: true }));
      const portrait = (await page.locator('[data-alpha-camera="capture"]').boundingBox())!;
      expect(portrait.width).toBeGreaterThan(300);
    });
  }
});

test.describe('maps sheets', () => {
  test('directions at 200% text: Start stays reachable and is not under the composer', async ({ page }, info) => {
    await page.goto('/?mode=mock&start=maps:route');
    await setTextScale(page, 2);
    const start = page.getByRole('button', { name: 'Start', exact: true });
    await reachable(page, start);
    // Travel modes wrap instead of printing over each other.
    const modes = await page.locator('[data-alpha-maps-directions] button[aria-label]').filter({ hasNotText: /^$/ }).evaluateAll(list => list.filter(el => el.getAttribute('aria-label') !== 'Back to place').map(el => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, sw: el.scrollWidth, cw: el.clientWidth }; }));
    expect(modes.length).toBeGreaterThanOrEqual(2);
    for (const item of modes) expect(item.sw).toBeLessThanOrEqual(item.cw + 1);
    for (let a = 0; a < modes.length; a++) for (let b = a + 1; b < modes.length; b++) {
      const overlap = modes[a].l < modes[b].r - 1 && modes[b].l < modes[a].r - 1 && modes[a].t < modes[b].b - 1 && modes[b].t < modes[a].b - 1;
      expect(overlap).toBe(false);
    }
    await page.screenshot({ path: info.outputPath('directions-large-text.png') });
  });

  test.describe('landscape', () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 915, height: 412 } });
    test('the directions card and the route sheet sit side by side', async ({ page }, info) => {
      await page.goto('/?mode=mock&start=maps:route');
      const card = page.locator('[data-alpha-maps-directions]'), sheet = page.locator('[data-alpha-maps-sheet="directions"]');
      const cardBox = (await card.boundingBox())!, sheetBox = (await sheet.boundingBox())!;
      expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(sheetBox.x + 1);
      await reachable(page, page.getByRole('button', { name: 'Back to place', exact: true }));
      await reachable(page, page.getByRole('button', { name: 'Start', exact: true }));
      await page.screenshot({ path: info.outputPath('directions-landscape.png') });
    });
    test('search results keep the search field and the list on screen', async ({ page }) => {
      await page.goto('/?mode=mock&start=maps:search');
      await reachable(page, page.getByRole('textbox', { name: 'Search places', exact: true }));
      await reachable(page, page.getByRole('button', { name: 'Resize results', exact: true }));
      await reachable(page, page.getByRole('button', { name: /Philz Coffee/ }).last());
    });
  });
});

test('a new browser tab shows no find bar until find is opened', async ({ page }) => {
  await page.addInitScript(offline);
  await page.goto('/');
  await page.getByRole('button', { name: 'Browser', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tabs', exact: true })).toBeVisible();
  // The bar used to render on every page with an input bound to nothing.
  await expect(page.getByRole('search', { name: 'Find in page' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Close find in page', exact: true })).toHaveCount(0);
});

test('the note editor keeps Delete on screen beside the other header actions', async ({ page }) => {
  await page.addInitScript(offline);
  await page.goto('/');
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: 'New note', exact: true }).click();
  for (const name of ['Back to notes', 'Share note', 'Delete note']) await reachable(page, page.getByRole('button', { name, exact: true }));
  const sizes = await page.locator('.note-editor [data-alpha-app-header] button').evaluateAll(list => list.map(el => el.getBoundingClientRect().width));
  for (const width of sizes) expect(width).toBeGreaterThanOrEqual(44);
});

test.describe('recovery screen', () => {
  const startupFailure = async (page: Page) => {
    await page.addInitScript(offline);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
    await page.evaluate(async () => { const module = await import('/src/runtime/error-boundary.tsx' as string); module.showRecoveryScreen('startup', new Error('Private note text')); });
    return page.getByRole('alertdialog', { name: 'Alpha Phone needs to reload' });
  };

  test('takes the page behind it out of focus order and out of the accessibility tree', async ({ page }) => {
    const recovery = await startupFailure(page);
    await expect(recovery.getByRole('button', { name: 'Reload', exact: true })).toBeFocused();
    expect(await page.evaluate(() => (document.getElementById('root') as HTMLElement).inert)).toBe(true);
    expect(await page.getByRole('button', { name: 'Settings', exact: true }).evaluate(el => !!el.closest('[inert]'))).toBe(true);
    for (let step = 0; step < 6; step++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => { const active = document.activeElement; return !active || active === document.body || !!active.closest('.alpha-recovery'); })).toBe(true);
    }
    await expect(recovery.locator('pre')).not.toContainText('Private note text');
  });

  for (const kind of ['startup', 'render'] as const) {
    test.describe(`${kind} failure in landscape with 200% text`, () => {
      test.use({ hasTouch: true, isMobile: true, viewport: { width: 915, height: 412 } });
      test('scrolls instead of cutting off the title or Reload', async ({ page }, info) => {
        let recovery: Locator;
        if (kind === 'startup') recovery = await startupFailure(page);
        else {
          await page.addInitScript(offline); await page.goto('/');
          await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
          await page.evaluate(() => window.dispatchEvent(new Event('alpha:force-render-error')));
          recovery = page.getByRole('alertdialog', { name: 'Alpha Phone needs to reload' });
        }
        await expect(recovery).toBeVisible();
        // The screen uses fixed pixel sizes outside the phone, so scale it the way text zoom would.
        await recovery.evaluate(el => { (el as HTMLElement).style.fontSize = '32px'; for (const pre of el.querySelectorAll('pre')) (pre as HTMLElement).style.fontSize = '24px'; });
        await recovery.getByText('Diagnostics', { exact: true }).click();
        expect(await recovery.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
        // Scrolled to the top, the heading is whole; nothing sits above the scroll origin.
        await recovery.evaluate(el => { el.scrollTop = 0; });
        expect(await recovery.getByRole('heading', { name: 'Alpha Phone needs to reload' }).evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
        await page.screenshot({ path: info.outputPath('recovery.png') });
        const reload = recovery.getByRole('button', { name: 'Reload', exact: true });
        await reachable(page, reload);
        await recovery.locator('pre').scrollIntoViewIfNeeded();
        await expect(recovery.locator('pre')).toBeInViewport();
      });
    });
  }
});
