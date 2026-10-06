import {test,expect} from '@playwright/test';
for(const theme of ['light','dark']){
 test(`Inbox subviews retire covered controls and return focus: ${theme}`,async({page})=>{
  await page.goto(`/?mode=dev&theme=${theme}`);
  await page.getByRole('button',{name:'Inbox',exact:true}).click();
  const compose=page.getByRole('button',{name:'Compose',exact:true});await compose.click();
  await expect(page.getByRole('button',{name:'Back from draft',exact:true})).toBeFocused();
  await expect(compose).toHaveCount(0);
  await expect(page.locator('[data-alpha-subview="inbox-list"]')).toHaveAttribute('inert','');
  await page.getByRole('textbox',{name:'Subject',exact:true}).fill('Retained focus draft');
  await page.getByRole('button',{name:'Back from draft',exact:true}).click();
  await expect(compose).toBeFocused();await expect(compose).toBeEnabled();
  await page.goto(`/?mode=mock&theme=${theme}&start=inbox:mail`);
  await expect(page.getByRole('button',{name:'Back to inbox',exact:true})).toBeFocused();
  await expect(page.getByRole('button',{name:'Compose',exact:true})).toHaveCount(0);
  await expect(page.locator('[data-alpha-subview="inbox-list"]')).toHaveAttribute('aria-hidden','true');
 });
 for(const sub of ['flow','run','new'])test(`Workflow ${sub} exposes only the active subview: ${theme}`,async({page},info)=>{
  await page.goto(`/?mode=mock&theme=${theme}&start=workflows:${sub}`);
  const active=page.locator(`[data-alpha-subview="workflows-${sub==='flow'?'detail':sub==='run'?'runOpen':'builder'}"]`);
  await expect(active).toBeVisible();await expect(active.getByRole('button').first()).toBeFocused();
  const list=page.locator('[data-alpha-subview="workflows-list"]');await expect(list).toHaveAttribute('inert','');
  await expect(page.getByRole('heading',{name:'Workflows',exact:true})).toHaveCount(0);
  if(sub==='run')await expect(page.locator('[data-alpha-subview="workflows-detail"]')).toHaveAttribute('inert','');
  for(let i=0;i<12;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('[inert]'))).toBe(false);}
  await page.screenshot({path:info.outputPath('active-subview.png')});
  await active.getByRole('button').first().click();await expect(active).toHaveCount(0);
 });
}
