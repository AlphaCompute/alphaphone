import {test,expect} from '@playwright/test';
test.use({hasTouch:true,isMobile:true,viewport:{width:1280,height:800}});

test('Inbox keeps the mail source beside the reader, with drafts and reviews covering both',async({page})=>{
 await page.goto('/?mode=mock&start=inbox:mail');
 const list=page.locator('[data-alpha-subview="inbox-list"]'),detail=page.locator('[data-alpha-subview="inbox-detail"]');
 await expect(list).toHaveAttribute('aria-hidden','false');
 const reader=await detail.elementHandle();
 await expect.poll(async()=>{const a=await list.boundingBox(),b=await detail.boundingBox();return a!.x+a!.width<=b!.x;}).toBe(true);
 await page.setViewportSize({width:412,height:915});
 await expect(list).toHaveAttribute('aria-hidden','true');
 expect(await detail.evaluate((el,old)=>el===old,reader)).toBe(true);
 await page.setViewportSize({width:1280,height:800});
 await expect(list).toHaveAttribute('aria-hidden','false');
 await page.screenshot({animations:'disabled',path:test.info().outputPath('inbox-split.png')});
 await page.getByRole('button',{name:'Reply',exact:true}).click();
 await expect(list).toHaveAttribute('aria-hidden','true');
 const draft=page.getByRole('region',{name:'Email draft fields',exact:true}).getByRole('textbox').last();
 await draft.fill('Do not lose this draft while changing layout.');
 await page.setViewportSize({width:412,height:915});
 await expect(draft).toHaveValue('Do not lose this draft while changing layout.');
 await page.setViewportSize({width:1280,height:800});
 await expect(draft).toHaveValue('Do not lose this draft while changing layout.');
 await expect(list).toHaveAttribute('inert','');
});

test('Files keeps folder entries beside the same selected preview and restores narrow focus',async({page})=>{
 await page.goto('/?mode=dev');
 await page.evaluate(async()=>{const{registerPlugin}=await import('/src/platform-plugins.ts');await registerPlugin<any>('AlphaFiles').importFile(new File(['A retained selected document.'],'panes.txt',{type:'text/plain'}));});
 await page.getByRole('button',{name:'Files',exact:true}).click();
 await page.getByRole('button',{name:'App files',exact:true}).last().click();
 const root=page.locator('[data-alpha-subview="files-list"]'),folder=page.locator('[data-alpha-subview="files-folder"]');
 await expect(root).toHaveAttribute('aria-hidden','false');
 await page.getByRole('button',{name:'Open panes.txt',exact:true}).click();
 const preview=page.locator('[data-alpha-subview="files-preview"]'),original=await preview.elementHandle();
 await expect(folder).toHaveAttribute('aria-hidden','false');
 await expect(root).toHaveAttribute('aria-hidden','true');
 await expect.poll(async()=>{const a=await folder.boundingBox(),b=await preview.boundingBox();return a!.x+a!.width<=b!.x;}).toBe(true);
 await page.screenshot({animations:'disabled',path:test.info().outputPath('files-split.png')});
 await page.getByRole('button',{name:'Open panes.txt',exact:true}).focus();
 await page.setViewportSize({width:412,height:915});
 await expect(folder).toHaveAttribute('aria-hidden','true');
 await expect(page.getByRole('button',{name:'Back',exact:true})).toBeFocused();
 expect(await preview.evaluate((el,old)=>el===old,original)).toBe(true);
 await page.setViewportSize({width:1280,height:800});
 await expect(folder).toHaveAttribute('aria-hidden','false');
 expect(await preview.evaluate((el,old)=>el===old,original)).toBe(true);
});
