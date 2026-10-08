import { test, expect } from '@playwright/test';
// Rendered provider section over a synthetic native Agent bridge. No key reaches Cerebras: the
// native check is simulated here and covered by LocalAgentProviderInstrumentedTest on Android.

test('provider status, pinned model, verified save and confirmed key removal', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as any; w.androidBridge = {};
    const f = w.providerFixture = { saved: null as null | { model: string }, configures: [] as any[], clears: 0, stops: 0, reject: '' };
    const methods = (names: string[]) => names.map(name => ({ name, rtype: 'promise' }));
    const status = () => f.saved ? { provider: 'cerebras', configured: true, model: 'qwen-3.8-27b' } : { provider: 'cerebras', configured: false };
    w.Capacitor = {
      PluginHeaders: [
        { name: 'Agent', methods: methods(['getStatus', 'start', 'stop', 'request', 'configureProvider', 'providerStatus', 'clearProvider']) },
        { name: 'AlphaConnection', methods: methods(['secureRead', 'secureWrite', 'secureCompareExchange', 'secureRemove', 'request', 'cancel']) },
        { name: 'AlphaNotifications', methods: methods(['status', 'crossAppStatus', 'addListener', 'removeListener']) },
        { name: 'AlphaVoiceCloud', methods: methods(['checkPermissions']) },
        { name: 'DeviceApps', methods: methods(['buildInfo']) },
      ],
      nativePromise: async (plugin: string, method: string, input: any) => {
        if (plugin === 'DeviceApps') return { launcher: false, version: 'provider-fixture' };
        if (plugin === 'AlphaNotifications') return { permissionGranted: true, appEnabled: true };
        if (plugin === 'AlphaVoiceCloud') return { microphone: 'granted' };
        if (plugin === 'AlphaConnection') return method === 'secureRead' ? { value: null } : {};
        if (plugin === 'Agent') {
          if (method === 'getStatus') return { packaged: true, state: 'stopped', serviceActive: false, socketListening: false };
          if (method === 'providerStatus') return status();
          if (method === 'configureProvider') { f.configures.push(input); if (f.reject) throw new Error(f.reject); f.saved = { model: input.model }; return status(); }
          if (method === 'clearProvider') { f.clears++; f.saved = null; return { provider: 'cerebras', configured: false }; }
          if (method === 'stop') { f.stops++; return { state: 'stopping' }; }
        }
        throw new Error(`Unexpected native call ${plugin}.${method}`);
      },
    };
  });
  await page.goto('/');
  const chooser = page.locator('.alpha-connection');
  await expect(chooser).toBeVisible();
  await chooser.getByText('Model provider', { exact: true }).click();
  await expect(chooser.getByText('Not configured', { exact: true })).toBeVisible();
  // The model is fixed; there is no editable model field.
  await expect(chooser.getByLabel('Model')).toHaveCount(0);
  await expect(chooser.getByText('Model: qwen-3.8-27b', { exact: true })).toBeVisible();

  await page.evaluate(() => { (window as any).providerFixture.reject = 'Cerebras did not accept this key. It was not saved.'; });
  await chooser.getByLabel('Cerebras API key').fill('synthetic-rejected-key');
  await chooser.getByRole('button', { name: 'Save provider', exact: true }).click();
  await expect(chooser.getByRole('alert')).toContainText('Cerebras did not accept this key');
  await expect(chooser.getByText('Not configured', { exact: true })).toBeVisible();

  await page.evaluate(() => { (window as any).providerFixture.reject = ''; });
  await chooser.getByLabel('Cerebras API key').fill('synthetic-accepted-key');
  await chooser.getByRole('button', { name: 'Save provider', exact: true }).click();
  await expect(chooser.getByText('Configured · cerebras · qwen-3.8-27b', { exact: true })).toBeVisible();
  await expect(chooser.getByLabel('Cerebras API key')).toHaveValue('');
  const configures = await page.evaluate(() => (window as any).providerFixture.configures);
  expect(configures.map((item: any) => item.model)).toEqual(['qwen-3.8-27b', 'qwen-3.8-27b']);

  await chooser.getByRole('button', { name: 'Remove key…', exact: true }).click();
  await expect(chooser.getByText(/Remove the saved Cerebras key from this phone\?/)).toBeVisible();
  await chooser.getByRole('button', { name: 'Keep key', exact: true }).click();
  expect(await page.evaluate(() => (window as any).providerFixture.clears)).toBe(0);
  await chooser.getByRole('button', { name: 'Remove key…', exact: true }).click();
  await chooser.getByRole('button', { name: 'Remove key', exact: true }).click();
  await expect(chooser.getByText('Not configured', { exact: true })).toBeVisible();
  await expect(chooser.getByText(/Provider key removed from this phone/)).toBeVisible();
  expect(await page.evaluate(() => (window as any).providerFixture.clears)).toBe(1);
  await expect(chooser.getByRole('button', { name: 'Remove key…', exact: true })).toHaveCount(0);
  // Nothing in the page carries the key.
  expect(await page.content()).not.toContain('synthetic-accepted-key');
});
