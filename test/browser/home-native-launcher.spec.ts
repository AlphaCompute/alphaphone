import { test, expect, type Page } from '@playwright/test';
// Development lane with a native-plugin stub: the page sees an Android Capacitor bridge whose
// DeviceApps, AlphaNotifications and AlphaVoiceCloud answers come from this file. No Android
// device, package manager or permission prompt is involved; LauncherHomeInstrumentedTest covers
// the real launcher APK holding HOME.

type Stub = { apps?: unknown; failLaunch?: string[]; dial?: unknown; notifications?: { permissionGranted: boolean; appEnabled: boolean }; microphone?: string; assistant?: boolean };

async function nativeStub(page: Page, stub: Stub) {
  await page.addInitScript((stub: Stub) => {
    localStorage.setItem('alpha.connection.selection.v1', JSON.stringify({ kind: 'offline' }));
    const w = window as any; w.nativeCalls = w.nativeCalls || []; w.androidBridge = {};
    const plugins: Record<string, string[]> = {
      DeviceApps: ['list', 'launch', 'resolveDefault', 'openDefault', 'buildInfo', 'localeInfo', 'launchInfo'],
      DailyApps: ['surfaceInfo', 'requestPermissions', 'closeAssistant'],
      AlphaNotifications: ['status', 'list'],
      AlphaVoiceCloud: ['checkPermissions', 'requestPermissions'],
      AlphaDevice: ['openSettings'],
    };
    const answer = (plugin: string, method: string, options: any) => {
      if (plugin === 'DeviceApps') {
        if (method === 'list') return { apps: stub.apps ?? [] };
        if (method === 'launch') { if ((stub.failLaunch || []).includes(options?.packageName)) throw Error('Activity not found'); return {}; }
        if (method === 'resolveDefault') return stub.dial ?? { role: 'dial', available: false };
        if (method === 'buildInfo') return { launcher: true, version: 'stub' };
        if (method === 'launchInfo') return { assistant: stub.assistant === true };
        if (method === 'localeInfo') return { locale: 'en-US', hour24: false };
        return {};
      }
      if (plugin === 'DailyApps' && method === 'surfaceInfo') return { assistant: false, developmentBuild: true, topInset: 0, bottomInset: 0 };
      if (plugin === 'AlphaNotifications' && method === 'status') return stub.notifications ?? { permissionGranted: true, appEnabled: true };
      if (plugin === 'AlphaVoiceCloud' && method === 'checkPermissions') return { microphone: stub.microphone ?? 'granted' };
      return {};
    };
    const cap: any = w.Capacitor = {
      Plugins: {},
      PluginHeaders: Object.entries(plugins).map(([name, methods]) => ({ name, methods: [...methods, 'addListener', 'removeListener'].map(m => ({ name: m, rtype: m === 'addListener' ? 'callback' : 'promise' })) })),
      nativeCallback: (plugin: string, method: string, options: any) => { w.nativeCalls.push({ plugin, method, options }); return 'stub-callback'; },
      nativePromise: async (plugin: string, method: string, options: any) => { w.nativeCalls.push({ plugin, method, options }); return answer(plugin, method, options); },
    };
    for (const name of Object.keys(plugins)) cap.Plugins[name] = { addListener: () => ({ remove: async () => {} }) };
  }, stub);
}
const calls = (page: Page, plugin: string, method: string) => page.evaluate(([plugin, method]) => (window as any).nativeCalls.filter((c: any) => c.plugin === plugin && c.method === method).map((c: any) => c.options ?? null), [plugin, method]);
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('the launcher drawer lists installed apps with icons, launches by package and opens the dialer', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await nativeStub(page, {
    apps: [
      { packageName: 'com.android.settings', label: 'Settings', icon: PNG },
      { packageName: 'org.example.broken', label: 'Broken app' },
      { packageName: 'org.example.bad-icon', label: 'Bad icon', icon: 'javascript:alert(1)' },
      { packageName: 'com.android.settings', label: 'Settings duplicate' },
    ],
    failLaunch: ['org.example.broken'],
    dial: { role: 'dial', available: true, packageName: 'com.android.dialer', label: 'Phone by Example' },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'All apps', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'All apps', exact: true });
  await expect(drawer.getByRole('button', { name: 'Open Settings', exact: true })).toBeVisible();
  // Icons are requested on Android; an entry with an unsafe icon or a duplicate package is dropped.
  expect(await calls(page, 'DeviceApps', 'list')).toEqual([{ icons: true }]);
  await expect(drawer.getByRole('button', { name: 'Open Bad icon', exact: true })).toHaveCount(0);
  await expect(drawer.getByRole('button', { name: 'Open Settings duplicate', exact: true })).toHaveCount(0);
  await expect(drawer.getByRole('status').first()).toHaveText('2 apps');
  await expect(drawer.getByRole('button', { name: 'Open Settings', exact: true }).locator('img')).toHaveAttribute('src', PNG);

  // The Phone shortcut is the resolved ACTION_DIAL handler, opened in two taps from Home.
  const phone = drawer.getByRole('button', { name: 'Open Phone (Phone by Example)', exact: true });
  await expect(phone).toBeVisible();
  await phone.click();
  expect(await calls(page, 'DeviceApps', 'openDefault')).toEqual([{ role: 'dial' }]);

  // Search, then launch by package name only.
  await drawer.getByRole('searchbox', { name: 'Search apps', exact: true }).fill('sett');
  await expect(phone).toHaveCount(0);
  await drawer.getByRole('button', { name: 'Open Settings', exact: true }).click();
  await expect.poll(() => calls(page, 'DeviceApps', 'launch')).toEqual([{ packageName: 'com.android.settings' }]);

  // A failed launch is reported in place and nothing is retried.
  await drawer.getByRole('searchbox', { name: 'Search apps', exact: true }).fill('broken');
  await drawer.getByRole('button', { name: 'Open Broken app', exact: true }).click();
  await expect(drawer.getByRole('alert')).toHaveText(/^Broken app could not be opened\./);
  expect(await calls(page, 'DeviceApps', 'launch')).toHaveLength(2);
  await page.screenshot({ path: info.outputPath('native-drawer.png') });
  expect(errors).toEqual([]);
});

