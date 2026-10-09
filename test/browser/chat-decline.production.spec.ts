import { test, expect, type Page } from '@playwright/test';

// Flag-off product surfaces only: a saved remote-agent session over a synthetic Android IPC
// boundary. The agent, its proposal store and the action journal are in-page fixtures; no
// provider, account, credential or device effect is used.
const REMOTE = 'https://agent.example.test';
const AGENT = '6f1d3c3e-8c55-4c1b-9d1f-2b6f0b0d3a11';

async function remoteAgent(page: Page, seed: 'chat' | 'reconcile') {
  await page.addInitScript(({ remote, agentId, seed }) => {
    const w = window as any;
    w.androidBridge = {};
    const store = new Map<string, string>();
    const future = Date.now() + 86_400_000;
    store.set('remote:' + remote, JSON.stringify({ origin: remote, token: 'remote-session-token', identityId: 'fixture-owner', sessionId: 'remote-session-token', expiresAt: future }));
    try { if (!sessionStorage.getItem('decline-seeded')) { sessionStorage.setItem('decline-seeded', '1'); localStorage.setItem('alpha.connection.selection.v1', JSON.stringify({ kind: 'remote', origin: remote })); } } catch { /* covered elsewhere */ }
    const f = w.declineFixture = { posts: 0, decisions: [] as string[], reconciliations: [] as unknown[], effects: 0, journal: [] as string[], unexpected: [] as string[], proposals: [] as any[], installationId: '' };
    const proposal = (id: string, state: string, extra: Record<string, unknown> = {}) => ({
      id, digest: (id === 'fixture-reconcile' ? 'b' : 'a').repeat(64), state, expiresAt: new Date(future).toISOString(),
      subjectUserId: 'fixture-owner', requestedBy: agentId, action: 'device_action',
      payload: { action: 'device_action', version: 1, installationId: f.installationId, enrollmentId: 'fixture-enrollment', operation: { type: 'create_note', title: id === 'fixture-reconcile' ? 'Reconcile fixture note' : 'Declined fixture note', body: 'Synthetic fixture only' } },
      ...extra,
    });
    const methods = (names: string[]) => names.map(name => ({ name, rtype: 'promise' }));
    w.Capacitor = {
      PluginHeaders: [
        { name: 'AlphaConnection', methods: methods(['secureRead', 'secureWrite', 'secureCompareExchange', 'secureRemove', 'request', 'cancel', 'addListener', 'removeListener', 'pauseNotificationCollection']) },
        { name: 'AlphaActionJournal', methods: methods(['reserve', 'markApplying', 'finish', 'list', 'get']) },
        { name: 'AlphaNotifications', methods: methods(['status', 'crossAppStatus', 'addListener', 'removeListener']) },
        { name: 'AlphaVoiceCloud', methods: methods(['checkPermissions']) },
        { name: 'DeviceApps', methods: methods(['buildInfo']) },
      ],
      nativePromise: async (plugin: string, method: string, input: any) => {
        if (plugin === 'AlphaNotifications') return { permissionGranted: true, appEnabled: true };
        if (plugin === 'AlphaVoiceCloud') return { microphone: 'granted' };
        if (plugin === 'DeviceApps') return { launcher: false, version: 'decline-fixture' };
        if (plugin === 'AlphaActionJournal') {
          f.journal.push(method);
          if (method === 'list') return { entries: [] };
          if (method === 'get') return { entry: null };
          throw Error('Unexpected journal effect');
        }
        if (plugin !== 'AlphaConnection') { f.unexpected.push(plugin + '.' + method); throw Error('Unexpected native operation'); }
        if (method === 'secureRead') return { value: store.get(input.slot) ?? null };
        if (method === 'secureCompareExchange') { if ((store.get(input.slot) ?? null) !== input.expectedValue) return { status: 'conflict' }; if (input.value === null) store.delete(input.slot); else store.set(input.slot, input.value); return { status: 'saved' }; }
        if (method === 'secureWrite') { store.set(input.slot, input.value); return {}; }
        if (method === 'secureRemove') { store.delete(input.slot); return {}; }
        if (['cancel', 'addListener', 'removeListener', 'pauseNotificationCollection'].includes(method)) return {};
        if (method !== 'request') { f.unexpected.push(plugin + '.' + method); throw Error('Unexpected native operation'); }
        const url = new URL(input.url), ok = (data: unknown) => ({ status: 200, data });
        if (url.origin !== remote) return { status: 404, data: {} };
        if (input.headers?.Authorization !== 'Bearer remote-session-token') return { status: 401, data: {} };
        const body = typeof input.body === 'string' ? JSON.parse(input.body) : input.body ?? {};
        const path = url.pathname;
        if (path === '/api/auth/me') return ok({ identity: { kind: 'owner', id: 'fixture-owner', displayName: 'Owner' }, session: { kind: 'machine', id: 'remote-session-token', expiresAt: future }, access: { role: 'OWNER', mode: 'session' } });
        if (path === '/api/agents') return ok({ agents: [{ id: agentId, name: 'Decline fixture', status: 'running' }] });
        if (path === '/api/client-devices/register') {
          f.installationId = input.headers['X-Eliza-Device-Id'];
          if (seed === 'reconcile') f.proposals = [proposal('fixture-reconcile', 'reconciliation_required', { execution: { attemptId: 'fixture-attempt' } })];
          return ok({ installationId: f.installationId, enrollmentId: 'fixture-enrollment', capabilities: [] });
        }
        if (path === '/api/workflow/status') return ok({ status: 'unavailable' });
        if (path === '/api/conversations' && input.method === 'POST') return ok({ conversation: { id: 'fixture-chat', title: 'Alpha Phone' } });
        if (path === '/api/conversations' && input.method === 'GET') return ok({ conversations: [] });
        if (path === '/api/conversations/fixture-chat/messages' && input.method === 'POST') {
          f.posts++;
          if (seed === 'chat' && !f.proposals.length) f.proposals = [proposal('fixture-decline', 'pending')];
          return ok({ text: 'I can save that note after you review it.', agentName: 'Decline fixture' });
        }
        if (path === '/api/client-devices/proposals') return ok({ proposals: f.proposals });
        const match = /^\/api\/client-devices\/proposals\/([^/]+)\/(decision|reconciliation|claim|receipt)$/.exec(path);
        if (match) {
          const item = f.proposals.find(p => p.id === match[1]);
          if (!item || body.digest !== item.digest) return { status: 409, data: {} };
          if (match[2] === 'decision') {
            f.decisions.push(body.decision);
            if (body.decision !== 'reject' || item.state !== 'pending') return { status: 409, data: {} };
            item.state = 'rejected';
          } else if (match[2] === 'reconciliation') {
            f.reconciliations.push({ attemptId: body.attemptId, resolution: body.resolution });
            if (item.state !== 'reconciliation_required' || body.attemptId !== 'fixture-attempt') return { status: 409, data: {} };
            item.state = body.resolution?.outcome === 'not_applied' ? 'not_applied' : 'succeeded';
          } else { f.effects++; return { status: 409, data: {} }; }
          return ok({ proposal: item, digest: item.digest });
        }
        f.unexpected.push(input.method + ' ' + path);
        return { status: 404, data: {} };
      },
    };
  }, { remote: REMOTE, agentId: AGENT, seed });
}
const fixture = (page: Page) => page.evaluate(() => {
  const f = (window as any).declineFixture;
  return { posts: f.posts, decisions: f.decisions, reconciliations: f.reconciliations, effects: f.effects, journal: f.journal, states: f.proposals.map((p: any) => [p.id, p.state]), unexpected: f.unexpected };
});
async function connected(page: Page) {
  await page.goto('/');
  await expect(page.locator('.alpha-connection-scrim')).toHaveCount(0, { timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => (window as any).declineFixture.installationId)).not.toBe('');
}

