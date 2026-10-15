import type {Page} from '@playwright/test';
/** Account-local copies are normal entries in Drafts, separate from Gmail drafts. */
export async function localDraftRow(page:Page,name:string|RegExp=/^Local draft,/){
 await page.getByRole('combobox',{name:'Other mail folders',exact:true}).selectOption('drafts');
 return page.getByRole('button',{name}).first();
}
