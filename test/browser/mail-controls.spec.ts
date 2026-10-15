import {test,expect} from '@playwright/test';
test('compact assistant controls keep dictation inside the expanded composer',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));await page.goto('/');
 await page.getByRole('button',{name:'Notes',exact:true}).click();
 const pill=page.locator('[data-alpha-layer="pill"]');await expect(pill).toBeVisible();
 await expect(pill.getByRole('button')).toHaveCount(3);await expect(pill.getByRole('button',{name:'Transcribe',exact:true})).toHaveCount(0);
 await pill.getByRole('button',{name:'Type',exact:true}).click();
 const dictate=page.getByRole('button',{name:'Transcribe',exact:true});await expect(dictate).toBeVisible();await expect(dictate).toHaveAttribute('title','Transcribe into draft');
 expect(await dictate.locator('span').getAttribute('style')).toContain('/icons/lucide/audio-lines.svg');
});
test('More has a consistent chevron and Drafts is available without provider drafts',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));await page.goto('/');
 await page.evaluate(async()=>{
  const {connectionController:c}=await import('/src/runtime/connection-ui.tsx');
  const client={gmailAccounts:async()=>[{connectionId:'controls-grant',label:'owner@example.test',connected:true,grantedCapabilities:['google.gmail.triage']}],gmailSearch:async()=>({messages:[],syncedAt:'sync',nextPageToken:null}),gmailInboxCapabilities:async()=>({from:'owner@example.test',send:false,readState:false})};
  c.getCloudClient=()=>({client,sessionId:'controls-session',credentialId:'fixture'} as any);const snapshot={...c.getSnapshot(),cloudAccount:{environment:'production',userId:'controls-owner',sessionId:'controls-session',credentialId:'fixture'}} as any;c.getSnapshot=()=>snapshot;
 });
 await page.getByRole('button',{name:'Inbox',exact:true}).click();const folders=page.getByRole('combobox',{name:'Other mail folders',exact:true});await expect(folders).toBeVisible();
 const metrics=await folders.evaluate(el=>({appearance:getComputedStyle(el).appearance,height:el.getBoundingClientRect().height,paddingRight:parseFloat(getComputedStyle(el).paddingRight)}));
 expect(metrics.appearance).toBe('none');expect(metrics.paddingRight).toBe(36);
 // Chromium layout transforms can introduce subpixel floating-point rounding.
 expect(metrics.height).toBeCloseTo(44,4);
 expect(await folders.evaluate(el=>el.getBoundingClientRect().right<=document.querySelector('[data-screen]')!.getBoundingClientRect().right-8)).toBe(true);
 await folders.selectOption('drafts');await expect(page.getByRole('heading',{name:'Drafts',exact:true})).toBeVisible();await expect(page.getByText('Drafts on this device',{exact:true})).toBeVisible();
});
