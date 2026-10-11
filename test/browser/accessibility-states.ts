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
  /** The subview this state must put on screen; opening fails if it is not the exposed one. */
  shows?: string;
};

const offline = () => localStorage.setItem('alpha.connection.selection.v1', JSON.stringify({ kind: 'offline' }));
const settle = async (page: Page) => {
  await expect(page.locator('.alpha-phone')).toBeVisible();
  // Entry transitions are short even with reduced motion; fonts decide final geometry.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
};

const press = async (page: Page, steps: string[]) => { for (const step of steps) await page.getByRole('button', { name: step, exact: true }).first().click(); };
/** The named subview is on screen and exposed (not retired behind another subview). */
const showing = async (page: Page, subview?: string) => {
  if (subview) await expect(page.locator(`[data-alpha-subview="${subview}"]:not([inert])`)).toBeVisible();
};
const live = (name: string, steps: string[] = [], shows?: string): State => ({
  name: `live ${name}`, shows,
  open: async (page, theme) => {
    await page.addInitScript(offline);
    await page.goto(theme ? `/?theme=${theme}` : '/');
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
    await press(page, steps);
    await settle(page);
    await showing(page, shows);
  },
});
/** Fixture screens that finish arriving on a timer: the control that marks them complete. */
const ARRIVES: Record<string, string> = {
  // The scan fixture finds its page after about a second; the result actions are the state.
  'camera:scan': 'Add event',
};
const mock = (start: string, steps: string[] = [], shows?: string): State => ({
  name: `mock ${[start, ...steps].join(' > ')}`, shows,
  open: async (page, theme) => {
    await page.goto(`/?mode=mock&theme=${theme || 'light'}&start=${start}`);
    await settle(page);
    if (ARRIVES[start]) { await expect(page.getByRole('button', { name: ARRIVES[start], exact: true })).toBeVisible(); await settle(page); }
    if (steps.length) { await press(page, steps); await settle(page); }
    await showing(page, shows);
  },
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
  live('Notes trash', ['Notes', 'Open Trash'], 'notes-trash'),
  live('Files', ['Files']),
  live('Workflows', ['Workflows']),
  live('Settings', ['Settings']),
  live('Settings models', ['Settings', 'Models']),
  live('Settings display', ['Settings', 'Display']),
  live('Settings privacy', ['Settings', 'Privacy & data']),
  live('Settings about', ['Settings', 'About']),
  live('Settings scheduled digests', ['Settings', 'Scheduled digests']),
  live('Settings agent connection', ['Settings', 'Agent connection']),
  // The remaining Settings pages, and each app's open menu, search field and editor.
  live('Settings character', ['Settings', 'Character']),
  live('Settings accounts', ['Settings', 'Accounts']),
  live('Settings connections', ['Settings', 'Connections']),
  live('Settings notifications', ['Settings', 'Notifications']),
  live('Settings calendar', ['Settings', 'Calendar']),
  live('Settings password manager', ['Settings', 'Password manager']),
  live('Browser menu', ['Browser', 'Menu']),
  live('Browser address', ['Browser', 'Edit address']),
  live('Calendar alarms', ['Calendar', 'Clock alarms']),
  live('Photos search', ['Photos', 'Search photos']),
  live('Notes search', ['Notes', 'Search notes']),
  live('Notes source document', ['Notes', 'New note', 'Link source document']),
  live('Notes recording', ['Notes', 'Record and transcribe'], 'notes-recording'),
  live('Files search', ['Files', 'Search files']),
  live('Workflows new automation', ['Workflows', 'New automation'], 'automations-detail'),
];

/** The subview each fixture deep link must put on screen. */
const SUBVIEW: Record<string, string> = {
  'inbox:mail': 'inbox-detail', 'inbox:compose': 'inbox-composing',
  'calendar:event': 'calendar-detail', 'calendar:invite': 'calendar-detail', 'calendar:add': 'calendar-detail', 'calendar:new': 'calendar-form',
  'browser:tabs': 'browser-tabs',
  'photos:viewer': 'photos-viewer',
  'notes:editor': 'notes-editor', 'notes:rec': 'notes-recording', 'notes:voice': 'notes-voice',
  'files:folder': 'files-folder', 'files:preview': 'files-preview',
  'workflows:flow': 'workflows-detail', 'workflows:run': 'workflows-runOpen', 'workflows:failed': 'workflows-runOpen', 'workflows:new': 'workflows-builder',
};

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
].map(start => mock(start, [], SUBVIEW[start])).concat([
  // Subviews, menus, sheets and search fields one or two taps inside a view.
  mock('inbox', ['Search email']),
  mock('inbox:mail', ['Reply'], 'inbox-composing'),
  mock('calendar:event', ['Edit event'], 'calendar-form'),
  mock('calendar', ['Clock alarms']),
  mock('browser', ['Menu']),
  mock('browser', ['Menu', 'Bookmarks and history'], 'browser-library'),
  mock('browser', ['Menu', 'Share']),
  mock('browser', ['Edit address']),
  mock('photos:albums', ['Favorites'], 'photos-album'),
  mock('photos:viewer', ['Edit photo'], 'photos-edit'),
  mock('photos:viewer', ['Photo info']),
  mock('photos:viewer', ['Share photo']),
  mock('photos', ['Select photos']),
  mock('notes', ['Search notes']),
  mock('notes', ['Open The case for on-device agents'], 'notes-link'),
  mock('notes:editor', ['Share note']),
  mock('files', ['Search files']),
  mock('files:folder', ['View and sort']),
  mock('files:folder', ['Select files']),
  mock('files:preview', ['Rename']),
  mock('files:preview', ['Move file']),
  mock('files:preview', ['Share file']),
  // Deleting a fixture file shows the toast with Undo over the folder.
  mock('files:preview', ['Delete file']),
  mock('workflows:flow', ['Change'], 'workflows-builder'),
  // The builder's trigger and step sheets, and the Settings connection sheet.
  mock('workflows', ['New automation', 'Edit When step'], 'workflows-builder'),
  mock('workflows:new', ['Add Read step'], 'workflows-builder'),
  mock('settings', ['Connections', 'Slack']),
  mock('settings', ['Character']),
  mock('settings', ['Connections']),
  mock('settings', ['Notifications']),
  mock('settings:accounts', ['you@gmail.example']),
]);

/** Live states that exist only on the development server (developer surfaces). */
export const DEVELOPMENT_STATES: State[] = [
  live('Settings developer', ['Settings', 'Developer']),
];

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
