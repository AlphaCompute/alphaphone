import { test, expect, type Page, type Locator } from '@playwright/test';

// Every enabled root view on a fresh profile, and with browser storage blocked, in both themes.
// Product rule: an honest, labelled empty or unconnected state (never fixture content), a
// role=alert when persistent storage is unavailable, a named landmark for the active view, and
// keyboard focus that lands on a named control inside it. No new dependency: plain Playwright.
//
// KNOWN_GAPS records checks the current product does not meet yet. Such a test still opens the
// view, then asserts the gap is still present and annotates it as a known gap, so a fix makes the
// test fail until its entry is removed. The owning view adapters are outside this work package.
type Check = 'empty' | 'alert' | 'landmark' | 'focus';
const ROOT = ['Inbox', 'Calendar', 'Browser', 'Camera', 'Photos', 'Maps', 'Notes', 'Files', 'Workflows', 'Settings'] as const;
type View = typeof ROOT[number] | 'Reminders' | 'Notifications';
const VIEWS: View[] = [...ROOT, 'Reminders', 'Notifications'];
const EMPTY: Record<View, RegExp> = {
  Inbox: /Connect Eliza Cloud to use Gmail/,
  Calendar: /No events|Nothing scheduled/,
  Browser: /No open pages|New tab/,
  Camera: /Camera unavailable or permission denied/,
  Photos: /^No photos$/,
  Maps: /Maps provider not connected/,
  Notes: /No notes yet/,
  Files: /No files/,
  Workflows: /Agent connection required/,
  Settings: /Not signed in/,
  Reminders: /No reminders/,
  Notifications: /No notifications/,
};
const KNOWN_GAPS: Partial<Record<Check, Partial<Record<View, string>>>> = {
  empty: {
    Calendar: 'An empty week renders only the time grid; there is no labelled "no events" state.',
    Browser: 'The new-tab page shows only the address field; there is no labelled empty state.',
    Files: 'Files lists picker locations; there is no labelled "no files" state.',
    Reminders: 'Reminders live inside Calendar with no labelled empty reminder state.',
  },
  alert: Object.fromEntries(VIEWS.map(view => [view, 'Storage failures are announced with role=status (or not at all), never role=alert.'])),
  landmark: Object.fromEntries(VIEWS.map(view => [view, 'The active app layer is a plain div; there is no main/region landmark named for the view.'])),
};
// Fixture identities from the reference prototype must never appear in a live profile.
const FIXTURE = [/\bMaya\b/, /\bJordan\b/, /\bNopa\b/, /2,418 items/, /Morning brief/];

// A cold dev server compiles the app on first load; allow for it without hiding slow views.
test.describe.configure({ timeout: 60_000 });

async function blockStorage(page: Page) {
  await page.addInitScript(() => {
    const blocked = () => { throw new DOMException('Storage blocked for this test', 'SecurityError'); };
    for (const key of ['localStorage', 'sessionStorage', 'indexedDB']) Object.defineProperty(window, key, { configurable: true, get: blocked });
  });
}
async function open(page: Page, view: View, theme: 'light' | 'dark'): Promise<Locator> {
  await page.goto(theme === 'dark' ? '/?theme=dark' : '/');
  const calendar = page.getByRole('button', { name: 'Calendar', exact: true });
  await calendar.waitFor({ state: 'visible' });
  if (view === 'Notifications') {
    // The shade is the notification surface; it opens with a downward swipe from the status bar.
    await page.mouse.move(200, 15); await page.mouse.down(); await page.mouse.move(200, 320, { steps: 12 }); await page.mouse.up();
    const shade = page.locator('[data-alpha-layer="shade"]');
    await expect(shade).toHaveAttribute('aria-hidden', 'false');
    return shade;
  }
  await page.getByRole('button', { name: view === 'Reminders' ? 'Calendar' : view, exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-active-view', view === 'Reminders' ? 'calendar' : view.toLowerCase());
  const app = page.locator('[data-alpha-layer="app"]');
  await expect(app).toHaveAttribute('aria-hidden', 'false');
  return app;
}
async function themeIsApplied(surface: Locator, theme: 'light' | 'dark') {
  const luminance = await surface.evaluate(element => {
    const [r, g, b] = getComputedStyle(element).color.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  });
  // Dark theme draws light foreground text; light theme draws dark text.
  if (theme === 'dark') expect(luminance).toBeGreaterThan(0.5); else expect(luminance).toBeLessThan(0.5);
}
/** Assert the requirement, or for a recorded gap assert that it is still unmet. */
async function requirement(check: Check, view: View, target: Locator, timeout = 2_000) {
  const reason = KNOWN_GAPS[check]?.[view];
  if (!reason) { await expect(target.first()).toBeVisible({ timeout }); return; }
  test.info().annotations.push({ type: 'known-gap', description: `${check} · ${view}: ${reason}` });
  await expect(target.first(), `${check} gap for ${view} appears fixed; remove it from KNOWN_GAPS`).not.toBeVisible({ timeout });
}

for (const theme of ['light', 'dark'] as const) for (const view of VIEWS) {
  test(`${view} ${theme}: fresh profile shows a labelled empty state`, async ({ page }) => {
    const surface = await open(page, view, theme);
    // The camera viewfinder is always drawn dark; every other surface follows the theme.
    if (view !== 'Camera') await themeIsApplied(surface, theme);
    await page.waitForTimeout(500);
    const text = await surface.innerText();
    for (const fixture of FIXTURE) expect(text, `${view} renders fixture ${fixture}`).not.toMatch(fixture);
    await requirement('empty', view, surface.getByText(EMPTY[view]), 5_000);
  });

  test(`${view} ${theme}: blocked storage raises a role=alert`, async ({ page }) => {
    await blockStorage(page);
    await open(page, view, theme);
    // Whatever the alert role, the failure must be visible and must not be hidden behind fixtures.
    await expect(page.locator('[role=status],[role=alert]').filter({ hasText: /could not|unavailable|recovery|retry/i, visible: true }).first()).toBeVisible({ timeout: 5_000 });
    await requirement('alert', view, page.getByRole('alert').filter({ hasText: /storage|could not|unavailable|recovery|retry/i }), 3_000);
  });

  test(`${view} ${theme}: active view is a named landmark`, async ({ page }) => {
    await open(page, view, theme);
    const name = view === 'Reminders' ? /Reminders|Calendar/ : new RegExp(view);
    await requirement('landmark', view, page.getByRole('main', { name }).or(page.getByRole('region', { name })).or(page.getByRole('dialog', { name })));
  });

  test(`${view} ${theme}: keyboard focus enters a named control in the view`, async ({ page }) => {
    const surface = await open(page, view, theme);
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveCount(1);
    expect(await focused.evaluate((element, root) => root!.contains(element), await surface.elementHandle())).toBe(true);
    const name = await focused.evaluate(element => (element.getAttribute('aria-label') || (element as HTMLElement).innerText || element.getAttribute('title') || '').trim());
    expect(name.length, 'focused control has an accessible name').toBeGreaterThan(0);
  });
}
