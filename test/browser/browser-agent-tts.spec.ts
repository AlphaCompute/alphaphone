import {test,expect} from '@playwright/test';

// Transport fixtures isolate renderer lifecycle; the recording suite separately uses real host synthesis.
function wav(){const b=Buffer.alloc(16044);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(16000,40);return b.toString('base64');}
test.beforeEach(async({page})=>{
 test.skip(process.env.VITE_LOCAL_AGENT!=='1','Requires the local-agent bridge profile');
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto('/');
 await page.evaluate(async()=>{
  const {LocalAgentProtocol}=await import('/src/runtime/local-agent.ts');const {connectionController}=await import('/src/runtime/connection-ui.tsx');
  const {registerPlugin}=await import('/src/platform-plugins.ts');const client=new LocalAgentProtocol();
  (client as any).session={ownerId:'fixture-owner',agentId:'fixture-agent',sessionId:'fixture-session',origin:client.origin};
  connectionController.getBrowserSpeechAgent=()=>client;
  let fallbacks=0;speechSynthesis.speak=()=>{fallbacks++;};
  (window as any).ttsFixture={client,voice:registerPlugin<any>('AlphaVoiceCloud'),fallbacks:()=>fallbacks};
 });
});
for(const outcome of ['cancel','disconnect','wrong-id','invalid-audio','unavailable'] as const)test(`local agent TTS rejects ${outcome} without browser voice fallback`,async({page})=>{
 let received=false,release=()=>{};
 await page.route('**/__alpha-local-agent',async route=>{
  const input=route.request().postDataJSON();expect(input.path).toBe('/api/tts/paradee');expect(input.ownerId).toBe('fixture-owner');expect(JSON.parse(input.body)).toEqual({text:'Test local speech.'});received=true;
  if(outcome==='cancel'||outcome==='disconnect')await new Promise<void>(resolve=>{release=resolve;});
  await route.fulfill({json:{status:outcome==='unavailable'?503:200,body:JSON.stringify({requestId:outcome==='wrong-id'?'wrong':input.requestId,provider:'libelizainference-paradee',contentType:'audio/wav',audioBase64:outcome==='invalid-audio'?btoa('invalid'):wav()})}}).catch(()=>{});
 });
 await page.evaluate(()=>{const f=(window as any).ttsFixture;f.result=f.voice.synthesizeLocal({text:'Test local speech.'}).then(()=>({rejected:false}), (error:Error)=>({rejected:true,name:error.name}));});
 await expect.poll(()=>received).toBe(true);
 if(outcome==='cancel')await page.evaluate(()=>(window as any).ttsFixture.voice.cancel());
 if(outcome==='disconnect')await page.evaluate(()=>(window as any).ttsFixture.client.disconnect());
 release();
 const result=await page.evaluate(async()=>{const f=(window as any).ttsFixture;return {...await f.result,fallbacks:f.fallbacks(),state:await f.voice.state()};});
 expect(result).toMatchObject({rejected:true,fallbacks:0,state:{playing:false}});
 if(outcome==='cancel'||outcome==='disconnect')expect(result.name).toBe('AbortError');
});
test('prepared agent audio cannot play after the bound session disconnects',async({page})=>{
 await page.route('**/__alpha-local-agent',async route=>{const input=route.request().postDataJSON();await route.fulfill({json:{status:200,body:JSON.stringify({requestId:input.requestId,provider:'libelizainference-paradee',contentType:'audio/wav',audioBase64:wav()})}});});
 const result=await page.evaluate(async()=>{const f=(window as any).ttsFixture,prepared=await f.voice.synthesizeLocal({text:'Test local speech.'});await f.client.disconnect();let rejected=false;try{await f.voice.play(prepared);}catch{rejected=true;}return {rejected,fallbacks:f.fallbacks(),state:await f.voice.state()};});
 expect(result).toMatchObject({rejected:true,fallbacks:0,state:{playing:false}});
});

test('selected host ASR accepts the reviewed text/provider response without a fabricated echo',async({page})=>{
 const seen:string[]=[];
 await page.route('**/__alpha-local-agent',async route=>{const input=route.request().postDataJSON();seen.push(input.path);expect(input.ownerId).toBe('fixture-owner');if(input.method==='POST')expect(input.requestId).toMatch(/^[0-9a-f-]{36}$/);await route.fulfill({json:{status:200,body:JSON.stringify(input.method==='GET'?{provider:'local-inference',ready:true}:{provider:'local-inference',text:'Keep this as a draft.'})}});});
 const result=await page.evaluate(async()=>{const client=(window as any).ttsFixture.client,signal=new AbortController().signal;return {status:await client.speechRequest(undefined,signal),transcript:await client.speechRequest(new Uint8Array([1,2,3]),signal)};});
 expect(result).toEqual({status:{provider:'local-inference',ready:true},transcript:{provider:'local-inference',text:'Keep this as a draft.'}});
 expect(seen).toEqual(['/api/asr/libelizainference/status','/api/asr/libelizainference']);
});
