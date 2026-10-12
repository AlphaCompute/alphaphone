// What the flag-off Android renderer says when a resident reply fails, when the phone loses its
// network, and when the native stream refuses, is rate-limited or drops; and what a restart during
// a held reply shows. None of these resends a message.
//
// Evidence boundary: source/test evidence for the flag-off renderer only. The Capacitor bridge is
// the stub in flag-off-android.ts plus resident-stub.ts; it is not the native Agent plugin, the
// resident runtime, Eliza Cloud, Cerebras or a device.
import { test, expect, type Page } from '@playwright/test';
import { flagOffAndroid, harness, button, fenceNetwork, expectNoDevelopmentSurface, residentHome } from './flag-off-android';
import { residentStub, stub, setStub } from './resident-stub';

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'production', 'Production bundle only'); });

const id = '9f1dc45a-4011-4e44-947a-30d999d24fa5';
const owner = { token: 'synthetic-cloud-key', userId: id, email: 'owner@example.invalid', balance: 5 };
const composer = (page: Page) => page.locator('[data-alpha-layer="composer"][aria-hidden="false"], [data-alpha-layer="conversation"][aria-hidden="false"]').getByRole('textbox').first();
const conversation = (page: Page) => page.locator('[data-alpha-layer="conversation"]');
const bubble = (page: Page, text: string) => page.getByRole('button', { name: 'Message actions: ' + text, exact: true });
const UNKNOWN = 'Your message may have reached the agent. Check before sending it again.';
const NOT_SENT = 'Not sent. Your message is back in the composer.';

async function connected(page: Page) {
  const foreign = await fenceNetwork(page);
  await flagOffAndroid(page);
  await residentStub(page, { accounts: [owner] });
  await residentHome(page);
  return foreign;
}
async function send(page: Page, text: string) { await composer(page).fill(text); await composer(page).press('Enter'); }

const KINDS = {
  insufficient_credits: 'Your Eliza Cloud credits are used up. Add credits in Eliza Cloud, then send again. Nothing was retried.',
  provider_issue: 'Hosted inference (Eliza Cloud / Cerebras) could not be reached; nothing was retried.',
  generation_timeout: 'Hosted inference (Eliza Cloud / Cerebras) could not be reached; nothing was retried.',
  no_provider: 'AI is not set up for your agent. Sign in with Eliza Cloud to set up hosted inference; nothing was retried.',
} as const;

