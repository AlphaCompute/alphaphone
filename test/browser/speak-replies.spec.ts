import {test,expect} from '@playwright/test';
import {installCloudVoiceFixture} from './cloud-voice-fixture';

// Main's ongoing Cloud conversation has its own playback lifecycle (chat-voice-mode.spec.ts).
// The older manual-chat Speak replies preference is not a production control. Retained
// preference records must never cause a typed conversation to start audio. MVP-01 tracks
// the unresolved manual-send policy; these tests do not claim that old flow is implemented.
for(const enabled of [false,true])test(`legacy Speak replies ${enabled?'on':'off'} never autoplays a typed reply`,async({page})=>{
 await page.route(/^https?:\/\/(?!127\.0\.0\.1:|localhost:)/,route=>route.abort());
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto('/');
 await installCloudVoiceFixture(page,'Unused synthetic transcript',true);
 await page.evaluate(async enabled=>{
  const {setSpeakReplies}=await import('/src/runtime/voice-selection.ts');setSpeakReplies(enabled);
  const {alphaClient}=await import('/src/runtime/alpha-client.ts');
  const f=(window as any).typedReplyFixture={posts:0};
  alphaClient.attachVerifiedTransport({session:{ownerId:'fixture-owner',agentId:'fixture-agent',sessionId:'fixture-session',origin:'https://fixture.example'},
   send:async({onText}:any)=>{f.posts++;onText('Thinking');return {text:'Your next event is at noon.'};},
   execute:async()=>{throw Error('No action may execute');}});
 },enabled);
 const input=page.getByRole('textbox',{name:'Ask Alpha',exact:true});await input.fill('What is my next event?');await input.press('Enter');
 await expect(page.locator('[data-alpha-layer="conversation"]').getByText('Your next event is at noon.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Stop reply',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>({posts:(window as any).typedReplyFixture.posts,speech:(window as any).cloudVoiceFixture.speech}))).toEqual({posts:1,speech:[]});
});
