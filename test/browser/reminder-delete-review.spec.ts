import {test,expect} from '@playwright/test';
test.use({timezoneId:'UTC'});
for(const mode of ['fresh','stale','response-loss','receipt-loss','navigate','legacy','late-stale','reload-loss'])test(`reviewed reminder deletion ${mode}`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.clock.setFixedTime(new Date('2027-03-13T00:00Z'));await page.goto('/');await page.getByRole('button',{name:'Calendar',exact:true}).waitFor();
 await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');await registerPlugin<any>('DailyApps').scheduleReminder({id:'delete-boundary',title:'Delete boundary reminder',at:Date.parse('2027-03-13T14:00Z')});});
 await page.reload();await page.getByRole('button',{name:'Calendar',exact:true}).click();await page.getByRole('button',{name:/^Delete boundary reminder,/}).click();
 await page.evaluate(async mode=>{
  const {BrowserDaily}=await import('/src/browser/daily.ts');const operation=BrowserDaily.prototype.operateReminder,receipt=BrowserDaily.prototype.reminderOperationReceipt;(window as any).deletes=0;(window as any).receipts=0;
  BrowserDaily.prototype.operateReminder=async function(input){(window as any).deletes++;if(mode==='late-stale'){await (await import('/src/browser/reminder-store.ts')).reminderDocument.edit(()=>({reminders:[] as any[]}),data=>{data.reminders[0].title='Changed during dispatch';data.reminders[0].revision='b'.repeat(64);});}const out=await operation.call(this,input);if(mode==='response-loss'||mode==='receipt-loss'||mode==='reload-loss')throw Error('Lost response');return out;};
  BrowserDaily.prototype.reminderOperationReceipt=async function(input){(window as any).receipts++;if(mode==='reload-loss'||mode==='receipt-loss'&&(window as any).receipts===1)throw Error('Temporary receipt failure');return receipt.call(this,input);};
  if(mode==='stale'){await (await import('/src/browser/reminder-store.ts')).reminderDocument.edit(()=>({reminders:[] as any[]}),data=>{data.reminders[0].title='Concurrent replacement';data.reminders[0].revision='a'.repeat(64);});}
  if(mode==='navigate'){const digest=crypto.subtle.digest.bind(crypto.subtle);crypto.subtle.digest=async function(a,b){if(new TextDecoder().decode(b as ArrayBuffer).includes('reminder_cancel'))await new Promise<void>(r=>(window as any).releaseDelete=r);return digest(a,b);};}
 },mode);
 if(mode==='legacy'){expect(await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');try{await registerPlugin<any>('DailyApps').cancelReminder({id:'delete-boundary'});return false;}catch{return true;}})).toBe(true);return;}
 await page.getByRole('button',{name:'Delete event',exact:true}).click();
 if(mode==='reload-loss'||mode==='late-stale'){
  await expect(page.getByText('Deletion is unconfirmed. Check action status in Calendar; no cancellation will be repeated.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Back to calendar',exact:true}).last().click();
  await expect(page.getByRole('button',{name:'Check reminder action status',exact:true})).toBeVisible();
  if(mode==='reload-loss'){
   await page.getByRole('button',{name:'Check reminder action status',exact:true}).click();
   await expect(page.getByRole('button',{name:/^Delete boundary reminder,/})).toHaveCount(0);
   await expect(page.getByRole('button',{name:'Check reminder action status',exact:true})).toBeVisible();
   await page.reload();await page.getByRole('button',{name:'Calendar',exact:true}).click();
   await expect.poll(()=>page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('alpha.browser.reminder-deletions.v1')!)).length)).toBe(0);
   expect(await page.evaluate(async ()=>Object.keys(JSON.parse((await (await import('/src/browser/reminder-store.ts')).reminderDocument.readRaw())!).receipts).length)).toBe(1);
  }else{
   await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');await registerPlugin<any>('DailyApps').scheduleReminder({id:'unrelated',title:'Unrelated reminder',at:Date.parse('2027-03-13T15:00Z')});});
   await page.reload();await page.getByRole('button',{name:'Calendar',exact:true}).click();await page.getByRole('button',{name:/^Unrelated reminder,/}).click();await page.getByRole('button',{name:'Delete event',exact:true}).click();await expect(page.getByText('Reminder cancelled',{exact:true})).toBeVisible();
   const data=await page.evaluate(async ()=>JSON.parse((await (await import('/src/browser/reminder-store.ts')).reminderDocument.readRaw())!));expect(data.reminders.find((x:any)=>x.id==='delete-boundary').status).toBe('scheduled');expect(data.reminders.find((x:any)=>x.id==='unrelated').status).toBe('cancelled');
   expect(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('alpha.browser.reminder-deletions.v1')!)).map((x:any)=>x.operation.target.reminderId))).toEqual(['delete-boundary']);
   await page.getByRole('button',{name:/^Changed during dispatch,/}).click();await page.getByRole('button',{name:'Delete event',exact:true}).click();await expect.poll(()=>page.evaluate(async ()=>JSON.parse((await (await import('/src/browser/reminder-store.ts')).reminderDocument.readRaw())!).reminders.find((r:any)=>r.id==='delete-boundary').status)).toBe('cancelled');
   expect(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('alpha.browser.reminder-deletions.v1')!)).map((x:any)=>x.operation.target.reminderId))).toEqual(['delete-boundary']);
  }
  return;
 }
 if(mode==='navigate'){await expect.poll(()=>page.evaluate(()=>typeof(window as any).releaseDelete)).toBe('function');await page.getByRole('button',{name:'Back to calendar',exact:true}).last().click();await page.evaluate(()=>(window as any).releaseDelete());await page.waitForTimeout(100);}
 if(mode==='receipt-loss'){await expect(page.getByText('Deletion is unconfirmed. Check action status in Calendar; no cancellation will be repeated.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Delete event',exact:true}).click();}
 if(mode==='stale')await expect(page.getByText('This reminder changed. Review it again before deleting.',{exact:true})).toBeVisible();
 if(!['stale','navigate'].includes(mode))await expect(page.getByText('Reminder cancelled',{exact:true})).toBeVisible();
 const data=await page.evaluate(async ()=>({store:JSON.parse((await (await import('/src/browser/reminder-store.ts')).reminderDocument.readRaw())!),calls:(window as any).deletes}));
 expect(data.calls).toBe(['stale','navigate'].includes(mode)?0:1);expect(data.store.reminders[0].status).toBe(['stale','navigate'].includes(mode)?'scheduled':'cancelled');expect(Object.keys(data.store.receipts||{})).toHaveLength(['stale','navigate'].includes(mode)?0:1);
});