for (const [kind, text] of Object.entries(KINDS)) for (const frame of ['done', 'error'] as const) {
  test(`a resident reply that fails with ${kind} (${frame} frame) says so, offers the next step and sends once`, async ({ page }) => {
    test.setTimeout(120_000);
    const foreign = await connected(page);
    await setStub(page, { stream: { failure: kind, frame } });
    if (kind === 'insufficient_credits') await stub(page, s => { s.accounts[0].balance = 0; s.persist(); });
    await send(page, `Failing ${kind}`);
    await expect(conversation(page).getByText(text, { exact: true })).toHaveCount(1);
    // Upstream's provider prose is never shown, and the agent's own outcome needs no history check.
    await expect(page.getByText(/PRIVATE_PROVIDER_ERROR_CANARY/)).toHaveCount(0);
    await expect(page.getByText(UNKNOWN, { exact: true })).toHaveCount(0);
    await expect(bubble(page, `Failing ${kind}`)).toHaveCount(1);
    if (kind === 'insufficient_credits') {
      // The balance is read again, and the top-up opens Cloud billing only when the owner asks.
      await expect.poll(() => stub(page, s => s.order.filter((item: string) => item.startsWith('credits')).length)).toBe(2);
      const topUp = page.getByRole('button', { name: /^Add credits in Eliza Cloud/ });
      await expect(topUp).toHaveCount(1);
      expect(await stub(page, s => s.opened)).toEqual([]);
      await topUp.click();
      await expect.poll(() => stub(page, s => s.opened)).toEqual(['https://cloud.eliza.app/cloud/billing']);
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('Add credits to continue');
      await expect(dialog.getByRole('button', { name: 'Add credits in Eliza Cloud', exact: true })).toBeVisible();
      await expect(dialog).not.toContainText(/Connected|Credits available/);
    } else {
      if (kind === 'no_provider') await expect(page.getByRole('button', { name: /^Set up AI/ })).toHaveCount(1);
      else await expect(page.getByRole('button', { name: /^(Add credits|Set up AI)/ })).toHaveCount(0);
      // Agent connection no longer says the agent is ready.
      await page.evaluate(() => window.dispatchEvent(new Event('launcher-home')));
      await button(page, 'Settings').click();
      await page.getByRole('button', { name: 'Agent connection', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog')).not.toContainText('Connected');
    }
    // Exactly one stream request and no automatic resend of any kind.
    await page.waitForTimeout(1500);
    expect(await harness(page, f => f.streams)).toBe(1);
    expect(await stub(page, s => s.recoveries)).toEqual([]);
    expect(await harness(page, f => f.unexpected)).toEqual([]);
    await expectNoDevelopmentSurface(page);
    expect(foreign).toEqual([]);
  });
}

test('without a network the resident says AI needs a connection, sends nothing, and clears the notice when back online', async ({ page, context }) => {
  test.setTimeout(120_000);
  await connected(page);
  const notice = page.getByText('AI needs a connection. Local apps keep working; nothing is sent until this phone is back online.', { exact: true });
  await expect(notice).toHaveCount(0);
  await context.setOffline(true);
  await expect(notice).toBeVisible();
  await send(page, 'Sent while offline');
  await expect(page.getByText(NOT_SENT, { exact: true }).first()).toBeVisible();
  await expect(composer(page)).toHaveValue('Sent while offline');
  expect(await harness(page, f => f.streams)).toBe(0);
  // Local apps keep working: Notes opens and the notice stays beside the composer.
  await page.evaluate(() => window.dispatchEvent(new Event('launcher-home')));
  await button(page, 'Notes').click();
  await expect(page.locator('html')).toHaveAttribute('data-active-view', 'notes');
  await page.evaluate(() => window.dispatchEvent(new Event('launcher-home')));
  // Readiness is retracted while offline.
  await button(page, 'Settings').click();
  await page.getByRole('button', { name: 'Agent connection', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toContainText('Connected');
  await page.getByRole('button', { name: 'Close connection settings', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('launcher-home')));
  await context.setOffline(false);
  await expect(notice).toHaveCount(0);
  // Only the owner's own Send posts it, once.
  await composer(page).fill('Sent when back online'); await composer(page).press('Enter');
  await expect(bubble(page, 'Resident reply 1')).toHaveCount(1);
  expect(await harness(page, f => f.posts)).toHaveLength(1);
});

for (const mode of ['reject', 'busy'] as const) {
  test(`a resident stream ${mode === 'reject' ? 'refused by native IPC' : 'refused with HTTP 429'} keeps the text, and a second Send posts once`, async ({ page }) => {
    test.setTimeout(120_000);
    await connected(page);
    await setStub(page, { stream: mode });
    await send(page, `Refused by ${mode}`);
    await expect(page.getByText(mode === 'busy' ? 'Not sent. The agent is busy and did not accept this message. Wait, then send it again.' : NOT_SENT, { exact: true }).first()).toBeVisible();
    await expect(composer(page)).toHaveValue(`Refused by ${mode}`);
    await expect(bubble(page, `Refused by ${mode}`)).toHaveCount(0);
    await expect(page.getByText(UNKNOWN, { exact: true })).toHaveCount(0);
    expect(await harness(page, f => ({ streams: f.streams, posts: f.posts.length }))).toEqual({ streams: 1, posts: 0 });
    await stub(page, s => { s.stream = null; });
    await composer(page).press('Enter');
    await expect(bubble(page, 'Resident reply 2')).toHaveCount(1);
    await expect(bubble(page, `Refused by ${mode}`)).toHaveCount(1);
    expect(await harness(page, f => f.posts)).toHaveLength(1);
    expect(await stub(page, s => s.recoveries)).toEqual([]);
    expect(await harness(page, f => f.unexpected)).toEqual([]);
  });
}

test('a resident stream that fails after the turn was recorded offers a history check, never a resend, and a restart shows the turn once', async ({ page }) => {
  test.setTimeout(150_000);
  await connected(page);
  await stub(page, s => { s.stream = 'drop'; });
  await send(page, 'Dropped after recording');
  await expect(page.getByText(UNKNOWN, { exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Check for reply/ })).toHaveCount(1);
  await expect(composer(page)).toHaveValue('');
  // The one re-read of a dropped stream reuses the same clientMessageId; nothing new is posted.
  const [body] = await stub(page, s => s.bodies);
  expect(await stub(page, s => s.recoveries)).toEqual([body.clientMessageId]);
  await page.waitForTimeout(1500);
  expect(await harness(page, f => f.streams)).toBe(1);
  await page.reload();
  await expect.poll(() => harness(page, f => f.calls.includes('Agent.start')), { timeout: 30_000 }).toBe(true);
  await expect(page.locator('.alpha-connection-scrim')).toHaveCount(0, { timeout: 30_000 });
  await button(page, 'Open conversation').click();
  await expect(bubble(page, 'Dropped after recording')).toHaveCount(1, { timeout: 30_000 });
  expect(await harness(page, f => f.streams)).toBe(0);
});

test('a restart while the resident holds a reply posts nothing and shows the user turn and the reply once', async ({ page }) => {
  test.setTimeout(150_000);
  await connected(page);
  await stub(page, s => { s.stream = 'hold'; });
  await send(page, 'Held across a restart');
  await expect(bubble(page, 'Held across a restart')).toHaveCount(1);
  await expect.poll(() => stub(page, s => !!s.held)).toBe(true);
  await page.reload();
  await expect.poll(() => harness(page, f => f.calls.includes('Agent.start')), { timeout: 30_000 }).toBe(true);
  await expect(page.locator('.alpha-connection-scrim')).toHaveCount(0, { timeout: 30_000 });
  await button(page, 'Open conversation').click();
  await expect(bubble(page, 'Held across a restart')).toHaveCount(1, { timeout: 30_000 });
  // The restored chat says it will check once; the agent finishes after the restart.
  await expect(conversation(page).getByText('The agent may still finish this reply. Alpha Phone will check once and show it here if it does.', { exact: true })).toHaveCount(1);
  await stub(page, s => s.finishHeld());
  await expect(bubble(page, 'Held reply 1')).toHaveCount(1, { timeout: 60_000 });
  await expect(bubble(page, 'Held across a restart')).toHaveCount(1);
  expect(await harness(page, f => f.streams)).toBe(0);
  expect(await stub(page, s => s.recoveries)).toEqual([]);
});

test('a resident send the runtime no longer accepts (401) asks for an Eliza Cloud sign-in, never pairing', async ({ page }) => {
  test.setTimeout(120_000);
  await connected(page);
  await setStub(page, { stream: 'expired' });
  await send(page, 'Sent with an expired session');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole('button', { name: 'Sign in with Eliza Cloud', exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/pair/i);
  expect(await stub(page, s => s.recoveries)).toEqual([]);
});
