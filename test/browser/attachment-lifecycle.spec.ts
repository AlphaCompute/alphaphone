import {test,expect} from '@playwright/test';

test('shell Back releases a reviewed attachment and its object URL',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));await page.goto('/');
 await page.evaluate(async()=>{
  const original=URL.revokeObjectURL;(window as any).attachmentRevocations=[];URL.revokeObjectURL=url=>{(window as any).attachmentRevocations.push(url);original.call(URL,url);};
  const {registerPlugin}=await import('/src/platform-plugins.ts');const files=registerPlugin<any>('AlphaFiles'),mail=registerPlugin<any>('AlphaMailAttachments');const selected=await files.importFile(new File(['Reviewed text'],'review.txt',{type:'text/plain'}));const attachment=await mail.readSelected(selected);await mail.openReviewed({...attachment,reviewed:true});(window as any).attachmentUrl=document.querySelector<HTMLAnchorElement>('[aria-label="Reviewed attachment"] a')!.href;
 });
 await expect(page.getByRole('dialog',{name:'Reviewed attachment'})).toBeVisible();await page.evaluate(()=>window.dispatchEvent(new Event('alpha-back',{cancelable:true})));
 await expect(page.locator('dialog[aria-label="Reviewed attachment"]')).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).attachmentRevocations.filter((url:string)=>url===(window as any).attachmentUrl).length)).toBe(1);
});

test('a late close from a replaced preview cannot retire the new attachment; pagehide releases it',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
  const revoked:string[]=[];const original=URL.revokeObjectURL;URL.revokeObjectURL=url=>{revoked.push(url);original.call(URL,url);};
  const {registerPlugin}=await import('/src/platform-plugins.ts');const files=registerPlugin<any>('AlphaFiles'),mail=registerPlugin<any>('AlphaMailAttachments');const selected=await files.importFile(new File(['Two previews'],'two.txt',{type:'text/plain'}));const attachment=await mail.readSelected(selected);await mail.openReviewed({...attachment,reviewed:true});const old=document.querySelector<HTMLDialogElement>('[aria-label="Reviewed attachment"]')!,oldUrl=old.querySelector('a')!.href;await mail.openReviewed({...attachment,reviewed:true});const current=document.querySelector<HTMLDialogElement>('[aria-label="Reviewed attachment"]')!,currentUrl=current.querySelector('a')!.href;
  old.dispatchEvent(new Event('close'));const retained=current.open&&current.isConnected&&!revoked.includes(currentUrl);window.dispatchEvent(new Event('pagehide'));return {retained,remaining:document.querySelectorAll('[aria-label="Reviewed attachment"]').length,oldRevocations:revoked.filter(value=>value===oldUrl).length,newRevocations:revoked.filter(value=>value===currentUrl).length};
 });expect(result).toEqual({retained:true,remaining:0,oldRevocations:1,newRevocations:1});
});
