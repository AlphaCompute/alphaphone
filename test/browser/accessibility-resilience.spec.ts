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

test.describe('200% text keeps the way out on screen', () => {
  for (const [start, open, field] of [['inbox', 'Search email', 'Search mail'], ['photos', 'Search photos', 'Search photos'], ['notes', 'Search notes', 'Search notes'], ['files', 'Search files', 'Search files']] as const) {
    test(`${start} search: the field shrinks and Close search stays reachable`, async ({ page }) => {
      await page.goto(`/?mode=mock&start=${start}`);
      await page.getByRole('button', { name: open, exact: true }).click();
      await setTextScale(page, 2);
      await reachable(page, page.getByRole('textbox', { name: field, exact: true }).or(page.getByRole('searchbox', { name: field, exact: true })));
      const close = page.getByRole('button', { name: 'Close search', exact: true });
      await reachable(page, close);
      await close.click();
      await expect(close).toHaveCount(0);
    });
  }

  test('the Undo toast wraps a long file name and keeps Undo usable', async ({ page }) => {
    await page.goto('/?mode=mock&start=files:preview');
    await page.getByRole('button', { name: 'Delete file', exact: true }).click();
    const undo = page.getByRole('button', { name: 'Undo', exact: true });
    await expect(undo).toBeVisible();
    await setTextScale(page, 2);
    await reachable(page, undo);
    await undo.click();
    await expect(page.getByRole('button', { name: /^Open Northpoint_TermSheet_v3\.pdf/ })).toBeVisible();
  });

  test('browser menu rows grow with their labels instead of printing over each other', async ({ page }) => {
    await page.goto('/?mode=mock&start=browser');
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await setTextScale(page, 2);
    const rows = await page.locator('[data-alpha-browser-menu] > button').evaluateAll(list => list.map(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, fits: el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1 }; }));
    expect(rows.length).toBeGreaterThanOrEqual(4);
    for (const row of rows) expect(row.fits).toBe(true);
    for (let index = 1; index < rows.length; index++) expect(rows[index].top).toBeGreaterThanOrEqual(rows[index - 1].bottom - 1);
    await reachable(page, page.getByRole('button', { name: 'Read aloud', exact: true }));
  });
});

test.describe('menus and sheets over a scrim own focus', () => {
  // [state, steps, dialog name, scrim name, the opener focus returns to (when it survives)]
  const POPUPS = [
    ['live', ['Browser', 'Menu'], 'Browser menu', 'Close menu', 'Menu'],
    ['browser', ['Menu', 'Share'], 'Share page', 'Close share', null],
    ['photos:viewer', ['Photo info'], 'Photo info', 'Close info', 'Photo info'],
    ['photos:viewer', ['Share photo'], 'Share photo', 'Close share', 'Share photo'],
    ['notes:editor', ['Share note'], 'Share note', 'Close share', 'Share note'],
    ['files:folder', ['View and sort'], 'View and sort', 'Close menu', 'View and sort'],
    ['files:preview', ['Move file'], 'Move to', 'Close move', 'Move file'],
    ['files:preview', ['Share file'], 'Share file', 'Close share', 'Share file'],
    ['workflows:new', ['Add Read step'], 'Step editor', 'Close', null],
    ['settings', ['Connections', 'Slack'], 'Slack', 'Close sheet', 'Slack'],
  ] as const;
  for (const [start, steps, name, scrim, opener] of POPUPS) {
    test(`${start} > ${steps.join(' > ')}: focus enters, stays, and returns on Escape`, async ({ page }) => {
      if (start === 'live') { await page.addInitScript(offline); await page.goto('/'); }
      else await page.goto(`/?mode=mock&start=${start}`);
      for (const step of steps.slice(0, -1)) await page.getByRole('button', { name: step, exact: true }).first().click();
      const last = page.getByRole('button', { name: steps.at(-1)!, exact: true }).first();
      await expect(last).toBeVisible();
      // Everything the user could operate before the popup opened must be operable again after it.
      await page.evaluate(() => { for (const el of document.querySelectorAll('.os button, .os input, .os textarea, .os a[href]')) if (el.getClientRects().length && !el.closest('[inert]')) (el as any).__alphaBefore = true; });
      await last.click();
      const dialog = page.getByRole('dialog', { name, exact: true });
      await expect(dialog).toBeVisible();
      const inside = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
      await expect.poll(inside).toBe(true);
      // The page under the popup is out of the tab order and the accessibility tree; the
      // popup's own scrim still closes it for a pointer or an assistive-technology tap.
      const exposed = await page.evaluate(() => Array.from(document.querySelectorAll('.os button, .os input, .os textarea, .os a[href]'))
        .filter(el => el.getClientRects().length && !el.closest('[inert]') && !el.closest('[data-alpha-popup]')).map(el => el.getAttribute('aria-label') || el.textContent));
      expect(exposed).toEqual([]);
      await expect(page.getByRole('button', { name: scrim, exact: true })).toHaveCount(1);
      const stops = await dialog.locator('button:not(:disabled), input, textarea, select').count();
      for (let step = 0; step < stops + 2; step++) { await page.keyboard.press('Tab'); expect(await inside()).toBe(true); }
      for (let step = 0; step < 2; step++) { await page.keyboard.press('Shift+Tab'); expect(await inside()).toBe(true); }
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      if (opener) await expect(page.getByRole('button', { name: opener, exact: true }).first()).toBeFocused();
      const stranded = await page.evaluate(() => Array.from(document.querySelectorAll('.os button, .os input, .os textarea, .os a[href]'))
        .filter(el => (el as any).__alphaBefore && el.isConnected && !!el.closest('[inert],[aria-hidden="true"]')).map(el => el.getAttribute('aria-label') || el.textContent));
      expect(stranded).toEqual([]);
    });
  }

  test('a tap on the scrim still closes the popup, and Delete is not operable under the share sheet', async ({ page }) => {
    await page.goto('/?mode=mock&start=photos:viewer');
    await page.getByRole('button', { name: 'Share photo', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Share photo', exact: true });
    await expect(dialog).toBeVisible();
    // Delete photo sits under the sheet: before, Tab reached it there and Enter deleted unseen.
    expect(await page.locator('button[aria-label="Delete photo"]').evaluate(el => !!el.closest('[inert]'))).toBe(true);
    await page.getByRole('button', { name: 'Close share', exact: true }).click({ position: { x: 8, y: 60 } });
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete photo', exact: true })).toBeVisible();
    // The Android Back gesture reaches the renderer as alpha-back: it closes the sheet, not the viewer.
    await page.getByRole('button', { name: 'Share photo', exact: true }).click();
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => !window.dispatchEvent(new Event('alpha-back', { cancelable: true })))).toBe(true);
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('[data-alpha-subview="photos-viewer"]:not([inert])')).toBeVisible();
  });
});

