import { test, expect } from '@playwright/test';

// Production renderer in a touch viewport. This does not qualify Android rotation or TalkBack.
test.use({ hasTouch: true, isMobile: true, viewport: { width: 915, height: 412 } });
test.beforeEach(({}, info) => test.skip(info.project.name !== 'production', 'Production bundle only'));

test('Notes keeps a readable column and preserves the same draft, caret and scroll through resizing', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('alpha.connection.selection.v1', JSON.stringify({ kind: 'offline', localApps: true })));
  await page.goto('/');
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: 'New note', exact: true }).click();
  const title = page.getByRole('textbox', { name: 'Title', exact: true });
  const body = page.getByRole('textbox', { name: 'Note', exact: true });
  const draft = Array.from({ length: 100 }, (_, i) => `Line ${i}: A note that stays on this phone while its window changes.`).join('\n');
  await title.fill('Keep my place');
  await body.fill(draft);
  const original = await body.elementHandle();
  await body.evaluate((element: HTMLTextAreaElement) => { element.focus(); element.setSelectionRange(900, 950); element.scrollTop = 100; });
  const landscape = await body.boundingBox();
  const titleBox = await title.boundingBox();
  expect(landscape!.width).toBeLessThanOrEqual(721);
  expect(landscape!.width).toBeGreaterThan(650);
  expect(Math.abs(landscape!.x - titleBox!.x)).toBeLessThan(1);
  expect(Math.abs(landscape!.width - titleBox!.width)).toBeLessThan(1);
  await expect(page.locator('.note-editor')).toHaveCSS('opacity', '1');
  await page.screenshot({ animations: 'disabled', path: test.info().outputPath('notes-wide.png') });

  for (const viewport of [{ width: 412, height: 915 }, { width: 915, height: 412 }]) {
    await page.setViewportSize(viewport);
    await expect(body).toHaveValue(draft);
    await expect(title).toHaveValue('Keep my place');
    expect(await body.evaluate((element, previous) => element === previous, original)).toBe(true);
    expect(await body.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd])).toEqual([900, 950]);
    const bounds = await body.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(Math.min(721, viewport.width - 47));
    expect(bounds!.x).toBeGreaterThanOrEqual(23);
    // Resizing must keep the owner's existing scroll position, not return to the first line.
    expect(await body.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  }
  await page.getByRole('button', { name: 'Back to notes', exact: true }).click();
  await page.getByRole('button', { name: 'Open Keep my place', exact: true }).click();
  await expect(body).toHaveValue(draft);
  await page.getByRole('button', { name: 'Turn into checklist', exact: true }).click();
  const checklist = page.locator('.note-checklist-column');
  await expect(checklist).toBeVisible();
  expect((await checklist.boundingBox())!.width).toBeLessThanOrEqual(745);
  await page.setViewportSize({ width: 412, height: 915 });
  expect((await checklist.boundingBox())!.width).toBeLessThanOrEqual(413);
  await page.getByRole('button', { name: 'Turn into text', exact: true }).click();
  await expect(body).toHaveValue(draft);
});

test('wide Notes exposes the source list beside the same editor and narrows without losing edits', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('alpha.connection.selection.v1', JSON.stringify({ kind: 'offline', localApps: true })));
  await page.goto('/');
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: 'New note', exact: true }).click();
  const title=page.getByRole('textbox',{name:'Title',exact:true});
  const body=page.getByRole('textbox',{name:'Note',exact:true});
  await title.fill('First source'); await body.fill('First source text');
  await page.getByRole('button',{name:'Back to notes',exact:true}).click();
  await page.getByRole('button',{name:'New note',exact:true}).click();
  await title.fill('Second source'); await body.fill('Keep this edited source selected');
  await body.evaluate((element:HTMLTextAreaElement)=>{element.focus();element.setSelectionRange(5,9);});
  const original=await body.elementHandle();
  const list=page.locator('[data-alpha-subview="notes-list"]');
  for(const viewport of [{width:1280,height:800},{width:412,height:915},{width:1100,height:700}]){
    await page.setViewportSize(viewport);
    await expect(list).toHaveAttribute('aria-hidden',viewport.width>=1000?'false':'true');
    await expect(body).toHaveValue('Keep this edited source selected');
    expect(await body.evaluate((element,previous)=>element===previous,original)).toBe(true);
    expect(await body.evaluate((element:HTMLTextAreaElement)=>[element.selectionStart,element.selectionEnd])).toEqual([5,9]);
    await expect(body).toBeFocused();
    if(viewport.width>=1000){
      const source=page.getByRole('button',{name:'Open First source',exact:true});
      await expect(source).toBeVisible();
      await expect.poll(async()=>{const left=await list.boundingBox(),right=await body.boundingBox();return left!.x+left!.width<=right!.x;}).toBe(true);
      await page.screenshot({animations:'disabled',path:test.info().outputPath(`notes-split-${viewport.width}.png`)});
    }
  }
  await page.getByRole('button',{name:'Open First source',exact:true}).click();
  await expect(body).toHaveValue('First source text');
  await expect(page.getByRole('button',{name:'Open First source',exact:true})).toHaveAttribute('aria-current','true');
  await page.getByRole('button',{name:'Open Second source',exact:true}).click();
  await expect(body).toHaveValue('Keep this edited source selected');
  await page.getByRole('button',{name:'Open First source',exact:true}).focus();
  await page.setViewportSize({width:412,height:915});
  await expect(page.getByRole('button',{name:'Back to notes',exact:true})).toBeFocused();
});
