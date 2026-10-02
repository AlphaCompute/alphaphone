import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));});
test('browser calendar persists events and rejects stale modifications',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {registerPlugin}=await import('/src/platform-plugins.ts');const calendar=registerPlugin<any>('AlphaCalendar');
  const begin=Date.now()+3600000,end=begin+3600000;
  const input={calendarId:'local',title:'Browser parity event',body:'Local record',location:'Desk',begin,end};
  const saved=await calendar.save(input),expected={title:input.title,body:input.body,location:input.location,begin,end};
  const inspected=await calendar.inspect({id:saved.id,calendarId:'local',expected});
  const edited=await calendar.save({...input,id:saved.id,expected,title:'Edited event'});
  const stale=await calendar.remove({id:saved.id,calendarId:'local',expected,revision:inspected.revision});
  return {saved:saved.status,edited:edited.status,stale:stale.status};
 });
 expect(result).toEqual({saved:'saved',edited:'saved',stale:'conflict'});
 await page.reload();await page.getByRole('button',{name:'Calendar',exact:true}).click();
 await expect(page.getByText('Edited event',{exact:true}).first()).toBeVisible();
});
test('browser reminder posts, snoozes and completes without repeating completion',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {registerPlugin}=await import('/src/platform-plugins.ts');const daily=registerPlugin<any>('DailyApps'),notices=registerPlugin<any>('AlphaNotifications');
  await daily.scheduleReminder({id:'parity',title:'Parity reminder',at:Date.now()+10000});
  const data=JSON.parse(localStorage.getItem('alpha.browser.reminders.v1')!);data.reminders[0].at=Date.now()-1;localStorage.setItem('alpha.browser.reminders.v1',JSON.stringify(data));
  const posted=await notices.list(),row=(await daily.listReminders()).reminders[0];
  const snoozed=await daily.reminderDecision({id:row.id,occurrenceId:row.occurrenceId,action:'snooze'});
  const done=await daily.reminderDecision({id:row.id,occurrenceId:row.occurrenceId,action:'done'});
  const duplicate=await daily.reminderDecision({id:row.id,occurrenceId:row.occurrenceId,action:'done'});
  return {posted:posted.items.length,snoozed:snoozed.status,done:done.status,duplicate:duplicate.status};
 });expect(result).toEqual({posted:1,snoozed:'scheduled',done:'completed',duplicate:'stale'});
});
test('browser surface isolates pages, persists bookmarks and hides overlaid tabs',async({page})=>{
 await page.route('https://parity.example/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Embedded page</h1>'}));
 await page.goto('/');
 await page.getByRole('button',{name:'Browser',exact:true}).click();
 await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');const browser=registerPlugin<any>('AlphaBrowser');await browser.create({session:'test',id:'tab'});await browser.navigate({session:'test',id:'tab',url:'https://parity.example/page'});await browser.present({session:'test',id:'tab',x:0,y:100,width:400,height:500});await browser.setBookmark({url:'https://parity.example/page',saved:true});});
 await expect(page.frameLocator('[data-browser-surface="tab"] iframe').getByRole('heading',{name:'Embedded page'})).toBeVisible();
 await expect(page.locator('[data-browser-surface="tab"] iframe')).toHaveAttribute('sandbox',/allow-scripts/);
 expect(await page.locator('[data-browser-surface="tab"] iframe').getAttribute('sandbox')).not.toContain('allow-same-origin');
 await expect(page.locator('[data-browser-surface="tab"] a')).toHaveAttribute('rel','noopener noreferrer');
 await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');await registerPlugin<any>('AlphaBrowser').present({session:'test',id:null});});
 await expect(page.locator('[data-browser-surface="tab"]')).toBeHidden();
 await page.reload();
 expect(await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');return (await registerPlugin<any>('AlphaBrowser').bookmarks()).urls;})).toEqual(['https://parity.example/page']);
});
test('local dev device exposes deferred apps without dispatching external effects',async({page})=>{
 const requests:string[]=[];page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:'))requests.push(request.url());});
 await page.goto('/?mode=dev');
 await expect(page.getByRole('button',{name:'Dev device · local data',exact:true})).toBeVisible();
 for(const name of ['Phone','Messages','Contacts','Wallet']){
  await page.getByRole('button',{name,exact:true}).first().click();
  await page.evaluate(()=>window.dispatchEvent(new Event('alpha-back',{cancelable:true})));
 }
 expect(requests.filter(url=>!url.startsWith('data:')&&!url.startsWith('blob:'))).toEqual([]);
});
test('browser files keep exact bytes across reload, rename and move',async({page})=>{
 await page.goto('/');
 const imported=await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');const files=registerPlugin<any>('AlphaFiles');const file=new File(['Line one\r\nCafé\n'],'parity.txt',{type:'text/plain'});const selection=await files.importFile(file);const listing=await files.list({});const entry=listing.entries.find((e:any)=>e.name==='parity.txt');const text=await registerPlugin<any>('DailyApps').readSelected(selection);await files.createFolder({id:'root',name:'Folder'});const folder=(await files.list({})).entries.find((e:any)=>e.directory);await files.move({id:entry.id,destinationId:folder.id,expectedRevision:entry.revision});return {text:text.text,folder:folder.id};});
 expect(imported.text).toBe('Line one\r\nCafé\n');await page.reload();
 const retained=await page.evaluate(async(folder)=>{const {registerPlugin}=await import('/src/platform-plugins.ts');const files=registerPlugin<any>('AlphaFiles');const listing=await files.list({id:folder});const entry=listing.entries[0];await files.rename({id:entry.id,name:'renamed.txt',expectedRevision:entry.revision});let stale=false;try{await files.delete({id:entry.id,expectedRevision:entry.revision,confirmPermanent:true});}catch{stale=true;}return {stale,name:(await files.list({id:folder})).entries[0].name};},imported.folder);
 expect(retained).toEqual({stale:true,name:'renamed.txt'});
});
test('browser device setting controls persist across reload',async({page})=>{
 await page.goto('/');await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');await registerPlugin<any>('AlphaDevice').openSettings({page:'wifi'});});
 const checkbox=page.getByRole('dialog',{name:'wifi settings'}).getByRole('checkbox');await expect(checkbox).toBeChecked();await checkbox.uncheck();await page.getByRole('button',{name:'Done',exact:true}).click();await page.reload();
 expect(await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');return (await registerPlugin<any>('AlphaDevice').snapshot()).wifiActive;})).toBe(false);
});
