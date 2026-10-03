import {test,expect} from '@playwright/test';
for(const theme of ['light','dark'])for(const height of [640,360])test(`guest response remains usable with large text: ${theme} ${height}`,async({page},info)=>{
 await page.setViewportSize({width:360,height});await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));await page.goto('/?mode=dev&theme='+theme);
 await page.evaluate(async()=>{const {BrowserDevice}=await import('/src/browser/device.ts');await BrowserDevice.prototype.setTextScale({percent:150});});
 const trigger=page.getByRole('button',{name:'Calendar',exact:true});await trigger.focus();
 await page.evaluate(async()=>{const {editCalendarResponse}=await import('/src/browser/calendar-response.ts');(window as any).responseResult=editCalendarResponse('Alexandra'+ 'Montgomery'.repeat(30),'added',async()=>{throw Error('Could not save this response. Please retry.');});});
 const dialog=page.getByRole('dialog',{name:'Local guest response'}),select=dialog.getByLabel('Guest response',{exact:true});
 await expect(select).toHaveCSS('font-size','24px');await expect(select).toHaveCSS('color-scheme',theme);await expect(select).toHaveCSS('color',theme==='dark'?'rgb(255, 255, 255)':'rgb(0, 0, 0)');
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 for(const name of ['Save response','Cancel']){const button=dialog.getByRole('button',{name,exact:true});await expect(button).toBeInViewport();expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);}
 await select.selectOption('yes');await dialog.getByRole('button',{name:'Save response',exact:true}).click();await expect(dialog.getByRole('status')).toBeInViewport();await expect(select).toHaveValue('yes');await page.screenshot({path:info.outputPath('guest-response.png')});await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(trigger).toBeFocused();expect(await page.evaluate(()=>(window as any).responseResult)).toEqual({status:'cancelled'});
});
