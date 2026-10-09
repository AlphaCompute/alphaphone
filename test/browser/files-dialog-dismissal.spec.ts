import {test,expect} from '@playwright/test';
for(const theme of ['light','dark'])test(`${theme} file rename and delete dialogs restore their opener and preserve the file`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto(`/?mode=dev&theme=${theme}`);
 await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');await registerPlugin<any>('AlphaFiles').importFile(new File(['Retained contents'],'keep.txt',{type:'text/plain'}));});
 await page.getByRole('button',{name:'Files',exact:true}).click();await page.getByText('App files',{exact:true}).first().click();await page.getByRole('button',{name:'Open keep.txt',exact:true}).click();
 const remove=page.getByRole('button',{name:'Delete file',exact:true});await remove.click();
 const dialog=page.getByRole('dialog',{name:'Permanently delete?',exact:true});
 await expect(dialog.getByRole('button',{name:'Cancel file operation',exact:true})).toBeFocused();
 const dock=await page.locator('[data-alpha-layer="pill"]').boundingBox(),confirm=await dialog.getByRole('button',{name:'Delete permanently',exact:true}).boundingBox();
 expect(confirm!.y+confirm!.height).toBeLessThan(dock!.y);
 await page.screenshot({path:test.info().outputPath('delete-review.png'),animations:'disabled'});
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(remove).toBeFocused();
 const rename=page.getByRole('button',{name:'Rename',exact:true});await rename.click();
 const name=page.getByRole('textbox',{name:'Folder or file name',exact:true});await expect(name).toBeFocused();await name.fill('Unapproved.txt');
 await page.evaluate(()=>window.dispatchEvent(new Event('alpha-back')));await expect(name).toHaveCount(0);await expect(rename).toBeFocused();
 await remove.click();await page.evaluate(()=>window.dispatchEvent(new Event('launcher-home')));await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'Files',exact:true})).toBeVisible();
 expect(await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');return (await registerPlugin<any>('AlphaFiles').list({})).entries.map((row:any)=>row.name);})).toEqual(['keep.txt']);
});
