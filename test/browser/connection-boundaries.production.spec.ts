import { test, expect, type Page, type Route } from '@playwright/test';
// Flag-off production bundle only. Android cases stub the Capacitor bridge in a desktop browser and
// remote cases are fulfilled by Playwright at https://agent.example.test. Nothing here contacts
// Eliza Cloud, a deployed agent, an Android device or the native AlphaConnection plugin; those
// stay real-service and device acceptance.

const SELECTION = 'alpha.connection.selection.v1', CLOUD_SERVICE = 'alpha.connection.cloud-service.v1';
const origin = 'https://agent.example.test';
const owner = '0f1b6c2e-8f43-4c8a-9a52-5b7e0e1a1f11', agent = '7d4e0c1a-2b3c-4d5e-8f60-718293a4b5c6';
const token = 'synthetic-machine-session';

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'production', 'Production bundle only'); });

/** Aborts and records every request that leaves the preview server. */
async function fenceNetwork(page: Page, serve?: (route: Route) => Promise<unknown> | unknown) {
  const foreign: string[] = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (serve && url.origin === origin) return serve(route);
    foreign.push(`${route.request().method()} ${url.origin}${url.pathname}`); return route.abort();
  });
  return foreign;
}

interface NativeCall { plugin: string; method: string; slot?: string; url?: string; http?: string; authorization?: string; path?: string }
interface AndroidOptions { selection?: unknown; remoteCredential?: boolean; cloudCredential?: boolean; balance?: number; revoke?: 'revoked' | 'unsupported' | 'failed'; packaged?: boolean }
/** Production Android as the renderer sees it: resident Agent plugin plus AlphaConnection storage and transport. */
async function android(page: Page, options: AndroidOptions) {
  await page.addInitScript(({ options, SELECTION, origin, owner, token }) => {
    const w = window as any; w.androidBridge = {}; w.nativeCalls = [];
    const id = '9f1dc45a-4011-4e44-947a-30d999d24fa5';
    // Secure slots survive reload like Keystore-backed storage; the selection is seeded once.
    const values: Record<string, string> = JSON.parse(sessionStorage.getItem('secure-fixture') || 'null') ?? {
      ...(options.remoteCredential ? { [`remote:${origin}`]: JSON.stringify({ origin, token, identityId: owner, sessionId: token, expiresAt: Date.now() + 3_600_000 }) } : {}),
      ...(options.cloudCredential ? { 'cloud:production': JSON.stringify({ token: 'synthetic-cloud-key', credentialId: id }) } : {}),
    };
    const persist = () => sessionStorage.setItem('secure-fixture', JSON.stringify(values));
    if (!sessionStorage.getItem('secure-fixture')) { persist(); if (options.selection) localStorage.setItem(SELECTION, JSON.stringify(options.selection)); }
    w.secureValues = () => ({ ...values });
    const methods = (names: string[]) => names.map(name => ({ name, rtype: 'promise' }));
    w.Capacitor = { PluginHeaders: [
      { name: 'DeviceApps', methods: methods(['buildInfo']) },
      { name: 'Agent', methods: methods(['getStatus', 'start', 'stop', 'configureCloudProvider', 'request']) },
      { name: 'AlphaConnection', methods: methods(['secureRead', 'secureWrite', 'secureRemove', 'secureCompareExchange', 'request', 'cancel', 'openExternal']) },
      { name: 'AlphaNotifications', methods: methods(['status', 'crossAppStatus', 'addListener', 'removeListener']) },
      { name: 'AlphaVoiceCloud', methods: methods(['checkPermissions']) },
    ], nativePromise: async (plugin: string, method: string, input: any) => {
      w.nativeCalls.push({ plugin, method, slot: input?.slot, url: input?.url, http: input?.method, authorization: input?.headers?.Authorization, path: input?.path });
      if (plugin === 'DeviceApps') return { launcher: false, version: 'connection-boundaries' };
      if (plugin === 'AlphaNotifications') return { permissionGranted: true, appEnabled: true };
      if (plugin === 'AlphaVoiceCloud') return { microphone: 'granted' };
      if (plugin === 'Agent') {
        if (method === 'getStatus') return { packaged: options.packaged !== false, state: 'stopped', serviceActive: false, socketListening: false };
        if (method === 'request') {
          const body = input.path === '/api/auth/me' ? { identity: { id, kind: 'owner' }, access: { role: 'OWNER', mode: 'local' } }
            : input.path === '/api/agents' ? { agents: [{ id, name: 'Alpha', status: 'running' }] }
            : input.path === '/api/conversations' ? { conversations: [] } : {};
          return { status: 200, body: JSON.stringify(body) };
        }
        return {};
      }
      if (method === 'secureRead') return { value: values[input.slot] ?? null };
      if (method === 'secureWrite') { values[input.slot] = input.value; persist(); return {}; }
      if (method === 'secureRemove') { delete values[input.slot]; persist(); return {}; }
      if (method === 'secureCompareExchange') { if ((values[input.slot] ?? null) !== input.expectedValue) return { status: 'conflict' }; if (input.value === null) delete values[input.slot]; else values[input.slot] = input.value; persist(); return { status: 'saved' }; }
      if (method === 'request') {
        const url = new URL(input.url);
        // Only the fixed Cloud authority answers; any other host is a transport failure.
        if (url.origin !== 'https://api.eliza.app') throw Error('Connection request failed');
        if (url.pathname === '/api/v1/user') return { status: 200, data: { success: true, data: { id } } };
        if (url.pathname === '/api/v1/credits/balance') return { status: 200, data: { balance: options.balance ?? 0 } };
        if (url.pathname === '/api/v1/api-keys/current' && input.method === 'DELETE') {
          if (options.revoke === 'failed') throw Error('Connection request failed');
          return options.revoke === 'revoked' ? { status: 200, data: { success: true, status: 'revoked', credentialId: id, revokedAt: new Date().toISOString() } } : { status: 405, data: {} };
        }
        throw Error('Unexpected Cloud route: ' + url.pathname);
      }
      return {};
    } };
  }, { options, SELECTION, origin, owner, token });
}
const nativeCalls = (page: Page) => page.evaluate(() => (window as any).nativeCalls as NativeCall[]);
const secureValues = (page: Page) => page.evaluate(() => (window as any).secureValues() as Record<string, string>);
const remoteSlot = `remote:${origin}`;
/** No pairing, restore or credential mutation reached the saved remote agent. */
function expectRemoteUntouched(calls: NativeCall[]) {
  expect(calls.filter(call => call.url?.startsWith(origin) || call.url?.includes('/api/auth/pair'))).toEqual([]);
  expect(calls.filter(call => call.slot?.startsWith('remote:') && call.method !== 'secureRead')).toEqual([]);
}

