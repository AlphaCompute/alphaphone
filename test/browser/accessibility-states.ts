import { expect, type Page } from '@playwright/test';

/**
 * The retained MVP surface, as a list of states the accessibility sweep visits.
 *
 * "live" states use the product adapters with no connection and no data: they are what a
 * new or disconnected phone shows, including each app's empty, unavailable and
 * permission-denied states. "mock" states are the labelled fixture mode with populated
 * lists and open subviews, reached by its `start=` deep links (development server only).
 */
export type State = {
  name: string; open: (page: Page, theme?: 'light' | 'dark') => Promise<void>;
  /** A known large-text defect owned by another work package; the 200% check is marked fixme with this reason. */
  largeTextOpen?: string;
};

const offline = () => localStorage.setItem('alpha.connection.selection.v1', JSON.stringify({ kind: 'offline' }));
const settle = async (page: Page) => {
  await expect(page.locator('.alpha-phone')).toBeVisible();
  // Entry transitions are short even with reduced motion; fonts decide final geometry.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
};

const live = (name: string, steps: string[] = [], after?: (page: Page) => Promise<void>): State => ({
  name: `live ${name}`,
  open: async (page, theme) => {
    await page.addInitScript(offline);
    await page.goto(theme ? `/?theme=${theme}` : '/');
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
    for (const step of steps) await page.getByRole('button', { name: step, exact: true }).first().click();
    await after?.(page);
    await settle(page);
  },
});
const mock = (start: string): State => ({
  name: `mock ${start}`,
  open: async (page, theme) => { await page.goto(`/?mode=mock&theme=${theme || 'light'}&start=${start}`); await settle(page); },
});

/** Primary views and the subviews, dialogs and failure states reachable without a provider. */
export const LIVE_STATES: State[] = [
  live('Home'),
  live('All apps', ['All apps']),
  live('Conversation', ['Open conversation']),
  live('Inbox (not connected)', ['Inbox']),
  live('Calendar', ['Calendar']),
  live('Calendar new event', ['Calendar', 'New event']),
  live('Calendar month', ['Calendar', 'Month view']),
  live('Browser', ['Browser']),
  live('Browser tabs', ['Browser', 'Tabs']),
  live('Camera (unavailable)', ['Camera']),
  live('Photos (empty)', ['Photos']),
  live('Maps (no location)', ['Maps']),
  live('Notes (empty)', ['Notes']),
  live('Notes new note', ['Notes', 'New note']),
  { ...live('Notes trash', ['Notes', 'Open Trash']), largeTextOpen: 'Notes Trash (MVP-15, trash-recovery): the "Trash" heading is cut vertically by its fixed-height header at 200% text' },
  live('Files', ['Files']),
  live('Workflows', ['Workflows']),
  live('Settings', ['Settings']),
  live('Settings models', ['Settings', 'Models']),
  live('Settings display', ['Settings', 'Display']),
  live('Settings privacy', ['Settings', 'Privacy & data']),
  live('Settings about', ['Settings', 'About']),
  live('Settings scheduled digests', ['Settings', 'Scheduled digests']),
  live('Settings agent connection', ['Settings', 'Agent connection']),
];

/** Populated lists and open subviews of every retained view (fixture data, development only). */
export const MOCK_STATES: State[] = [
  'home', 'shade', 'sheet', 'full',
  'inbox', 'inbox:mail', 'inbox:compose',
  'calendar', 'calendar:event', 'calendar:invite', 'calendar:month', 'calendar:add', 'calendar:new',
  'browser', 'browser:book', 'browser:tabs',
  'camera', 'camera:video', 'camera:scan',
  'photos', 'photos:viewer', 'photos:albums', 'photos:search',
  'maps', 'maps:search', 'maps:place', 'maps:route', 'maps:nav',
  'notes', 'notes:editor', 'notes:rec', 'notes:voice',
  'files', 'files:folder', 'files:preview',
  'workflows', 'workflows:flow', 'workflows:run', 'workflows:failed', 'workflows:new',
  'settings', 'settings:accounts', 'settings:adding', 'settings:privacy',
].map(mock);

/** The renderer's own failure screens. */
export const FAILURE_STATES: State[] = [
  {
    name: 'render failure recovery',
    open: async page => {
      await page.addInitScript(offline); await page.goto('/');
      await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
      await page.evaluate(() => window.dispatchEvent(new Event('alpha:force-render-error')));
      const recovery = page.getByRole('alertdialog', { name: 'Alpha Phone needs to reload' });
      await expect(recovery).toBeVisible();
      await recovery.getByText('Diagnostics', { exact: true }).click();
    },
  },
  {
    name: 'startup failure recovery',
    open: async page => {
      await page.addInitScript(offline); await page.goto('/');
      await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
      // The plain-DOM screen used when React never mounted, shown over a live page here so the
      // sweep also proves it takes the page behind it out of focus order.
      await page.evaluate(async () => { const module = await import('/src/runtime/error-boundary.tsx' as string); module.showRecoveryScreen('startup', new Error('private detail')); });
      const recovery = page.getByRole('alertdialog', { name: 'Alpha Phone needs to reload' });
      await expect(recovery).toBeVisible();
      await recovery.getByText('Diagnostics', { exact: true }).click();
    },
  },
];

/** Large text as the renderer sees it: every declared pixel size multiplied, as WebView text zoom does. */
export async function setTextScale(page: Page, scale: number) {
  await page.evaluate(async value => {
    const display = await import('/src/browser/display.ts' as string);
    display.installBrowserDisplay();
    document.documentElement.style.setProperty('--browser-text-scale', String(value));
  }, scale);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
}
