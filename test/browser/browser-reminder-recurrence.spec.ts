import {test,expect} from '@playwright/test';
test.use({timezoneId:'Asia/Tokyo'});
test('browser reminder repeats in its saved zone after reload and rejects old decisions',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.clock.setFixedTime(new Date('2027-03-13T00:00Z'));await page.goto('/');await page.getByRole('button',{name:'Calendar',exact:true}).waitFor({state:'visible'});
 await page.evaluate(async()=>{
  const {registerPlugin}=await import('/src/platform-plugins.ts');
  await registerPlugin<any>('DailyApps').scheduleReminder({id:'zoned',title:'New York reminder',at:Date.parse('2027-03-13T07:30Z'),recurrence:{rule:'daily',zone:'America/New_York',date:'2027-03-13',time:'02:30',leadMinutes:0}});
 });
 await page.reload();await page.clock.setFixedTime(new Date('2027-03-13T12:00Z'));
 const first=await page.evaluate(async()=>{
  const {registerPlugin}=await import('/src/platform-plugins.ts');const daily=registerPlugin<any>('DailyApps');
  const row=(await daily.listReminders()).reminders[0];
  const input={id:row.id,occurrenceId:row.occurrenceId,action:'snooze'};
  const snooze=await daily.reminderDecision(input),again=await daily.reminderDecision(input);
  const done=await daily.reminderDecision({...input,action:'done'}),stale=await daily.reminderDecision({...input,action:'done'});
  const next=(await daily.listReminders()).reminders[0];
  return {snooze:snooze.status,again:again.status,done:done.status,stale:stale.status,next};
 });
 expect(first).toMatchObject({snooze:'scheduled',again:'unchanged',done:'scheduled',stale:'stale',next:{at:Date.parse('2027-03-14T07:00Z'),recurrence:{date:'2027-03-14',zone:'America/New_York',time:'02:30'}}});
 expect(first.next).not.toHaveProperty('snoozedAt');expect(first.next).not.toHaveProperty('postedAt');
 await page.reload();await page.clock.setFixedTime(new Date('2027-03-14T12:00Z'));
 const second=await page.evaluate(async()=>{
  const {registerPlugin}=await import('/src/platform-plugins.ts');const daily=registerPlugin<any>('DailyApps');
  const row=(await daily.listReminders()).reminders[0];await daily.reminderDecision({id:row.id,occurrenceId:row.occurrenceId,action:'done'});
  return (await daily.listReminders()).reminders[0];
 });
 expect(second.at).toBe(Date.parse('2027-03-15T06:30Z'));expect(second.history).toHaveLength(2);
 // Select the occurrence's week before mounting the Calendar renderer.
 await page.clock.setFixedTime(new Date('2027-03-15T00:00Z'));await page.reload();
 await page.getByRole('button',{name:'Calendar',exact:true}).click();
 await expect(page.getByText('New York reminder',{exact:true}).first()).toBeVisible();
});
test('invalid recurrence cannot overwrite a saved reminder',async({page})=>{
 await page.clock.setFixedTime(new Date('2027-03-13T00:00Z'));await page.goto('/');await page.getByRole('button',{name:'Calendar',exact:true}).waitFor({state:'visible'});
 const result=await page.evaluate(async()=>{
  const {registerPlugin}=await import('/src/platform-plugins.ts');const daily=registerPlugin<any>('DailyApps');
  await daily.scheduleReminder({id:'same',title:'Original',at:Date.parse('2027-03-15T07:30Z')});
  const before=localStorage.getItem('alpha.browser.reminders.v1');let rejected=false;
  try{await daily.scheduleReminder({id:'same',title:'Invalid replacement',at:Date.parse('2027-03-14T07:30Z'),recurrence:{rule:'daily',zone:'America/New_York',date:'2027-03-14',time:'02:30',leadMinutes:0}});}catch{rejected=true;}
  return {rejected,unchanged:before===localStorage.getItem('alpha.browser.reminders.v1')};
 });expect(result).toEqual({rejected:true,unchanged:true});
});

