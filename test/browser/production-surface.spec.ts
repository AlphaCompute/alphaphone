import { test, expect, type Page } from '@playwright/test';
// Runs only in the `production` project: a flag-off `vite build` served by `vite preview`.
// It proves the shipped web bundle exposes no mock, fixture or developer surface.
// It does not prove Android packaging, which is audited separately per APK.

const fixtureNames = ['Maya Chen', 'Jordan Park', 'Priya Nair', 'Alex Kim', 'Ritual Coffee', 'Design review at', 'Unlock for details', 'you@gmail.example'];
const offline = () => localStorage.setItem('alpha.connection.selection.v1', JSON.stringify({ kind: 'offline' }));

async function trackCsp(page: Page) {
  const violations: string[] = [];
  page.on('console', message => { if (/Content Security Policy|Refused to (load|execute|connect|create|apply|frame)/i.test(message.text())) violations.push(message.text()); });
  await page.addInitScript(() => {
    (window as any).cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => (window as any).cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`));
  });
  return async () => [...violations, ...await page.evaluate(() => (window as any).cspViolations as string[])];
}

test('the bundle records production flags and ships a CSP', async ({ page, request }) => {
  expect(await (await request.get('/build-flags.json')).json()).toEqual({ testMocks: false });
  await page.goto('/?tools=1');
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  for (const directive of ["default-src 'self'", "script-src 'self' 'wasm-unsafe-eval'", "object-src 'none'", "base-uri 'none'"]) expect(policy).toContain(directive);
  expect(policy).not.toContain("'unsafe-eval'");
  expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
});

for (const entry of ['/?mode=mock', '/?fixture=1&start=inbox', '/?mode=dev&start=wallet', '/?mode=dev&workflows=agent&start=workflows&theme=dark']) {
  test(`entry point ${entry} renders the live product`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(offline);
    await page.goto(entry);
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-connection-mode', 'live');
    await expect(page.locator('html')).toHaveAttribute('data-active-view', 'home');
    await expect(page.locator('.mock-mode-banner')).toHaveCount(0);
    await expect(page.locator('.alpha-dev-tools')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Device controls', exact: true })).toHaveCount(0);
    await expect(page.getByText(/mock mode/i)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('a stored mock selection on Android opens the chooser and never enters mock mode', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as any; w.androidBridge = {};
    if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('alpha.connection.selection.v1', JSON.stringify({ kind: 'mock' })); }
    const calls: string[] = w.nativeCalls = [];
    const methods = (names: string[]) => names.map(name => ({ name, rtype: 'promise' }));
    w.Capacitor = {
      PluginHeaders: [
        { name: 'AlphaConnection', methods: methods(['pauseNotificationCollection', 'secureRead', 'secureWrite', 'secureRemove', 'request', 'cancel', 'addListener', 'removeListener']) },
        { name: 'AlphaHostedResults', methods: methods(['disableBackground', 'status', 'pendingResult', 'addListener', 'removeListener']) },
        { name: 'AlphaNotifications', methods: methods(['resumeCrossApp', 'status', 'crossAppStatus', 'addListener', 'removeListener']) },
        { name: 'Agent', methods: methods(['getStatus']) }, { name: 'DeviceApps', methods: methods(['buildInfo']) },
      ],
      nativePromise: async (plugin: string, method: string) => {
        calls.push(`${plugin}.${method}`);
        if (plugin === 'Agent') return { packaged: false, state: 'unavailable' };
        if (method === 'secureRead') return { value: null };
        if (plugin === 'DeviceApps') return { launcher: false, version: 'production-surface' };
        return {};
      },
    };
  });
  await page.goto('/?tools=1');
  const chooser = page.locator('.alpha-connection');
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole('button',{name:'Sign in with Eliza Cloud',exact:true})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-connection-mode', 'live');
  await expect(page.locator('.mock-mode-banner')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('mode')).toBe(false);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alpha.connection.selection.v1')!))).toEqual({ kind: 'none' });
  const calls: string[] = await page.evaluate(() => (window as any).nativeCalls);
  // Neither the mock barrier nor any collector resume runs without an explicit choice.
  for (const call of ['AlphaConnection.pauseNotificationCollection', 'AlphaNotifications.resumeCrossApp']) expect(calls).not.toContain(call);
  await expect(chooser.getByText(/mock mode/i)).toHaveCount(0);
  await expect(chooser.getByText('Local development agent', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(chooser).toBeVisible();
  expect(new URL(page.url()).searchParams.has('mode')).toBe(false);
});

test('the chooser and Settings offer only production connections', async ({ page }) => {
  await page.goto('/?tools=1');
  const chooser = page.locator('.alpha-connection');
  // The browser build explains its real options on first run.
  await expect(chooser.getByText('On-device agent unavailable here', { exact: true })).toBeVisible();
  for (const summary of await chooser.locator('summary').all()) await summary.click();
  const text = await chooser.innerText();
  expect(text).not.toMatch(/mock mode/i);
  expect(text).not.toContain('Local development agent');
  expect(text).not.toMatch(/staging/i);
  expect(text).not.toContain('Development connections');
  await expect(chooser.getByLabel('Environment')).toHaveCount(0);
  await expect(chooser.getByRole('button', { name: 'Start local agent', exact: true })).toHaveCount(0);
  for (const name of ['Sign in with Eliza Cloud', 'Connect remote agent', 'Continue offline']) await expect(chooser.getByRole('button', { name, exact: true })).toBeVisible();
  await chooser.getByRole('button', { name: 'Continue offline', exact: true }).click();
  await expect(chooser).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.locator('[data-screen]');
  await expect(settings.getByText('Agent connection', { exact: true })).toBeVisible();
  const settingsText = await settings.innerText();
  expect(settingsText).not.toMatch(/mock mode/i);
  expect(settingsText).not.toMatch(/staging/i);
  await page.getByText('About', { exact: true }).click();
  // The About header and the Runtime row both name the web runtime.
  await expect(settings.getByText('Web app', { exact: true }).first()).toBeVisible();
  await expect(settings.getByText('Development preview', { exact: true })).toHaveCount(0);
  await expect(settings.getByText(/^\d+\.\d+\.\d+/).first()).toBeVisible();
  await settings.getByText('Open source licenses', { exact: true }).click();
  await expect(settings.getByText('Open source licenses', { exact: true }).first()).toBeVisible();
  // Either the generated notices or the honest fallback, never an empty page.
  await expect(settings.getByText(/License notices unavailable|MIT|Apache|BSD|ISC|MPL/).first()).toBeVisible();
});

test('deferred apps are absent and root views show honest unconnected states', async ({ page }) => {
  await page.addInitScript(offline);
  await page.goto('/?tools=1');
  for (const deferred of ['Phone', 'Messages', 'Contacts', 'Wallet']) await expect(page.getByRole('button', { name: deferred, exact: true })).toHaveCount(0);
  const states: Record<string, RegExp> = {
    Inbox: /Connect Eliza Cloud/, Workflows: /Agent connection required/, Notes: /No notes yet/,
    Photos: /No photos/, Maps: /Map tiles are not connected/, Calendar: /\d/, Files: /Choose a document/, Settings: /Agent connection/,
  };
  for (const [view, expected] of Object.entries(states)) {
    await page.goto('/?tools=1');
    await page.getByRole('button', { name: view, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-active-view', view.toLowerCase());
    await expect(page.locator('[data-screen]')).toContainText(expected);
    const text = await page.locator('body').innerText();
    for (const name of fixtureNames) expect(text, `${view} shows fixture ${name}`).not.toContain(name);
  }
});

test('sending chat without a connection opens the chooser', async ({ page }) => {
  await page.goto('/?tools=1');
  const chooser = page.locator('.alpha-connection');
  await expect(chooser).toBeVisible();
  await chooser.getByRole('button', { name: 'Close connection settings', exact: true }).click();
  await expect(chooser).toHaveCount(0);
  const input = page.getByRole('textbox', { name: 'Ask Alpha', exact: true });
  await input.fill('What is on my calendar today?');
  await input.press('Enter');
  await expect(chooser).toBeVisible();
  await expect(page.getByText(/Development reply|emulator development agent/)).toHaveCount(0);
});

test('the CSP admits Home, Notes, Maps, Scan and PDF without violations', async ({ page }) => {
  test.setTimeout(120_000);
  const violations = await trackCsp(page);
  await page.addInitScript(offline);
  await page.goto('/?tools=1');
  await expect(page.getByRole('button', { name: 'Notes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: 'New note', exact: true }).click();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('CSP note');
  await page.getByRole('button', { name: 'Back to notes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open CSP note', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to apps', exact: true }).click();
  await page.getByRole('button', { name: 'Maps', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-active-view', 'maps');
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Back to apps', exact: true }).click();
  await page.getByRole('button', { name: 'Camera', exact: true }).click();
  const png = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 600;
    const context = canvas.getContext('2d')!; context.fillStyle = 'white'; context.fillRect(0, 0, 1200, 600);
    context.fillStyle = 'black'; context.font = '60px Arial'; context.fillText('Alpha searchable document', 50, 120);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.getByRole('button', { name: 'Scan document', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await (await chooser).setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await expect(page.getByRole('img', { name: 'Document page 1', exact: true })).toBeVisible();
  const imagePdf = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download document PDF', exact: true }).click();
  expect((await imagePdf).suggestedFilename()).toMatch(/\.pdf$/);
  await page.getByRole('button', { name: 'Close scan', exact: true }).or(page.getByRole('button', { name: /^Close/ }).last()).click();
  await page.getByRole('button', { name: 'Scan document', exact: true }).click();
  const second = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await (await second).setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await page.getByRole('button', { name: 'Download searchable PDF', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Review searchable PDF' });
  // Local OCR runs in a worker with WebAssembly: the policy must admit both.
  await expect(review.getByLabel('Page 1 line 1', { exact: true })).toHaveValue(/Alpha searchable/, { timeout: 90_000 });
  const searchable = page.waitForEvent('download');
  await review.getByRole('button', { name: 'Download reviewed searchable PDF', exact: true }).click();
  expect((await searchable).suggestedFilename()).toMatch(/\.pdf$/);
  expect(await violations()).toEqual([]);
});

test('production ignores the development render-failure hook', async ({ page }) => {
  await page.addInitScript(offline);
  await page.goto('/?tools=1');
  const settings = page.getByRole('button', { name: 'Settings', exact: true });
  await expect(settings).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('alpha:force-render-error')));
  await settings.click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Agent connection', exact: true })).toBeVisible();
});

test('production browser speech: self-hosted Whisper transcribes under the shipped CSP without third-party requests', async ({ page }) => {
  test.setTimeout(120000);
  const { readFileSync } = await import('node:fs');
  const encoded = readFileSync(new URL('../../design-assets/video/narration/voice.wav', import.meta.url)).toString('base64');
  const violations = await trackCsp(page);
  const foreign: string[] = [];
  page.on('request', request => { const url = new URL(request.url()); if (!['127.0.0.1', 'localhost'].includes(url.hostname) && !['data:', 'blob:'].includes(url.protocol)) foreign.push(request.url()); });
  await page.addInitScript(offline);
  await page.goto('/');
  await page.evaluate(async encoded => {
    const ctx = new AudioContext(), buffer = await ctx.decodeAudioData(Uint8Array.from(atob(encoded), c => c.charCodeAt(0)).buffer);
    document.addEventListener('click', () => { void ctx.resume(); }, { capture: true });
    (window as any).spoken = buffer.duration;
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { const sink = ctx.createMediaStreamDestination(), source = ctx.createBufferSource(); source.buffer = buffer; source.connect(sink); await ctx.resume(); setTimeout(() => source.start(), 150); return sink.stream; } } });
  }, encoded);
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: 'Record and transcribe', exact: true }).click();
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop recording', exact: true })).toBeVisible();
  await page.waitForTimeout(await page.evaluate(() => (window as any).spoken as number) * 1000 + 500);
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
  await page.getByRole('button', { name: 'Transcribe on this device', exact: true }).click();
  const review = page.getByRole('textbox', { name: 'Review transcript', exact: true });
  await expect(review).toHaveValue(/hold the side key to talk/i, { timeout: 90000 });
  expect(foreign).toEqual([]);
  expect(await violations()).toEqual([]);
});
for (const mode of ['signed-out','empty','unavailable','funded','replaced','unpackaged','legacy-offline'] as const) {
 test(`resident billing onboarding: ${mode}`,async({page})=>{
  await page.addInitScript(mode=>{
   const w=window as any;w.androidBridge={};w.residentCalls=[];
   const id='9f1dc45a-4011-4e44-947a-30d999d24fa5';
   const values:Record<string,string>={};let credentialReads=0;
   if(mode==='legacy-offline')localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));
   if(mode!=='signed-out'&&mode!=='unpackaged'&&mode!=='legacy-offline')values['cloud:production']=JSON.stringify({token:'synthetic-cloud-key',credentialId:id,expiresAt:Date.now()+60000});
   const methods=(names:string[])=>names.map(name=>({name,rtype:'promise'}));
   w.Capacitor={PluginHeaders:[
    {name:'DeviceApps',methods:methods(['buildInfo'])},
    {name:'Agent',methods:methods(['getStatus','start','stop','configureCloudProvider','request'])},
    {name:'AlphaConnection',methods:methods(['secureRead','secureWrite','secureRemove','secureCompareExchange','request','cancel','openExternal'])},
    {name:'AlphaNotifications',methods:methods(['status','crossAppStatus','addListener','removeListener'])},
    {name:'AlphaVoiceCloud',methods:methods(['checkPermissions'])},
   ],nativePromise:async(plugin:string,method:string,input:any)=>{
    w.residentCalls.push({plugin,method,path:input?.path,url:input?.url});
    if(plugin==='DeviceApps')return{launcher:false,version:'billing-fixture'};
    if(plugin==='AlphaNotifications')return{permissionGranted:true,appEnabled:true};
    if(plugin==='AlphaVoiceCloud')return{microphone:'granted'};
    if(plugin==='Agent'){
     if(method==='getStatus')return{packaged:mode!=='unpackaged',state:'stopped',serviceActive:false,socketListening:false};
     if(method==='request'){
      const body=input.path==='/api/auth/me'?{identity:{id,kind:'owner'},access:{role:'OWNER',mode:'local'}}:
       input.path==='/api/agents'?{agents:[{id,name:'Alpha',status:'running'}]}:
       input.path==='/api/conversations'?{conversations:[]}:{};
      return {status:200,body:JSON.stringify(body)};
     }
     return {};
    }
    if(method==='secureRead'){if(input.slot==='cloud:production'&&++credentialReads===5&&mode==='replaced')values[input.slot]=JSON.stringify({token:'synthetic-replacement-key',credentialId:'f04d4d24-6978-42a2-a968-995d76debf77',expiresAt:Date.now()+60000});return{value:values[input.slot]??null};}
    if(method==='secureWrite'){values[input.slot]=input.value;return{};}
    if(method==='secureRemove'){delete values[input.slot];return{};}
    if(method==='request'){
     const path=new URL(input.url).pathname;
     if(path==='/api/v1/user')return{status:200,data:{success:true,data:{id}}};
     if(path==='/api/v1/credits/balance')return mode==='unavailable'?{status:503,data:{error:'temporary'}}:{status:200,data:{balance:mode==='funded'||mode==='replaced'?5:0}};
     throw Error('Unexpected Cloud route: '+path);
    }
    return {};
   }};
  },mode);
  await page.goto('/');
  if(mode==='signed-out')await expect(page.getByRole('button',{name:'Sign in with Eliza Cloud',exact:true})).toBeVisible();
  if(mode==='empty')await expect(page.getByRole('button',{name:'Add credits in Eliza Cloud',exact:true})).toBeVisible();
  if(mode==='unavailable'){
   await expect(page.getByRole('alert')).toContainText(/unavailable|starting/i);
   await expect(page.getByRole('button',{name:'Add credits in Eliza Cloud',exact:true})).toHaveCount(0);
  }
  if(mode==='funded')await expect(page.getByRole('button',{name:'Notes',exact:true})).toBeVisible();
  if(mode==='replaced')await expect(page.getByRole('alert')).toContainText(/account changed/i);
  if(mode==='unpackaged'||mode==='legacy-offline'){await expect(page.getByRole('button',{name:'Sign in with Eliza Cloud',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Welcome to Alpha'})).toBeVisible();}
  await expect(page.getByRole('button',{name:'Use local apps without AI',exact:true})).toHaveCount(0);
  const calls=await page.evaluate(()=>(window as any).residentCalls);
  expect(calls.some((c:any)=>c.url?.includes('/personal/')||c.url?.includes('/upgrade-tier'))).toBe(false);
  const native=calls.filter((c:any)=>c.plugin==='Agent').map((c:any)=>c.method);
  if(mode==='funded')expect(native.indexOf('stop')).toBeLessThan(native.indexOf('configureCloudProvider'));
  else expect(native).not.toContain('start');
 });
}
