import {test,expect} from '@playwright/test';
test('agent cancellation after preparation prevents a Calendar commit and receipt',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto('/?mode=dev');
 const before=await page.evaluate(async()=>{
  const {BrowserCalendar}=await import('/src/browser/calendar.ts');const {calendarDocument}=await import('/src/browser/calendar-store.ts');
  const calendar=new BrowserCalendar(),source=await calendar.prepareAgentSource();
  const before=await calendarDocument.readRaw(),edit=calendarDocument.edit.bind(calendarDocument);
  calendarDocument.edit=function(initial,prepare,signal){return edit(initial,async data=>{const result=await prepare(data);(window as any).prepared=true;await new Promise<void>(resolve=>{(window as any).releasePrepared=resolve;});return result;},signal);};
  (window as any).cancelCalendar=()=>calendar.cancelAgent({operationId:'cancel-before-commit'});
  (window as any).operationResult=calendar.executeAgent({operationId:'cancel-before-commit',operation:{type:'calendar_create',source:{sourceId:source.sourceId,sourceRevision:source.sourceRevision},fields:{title:'Must not save',description:'',location:'',start:'2027-03-01T12:00:00.000Z',end:'2027-03-01T13:00:00.000Z',timeZone:'UTC'}}});
  return before;
 });
 await page.getByRole('dialog',{name:'Review calendar change'}).getByRole('button',{name:'Confirm',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prepared)).toBe(true);
 await page.evaluate(async()=>{await (window as any).cancelCalendar();(window as any).releasePrepared();});
 expect(await page.evaluate(()=>(window as any).operationResult)).toEqual({status:'cancelled'});
 expect(await page.evaluate(async()=>{const {calendarDocument}=await import('/src/browser/calendar-store.ts');return calendarDocument.readRaw();})).toBe(before);
});
