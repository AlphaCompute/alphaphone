import { test, expect } from '@playwright/test';
// Development lane: the browser DeviceApps implementation stands in for Android's installed-app
// plugin (its "apps" are Alpha views). Android behaviour is covered by LauncherHomeInstrumentedTest.

test('All apps lists the device apps, searches, launches one and closes on Back and Home', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'All apps', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'All apps', exact: true });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Open Calendar', exact: true })).toBeVisible();
  await expect(drawer.getByRole('status').first()).toHaveText(/\d+ apps/);
  // Home behind the drawer is not reachable by touch or assistive technology.
  await expect(page.locator('[data-alpha-layer="home"]')).toHaveAttribute('aria-hidden', 'true');
  // The browser has no default dialer to resolve, so no Phone shortcut is offered.
  await expect(drawer.getByRole('button', { name: /^Open Phone/ })).toHaveCount(0);

  const search = drawer.getByRole('searchbox', { name: 'Search apps', exact: true });
  await search.fill('cal');
  await expect(drawer.getByRole('button', { name: 'Open Calendar', exact: true })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Open Notes', exact: true })).toHaveCount(0);
  await search.fill('zzzz');
  await expect(drawer.getByText('No apps match “zzzz”.', { exact: true })).toBeVisible();
  await search.fill('Calendar');
  await page.screenshot({ path: info.outputPath('drawer-search.png') });
  await drawer.getByRole('button', { name: 'Open Calendar', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-active-view', 'calendar');
  await expect(drawer).toHaveCount(0);

  // Home returns to Home, not to the drawer.
  await page.evaluate(() => window.dispatchEvent(new Event('launcher-home')));
  await expect(page.locator('html')).toHaveAttribute('data-active-view', 'home');
  await expect(drawer).toHaveCount(0);
  // Back closes an open drawer and keeps Home.
  await page.getByRole('button', { name: 'All apps', exact: true }).click();
  await expect(drawer).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('alpha-back', { cancelable: true })));
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  // The explicit close control also works.
  await page.getByRole('button', { name: 'All apps', exact: true }).click();
  await drawer.getByRole('button', { name: 'Close all apps', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a failed installed-app read shows an explicit failure with a manual retry', async ({ page }) => {
  await page.goto('/');
  // Fail only the next list() call of the browser device implementation behind DeviceApps.
  await page.evaluate(async () => {
    const { BrowserDevice } = await import('/src/browser/device.ts');
    const proto = BrowserDevice.prototype as any, original = proto.list;
    let failed = false;
    proto.list = function (...args: any[]) { if (!failed) { failed = true; return Promise.reject(Error('Package manager unavailable')); } return original.apply(this, args); };
  });
  await page.getByRole('button', { name: 'All apps', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'All apps', exact: true });
  await expect(drawer.getByText('Installed apps could not be read.', { exact: true })).toBeVisible();
  await expect(drawer.getByRole('button', { name: /^Open / })).toHaveCount(0);
  await drawer.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(drawer.getByRole('button', { name: 'Open Settings', exact: true })).toBeVisible();
});
