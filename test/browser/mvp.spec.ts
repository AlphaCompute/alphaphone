import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const views = ['Inbox', 'Calendar', 'Browser', 'Camera', 'Photos', 'Maps', 'Notes', 'Files', 'Workflows', 'Settings'];
for (const theme of ['light', 'dark']) {
  for (const width of [360, 412, 1440]) {
    test(`${theme} ${width}: all MVP views remain accessible`, async ({ page }, info) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: 915 });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const name of views) {
        await page.goto(`/?theme=${theme}`);
        for (const deferred of ['Phone', 'Messages', 'Contacts', 'Wallet']) await expect(page.getByRole('button', {name: deferred, exact: true})).toHaveCount(0);
        await page.getByRole('button', { name, exact: true }).click();
        await expect(page.locator('html')).toHaveAttribute('data-active-view', name.toLowerCase());
        const box = await page.locator('[data-screen]').boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
        expect(box!.y + box!.height).toBeLessThanOrEqual(916);
        await expect(page.getByText('Reminders could not refresh.', { exact: false })).toHaveCount(0);
        if (width === 412) await page.screenshot({ path: info.outputPath(`${name}.png`) });
      }
      expect(errors).toEqual([]);
    });
  }
}
test('Notes create, edit, reload, search and delete', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(page.getByText('No notes yet. Create a note to get started.')).toBeVisible();
  await page.getByRole('button', { name: 'New note', exact: true }).click();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Browser audit note');
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('A real local draft.\nSecond line.');
  await page.getByRole('button', { name: 'Back to notes', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: 'Open Browser audit note', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('A real local draft.\nSecond line.');
  await page.getByRole('button', { name: 'Back to notes', exact: true }).click();
  await page.getByRole('button', { name: 'Search notes', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search notes', exact: true }).fill('not present');
  await expect(page.getByText('No matches', {exact:true})).toBeVisible();
  await page.getByRole('button', { name: 'Close search', exact: true }).click();
  await page.getByRole('button', { name: 'Open Browser audit note', exact: true }).click();
  await page.getByRole('button', { name: 'Delete note', exact: true }).click();
  await expect(page.getByText('No notes yet. Create a note to get started.')).toBeVisible();
});
test('Local text import and exact-byte download use real browser APIs', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', {name:'Notes',exact:true}).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', {name:'Import text note',exact:true}).click();
  const text='Local 🧪 file\r\nExact bytes\n';
  await (await chooser).setFiles({ name:'Owned browser note.txt', mimeType:'text/plain', buffer:Buffer.from(text) });
  await expect(page.getByRole('textbox',{name:'Note',exact:true})).toHaveValue(text.replaceAll('\r\n','\n'));
  await page.getByRole('button',{name:'Share note',exact:true}).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button',{name:'Export text file',exact:true}).click();
  const result=await download;
  expect(result.suggestedFilename()).toBe('Owned browser note.txt');
  expect(await readFile((await result.path())!, 'utf8')).toBe(text);
});
test('Mock is explicit, its banner does not cover the phone, and exit restores live mode', async ({ page }) => {
  await page.goto('/?mode=mock');
  await expect(page.getByText('Mock mode · simulated data and actions')).toBeVisible();
  const banner=await page.locator('.mock-mode-banner').boundingBox();
  const phone=await page.locator('[data-screen]').boundingBox();
  expect(phone!.y).toBeGreaterThanOrEqual(banner!.y+banner!.height);
  await page.getByRole('button',{name:'Exit mock mode',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-connection-mode','live');
  await expect(page.locator('.mock-mode-banner')).toHaveCount(0);
});
test('Notes rejects invalid text and cancels an empty file selection without creating records', async ({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Notes',exact:true}).click();
  for(const files of [[{name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from([0xff,0xfe,0])}],[]]) {
    const chooser=page.waitForEvent('filechooser');
    await page.getByRole('button',{name:'Import text note',exact:true}).click();
    await (await chooser).setFiles(files);
    await expect(page.getByText('No notes yet. Create a note to get started.')).toBeVisible();
    await expect(page.getByRole('button',{name:'Import text note',exact:true})).toBeEnabled();
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('alphaphone:notes:v2')||'{"records":[]}').records.length)).toBe(0);
  }
});
test('Scheduled digests traps focus, closes on native Back, and restores the triggering control',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Settings',exact:true}).click();
  const trigger=page.getByRole('button',{name:'Scheduled digests',exact:true});
  await trigger.click();
  const dialog=page.getByRole('dialog',{name:'Scheduled digests',exact:true});
  await expect(dialog).toBeVisible();await expect(dialog).toBeFocused();
  await expect(page.locator('.os')).toHaveAttribute('inert','');
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await page.evaluate(()=>window.dispatchEvent(new Event('alpha-back',{cancelable:true})));
  await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-active-view','settings');
});
test('Manual voice recording is an explicit choice when transcription is unavailable',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Notes',exact:true}).click();
  await page.getByRole('button',{name:'Record and transcribe',exact:true}).click();
  await expect(page.getByRole('button',{name:'On-device speech unavailable',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Record without transcription',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start recording',exact:true})).toBeEnabled();
  await expect(page.getByText(/You can add a transcript manually and save without signing in/)).toBeVisible();
  await page.getByRole('button',{name:'Discard recording',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start recording',exact:true})).toHaveCount(0);
});
test('Display theme survives reload and mock preview does not overwrite it',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'Display',exact:true}).click();
  await page.getByRole('button',{name:'Theme: Dark',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('alpha.appearance.v1'))).toBe('dark');
  await page.reload();
  expect(await page.locator('.os').evaluate(el=>getComputedStyle(el).getPropertyValue('--bg').trim())).toBe('#000000');
  await page.goto('/?mode=mock&theme=light');
  expect(await page.evaluate(()=>localStorage.getItem('alpha.appearance.v1'))).toBe('dark');
  await page.goto('/');
  expect(await page.locator('.os').evaluate(el=>getComputedStyle(el).getPropertyValue('--bg').trim())).toBe('#000000');
});
