// First run on the flag-off Android renderer under decision P-43 (resident agent always present):
// no Cloud key is saved, the resident starts by itself with AI off, and no Welcome gate opens. The
// owner opens Settings › Agent connection ("Your agent") and presses "Sign in with Eliza Cloud";
// the interactive CLI-session sign-in binds inference and the resident restarts and answers. Then
// the branches that keep no key: each leaves the resident running without AI, never "no agent".
//
// Path under test: connectionController.residentCloudLogin -> CloudProtocol.login (POST
// /api/auth/cli-session, AlphaConnection.openExternal, polling /api/auth/cli-session/:id) -> the
// cloud:production slot -> admitCloudResident (identity, credits, configureCloudProvider) ->
// connectResident (Agent.start).
//
// Evidence boundary: source/test evidence for the flag-off renderer only. The bridge stub is not
// the native plugins, the browser hand-off, Eliza Cloud, the resident runtime or a device.
import { test, expect, type Page } from '@playwright/test';
import { flagOffAndroid, harness, button, fenceNetwork, expectNoDevelopmentSurface, openYourAgent } from './flag-off-android';
import { residentStub, stub, setStub, type StubAccount } from './resident-stub';

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'production', 'Production bundle only'); });

const id = '9f1dc45a-4011-4e44-947a-30d999d24fa5';
const account: StubAccount = { token: 'first-run-key', userId: id, email: 'new-owner@example.invalid', balance: 5 };
const WAITING = 'Finish signing in to Eliza Cloud in your browser, then return here.';
const starts = (page: Page) => stub(page, s => s.order.filter((entry: string) => entry === 'Agent.start').length) as Promise<number>;

async function firstRun(page: Page, overrides: Partial<StubAccount> = {}) {
  const foreign = await fenceNetwork(page);
  await flagOffAndroid(page,{freshAccess:true});
  await residentStub(page, { emptyKeystore: true, accounts: [{ ...account, ...overrides }] });
  // Only this fresh-install fixture owns permission prompts. Each explicit Allow changes the
  // synthetic native status; the product must read it back before advancing. No UI completion seed.
  await page.addInitScript(() => {
    const w=window as any, previous=w.Capacitor.nativePromise;
    const state:Record<string,boolean>={notifications:false,microphone:false,camera:false,location:false,calendar:false,photos:false};
    w.firstRunAccess={requests:[] as string[]};
    const ports:Record<string,string[]>={DailyApps:['checkPermissions','requestPermissions'],AlphaVoiceCloud:['checkPermissions','requestPermissions'],ElizaLocation:['checkPermissions','requestPermissions'],AlphaCalendar:['checkPermissions','requestAccess'],AlphaPhotoLibrary:['scope','requestAccess']};
    for(const [name,methods] of Object.entries(ports)) {
      let header=w.Capacitor.PluginHeaders.find((row:any)=>row.name===name);
      if(!header)w.Capacitor.PluginHeaders.push(header={name,methods:[]});
      for(const method of methods)if(!header.methods.some((row:any)=>row.name===method))header.methods.push({name:method,rtype:'promise'});
    }
    w.Capacitor.nativePromise=async(plugin:string,method:string,input:any)=>{
      const key=plugin==='AlphaNotifications'?'notifications':plugin==='AlphaVoiceCloud'?'microphone':plugin==='DailyApps'?'camera':plugin==='ElizaLocation'?'location':plugin==='AlphaCalendar'?'calendar':plugin==='AlphaPhotoLibrary'?'photos':null;
      if(key && (method==='requestPermissions'||method==='requestAccess')){
        const requested=plugin==='DailyApps'?input.permissions[0]:key;
        if(!(requested in state))throw Error('Unexpected startup permission');
        w.firstRunAccess.requests.push(requested);state[requested]=true;return {};
      }
      if(plugin==='AlphaNotifications'&&method==='status')return {permissionGranted:state.notifications,appEnabled:state.notifications};
      if(plugin==='AlphaPhotoLibrary'&&method==='scope')return {scope:state.photos?'selected':'denied',locked:false};
      if(key&&method==='checkPermissions')return key==='location'?{location:state.location?'granted':'prompt',accuracy:state.location?'approximate':'none'}:{[key]:state[key]?'granted':'prompt'};
      return previous(plugin,method,input);
    };
  });
  await page.goto('/');
  await setStub(page, { nextToken: account.token });
  // P-43: the resident starts by itself, signed out. Every Alpha Phone needs an Eliza Cloud account,
  // so the sign-in dialog opens by itself and cannot be dismissed while the agent runs.
  await expect.poll(() => starts(page), { timeout: 30_000 }).toBe(1);
  const welcome = page.getByRole('main', { name: 'Sign in', exact: true });
  await expect(welcome).toBeVisible();
  await expect(welcome.getByRole('button', { name: 'Close connection settings', exact: true })).toHaveCount(0);
  expect(await harness(page, f => f.slots['cloud:production'] ?? null)).toBeNull();
  expect(await stub(page, s => s.order.some((entry: string) => entry.startsWith('configureCloudProvider')))).toBe(false);
  await expect(welcome.getByText('Sign in to Eliza Cloud to use Alpha Phone.', { exact: true })).toBeVisible();
  await expect(welcome.getByRole('button', { name: 'Use local apps without AI', exact: true })).toHaveCount(0);
  await expect(welcome.getByRole('button',{name:'Reconnect agent',exact:true})).toHaveCount(0);
  await expect(welcome.getByText('Your agent runs with AI off until you sign in to Eliza Cloud.',{exact:true})).toHaveCount(0);
  await expect(welcome.getByText('Phone action history',{exact:true})).toHaveCount(0);
  await expect(welcome.getByText('Conversation history',{exact:true})).toHaveCount(0);
  return { foreign, welcome };
}
/** No key was kept or bound, and the resident is running without AI (P-43). `untouched`: the sign-in
 * never stored a key, so the resident kept running throughout (never stopped, never restarted). */
