import {test,expect} from '@playwright/test';
// P-25: Alpha has no app-data backup, import or restore. Damaged-calendar recovery keeps only an
// exact-byte copy of the unreadable data and a confirmed reset; Settings offers no backup control.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));if(!sessionStorage.getItem('restore-seeded')){localStorage.setItem('alpha.browser.calendar.v1','damaged original');sessionStorage.setItem('restore-seeded','1');}});await page.goto('/?tools=1');});
test('damaged calendar recovery offers no backup file import or restore',async({page})=>{
 await page.getByRole('button',{name:'Device controls',exact:true}).click();await page.getByRole('button',{name:'Calendar recovery',exact:true}).click();
 const d=page.getByRole('dialog',{name:'App calendar recovery'});await expect(d.getByRole('button',{name:'Download calendar backup',exact:true})).toBeEnabled();
 await expect(d.getByText('they cannot be restored into Alpha',{exact:false})).toBeVisible();
 await expect(d.getByLabel('Choose calendar backup',{exact:true})).toHaveCount(0);
 await expect(d.getByRole('button',{name:'Review calendar restore',exact:true})).toHaveCount(0);
 await expect(d.locator('input[type=file]')).toHaveCount(0);
 await expect(d.getByRole('button',{name:'Reset app calendar',exact:true})).toBeEnabled();
 expect(await page.evaluate(async()=>{const {calendarDocument}=await import('/src/browser/calendar-store.ts');return 'restore' in calendarDocument;})).toBe(false);
});
test('Settings Calendar has no backup control on the web build',async({page})=>{
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Calendar',exact:true}).click();
 await expect(page.getByText('Calendars shown in Alpha',{exact:true})).toBeVisible();
 await expect(page.getByText('Calendar backups',{exact:true})).toHaveCount(0);
});
