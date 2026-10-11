import {test,expect} from '@playwright/test';
// Class S for the Android product: these run the renderer's capability module and the web build's
// menu in Chromium. They do not run the native browser, whose answer BrowserReadingNavigation
// asserts on an emulator.
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));await page.goto('/');});
const probe=(page:any,answers:unknown[])=>page.evaluate(async(answers:unknown[])=>{
 const {createReadingSupport}=await import('/src/browser/reading-capability.ts');
 let asked=0,changed=0;const states:string[]=[];
 const support=createReadingSupport(async()=>{const answer=answers[Math.min(asked++,answers.length-1)];if(answer==='throw')throw new Error('bridge closed');return answer;},()=>{changed++;});
 states.push(support.state);
 const together=await Promise.all([support.check(),support.check()]);states.push(support.state);
 const again=await support.check();states.push(support.state);
 return {asked,changed,states,together,again};
},answers);
test('an explicit native "no" is remembered as unavailable and asked for once',async({page})=>{
 expect(await probe(page,[{available:false}])).toEqual({asked:1,changed:1,states:['unknown','unavailable','unavailable'],together:['unavailable','unavailable'],again:'unavailable'});
});
test('an explicit native "yes" is remembered as available',async({page})=>{
 expect(await probe(page,[{available:true}])).toEqual({asked:1,changed:1,states:['unknown','available','available'],together:['available','available'],again:'available'});
});
test('a failed or malformed answer is never read as unavailable or available, and is asked again',async({page})=>{
 // Unknown lets the review start; the native side then refuses on its own if it must.
 expect(await probe(page,['throw',{available:false}])).toEqual({asked:2,changed:1,states:['unknown','unknown','unavailable'],together:['unknown','unknown'],again:'unavailable'});
 for(const malformed of [null,{},{available:'false'},{available:0},'no'])
  expect((await probe(page,[malformed,malformed])).states,JSON.stringify(malformed)).toEqual(['unknown','unknown','unknown']);
});
test('the message names both actions, the cause and the remedy, and promises nothing else',async({page})=>{
 const message=await page.evaluate(async()=>(await import('/src/browser/reading-capability.ts')).READING_UNSUPPORTED_MESSAGE);
 expect(message).toBe('Read aloud and Ask about page are unavailable on this device: its Android System WebView cannot read a page privately. Update Android System WebView.');
});
test('the web build, which reviews a fetched copy and has no such limit, shows no unavailable note',async({page})=>{
 await page.getByRole('button',{name:'Browser',exact:true}).click();
 await page.getByRole('button',{name:'Menu',exact:true}).click();
 const menu=page.getByRole('dialog',{name:'Browser menu'});
 await expect(menu.getByRole('button',{name:'Read aloud',exact:true})).toBeVisible();
 await expect(menu.getByRole('button',{name:'Ask about page',exact:true})).toBeVisible();
 await expect(menu.locator('[data-alpha-reading-unavailable]')).toHaveCount(0);
});
