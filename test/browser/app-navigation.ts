import { expect, type Page } from '@playwright/test';

/** Return through the standalone app's visible controls, including nested app pages. */
export async function returnToApps(page: Page) {
  const settings = page.getByRole('button', {name: 'Settings', exact: true});
  // Read-only nested detail pages hide the app header. Unwind their visible
  // back controls first, rather than opening and dragging the chat over them.
  for (let depth = 0; depth < 4 && !await settings.isVisible(); depth++) {
    const nested = page.getByRole('button', {name: /^(Back to calendar|Back from photo|Back to albums)$/}).filter({visible:true});
    if (!await nested.count()) break;
    await nested.click();
    await expect(nested).toBeHidden();
  }
  const home = page.getByRole('button', {name: 'Go Home', exact: true});
  if (await settings.isVisible()) {
    if (await home.isVisible()) await home.press('Enter');
    await expect(settings).toBeVisible();
    return;
  }
  const back = page.getByRole('button', {name: 'Back to apps', exact: true}).filter({visible:true});
  if (await back.count()) await back.first().click();
  else {
    if (!await home.isVisible()) await page.getByRole('button', {name: 'Open conversation', exact: true}).click();
    await home.press('Enter');
  }
  await expect(settings).toBeVisible();
}
