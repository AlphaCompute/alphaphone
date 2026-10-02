import {test,expect} from '@playwright/test';
test.use({timezoneId:'Asia/Tokyo'});
test('browser reminder repeats in its saved zone after reload and rejects old decisions',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.clock.setFixedTime(new Date('2027-03-13T00:00Z'));await page.goto('/');
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
 await page.clock.setFixedTime(new Date('2027-03-13T00:00Z'));await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {registerPlugin}=await import('/src/platform-plugins.ts');const daily=registerPlugin<any>('DailyApps');
  await daily.scheduleReminder({id:'same',title:'Original',at:Date.parse('2027-03-15T07:30Z')});
  const before=localStorage.getItem('alpha.browser.reminders.v1');let rejected=false;
  try{await daily.scheduleReminder({id:'same',title:'Invalid replacement',at:Date.parse('2027-03-14T07:30Z'),recurrence:{rule:'daily',zone:'America/New_York',date:'2027-03-14',time:'02:30',leadMinutes:0}});}catch{rejected=true;}
  return {rejected,unchanged:before===localStorage.getItem('alpha.browser.reminders.v1')};
 });expect(result).toEqual({rejected:true,unchanged:true});
});