for (const legacy of [{ name: 'remote agent', selection: { kind: 'remote', origin } }, { name: 'local development agent', selection: { kind: 'local', origin } }, { name: 'Cloud agent', selection: { kind: 'cloud', environment: 'production', agentId: agent, ownerId: owner } }]) {
  test(`production Android never pairs or restores a saved ${legacy.name} and keeps its credential`, async ({ page }) => {
    const foreign = await fenceNetwork(page);
    await android(page, { selection: legacy.selection, remoteCredential: true });
    await page.goto('/');
    const welcome = page.getByRole('dialog', { name: 'Welcome to Alpha' });
    await expect(welcome).toBeVisible();
    // The retired route has no entry: no address, code or connect control, and no fake connected state.
    await expect(welcome.getByLabel('Agent HTTPS address')).toHaveCount(0);
    await expect(welcome.getByLabel('Pairing code')).toHaveCount(0);
    await expect(welcome.getByRole('button', { name: /Connect (remote|local) agent/ })).toHaveCount(0);
    await expect(welcome.getByText(/Remote agent|Connected ·/)).toHaveCount(0);
    const saved = await secureValues(page);
    await welcome.getByRole('button', { name: 'Use local apps without AI', exact: true }).click();
    await expect(welcome).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Notes', exact: true })).toBeVisible();
    expectRemoteUntouched(await nativeCalls(page));
    expect((await secureValues(page))[remoteSlot]).toBe(saved[remoteSlot]);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Notes', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const calls = await nativeCalls(page);
    expectRemoteUntouched(calls);
    // Signed out and offline: no transport request of any kind and the resident agent is not started.
    expect(calls.filter(call => call.plugin === 'AlphaConnection' && call.method === 'request')).toEqual([]);
    expect(calls.filter(call => call.plugin === 'Agent').map(call => call.method)).not.toContain('start');
    expect((await secureValues(page))[remoteSlot]).toBe(saved[remoteSlot]);
    expect(foreign).toEqual([]);
  });
}

