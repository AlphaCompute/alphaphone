import {test,expect} from '@playwright/test';
for(const theme of ['light','dark'])test(`calendar draft retains reachable fields and actions at large text: ${theme}`,async({page},info)=>{
 await page.setViewportSize({width:360,height:430});
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto('/?mode=dev&theme='+theme);
 await page.evaluate(async()=>{const {BrowserDevice}=await import('/src/browser/device.ts');await BrowserDevice.prototype.setTextScale({percent:150});});await page.reload();
 await page.getByRole('button',{name:'Calendar',exact:true}).click();await page.getByRole('button',{name:'New event',exact:true}).click();
 const save=page.getByRole('button',{name:'Save event',exact:true});expect((await save.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 const fields=page.getByRole('region',{name:'Event details',exact:true});await expect(fields).toBeVisible();await fields.focus();await page.keyboard.press('End');
 const notes=page.getByRole('textbox',{name:'Notes',exact:true});await notes.fill('First paragraph\n\nLong reference '+'abc'.repeat(80));await notes.scrollIntoViewIfNeeded();await expect(notes).toBeInViewport();
 expect(await fields.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
 for(const name of ['In this browser','Once','None','Add people','Video link']){const button=fields.getByRole('button',{name,exact:true});await button.scrollIntoViewIfNeeded();await expect(button).toBeInViewport();const box=(await button.boundingBox())!;expect(box.height).toBeGreaterThanOrEqual(44);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(360);}
 await notes.scrollIntoViewIfNeeded();const notesBox=(await notes.boundingBox())!,dockBox=(await page.locator('[data-alpha-layer="pill"]').boundingBox())!;expect(notesBox.y+notesBox.height).toBeLessThanOrEqual(dockBox.y);await page.screenshot({path:info.outputPath('draft-notes.png'),animations:'disabled'});await expect(save).toBeInViewport();await page.getByRole('button',{name:'Back to calendar',exact:true}).click();await expect(fields).toHaveCount(0);
});
