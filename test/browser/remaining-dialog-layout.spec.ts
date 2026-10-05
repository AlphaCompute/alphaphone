import {test,expect} from '@playwright/test';
test.use({viewport:{width:360,height:430}});
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));});
const cases={reading:['Read page excerpt','Close',['Read locally','Stop reading']],receipt:['Workflow receipt','Cancel run',['Use receipt']],incoming:['Incoming email','Cancel',['Deliver']],location:['Development location','Cancel',['Save location']],sound:['sound settings','Done',[]],display:['display settings','Done',[]],recovery:['Saved app recovery','Close recovery',[]],privacy:['privacy settings','Done',[]],notification:['Development notification','Done',['Post']],access:['Notification access','Done',[]],channel:['Reminders notifications','Done',[]],install:['Development password provider','Done',[]],provider:['Development password provider','Done',[]],vault:['Development password provider','Done',[]]} as const;
for(const theme of ['light','dark'])for(const kind of Object.keys(cases) as (keyof typeof cases)[])test(`${theme} ${kind} review retains actions and theme at large text`,async({page},info)=>{
 await page.route('https://example.com/**',r=>r.fulfill({contentType:'text/html',body:'<article>Public source for local reading.</article>'}));
 await page.goto(`/?mode=dev&theme=${theme}`);
 await page.evaluate(async kind=>{
  const {BrowserDevice}=await import('/src/browser/device.ts');await BrowserDevice.prototype.setTextScale({percent:150});
  if(kind==='reading'){const {reviewBrowserReading}=await import('/src/browser/reading-review.ts');void reviewBrowserReading('https://example.com/article',new AbortController().signal,()=>{});}
  if(kind==='receipt'){const {requestWorkflowReceipt}=await import('/src/browser/workflow-receipts.ts');void requestWorkflowReceipt({get:(name:string)=>name==='wallet'?{cards:[]}:{mails:[],sent:[]}},false,new AbortController().signal).catch(()=>{});}
  if(kind==='incoming'){const {openIncomingSimulation}=await import('/src/browser/incoming-simulation.ts');openIncomingSimulation('email',{get:()=>({list:[{id:'sample',name:'Sample sender'}]}),setView:()=>{throw Error('Layout fixture cannot deliver');}});}
  if(kind==='location'){const {openLocationControls}=await import('/src/browser/location-simulation.ts');openLocationControls();}
  if(kind==='recovery'){const {loadSimulatedState,showSimulatorRecovery}=await import('/src/browser/simulator-recovery.ts');for(const name of ['inbox','contacts','workflows']){localStorage.setItem('alpha.dev.app.'+name,'{broken original');loadSimulatedState(name,{title:name,persist:[],state:{}});}showSimulatorRecovery();}
  if(kind==='sound'||kind==='privacy'||kind==='display')await BrowserDevice.prototype.openSettings({page:kind});
  if(['notification','access','channel'].includes(kind)){const {registerPlugin}=await import('/src/platform-plugins.ts');const notifications=registerPlugin<any>('AlphaNotifications');if(kind==='notification')await notifications.compose();if(kind==='access')await notifications.openNotificationAccess();if(kind==='channel')await notifications.openChannelSettings({id:'reminders'});}
  if(['install','provider','vault'].includes(kind)){const {openPasswordProvider}=await import('/src/browser/password-provider.ts');if(kind!=='install')await (await import('/src/browser/preference-documents.ts')).passwordProviderDocument.edit(()=>({installed:true,selection:'proton',revision:'layout-fixture'}),()=>{});await openPasswordProvider(kind==='provider'?'settings':kind==='vault'?'open':'install');}
 },kind);
 const [name,close,other]=cases[kind],dialog=page.getByRole('dialog',{name,exact:true});await expect(dialog).toBeVisible();
 if(kind==='vault')await dialog.getByRole('button',{name:'Unlock development vault',exact:true}).click();
 expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 for(const name of [close,...other]){const box=await dialog.getByRole('button',{name,exact:true}).boundingBox();expect(box).not.toBeNull();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(360);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(430);}
 expect(await dialog.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe(theme==='dark'?'rgb(0, 0, 0)':'rgb(255, 255, 255)');
 const region=dialog.getByRole('region',{name:name+' content'});await region.focus();if(await region.evaluate(e=>e.scrollHeight>e.clientHeight)){await page.keyboard.press('End');await expect.poll(()=>region.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);}
 for(const label of await dialog.locator('label').filter({has:page.locator('input[type=checkbox],input[type=range]')}).all())expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 for(const label of await dialog.locator('label').filter({has:page.locator('input[type=range]')}).all()){const geometry=await label.evaluate(e=>{const text=document.createRange();text.selectNode(e.firstChild!);const t=text.getBoundingClientRect(),r=e.querySelector('input')!.getBoundingClientRect();return {textBottom:t.bottom,sliderTop:r.top,sliderWidth:r.width,labelWidth:e.getBoundingClientRect().width};});expect(geometry.sliderTop).toBeGreaterThanOrEqual(geometry.textBottom);expect(geometry.sliderWidth).toBeGreaterThanOrEqual(geometry.labelWidth*.9);}
 await page.screenshot({path:info.outputPath('compact-review.png')});await dialog.getByRole('button',{name:close,exact:true}).click();await expect(dialog).toHaveCount(0);
});
