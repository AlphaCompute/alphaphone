import {test,expect} from '@playwright/test';
const key='alpha.browser.calendar.v1';
test('legacy import preserves exact bytes, then reload uses the committed document',async({page,context})=>{
 const original=' {"sourceRevision":"legacy-owner","events":[],"preferences":{"visible":false,"color":"fg"}} ';
 await page.addInitScript(({key,original})=>{localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));if(!localStorage.getItem(key))localStorage.setItem(key,original);},{key,original});
 await page.route('**/__storage-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Storage migration</title>'}));
 await page.goto('/__storage-fixture');
 const first=await page.evaluate(async()=>{const {calendarDocument}=await import('/src/browser/calendar-store.ts');await calendarDocument.readRaw();return calendarDocument.capture();});
 expect(first.raw).toBe(original);
 await page.evaluate(async()=>{const {calendarDocument}=await import('/src/browser/calendar-store.ts');await calendarDocument.edit(()=>({}),data=>{(data as any).preferences.visible=true;});});
 const after=await page.evaluate(async()=>{const {calendarDocument}=await import('/src/browser/calendar-store.ts');await calendarDocument.readRaw();return calendarDocument.capture();});
 expect(after.snapshot?.revision).not.toBe(first.snapshot?.revision);expect(JSON.parse(after.raw!).preferences.visible).toBe(true);
 expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(original);
 const other=await context.newPage();await other.goto('/?mode=dev');
 expect(await other.evaluate(async()=>{const {calendarDocument}=await import('/src/browser/calendar-store.ts');return (await calendarDocument.read(()=>({preferences:{visible:false}}))).preferences.visible;})).toBe(true);
 await page.goto('/?mode=dev');expect(await page.evaluate(async()=>{const {calendarDocument}=await import('/src/browser/calendar-store.ts');return (await calendarDocument.read(()=>({preferences:{visible:false}}))).preferences.visible;})).toBe(true);
});
