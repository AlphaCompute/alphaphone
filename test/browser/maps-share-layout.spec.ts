import {test,expect} from '@playwright/test';
test.use({viewport:{width:360,height:430}});
for(const theme of ['light','dark'])test(`${theme} Maps share keeps long content and actions usable at large text`,async({page},info)=>{
 await page.goto(`/?mode=dev&theme=${theme}`);
 await page.evaluate(async()=>{
  const {BrowserDevice}=await import('/src/browser/device.ts');await BrowserDevice.prototype.setTextScale({percent:150});
  Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Denied');}}});
  const {shareMap}=await import('/src/maps/share.ts');
  void shareMap({title:'Destination-'+ 'unbroken'.repeat(20),text:'Reviewed route\n'+ 'Turn toward the public square.\n'.repeat(30)},new AbortController().signal);
 });
 const dialog=page.getByRole('dialog',{name:'Share Maps'});
 await expect(dialog).toBeVisible();
 expect(await dialog.evaluate(e=>getComputedStyle(e).fontSize)).toBe('24px');
 expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 for(const action of [dialog.getByRole('button',{name:'Select text'}),dialog.getByRole('link',{name:'Download text'}),dialog.getByRole('button',{name:'Done',exact:true})]){
  const box=await action.boundingBox();expect(box).not.toBeNull();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(360);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(430);
 }
 const region=dialog.getByRole('region',{name:'Map share content'});await region.focus();await page.keyboard.press('End');await expect.poll(()=>region.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
 await dialog.getByRole('button',{name:'Select text'}).click();const field=dialog.getByRole('textbox',{name:'Share text'});expect(await field.evaluate((e:HTMLTextAreaElement)=>e.selectionEnd-e.selectionStart)).toBe((await field.inputValue()).length);
 await page.screenshot({path:info.outputPath('map-share-large-text.png')});
 await dialog.getByRole('button',{name:'Done',exact:true}).click();await expect(dialog).toHaveCount(0);
});
