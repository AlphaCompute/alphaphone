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

interface AgentFixture { requests: Array<{ method: string; path: string; authorization?: string; body?: any }>; revoked: boolean }

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
  if (url.pathname === '/api/conversations') return request.method() === 'POST' ? json(200, { conversation: { id: conversation, title: 'Alpha Phone' } }) : json(200, { conversations: [] });
  if (url.pathname === `/api/conversations/${conversation}/messages` && request.method() === 'POST') return json(200, { text: 'Synthetic remote reply', agentName: 'Synthetic remote' });
  return json(404, {});
}

test('the web build pairs a synthetic HTTPS remote agent, sends one message and revokes on disconnect', async ({ page }) => {
  const fixture: AgentFixture = { requests: [], revoked: false };
  const foreign: string[] = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return serveAgent(route, fixture, page);
    if (url.hostname === '127.0.0.1') return route.continue();
    foreign.push(url.href); return route.abort();
  });
  await page.goto('/');
  const chooser = page.locator('.alpha-connection');
  await expect(chooser.getByText('This browser has no on-device agent', { exact: true })).toBeVisible();
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

  // Reload restores the paired session from the browser secret store without re-pairing.
  await page.reload();
  await expect(page.locator('.alpha-connection-scrim')).toHaveCount(0);
  expect(fixture.requests.filter(item => item.path === '/api/auth/pair')).toHaveLength(1);

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

test('web Eliza Cloud sign-in opens the sign-in page in a new tab and keeps this page polling', async ({ page, context }) => {
  // Synthetic Cloud authority: a pending CLI session that is never approved. Real Cloud CORS is unverified.
  const session = '5b0c8f9e-1d2a-4b3c-8d4e-5f6a7b8c9d0e';
  const polls: string[] = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'accept,content-type,authorization', 'content-type': 'application/json' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.origin === 'https://api.eliza.app' && url.pathname === '/api/auth/cli-session') return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ sessionId: session, expiresAt: new Date(Date.now() + 600_000).toISOString() }) });
    if (url.origin === 'https://api.eliza.app' && url.pathname === `/api/auth/cli-session/${session}`) { polls.push(url.pathname); return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ status: 'pending' }) }); }
    if (url.origin === 'https://eliza.app') return route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<title>Synthetic sign-in</title>' });
    return route.abort();
  });
  await page.goto('/');
  const chooser = page.locator('.alpha-connection');
  await chooser.getByText('Eliza Cloud', { exact: true }).click();
  const popup = context.waitForEvent('page');
  await chooser.getByRole('button', { name: 'Sign in with Eliza Cloud', exact: true }).click();
  const tab = await popup;
  await tab.waitForURL(/cli-login/);
  expect(new URL(tab.url()).href).toBe(`https://eliza.app/auth/cli-login?session=${session}`);
  expect(await tab.evaluate(() => window.opener)).toBeNull();
  await expect.poll(() => polls.length).toBeGreaterThan(0);
  expect(new URL(page.url()).origin).toMatch(/^http:\/\/127\.0\.0\.1/);
  await chooser.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(chooser.getByRole('button', { name: 'Sign in with Eliza Cloud', exact: true })).toBeEnabled();
});