test('production Android with a Cloud sign-in starts the resident agent instead of a saved remote agent', async ({ page }) => {
  const foreign = await fenceNetwork(page);
  await android(page, { selection: { kind: 'remote', origin }, remoteCredential: true, cloudCredential: true, balance: 5 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Notes', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const calls = await nativeCalls(page);
  expectRemoteUntouched(calls);
  const agentCalls = calls.filter(call => call.plugin === 'Agent').map(call => call.method);
  expect(agentCalls).toContain('configureCloudProvider');
  // Cloud authorizes the provider (identity, credits) and account services; it is never the agent runtime.
  const routes = [...new Set(calls.filter(call => call.plugin === 'AlphaConnection' && call.method === 'request').map(call => new URL(call.url!).origin + new URL(call.url!).pathname))];
  expect(routes).toEqual(expect.arrayContaining(['https://api.eliza.app/api/v1/credits/balance', 'https://api.eliza.app/api/v1/user']));
  expect(routes.filter(route => !route.startsWith('https://api.eliza.app/api/v1/') || /\/(agents|personal|conversations|messages)(\/|$)/.test(route))).toEqual([]);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SELECTION)).toEqual({ kind: 'resident' });
  expect((await secureValues(page))[remoteSlot]).toContain(token);
  expect(foreign).toEqual([]);
});

test('production Android without a packaged agent says so and does not advertise retired routes', async ({ page }) => {
  await fenceNetwork(page);
  await android(page, { cloudCredential: true, balance: 5, packaged: false });
  await page.goto('/');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('The on-device runtime is unavailable in this build.');
  await expect(alert).not.toContainText(/remote agent|pair/i);
  await expect(page.getByRole('button', { name: 'Use local apps without AI', exact: true })).toBeVisible();
  expect((await nativeCalls(page)).filter(call => call.plugin === 'Agent').map(call => call.method)).not.toContain('start');
});

