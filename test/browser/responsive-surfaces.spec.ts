import { test, expect, type Page, type Locator } from '@playwright/test';

// Issue #411: surfaces that need seeded mail, photos or the scripted voice session, so they run in
// the labelled mock mode of the development server. Production behaviour of the same layout rules
// is covered by responsive-surfaces.production.spec.ts. Viewport changes stand in for rotation and
// resizing only; they do not qualify Android rotation, process recreation or TalkBack.
test.use({ hasTouch: true, isMobile: true, viewport: { width: 412, height: 915 } });

const MATRIX = [{ width: 640, height: 360 }, { width: 915, height: 412 }, { width: 800, height: 1280 }, { width: 1280, height: 800 }, { width: 412, height: 915 }];
const COLUMN = 720;
async function box(locator: Locator) { const value = await locator.boundingBox(); expect(value).not.toBeNull(); return value!; }
/** Resize, then wait until the renderer has measured the new window and rendered it. */
async function resize(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--alpha-visible-height'))).toBe(`${viewport.height}px`);
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))));
}
async function openMock(page: Page, app: string) {
  await page.goto('/?mode=mock');
  await page.getByRole('button', { name: app, exact: true }).click();
}

test('an Inbox message reads in a bounded column and a reply draft survives every size', async ({ page }) => {
  await openMock(page, 'Inbox');
  await page.getByRole('button', { name: /Jordan Park/ }).first().click();
  const message = page.getByRole('region', { name: 'Email message', exact: true });
  const paragraph = message.getByText(/Attached is the revised term sheet/).last();
  await resize(page, { width: 1280, height: 800 });
  const text = await box(paragraph);
  expect(text.width).toBeLessThanOrEqual(COLUMN + 1);
  // On a split canvas the message is the right pane; its text is centred in that pane.
  const pane = await box(page.locator('[data-alpha-subview="inbox-detail"]'));
  expect(Math.abs((text.x - pane.x) - (pane.x + pane.width - text.x - text.width))).toBeLessThan(4);
  await resize(page, { width: 412, height: 915 });

  await page.getByRole('button', { name: 'Reply', exact: true }).click();
  const fields = page.getByRole('region', { name: 'Email draft fields', exact: true });
  const draft = fields.getByRole('textbox').last();
  const words = 'Thanks Jordan, I will read the board language tonight and reply before Friday.';
  await draft.fill(words);
  await draft.evaluate((element: HTMLTextAreaElement) => { element.focus(); element.setSelectionRange(7, 13); });
  const original = await draft.elementHandle();
  for (const viewport of MATRIX) {
    await resize(page, viewport);
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
    await resize(page, viewport);
    for (const name of ['All', 'Work']) expect((await box(page.getByRole('button', { name, exact: true }))).height).toBeGreaterThanOrEqual(43.5);
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
    await resize(page, viewport);
    await expect(stop).toBeInViewport({ ratio: 1 });
    expect(await stop.evaluate((element, previous) => element === previous, original)).toBe(true);
    const bounds = await box(panel);
    if (viewport.width > viewport.height) expect(bounds.x).toBeGreaterThan(viewport.width / 2 - 1);
    else if (viewport.width >= 760) expect(bounds.width).toBeLessThanOrEqual(561);
    for (const control of [stop, panel.getByRole('button', { name: 'Switch to keyboard', exact: true })]) {
      const target = await box(control);
      expect(target.width).toBeGreaterThanOrEqual(43.5); expect(target.height).toBeGreaterThanOrEqual(43.5);
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
  await expect.poll(columns).toBe(3);
  await resize(page, { width: 915, height: 412 });
  await expect.poll(columns).toBeGreaterThanOrEqual(7);
  await resize(page, { width: 1280, height: 800 });
  await expect.poll(columns).toBeGreaterThanOrEqual(10);
  await page.getByRole('button', { name: 'Albums', exact: true }).click();
  const albums = page.locator('.photo-album-grid');
  await expect.poll(() => albums.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBeGreaterThanOrEqual(6);
  await resize(page, { width: 412, height: 915 });
  await expect.poll(() => albums.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
});

const inert = (locator: Locator) => locator.evaluate(element => !!element.closest('[inert]'));

test('Inbox shows the open message beside its list on a wide canvas and keeps the selection when it collapses', async ({ page }) => {
  await openMock(page, 'Inbox');
  await resize(page, { width: 1280, height: 800 });
  const jordan = page.getByRole('button', { name: /Jordan Park, Revised term sheet/ });
  await expect(jordan).toHaveAttribute('aria-label', /^Unread, /);
  await jordan.click();
  const list = page.locator('[data-alpha-subview="inbox-list"]'), detail = page.locator('[data-alpha-subview="inbox-detail"]');
  await expect(detail).toContainText('Revised term sheet');
  await expect.poll(() => inert(list)).toBe(false);
  expect((await box(list)).x + (await box(list)).width).toBeLessThanOrEqual((await box(detail)).x + 1);
  await expect(page.getByRole('button', { name: /Jordan Park/ }).first()).toHaveAttribute('aria-current', 'true');
  // Another message opens in the same pane, from the list beside it.
  await page.getByRole('button', { name: /Maya Chen/ }).first().click();
  await expect(detail).toContainText('Notes for the 3:00 review');
  await expect(page.getByRole('button', { name: /Maya Chen/ }).first()).toHaveAttribute('aria-current', 'true');
  // The message it replaced is left read, as Back leaves it, and is no longer the open row.
  await expect(jordan).not.toHaveAttribute('aria-label', /^Unread, /);
  await expect(jordan).toHaveAttribute('aria-current', 'false');
  // Focus on the list when the split collapses moves into the open message that now covers it.
  await jordan.focus();
  await resize(page, { width: 412, height: 915 });
  await expect.poll(() => detail.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await resize(page, { width: 1280, height: 800 });
  for (const viewport of [{ width: 412, height: 915 }, { width: 915, height: 412 }, { width: 640, height: 360 }, { width: 800, height: 1280 }]) {
    await resize(page, viewport);
    await expect(detail).toContainText('Notes for the 3:00 review');
    await expect.poll(() => inert(list)).toBe(viewport.width < 1000);
    await page.screenshot({ animations: 'disabled', path: test.info().outputPath(`inbox-split-${viewport.width}x${viewport.height}.png`) });
  }
});

test('Files previews beside its list on a tablet-width canvas and full screen on a phone', async ({ page }) => {
  await openMock(page, 'Files');
  await resize(page, { width: 1280, height: 800 });
  await page.getByRole('button', { name: /Design review notes/ }).first().click();
  const list = page.locator('[data-alpha-subview="files-list"]'), preview = page.locator('[data-alpha-subview="files-preview"]');
  await expect(preview).toContainText('Design review notes.pdf');
  await expect.poll(() => inert(list)).toBe(false);
  expect((await box(preview)).x).toBeGreaterThanOrEqual((await box(list)).x + (await box(list)).width - 1);
  await resize(page, { width: 412, height: 915 });
  await expect.poll(() => inert(list)).toBe(true);
  expect((await box(preview)).width).toBeGreaterThan(400);
  // A phone in landscape stays one pane; a tablet-width window splits again.
  await resize(page, { width: 915, height: 412 });
  await expect.poll(() => inert(list)).toBe(true);
  await resize(page, { width: 1280, height: 800 });
  await expect(preview).toContainText('Design review notes.pdf');
  await expect.poll(() => inert(list)).toBe(false);
});

test('Calendar day columns open the occurrence of the column that was tapped and keep the days on screen', async ({ page }) => {
  await openMock(page, 'Calendar');
  await resize(page, { width: 1280, height: 800 });
  const columns = page.locator('[data-alpha-calendar-day]');
  await expect(columns).toHaveCount(5);
  const labels = await columns.evaluateAll(list => list.map(column => column.getAttribute('aria-label')));
  // The weekday Standup repeats, so the same event is in several columns: the tapped column's
  // occurrence opens, not the first one.
  let index = -1;
  for (let i = labels.length - 1; i >= 2 && index < 0; i--) if (await columns.nth(i).getByRole('button', { name: /^Standup, / }).count()) index = i;
  expect(index).toBeGreaterThanOrEqual(2);
  await columns.nth(index).getByRole('button', { name: /^Standup, / }).click();
  const detail = page.locator('[data-alpha-subview="calendar-detail"]');
  await expect(detail).toContainText('Standup');
  const day = await page.evaluate(offset => { const date = new Date(); date.setDate(date.getDate() + offset); return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date); }, index);
  await expect(detail).toContainText(day);
  await resize(page, { width: 412, height: 915 });
  await expect(detail).toContainText('Standup');
  await expect(detail).toContainText(day);
  // Closing on the wide canvas keeps the same days on screen instead of jumping to the event's day.
  await resize(page, { width: 1280, height: 800 });
  await page.getByRole('button', { name: 'Back to calendar', exact: true }).click();
  await expect(detail).toHaveCount(0);
  await expect.poll(() => columns.evaluateAll(list => list.map(column => column.getAttribute('aria-label')))).toEqual(labels);
});
