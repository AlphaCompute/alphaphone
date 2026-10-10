import {test,expect,type Page} from '@playwright/test';
import {returnToApps} from './app-navigation';
// Daily overview contract on Home (development lane): every card names its source and when it was
// read, shows loading/empty/error states honestly, keeps overdue reminders visible, and shows the
// latest retained brief only when one exists. Mail and digest data here is synthetic and injected
// through the same adapters a provider uses; nothing is sent, and Home itself never reads mail.
// home-daily-overview.production.spec.ts covers the flag-off build.

const offline=()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));
const home=(page:Page)=>page.getByRole('region',{name:'Home',exact:true});
const calendarCard=(page:Page)=>page.locator('[data-alpha-home-calendar]');
const inboxCard=(page:Page)=>home(page).locator('[data-alpha-home-inbox]');
const briefCard=(page:Page)=>home(page).locator('[data-alpha-home-brief]');
/** The app's own time format for "now" and the neighbouring minutes, so a minute rollover cannot fail the comparison. */
const nearNow=(page:Page)=>page.evaluate(async()=>{const {formatTime}=await import('/src/prototype/locale-time.ts'),now=Date.now();return [-60000,0,60000].map(offset=>formatTime(new Date(now+offset)));});

test('calendar card names its source and read time for an event and for an empty calendar',async({page},info)=>{
 await page.addInitScript(offline);await page.goto('/');
 const card=calendarCard(page);
 await expect(card).toContainText('No upcoming events');
 const source=card.locator('[data-alpha-home-calendar-source]');
 const times=await nearNow(page);
 const origin=card.locator('[data-alpha-home-calendar-origin]');
 await expect(origin).toHaveText('This app');
 expect(times.map(time=>`Read ${time}`)).toContain(await source.textContent());
 expect(times.map(time=>`Read ${time} from the calendar saved in this browser`)).toContain(await card.getAttribute('aria-description'));
 await expect(card).toHaveAttribute('data-alpha-home-calendar-overdue','false');
 const expected=await page.evaluate(async()=>{
  const {BrowserCalendar}=await import('/src/browser/calendar.ts'),date=new Date(Date.now()+2*86400000);date.setHours(9,30,0,0);
  await new BrowserCalendar().save({calendarId:'local',title:'Synthetic overview event',begin:date.getTime(),end:date.getTime()+1800000,allDay:false,creationId:crypto.randomUUID()});
  const time=(value:number)=>new Date(value).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  return {day:date.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'}),footer:`${time(date.getTime())} – ${time(date.getTime()+1800000)}`};
 });
 await page.reload();
 await expect(card).toHaveAccessibleName(`Open calendar event: Synthetic overview event, ${expected.day}, ${expected.footer}`);
 await expect(card.locator('.home-calendar-footer')).toHaveText(expected.footer);
 await expect(source).toHaveText(/^Read \d{1,2}:\d{2}/);
 await expect(origin).toHaveText('In this app');
 await expect(card).toHaveAttribute('aria-description',/^In this app\. Read \d{1,2}:\d{2}.* from the calendar saved in this browser$/);
 // The time and the source share the last row without clipping either or the card.
 expect(await card.evaluate(element=>{const footer=element.querySelector<HTMLElement>('.home-calendar-footer')!,line=element.querySelector<HTMLElement>('[data-alpha-home-calendar-source]')!,origin=element.querySelector<HTMLElement>('[data-alpha-home-calendar-origin]')!,a=footer.getBoundingClientRect(),b=line.getBoundingClientRect(),box=element.getBoundingClientRect();return {footerClipped:footer.scrollWidth>footer.clientWidth,sourceClipped:line.scrollWidth>line.clientWidth,originClipped:origin.scrollWidth>origin.clientWidth,apart:b.left>=a.right,inside:b.right<=box.right&&b.bottom<=box.bottom,overflow:element.scrollWidth-element.clientWidth};})).toEqual({footerClipped:false,sourceClipped:false,originClipped:false,apart:true,inside:true,overflow:0});
 await page.screenshot({path:info.outputPath('home-calendar-source.png'),animations:'disabled'});
});

test('a failed calendar read shows the failure and a retry route with no read time, then recovers',async({page})=>{
 await page.addInitScript(offline);await page.goto('/');
 const card=calendarCard(page),source=card.locator('[data-alpha-home-calendar-source]');
 await expect(source).toHaveText(/^Read \d/);
 await page.evaluate(async()=>{
  const {BrowserCalendar}=await import('/src/browser/calendar.ts'),proto=BrowserCalendar.prototype as any;
  (window as any).__calendarList=proto.list;proto.list=()=>Promise.reject(Error('Calendar storage unavailable'));
  window.dispatchEvent(new Event('alpha:calendar-preferences'));
 });
 await expect(card).toContainText('Calendar unavailable');
 await expect(source).toHaveText('Open Calendar to retry');
 await expect(card).not.toContainText(/This app|Read \d/);
 await expect(card).toHaveAttribute('aria-description','Calendar could not be read. Open Calendar to retry.');
 await page.evaluate(async()=>{
  const {BrowserCalendar}=await import('/src/browser/calendar.ts');(BrowserCalendar.prototype as any).list=(window as any).__calendarList;
  window.dispatchEvent(new Event('alpha:calendar-preferences'));
 });
 await expect(card).toContainText('No upcoming events');
 await expect(source).toHaveText(/^Read \d{1,2}:\d{2}/);
 await expect(card.locator('[data-alpha-home-calendar-origin]')).toHaveText('This app');
});

test('an overdue reminder stays on Home, marked overdue with its own source, and opens in Calendar',async({page,context},info)=>{
 await context.grantPermissions(['notifications']);
 await page.addInitScript(offline);await page.goto('/');
 const scheduled=await page.evaluate(async()=>{
  const {DailyApps}=await import('/src/daily.ts'),at=Date.now()+1500;
  const a=await DailyApps.scheduleReminder({id:'overview-overdue-a',title:'Synthetic overdue reminder',body:'',at});
  const b=await DailyApps.scheduleReminder({id:'overview-overdue-b',title:'Synthetic second overdue',body:'',at:at+200});
  return {at,statuses:[a.status,b.status]};
 });
 expect(scheduled.statuses).toEqual(['scheduled','scheduled']);
 await expect.poll(()=>page.evaluate(at=>Date.now()>at+400,scheduled.at),{timeout:10000}).toBe(true);
 await page.reload();
 const card=calendarCard(page);
 await expect(card).toHaveAttribute('data-alpha-home-calendar-overdue','true');
 await expect(card).toContainText('Synthetic overdue reminder');
 const due=await page.evaluate(async at=>{const {overdueDueLabel}=await import('/src/prototype/home-cards.ts');return overdueDueLabel(at,Date.now());},scheduled.at);
 expect(due).toMatch(/^Due (\S+, \S+ \d+ )?\d{1,2}:\d{2}/);
 await expect(card).toHaveAccessibleName(`Open overdue reminder: Synthetic overdue reminder, ${due}`);
 await expect(card).toContainText('2 overdue reminders');
 await expect(card.locator('.home-calendar-footer')).toHaveText(due);
 await expect(card.locator('[data-alpha-home-calendar-source]')).toHaveCount(0);await expect(card.locator('[data-alpha-home-calendar-origin]')).toHaveText('');
 await expect(card).toHaveAttribute('aria-description','Overdue reminder saved on this browser');
 // It is still there after another render and a reload: nothing dismissed it.
 await page.reload();await expect(card).toHaveAttribute('data-alpha-home-calendar-overdue','true');
 await page.screenshot({path:info.outputPath('home-overdue.png'),animations:'disabled'});
 await card.click();
 await expect(page.locator('html')).toHaveAttribute('data-active-view','calendar');
 await expect(page.getByText('Synthetic overdue reminder').first()).toBeVisible();
});

async function mailFixture(page:Page){
 await page.addInitScript(offline);await page.goto('/');
 await page.evaluate(async()=>{
  const {connectionController:c}=await import('/src/runtime/connection-ui.tsx'),{secureConnectionStore:s}=await import('/src/runtime/native-connection.ts');
  s.read=async()=>null;
  const f=(window as any).overviewMail={reads:0,threadReads:0,fail:false,rows:[
   {id:'unread-a',threadId:'thread-a',subject:'Synthetic overview subject',from:'Synthetic sender A',to:[],snippet:'Synthetic body preview',receivedAt:'2026-10-09T00:00:00Z',unread:true},
   {id:'read',threadId:'thread-read',subject:'Synthetic read subject',from:'Synthetic sender B',to:[],snippet:'',receivedAt:'2026-10-09T00:00:00Z',unread:false}]};
  const client={gmailAccounts:async()=>[{connectionId:'grant-overview',label:'Synthetic mailbox',connected:true,grantedCapabilities:['google.gmail.triage']}],
   gmailSearch:async()=>{f.reads++;if(f.fail)throw Error('Synthetic provider unavailable');return {messages:structuredClone(f.rows),syncedAt:'fixture',nextPageToken:null};},
   gmailThread:async()=>{f.threadReads++;throw Error('Synthetic thread read is not part of this test');},
   gmailInboxCapabilities:async()=>({send:false,providerDrafts:false,mailboxMutations:false})};
  c.getCloudClient=()=>({client,sessionId:'fixture-overview'} as any);
  const snapshot={...c.getSnapshot(),cloudAccount:{environment:'production',userId:'fixture-overview',sessionId:'fixture-overview',credentialId:'fixture-only'}};c.getSnapshot=()=>snapshot;
 });
}
const mailReads=(page:Page)=>page.evaluate(()=>({reads:(window as any).overviewMail.reads,threads:(window as any).overviewMail.threadReads}));

test('Inbox card never reads mail from Home and shows the account and read time of the loaded page',async({page},info)=>{
 await mailFixture(page);
 const card=inboxCard(page);
 // A connected account alone does not make Home read mail: re-render, wait, and come back to the foreground.
 await page.getByRole('textbox',{name:'Ask Alpha',exact:true}).fill('Unsent rerender');
 await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(1500);
 expect(await mailReads(page)).toEqual({reads:0,threads:0});
 await expect(card).not.toContainText(/unread|Synthetic overview subject|Read \d/);
 await expect(card).toContainText(/Open to (check|load) email|Connect email|Inbox/);
 // The user opens Inbox: one explicit read. Home then shows that page's metadata and when it was read.
 await page.getByRole('button',{name:'Inbox',exact:true}).click();
 await expect(page.getByRole('button',{name:/Unread, Synthetic sender A/})).toBeVisible();
 const times=await nearNow(page);
 await returnToApps(page);
 expect(await mailReads(page)).toEqual({reads:1,threads:0});
 await expect(card).toHaveAccessibleName('Open Inbox: 1 unread email');
 await expect(card).toContainText('1 unread');await expect(card).toContainText('Synthetic overview subject');
 await expect(card).not.toContainText('Synthetic body preview');await expect(card).not.toContainText('Synthetic read subject');
 const status=await card.getAttribute('aria-description');
 expect(times.map(time=>`Synthetic mailbox · Read ${time}`)).toContain(status);
 await expect(card).toContainText(status!);
 // Staying on Home does not refresh it.
 await page.getByRole('textbox',{name:'Ask Alpha',exact:true}).fill('Another unsent rerender');
 await page.waitForTimeout(1000);
 expect(await mailReads(page)).toEqual({reads:1,threads:0});
 await expect(card).toHaveAttribute('aria-description',status!);
 await page.screenshot({path:info.outputPath('home-inbox-read-time.png'),animations:'disabled'});
 // A failed refresh in Inbox is reported on Home with the time of the last successful read.
 await page.getByRole('button',{name:'Inbox',exact:true}).click();
 await expect(page.getByRole('button',{name:/Unread, Synthetic sender A/})).toBeVisible();
 await page.evaluate(()=>{(window as any).overviewMail.fail=true;});
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();
 await returnToApps(page);
 await expect(card).toHaveAttribute('aria-description',/^Open to retry · last read \d{1,2}:\d{2}/);
 await expect(card).not.toContainText('No unread');
});

test('the latest retained brief appears with its agent and run time, reports failure, and is absent otherwise',async({page},info)=>{
 await page.addInitScript(offline);await page.goto('/');
 await expect(calendarCard(page)).toBeVisible();
 await expect(briefCard(page)).toHaveCount(0);
 await expect(home(page)).not.toContainText(/Morning brief|No brief yet/);
 const ranAt=await page.evaluate(async()=>{
  const {rememberRetainedDigests}=await import('/src/runtime/hosted-digests.ts'),at=new Date(Date.now()-3600000);
  rememberRetainedDigests([
   {cursor:1,runId:'run-old',completedAt:new Date(at.getTime()-86400000).toISOString(),status:'succeeded',output:'Synthetic older brief'},
   {cursor:2,runId:'run-new',completedAt:at.toISOString(),status:'succeeded',output:{summary:'Synthetic brief: two meetings and one reply to send.'}}] as any,'Synthetic agent');
  const {whenLabel}=await import('/src/prototype/home-cards.ts');return whenLabel(at.getTime(),Date.now());
 });
 const card=briefCard(page);
 await expect(card).toBeVisible();
 await expect(card).toContainText('Latest brief');
 await expect(card).toContainText('Synthetic brief: two meetings and one reply to send.');
 await expect(card).not.toContainText('Synthetic older brief');
 await expect(card).toContainText(`Synthetic agent · Ran ${ranAt}`);
 await expect(card).toHaveAccessibleName(`Open scheduled digests. Latest brief from Synthetic agent, ran ${ranAt}: Synthetic brief: two meetings and one reply to send.`);
 await expect(card).toHaveAttribute('data-alpha-home-brief-failed','false');
 // The three existing cards keep their order and names.
 const tiles=home(page).locator('[data-alpha-home-layout] > .scr').first().getByRole('button');
 await expect(tiles).toHaveCount(4);
 await expect(tiles.nth(0)).toHaveAttribute('data-alpha-home-calendar','');await expect(tiles.nth(2)).toHaveAttribute('data-alpha-home-inbox','');await expect(tiles.nth(3)).toHaveAttribute('data-alpha-home-brief','');
 await card.scrollIntoViewIfNeeded();
 expect(await card.evaluate(element=>{const box=element.getBoundingClientRect(),title=element.querySelector('.home-brief-title')!.getBoundingClientRect(),status=element.querySelector('.home-brief-status')!.getBoundingClientRect();return {height:Math.round(box.height),overflow:element.scrollWidth-element.clientWidth,ordered:title.bottom<=status.top,inside:status.bottom<=box.bottom};})).toEqual({height:196,overflow:0,ordered:true,inside:true});
 await page.screenshot({path:info.outputPath('home-brief.png'),animations:'disabled'});
 // A newer failed run replaces it and says it failed.
 await page.evaluate(async()=>{
  const {rememberRetainedDigests}=await import('/src/runtime/hosted-digests.ts');
  rememberRetainedDigests([{cursor:3,runId:'run-failed',completedAt:new Date(Date.now()-60000).toISOString(),status:'failed',error:'Synthetic source expired'}] as any,'Synthetic agent');
 });
 await expect(card).toHaveAttribute('data-alpha-home-brief-failed','true');
 await expect(card).toContainText('Synthetic source expired');
 await expect(card).toContainText(/Synthetic agent · Failed \d{1,2}:\d{2}/);
 // Opening it shows the retained results list; nothing is run.
 await card.click();
 await expect(page.getByRole('dialog').getByRole('heading',{name:'Scheduled digests',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close scheduled digests',exact:true}).click();
 // When the retained result is cleared (for example the connection changes), the card goes away.
 await page.evaluate(async()=>{(await import('/src/runtime/hosted-digests.ts')).rememberRetainedDigests(null);});
 await expect(briefCard(page)).toHaveCount(0);
});

test('workflows card shows when its rows were loaded, and nothing before a list is loaded',async({page},info)=>{
 await page.route(/^https?:\/\/(?!127\.0\.0\.1:|localhost:)/,route=>route.abort());
 await page.addInitScript(offline);await page.goto('/?mode=dev&workflows=agent');
 const {installWorkflowListFixture}=await import('./workflow-navigation');await installWorkflowListFixture(page);
 await page.evaluate(async()=>{
  const f=(window as any).overviewFlows={lists:0,writes:0};
  const {WorkflowProtocol:P}=await import('/src/runtime/workflow-protocol.ts');
  P.prototype.lifecycleSupported=async()=>false;
  P.prototype.list=async()=>{f.lists++;return [{id:'overview',name:'Synthetic overview routine',active:true,description:'',versionId:'v1',steps:[]}];};
  for(const method of ['activate','pause','run','lifecycle','updateMetadata'])(P.prototype as any)[method]=async()=>{f.writes++;throw Error('Writes are not part of Home');};
 });
 const card=home(page).locator('[data-alpha-home-workflows]'),freshness=card.locator('[data-alpha-home-workflow-freshness]');
 // No agent: no rows and no load time.
 await expect(freshness).toHaveCount(0);
 await expect(card).not.toContainText(/Loaded \d/);
 await page.evaluate(async()=>{const {connectionController:c}=await import('/src/runtime/connection-ui.tsx');await c.initialize();await c.startDevelopment('local');});
 await expect(card).toContainText('Synthetic overview routine');
 const times=await nearNow(page);
 expect(times.map(time=>`Loaded ${time}`)).toContain(await freshness.textContent());
 expect(times.map(time=>`Workflows from your agent, loaded ${time}`)).toContain(await card.getAttribute('aria-description'));
 expect(await card.evaluate(element=>({height:Math.round(element.getBoundingClientRect().height),overflowX:element.scrollWidth-element.clientWidth,overflowY:element.scrollHeight-element.clientHeight}))).toEqual({height:196,overflowX:0,overflowY:0});
 await card.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('home-workflows-loaded.png'),animations:'disabled'});
 // Disconnecting retires the rows and their load time together.
 await page.evaluate(async()=>{await(await import('/src/runtime/connection-ui.tsx')).connectionController.offline();});
 await expect(card).not.toContainText('Synthetic overview routine');
 await expect(freshness).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).overviewFlows.writes)).toBe(0);
});
