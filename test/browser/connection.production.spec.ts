import { test, expect, type Route } from '@playwright/test';
// Production web bundle (flag off) pairing a synthetic HTTPS remote agent through the browser
// AlphaConnection factory. Playwright fulfils https://agent.example.test; no real agent, account,
// network host or model is used. It does not prove Android, Cloud CORS or a deployed agent.

const origin = 'https://agent.example.test';
const owner = '0f1b6c2e-8f43-4c8a-9a52-5b7e0e1a1f11', agent = '7d4e0c1a-2b3c-4d5e-8f60-718293a4b5c6';
const conversation = 'c0ffee00-1111-4222-8333-444455556666';
const token = 'synthetic-machine-session';

// The development chromium lane also matches this file; it asserts the flag-off bundle only.
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'production', 'Production bundle only'); });

interface AgentFixture { requests: Array<{ method: string; path: string; authorization?: string; body?: any }>; revoked: boolean; messages: Array<Record<string, unknown>> }

async function serveAgent(route: Route, fixture: AgentFixture, page: import('@playwright/test').Page) {
  const request = route.request(), url = new URL(request.url());
  const cors = { 'access-control-allow-origin': new URL(page.url()).origin, 'access-control-allow-headers': 'accept,content-type,authorization,x-eliza-device-id,x-eliza-device-key,x-eliza-device-capabilities', 'access-control-allow-methods': 'GET,POST' };
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  const authorization = request.headers()['authorization'];
  const body = request.postData() ? JSON.parse(request.postData()!) : undefined;
  fixture.requests.push({ method: request.method(), path: url.pathname + url.search, authorization, body });
  const json = (status: number, value: unknown) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(value) });
  if (url.pathname === '/api/auth/status') return json(200, { required: true, authenticated: false, pairingEnabled: true, instanceId: 'synthetic-instance', bootstrapRequired: false, expiresAt: null });
  if (url.pathname === '/api/auth/pair') return body?.code === 'SYNTH-CODE' ? json(200, { token, identityId: owner, instanceId: 'synthetic-instance', access: 'owner' }) : json(403, {});
  if (authorization !== `Bearer ${token}` || fixture.revoked) return json(401, {});
  if (url.pathname === '/api/auth/me') return json(200, { identity: { id: owner, kind: 'owner', displayName: 'Synthetic owner' }, session: { id: token, kind: 'machine', expiresAt: Date.now() + 3_600_000 }, access: { role: 'OWNER', mode: 'session' } });
  if (url.pathname === '/api/agents') return json(200, { agents: [{ id: agent, name: 'Synthetic remote', status: 'running' }] });
  if (url.pathname === '/api/client-devices/register') return json(200, { installationId: request.headers()['x-eliza-device-id'], enrollmentId: 'synthetic-enrollment', capabilities: [] });
  if (url.pathname === '/api/client-devices/revoke' || url.pathname === '/api/auth/logout') { if (url.pathname === '/api/auth/logout') fixture.revoked = true; return json(200, { ok: true }); }
  if (url.pathname === '/api/client-devices/proposals') return json(200, { proposals: [] });
  if (url.pathname === '/api/conversations') return request.method() === 'POST' ? json(200, { conversation: { id: conversation, title: 'Alpha Phone' } }) : json(200, { conversations: fixture.messages.length ? [{ id: conversation, title: 'Alpha Phone' }] : [] });
  if (url.pathname === `/api/conversations/${conversation}/messages` && request.method() === 'GET') return json(200, { messages: fixture.messages });
  if (url.pathname === `/api/conversations/${conversation}/messages` && request.method() === 'POST') {
    const now = Date.now();
    fixture.messages.push({ id: '9a8b7c6d-0000-4000-8000-000000000001', role: 'user', text: body.text, timestamp: now }, { id: '9a8b7c6d-0000-4000-8000-000000000002', role: 'assistant', text: 'Synthetic remote reply', timestamp: now + 1 });
    return json(200, { text: 'Synthetic remote reply', agentName: 'Synthetic remote' });
  }
  return json(404, {});
}