for (const mode of ['revoked', 'unsupported', 'failed'] as const) {
  test(`production Android Cloud sign-out states only the revocation that happened: ${mode}`, async ({ page }) => {
    const foreign = await fenceNetwork(page);
    // Zero credits keeps the account panel open with its Sign out control.
    await android(page, { cloudCredential: true, balance: 0, revoke: mode });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Add credits in Eliza Cloud', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    const status = page.getByRole('status');
    if (mode === 'revoked') await expect(status).toContainText('Signed out of Eliza Cloud. This sign-in was revoked.');
    else {
      await expect(status).toContainText('The sign-in token was removed here; Eliza Cloud did not confirm revoking it.');
      await expect(page.getByText(/was revoked/)).toHaveCount(0);
    }
    const calls = await nativeCalls(page);
    const revocations = calls.filter(call => call.http === 'DELETE');
    // One attempt, to the fixed self-revocation route, presenting only the key being revoked.
    expect(revocations.map(call => [call.url, call.authorization])).toEqual([['https://api.eliza.app/api/v1/api-keys/current', 'Bearer synthetic-cloud-key']]);
    // The resident process is stopped before its key is revoked, and the local key is always removed.
    const stop = calls.findIndex(call => call.plugin === 'Agent' && call.method === 'stop');
    expect(stop).toBeGreaterThan(-1);
    expect(stop).toBeLessThan(calls.indexOf(revocations[0]));
    expect(await secureValues(page)).not.toHaveProperty('cloud:production');
    await expect(page.getByRole('button', { name: 'Sign in with Eliza Cloud', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Welcome to Alpha' })).toBeVisible();
    expect((await nativeCalls(page)).filter(call => call.plugin === 'AlphaConnection' && call.method === 'request')).toEqual([]);
    expect(foreign).toEqual([]);
  });
}

const legacyWeb: Array<{ name: string; selection?: unknown; service?: string; alert?: RegExp; status?: RegExp }> = [
  { name: 'mock selection', selection: { kind: 'mock' }, status: /connects to real agents only/ },
  { name: 'Cloud staging service', selection: { kind: 'none' }, service: 'staging' },
  { name: 'Cloud staging agent', selection: { kind: 'cloud', environment: 'staging', agentId: agent, ownerId: owner }, service: 'staging' },
  { name: 'Cloud production agent', selection: { kind: 'cloud', environment: 'production', agentId: agent, ownerId: owner }, service: 'production', alert: /Eliza Cloud does not accept sign-in requests from this web page/ },
  { name: 'Cloud production service', selection: { kind: 'none' }, service: 'production' },
  { name: 'plain-HTTP local agent', selection: { kind: 'local', origin: 'http://127.0.0.1:9' } },
  { name: 'development profile', selection: { kind: 'development', profile: 'local' } },
  { name: 'on-device agent', selection: { kind: 'resident' }, alert: /The local agent is unavailable here\. Connect a remote agent or continue offline\./ },
];
for (const legacy of legacyWeb) {
  test(`the web build opens the chooser signed out for a saved ${legacy.name}`, async ({ page }) => {
    const foreign = await fenceNetwork(page);
    await page.addInitScript(({ legacy, SELECTION, CLOUD_SERVICE }) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      if (legacy.selection) localStorage.setItem(SELECTION, JSON.stringify(legacy.selection));
      if (legacy.service) localStorage.setItem(CLOUD_SERVICE, legacy.service);
    }, { legacy, SELECTION, CLOUD_SERVICE });
    await page.goto('/');
    const chooser = page.locator('.alpha-connection');
    await expect(chooser.getByText('On-device agent unavailable here', { exact: true })).toBeVisible();
    await expect(chooser.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
    if (legacy.alert) await expect(chooser.getByRole('alert')).toContainText(legacy.alert);
    if (legacy.status) await expect(chooser.getByRole('status')).toContainText(legacy.status);
    // Nothing is connected, no sign-in is offered or implied and no mock or development surface opens.
    await expect(chooser.getByText(/Connected ·/)).toHaveCount(0);
    await expect(chooser.getByRole('button', { name: 'Disconnect agent', exact: true })).toHaveCount(0);
    await expect(chooser.getByText(/Sign in again|Sign in with Eliza Cloud to continue|sign in with Eliza Cloud,/i)).toHaveCount(0);
    await expect(chooser.getByText('Development connections', { exact: true })).toHaveCount(0);
    await expect(page.locator('.mock-mode-banner')).toHaveCount(0);
    expect(new URL(page.url()).search).toBe('');
    expect(await page.evaluate(key => localStorage.getItem(key), CLOUD_SERVICE)).toBeNull();
    await chooser.getByRole('button', { name: 'Continue offline', exact: true }).click();
    await expect(chooser).toHaveCount(0);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SELECTION)).toEqual({ kind: 'offline' });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Notes', exact: true })).toBeVisible();
    await expect(chooser).toHaveCount(0);
    expect(foreign).toEqual([]);
  });
}

type RemoteMode = 'ok' | 'wrong-role' | 'identity-mismatch' | 'expired-session' | 'used-code' | 'pairing-disabled' | 'instance-mismatch' | 'enrollment-refused' | 'revoke-refused';
interface RemoteFixture { mode: RemoteMode; requests: Array<{ method: string; path: string; authorization?: string }>; loggedOut: boolean }
function serveRemote(page: Page, fixture: RemoteFixture) {
  return (route: Route) => {
    const request = route.request(), url = new URL(request.url()), mode = fixture.mode;
    const cors = { 'access-control-allow-origin': new URL(page.url()).origin, 'access-control-allow-headers': 'accept,content-type,authorization,x-eliza-device-id,x-eliza-device-key,x-eliza-device-capabilities', 'access-control-allow-methods': 'GET,POST' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const authorization = request.headers()['authorization'];
    fixture.requests.push({ method: request.method(), path: url.pathname, authorization });
    const json = (status: number, value: unknown) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(value) });
    const body = request.postData() ? JSON.parse(request.postData()!) : undefined;
    if (url.pathname === '/api/auth/status') return json(200, { required: true, authenticated: false, pairingEnabled: mode !== 'pairing-disabled', instanceId: 'synthetic-instance', bootstrapRequired: false, expiresAt: null });
    if (url.pathname === '/api/auth/pair') return mode === 'used-code' || body?.code !== 'SYNTH-CODE' ? json(403, {}) : json(200, { token, identityId: owner, instanceId: mode === 'instance-mismatch' ? 'another-instance' : 'synthetic-instance', access: 'owner' });
    if (authorization !== `Bearer ${token}` || fixture.loggedOut) return json(401, {});
    if (url.pathname === '/api/auth/me') return json(200, {
      identity: { id: mode === 'identity-mismatch' ? agent : owner, kind: mode === 'wrong-role' ? 'member' : 'owner', displayName: 'Synthetic owner' },
      session: { id: token, kind: 'machine', expiresAt: mode === 'expired-session' ? Date.now() - 1000 : Date.now() + 3_600_000 },
      access: { role: mode === 'wrong-role' ? 'MEMBER' : 'OWNER', mode: 'session' } });
    if (url.pathname === '/api/agents') return json(200, { agents: [{ id: agent, name: 'Synthetic remote', status: 'running' }] });
    if (url.pathname === '/api/client-devices/register') return json(200, { installationId: mode === 'enrollment-refused' ? 'not-this-phone' : request.headers()['x-eliza-device-id'], enrollmentId: 'synthetic-enrollment', capabilities: ['notes.query.v1', 'reminders.create.v1'] });
    if (url.pathname === '/api/client-devices/revoke' || url.pathname === '/api/auth/logout') return mode === 'revoke-refused' ? json(500, {}) : json(200, { ok: true });
    if (url.pathname === '/api/client-devices/proposals') return json(200, { proposals: [] });
    if (url.pathname === '/api/conversations') return json(200, { conversations: [] });
    return json(404, {});
  };
}
async function pair(page: Page, address: string, code: string) {
  const chooser = page.locator('.alpha-connection');
  await expect(chooser.getByText('On-device agent unavailable here', { exact: true })).toBeVisible();
  await chooser.getByText('Remote agent', { exact: true }).click();
  await chooser.getByLabel('Agent HTTPS address').fill(address);
  await chooser.getByLabel('Pairing code').fill(code);
  await chooser.getByRole('button', { name: 'Connect remote agent', exact: true }).click();
  return chooser;
}
const webStorage = (page: Page) => page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));

