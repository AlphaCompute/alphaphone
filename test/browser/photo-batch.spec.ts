import {execFileSync} from 'node:child_process';
import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));await page.goto('/');
 await page.evaluate(async()=>{const {importBrowserPhoto}=await import('/src/prototype/browser-camera.ts');const canvas=document.createElement('canvas');canvas.width=16;canvas.height=12;for(let i=0;i<3;i++){const ctx=canvas.getContext('2d')!;ctx.fillStyle=['red','green','blue'][i];ctx.fillRect(0,0,16,12);const image=canvas.toDataURL('image/jpeg');await importBrowserPhoto({original:new File([],'source.jpg'),image,width:16,height:12},new AbortController().signal);}});
});
test('visible batch favorite, trash, undo and download journey persists exact selected items',async({page})=>{
 await page.getByRole('button',{name:'Photos',exact:true}).click();
 const tiles=page.locator('button[data-owned-media-id^="native-camera-"]');await expect(tiles).toHaveCount(3);
 const select=async()=>{await page.getByRole('button',{name:'Select photos',exact:true}).click();await tiles.nth(0).click();await tiles.nth(1).click();};
 await select();await page.getByRole('button',{name:'Favorite selected',exact:true}).click();await expect(page.getByText('2 favorited',{exact:true})).toBeVisible();
 await select();const selectedIds=await tiles.evaluateAll(nodes=>nodes.slice(0,2).map(n=>n.getAttribute('data-owned-media-id')!.replace(/^native-camera-/,'')));const expected=await page.evaluate(async(ids)=>{const {browserPhotoLibrary:p}=await import('/src/prototype/browser-camera.ts');return Promise.all(ids.map(async id=>{const row=await p.read({id});const bytes=await (await fetch(row.image)).arrayBuffer();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');}));},selectedIds);expect(new Set(expected).size).toBe(2);const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Share selected',exact:true}).click();await expect(page.getByText('2 items in Alpha photos.zip.',{exact:true})).toBeVisible();const download=await downloading;expect(download.suggestedFilename()).toBe('Alpha photos.zip');const path=await download.path();const entries=JSON.parse(execFileSync('python3',['-c','import zipfile,json,sys,hashlib; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps({n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist()}))',path!],{encoding:'utf8'}));expect(entries).toEqual({'Alpha-photo-1.jpg':expected[0],'Alpha-photo-2.jpg':expected[1]});
 await page.getByRole('button',{name:'Delete selected',exact:true}).click();await expect(tiles).toHaveCount(1);await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(tiles).toHaveCount(3);
 await page.reload();const result=await page.evaluate(async()=>{const {browserPhotoLibrary:p}=await import('/src/prototype/browser-camera.ts');return {summary:await p.summary(),count:(await p.list()).items.length};});expect(result).toMatchObject({summary:{favorites:2,trash:0},count:3});
});
test('invalid and duplicate batch requests cannot restore trashed media; stale items report conflicts',async({page})=>{
 const result=await page.evaluate(async()=>{
  const {browserPhotoLibrary:p}=await import('/src/prototype/browser-camera.ts');const rows=(await p.list()).items,items=rows.map(r=>({id:r.id,revision:r.mutationRevision}));await p.setTrashed({...items[0],trashed:true});let rejected=0;
  for(const request of [{operation:'typo',items},{operation:'restore',items:[items[1],items[1]]},{operation:'restore',items:[]},{operation:'restore',items:Array.from({length:21},(_,i)=>({id:String(i),revision:'x'}))}])try{await p.changeMany(request as any);}catch{rejected++;}
  const receipt=await p.changeMany({operation:'favorite',items});const valid=receipt.outcomes.filter(r=>r.item).map(r=>({id:r.id,revision:r.item!.mutationRevision}));const unchanged=await p.changeMany({operation:'favorite',items:valid});return {rejected,trash:(await p.summary()).trash,status:receipt.outcomes.map(r=>r.status),unchanged:unchanged.outcomes.map(r=>r.status),same:unchanged.outcomes.every((r,i)=>r.item!.mutationRevision===valid[i].revision)};
 });expect(result).toEqual({rejected:4,trash:1,status:['conflict','updated','updated'],unchanged:['unchanged','unchanged'],same:true});
});
test('a storage abort rolls back the entire batch and returns no success receipt',async({page})=>{
 const result=await page.evaluate(async()=>{
  const {browserPhotoLibrary:p}=await import('/src/prototype/browser-camera.ts');const items=(await p.list()).items.map(r=>({id:r.id,revision:r.mutationRevision}));const original=IDBObjectStore.prototype.put;let calls=0;IDBObjectStore.prototype.put=function(...args){const request=original.apply(this,args);if(++calls===2)this.transaction.abort();return request;};let rejected=false;
  try{await p.changeMany({operation:'favorite',items});}catch{rejected=true;}finally{IDBObjectStore.prototype.put=original;}return {rejected,favorites:(await p.summary()).favorites};
 });expect(result).toEqual({rejected:true,favorites:0});
});
test('a stale share selection requests no downloads, including its valid items',async({page})=>{
 const downloads:string[]=[];page.on('download',download=>downloads.push(download.suggestedFilename()));
 const rejected=await page.evaluate(async()=>{const {browserPhotoLibrary:p}=await import('/src/prototype/browser-camera.ts');const items=(await p.list()).items.map(r=>({id:r.id,revision:r.mutationRevision}));await p.setFavorite({...items[1],favorite:true});try{await p.shareMany({items});return false;}catch{return true;}});expect(rejected).toBe(true);expect(downloads).toEqual([]);
});
test('batch controls remain reachable above the assistant pill in compact light and dark layouts',async({page},info)=>{
 await page.setViewportSize({width:360,height:640});
 for(const theme of ['light','dark']){
  await page.goto('/?theme='+theme);await page.getByRole('button',{name:'Photos',exact:true}).click();await page.getByRole('button',{name:'Select photos',exact:true}).click();await page.locator('button[data-owned-media-id^="native-camera-"]').first().click();
  await page.screenshot({path:info.outputPath('batch-'+theme+'.png')});await page.getByRole('button',{name:'Favorite selected',exact:true}).click();await expect(page.getByText('1 favorited',{exact:true})).toBeVisible();
 }
});
