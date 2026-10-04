import {test,expect} from '@playwright/test';

for(const kind of ['document','correction','searchable'] as const)for(const theme of ['light','dark'])test(`${kind} review supports keyboard reading at large text in ${theme}`,async({page})=>{
 await page.setViewportSize({width:740,height:360});await page.goto(`/?theme=${theme}`);
 await expect(page.getByRole('button',{name:'Camera',exact:true})).toBeVisible();
 await page.evaluate(async kind=>{
  document.documentElement.style.setProperty('--browser-text-scale','1.5');
  const canvas=document.createElement('canvas');canvas.width=600;canvas.height=800;canvas.getContext('2d')!.fillRect(10,10,580,780);
  const image=await new Promise<Blob>(resolve=>canvas.toBlob(value=>resolve(value!)));
  if(kind==='document')(await import('/src/prototype/scan-document.ts')).openScanDocument(image);
  else if(kind==='correction')void(await import('/src/prototype/scan-correction-review.ts')).reviewScanCorrection(image,new AbortController().signal);
  else void(await import('/src/prototype/scan-searchable-review.ts')).reviewSearchableScan([image],new AbortController().signal,[[{text:'Reviewed synthetic page',x:.1,y:.1,width:.8,height:.1}]]);
 },kind);
 const dialog=page.locator('dialog[open]'),region=dialog.getByRole('region',{name:'Review details',exact:true});
 await expect(region).toHaveCount(1);
 // Reach the review with Tab, then read past the opening copy without moving a
 // crop handle or changing a text field. Actual keyboard scrolling is required.
 await dialog.locator('h2').evaluate(el=>{(el as HTMLElement).tabIndex=-1;(el as HTMLElement).focus();});
 await page.keyboard.press('Tab');await expect(region).toBeFocused();
 await region.evaluate(el=>{el.scrollTop=0;});await page.keyboard.press('PageDown');
 await expect.poll(()=>region.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 expect(await region.evaluate(el=>el.clientHeight)).toBeGreaterThan(60);
 for(const action of await dialog.locator('.scan-dialog-actions button').all()){
  const box=(await action.boundingBox())!;expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(360);expect(box.height).toBeGreaterThanOrEqual(44);
 }
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});