test('a proposal is declined from its chat card and the agent records the rejection', async ({ page }) => {
  await remoteAgent(page, 'chat');
  await connected(page);
  const input = page.getByRole('textbox', { name: 'Ask Alpha', exact: true });
  await input.fill('Save a note for me');
  await input.press('Enter');
  await expect(page.getByText('Approve: Create note', { exact: true })).toBeVisible();
  const decline = page.getByRole('button', { name: /^Decline Reject this proposal/ });
  await expect(decline).toBeVisible();
  await decline.click();
  await expect(page.getByText('Declined', { exact: true })).toBeVisible();
  await expect(page.getByText('Declined. No phone action was performed.', { exact: true })).toBeVisible();
  await expect(page.locator('.alpha-connection-scrim')).toHaveCount(0);
  // Server state reads back as rejected; nothing was claimed, journaled or executed.
  const state = await fixture(page);
  expect(state.states).toEqual([['fixture-decline', 'rejected']]);
  expect(state.decisions).toEqual(['reject']);
  expect(state.effects).toBe(0);
  expect(state.journal.filter((m: string) => ['reserve', 'markApplying', 'finish'].includes(m))).toEqual([]);
  expect(state.posts).toBe(1);
  // The declined card has no approval or decline action left.
  await expect(page.getByRole('button', { name: /^Decline Reject this proposal/ })).toHaveCount(0);
  await expect(page.getByText('Approve: Create note', { exact: true })).toHaveCount(0);
});

test('Activity reconciles a reconciliation-required entry as not applied', async ({ page }) => {
  await remoteAgent(page, 'reconcile');
  await connected(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByText('Privacy & data', { exact: true }).click();
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  const app = page.locator('[data-alpha-layer="app"]');
  await app.getByRole('button', { name: 'Load phone action history', exact: true }).click();
  // The explicit read reports progress in the connection panel; close it once the read finished.
  await expect(page.locator('.alpha-connection').getByText(/Review local effects before resolving/)).toBeVisible();
  await page.getByRole('button', { name: 'Close connection settings' }).first().click();
  await expect(app.getByText('Needs your review', { exact: true })).toBeVisible();
  await expect(app.getByRole('button', { name: 'It happened', exact: true })).toBeVisible();
  await app.getByRole('button', { name: 'It did not happen', exact: true }).click();
  await expect.poll(async () => (await fixture(page)).states).toEqual([['fixture-reconcile', 'not_applied']]);
  const state = await fixture(page);
  expect(state.reconciliations).toEqual([{ attemptId: 'fixture-attempt', resolution: { confirmed: true, outcome: 'not_applied' } }]);
  expect(state.effects).toBe(0);
  expect(state.decisions).toEqual([]);
  expect(state.journal.filter((m: string) => ['reserve', 'markApplying', 'finish'].includes(m))).toEqual([]);
});
