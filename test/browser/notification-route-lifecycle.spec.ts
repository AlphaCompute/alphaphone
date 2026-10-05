import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));await page.goto('/?mode=dev');});
for(const source of ['calendar','hosted'])for(const event of ['launcher-home','alpha:device-state','alpha:dev-incoming-call'])for(const phase of ['before','after'])test(`${source} notification ${event} ${phase} commit`,async({page})=>{
 await page.evaluate(async({source,phase})=>{
  let store:any,act:()=>Promise<unknown>,routed=0;
  if(source==='calendar'){
   const {BrowserCalendar}=await import('/src/browser/calendar.ts'),{calendarDocument}=await import('/src/browser/calendar-store.ts'),calendar=new BrowserCalendar();
   await calendar.save({creationId:crypto.randomUUID(),separateCreation:true,calendarId:'local',title:'Cancellation alert',body:'',location:'',begin:Date.now(),end:Date.now()+3600000,alert:0});const [row]=(await calendar.listAlerts()).items;
   calendar.open=async()=>{routed++;return {status:'opened'};};store=calendarDocument;act=()=>calendar.alertAction({...row,open:true});
  }else{
   const {browserHostedResults:hosted,hostedResultsDocument}=await import('/src/browser/hosted-results.ts');
   const route={scope:'fixture',origin:'https://agent.example',ownerId:'fixture-owner',agentId:'fixture-agent',runId:'fixture-run',workflowId:'fixture-workflow',workflowVersionId:'fixture-version'};
   await hostedResultsDocument.edit(()=>({enabled:true,polling:false,rows:[] as any[]}),state=>{state.rows=[{...route,id:'fixture-notice',digest:'fixture-digest',at:Date.now(),revision:crypto.randomUUID(),phase:'posted'}];});
   await hosted.addListener('pendingResult',()=>{routed++;});const [row]=await hosted.list();store=hostedResultsDocument;act=()=>hosted.action(row,true);
  }
  const edit=store.edit.bind(store),pause=()=>new Promise<void>(resolve=>{(window as any).routeHeld=true;(window as any).releaseRoute=resolve;});
  store.edit=async(initial:any,prepare:any,signal?:AbortSignal)=>{store.edit=edit;if(phase==='before')return edit(initial,async(data:any)=>{const result=await prepare(data);await pause();return result;},signal);const result=await edit(initial,prepare,signal);await pause();return result;};
  (window as any).routeAction=act().then(()=>({cancelled:false,routed}),()=>({cancelled:true,routed}));
 },{source,phase});
 await expect.poll(()=>page.evaluate(()=>(window as any).routeHeld)).toBe(true);
 await page.evaluate(event=>{window.dispatchEvent(new Event(event));(window as any).releaseRoute();},event);
 expect(await page.evaluate(()=>(window as any).routeAction)).toEqual({cancelled:phase==='before',routed:0});
 const committed=await page.evaluate(async source=>{if(source==='calendar'){const {calendarDocument}=await import('/src/browser/calendar-store.ts');return Object.keys(JSON.parse((await calendarDocument.readRaw())!).alertDismissed||{}).length===1;}const {hostedResultsDocument}=await import('/src/browser/hosted-results.ts');return Boolean(JSON.parse((await hostedResultsDocument.readRaw())!).pending?.token);},source);
 expect(committed).toBe(phase==='after');
});
