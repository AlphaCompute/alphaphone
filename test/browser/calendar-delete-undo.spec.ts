// Browser Calendar policy P-30 (issue #414): a reviewed deletion waits ten seconds with a durable
// Undo before the app calendar changes. Browser build only; Android CalendarProvider is not used.
import {test,expect,type Page} from '@playwright/test';
const button=(page:Page,name:string)=>page.getByRole('button',{name,exact:true});
const titles=(page:Page)=>page.evaluate(async()=>(JSON.parse((await (await import('/src/browser/calendar-store.ts')).calendarDocument.readRaw())||'{"events":[]}').events as {title:string}[]).map(row=>row.title).sort());
const pending=(page:Page)=>page.evaluate(async()=>(await (await import('/src/runtime/pending-deletions.ts')).pendingDeletions((await import('/src/runtime/pending-deletion-store.ts')).pendingDeletionStore)).map(r=>r.phase));
async function create(page:Page,title:string){
 await button(page,'New event').click();await page.getByRole('textbox',{name:'Title',exact:true}).fill(title);
 await button(page,'Save event').click();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
}
async function reviewDelete(page:Page){
 const review=page.getByRole('dialog',{name:'Delete calendar event?'});
 await button(page,'Delete event').click();await review.getByRole('button',{name:'Delete event',exact:true}).click();
}
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{if(!localStorage.getItem('alpha.connection.selection.v1'))localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));});
 await page.goto('/?mode=dev&tools=1');await button(page,'Calendar').click();
});

