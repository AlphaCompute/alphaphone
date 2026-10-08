import { expect, type Page } from '@playwright/test';

/** Return through the standalone app's visible controls, including an expanded conversation. */
export async function returnToApps(page: Page) {
  const minimize = page.getByRole('button', {name: 'Minimize chat', exact: true});
  if (await minimize.isVisible()) {
    await minimize.click();
    await expect(minimize).toBeHidden();
  }
  const back = page.getByRole('button', {name: 'Back to apps', exact: true});
  if (await back.isVisible()) await back.click();
  await expect(page.getByRole('button', {name: 'Settings', exact: true})).toBeVisible();
}