async function nothingLeft(page: Page, welcome: ReturnType<Page['getByRole']>, untouched = false) {
  await expect.poll(()=>harness(page,f=>f.calls.filter((call:string)=>call==='Agent.start').length)).toBeGreaterThan(0);
  await expect(welcome).toBeVisible();
  await expect(welcome.getByRole('button', { name: 'Sign in with Eliza Cloud', exact: true })).toBeEnabled();
  expect(await harness(page, f => f.slots['cloud:production'] ?? null)).toBeNull();
  expect(await stub(page, s => s.order.some((entry: string) => entry.startsWith('configureCloudProvider')))).toBe(false);
  if (untouched) {
    expect(await starts(page)).toBe(1);
    expect(await stub(page, s => s.order.includes('Agent.stop'))).toBe(false);
  } else expect(await starts(page)).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alpha.connection.selection.v1') ?? 'null'))).toEqual({ kind: 'resident' });
}

test('first run: Cloud sign-in in the browser, credits, provider binding, then the resident agent answers', async ({ page }) => {
  test.setTimeout(120_000);
  const { foreign, welcome } = await firstRun(page);
  await welcome.getByRole('button', { name: 'Sign in with Eliza Cloud', exact: true }).click();
  await expect(welcome.getByText(WAITING, { exact: true })).toBeVisible();
  await expect(welcome).toHaveCount(0, { timeout: 30_000 });
  // Fresh sign-in owns the original required sequence, with no Skip or automatic requests.
  const access=page.locator('dialog.alpha-startup-permissions');
  await expect(access).toBeVisible();
  expect(await page.evaluate(()=>(window as any).firstRunAccess.requests)).toEqual([]);
  for(const name of ['Stay in the loop.','Talk to Alpha.','Capture a moment.','Find your way.','Plan your day.','Your photos, here.']) {
    await expect(access.getByRole('heading',{name,exact:true})).toBeVisible();
    await expect(access.getByRole('button',{name:/Skip|Not now|Back/})).toHaveCount(0);
    await access.getByRole('button',{name:'Allow',exact:true}).click();
  }
  await expect(access.getByRole('heading',{name:'You’re all set',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).firstRunAccess.requests)).toEqual(['notifications','microphone','camera','location','calendar','photos']);
  await access.getByRole('button',{name:'Go to Alpha',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(() => window.dispatchEvent(new Event('launcher-home')));
  await expect(button(page, 'Notes')).toBeVisible();

  const order = await stub(page, s => s.order) as string[];
  const stored = JSON.parse(await harness(page, f => f.slots['cloud:production']));
  expect(stored.token).toBe(account.token);
  // In call order: the browser hand-off, one pending poll, the key stored, the plan read, the provider
  // bound to that key, and only then the agent started. Nothing was revoked (no key was saved before).
  const at = (entry: string) => order.indexOf(entry);
  expect(order.filter(entry => entry.startsWith('openExternal'))).toEqual(['openExternal https://eliza.app']);
  expect(order.filter(entry => entry.startsWith('poll'))).toEqual(['poll pending', 'poll authenticated']);
  expect(at('openExternal https://eliza.app')).toBeLessThan(at('poll pending'));
  expect(at('poll authenticated')).toBeLessThan(at('store first-run-key'));
  expect(at('store first-run-key')).toBeLessThan(at('plan new-owner@example.invalid'));
  expect(at('plan new-owner@example.invalid')).toBeLessThan(at('configureCloudProvider ' + stored.credentialId));
  // The resident restarts after the provider is bound to the new key.
  expect(at('configureCloudProvider ' + stored.credentialId)).toBeLessThan(order.lastIndexOf('Agent.start'));
  expect(order.indexOf('Agent.start')).toBeLessThan(at('openExternal https://eliza.app'));
  expect(order.filter(entry => entry.startsWith('revoke'))).toEqual([]);
  expect(await stub(page, s => s.opened)).toEqual(['https://eliza.app/auth/cli-login?session=b7a2c1d0-5e4f-4a3b-8c2d-1e0f9a8b7c6d&app=alpha']);
  // Every Cloud request went to the Cloud API through the native transport.
  expect((await stub(page, s => s.cloud) as Array<{ path: string }>).map(row => row.path)).toEqual(expect.arrayContaining(['/api/auth/cli-session', '/api/v1/user', '/api/v1/billing/limits']));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alpha.connection.selection.v1')!))).toEqual({ kind: 'resident' });

  const ask = page.getByRole('textbox', { name: 'Ask Alpha', exact: true });
  await ask.fill('First request after sign-in'); await ask.press('Enter');
  await expect(page.getByRole('button', { name: 'Message actions: Resident reply 1', exact: true })).toHaveCount(1);
  expect(await harness(page, f => f.streams)).toBe(1);
  const settings=await openYourAgent(page);
  await expect(settings.getByRole('button',{name:'Reconnect agent',exact:true})).toBeVisible();
  await expect(settings.getByText('Conversation history',{exact:true})).toBeVisible();
  expect(await page.locator('body').innerText()).not.toContain(account.token);
  await expectNoDevelopmentSurface(page);
  expect(await harness(page, f => f.unexpected)).toEqual([]);
  expect(foreign).toEqual([]);
});

test('first run: Cancel while waiting for the browser sign-in keeps no key and the resident runs without AI', async ({ page }) => {
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
  await nothingLeft(page, welcome, true);
  expect(foreign).toEqual([]);
});

test('first run: an expired sign-in session keeps no key and the resident runs without AI', async ({ page }) => {
  test.setTimeout(90_000);
  const { welcome } = await firstRun(page);
  await setStub(page, { login: 'expired' });
  await welcome.getByRole('button', { name: 'Sign in with Eliza Cloud', exact: true }).click();
  await expect(welcome.getByText('Your Eliza Cloud sign-in has expired. Sign in again.', {exact:true})).toBeVisible({ timeout: 30_000 });
  await nothingLeft(page, welcome, true);
});

test('first run: Cloud refusing the new key (401 on the account read) removes it and the resident runs without AI', async ({ page }) => {
  test.setTimeout(90_000);
  const { welcome } = await firstRun(page, { userStatus: 401 });
  await welcome.getByRole('button', { name: 'Sign in with Eliza Cloud', exact: true }).click();
  await expect(welcome.getByRole('alert')).toBeVisible({ timeout: 30_000 });
  await expect(welcome).not.toContainText(/pair/i);
  expect(await stub(page, s => s.order.filter((entry: string) => entry.startsWith('store') || entry === 'remove cloud key'))).toEqual(['store first-run-key', 'remove cloud key']);
  await nothingLeft(page, welcome);
  await expect(welcome.getByRole('alert')).toHaveText('Eliza Cloud refused this sign-in. Your agent keeps running; sign in again to turn AI on.');
  await expect(welcome.getByRole('button',{name:'Reconnect agent',exact:true})).toHaveCount(0);
  await expect(welcome.getByText('Conversation history',{exact:true})).toHaveCount(0);
});

// An account Cloud reports unable to use AI no longer blocks the resident agent: billing state never
// retires local orchestration and Cloud refuses AI requests itself (subscription-entitlement.ts,
// connection-ui.tsx admitCloudResident). The plan view and its billing link are covered by
// native-cloud-subscription.spec.ts; the refusal on send by resident-failures.production.spec.ts.

// A provider rebind can fail once while native shuts down, then recover in ensureResident.
// The recovered connection must not restore the earlier startup error.
test('first run: recovered provider restart clears its stale startup error', async ({ page }) => {
  test.setTimeout(120_000);
  const { foreign, welcome } = await firstRun(page);
  await setStub(page, { start: 'reject-once' });
  await welcome.getByRole('button', { name: 'Sign in with Eliza Cloud', exact: true }).click();
  // Successful sign-in now continues into access setup; the recovered start must leave no error anywhere.
  await expect(welcome).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('dialog.alpha-startup-permissions')).toBeVisible();
  await expect.poll(() => starts(page)).toBe(3);
  await expect(page.getByText('Local agent failed to start.', { exact: true })).toHaveCount(0);
  expect(await harness(page, f => f.slots['cloud:production'] != null)).toBe(true);
  expect(foreign).toEqual([]);
});
