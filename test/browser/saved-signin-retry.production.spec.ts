import {completeOptionalAccessSetup} from './flag-off-android';
import { test, expect, type Page } from '@playwright/test';

// A Cloud sign-in kept on the phone after a restart, under decision P-43 (resident agent always
// present). An older build's "local apps without AI" choice is stored; it now reads as the resident.
// The resident starts by itself at app start and the kept sign-in is tried once to bind inference.
// Both panels that offer the sign-in (Settings › Agent connection and the one Inbox opens, "Connect
// Eliza Cloud") show the same state: a sign-in Cloud could not be reached is offered as "Retry saved
// connection" with what failed, a sign-in Cloud rejects is reported as no longer valid and not offered
// again, and an admitted one binds inference. The agent runs in every case and only on the device.
//
// Flag-off production bundle with the Android bridge stubbed. The stub is not the native plugins,
// the keystore or Eliza Cloud; the Android run is test-native-restart.mjs inbox on an emulator.
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'production', 'Production bundle only'); });
type Mode = 'offline' | 'rejected' | 'funded';
type Call = { plugin: string; method: string; path?: string; url?: string };

async function boot(page: Page, mode: Mode) {
  await page.addInitScript(mode => {
    const w = window as any; w.androidBridge = {}; w.residentCalls = [];
    const id = '9f1dc45a-4011-4e44-947a-30d999d24fa5';
    // The state an older build's restart leaves: local apps chosen, and a sign-in still in the keystore.
    if (!sessionStorage.getItem('saved-signin-fixture')) { sessionStorage.setItem('saved-signin-fixture', '1'); localStorage.setItem('alpha.connection.selection.v1', JSON.stringify({ kind: 'offline', localApps: true })); }
    const values: Record<string, string> = { 'cloud:production': JSON.stringify({ token: 'synthetic-cloud-key', credentialId: id, expiresAt: Date.now() + 600000 }) };
    const methods = (names: string[]) => names.map(name => ({ name, rtype: 'promise' }));
    w.Capacitor = { PluginHeaders: [
      { name: 'DeviceApps', methods: methods(['buildInfo']) },
      { name: 'Agent', methods: methods(['getStatus', 'start', 'stop', 'configureCloudProvider', 'clearProvider', 'providerStatus', 'request']) },
      { name: 'AlphaConnection', methods: methods(['secureRead', 'secureWrite', 'secureRemove', 'secureCompareExchange', 'request', 'cancel', 'openExternal']) },
      { name: 'AlphaNotifications', methods: methods(['status', 'crossAppStatus', 'addListener', 'removeListener']) },
      { name: 'AlphaVoiceCloud', methods: methods(['checkPermissions']) },
    ], nativePromise: async (plugin: string, method: string, input: any) => {
      w.residentCalls.push({ plugin, method, path: input?.path, url: input?.url });
      if (plugin === 'DeviceApps') return { launcher: false, version: 'saved-signin-fixture' };
      if (plugin === 'AlphaNotifications') return { permissionGranted: true, appEnabled: true };
      if (plugin === 'AlphaVoiceCloud') return { microphone: 'granted' };
      if (plugin === 'Agent') {
        if (method === 'getStatus') return { packaged: true, state: 'stopped', serviceActive: false, socketListening: false };
        if (method === 'clearProvider') return { configured: false };
        if (method === 'providerStatus') return { provider: 'elizacloud', configured: false };
        if (method === 'request') {
          const body = input.path === '/api/auth/me' ? { identity: { id, kind: 'owner' }, access: { role: 'OWNER', mode: 'local' } }
            : input.path === '/api/agents' ? { agents: [{ id, name: 'Alpha', status: 'running' }] }
            : input.path === '/api/conversations' ? { conversations: [] } : {};
          return { status: 200, body: JSON.stringify(body) };
        }
        return {};
      }
      if (method === 'secureRead') return { value: values[input.slot] ?? null };
      if (method === 'secureWrite') { values[input.slot] = input.value; return {}; }
      if (method === 'secureRemove') { delete values[input.slot]; return {}; }
      if (method === 'request') {
        // No network: every Cloud request fails before an answer.
        if (mode === 'offline') throw Error('Connection request failed');
        const path = new URL(input.url).pathname;
        // Cloud no longer accepts the kept sign-in.
        if (mode === 'rejected') return { status: 401, data: { error: 'unauthorized' } };
        if (path === '/api/v1/user') return { status: 200, data: { success: true, data: { id } } };
        if (path === '/api/v1/subscription/entitlement') return { status: 404, data: {} }; // Deployed Cloud has no subscription entitlement route yet.
        if (path === '/api/v1/billing/limits') return { status: 200, data: { success: true, data: { v2: { subscription: { status: 'available', value: { planKey: 'plus_monthly', state: 'active', currentPeriodEnd: '2099-01-01T00:00:00.000Z' } } } } } };
        if (path === '/api/v1/eliza/google/accounts') return { status: 200, data: { accounts: [] } };
        throw Error('Unexpected Cloud route: ' + path);
      }
      return {};
    } };
  }, mode);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Notes', exact: true })).toBeVisible();
  // P-43: the resident starts by itself. Only a sign-in Cloud rejects opens the sign-in dialog.
  await expect.poll(() => agentCalls(page)).toContain('start');
  if (mode === 'funded') await completeOptionalAccessSetup(page);
  if (mode !== 'rejected') await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await selection(page)).toEqual({ kind: 'resident' });
}
const calls = (page: Page) => page.evaluate(() => (window as any).residentCalls as Call[]);
const cloudRequests = async (page: Page) => (await calls(page)).filter(call => call.plugin === 'AlphaConnection' && call.method === 'request').map(call => new URL(call.url!).pathname);
const agentCalls = async (page: Page) => (await calls(page)).filter(call => call.plugin === 'Agent').map(call => call.method);
const selection = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('alpha.connection.selection.v1') || 'null'));

