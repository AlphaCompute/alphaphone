import {test,expect,type Page} from '@playwright/test';

// Controlled ports only. Physical microphone, playback and remote HTTP are blocked.
async function setup(page:Page,signedIn:boolean,development=false){
 await page.addInitScript(()=>{
  localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));
  const f=(window as any).voicePolicy={mic:0,plays:0,starts:0,stops:0,uploads:0,localProbes:0,syntheses:0,billing:true,requests:[]};
  if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{f.mic++;throw Error('Physical microphone forbidden in this fixture');};
  HTMLMediaElement.prototype.play=async()=>{f.plays++;throw Error('Physical playback forbidden in this fixture');};
  if(window.speechSynthesis)window.speechSynthesis.speak=()=>{f.plays++;throw Error('Device speech forbidden in this fixture');};
 });
 const remote:string[]=[];await page.route(/^https?:\/\/(?!127\.0\.0\.1:|localhost:)/,async route=>{remote.push(route.request().url());await route.abort();});
 await page.goto(development?'/?mode=dev':'/');
 await page.evaluate(async signed=>{
  const {BrowserVoice}=await import('/src/browser/voice.ts');const {connectionController:connection}=await import('/src/runtime/connection-ui.tsx');const f=(window as any).voicePolicy;
  connection.getCloudEnvironment=()=>signed?'production':null;
  connection.getCloudClient=()=>signed?{sessionId:'synthetic-account',credentialId:'synthetic-no-provider-credential'} as any:null;
  BrowserVoice.prototype.localSpeechStatus=async()=>{f.localProbes++;throw Error('Cloud default must never prepare local speech');};
  BrowserVoice.prototype.startRecording=async()=>{f.starts++;return {recordingId:'synthetic-browser-clip',maxDurationMs:59000};};
  BrowserVoice.prototype.stopRecording=async()=>{f.stops++;return {recordingId:'synthetic-browser-clip',durationMs:1000};};
  (BrowserVoice.prototype as any).transcribeRecording=async(input:unknown)=>{f.uploads++;f.requests.push(input);if(f.billing)throw Object.assign(Error('Synthetic billing refusal'),{code:'voice-http-402'});return {text:'Reviewed browser Cloud text',local:false};};
  (BrowserVoice.prototype as any).synthesize=async()=>{f.syntheses++;throw Error('No synthesis allowed in this fixture');};
  BrowserVoice.prototype.synthesizeLocal=async()=>{f.syntheses++;throw Error('No local synthesis allowed in this fixture');};
 },signedIn);
 return remote;
}
for(const development of [false,true])test(`unsigned Cloud voice connects its account without Notes or microphone: ${development?'development':'normal'} browser`,async({page})=>{
 const remote=await setup(page,false,development);await page.getByRole('button',{name:'Talk',exact:true}).click();const recorder=page.getByRole('region',{name:'Voice message',exact:true});await expect(recorder).toBeVisible();await expect(page.locator('[data-alpha-layer="app"][aria-label="Notes"]')).toHaveCount(0);await expect(recorder.getByRole('button',{name:'Connect Eliza Cloud',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:/Record without transcription|Use on-device voice|Use browser voice/})).toHaveCount(0);
 await recorder.getByRole('button',{name:'Connect Eliza Cloud',exact:true}).click();await expect(page.getByRole('dialog',{name:'Eliza Cloud',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Sign in with Eliza Cloud',exact:true})).toBeVisible();expect(await page.evaluate(()=>{const f=(window as any).voicePolicy;return {mic:f.mic,plays:f.plays,starts:f.starts,uploads:f.uploads,local:f.localProbes};})).toEqual({mic:0,plays:0,starts:0,uploads:0,local:0});expect(remote).toEqual([]);
 await page.getByRole('button',{name:'Close Cloud account',exact:true}).click();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Models',exact:true}).click();await expect(page.getByText('Conversation uses the selected agent. Voice uses Eliza Cloud.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Check on-device speech',exact:true})).toHaveCount(0);
});
test('browser Cloud recorder is stroke-based, uploads only explicitly and retains billing refusal without local fallback',async({page})=>{
 const remote=await setup(page,true,true);await page.getByRole('button',{name:'Talk',exact:true}).click();const recorder=page.getByRole('region',{name:'Voice message',exact:true}),start=recorder.getByRole('button',{name:'Start recording',exact:true});await expect(start).toBeEnabled();await expect(start.locator('[data-alpha-icon]')).toHaveAttribute('data-alpha-icon','/icons/lucide/mic.svg');expect(await start.locator('[data-alpha-icon]').evaluate(icon=>getComputedStyle(icon).maskImage)).toContain('/icons/lucide/mic.svg');
 await start.click();await expect(recorder.getByRole('button',{name:'Stop recording',exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as any).voicePolicy.uploads)).toBe(0);await recorder.getByRole('button',{name:'Stop recording',exact:true}).click();await expect(recorder.getByRole('button',{name:'Transcribe with Eliza Cloud',exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as any).voicePolicy.uploads)).toBe(0);
 await recorder.getByRole('button',{name:'Transcribe with Eliza Cloud',exact:true}).click();await expect(recorder.getByRole('status',{name:'Voice message status',exact:true})).toContainText('Add credits in Settings');expect(await page.evaluate(()=>(window as any).voicePolicy.uploads)).toBe(1);await page.evaluate(()=>(window as any).voicePolicy.billing=false);await recorder.getByRole('button',{name:'Transcribe with Eliza Cloud',exact:true}).click();await expect(recorder.getByRole('textbox',{name:'Review transcript',exact:true})).toHaveValue('Reviewed browser Cloud text');await recorder.getByRole('button',{name:'Use in conversation',exact:true}).click();await expect(recorder).toHaveCount(0);await expect(page.getByRole('textbox',{name:'Ask Alpha',exact:true})).toHaveValue('Reviewed browser Cloud text');await expect(page.locator('[data-alpha-layer="app"][aria-label="Notes"]')).toHaveCount(0);
 expect(await page.evaluate(()=>{const f=(window as any).voicePolicy;return {mic:f.mic,plays:f.plays,starts:f.starts,uploads:f.uploads,local:f.localProbes,syntheses:f.syntheses,environment:f.requests[0].environment,credentialId:f.requests[0].credentialId};})).toEqual({mic:0,plays:0,starts:1,uploads:2,local:0,syntheses:0,environment:'production',credentialId:'synthetic-no-provider-credential'});expect(remote).toEqual([]);
});
