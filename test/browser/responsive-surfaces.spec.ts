import { test, expect, type Page, type Locator } from '@playwright/test';

// Issue #411: surfaces that need seeded mail, photos or the scripted voice session, so they run in
// the labelled mock mode of the development server. Production behaviour of the same layout rules
// is covered by responsive-surfaces.production.spec.ts. Viewport changes stand in for rotation and
// resizing only; they do not qualify Android rotation, process recreation or TalkBack.
test.use({ hasTouch: true, isMobile: true, viewport: { width: 412, height: 915 } });

const MATRIX = [{ width: 640, height: 360 }, { width: 915, height: 412 }, { width: 800, height: 1280 }, { width: 1280, height: 800 }, { width: 412, height: 915 }];
const COLUMN = 720;
async function box(locator: Locator) { const value = await locator.boundingBox(); expect(value).not.toBeNull(); return value!; }
async function openMock(page: Page, app: string) {
  await page.goto('/?mode=mock');
  await page.getByRole('button', { name: app, exact: true }).click();
}

test('an Inbox message reads in a bounded column and a reply draft survives every size', async ({ page }) => {
  await openMock(page, 'Inbox');
  await page.getByRole('button', { name: /Jordan Park/ }).first().click();
  const message = page.getByRole('region', { name: 'Email message', exact: true });
  const paragraph = message.getByText(/Attached is the revised term sheet/).last();
  await page.setViewportSize({ width: 1280, height: 800 });
  const text = await box(paragraph);
  expect(text.width).toBeLessThanOrEqual(COLUMN + 1);
  expect(Math.abs(text.x - (1280 - text.x - text.width))).toBeLessThan(4);
  await page.setViewportSize({ width: 412, height: 915 });

  await page.getByRole('button', { name: 'Reply', exact: true }).click();
  const fields = page.getByRole('region', { name: 'Email draft fields', exact: true });
  const draft = fields.getByRole('textbox').last();
  const words = 'Thanks Jordan, I will read the board language tonight and reply before Friday.';
  await draft.fill(words);
  await draft.evaluate((element: HTMLTextAreaElement) => { element.focus(); element.setSelectionRange(7, 13); });
  const original = await draft.elementHandle();
  for (const viewport of MATRIX) {
    await page.setViewportSize(viewport);
    await expect(draft).toHaveValue(words);
    expect(await draft.evaluate((element, previous) => element === previous, original)).toBe(true);
    expect(await draft.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd])).toEqual([7, 13]);
    const send = page.getByRole('button', { name: 'Send email', exact: true });
    await expect(send).toBeInViewport({ ratio: 1 });
    if (viewport.width >= 760) expect((await box(draft)).width).toBeLessThanOrEqual(COLUMN + 1);
    await page.screenshot({ animations: 'disabled', path: test.info().outputPath(`reply-${viewport.width}x${viewport.height}.png`) });
  }
});

test('Inbox folder filters and the list keep 44px targets and a readable list width', async ({ page }) => {
  await openMock(page, 'Inbox');
  for (const viewport of [{ width: 412, height: 915 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    for (const name of ['All', 'Work']) expect((await box(page.getByRole('button', { name, exact: true }))).height).toBeGreaterThanOrEqual(44);
    const row = page.getByRole('button', { name: /Jordan Park/ }).first();
    if (viewport.width >= 760) expect((await box(row)).width).toBeLessThanOrEqual(COLUMN + 1);
  }
});

test('the listening panel stays compact beside the page in landscape and keeps the same session', async ({ page }) => {
  await openMock(page, 'Files');
  await page.getByRole('button', { name: 'Talk', exact: true }).click();
  const panel = page.locator('[data-alpha-voice-panel]');
  const stop = panel.getByRole('button', { name: 'Stop', exact: true });
  await expect(stop).toBeVisible();
  const original = await stop.elementHandle();
  for (const viewport of MATRIX) {
    await page.setViewportSize(viewport);
    await expect(stop).toBeInViewport({ ratio: 1 });
    expect(await stop.evaluate((element, previous) => element === previous, original)).toBe(true);
    const bounds = await box(panel);
    if (viewport.width > viewport.height) expect(bounds.x).toBeGreaterThan(viewport.width / 2 - 1);
    else if (viewport.width >= 760) expect(bounds.width).toBeLessThanOrEqual(561);
    for (const control of [stop, panel.getByRole('button', { name: 'Switch to keyboard', exact: true })]) {
      const target = await box(control);
      expect(target.width).toBeGreaterThanOrEqual(44); expect(target.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ animations: 'disabled', path: test.info().outputPath(`voice-${viewport.width}x${viewport.height}.png`) });
  }
  await stop.click();
  await expect(panel).toHaveCount(0);
});

test('the Photos grid reflows into more columns and the album grid keeps square covers', async ({ page }) => {
  await openMock(page, 'Photos');
  const grid = page.locator('.photo-grid').first();
  const columns = () => grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(await columns()).toBe(3);
  await page.setViewportSize({ width: 915, height: 412 });
  expect(await columns()).toBeGreaterThanOrEqual(7);
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await columns()).toBeGreaterThanOrEqual(10);
  await page.getByRole('button', { name: 'Albums', exact: true }).click();
  const albums = page.locator('.photo-album-grid');
  expect(await albums.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBeGreaterThanOrEqual(6);
  await page.setViewportSize({ width: 412, height: 915 });
  expect(await albums.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
});
