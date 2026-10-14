// First run on the flag-off Android renderer: no Cloud key is saved, the owner presses
// "Sign in with Eliza Cloud", and the interactive CLI-session sign-in leads to the resident agent's
// first reply. Then the branches that must leave nothing behind.
//
// Path under test: connectionController.residentCloudLogin -> CloudProtocol.login (POST
// /api/auth/cli-session, AlphaConnection.openExternal, polling /api/auth/cli-session/:id) -> the
// cloud:production slot -> admitCloudResident (identity, credits, configureCloudProvider) ->
// connectResident (Agent.start).
//
// Evidence boundary: source/test evidence for the flag-off renderer only. The bridge stub is not
// the native plugins, the browser hand-off, Eliza Cloud, the resident runtime or a device.
import { test, expect, type Page } from '@playwright/test';
import { flagOffAndroid, harness, button, fenceNetwork, expectNoDevelopmentSurface } from './flag-off-android';
import { residentStub, stub, setStub, type StubAccount } from './resident-stub';

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'production', 'Production bundle only'); });

const id = '9f1dc45a-4011-4e44-947a-30d999d24fa5';
const account: StubAccount = { token: 'first-run-key', userId: id, email: 'new-owner@example.invalid', balance: 5 };
const WAITING = 'Finish signing in to Eliza Cloud in your browser, then return here.';

async function firstRun(page: Page, overrides: Partial<StubAccount> = {}) {
  const foreign = await fenceNetwork(page);
  await flagOffAndroid(page);
  await residentStub(page, { emptyKeystore: true, accounts: [{ ...account, ...overrides }] });
  await page.goto('/');
  await setStub(page, { nextToken: account.token });
  const welcome = page.getByRole('dialog', { name: 'Welcome to Alpha' });
  await expect(welcome).toBeVisible({ timeout: 30_000 });
  await expect(welcome.getByRole('button', { name: 'Use local apps without AI', exact: true })).toBeEnabled();
  expect(await harness(page, f => f.slots['cloud:production'] ?? null)).toBeNull();
  return { foreign, welcome };
}
/** Nothing was kept or started, and the owner can still continue without AI. */
async function nothingLeft(page: Page, welcome: ReturnType<Page['getByRole']>) {
  await expect(welcome.getByRole('button', { name: 'Use local apps without AI', exact: true })).toBeEnabled();
  await expect(welcome.getByRole('button', { name: 'Sign in with Eliza Cloud', exact: true })).toBeEnabled();
  expect(await harness(page, f => f.slots['cloud:production'] ?? null)).toBeNull();
  expect(await harness(page, f => f.calls.includes('Agent.start'))).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('alpha.connection.selection.v1') ?? '')).not.toContain('resident');
}

