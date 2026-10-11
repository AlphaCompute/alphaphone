import { test, expect, type Page } from '@playwright/test';
import { auditPage, auditTree, format } from './accessibility-audit';

// Gesture zones (docs/gesture-zones.md). On the launcher flavor a swipe from the very top edge
// opened Android's shade and a swipe from just below it opened Alpha's notifications: two panels
// behind one gesture, told apart by a few pixels. The top edge is Android's (docs/prd.md: the
// status shade is OS work, not CSS inside a launcher). Alpha's notifications now open only from a
// visible handle on Home: by tap, by keyboard, by an accessibility click, or by a pull that starts
// on the handle. This is Chromium on a development server; Android's own shade, TalkBack and the
// system gesture zone are covered by AccessibilityInstrumentedTest on an emulator, not here.
const offline = () => localStorage.setItem('alpha.connection.selection.v1', JSON.stringify({ kind: 'offline' }));
const panel = (page: Page) => page.locator('[data-alpha-layer="shade"]');
const handle = (page: Page) => page.getByRole('button', { name: 'Open notifications', exact: true });

async function home(page: Page, url = '/') {
  await page.addInitScript(offline);
  await page.goto(url);
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  await expect(panel(page)).toHaveAttribute('aria-hidden', 'true');
}
/** A real pointer drag in screen coordinates of the 412px phone canvas. */
async function drag(page: Page, from: { x: number; y: number }, dy: number) {
  const box = (await page.locator('[data-screen]').boundingBox())!, scale = box.width / 412;
  await page.mouse.move(box.x + from.x * scale, box.y + from.y * scale);
  await page.mouse.down();
  await page.mouse.move(box.x + from.x * scale, box.y + (from.y + dy) * scale, { steps: 10 });
  await page.mouse.up();
}
/** The handle's box in the phone canvas's own 412px coordinates. */
async function handleBox(page: Page) {
  return handle(page).evaluate(element => {
    const screen = element.closest('[data-screen]')!.getBoundingClientRect(), scale = screen.width / 412, box = element.getBoundingClientRect();
    return { left: (box.left - screen.left) / scale, top: (box.top - screen.top) / scale, width: box.width / scale, height: box.height / scale };
  });
}

