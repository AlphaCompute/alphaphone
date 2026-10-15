import type {Page} from '@playwright/test';
export async function openScanDraftOptions(page:Page){
 const options=page.getByRole('dialog',{name:'Review scan document',exact:true}).locator('.scan-draft-options');
 if(await options.getAttribute('open')===null)await options.locator('summary').click();
}