const refusals: Array<{ mode: RemoteMode; alert: RegExp; paired: boolean }> = [
  { mode: 'wrong-role', alert: /did not confirm an owner session for this phone\. Nothing was connected\./, paired: true },
  { mode: 'identity-mismatch', alert: /did not confirm an owner session for this phone\. Nothing was connected\./, paired: true },
  { mode: 'expired-session', alert: /saved session for this agent has expired/, paired: true },
  { mode: 'instance-mismatch', alert: /did not confirm an owner session for this phone\. Nothing was connected\./, paired: true },
  { mode: 'used-code', alert: /refused this pairing code\. Codes expire and work once/, paired: true },
  { mode: 'pairing-disabled', alert: /not accepting pairing/, paired: false },
];
for (const refusal of refusals) {
  test(`the web build stays disconnected when the remote agent pairing fails: ${refusal.mode}`, async ({ page }) => {
    const fixture: RemoteFixture = { mode: refusal.mode, requests: [], loggedOut: false };
    const foreign = await fenceNetwork(page, serveRemote(page, fixture));
    await page.goto('/');
    const chooser = await pair(page, origin, 'SYNTH-CODE');
    await expect(chooser.getByRole('alert')).toContainText(refusal.alert);
    // No connected state, no owner-scoped route and no device enrollment follows a refused pairing.
    await expect(chooser.getByText(/Connected ·/)).toHaveCount(0);
    await expect(chooser.getByRole('button', { name: 'Disconnect agent', exact: true })).toHaveCount(0);
    const paths = fixture.requests.map(item => item.path);
    expect(paths.includes('/api/auth/pair')).toBe(refusal.paired);
    for (const path of ['/api/agents', '/api/client-devices/register', '/api/client-devices/proposals', '/api/conversations']) expect(paths).not.toContain(path);
    expect(await webStorage(page)).not.toContain(token);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).kind, SELECTION)).not.toBe('remote');
    // Nothing was saved to restore: a restart makes no authenticated request and reconnects nothing.
    const before = fixture.requests.length;
    await page.reload();
    await expect(page.locator('.alpha-connection').getByText('On-device agent unavailable here', { exact: true })).toBeVisible();
    await expect(page.locator('.alpha-connection').getByText(/Connected ·/)).toHaveCount(0);
    expect(fixture.requests.slice(before).filter(item => item.authorization)).toEqual([]);
    expect(foreign).toEqual([]);
  });
}

