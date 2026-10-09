import { expect, type Page } from '@playwright/test';

/** Return through the standalone app's visible controls, including nested app pages. */
export async function returnToApps(page: Page) {
  const home = page.getByRole('button', {name: 'Go Home', exact: true});
  if (await home.isVisible()) {
    await home.click();
    await expect(page.getByRole('button', {name: 'Settings', exact: true})).toBeVisible();
    return;
  }
  const minimize = page.getByRole('button', {name: 'Minimize chat', exact: true});
  if (await minimize.isVisible()) {
    await minimize.click();
    await expect(minimize).toBeHidden();
  }
  const back = page.getByRole('button', {name: 'Back to apps', exact: true});
  if (await back.isVisible()) await back.click();
  else if (!await page.getByRole('button', {name: 'Settings', exact: true}).isVisible()) {
    await page.getByRole('button', {name: 'Open conversation', exact: true}).click();
    await home.click();
  }
  await expect(page.getByRole('button', {name: 'Settings', exact: true})).toBeVisible();
}
