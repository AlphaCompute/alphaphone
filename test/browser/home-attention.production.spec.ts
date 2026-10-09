import { test, expect } from '@playwright/test';
// Production lane (flag-off build, mocks unset). Home's attention, brief and calendar cards show
// honest states: no provider is connected in a fresh browser profile, no brief has run, and the
// calendar names where it was read from. The connected Inbox state of this card is exercised with
// development data in home-attention.spec.ts until a provider adapter reports through
// setHomeSources() in this lane.
test.beforeEach(({}, info) => { test.skip(info.project.name !== 'production', 'Runs against the flag-off production build only'); });
const offline = () => localStorage.setItem('alpha.connection.selection.v1', JSON.stringify({ kind: 'offline' }));

test('not connected: the attention card offers Gmail setup and opens Connections', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(offline);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-connection-mode', 'live');
  const card = page.getByRole('button', { name: 'Set up Gmail in Connections to see what needs your attention', exact: true });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Set up Gmail');
  await expect(page.getByText('Accounts are not connected')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('home-not-connected.png') });
  await card.click();
  await expect(page.locator('html')).toHaveAttribute('data-active-view', 'settings');
  await expect(page.getByRole('heading', { name: 'Connections', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('no brief yet, explicit calendar state with its device source, and no placeholder avatars', async ({ page }) => {
  await page.addInitScript(offline);
  await page.goto('/');
  const brief = page.getByRole('button', { name: 'Open workflows', exact: true });
  await expect(brief).toContainText('No brief yet');
  await brief.click();
  await expect(page.locator('html')).toHaveAttribute('data-active-view', 'workflows');
  await page.getByRole('button', { name: 'Back to apps', exact: true }).click();
  // The browser calendar is read from this browser; an empty calendar says so instead of neutral copy.
  const calendar = page.locator('[data-alpha-layer="home"] button[aria-label^="Open"]').first();
  await expect(calendar).toHaveAttribute('aria-label', /^(Open your calendar|Open calendar event: .+)$/);
  await expect(calendar).toContainText(/Nothing coming up|Calendar/);
  await expect(calendar).toContainText(/Read .+ from this browser/);
  await expect(calendar).not.toContainText(/^(MC|JP|\+2)$/);
  await expect(page.locator('[data-alpha-layer="home"]').getByText(/^(MC|JP|\+2)$/)).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Has a meeting link' })).toHaveCount(0);
});
