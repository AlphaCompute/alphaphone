import {test,expect} from '@playwright/test';
import {holdCalendarTransactions} from './calendar-read-fixture';
test('agent cancellation while storage read is queued cannot open a late review',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto('/?mode=dev');
 await page.evaluate(async()=>{const {BrowserCalendar}=await import('/src/browser/calendar.ts');const calendar=new BrowserCalendar();(window as any).queuedCalendar=calendar;(window as any).queuedSource=await calendar.prepareAgentSource();});
 await page.evaluate(holdCalendarTransactions);
 await page.evaluate(async()=>{const calendar=(window as any).queuedCalendar,source=(window as any).queuedSource,id=crypto.randomUUID();(window as any).queuedOperation=calendar.executeAgent({operationId:id,operation:{type:'calendar_create',source:{sourceId:source.sourceId,sourceRevision:source.sourceRevision},fields:{title:'Cancelled before read',description:'',location:'',start:new Date(Date.now()+60000).toISOString(),end:new Date(Date.now()+120000).toISOString(),timeZone:'UTC'}}}).then(result=>(window as any).queuedOutcome=result);await calendar.cancelAgent({operationId:id});(window as any).releaseCalendarTransactions();await (window as any).calendarTransactionsHeld;});
 await expect.poll(()=>page.evaluate(()=>(window as any).queuedOutcome)).toEqual({status:'cancelled'});
 await expect(page.getByRole('dialog',{name:'Review calendar change'})).toHaveCount(0);
 expect(await page.evaluate(async()=>{const {calendarDocument}=await import('/src/browser/calendar-store.ts');return (await calendarDocument.read(()=>({events:[]}))).events;})).toEqual([]);
});
test('backgrounding while an event read is queued cannot open a late editor',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto('/?mode=dev');
 await page.evaluate(async()=>{const {BrowserCalendar}=await import('/src/browser/calendar.ts');const calendar=new BrowserCalendar();await calendar.save({creationId:crypto.randomUUID(),calendarId:'local',title:'Retired editor',begin:Date.now()+60000,end:Date.now()+120000});const {calendarDocument}=await import('/src/browser/calendar-store.ts');(window as any).queuedCalendar=calendar;(window as any).queuedRow=(await calendarDocument.read(()=>({events:[]}))).events[0];});
 await page.evaluate(holdCalendarTransactions);
 await page.evaluate(async()=>{const row=(window as any).queuedRow;(window as any).queuedEditor=(window as any).queuedCalendar.edit({id:row.id,revision:row.revision}).then(result=>(window as any).queuedEditorOutcome=result);window.dispatchEvent(new Event('alpha:device-state'));(window as any).releaseCalendarTransactions();await (window as any).calendarTransactionsHeld;});
 await expect.poll(()=>page.evaluate(()=>(window as any).queuedEditorOutcome)).toEqual({status:'cancelled'});
 await expect(page.getByRole('dialog',{name:'Edit calendar event'})).toHaveCount(0);
});
for(const kind of ['event','response'] as const)test(`${kind} dismissal aborts a write before its transaction commits`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto('/?mode=dev');
 const before=await page.evaluate(async kind=>{const {BrowserCalendar}=await import('/src/browser/calendar.ts');const calendar=new BrowserCalendar();await calendar.save({creationId:crypto.randomUUID(),calendarId:'local',title:'Original',begin:Date.now()+60000,end:Date.now()+120000,who:['maya']});const {calendarDocument}=await import('/src/browser/calendar-store.ts');const calendarSnapshot=()=>calendarDocument.capture();const snapshot=await calendarSnapshot(),row=JSON.parse(snapshot.raw!).events[0];(window as any).dismissedEdit=kind==='event'?calendar.edit({id:row.id,revision:row.revision}):calendar.editResponse({id:row.id,revision:row.revision,person:'maya',name:'Maya'});return snapshot.raw;},kind);
 const dialog=page.getByRole('dialog',{name:kind==='event'?'Edit calendar event':'Local guest response'});
 if(kind==='event')await dialog.getByLabel('Event title',{exact:true}).fill('Must roll back');else await dialog.getByLabel('Guest response',{exact:true}).selectOption('yes');
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){const request=put.call(this,value,key);if(key==='alpha.browser.calendar.v1'){IDBObjectStore.prototype.put=put;this.transaction.addEventListener('abort',()=>(window as any).editAbortObserved=true);const cancel=[...document.querySelectorAll<HTMLButtonElement>('dialog button')].find(button=>button.textContent==='Cancel');if(!cancel)throw Error('No owned editor cancel action');cancel.click();}return request;};});
 await dialog.getByRole('button',{name:kind==='event'?'Save event':'Save response',exact:true}).click();
 await expect(dialog).toHaveCount(0);expect(await page.evaluate(()=>(window as any).dismissedEdit)).toEqual({status:'cancelled'});
 await expect.poll(()=>page.evaluate(()=>(window as any).editAbortObserved)).toBe(true);
 expect(await page.evaluate(async()=>await (await import('/src/browser/calendar-store.ts')).calendarDocument.readRaw())).toBe(before);
});
test('Calendar reads retain the current receipt instead of invalidating reset review',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto('/?mode=dev');
 const result=await page.evaluate(async()=>{const {BrowserCalendar}=await import('/src/browser/calendar.ts');const {calendarDocument}=await import('/src/browser/calendar-store.ts');const calendarSnapshot=()=>calendarDocument.capture();const calendar=new BrowserCalendar();await calendar.prepareAgentSource();const before=await calendarSnapshot();await Promise.all([calendar.prepareAgentSource(),calendar.pendingCreations(),calendar.list({begin:Date.now(),end:Date.now()+86400000}),calendar.listAlerts()]);return {before,after:await calendarSnapshot()};});
 expect(result.after).toEqual(result.before);
});
for(const kind of ['response','series-edit','series-delete','meeting','open'] as const)test(`Home during queued ${kind} read prevents late presentation`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto('/?mode=dev');
 await page.evaluate(async()=>{const {BrowserCalendar}=await import('/src/browser/calendar.ts');const calendar=new BrowserCalendar(),begin=Date.now()+60000;await calendar.save({creationId:crypto.randomUUID(),calendarId:'local',title:'Retired presentation',begin,end:begin+60000,repeat:'daily',who:['maya'],video:true});(window as any).queuedCalendar=calendar;(window as any).queuedRow=(await calendar.list({begin,end:begin+86400000})).events[0];});
 await page.evaluate(holdCalendarTransactions);
 await page.evaluate(async kind=>{const calendar=(window as any).queuedCalendar,row=(window as any).queuedRow,input={id:row.id,revision:row.revision};const pending=kind==='response'?calendar.editResponse({...input,person:'maya',name:'Maya'}):kind==='series-edit'?calendar.editSeries(input):kind==='series-delete'?calendar.removeSeries(input):kind==='meeting'?calendar.joinMeeting(input):calendar.open({id:row.id});(window as any).presentationOutcome=pending;window.dispatchEvent(new Event('launcher-home'));(window as any).releaseCalendarTransactions();await (window as any).calendarTransactionsHeld;},kind);
 expect(await page.evaluate(()=>(window as any).presentationOutcome)).toEqual({status:'cancelled'});
 await expect(page.getByRole('dialog')).toHaveCount(0);
});