test('Undo inside the window keeps the event untouched',async({page})=>{
 await create(page,'Undo me');const before=await page.evaluate(async()=>(await (await import('/src/browser/calendar-store.ts')).calendarDocument.readRaw()));
 await reviewDelete(page);
 await expect(page.getByText('Event “Undo me” will be deleted',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/^Undo me,/})).toHaveCount(0);
 await button(page,'Undo').click();
 await expect(page.getByText('Event kept. Nothing was deleted.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/^Undo me,/})).toBeVisible();
 expect(await pending(page)).toEqual([]);
 const after=JSON.parse((await page.evaluate(async()=>(await (await import('/src/browser/calendar-store.ts')).calendarDocument.readRaw())))!);
 expect(after.events).toEqual(JSON.parse(before!).events);expect(after.deletionGrants||{}).toEqual({});
});

test('a reload inside the window keeps the intent and its Undo; expiry after the reload deletes once',async({page})=>{
 await create(page,'Survives reload');await button(page,'Back to calendar').click();await create(page,'Committed after restart');
 await reviewDelete(page);
 await page.reload();await expect(page.getByText('Event “Committed after restart” will be deleted',{exact:true})).toBeVisible();
 expect(await pending(page)).toEqual(['pending']);
 expect(await titles(page)).toEqual(['Committed after restart','Survives reload']);
 await expect.poll(()=>titles(page),{timeout:20_000}).toEqual(['Survives reload']);
 expect(await pending(page)).toEqual([]);
});

test('an edit during the window keeps the event and says so',async({page})=>{
 await create(page,'Edited during undo');await reviewDelete(page);
 await page.evaluate(async()=>{const {calendarDocument}=await import('/src/browser/calendar-store.ts');await calendarDocument.edit(()=>({sourceRevision:'',events:[]}) as any,(data:any)=>{data.events[0].title='Edited elsewhere';data.events[0].revision='other-window';});});
 await expect(page.getByText('Edited during undo changed after you deleted it, so it was kept. Review it and delete again if needed.',{exact:true})).toBeVisible({timeout:20_000});
 expect(await titles(page)).toEqual(['Edited elsewhere']);expect(await pending(page)).toEqual([]);
});

test('a deleted repeating series is reviewed once and held for Undo',async({page})=>{
 const id=await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');const cal=registerPlugin<any>('AlphaCalendar');const start=Date.now()+86400000;const result=await cal.save({creationId:crypto.randomUUID(),separateCreation:true,calendarId:'local',title:'Daily standup',body:'',location:'',begin:start,end:start+900000,timeZone:'UTC',repeat:'daily'});await cal.open({id:result.id});return result.id;});
 expect(id).toBeTruthy();
 await button(page,'Delete series').click();
 const review=page.getByRole('dialog',{name:'Delete repeating series'});
 await expect(review).toContainText('Delete every occurrence, including edited dates? You can undo for 10 seconds.');
 await review.getByRole('button',{name:'Confirm',exact:true}).click();
 await expect(page.getByText('Event “Daily standup” will be deleted',{exact:true})).toBeVisible();
 expect(await titles(page)).toEqual(['Daily standup']);
 await expect.poll(()=>titles(page),{timeout:20_000}).toEqual([]);
});

test('an event moved to another calendar during the window is kept, not reported as deleted',async({page})=>{
 await create(page,'Moved during undo');await reviewDelete(page);
 await page.evaluate(async()=>{const {calendarDocument}=await import('/src/browser/calendar-store.ts');await calendarDocument.edit(()=>({sourceRevision:'',events:[]}) as any,(data:any)=>{data.events[0].calendarId='elsewhere';});});
 await expect(page.getByText('Moved during undo changed after you deleted it, so it was kept. Review it and delete again if needed.',{exact:true})).toBeVisible({timeout:20_000});
 expect(await titles(page)).toEqual(['Moved during undo']);expect(await pending(page)).toEqual([]);
});

test('an unconfirmed deletion is shown again with Check again and Keep, and Keep stops tracking it',async({page})=>{
 test.setTimeout(90_000);
 await create(page,'Unconfirmed delete');
 // The provider loses the result of the commit and cannot read the event back.
 await page.evaluate(async()=>{const {BrowserCalendar}=await import('/src/browser/calendar.ts');(window as any).readbackUnavailable=true;
  BrowserCalendar.prototype.commitDeletion=async function(){throw Error('provider result lost');};
  const readback=BrowserCalendar.prototype.deletionReadback;BrowserCalendar.prototype.deletionReadback=async function(input:any){return (window as any).readbackUnavailable?{status:'unavailable'}:readback.call(this,input);};});
 await reviewDelete(page);
 await expect(page.getByText('Unconfirmed delete: deletion could not be confirmed. It is shown again if it still exists; use Check again or Keep in Calendar.',{exact:true})).toBeVisible({timeout:20_000});
 await expect(page.getByRole('status').filter({hasText:'Deletion of “Unconfirmed delete” is unconfirmed. It is shown if it still exists.'})).toBeVisible();
 expect(await pending(page)).toEqual(['unknown']);
 await expect(page.getByRole('button',{name:/^Unconfirmed delete,/})).toBeVisible();
 await page.evaluate(()=>{(window as any).readbackUnavailable=false;});
 await button(page,'Check deletion of Unconfirmed delete again').click();
 await expect(page.getByText('Unconfirmed delete: the deletion did not happen, so it is still there. Delete it again if you still want it gone.',{exact:true})).toBeVisible();
 expect(await pending(page)).toEqual([]);
 await page.evaluate(()=>{(window as any).readbackUnavailable=true;});
 await page.getByRole('button',{name:/^Unconfirmed delete,/}).click();
 await reviewDelete(page);
 await expect(page.getByRole('status').filter({hasText:'Deletion of “Unconfirmed delete” is unconfirmed. It is shown if it still exists.'})).toBeVisible({timeout:20_000});
 await button(page,'Keep Unconfirmed delete and stop checking').click();
 await expect(page.getByText('Kept. Nothing more will be deleted for it.',{exact:true})).toBeVisible();
 await expect(page.getByRole('status').filter({hasText:'is unconfirmed'})).toHaveCount(0);
 expect(await pending(page)).toEqual([]);expect(await titles(page)).toEqual(['Unconfirmed delete']);
});