test.describe('toast status messages', () => {
  test('a toast lands in a polite live region that exists before it appears', async ({ page }) => {
    await page.goto('/?mode=mock&start=files:preview');
    const region = page.locator('[data-alpha-toast]');
    await expect(region).toHaveCount(1);
    await expect(region).toHaveAttribute('aria-live', 'polite');
    // Present and empty beforehand: a live region inserted together with its text is not announced reliably.
    await expect(region).toBeEmpty();
    expect(await region.evaluate(el => !!el.closest('[inert],[aria-hidden="true"]'))).toBe(false);
    await page.getByRole('button', { name: 'Delete file', exact: true }).click();
    await expect(region).toContainText('Northpoint_TermSheet_v3.pdf');
    await expect(region.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  });

  test('a refusal raised from an open menu is still announced', async ({ page }) => {
    await page.addInitScript(offline);
    await page.goto('/');
    await page.getByRole('button', { name: 'Browser', exact: true }).click();
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Browser menu', exact: true });
    await menu.getByRole('button', { name: 'Find in page', exact: true }).click();
    const region = page.locator('[data-alpha-toast]');
    await expect(region).toContainText('Load a page before finding text in it.');
    // The menu is still open and holds the page inert; the status region is not part of what it retired.
    await expect(menu).toBeVisible();
    expect(await region.evaluate(el => !!el.closest('[inert],[aria-hidden="true"]'))).toBe(false);
    expect(await page.getByRole('button', { name: 'Tabs', exact: true }).count()).toBe(0);
  });
});

test.describe('photo editor in landscape', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 915, height: 412 } });
  test('scrolls to Rotate, Crop and the filters, which sit below the preview', async ({ page }) => {
    await page.goto('/?mode=mock&start=photos:viewer');
    await page.getByRole('button', { name: 'Edit photo', exact: true }).click();
    const editor = page.locator('[data-alpha-subview="photos-edit"]');
    await expect(editor).toBeVisible();
    expect(await editor.evaluate(el => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY === 'auto')).toBe(true);
    for (const name of ['Rotate', 'Crop', 'Mono filter']) await reachable(page, page.getByRole('button', { name, exact: true }));
    // Keyboard: a filter is operable without a pointer, and Save is still reachable afterwards.
    const mono = page.getByRole('button', { name: 'Mono filter', exact: true });
    await mono.focus(); await page.keyboard.press('Enter');
    await expect(mono).toHaveAttribute('aria-pressed', 'true');
    await reachable(page, page.getByRole('button', { name: 'Save edit', exact: true }));
  });
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

  test('a render failure under an open modal dialog dismisses the dialog and hands focus to Reload', async ({ page }) => {
    await page.addInitScript(offline);
    await page.goto('/');
    for (const name of ['Notes', 'New note', 'Link source document']) await page.getByRole('button', { name, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Note source document' });
    await expect(dialog).toBeVisible();
    // A modal <dialog> is in the top layer: left open, it covers recovery and makes it inert.
    expect(await page.evaluate(() => document.querySelector('dialog[open]')?.matches(':modal'))).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event('alpha:force-render-error')));
    const recovery = page.getByRole('alertdialog', { name: 'Alpha Phone needs to reload' });
    await expect(recovery).toBeVisible();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    const reload = recovery.getByRole('button', { name: 'Reload', exact: true });
    await expect(reload).toBeFocused();
    await reachable(page, reload);
    // The dismissed dialog linked nothing and focus stays in recovery.
    for (let step = 0; step < 4; step++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => { const active = document.activeElement; return !active || active === document.body || !!active.closest('.alpha-recovery'); })).toBe(true);
    }
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