for(const scenario of ['before-dst','resolved-dst-gap'] as const){
 test(`title-only reminder edit preserves saved zone and occurrence: ${scenario}`,async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
  await page.clock.setFixedTime(new Date('2027-03-13T00:00Z'));await page.goto('/');await page.getByRole('button',{name:'Calendar',exact:true}).waitFor({state:'visible'});
  await page.evaluate(async(scenario)=>{
   const {registerPlugin}=await import('/src/platform-plugins.ts');const daily=registerPlugin<any>('DailyApps');
   await daily.scheduleReminder({id:'edit-zone',title:'Retained zoned reminder',body:'Original details',at:Date.parse(scenario==='before-dst'?'2027-03-13T14:00Z':'2027-03-13T07:30Z'),recurrence:{rule:'daily',zone:'America/New_York',date:'2027-03-13',time:scenario==='before-dst'?'09:00':'02:30',leadMinutes:0}});
   if(scenario==='resolved-dst-gap'){const row=(await daily.listReminders()).reminders[0];await daily.reminderDecision({id:row.id,occurrenceId:row.occurrenceId,action:'done'});}
  },scenario);
  if(scenario==='resolved-dst-gap')await page.clock.setFixedTime(new Date('2027-03-14T00:00Z'));
  await page.reload();
  const original=await page.evaluate(()=>JSON.parse(localStorage.getItem('alpha.browser.reminders.v1')!).reminders[0]);
  await page.getByRole('button',{name:'Calendar',exact:true}).click();
  await page.getByRole('button',{name:/^Retained zoned reminder,/}).click();
  await page.getByRole('button',{name:'Edit event',exact:true}).click();
  await page.getByRole('textbox',{name:'Title',exact:true}).fill('Renamed zoned reminder');
  await page.getByRole('button',{name:'Save event',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save event',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Edit event',exact:true})).toBeVisible();
  const changed=await page.evaluate(()=>JSON.parse(localStorage.getItem('alpha.browser.reminders.v1')!).reminders[0]);
  expect(changed.title).toBe('Renamed zoned reminder');
  for(const key of ['at','dueAt','occurrenceId','recurrence','history','status','snoozedAt'])expect(changed[key],key).toEqual(original[key]);
  await page.reload();await page.getByRole('button',{name:'Calendar',exact:true}).click();
  await page.getByRole('button',{name:/^Renamed zoned reminder,/}).click();
  await page.getByRole('button',{name:'Complete reminder occurrence',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('alpha.browser.reminders.v1')!).reminders[0].occurrenceId)).not.toBe(original.occurrenceId);
  const next=await page.evaluate(()=>JSON.parse(localStorage.getItem('alpha.browser.reminders.v1')!).reminders[0]);
  expect(next.at).toBe(Date.parse(scenario==='before-dst'?'2027-03-14T13:00Z':'2027-03-15T06:30Z'));
  expect(next.recurrence.zone).toBe('America/New_York');expect(next.history).toHaveLength(original.history.length+1);
 });
}