test('two browser tabs retain separate uncertain deletions through reload',async({page,context})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.clock.setFixedTime(new Date('2027-03-13T00:00Z'));await page.goto('/');await page.getByRole('button',{name:'Calendar',exact:true}).waitFor();
 await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');const d=registerPlugin<any>('DailyApps');for(const [id,title] of [['tab-one','First tab reminder'],['tab-two','Second tab reminder']])await d.scheduleReminder({id,title,at:Date.parse('2027-03-13T14:00Z')});});
 const second=await context.newPage();await second.clock.setFixedTime(new Date('2027-03-13T00:00Z'));await second.goto('/');await page.reload();
 for(const [tab,title] of [[page,'First tab reminder'],[second,'Second tab reminder']] as const){
  await tab.getByRole('button',{name:'Calendar',exact:true}).click();await tab.getByRole('button',{name:new RegExp('^'+title+',')}).click();
  await tab.evaluate(async()=>{const {BrowserDaily}=await import('/src/browser/daily.ts');BrowserDaily.prototype.operateReminder=async function(){throw Error('Synthetic dispatch uncertainty');};});
 }
 // Both renderers share the origin and contend for the recovery-record lock.
 await Promise.all([page.getByRole('button',{name:'Delete event',exact:true}).click(),second.getByRole('button',{name:'Delete event',exact:true}).click()]);
 await expect.poll(()=>page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('alpha.browser.reminder-deletions.v1')||'{}')).map((x:any)=>x.operation.target.reminderId).sort())).toEqual(['tab-one','tab-two']);
 await page.reload();await page.getByRole('button',{name:'Calendar',exact:true}).click();
 await expect(page.getByRole('button',{name:'Check reminder action status',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('alpha.browser.reminder-deletions.v1')!)).map((x:any)=>x.operation.target.reminderId).sort())).toEqual(['tab-one','tab-two']);
 expect(await page.evaluate(async ()=>JSON.parse((await (await import('/src/browser/reminder-store.ts')).reminderDocument.readRaw())!).reminders.map((r:any)=>r.status))).toEqual(['scheduled','scheduled']);
});

for(const mode of ['navigate','throw'])test(`abandoned durable deletion preparation ${mode}`,async({page})=>{
 await page.clock.setFixedTime(new Date('2027-03-13T00:00Z'));await page.goto('/');await page.getByRole('button',{name:'Calendar',exact:true}).waitFor();
 await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');await registerPlugin<any>('DailyApps').scheduleReminder({id:'retain-boundary',title:'Retain boundary reminder',at:Date.parse('2027-03-13T14:00Z')});});
 await page.reload();await page.getByRole('button',{name:'Calendar',exact:true}).click();await page.getByRole('button',{name:/^Retain boundary reminder,/}).click();
 await page.evaluate(async mode=>{
  const {BrowserDaily}=await import('/src/browser/daily.ts');const operate=BrowserDaily.prototype.operateReminder;(window as any).dispatches=0;BrowserDaily.prototype.operateReminder=async function(input){(window as any).dispatches++;return operate.call(this,input);};
  const request=navigator.locks.request.bind(navigator.locks);let first=true;
  navigator.locks.request=((name:any,options:any,callback:any)=>request(name,options,async(lock:any)=>{const result=await callback(lock);if(name==='alpha.browser.reminder-deletions.v1'&&first){first=false;if(mode==='throw')throw Error('Lost retention response');await new Promise<void>(r=>(window as any).releaseRetention=r);}return result;})) as any;
 },mode);
 await page.getByRole('button',{name:'Delete event',exact:true}).click();
 if(mode==='navigate'){await expect.poll(()=>page.evaluate(()=>typeof(window as any).releaseRetention)).toBe('function');await page.getByRole('button',{name:'Back to calendar',exact:true}).last().click();await page.evaluate(()=>(window as any).releaseRetention());}
 await expect.poll(()=>page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('alpha.browser.reminder-deletions.v1')||'{}')).length)).toBe(0);
 expect(await page.evaluate(()=>(window as any).dispatches)).toBe(0);
 expect(await page.evaluate(async ()=>JSON.parse((await (await import('/src/browser/reminder-store.ts')).reminderDocument.readRaw())!).reminders[0].status)).toBe('scheduled');
});
