import {test,expect,type Page} from '@playwright/test';

const voice=(page:Page)=>page.getByRole('region',{name:'Voice message',exact:true});
async function setup(page:Page,signed=true,theme='light'){
 await page.route('https://**/*',route=>route.abort());
 await page.addInitScript(()=>{
  localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));
  const f=(window as any).chatVoiceFixture={owner:'a',starts:0,stops:0,uploads:0,cancels:0,media:0,playback:0,localProbes:0,active:null,holdStart:false,holdTranscript:false};
  if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{f.media++;throw Error('This test forbids microphone access');};
 });
 await page.goto('/?theme='+theme);
 await expect(page.locator('textarea[data-alpha-composer]')).toBeEnabled();
 await page.evaluate(async signed=>{
  const {BrowserVoice}=await import('/src/browser/voice.ts'),{connectionController:c}=await import('/src/runtime/connection-ui.tsx'),{Component}=await import('/src/prototype/model.js');
  const f=(window as any).chatVoiceFixture;
  c.getCloudEnvironment=()=>signed?'production':null;c.getCloudClient=()=>signed?({sessionId:'synthetic-cloud-'+f.owner,credentialId:'synthetic-credential-'+f.owner,client:{}} as any):null;
  BrowserVoice.prototype.startRecording=async()=>{const index=++f.starts;if(f.holdStart&&index===1)await new Promise<void>(resolve=>f.releaseStart=resolve);f.active='synthetic-clip-'+index;return {recordingId:f.active,maxDurationMs:59000};};
  BrowserVoice.prototype.stopRecording=async()=>{f.stops++;f.active=null;return {recordingId:'synthetic-clip-'+f.starts,durationMs:1000};};
  BrowserVoice.prototype.cancelRecording=async()=>{f.cancels++;f.active=null;};
  BrowserVoice.prototype.transcribeRecording=async input=>{f.uploads++;f.transcription=input;if(f.holdTranscript)await new Promise<void>(resolve=>f.releaseTranscript=resolve);return {text:'Synthetic Cloud transcript',local:false};};
  BrowserVoice.prototype.localSpeechStatus=async()=>{f.localProbes++;throw Error('This test forbids local speech preparation');};
  BrowserVoice.prototype.transcribeLocalRecording=async()=>{throw Error('This test forbids local transcription');};
  BrowserVoice.prototype.play=async()=>{f.playback++;throw Error('This test forbids playback');};
  BrowserVoice.prototype.stopPlayback=async()=>{};
  const render=Component.prototype.renderVals;Component.prototype.renderVals=function(){f.shell=this;return render.call(this);};c.close();
 },signed);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).chatVoiceFixture.shell)).toBe(true);
}
async function recordAndReview(page:Page){
 await voice(page).getByRole('button',{name:'Start recording',exact:true}).click();await expect(voice(page)).toHaveAttribute('data-voice-state','recording');
 await voice(page).getByRole('button',{name:'Stop recording',exact:true}).click();await expect(voice(page)).toHaveAttribute('data-voice-state','recorded');
 await voice(page).getByRole('button',{name:'Transcribe with Eliza Cloud',exact:true}).click();
}
async function noAudio(page:Page){expect(await page.evaluate(()=>{const f=(window as any).chatVoiceFixture;return {media:f.media,playback:f.playback,local:f.localProbes};})).toEqual({media:0,playback:0,local:0});}

test('unsigned chat voice stays in Home and offers only explicit Cloud sign-in',async({page})=>{
 await setup(page,false);await page.getByRole('button',{name:'Talk',exact:true}).click();await expect(voice(page)).toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-active-view','home');
 await expect(voice(page).getByRole('button',{name:'Connect Eliza Cloud',exact:true})).toBeEnabled();await expect(page.locator('[data-alpha-subview="notes-recording"]')).toHaveCount(0);await expect(page.locator('[data-alpha-transcript]')).toBeHidden();await expect(page.locator('textarea[data-alpha-composer]')).toHaveCount(0);
 await voice(page).getByRole('button',{name:'Cancel voice message',exact:true}).click();await expect(voice(page)).toHaveCount(0);await expect(page.locator('textarea[data-alpha-composer]')).toBeVisible();await noAudio(page);
});

