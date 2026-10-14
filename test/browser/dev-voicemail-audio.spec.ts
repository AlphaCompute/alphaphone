import {test,expect} from '@playwright/test';
import {agentBrowserVoice} from './voice-fixture';
// P-43: voicemail is read through the local agent's on-device speech (libelizainference Paradee),
// stubbed at the agent boundary (agentBrowserVoice); there is no Web Speech fallback.
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));});
 await page.goto('/?mode=dev');await agentBrowserVoice(page);await page.getByRole('button',{name:'Phone',exact:true}).click();await page.getByRole('button',{name:'Voicemail',exact:true}).click();await page.getByText("Hey, it's Maya. Quick one: can we push the review to 3:30? I want to get the prototype on the device first. Call me back.",{exact:true}).click();
});
test('voicemail reads its exact transcript locally, stops, ignores old completion, and completes on the voice event',async({page})=>{
 await expect(page.getByText('Local transcript',{exact:true})).toBeVisible();await expect(page.getByText('0:00 / 0:18',{exact:true})).toBeHidden();
 await page.getByRole('button',{name:'Read voicemail',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).voiceFixture.spoken.length)).toBe(1);await expect(page.getByText('Reading transcript',{exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as any).voiceFixture.spoken[0])).toBe("Hey, it's Maya. Quick one: can we push the review to 3:30? I want to get the prototype on the device first. Call me back.");await page.evaluate(()=>{const audio=(window as any).voiceFixture.audios.at(-1);(window as any).oldEnd=()=>audio.onended?.(new Event('ended'));});await page.getByRole('button',{name:'Stop reading',exact:true}).click();await page.getByRole('button',{name:'Read voicemail',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).voiceFixture.spoken.length)).toBe(2);await page.evaluate(()=>(window as any).oldEnd());await expect(page.getByRole('button',{name:'Stop reading',exact:true})).toBeVisible();await page.evaluate(()=>(window as any).voiceFixture.finish());await expect(page.getByRole('button',{name:'Read voicemail',exact:true})).toBeVisible();
});
for(const action of ['delete','home','pagehide','incoming'] as const)test(`${action} retires voicemail speech`,async({page})=>{
 await page.getByRole('button',{name:'Read voicemail',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).voiceFixture.spoken.length)).toBe(1);const before=await page.evaluate(()=>(window as any).voiceFixture.cancels);
 if(action==='delete')await page.getByRole('button',{name:'Delete voicemail',exact:true}).click();else await page.evaluate(action=>window.dispatchEvent(new Event(action==='home'?'launcher-home':action==='incoming'?'alpha:dev-incoming-call':'pagehide')),action);
 await expect.poll(()=>page.evaluate(()=>(window as any).voiceFixture.cancels)).toBeGreaterThan(before);await expect(page.getByRole('button',{name:'Stop reading',exact:true})).toHaveCount(0);
});
test('without agent speech voicemail is not spoken and a retry with agent speech succeeds',async({page})=>{
 await page.evaluate(()=>(window as any).voiceFixture.ready=false);await page.getByRole('button',{name:'Read voicemail',exact:true}).click();await expect(page.getByRole('button',{name:'Read voicemail',exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as any).voiceFixture.spoken)).toEqual([]);await page.evaluate(()=>(window as any).voiceFixture.ready=true);await page.getByRole('button',{name:'Read voicemail',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).voiceFixture.spoken.length)).toBe(1);
});

test('device retirement clears playback state and permits immediate explicit replay',async({page})=>{
 await page.getByRole('button',{name:'Read voicemail',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).voiceFixture.spoken.length)).toBe(1);
 await page.evaluate(()=>window.dispatchEvent(new Event('alpha:device-state')));
 await expect(page.getByRole('button',{name:'Read voicemail',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Read voicemail',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).voiceFixture.spoken.length)).toBe(2);
});

test('leaving replaced voicemail does not stop another consumer',async({page})=>{
 await page.getByRole('button',{name:'Read voicemail',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).voiceFixture.spoken.length)).toBe(1);
 await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');const voice=registerPlugin<any>('AlphaVoiceCloud');await voice.play(await voice.synthesizeLocal({text:'Other consumer'}));});const before=await page.evaluate(()=>(window as any).voiceFixture.cancels);await page.evaluate(()=>window.dispatchEvent(new Event('launcher-home')));expect(await page.evaluate(()=>(window as any).voiceFixture.cancels)).toBe(before);
});
