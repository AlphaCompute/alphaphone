import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));await page.goto('/?mode=dev');});
for(const event of ['launcher-home','alpha:device-state','alpha:dev-incoming-call'])for(const phase of ['before','after'])test(`${event} retires notification opening ${phase} commit`,async({page})=>{
 await page.evaluate(async phase=>{
  const {registerPlugin}=await import('/src/platform-plugins.ts'),n=registerPlugin<any>('AlphaNotifications'),{notificationDocument}=await import('/src/browser/notification-store.ts');
  await n.setNotificationPolicy({expectedRevision:(await n.crossAppStatus()).revision,enabled:true,history:true,apps:[{packageName:'browser.mail',preview:true}]});await n.inject({packageName:'browser.mail',title:'Reviewed event',text:'Preserve outcome'});const row=(await n.list()).items[0],edit=notificationDocument.edit.bind(notificationDocument);let navigated=0;
  window.addEventListener('alpha:browser-open-view',()=>navigated++);
  const pause=()=>new Promise<void>(resolve=>{(window as any).notificationHeld=true;(window as any).releaseNotification=resolve;});
  notificationDocument.edit=async(prepare,signal)=>{notificationDocument.edit=edit;if(phase==='before')return edit(async data=>{const result=await prepare(data);await pause();return result;},signal);const result=await edit(prepare,signal);await pause();return result;};
  (window as any).notificationAction=n.open(row).then(()=>({cancelled:false,navigated}),()=>({cancelled:true,navigated}));
 },phase);
 await expect.poll(()=>page.evaluate(()=>(window as any).notificationHeld)).toBe(true);
 await page.evaluate(event=>{window.dispatchEvent(new Event(event));(window as any).releaseNotification();},event);
 expect(await page.evaluate(()=>(window as any).notificationAction)).toEqual({cancelled:phase==='before',navigated:0});
 const state=await page.evaluate(async()=>{const {notificationState}=await import('/src/browser/notification-store.ts');const state=await notificationState();return {count:state.deviceEvents.length,history:state.events.map(row=>row.state)};});
 expect(state).toEqual(phase==='before'?{count:1,history:['posted']}:{count:0,history:['posted','opened']});
});