test('reviewed chat transcript preserves the app, history and existing draft without saving Notes or sending',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Calendar',exact:true}).click();
 await page.evaluate(()=>new Promise<void>(resolve=>{const f=(window as any).chatVoiceFixture;f.shell.setState({chat:'hidden',draft:'Existing draft',msgs:[{id:'synthetic-owned-message',from:'agent',text:'Earlier synthetic message'}]},()=>{f.notes=JSON.stringify(f.shell.vget('notes'));f.history=JSON.stringify(f.shell.S().msgs);resolve();});}));
 await page.getByRole('button',{name:'Talk',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-active-view','calendar');await recordAndReview(page);await expect(voice(page).getByRole('textbox',{name:'Review transcript',exact:true})).toHaveValue('Synthetic Cloud transcript');
 await voice(page).getByRole('textbox',{name:'Review transcript',exact:true}).fill('Reviewed transcript');await voice(page).getByRole('button',{name:'Use in conversation',exact:true}).click();await expect(voice(page)).toHaveCount(0);await expect(page.locator('html')).toHaveAttribute('data-active-view','calendar');await expect(page.locator('textarea[data-alpha-composer]')).toHaveValue('Existing draft\nReviewed transcript');
 expect(await page.evaluate(()=>{const f=(window as any).chatVoiceFixture;return {notes:JSON.stringify(f.shell.vget('notes'))===f.notes,history:JSON.stringify(f.shell.S().msgs)===f.history,starts:f.starts,uploads:f.uploads,typing:!!f.shell.S().typing};})).toEqual({notes:true,history:true,starts:1,uploads:1,typing:false});await noAudio(page);
});

test('cancel restores the prior pill detent and unsent draft',async({page})=>{
 await setup(page);await page.evaluate(()=>{const f=(window as any).chatVoiceFixture;f.shell.setState({chat:'hidden',draft:'Keep this draft'});});await page.getByRole('button',{name:'Talk',exact:true}).click();await expect(voice(page)).toBeVisible();await voice(page).getByRole('button',{name:'Cancel voice message',exact:true}).click();
 expect(await page.evaluate(()=>{const s=(window as any).chatVoiceFixture.shell.S();return {view:s.view,chat:s.chat,draft:s.draft};})).toEqual({view:null,chat:'hidden',draft:'Keep this draft'});await expect(page.getByRole('button',{name:'Talk',exact:true})).toBeVisible();await noAudio(page);
});

test('an account change retires the chat transcript without applying a late result',async({page})=>{
 await setup(page);await page.evaluate(()=>(window as any).chatVoiceFixture.holdTranscript=true);await page.getByRole('button',{name:'Talk',exact:true}).click();await recordAndReview(page);await expect(voice(page)).toHaveAttribute('data-voice-state','transcribing');
 await page.evaluate(async()=>{const f=(window as any).chatVoiceFixture;f.owner='b';(await import('/src/runtime/connection-ui.tsx')).connectionController.close();});await expect(voice(page)).toHaveCount(0);await page.evaluate(()=>(window as any).chatVoiceFixture.releaseTranscript());await expect(page.locator('textarea[data-alpha-composer]')).toHaveValue('');await noAudio(page);
});

test('a late capture start settles and cancels before the next chat capture starts',async({page})=>{
 await setup(page);await page.evaluate(()=>(window as any).chatVoiceFixture.holdStart=true);await page.getByRole('button',{name:'Talk',exact:true}).click();await voice(page).getByRole('button',{name:'Start recording',exact:true}).click();await expect.poll(()=>page.evaluate(()=>typeof(window as any).chatVoiceFixture.releaseStart)).toBe('function');await voice(page).getByRole('button',{name:'Cancel voice message',exact:true}).click();
 await page.getByRole('button',{name:'Talk',exact:true}).click();await voice(page).getByRole('button',{name:'Start recording',exact:true}).click();expect(await page.evaluate(()=>(window as any).chatVoiceFixture.starts)).toBe(1);await page.evaluate(()=>{const f=(window as any).chatVoiceFixture;f.holdStart=false;f.releaseStart();});await expect(voice(page)).toHaveAttribute('data-voice-state','recording');expect(await page.evaluate(()=>{const f=(window as any).chatVoiceFixture;return {starts:f.starts,active:f.active};})).toEqual({starts:2,active:'synthetic-clip-2'});await voice(page).getByRole('button',{name:'Cancel voice message',exact:true}).click();await noAudio(page);
});

for(const theme of ['light','dark'])test(`compact chat header and voice controls retain half/full geometry: ${theme}`,async({page},info)=>{
 await setup(page,true,theme);await page.getByRole('button',{name:'Talk',exact:true}).click();
 for(const detent of ['half','full']){
  if(detent==='full')await page.getByRole('button',{name:'Expand chat',exact:true}).click();
  await page.locator('[data-alpha-layer="conversation"]').evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
  const geometry=await page.evaluate(()=>{const panel=document.querySelector('[data-alpha-layer="conversation"]')!.getBoundingClientRect(),brand=document.querySelector('[data-alpha-chat-home]')!.getBoundingClientRect(),grab=document.querySelector('[aria-label="Resize chat"]')!.getBoundingClientRect(),header=document.querySelector('[data-alpha-chat-header]')!.getBoundingClientRect(),controls=document.querySelector('[data-alpha-chat-controls]')!.getBoundingClientRect(),mark=document.querySelector('[aria-label="Resize chat"] span')!.getBoundingClientRect(),primary=document.querySelector('[data-alpha-chat-recorder] button[aria-label="Start recording"]')!.getBoundingClientRect();return {brandOffset:brand.top-panel.top,brandHeight:brand.height,grabHeight:grab.height,grabWidth:grab.width,center:Math.abs((grab.left+grab.right)/2-(panel.left+panel.right)/2),markOffset:mark.top-panel.top,disjoint:brand.right<=grab.left+.5&&grab.right<=controls.left+.5,primaryFits:primary.bottom<=panel.bottom&&primary.left>=panel.left&&primary.right<=panel.right,headerHeight:header.height};});
  expect(geometry.brandOffset).toBeLessThanOrEqual(8);expect(geometry.markOffset).toBeLessThanOrEqual(14);expect(geometry.center).toBeLessThan(1);expect(geometry).toMatchObject({brandHeight:44,grabHeight:44,grabWidth:44,disjoint:true,primaryFits:true,headerHeight:48});
  await page.screenshot({path:info.outputPath('chat-voice-'+theme+'-'+detent+'.png'),animations:'disabled'});
 }
 await voice(page).getByRole('button',{name:'Cancel voice message',exact:true}).click();await noAudio(page);
});
