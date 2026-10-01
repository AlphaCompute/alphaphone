import { test, expect } from '@playwright/test';

for (const failure of ['quota', 'concurrent edit'] as const) {
  test(`Notes retains unsaved text after ${failure}`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Notes', exact: true }).click();
    await page.getByRole('button', { name: 'New note', exact: true }).click();
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Recovery note');
    const body = page.getByRole('textbox', { name: 'Note', exact: true });
    await body.fill('Saved original');
    const stored = await page.evaluate((failure) => {
      const key = 'alphaphone:notes:v2';
      if (failure === 'concurrent edit') {
        const envelope = JSON.parse(localStorage.getItem(key)!);
        envelope.records.find((note: { title: string }) => note.title === 'Recovery note').body = 'Saved in another view';
        localStorage.setItem(key, JSON.stringify(envelope));
      } else {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === 'alphaphone:notes:v2') throw new DOMException('Storage full', 'QuotaExceededError');
          return original.call(this, key, value);
        };
      }
      return localStorage.getItem(key);
    }, failure);
    await body.fill('Unsaved text that must not disappear');
    await expect(body).toHaveValue('Unsaved text that must not disappear');
    await expect(page.getByRole('status').filter({ hasText: 'Keep this screen open' })).toBeVisible();
    // A refused edit must neither overwrite the concurrent value nor repeat an uncertain write.
    expect(await page.evaluate(() => localStorage.getItem('alphaphone:notes:v2'))).toBe(stored);
    await page.getByRole('button', { name: 'Back to notes', exact: true }).click();
    await page.getByRole('button', { name: 'Open Recovery note', exact: true }).click();
    await expect(body).toHaveValue('Unsaved text that must not disappear');
  });
}