test('first run: Cloud sign-in in the browser, credits, provider binding, then the resident agent answers', async ({ page }) => {
  test.setTimeout(120_000);
  const { foreign, welcome } = await firstRun(page);
  await welcome.getByRole('button', { name: 'Sign in with Eliza Cloud', exact: true }).click();
  await expect(welcome.getByText(WAITING, { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30_000 });
  await expect(button(page, 'Notes')).toBeVisible();

  const order = await stub(page, s => s.order) as string[];
  const stored = JSON.parse(await harness(page, f => f.slots['cloud:production']));
  expect(stored.token).toBe(account.token);
  // In call order: the browser hand-off, one pending poll, the key stored, credits read, the provider
  // bound to that key, and only then the agent started. Nothing was revoked (no key was saved before).
  const at = (entry: string) => order.indexOf(entry);
  expect(order.filter(entry => entry.startsWith('openExternal'))).toEqual(['openExternal https://eliza.app']);
  expect(order.filter(entry => entry.startsWith('poll'))).toEqual(['poll pending', 'poll authenticated']);
  expect(at('openExternal https://eliza.app')).toBeLessThan(at('poll pending'));
  expect(at('poll authenticated')).toBeLessThan(at('store first-run-key'));
  expect(at('store first-run-key')).toBeLessThan(at('credits new-owner@example.invalid'));
  expect(at('credits new-owner@example.invalid')).toBeLessThan(at('configureCloudProvider ' + stored.credentialId));
  expect(at('configureCloudProvider ' + stored.credentialId)).toBeLessThan(at('Agent.start'));
  expect(order.filter(entry => entry.startsWith('revoke'))).toEqual([]);
  expect(await stub(page, s => s.opened)).toEqual(['https://eliza.app/auth/cli-login?session=b7a2c1d0-5e4f-4a3b-8c2d-1e0f9a8b7c6d']);
  // Every Cloud request went to the Cloud API through the native transport.
  expect((await stub(page, s => s.cloud) as Array<{ path: string }>).map(row => row.path)).toEqual(expect.arrayContaining(['/api/auth/cli-session', '/api/v1/user', '/api/v1/credits/balance']));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alpha.connection.selection.v1')!))).toEqual({ kind: 'resident' });

  const ask = page.getByRole('textbox', { name: 'Ask Alpha', exact: true });
  await ask.fill('First request after sign-in'); await ask.press('Enter');
  await expect(page.getByRole('button', { name: 'Message actions: Resident reply 1', exact: true })).toHaveCount(1);
  expect(await harness(page, f => f.streams)).toBe(1);
  expect(await page.locator('body').innerText()).not.toContain(account.token);
  await expectNoDevelopmentSurface(page);
  expect(await harness(page, f => f.unexpected)).toEqual([]);
  expect(foreign).toEqual([]);
});

test('first run: Cancel while waiting for the browser sign-in keeps nothing and starts nothing', async ({ page }) => {
  test.setTimeout(90_000);
  const { foreign, welcome } = await firstRun(page);
  await setStub(page, { login: 'hold' });
  await welcome.getByRole('button', { name: 'Sign in with Eliza Cloud', exact: true }).click();
  await expect(welcome.getByText(WAITING, { exact: true })).toBeVisible();
  await expect.poll(() => stub(page, s => s.polls)).toBeGreaterThan(0);
  await welcome.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(welcome.getByText('Connection cancelled.', { exact: true })).toBeVisible();
  const polls = await stub(page, s => s.polls);
  await page.waitForTimeout(2000);
  expect(await stub(page, s => s.polls)).toBe(polls);
  await nothingLeft(page, welcome);
  expect(foreign).toEqual([]);
});

test('first run: an expired sign-in session keeps nothing and starts nothing', async ({ page }) => {
  test.setTimeout(90_000);
  const { welcome } = await firstRun(page);
  await setStub(page, { login: 'expired' });
  await welcome.getByRole('button', { name: 'Sign in with Eliza Cloud', exact: true }).click();
  await expect(welcome.getByText(/This sign-in link has expired/)).toBeVisible({ timeout: 30_000 });
  await nothingLeft(page, welcome);
});

test('first run: Cloud refusing the new key (401 on the account read) removes it and starts nothing', async ({ page }) => {
  test.setTimeout(90_000);
  const { welcome } = await firstRun(page, { userStatus: 401 });
  await welcome.getByRole('button', { name: 'Sign in with Eliza Cloud', exact: true }).click();
  await expect(welcome.getByRole('alert')).toBeVisible({ timeout: 30_000 });
  await expect(welcome).not.toContainText(/pair/i);
  expect(await stub(page, s => s.order.filter((entry: string) => entry.startsWith('store') || entry === 'remove cloud key'))).toEqual(['store first-run-key', 'remove cloud key']);
  await nothingLeft(page, welcome);
});

// An account Cloud reports unable to use AI no longer blocks the resident agent: billing state never
// retires local orchestration and Cloud refuses AI requests itself (subscription-entitlement.ts,
// connection-ui.tsx admitCloudResident). The plan view and its billing link are covered by
// native-cloud-subscription.spec.ts; the refusal on send by resident-failures.production.spec.ts.
