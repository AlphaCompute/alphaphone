import {test,expect} from '@playwright/test';
for(const theme of ['light','dark'])test(`Inbox reads long inert content without horizontal scrolling: ${theme}`,async({page},info)=>{
 await page.setViewportSize({width:360,height:640});await page.goto(`/?mode=dev&theme=${theme}`);
 await page.evaluate(async()=>{const{BrowserDevice}=await import('/src/browser/device.ts');await BrowserDevice.prototype.setTextScale({percent:150});});
 await page.getByRole('button',{name:'Inbox',exact:true}).click();await page.getByRole('button',{name:'Compose',exact:true}).click();
 const subject='Reference-'+ 'A'.repeat(120),body='First paragraph.\n\nhttps://example.invalid/'+ 'b'.repeat(200)+'\n\n<img src=x onerror="window.mailInjected=true">\nLast paragraph.';
 await page.getByRole('textbox',{name:'To',exact:true}).fill('reader@example.invalid');await page.getByRole('textbox',{name:'To',exact:true}).press('Enter');
 await page.getByRole('textbox',{name:'Subject',exact:true}).fill(subject);await page.getByRole('textbox',{name:'Message',exact:true}).fill(body);
 await page.getByRole('button',{name:'Send email',exact:true}).click();await expect(page.getByText('Sent locally',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Sent',exact:true}).click();await page.getByText(subject,{exact:true}).click();
 const heading=page.getByRole('heading',{name:subject,exact:true});await expect(heading).toBeVisible();
 const container=heading.locator('..');
 expect(await container.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
 const text=page.getByText(body,{exact:true});await expect(text).toHaveText(body);expect(await text.evaluate(el=>getComputedStyle(el).whiteSpace)).toBe('pre-wrap');
 expect(await page.evaluate(()=>(window as any).mailInjected)).toBeUndefined();expect(await container.locator('img').count()).toBe(0);
 await heading.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('long-email-subject.png')});
 await text.evaluate(el=>el.scrollIntoView({block:'end'}));await page.screenshot({path:info.outputPath('long-email-body.png')});
 await page.getByRole('button',{name:'Back to inbox',exact:true}).click();await expect(heading).toHaveCount(0);
});
