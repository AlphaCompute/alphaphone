import {test,expect,type Page} from '@playwright/test';
import {silentMicrophone,localBrowserVoice,typedTranscript} from './voice-fixture';

// A reply to a voice-originated turn is read aloud only when Speak replies is on, through the
// local route, and can be stopped. The agent is a held synthetic transport; no model is called.
// The development server is shared and slow on a loaded machine.
test.describe.configure({timeout:120000});
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));});
async function setup(page:Page,speak:boolean){
 await page.goto('/');await page.getByRole('textbox',{name:'Ask Alpha',exact:true}).waitFor();
 await silentMicrophone(page);await localBrowserVoice(page);
 await page.evaluate(async(speak)=>{
  const {setSpeakReplies}=await import('/src/runtime/voice-selection.ts');setSpeakReplies(speak);
  const {alphaClient}=await import('/src/runtime/alpha-client.ts');const w=window as any;w.replyFixture={posts:0};
  alphaClient.attachVerifiedTransport({session:{ownerId:'fixture-owner',agentId:'fixture-agent',sessionId:'fixture-session',origin:'https://fixture.example'},
   send:({text,onText}:any)=>{w.replyFixture.posts++;w.replyFixture.text=text;onText('Thinking');return new Promise(resolve=>{w.replyFixture.finish=()=>resolve({text:'Your next event is at noon.'});});},
   execute:async()=>{throw Error('No action may execute');}});
 },speak);
}
async function voiceTurn(page:Page){
 await page.getByRole('button',{name:'Talk',exact:true}).first().click();
 await typedTranscript(page,'What is my next event?');
 await page.getByRole('button',{name:'Use in conversation',exact:true}).click();
 const composer=page.getByRole('textbox',{name:'Message Alpha',exact:true});
 await expect(composer).toHaveValue('What is my next event?');
 // Voice never sends by itself (P-01); the user sends.
 expect(await page.evaluate(()=>(window as any).replyFixture.posts)).toBe(0);
 await composer.press('Enter');
 await expect.poll(()=>page.evaluate(()=>(window as any).replyFixture.posts)).toBe(1);
 await page.evaluate(()=>(window as any).replyFixture.finish());
 await expect(page.locator('[data-alpha-layer="conversation"]').getByText('Your next event is at noon.',{exact:true})).toBeVisible();
}
const spoken=(page:Page)=>page.evaluate(()=>(window as any).voiceFixture.spoken as string[]);

test('Speak replies off: the reply is shown, not spoken',async({page})=>{
 await setup(page,false);await voiceTurn(page);
 await page.waitForTimeout(800);
 expect(await spoken(page)).toEqual([]);
});
test('Speak replies on: the final reply is spoken once with the local voice and can be stopped',async({page})=>{
 await setup(page,true);await voiceTurn(page);
 await expect.poll(()=>spoken(page)).toEqual(['Your next event is at noon.']);
 const stop=page.getByRole('button',{name:'Stop reading',exact:true});
 await expect(stop).toBeVisible();await stop.click();
 await expect(page.getByRole('button',{name:'Listen on phone',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).voiceFixture.cancels)).toBeGreaterThan(0);
 // A typed turn afterwards is not voice-originated and is not spoken.
 await page.evaluate(()=>{(window as any).voiceFixture.spoken.length=0;});
 const composer=page.getByRole('textbox',{name:'Message Alpha',exact:true});
 await composer.fill('Typed question');await composer.press('Enter');
 await expect.poll(()=>page.evaluate(()=>(window as any).replyFixture.posts)).toBe(2);
 await page.evaluate(()=>(window as any).replyFixture.finish());
 await page.waitForTimeout(800);
 expect(await spoken(page)).toEqual([]);
});
