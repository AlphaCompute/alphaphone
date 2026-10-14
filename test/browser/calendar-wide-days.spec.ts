import {test,expect} from '@playwright/test';
test.use({hasTouch:true,isMobile:true,viewport:{width:1280,height:800},timezoneId:'UTC'});

test('Calendar shows adjacent source days without replacing the selected timeline',async({page})=>{
 await page.clock.setFixedTime(new Date('2027-03-13T08:00Z'));
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline',localApps:true})));
 await page.goto('/?mode=dev');
 await page.evaluate(async()=>{
  const {registerPlugin}=await import('/src/platform-plugins.ts');const calendar=registerPlugin<any>('AlphaCalendar');
  for(const [title,begin,end] of [['Previous source','2027-03-12T14:00Z','2027-03-12T15:00Z'],['Current source','2027-03-13T14:00Z','2027-03-13T15:00Z'],['Overnight source','2027-03-13T23:00Z','2027-03-14T01:00Z']]){const creationId=crypto.randomUUID();await calendar.save({creationId,separateCreation:true,calendarId:'local',title,begin:Date.parse(begin),end:Date.parse(end)});await calendar.acknowledgeCreation({creationId});}
 });
 await page.reload();await page.getByRole('button',{name:'Calendar',exact:true}).click();
 const previous=page.locator('[data-alpha-subview="calendar-previous"]'),next=page.locator('[data-alpha-subview="calendar-next"]'),timeline=page.getByRole('region',{name:'Calendar timeline',exact:true});
 await expect(previous).toHaveAttribute('aria-hidden','false');
 await expect(previous.getByRole('button',{name:/^Previous source,/})).toBeVisible();
 await expect(next.getByRole('button',{name:'Overnight source, 12:00 AM',exact:true})).toBeVisible();
 const original=await timeline.elementHandle();
 await timeline.evaluate(el=>el.scrollTop=120);
 await expect(page.locator('[data-alpha-layer="app"]')).toHaveCSS('opacity','1');
 await page.screenshot({animations:'disabled',path:test.info().outputPath('calendar-three-days.png')});
 await page.setViewportSize({width:412,height:915});
 await expect(previous).toHaveAttribute('aria-hidden','true');
 expect(await timeline.evaluate((el,old)=>el===old,original)).toBe(true);
 expect(await timeline.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 await page.setViewportSize({width:1280,height:800});
 await expect(previous).toHaveAttribute('aria-hidden','false');
 await next.getByRole('button',{name:/^Overnight source,/}).click();
 await expect(page.getByRole('heading',{name:'Overnight source',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Back to calendar',exact:true}).click();
 // The selected occurrence remains the next day after opening its adjacent-day segment.
 await expect(page.locator('.calendar-current-heading')).toContainText('Mar 14');
 await page.setViewportSize({width:1280,height:500});
 await expect(previous).toHaveAttribute('aria-hidden','true');
 await expect(timeline).toBeVisible();
 await page.evaluate(async()=>{const {BrowserDevice}=await import('/src/browser/device.ts');await BrowserDevice.prototype.setTextScale({percent:150});});
 const agenda=page.getByRole('region',{name:'Calendar agenda',exact:true});
 await expect(agenda).toBeVisible();await expect(timeline).toBeHidden();
 await expect(agenda.getByRole('button',{name:/^Overnight source,/})).toBeVisible();
 await page.screenshot({animations:'disabled',path:test.info().outputPath('calendar-large-text-agenda.png')});
});