for (const shell of [{ name: 'standalone app', url: '/' }, { name: 'launcher', url: '/?shell=launcher' }]) {
  test.describe(shell.name, () => {
    test('the handle is a visible, named, adequately sized control below the status bar', async ({ page }) => {
      await home(page, shell.url);
      await expect(handle(page)).toBeVisible();
      await expect(handle(page)).toContainText('Notifications');
      const box = await handleBox(page);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(120);
      // The launcher draws under Android's status bar (44px in the design): the handle starts below it.
      if (shell.name === 'launcher') expect(box.top).toBeGreaterThanOrEqual(44 + 8);
      // It names the region it opens, and the page passes the name, role, focus and target-size rules with it.
      expect(await handle(page).getAttribute('aria-controls')).toBe(await panel(page).getAttribute('id'));
      await expect(handle(page)).toHaveAttribute('aria-expanded', 'false');
      const found = format([...await auditTree(page), ...await auditPage(page, { targetSize: 44 })]).filter(line => line.includes('data-alpha-shade-handle'));
      expect(found, found.join('\n')).toEqual([]);
    });

    test('a tap opens the panel; Close, Back and Escape close it and focus returns to the handle', async ({ page }) => {
      await home(page, shell.url);
      await handle(page).click();
      await expect(panel(page)).toHaveAttribute('aria-hidden', 'false');
      await expect(panel(page).getByRole('status').filter({ hasText: 'No notifications' }).or(panel(page).locator('.alpha-shade-list > div').first())).toBeVisible();
      // Home is inert underneath; focus is inside the panel.
      await expect(page.locator('[data-alpha-layer="home"]')).toHaveAttribute('aria-hidden', 'true');
      await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[data-alpha-layer="shade"]'))).toBe(true);
      await panel(page).getByRole('button', { name: 'Close', exact: true }).click();
      await expect(panel(page)).toHaveAttribute('aria-hidden', 'true');
      await expect(handle(page)).toBeFocused();

      await handle(page).click();
      await expect(panel(page)).toHaveAttribute('aria-hidden', 'false');
      await page.keyboard.press('Escape');
      await expect(panel(page)).toHaveAttribute('aria-hidden', 'true');
      await expect(handle(page)).toBeFocused();

      await handle(page).click();
      await expect(panel(page)).toHaveAttribute('aria-hidden', 'false');
      // Android Back as the shell receives it.
      await page.evaluate(() => window.dispatchEvent(new Event('alpha-back', { cancelable: true })));
      await expect(panel(page)).toHaveAttribute('aria-hidden', 'true');
    });

    for (const key of ['Enter', 'Space']) {
      test(`the keyboard reaches the handle and ${key} opens the panel`, async ({ page }) => {
        await home(page, shell.url);
        // Reached in the tab order, not only by script.
        let reached = false;
        for (let presses = 0; presses < 40 && !reached; presses++) { await page.keyboard.press('Tab'); reached = await handle(page).evaluate(element => element === document.activeElement); }
        expect(reached, 'Tab reaches the notifications handle').toBe(true);
        await page.keyboard.press(key);
        await expect(panel(page)).toHaveAttribute('aria-hidden', 'false');
        await expect(panel(page).getByRole('button', { name: 'Close', exact: true })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(panel(page)).toHaveAttribute('aria-hidden', 'true');
        await expect(handle(page)).toBeFocused();
      });
    }

    test('an accessibility click with no pointer opens the panel', async ({ page }) => {
      await home(page, shell.url);
      // What TalkBack's double-tap and Switch Access deliver: the click action alone.
      await handle(page).evaluate(element => (element as HTMLElement).click());
      await expect(panel(page)).toHaveAttribute('aria-hidden', 'false');
    });

    test('a pull down that starts on the handle opens the panel', async ({ page }) => {
      await home(page, shell.url);
      const box = await handleBox(page);
      await drag(page, { x: box.left + box.width / 2, y: box.top + box.height / 2 }, 240);
      await expect(panel(page)).toHaveAttribute('aria-hidden', 'false');
      // A swipe up inside the open panel closes it.
      await drag(page, { x: 206, y: 500 }, -240);
      await expect(panel(page)).toHaveAttribute('aria-hidden', 'true');
    });

    test('no other downward swipe opens the panel: not the top edge, not beside or below the handle, not inside an app', async ({ page }) => {
      await home(page, shell.url);
      const box = await handleBox(page);
      const starts = [
        { name: 'top edge', x: 206, y: 3 },
        // The launcher draws under Android's status bar; the standalone app starts below it, where the handle is.
        ...(shell.name === 'launcher' ? [{ name: 'inside the status bar band', x: 206, y: 30 }] : []),
        { name: 'above the handle', x: 206, y: Math.max(1, box.top - 6) },
        { name: 'left of the handle', x: Math.max(8, box.left - 40), y: box.top + box.height / 2 },
        { name: 'below the handle', x: 206, y: box.top + box.height + 30 },
        { name: 'middle of Home', x: 206, y: 420 },
      ];
      for (const start of starts) {
        await drag(page, start, 260);
        await page.waitForTimeout(120);
        await expect(panel(page), start.name).toHaveAttribute('aria-hidden', 'true');
        // The swipe did nothing else either: still Home, no view opened.
        await expect(page.locator('html'), start.name).toHaveAttribute('data-active-view', 'home');
      }
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-active-view', 'settings');
      // In an app view there is no handle: the heights where Home has one do nothing.
      for (const y of [3, 30, 70]) {
        await drag(page, { x: 206, y }, 260);
        await page.waitForTimeout(120);
        await expect(panel(page), `Settings, start ${y}`).toHaveAttribute('aria-hidden', 'true');
      }
      await expect(page.locator('html')).toHaveAttribute('data-active-view', 'settings');
    });
  });
}

test('a taller status bar pushes the launcher handle down, clear of the system gesture zone', async ({ page }) => {
  await home(page, '/?shell=launcher');
  const before = await handleBox(page);
  // What MainActivity publishes on the launcher flavor: the status bar height in CSS pixels.
  await page.evaluate(() => document.documentElement.style.setProperty('--native-top-inset', '72px'));
  await expect.poll(async () => (await handleBox(page)).top).toBeGreaterThanOrEqual(72 + 8);
  expect((await handleBox(page)).top).toBeGreaterThan(before.top);
  await handle(page).click();
  await expect(panel(page)).toHaveAttribute('aria-hidden', 'false');
});

test('the handle keeps its target and its whole label at 200% text', async ({ page }) => {
  await home(page);
  await page.evaluate(async () => { const display = await import('/src/browser/display.ts' as string); display.installBrowserDisplay(); document.documentElement.style.setProperty('--browser-text-scale', '2'); });
  await page.waitForTimeout(350);
  const box = await handleBox(page);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.left + box.width).toBeLessThanOrEqual(412);
  const found = format(await auditPage(page, { clipping: true, overlap: true })).filter(line => !line.startsWith('text-truncated:'));
  expect(found, found.join('\n')).toEqual([]);
});