for (const address of ['http://agent.example.test', 'http://127.0.0.1:9', 'https://agent.example.test/api']) {
  test(`the web build sends nothing to a remote address it cannot use: ${address}`, async ({ page }) => {
    const fixture: RemoteFixture = { mode: 'ok', requests: [], loggedOut: false };
    const foreign = await fenceNetwork(page, serveRemote(page, fixture));
    const local: string[] = [];
    page.on('request', request => { const url = new URL(request.url()); if (url.port === '9') local.push(request.url()); });
    await page.goto('/');
    const chooser = await pair(page, address, 'SYNTH-CODE');
    await expect(chooser.getByRole('alert')).toContainText('Enter the agent’s HTTPS address without a path');
    await expect(chooser.getByText(/Connected ·/)).toHaveCount(0);
    expect(fixture.requests).toEqual([]);
    expect(local).toEqual([]);
    expect(foreign).toEqual([]);
  });
}

test('the web build keeps chat but no phone actions when device enrollment is not verified', async ({ page }) => {
  const fixture: RemoteFixture = { mode: 'enrollment-refused', requests: [], loggedOut: false };
  const foreign = await fenceNetwork(page, serveRemote(page, fixture));
  await page.goto('/');
  await pair(page, origin, 'SYNTH-CODE');
  await expect(page.locator('.alpha-connection-scrim')).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Agent connection/ }).click();
  const chooser = page.locator('.alpha-connection');
  await expect(chooser.getByText('Connected · Remote agent', { exact: true })).toBeVisible();
  await expect(chooser.getByText('Chat connected. Phone action enrollment was not confirmed. Reconnect to review its status.', { exact: true })).toBeVisible();
  // The agent advertised capabilities, but an unverified enrollment grants no device-action surface.
  await expect(chooser.getByText('Phone action history', { exact: true })).toHaveCount(0);
  expect(fixture.requests.map(item => item.path)).not.toContain('/api/client-devices/proposals');
  expect(foreign).toEqual([]);
});

test('the web build does not claim revocation the remote agent did not confirm', async ({ page }) => {
  const fixture: RemoteFixture = { mode: 'ok', requests: [], loggedOut: false };
  const foreign = await fenceNetwork(page, serveRemote(page, fixture));
  await page.goto('/');
  await pair(page, origin, 'SYNTH-CODE');
  await expect(page.locator('.alpha-connection-scrim')).toHaveCount(0);
  fixture.mode = 'revoke-refused';
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Agent connection/ }).click();
  const chooser = page.locator('.alpha-connection');
  await chooser.getByRole('button', { name: 'Disconnect agent', exact: true }).click();
  await expect(chooser.getByText('Agent disconnected on this phone, but the agent did not confirm revocation. Remove this phone from the agent’s paired devices.')).toBeVisible();
  await expect(chooser.getByText(/access was revoked on the agent/)).toHaveCount(0);
  // Both revocations were attempted once each; the local credential is gone either way.
  const paths = fixture.requests.map(item => item.path);
  expect(paths.filter(path => path === '/api/client-devices/revoke')).toHaveLength(1);
  expect(paths.filter(path => path === '/api/auth/logout')).toHaveLength(1);
  const before = fixture.requests.length;
  await page.reload();
  await expect(page.locator('.alpha-connection').getByText('On-device agent unavailable here', { exact: true })).toBeVisible();
  await expect(page.locator('.alpha-connection').getByText(/Connected ·/)).toHaveCount(0);
  expect(fixture.requests.slice(before).filter(item => item.authorization)).toEqual([]);
  expect(await webStorage(page)).not.toContain(token);
  expect(foreign).toEqual([]);
});

test('the web build drops a remote session the agent no longer accepts and does not reconnect it', async ({ page }) => {
  const fixture: RemoteFixture = { mode: 'ok', requests: [], loggedOut: false };
  const foreign = await fenceNetwork(page, serveRemote(page, fixture));
  await page.goto('/');
  await pair(page, origin, 'SYNTH-CODE');
  await expect(page.locator('.alpha-connection-scrim')).toHaveCount(0);
  // The owner revokes this phone on the agent while the page is closed.
  fixture.loggedOut = true;
  await page.reload();
  const chooser = page.locator('.alpha-connection');
  await expect(chooser.getByRole('alert')).toContainText('Your session has expired. Sign in or pair again.');
  await expect(chooser.getByText(/Connected ·/)).toHaveCount(0);
  // The refused credential was removed: the next start sends no bearer and asks for a pairing code.
  const before = fixture.requests.length;
  await page.reload();
  await expect(chooser.getByRole('alert')).toContainText('Enter the pairing code displayed by your agent.');
  expect(fixture.requests.slice(before).filter(item => item.authorization)).toEqual([]);
  expect(foreign).toEqual([]);
});
