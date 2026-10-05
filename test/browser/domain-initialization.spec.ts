import {test,expect} from '@playwright/test';

test('concurrent legacy imports write once and leave the recovery capture usable',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {BrowserDomainDocument}=await import('/src/browser/domain-document.ts');
  const {browserDocuments}=await import('/src/browser/documents.ts');
  const key='alpha.test.concurrent-import',legacy='  { "count" : 7 }\n';
  localStorage.setItem(key,legacy);
  const domain=new BrowserDomainDocument(browserDocuments,key,()=>localStorage.getItem(key));
  const put=IDBObjectStore.prototype.put;let writes=0;
  IDBObjectStore.prototype.put=function(value,key){if(key==='alpha.test.concurrent-import')writes++;return put.call(this,value,key);};
  try{
   const reads=await Promise.all(Array.from({length:20},()=>domain.read(()=>({count:0}))));
   const importedWrites=writes,capture=await domain.capture();
   await Promise.all(Array.from({length:20},()=>domain.read(()=>({count:0}))));
   const later=await domain.capture();
   await domain.reset(capture);
   return {reads,importedWrites,later,capture,reset:await domain.read(()=>({count:0})),legacy:localStorage.getItem(key)};
  }finally{IDBObjectStore.prototype.put=put;}
 });
 expect(result.reads).toEqual(Array.from({length:20},()=>({count:7})));
 expect(result.importedWrites).toBe(1);expect(result.later).toEqual(result.capture);
 expect(result.reset).toEqual({count:0});expect(result.legacy).toBe('  { "count" : 7 }\n');
});
