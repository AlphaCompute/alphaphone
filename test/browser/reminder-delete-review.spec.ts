// Browser reminders: one review step, a ten-second durable Undo with the alert paused, then a
// single journaled cancellation (policy P-30, issue #414). Browser build only; the Android
// receiver hold and provider are covered by source/contract tests, not by this spec.
import {test,expect,type Page} from '@playwright/test';
test.use({timezoneId:'UTC'});
const start=Date.parse('2027-03-13T00:00Z');
const store=(page:Page)=>page.evaluate(async()=>JSON.parse((await (await import('/src/browser/reminder-store.ts')).reminderDocument.readRaw())!));
const pending=(page:Page)=>page.evaluate(async()=>(await (await import('/src/runtime/pending-deletions.ts')).pendingDeletions((await import('/src/runtime/pending-deletion-store.ts')).pendingDeletionStore)).map(r=>({phase:r.phase,reminderId:(r.target as any).target.reminderId})));
/** Move the page clock past the Undo window and run the same commit the expiry timer runs. */
async function expire(page:Page,offset=11_000){await page.clock.setFixedTime(new Date(start+offset));await page.evaluate(async()=>(await import('/src/runtime/deletion-undo.ts')).deletionUndo().commitDue());}
async function open(page:Page,at='2027-03-13T14:00Z'){
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.clock.setFixedTime(new Date(start));await page.goto('/');await page.getByRole('button',{name:'Calendar',exact:true}).waitFor();
 await page.evaluate(async at=>{const {registerPlugin}=await import('/src/platform-plugins.ts');await registerPlugin<any>('DailyApps').scheduleReminder({id:'delete-boundary',title:'Delete boundary reminder',at:Date.parse(at)});},at);
 await page.reload();await page.getByRole('button',{name:'Calendar',exact:true}).click();await page.getByRole('button',{name:/^Delete boundary reminder,/}).click();
}
async function review(page:Page,accept=true){
 const shown:string[]=[];page.once('dialog',dialog=>{shown.push(dialog.message());void (accept?dialog.accept():dialog.dismiss());});
 await page.getByRole('button',{name:'Delete event',exact:true}).click();
 await expect.poll(()=>shown.length).toBe(1);return shown[0];
}

test('Cancel in the review deletes nothing',async({page})=>{
 await open(page);
 expect(await review(page,false)).toContain('You can undo for 10 seconds');
 expect(await pending(page)).toEqual([]);expect((await store(page)).reminders[0].status).toBe('scheduled');
});

test('Undo inside the window is lossless and resumes the alert',async({page})=>{
 await open(page);await review(page);
 await expect(page.getByText('Reminder “Delete boundary reminder” will be deleted',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/^Delete boundary reminder,/})).toHaveCount(0);
 expect(await pending(page)).toEqual([{phase:'pending',reminderId:'delete-boundary'}]);
 expect((await store(page)).deliveryHolds).toEqual({'delete-boundary':expect.any(String)});
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(page.getByText('Reminder kept. Nothing was deleted.',{exact:true})).toBeVisible();
 const data=await store(page);
 expect(data.reminders[0].status).toBe('scheduled');expect(data.deliveryHolds).toBeUndefined();expect(data.receipts||{}).toEqual({});
 expect(await pending(page)).toEqual([]);
});

test('a reminder due during the window is not delivered; reload restores the Undo offer',async({page})=>{
 await open(page,'2027-03-13T00:00:05Z');await review(page);
 await page.clock.setFixedTime(new Date(start+6000));
 await page.reload();await page.getByRole('button',{name:'Calendar',exact:true}).click();
 await expect(page.getByText('Reminder “Delete boundary reminder” will be deleted',{exact:true})).toBeVisible();
 await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');await registerPlugin<any>('DailyApps').listReminders();});
 expect((await store(page)).reminders[0].status).toBe('scheduled');
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect.poll(async()=>(await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');return (await registerPlugin<any>('DailyApps').listReminders()).reminders[0].status;}))).toBe('posted');
});

test('expiry cancels once, reads back and is not repeated after reload',async({page})=>{
 await open(page);
 await page.evaluate(()=>{(window as any).dispatches=0;});
 await page.evaluate(async()=>{const {BrowserDaily}=await import('/src/browser/daily.ts');const operate=BrowserDaily.prototype.operateReminder;BrowserDaily.prototype.operateReminder=async function(input){(window as any).dispatches++;return operate.call(this,input);};});
 await review(page);await expire(page);
 await expect(page.getByText('Delete boundary reminder: reminder deleted and confirmed.',{exact:true})).toBeVisible();
 expect((await store(page)).reminders[0].status).toBe('cancelled');expect(await pending(page)).toEqual([]);
 expect(await page.evaluate(()=>(window as any).dispatches)).toBe(1);
 await page.reload();await page.getByRole('button',{name:'Calendar',exact:true}).click();
 expect(Object.keys((await store(page)).receipts)).toHaveLength(1);
});

test('a reminder changed during the window is kept and its alert resumes',async({page})=>{
 await open(page);await review(page);
 await page.evaluate(async()=>{await (await import('/src/browser/reminder-store.ts')).reminderDocument.edit(()=>({reminders:[] as any[]}),data=>{data.reminders[0].title='Changed elsewhere';data.reminders[0].revision='b'.repeat(64);});});
 await expire(page);
 await expect(page.getByText('Delete boundary reminder changed after you deleted it, so it was kept. Review it and delete again if needed.',{exact:true})).toBeVisible();
 const data=await store(page);expect(data.reminders[0].status).toBe('scheduled');expect(data.deliveryHolds).toBeUndefined();
 await expect(page.getByRole('button',{name:/^Changed elsewhere,/})).toBeVisible();
});

test('a lost cancellation response with no readback stays hidden and is resolved after reload, not redispatched',async({page})=>{
 await open(page);
 await page.evaluate(async()=>{(window as any).dispatches=0;const {BrowserDaily}=await import('/src/browser/daily.ts');const operate=BrowserDaily.prototype.operateReminder;BrowserDaily.prototype.operateReminder=async function(input){(window as any).dispatches++;await operate.call(this,input);throw Error('Lost response');};BrowserDaily.prototype.reminderOperationReceipt=async function(){throw Error('Receipt unavailable');};});
 await review(page);await expire(page);
 await expect.poll(()=>pending(page)).toEqual([{phase:'unknown',reminderId:'delete-boundary'}]);
 await page.reload();await page.getByRole('button',{name:'Calendar',exact:true}).click();
 await expect.poll(()=>pending(page)).toEqual([]);
 expect((await store(page)).reminders[0].status).toBe('cancelled');expect(Object.keys((await store(page)).receipts)).toHaveLength(1);
 await expect(page.getByRole('button',{name:/^Delete boundary reminder,/})).toHaveCount(0);
});

test('a reminder changed before review is not offered for deletion',async({page})=>{
 await open(page);
 await page.evaluate(async()=>{await (await import('/src/browser/reminder-store.ts')).reminderDocument.edit(()=>({reminders:[] as any[]}),data=>{data.reminders[0].title='Concurrent replacement';data.reminders[0].revision='a'.repeat(64);});});
 await page.getByRole('button',{name:'Delete event',exact:true}).click();
 await expect(page.getByText('This reminder changed. Review it again before deleting.',{exact:true})).toBeVisible();
 expect(await pending(page)).toEqual([]);
});

test('ID-only cancellation stays refused',async({page})=>{
 await open(page);
 expect(await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');try{await registerPlugin<any>('DailyApps').cancelReminder({id:'delete-boundary'});return false;}catch{return true;}})).toBe(true);
});
