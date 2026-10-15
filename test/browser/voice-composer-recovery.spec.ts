import {test,expect,type Page} from '@playwright/test';

// A synthetic voice delegate exercises the real adapter/template without capturing audio,
// opening a speech connection or submitting a provider/model request.
async function setup(page:Page){
 await page.route('https://**/*',route=>route.abort());
 await page.route('**/src/runtime/development-cartesia-conversation.ts*',route=>route.fulfill({contentType:'application/javascript',body:`
 export const developmentCartesiaVoiceEnabled=true;
 export async function developmentCartesiaConversation(input){
  const f=window.voicePresentationFixture;let muted=false;
  f.partial=text=>input.onTranscript(text);
  return {start:async()=>{f.starts++;input.onState('listening');},stop:async()=>{f.stops++;},recheck:()=>{},resume:()=>false,
   get microphoneMuted(){return muted;},setMicrophoneMuted:value=>{muted=value;f.muted=value;},needsPlaybackUnlock:false,unlockPlayback:async()=>{}};
 }`}));
 await page.addInitScript(()=>{
  localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));
  (window as any).voicePresentationFixture={starts:0,stops:0,media:0,sends:0,muted:false};
  if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{(window as any).voicePresentationFixture.media++;throw Error('Actual microphone forbidden in synthetic presentation test');};
 });
 await page.goto('/');await expect(page.locator('textarea[data-alpha-composer]')).toBeEnabled();
 await page.evaluate(async()=>{
  const {connectionController:c}=await import('/src/runtime/connection-ui.tsx'),{Component}=await import('/src/prototype/model.js');
  const f=(window as any).voicePresentationFixture;
  const snapshot={...c.getSnapshot(),open:false,busy:false,session:{origin:'https://owned.invalid',ownerId:'owner',agentId:'agent',sessionId:'synthetic-agent'}};
  c.getSnapshot=()=>snapshot as any;c.getCloudEnvironment=()=>'production';c.getCloudClient=()=>({sessionId:'synthetic-cloud',credentialId:'synthetic-credential',client:{}} as any);
  Component.prototype.prepareVoiceConversation=async function(signal:any){signal.throwIfAborted();return {binding:{conversationId:'synthetic-room',session:{sessionId:'synthetic-agent'},connectionEpoch:1},context:{view:this.S().view||'home',revision:1,sensitive:false}};};
  Component.prototype.voiceConversationCurrent=()=>true;
  Component.prototype.voiceConversationContext=function(){return {view:this.S().view||'home',revision:1,sensitive:false};};
  Component.prototype.sendVoiceTurn=async()=>{f.sends++;throw Error('Synthetic presentation must not send');};
  const render=Component.prototype.renderVals;Component.prototype.renderVals=function(){f.shell=this;return render.call(this);};c.close();
 });
 await expect.poll(()=>page.evaluate(()=>!!(window as any).voicePresentationFixture.shell)).toBe(true);
}
async function noMediaOrSends(page:Page){expect(await page.evaluate(()=>{const f=(window as any).voicePresentationFixture;return {media:f.media,sends:f.sends};})).toEqual({media:0,sends:0});}

test('synthetic voice: one idle mic, full-width synth, mute and Stop preserve visible chat',async({page},info)=>{
 await setup(page);await expect(page.getByRole('button',{name:'Talk',exact:true})).toHaveCount(1);await expect(page.getByRole('button',{name:'Transcribe',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Open conversation',exact:true}).click();
 const before=await page.evaluate(()=>(window as any).voicePresentationFixture.shell.S().chat);
 await expect.poll(()=>page.evaluate(()=>(window as any).voicePresentationFixture.shell.swallowed())).toBe(false);await page.getByRole('button',{name:'Talk',exact:true}).click();
 const voice=page.locator('.alpha-voice-composer');await expect(voice).toHaveAttribute('data-voice-state','listening');
 await expect(page.locator('[data-alpha-transcript]')).toBeVisible();await expect(voice.locator('[data-alpha-voice-bar]')).toHaveCount(35);
 await expect(voice.getByRole('button',{name:'Switch to keyboard',exact:true})).toHaveCount(0);
 const widths=await voice.evaluate(element=>{const input=element.querySelector('.alpha-voice-input')!.getBoundingClientRect(),synth=element.querySelector('[data-alpha-voice-animation]')!.getBoundingClientRect();return {input:input.width,synth:synth.width};});expect(widths.synth).toBeGreaterThan(100);expect(Math.abs(widths.input-widths.synth)).toBeLessThan(1);
 await page.evaluate(()=>(window as any).voicePresentationFixture.partial('Synthetic live words'));
 await expect(page.locator('[data-alpha-transcript] [data-alpha-voice-interim]')).toHaveText('Synthetic live words');
 await voice.getByRole('button',{name:'Mute microphone',exact:true}).click();await expect(voice.getByRole('button',{name:'Unmute microphone',exact:true})).toHaveAttribute('aria-pressed','true');
 await voice.getByRole('button',{name:'Unmute microphone',exact:true}).click();expect(await page.evaluate(()=>(window as any).voicePresentationFixture.muted)).toBe(false);
 await page.screenshot({path:info.outputPath('synthetic-inline-voice.png'),animations:'disabled'});
 await voice.getByRole('button',{name:'Stop voice conversation',exact:true}).click();await expect(voice).toHaveCount(0);expect(await page.evaluate(()=>(window as any).voicePresentationFixture.shell.S().chat)).toBe(before);await expect(page.locator('[data-alpha-layer="conversation"]')).toBeVisible();await noMediaOrSends(page);
});

test('synthetic pill voice keeps five-bar synth, mute and Stop compact without opening chat',async({page},info)=>{
 await setup(page);await page.evaluate(()=>new Promise<void>(resolve=>(window as any).voicePresentationFixture.shell.setState({chat:'hidden'},resolve)));
 await page.getByRole('button',{name:'Talk',exact:true}).click();
 const pill=page.locator('[data-alpha-pill-voice]');await expect(pill).toBeVisible();await expect(pill.locator('[data-alpha-voice-bar]')).toHaveCount(5);
 expect(await page.evaluate(()=>(window as any).voicePresentationFixture.shell.S().chat)).toBe('hidden');
 await expect(pill.getByRole('button',{name:'Type',exact:true})).toHaveCount(0);
 await pill.getByRole('button',{name:'Mute microphone',exact:true}).click();await expect(pill.getByRole('button',{name:'Unmute microphone',exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('synthetic-pill-voice.png'),animations:'disabled'});
 await pill.getByRole('button',{name:'Stop voice conversation',exact:true}).click();await expect(pill).toHaveCount(0);expect(await page.evaluate(()=>(window as any).voicePresentationFixture.shell.S().chat)).toBe('hidden');await noMediaOrSends(page);
});