test('an empty installed-app list says so and offers no Phone shortcut without a dialer', async ({ page }) => {
  await nativeStub(page, { apps: [], dial: { role: 'dial', available: false } });
  await page.goto('/');
  await page.getByRole('button', { name: 'All apps', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'All apps', exact: true });
  await expect(drawer.getByText('No other apps are installed.', { exact: true })).toBeVisible();
  await expect(drawer.getByRole('button', { name: /^Open / })).toHaveCount(0);
});

test('startup permission "Not now" survives a cold start, and a denied prompt is not requested again', async ({ page }) => {
  await nativeStub(page, { notifications: { permissionGranted: false, appEnabled: false }, microphone: 'granted' });
  await page.goto('/');
  const panel = page.getByRole('dialog', { name: 'Set up Alpha access', exact: true });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Enable notifications', exact: true }).click();
  await expect.poll(() => calls(page, 'DailyApps', 'requestPermissions')).toEqual([{ permissions: ['notifications'] }]);
  // Still denied: the next step is Android settings, never a second prompt.
  await expect(panel.getByRole('button', { name: 'Manage notifications in Android', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Not now', exact: true }).click();
  await expect(panel).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alpha.startup-permissions.v1') || 'null'))).toEqual({ dismissed: true, attempted: { notifications: true } });

  // Cold start: the panel stays dismissed.
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Ask Alpha', exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(panel).toHaveCount(0);

  // Reopened (the Settings entry point): the denied permission goes to Android settings, no prompt.
  await page.evaluate(async () => { const { reopenStartupPermissions } = await import('/src/startup-permission-flow.ts'); reopenStartupPermissions(); });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Manage notifications in Android', exact: true })).toBeVisible();
  expect(await calls(page, 'DailyApps', 'requestPermissions')).toEqual([]);
});

test('an Activity opened with the alpha.assistant extra renders chat and Close only', async ({ page }) => {
  // Notifications are denied, so a normal start would show the startup permission panel.
  await nativeStub(page, { assistant: true, notifications: { permissionGranted: false, appEnabled: false } });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/alpha-assistant-surface/);
  const close = page.getByRole('button', { name: 'Close assistant', exact: true });
  await expect(close).toBeVisible();
  await expect(page.getByRole('button', { name: 'All apps', exact: true })).toBeHidden();
  await page.waitForTimeout(500);
  await expect(page.getByRole('dialog', { name: 'Set up Alpha access', exact: true })).toHaveCount(0);
  await close.click();
  await expect.poll(() => calls(page, 'DailyApps', 'closeAssistant')).toHaveLength(1);
});