for(const scenario of ['stale','response-loss','pending-response-loss','explicit-time-change'] as const){
 test(`saved reminder edit boundary: ${scenario}`,async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
  await page.clock.setFixedTime(new Date('2027-03-13T00:00Z'));await page.goto('/');await page.getByRole('button',{name:'Calendar',exact:true}).waitFor({state:'visible'});
  await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');await registerPlugin<any>('DailyApps').scheduleReminder({id:'edit-boundary',title:'Boundary reminder',at:Date.parse('2027-03-13T14:00Z'),recurrence:{rule:'daily',zone:'America/New_York',date:'2027-03-13',time:'09:00',leadMinutes:0}});});
  await page.reload();await page.getByRole('button',{name:'Calendar',exact:true}).click();await page.getByRole('button',{name:/^Boundary reminder,/}).click();await page.getByRole('button',{name:'Edit event',exact:true}).click();
  await page.getByRole('textbox',{name:'Title',exact:true}).fill('Edited boundary reminder');
  await page.evaluate(async(scenario)=>{
   const {BrowserDaily}=await import('/src/browser/daily.ts');const original=BrowserDaily.prototype.operateReminder;
   (window as any).reminderMetadataCalls=0;
   BrowserDaily.prototype.operateReminder=async function(input){(window as any).reminderMetadataCalls++;const result=await original.call(this,input);if(scenario==='pending-response-loss')await new Promise<void>((resolve)=>(window as any).releaseReminderSave=resolve);if(scenario==='response-loss'||scenario==='pending-response-loss')throw Error('Synthetic lost committed response');return result;};
   if(scenario==='stale'){const key='alpha.browser.reminders.v1',data=JSON.parse(localStorage.getItem(key)!);data.reminders[0].title='Changed elsewhere';data.reminders[0].revision='d'.repeat(64);localStorage.setItem(key,JSON.stringify(data));}
  },scenario);
  if(scenario==='explicit-time-change')await page.getByRole('button',{name:'Start later',exact:true}).click();
  await page.getByRole('button',{name:'Save event',exact:true}).click();
  if(scenario==='explicit-time-change'){
   await expect(page.getByRole('button',{name:'Save event',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Edit event',exact:true})).toBeVisible();
   const row=await page.evaluate(()=>JSON.parse(localStorage.getItem('alpha.browser.reminders.v1')!).reminders[0]);
   expect(row.at).toBeGreaterThan(Date.parse('2027-03-13T14:00Z'));expect(row.recurrence.zone).toBe('Asia/Tokyo');expect(await page.evaluate(()=>(window as any).reminderMetadataCalls)).toBe(0);return;
  }
  await expect.poll(()=>page.evaluate(()=>(window as any).reminderMetadataCalls)).toBe(1);
  if(scenario==='pending-response-loss'){await expect.poll(()=>page.evaluate(()=>typeof (window as any).releaseReminderSave)).toBe('function');await page.getByRole('button',{name:'Start later',exact:true}).click();await page.evaluate(()=>(window as any).releaseReminderSave());}
  await expect(page.getByText('The reminder save could not be confirmed. Cancel and reopen it to review saved state.',{exact:true})).toBeVisible();
  const retained=await page.evaluate(()=>localStorage.getItem('alpha.browser.reminders.v1'));
  expect(JSON.parse(retained!).reminders[0].title).toBe(scenario==='stale'?'Changed elsewhere':'Edited boundary reminder');
  // An uncertain save must stay blocked even if the user next changes the schedule.
  await page.getByRole('button',{name:'Start later',exact:true}).click();await page.getByRole('button',{name:'Save event',exact:true}).click();
  await expect(page.getByText('The previous save is unconfirmed. Cancel and reopen this reminder to review saved state.',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('alpha.browser.reminders.v1'))).toBe(retained);expect(await page.evaluate(()=>(window as any).reminderMetadataCalls)).toBe(1);
 });
}

test('closing the reminder editor during preparation cancels before mutation dispatch',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.clock.setFixedTime(new Date('2027-03-13T00:00Z'));await page.goto('/');await page.getByRole('button',{name:'Calendar',exact:true}).waitFor({state:'visible'});
 await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');await registerPlugin<any>('DailyApps').scheduleReminder({id:'cancel-before-dispatch',title:'Keep original title',at:Date.parse('2027-03-13T14:00Z')});});
 await page.reload();await page.getByRole('button',{name:'Calendar',exact:true}).click();await page.getByRole('button',{name:/^Keep original title,/}).click();await page.getByRole('button',{name:'Edit event',exact:true}).click();await page.getByRole('textbox',{name:'Title',exact:true}).fill('Cancelled title');
 const before=await page.evaluate(async()=>{const {BrowserDaily}=await import('/src/browser/daily.ts');const operate=BrowserDaily.prototype.operateReminder;(window as any).dispatches=0;BrowserDaily.prototype.operateReminder=async function(input){(window as any).dispatches++;return operate.call(this,input);};const digest=crypto.subtle.digest.bind(crypto.subtle);crypto.subtle.digest=async function(algorithm,data){if(new TextDecoder().decode(data as ArrayBuffer).includes('reminder_update'))await new Promise<void>(resolve=>(window as any).releasePreparation=resolve);return digest(algorithm,data);};return localStorage.getItem('alpha.browser.reminders.v1');});
 await page.getByRole('button',{name:'Save event',exact:true}).click();await expect.poll(()=>page.evaluate(()=>typeof (window as any).releasePreparation)).toBe('function');await page.getByRole('button',{name:'Back to calendar',exact:true}).last().click();await expect(page.getByRole('button',{name:'Save event',exact:true})).toHaveCount(0);await page.evaluate(()=>(window as any).releasePreparation());await page.waitForTimeout(150);
 expect(await page.evaluate(()=>(window as any).dispatches)).toBe(0);expect(await page.evaluate(()=>localStorage.getItem('alpha.browser.reminders.v1'))).toBe(before);
});
