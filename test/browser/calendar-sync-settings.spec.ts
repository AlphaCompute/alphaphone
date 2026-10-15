import {test,expect,type Page} from '@playwright/test';
async function fixture(page:Page){
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto('/?mode=dev');
 await page.evaluate(async()=>{
  const {connectionController}=await import('/src/runtime/connection-ui.tsx'),{saveGoogleCalendarSelection}=await import('/src/runtime/google-calendar-selection.ts'),{calendarDocument,initialCalendarState,prepareCalendarSource}=await import('/src/browser/calendar-store.ts');
  const userId='11111111-1111-4111-8111-111111111111',organizationId='22222222-2222-4222-8222-222222222222',grantId='33333333-3333-4333-8333-333333333333';
  const f=(window as any).calendarSyncFixture={writes:0,calls:[],remote:null,lost:false,keys:new Map(),credentialId:'fixture-credential',agentId:'fixture-agent'};
  const snapshot=connectionController.getSnapshot();connectionController.getSnapshot=()=>({...snapshot,session:{agentId:f.agentId,sessionId:'fixture-agent-session'},cloudAccount:{environment:'production',userId,organizationId,sessionId:'fixture-cloud-session',credentialId:f.credentialId}} as any);
  const client={googleCalendarSync:async(input:any)=>{
   f.calls.push(structuredClone(input));const reply=(event:any)=>({version:1,calendarId:'primary',event,providerExactlyOnce:false});
   if(input.kind==='capabilities')return {version:1,calendarId:'primary',accountId:'fixture-google-user',accountEmail:'owner@example.invalid',calendarLabel:'Personal',read:true,write:true,idempotentCreate:true,conditionalWrites:true,providerExactlyOnce:false};
   expectNeverWrongAccount(input.selection);
   if(input.kind==='get')return reply(f.remote&&(input.reference.eventId===f.remote.eventId||input.reference.idempotencyKey==='alpha-calendar-sync:'+f.keySuffix)?f.remote:null);
   if(input.kind==='create'){
    f.writes++;f.keySuffix=input.idempotencyKey.slice('alpha-calendar-sync:'.length);f.remote={eventId:'google-event',etag:'"1"',event:structuredClone(input.event),visibility:'private',remindersDisabled:true};
    if(f.lost){f.lost=false;throw Object.assign(Error('Synthetic lost response'),{status:502,data:{code:'CALENDAR_SYNC_UNAVAILABLE',outcome:'unknown'}});}return reply(f.remote);
   }
   if(input.kind==='update'){if(input.expectedEtag!==f.remote.etag)throw Object.assign(Error('Revision changed'),{status:412,data:{code:'CALENDAR_SYNC_REVISION_CHANGED',outcome:'precondition_failed'}});f.writes++;f.remote={...f.remote,event:structuredClone(input.event),etag:'"next"'};return reply(f.remote);}
   if(input.kind==='delete'){f.writes++;f.remote=null;return {version:1,calendarId:'primary',deleted:true,providerExactlyOnce:false};}
   throw Error('Unexpected operation');
  }};
  function expectNeverWrongAccount(selection:any){if(selection.grantId!==grantId||selection.calendarId!=='primary'||selection.accountId!=='fixture-google-user')throw Error('Wrong Calendar authority');}
  connectionController.getCloudClient=()=>({client,sessionId:'fixture-cloud-session',credentialId:f.credentialId} as any);
  saveGoogleCalendarSelection({environment:'production',userId,organizationId},{connectionId:grantId,sourceId:`google:${grantId}:primary`,providerCalendarId:'primary',name:'Personal',account:'owner@example.invalid'});
  await prepareCalendarSource();await calendarDocument.edit(initialCalendarState,data=>{data.events=[{id:'alpha-event',calendarId:'local',title:'Local appointment',body:'Private details',location:'',begin:Date.parse('2026-10-16'),end:Date.parse('2026-10-17'),allDay:true,revision:'r1',repeat:'weekdays',who:['guest@example.invalid'],attendeeOptions:{'guest@example.invalid':{optional:true}},excluded:[Date.parse('2026-10-20')],alert:10}];});
  const {openCalendarSyncSettings}=await import('/src/runtime/calendar-sync-settings.ts');openCalendarSyncSettings();
 });
 return page.getByRole('dialog',{name:'Google Calendar sync',exact:true});
}
test('Settings reviews the destination before opt-in, then syncs actual local data in both directions',async({page})=>{
 const dialog=await fixture(page);await expect(dialog.getByRole('button',{name:'Enable sync',exact:true})).toBeHidden();
 await dialog.getByRole('button',{name:'Review sync',exact:true}).click();await expect(dialog.getByText(/owner@example.invalid.*Personal.*1 Alpha events/)).toBeVisible();
 expect(await page.evaluate(()=>(window as any).calendarSyncFixture.writes)).toBe(0);
 await dialog.getByRole('button',{name:'Enable sync',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText(/1 sent to Google/);
 expect(await page.evaluate(async()=>{const {calendarSyncHost}=await import('/src/runtime/calendar-sync-host.ts');return [...await calendarSyncHost.linkedProviderEvents()];})).toEqual(['google-event']);
 const remote=await page.evaluate(()=>(window as any).calendarSyncFixture.remote);expect(remote.event.recurrence).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR','EXDATE;VALUE=DATE:20261020']);expect(remote.event.attendees).toEqual([{email:'guest@example.invalid',optional:true}]);
 await page.evaluate(()=>{const f=(window as any).calendarSyncFixture;f.remote.event.title='Changed at Google';f.remote.event.attendees=[{email:'guest@example.invalid',optional:false},{email:'new@example.invalid',optional:true}];f.remote.etag='"2"';});
 await dialog.getByRole('button',{name:'Sync now',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText(/1 received/);
 const local=await page.evaluate(async()=>{const {calendarDocument,initialCalendarState}=await import('/src/browser/calendar-store.ts');return (await calendarDocument.read(initialCalendarState)).events[0];});expect(local.title).toBe('Changed at Google');expect(local.alert).toBe(10);expect(local.repeat).toBe('weekdays');expect(local.attendeeOptions).toEqual({'guest@example.invalid':{optional:false},'new@example.invalid':{optional:true}});
 await page.evaluate(async()=>{const {calendarDocument,initialCalendarState}=await import('/src/browser/calendar-store.ts');await calendarDocument.edit(initialCalendarState,data=>{data.events[0].title='Saved locally again';data.events[0].revision='local-edit';});});await expect.poll(()=>page.evaluate(()=>(window as any).calendarSyncFixture.remote.event.title)).toBe('Saved locally again');
 await dialog.getByRole('button',{name:'Pause sync',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText(/Sync is off/);const writes=await page.evaluate(()=>(window as any).calendarSyncFixture.writes);await expect(dialog.getByRole('button',{name:'Sync now',exact:true})).toBeHidden();await page.evaluate(async()=>{const {calendarSyncHost}=await import('/src/runtime/calendar-sync-host.ts');try{await calendarSyncHost.sync();}catch{}});expect(await page.evaluate(()=>(window as any).calendarSyncFixture.writes)).toBe(writes);
});
test('lost create responses recover from the retained event key without a second provider write',async({page})=>{
 const dialog=await fixture(page);await page.evaluate(()=>(window as any).calendarSyncFixture.lost=true);await dialog.getByRole('button',{name:'Review sync',exact:true}).click();await expect(dialog.getByRole('button',{name:'Enable sync',exact:true})).toBeEnabled();await dialog.getByRole('button',{name:'Enable sync',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText(/unconfirmed changes/);await dialog.getByRole('button',{name:'Sync now',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText(/1 unchanged/);expect(await page.evaluate(()=>(window as any).calendarSyncFixture.writes)).toBe(1);
});
test('unsupported Google recurrence is retained and quarantined without flattening either event',async({page})=>{
 const dialog=await fixture(page);await dialog.getByRole('button',{name:'Review sync',exact:true}).click();await expect(dialog.getByRole('button',{name:'Enable sync',exact:true})).toBeEnabled();await dialog.getByRole('button',{name:'Enable sync',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText(/1 sent to Google/);
 const before=await page.evaluate(async()=>{const {calendarDocument}=await import('/src/browser/calendar-store.ts');const f=(window as any).calendarSyncFixture;f.remote.event.recurrence=['RRULE:FREQ=MONTHLY;BYDAY=1MO;COUNT=10'];f.remote.etag='"2"';return calendarDocument.readRaw();});
 await dialog.getByRole('button',{name:'Sync now',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText(/1 unconfirmed changes/);
 expect(await page.evaluate(async()=>{const {calendarDocument}=await import('/src/browser/calendar-store.ts');return calendarDocument.readRaw();})).toBe(before);expect(await page.evaluate(()=>(window as any).calendarSyncFixture.remote.event.recurrence)).toEqual(['RRULE:FREQ=MONTHLY;BYDAY=1MO;COUNT=10']);expect(await page.evaluate(()=>(window as any).calendarSyncFixture.writes)).toBe(1);
});
for(const change of ['account','agent','revision'] as const)test(`${change} change after review refuses enablement before any provider write`,async({page})=>{
 const dialog=await fixture(page);await dialog.getByRole('button',{name:'Review sync',exact:true}).click();await expect(dialog.getByRole('button',{name:'Enable sync',exact:true})).toBeEnabled();await page.evaluate(async change=>{const f=(window as any).calendarSyncFixture;if(change==='account')f.credentialId='different-session';else if(change==='agent')f.agentId='different-agent';else{const {calendarDocument,initialCalendarState}=await import('/src/browser/calendar-store.ts');await calendarDocument.edit(initialCalendarState,data=>{data.events[0].revision='changed';});}},change);await dialog.getByRole('button',{name:'Enable sync',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText(/changed|review/i);expect(await page.evaluate(()=>(window as any).calendarSyncFixture.writes)).toBe(0);
});

test('Calendar sync is reached through the Settings app',async({page},testInfo)=>{const dialog=await fixture(page);await dialog.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Calendar',exact:true}).click();await page.getByRole('button',{name:'Google Calendar sync',exact:true}).click();await expect(page.getByRole('dialog',{name:'Google Calendar sync',exact:true})).toBeVisible();await page.screenshot({path:testInfo.outputPath('calendar-sync-settings-mobile.png'),animations:'disabled'});expect(await page.evaluate(()=>(window as any).calendarSyncFixture.writes)).toBe(0);});
