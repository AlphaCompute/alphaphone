import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));const state=(window as any).speechTest={spoken:[] as string[],cancelled:0,voices:[{name:'Device voice',lang:'en-US',localService:true}],utterance:null as any};const engine=new EventTarget();Object.assign(engine,{getVoices:()=>state.voices,speak:(u:any)=>{state.spoken.push(u.text);state.utterance=u;},cancel:()=>{state.cancelled++;}});Object.defineProperty(window,'speechSynthesis',{value:engine});Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class {text:string;constructor(text:string){this.text=text;}}});});
 await page.goto('/?mode=dev');await page.getByRole('button',{name:'Phone',exact:true}).click();await page.getByRole('button',{name:'Voicemail',exact:true}).click();await page.getByText("Hey, it's Maya. Quick one: can we push the review to 3:30? I want to get the prototype on the device first. Call me back.",{exact:true}).click();
});
test('voicemail reads its exact transcript locally, stops, ignores old completion, and completes on the voice event',async({page})=>{
 await expect(page.getByText('Local transcript',{exact:true})).toBeVisible();await expect(page.getByText('0:00 / 0:18',{exact:true})).toBeHidden();
 await page.getByRole('button',{name:'Read voicemail',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).speechTest.spoken.length)).toBe(1);await expect(page.getByText('Reading transcript',{exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as any).speechTest.spoken[0])).toBe("Hey, it's Maya. Quick one: can we push the review to 3:30? I want to get the prototype on the device first. Call me back.");await page.evaluate(()=>(window as any).oldEnd=(window as any).speechTest.utterance.onend);await page.getByRole('button',{name:'Stop reading',exact:true}).click();await page.getByRole('button',{name:'Read voicemail',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).speechTest.spoken.length)).toBe(2);await page.evaluate(()=>(window as any).oldEnd());await expect(page.getByRole('button',{name:'Stop reading',exact:true})).toBeVisible();await page.evaluate(()=>(window as any).speechTest.utterance.onend());await expect(page.getByRole('button',{name:'Read voicemail',exact:true})).toBeVisible();
});
for(const action of ['delete','home','pagehide','incoming'] as const)test(`${action} retires voicemail speech`,async({page})=>{
 await page.getByRole('button',{name:'Read voicemail',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).speechTest.spoken.length)).toBe(1);const before=await page.evaluate(()=>(window as any).speechTest.cancelled);
 if(action==='delete')await page.getByRole('button',{name:'Delete voicemail',exact:true}).click();else await page.evaluate(action=>window.dispatchEvent(new Event(action==='home'?'launcher-home':action==='incoming'?'alpha:dev-incoming-call':'pagehide')),action);
 await expect.poll(()=>page.evaluate(()=>(window as any).speechTest.cancelled)).toBeGreaterThan(before);await expect(page.getByRole('button',{name:'Stop reading',exact:true})).toHaveCount(0);
});
test('remote-only voices do not receive voicemail and local retry succeeds',async({page})=>{
 await page.evaluate(()=>(window as any).speechTest.voices=[{name:'Remote',lang:'en-US',localService:false}]);await page.getByRole('button',{name:'Read voicemail',exact:true}).click();await expect(page.getByRole('button',{name:'Read voicemail',exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as any).speechTest.spoken)).toEqual([]);await page.evaluate(()=>(window as any).speechTest.voices=[{name:'Device',lang:'en-US',localService:true}]);await page.getByRole('button',{name:'Read voicemail',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).speechTest.spoken.length)).toBe(1);
});
test('a voice appearing after Home cannot start retired voicemail playback',async({page})=>{
 await page.evaluate(()=>(window as any).speechTest.voices=[]);await page.getByRole('button',{name:'Read voicemail',exact:true}).click();await expect(page.getByRole('button',{name:'Stop reading',exact:true})).toBeVisible();await page.evaluate(()=>window.dispatchEvent(new Event('launcher-home')));await page.evaluate(()=>{(window as any).speechTest.voices=[{name:'Late device voice',lang:'en-US',localService:true}];speechSynthesis.dispatchEvent(new Event('voiceschanged'));});await expect(page.getByRole('button',{name:'Phone',exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as any).speechTest.spoken)).toEqual([]);
});

test('device retirement clears playback state and permits immediate explicit replay',async({page})=>{
 await page.getByRole('button',{name:'Read voicemail',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).speechTest.spoken.length)).toBe(1);
 await page.evaluate(()=>window.dispatchEvent(new Event('alpha:device-state')));
 await expect(page.getByRole('button',{name:'Read voicemail',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Read voicemail',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).speechTest.spoken.length)).toBe(2);
});
