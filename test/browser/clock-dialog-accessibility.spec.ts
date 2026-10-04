import {test,expect} from '@playwright/test';
for(const theme of ['light','dark'])test(`${theme} Clock review owns focus and leaves no hidden modal on Home`,async({page})=>{
 await page.goto(`/?mode=mock&theme=${theme}`);
 await page.getByRole('button',{name:'Calendar',exact:true}).click();
 const opener=page.getByRole('button',{name:'Clock alarms',exact:true});await opener.click();
 const dialog=page.getByRole('dialog',{name:'Clock alarms',exact:true});
 await expect(dialog.getByRole('button',{name:'Close Clock',exact:true})).toBeFocused();
 await expect(page.getByRole('button',{name:'New event',exact:true})).toHaveCount(0);
 await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'Review Clock request',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
 await opener.click();await dialog.getByRole('button',{name:'Review Clock request',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Confirm Clock request',exact:true})).toBeVisible();
 // Mock mode has no resident-agent native event bridge; exercise the shell Home handler.
 await page.locator('button[aria-label="Home"]').dispatchEvent('click');
 await expect(dialog).toHaveCount(0);await page.getByRole('button',{name:'Calendar',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 await opener.click();await expect(dialog.getByRole('button',{name:'Confirm Clock request',exact:true})).toHaveCount(0);
 await page.evaluate(()=>window.dispatchEvent(new Event('alpha-back')));await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
});
