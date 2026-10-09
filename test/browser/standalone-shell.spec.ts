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


test('standalone Home scrolls to the screen edge without a simulated status-bar gap',async({page},testInfo)=>{
  await page.setViewportSize({width:412,height:640});
  await page.goto('/');
  const home=page.locator('[data-alpha-layer="home"]'),screen=page.locator('[data-screen="1"]');
  await expect(page.getByRole('button',{name:'Calendar',exact:true})).toBeVisible();
  const bounds=await home.boundingBox(),usable=await screen.boundingBox();
  expect(bounds!.y).toBeCloseTo(usable!.y,1);
  expect(bounds!.height).toBeCloseTo(usable!.height,1);
  const tile=await home.getByRole('button').first().boundingBox();
  expect(tile!.y-bounds!.y).toBeLessThan(16);
  await home.evaluate(node=>{node.scrollTop=80;});
  expect((await home.boundingBox())!.y).toBeCloseTo(usable!.y,1);
  await page.screenshot({path:testInfo.outputPath('home-scrolled-fullscreen.png')});
});

for(const view of ['Files','Notes','Calendar','Workflows','Inbox','Browser','Photos','Maps','Camera','Settings'])test(`standalone ${view} reuses one compact header and retains return to apps`,async({page})=>{
 await page.setViewportSize({width:360,height:740});await page.goto('/');await page.getByRole('button',{name:view,exact:true}).click();
 const app=page.locator('[data-alpha-layer="app"]'),back=page.getByRole('button',{name:'Back to apps',exact:true});await expect(back).toHaveCount(1);await expect(back).toBeVisible();const header=back.locator('xpath=ancestor::*[@data-alpha-app-header][1]');await expect(header).toHaveAttribute('data-alpha-app-header','main');expect(await header.evaluate(el=>getComputedStyle(el).marginTop)).toBe('0px');expect(await header.evaluate(el=>getComputedStyle(el).height)).toBe('52px');const target=(await back.boundingBox())!;expect(target.width).toBeGreaterThanOrEqual(44);expect(target.height).toBeGreaterThanOrEqual(44);expect(await header.evaluate(el=>getComputedStyle(el).maskImage)).toBe('none');expect(await header.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);await back.click();await expect(page.getByRole('button',{name:'Notes',exact:true})).toBeVisible();
});

for(const theme of ['light','dark'])for(const view of ['Files','Notes'])test(`${view} content edges fade without duplicating or fading its header: ${theme}`,async({page},info)=>{
 await page.setViewportSize({width:360,height:600});await page.goto('/?theme='+theme);
 if(view==='Notes')await page.evaluate(async()=>{const {openBrowserNotes}=await import('/src/runtime/browser-notes-document.ts');const store=await openBrowserNotes();await store.replace(Array.from({length:12},(_,n)=>({id:`scroll-${n}`,kind:'text',title:`Scroll note ${n}`,body:'Readable body\n'.repeat(8)})));});
 await page.getByRole('button',{name:view,exact:true}).click();const scroll=page.locator(`[data-alpha-app-scroll="${view.toLowerCase()}"]`),back=page.getByRole('button',{name:'Back to apps',exact:true}),header=back.locator('xpath=ancestor::*[@data-alpha-app-header][1]');await expect(scroll).toBeVisible();await scroll.evaluate(el=>el.scrollTop=0);await expect.poll(()=>scroll.evaluate(el=>parseFloat(getComputedStyle(el).getPropertyValue('--calendar-scroll-fade-top')))).toBe(0);await page.screenshot({path:info.outputPath('content-start.png'),animations:'disabled'});
 expect(await scroll.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeGreaterThan(24);await scroll.evaluate(el=>el.scrollTop=60);await expect.poll(()=>scroll.evaluate(el=>parseFloat(getComputedStyle(el).getPropertyValue('--calendar-scroll-fade-top')))).toBeGreaterThan(0);expect(await header.evaluate(el=>getComputedStyle(el).maskImage)).toBe('none');await expect(back).toBeInViewport();await page.screenshot({path:info.outputPath('content-scrolled.png'),animations:'disabled'});await scroll.evaluate(el=>el.scrollTop=el.scrollHeight);await expect.poll(()=>scroll.evaluate(el=>parseFloat(getComputedStyle(el).getPropertyValue('--calendar-scroll-fade-bottom')))).toBe(0);
});

test('standalone Calendar draft keeps its own Back and Save row; launcher headers retain their system inset',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Calendar',exact:true}).click();await page.getByRole('button',{name:'New event',exact:true}).click();await expect(page.getByRole('button',{name:'Back to apps',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Back to calendar',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Save event',exact:true})).toBeVisible();await page.getByRole('button',{name:'Back to calendar',exact:true}).click();await expect(page.getByRole('button',{name:'Back to apps',exact:true})).toBeVisible();await page.goto('/?shell=launcher');await page.getByRole('button',{name:'Files',exact:true}).click();await expect(page.getByRole('button',{name:'Back to apps',exact:true})).toHaveCount(0);expect(await page.locator('[data-alpha-app-header="main"]').evaluate(el=>getComputedStyle(el).marginTop)).toBe('44px');
});

for(const viewport of [{width:412,height:915},{width:1440,height:500}])test(`Files compact row remains aligned at ${viewport.width}x${viewport.height}`,async({page},info)=>{
 await page.setViewportSize(viewport);await page.goto('/');await page.getByRole('button',{name:'Files',exact:true}).click();const back=page.getByRole('button',{name:'Back to apps',exact:true}),title=page.getByRole('heading',{name:'Files',exact:true}),search=page.getByRole('button',{name:'Search files',exact:true});const a=(await back.boundingBox())!,b=(await title.boundingBox())!,c=(await search.boundingBox())!;expect(Math.abs(a.y+a.height/2-b.y-b.height/2)).toBeLessThanOrEqual(1);expect(Math.abs(a.y+a.height/2-c.y-c.height/2)).toBeLessThanOrEqual(1);expect(c.height).toBeGreaterThanOrEqual(44);expect(await title.evaluate(el=>getComputedStyle(el).fontSize)).toBe('20px');await page.screenshot({path:info.outputPath('files-compact-row.png'),animations:'disabled'});
});