const PANELS = {
  Inbox: {
    heading: 'Eliza Cloud',
    retry: 'Retry saved connection',
    open: async (page: Page) => {
      await page.getByRole('button', { name: 'Inbox', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-active-view', 'inbox');
      await expect(page.getByText('Connect Eliza Cloud to use Gmail')).toBeVisible();
      await page.getByRole('button', { name: 'Connect Eliza Cloud', exact: true }).click();
    },
  },
  Settings: {
    heading: 'Your agent',
    retry: 'Try again',
    open: async (page: Page) => {
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByRole('button', { name: /Agent connection/ }).click();
    },
  },
} as const;

for (const [name, panel] of Object.entries(PANELS)) {
  test.describe(`${name} panel`, () => {
    test('a kept sign-in Cloud cannot reach is offered as a retry that says what failed; the agent keeps running', async ({ page }) => {
      await boot(page, 'offline');
      expect(await agentCalls(page)).not.toContain('configureCloudProvider');
      // Beside the running agent, a closable notice says Cloud is unreachable; the owner dismisses it.
      const notice = page.getByRole('region', { name: 'Eliza Cloud plan notice' });
      await expect(notice).toContainText('Eliza Cloud cannot be reached right now. Your agent is running on this phone');
      await notice.getByRole('button', { name: 'Dismiss plan notice', exact: true }).click();
      await expect(notice).toHaveCount(0);
      await panel.open(page);
      const dialog = page.getByRole('dialog', { name: panel.heading });
      await expect(dialog.getByRole('button', { name: panel.retry, exact: true })).toBeVisible();
      await expect(dialog.getByText(/Eliza Cloud cannot be reached right now/)).toBeVisible();
      // Nothing claims an account: no account summary, no "Signed in", no credits.
      await expect(dialog.locator('.alpha-cloud-account-summary')).toHaveCount(0);
      await expect(dialog.getByText(/Signed in|Credits available/)).toHaveCount(0);
      const starts = (await agentCalls(page)).filter(call => call === 'start').length;
      await dialog.getByRole('button', { name: panel.retry, exact: true }).click();
      // The retry restarts the resident and tries the sign-in once more; it fails the same way.
      await expect.poll(async () => (await agentCalls(page)).filter(call => call === 'start').length).toBeGreaterThan(starts);
      expect(await agentCalls(page)).not.toContain('configureCloudProvider');
      expect(await selection(page)).toEqual({ kind: 'resident' });
    });

  });
}

test('a kept sign-in Cloud rejects is reported as no longer valid in the sign-in dialog that opens by itself; the agent keeps running', async ({ page }) => {
  await boot(page, 'rejected');
  // Every Alpha Phone needs an Eliza Cloud account: the sign-in dialog opens and cannot be dismissed.
  const dialog = page.getByRole('dialog', { name: 'Your agent' });
  await expect(dialog.getByText('Your saved Cloud sign-in is no longer valid.', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Retry saved connection', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Sign in with Eliza Cloud', exact: true })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: 'Close connection settings', exact: true })).toHaveCount(0);
  await expect(dialog.locator('.alpha-cloud-account-summary')).toHaveCount(0);
  await expect.poll(() => agentCalls(page)).toContain('start');
  expect(await agentCalls(page)).not.toContain('configureCloudProvider');
});

test('a kept sign-in Cloud admits binds inference at start and runs the on-device agent only', async ({ page }) => {
  await boot(page, 'funded');
  // Identity and plan status were read. Once signed in, Inbox may read its Gmail accounts. No
  // Cloud-hosted agent is listed, provisioned or restored and no remote session is opened.
  await expect.poll(() => agentCalls(page)).toContain('configureCloudProvider');
  const paths = await cloudRequests(page);
  expect(paths).toEqual(expect.arrayContaining(['/api/v1/user', '/api/v1/billing/limits']));
  expect(paths.filter(path => !['/api/v1/user', '/api/v1/subscription/entitlement', '/api/v1/billing/limits', '/api/v1/eliza/google/accounts'].includes(path))).toEqual([]);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Agent connection/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Your agent' });
  await expect(dialog.getByText('Running on this device', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Eliza Cloud plan' })).toBeVisible();
  expect((await selection(page))?.kind).toBe('resident');
});
