import {test,expect} from '@playwright/test';
const backup={events:[{id:'saved',calendarId:'local',revision:'saved-revision',title:'Restored appointment',body:'Bring notes',location:'Library',begin:1800000000000,end:1800003600000,timeZone:'UTC',repeat:'weekly',alert:5}]};
test.beforeEach(async({page})=>{await page.addInitScript(()=>{localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));if(!sessionStorage.getItem('restore-seeded')){localStorage.setItem('alpha.browser.calendar.v1','damaged original');sessionStorage.setItem('restore-seeded','1');}});await page.goto('/');});
async function open(page:any){await page.getByRole('button',{name:'Device controls',exact:true}).click();await page.getByRole('button',{name:'Calendar recovery',exact:true}).click();const d=page.getByRole('dialog',{name:'Browser calendar recovery'});await expect(d.getByRole('button',{name:'Download calendar backup',exact:true})).toBeEnabled();return d;}
async function choose(d:any,value:unknown){await d.getByLabel('Choose calendar backup',{exact:true}).setInputFiles({name:'calendar.txt',mimeType:'text/plain',buffer:Buffer.from(JSON.stringify(value))});}
async function raw(page:any){return page.evaluate(async()=>(await import('/src/browser/calendar-store.ts')).calendarDocument.readRaw());}
test('file selection and review do not write; confirmation restores events without replaying alerts',async({page},info)=>{
 const d=await open(page);await choose(d,backup);await expect(d.getByText('1 event record(s) in this backup.',{exact:false})).toBeVisible();expect(await raw(page)).toBe('damaged original');
 await d.getByRole('button',{name:'Review calendar restore',exact:true}).click();expect(await raw(page)).toBe('damaged original');await expect(d.getByText('No invitations are sent;', {exact:false})).toBeVisible();await page.screenshot({path:info.outputPath('calendar-restore-review.png')});
 await d.getByRole('button',{name:'Confirm calendar restore',exact:true}).click();await expect(d).toHaveCount(0);const state=JSON.parse(await raw(page));expect(state.events).toHaveLength(1);expect(state.events[0].title).toBe('Restored appointment');expect(state.events[0].id).not.toBe('saved');expect(state.events[0].alert).toBeNull();expect(await page.evaluate(()=>localStorage.getItem('alpha.browser.calendar.v1'))).toBe('damaged original');
 await page.reload();expect(JSON.parse(await raw(page)).events[0].title).toBe('Restored appointment');await page.getByRole('button',{name:'Open your calendar',exact:true}).click();await page.getByRole('button',{name:'Calendar backups',exact:true}).click();await expect(page.getByRole('dialog',{name:'Browser calendar recovery'})).toBeVisible();
});
test('unsupported backup is visible and leaves original data intact',async({page})=>{
 const d=await open(page);await choose(d,{events:[{...backup.events[0],timeZone:'Not/AZone'}]});await expect(d.getByText('This is not a supported calendar backup. No events were changed.')).toBeVisible();await expect(d.getByRole('button',{name:'Review calendar restore',exact:true})).toBeDisabled();expect(await raw(page)).toBe('damaged original');
});
test('a newer document prevents an old restore approval from replacing it',async({page})=>{
 const d=await open(page);await choose(d,backup);await d.getByRole('button',{name:'Review calendar restore',exact:true}).click();
 await page.evaluate(async()=>{const {calendarDocument}=await import('/src/browser/calendar-store.ts');await calendarDocument.restore(await calendarDocument.capture(),JSON.stringify({sourceRevision:'newer',events:[]}));});
 await d.getByRole('button',{name:'Confirm calendar restore',exact:true}).click();await expect(d.getByRole('button',{name:'Review calendar restore',exact:true})).toBeEnabled();expect(JSON.parse(await raw(page)).sourceRevision).toBe('newer');
});

test('closing recovery while a transaction holds storage cancels the queued restore',async({page})=>{
 const d=await open(page);await choose(d,backup);
 await page.evaluate(async()=>{
  const database=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('alpha.browser.documents.v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const transaction=database.transaction('documents','readwrite'),store=transaction.objectStore('documents');let holding=true;
  (window as any).releaseRecovery=()=>{holding=false;};
  (window as any).recoveryLock=new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>{database.close();resolve();};transaction.onabort=()=>{database.close();reject(transaction.error);};});
  const keepAlive=()=>{const request=store.get('calendar-recovery-transaction');request.onsuccess=()=>{(window as any).recoveryEntered=true;if(holding)keepAlive();};};keepAlive();
 });
 await expect.poll(()=>page.evaluate(()=>(window as any).recoveryEntered)).toBe(true);
 await d.getByRole('button',{name:'Review calendar restore',exact:true}).click();await d.getByRole('button',{name:'Confirm calendar restore',exact:true}).click();await expect(d.getByRole('button',{name:'Confirm calendar restore'})).toBeDisabled();await d.getByRole('button',{name:'Close recovery',exact:true}).click();
 await page.evaluate(async()=>{(window as any).releaseRecovery();await (window as any).recoveryLock;});
 expect(await page.evaluate(async()=>(await import('/src/browser/calendar-store.ts')).calendarDocument.readRaw())).toBe('damaged original');
});
