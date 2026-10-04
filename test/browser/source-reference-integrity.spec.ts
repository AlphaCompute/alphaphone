import {test,expect} from '@playwright/test';
test('durable library references reject changed stored bytes after the picker capability is released',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
  const{registerPlugin}=await import('/src/platform-plugins.ts');const files=registerPlugin<any>('AlphaFiles'),attachments=registerPlugin<any>('AlphaMailAttachments');const selected=await files.importFile(new File(['Original document'],'original.txt',{type:'text/plain'}));const checked=await attachments.readSelected(selected),{reference}=await attachments.retainSourceReference({...selected,sha256:checked.sha256});await files.forgetSelected(selected);
  await new Promise<void>((resolve,reject)=>{const open=indexedDB.open('alpha.browser.files.v1');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('entries','readwrite'),store=tx.objectStore('entries'),all=store.getAll();all.onsuccess=()=>{const row=all.result.find((r:any)=>r.name==='original.txt');row.bytes=new TextEncoder().encode('Modified document').buffer;row.size=row.bytes.byteLength;store.put(row);};tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};};});
  let error='';try{await attachments.openSourceReference({reference,sha256:checked.sha256,size:checked.size,mimeType:checked.mimeType});}catch(e){error=(e as Error).message;}
  return {reference,error};
 });expect(result.reference).toMatch(/^b1:[a-f0-9-]{36}$/);expect(result.error).toContain('Source changed');await expect(page.getByRole('dialog',{name:'Reviewed attachment'})).toHaveCount(0);
});