test('the web build pairs a synthetic HTTPS remote agent, sends one message and revokes on disconnect', async ({ page }) => {
  const fixture: AgentFixture = { requests: [], revoked: false, messages: [] };
  const foreign: string[] = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return serveAgent(route, fixture, page);
    if (url.hostname === '127.0.0.1') return route.continue();
    foreign.push(url.href); return route.abort();
  });
  await page.goto('/');
  const chooser = page.locator('.alpha-connection');
  await expect(chooser.getByText('On-device agent unavailable here', { exact: true })).toBeVisible();
  await chooser.getByText('Remote agent', { exact: true }).click();
  await chooser.getByLabel('Agent HTTPS address').fill(origin);
  await chooser.getByLabel('Pairing code').fill('SYNTH-CODE');
  await chooser.getByRole('button', { name: 'Connect remote agent', exact: true }).click();
  await expect(page.locator('.alpha-connection-scrim')).toHaveCount(0);
  // The pairing token is kept in the connection secret store, never in Web Storage.
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(storage).not.toContain(token);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alpha.connection.selection.v1')!))).toEqual({ kind: 'remote', origin });

  const input = page.getByRole('textbox', { name: 'Ask Alpha' });
  await input.fill('Hello from the web build'); await input.press('Enter');
  await expect(page.getByText('Synthetic remote reply', { exact: true })).toBeVisible();
  const sends = fixture.requests.filter(item => item.method === 'POST' && item.path === `/api/conversations/${conversation}/messages`);
  expect(sends).toHaveLength(1);
  expect(sends[0].authorization).toBe(`Bearer ${token}`);
  expect(sends[0].body.text).toContain('Hello from the web build');
  expect(typeof sends[0].body.clientMessageId).toBe('string');

  // Reload restores the paired session from the browser secret store without re-pairing, and
  // the saved conversation comes back from the agent's persisted history.
  await page.reload();
  await expect(page.locator('.alpha-connection-scrim')).toHaveCount(0);
  expect(fixture.requests.filter(item => item.path === '/api/auth/pair')).toHaveLength(1);
  await expect.poll(() => fixture.requests.filter(item => item.method === 'GET' && item.path.startsWith(`/api/conversations/${conversation}/messages`)).length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Open conversation', exact: true }).click();
  await expect(page.getByText('Synthetic remote reply', { exact: true })).toBeVisible();
  await expect(page.getByText('Hello from the web build', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Minimize chat', exact: true }).click();

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Agent connection/ }).click();
  await page.locator('.alpha-connection').getByRole('button', { name: 'Disconnect agent', exact: true }).click();
  await expect(page.locator('.alpha-connection').getByText(/access was revoked on the agent/)).toBeVisible();
  const paths = fixture.requests.map(item => item.path);
  expect(paths.indexOf('/api/client-devices/revoke')).toBeGreaterThan(-1);
  expect(paths.indexOf('/api/auth/logout')).toBeGreaterThan(paths.indexOf('/api/client-devices/revoke'));
  // The old bearer no longer works on the agent.
  expect(fixture.revoked).toBe(true);
  expect(foreign).toEqual([]);
});

test('the web build offers no Eliza Cloud sign-in that Cloud would refuse; the account page opens in a new tab', async ({ page, context }) => {
  // Pinned upstream Cloud CORS answers credentialed API routes (cli-session, user) only for Eliza's
  // own origins, so sign-in from this page cannot work. The account page is a plain new tab.
  const external: string[] = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    external.push(url.origin + url.pathname);
    if (url.origin === 'https://cloud.eliza.app' && url.pathname === '/cloud/agents') return route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<title>Synthetic Cloud account</title>' });
    return route.abort();
  });
  await page.goto('/');
  const chooser = page.locator('.alpha-connection');
  await chooser.getByText('Eliza Cloud', { exact: true }).click();
  await expect(chooser.getByRole('button', { name: 'Sign in with Eliza Cloud', exact: true })).toHaveCount(0);
  await expect(chooser.getByText(/Eliza Cloud sign-in is available in the Alpha Phone Android app/)).toBeVisible();
  const popup = context.waitForEvent('page');
  await chooser.getByRole('button', { name: 'Manage Cloud account', exact: true }).click();
  const tab = await popup;
  await tab.waitForURL('https://cloud.eliza.app/cloud/agents');
  expect(await tab.evaluate(() => window.opener)).toBeNull();
  expect(new URL(page.url()).origin).toMatch(/^http:\/\/127\.0\.0\.1/);
  // No Cloud API request is made from the web page.
  expect(external).toEqual(['https://cloud.eliza.app/cloud/agents']);
});
