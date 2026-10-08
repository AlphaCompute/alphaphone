import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('alpha.connection.selection.v1', JSON.stringify({kind:'offline'})));
});

test('standalone preview hides simulated system controls and developer tools', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Notes',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Device controls',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Home',exact:true})).toHaveCount(0);
  await expect(page.locator('[data-alpha-system-cutout]')).toBeHidden();
});

test('tools and launcher presentation require explicit development flags', async ({page}) => {
  await page.goto('/?tools=1&shell=launcher');
  await expect(page.getByRole('button',{name:'Device controls',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Home',exact:true})).toBeVisible();
});

test('chat handle captures an upward and downward drag outside its bounds', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Open conversation',exact:true}).click();
  const handle=page.getByRole('button',{name:'Resize chat',exact:true});
  await expect(handle).toBeVisible();
  const panel=page.locator('[data-alpha-layer=conversation]');
  await expect(panel).toHaveCSS('height','560px');
  let box=(await handle.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2,box.y-200,{steps:12});
  await page.mouse.up();
  await expect(page.getByRole('button',{name:'Shrink chat',exact:true})).toBeVisible();
  await expect(panel).toHaveCSS('height','915px');
  box=(await handle.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2,box.y+220,{steps:12});
  await page.mouse.up();
  await expect(page.getByRole('button',{name:'Expand chat',exact:true})).toBeVisible();
  await expect(panel).toHaveCSS('height','560px');
});


test('standalone views retain an accessible return to apps', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Notes',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Notes',exact:true})).toBeVisible();
  const back=page.getByRole('button',{name:'Back to apps',exact:true});
  await back.focus();
  await back.press('Enter');
  await expect(page.getByRole('button',{name:'Calendar',exact:true})).toBeVisible();
});

test('an open modal owns native Back without leaving the app', async ({page}) => {
  await page.goto('/');
  await page.evaluate(() => {const dialog=document.createElement('dialog');dialog.textContent='Test permission explanation';document.body.append(dialog);dialog.showModal();});
  await expect(page.locator('html')).toHaveAttribute('data-alpha-can-go-back','true');
  await page.evaluate(() => window.dispatchEvent(new Event('alpha-back',{cancelable:true})));
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-alpha-can-go-back','false');
});
