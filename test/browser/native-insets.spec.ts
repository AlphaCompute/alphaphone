import {test,expect} from '@playwright/test';

async function nativeContent(page:any,url:string,insets:{top:number;bottom:number;left:number;right:number},width=412,height=915){
 await page.addInitScript(()=>{
  localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));
  const w=window as any;w.androidBridge={};
  const names=['DailyApps','AlphaBrowser','AlphaConnection','AlphaDevice','AlphaLocalAgent','AlphaHostedResults','AlphaVoiceCloud','AlphaNotifications','ElizaSystem','AlphaCalendar','AlphaNoteDocuments','AlphaNoteAudio','AlphaFiles','AlphaPhotos','DeviceApps','ElizaLocation','AlphaActionJournal'];
  const methods=['addListener','removeListener','surfaceInfo','readPending','readPendingResult','readDelegationCallback','readSecret','secureRead','secureWrite','secureRemove','get','status','getStatus','getState','state','permissionState','permissions','list','listCalendars','listEvents','listReminders','listBookmarks','getBookmarks','settings','getSettings','buildInfo','capabilities','query','read','readJournal','getPending','readSelection'];
  w.Capacitor={Plugins:{},PluginHeaders:names.map(name=>({name,methods:methods.map(name=>({name,rtype:name==='addListener'?'callback':'promise'}))})),nativeCallback:()=> 'fixture-callback',nativePromise:async(_plugin:string,method:string)=>{
   if(method==='surfaceInfo')return {topInset:0,bottomInset:0}; // MainActivity already fits standalone content.
   if(method==='buildInfo')return {launcher:false};
   if(['secureRead','readSecret'].includes(method))return {value:null};
   return {apps:[],events:[],calendars:[],reminders:[],bookmarks:[],results:[],items:[],entries:[],pending:[],capabilities:[],available:false};
  }};
 });
 await page.setViewportSize({width,height});
 await page.route('**/__native-insets-fixture',route=>route.fulfill({contentType:'text/html',body:'<!DOCTYPE html><html><body style="margin:0"></body></html>'}));
 await page.goto(new URL('/__native-insets-fixture',url).href);
 // An iframe is the WebView's usable native rectangle. It does not emulate Android framework dispatch.
 await page.setContent(`<iframe title="Standalone WebView" src="${url}" style="position:absolute;border:0;left:${insets.left}px;top:${insets.top}px;width:${width-insets.left-insets.right}px;height:${height-insets.top-insets.bottom}px"></iframe>`);
 const frame=page.frameLocator('iframe');
 await frame.getByRole('button',{name:'Not now',exact:true}).click();
 return frame;
}

test('fitted standalone navigation stays below native bars and returns to apps by pointer and keyboard',async({page},testInfo)=>{
 const frame=await nativeContent(page,testInfo.project.use.baseURL as string,{top:28,bottom:48,left:0,right:0});
 await frame.getByRole('button',{name:'Notes',exact:true}).click();
 const back=frame.getByRole('button',{name:'Back to apps',exact:true});await expect(back).toBeVisible();
 expect((await back.boundingBox())!.y).toBeGreaterThanOrEqual(28);
 await back.click();await expect(frame.getByRole('button',{name:'Calendar',exact:true})).toBeVisible();
 await frame.getByRole('button',{name:'Notes',exact:true}).click();
 await back.focus();await back.press('Enter');await expect(frame.getByRole('button',{name:'Calendar',exact:true})).toBeVisible();
});

test('native cutout and keyboard-sized resizes preserve reachable large-text standalone navigation',async({page},testInfo)=>{
 const frame=await nativeContent(page,testInfo.project.use.baseURL as string,{top:28,bottom:48,left:0,right:0});
 await frame.getByRole('button',{name:'Notes',exact:true}).click();
 const back=frame.getByRole('button',{name:'Back to apps',exact:true});
 await page.setViewportSize({width:700,height:420});
 await page.locator('iframe').evaluate((node:any)=>Object.assign(node.style,{left:'42px',top:'0px',width:'658px',height:'396px'}));
 await expect.poll(async()=>{const b=(await back.boundingBox())!;return b.x>=42&&b.y>=0&&b.x+b.width<=700&&b.y+b.height<=396;}).toBe(true);
 await page.setViewportSize({width:360,height:640});
 await page.locator('iframe').evaluate((node:any)=>Object.assign(node.style,{left:'0px',top:'32px',width:'360px',height:'288px'}));
 await back.evaluate((node:any)=>{node.style.fontSize='28px';});
 await expect.poll(async()=>{const b=(await back.boundingBox())!;return b.y>=32&&b.y+b.height<=320&&b.x+b.width<=360;}).toBe(true);
 await back.focus();await back.press('Enter');await expect(frame.getByRole('button',{name:'Calendar',exact:true})).toBeVisible();
});
