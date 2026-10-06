import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));});
async function attach(page:any,real=false){
 await page.goto('/');
 await page.evaluate(async(real:boolean)=>{
  const {LocalAgentProtocol}=await import('/src/runtime/local-agent.ts');
  const {connectionController}=await import('/src/runtime/connection-ui.tsx');
  const client=new LocalAgentProtocol();
  if(real){await connectionController.startLocal();if(!connectionController.getBrowserSpeechAgent())throw Error('Local connection did not activate');return;}
  else client.session={ownerId:'fixture-owner',agentId:'fixture-agent',sessionId:'fixture-session',origin:client.origin};
  if(!client.browserSpeechAvailable)throw Error('Run with VITE_LOCAL_AGENT=1');
  connectionController.getBrowserSpeechAgent=()=>client;
  (window as any).speechClient=client;
 },real);
}
test('PCM conversion resamples stereo, preserves duration and rejects cancellation',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {recordingPcmWav}=await import('/src/browser/recording-pcm.ts');
  const samples=4800,bytes=new Uint8Array(44+samples*4),v=new DataView(bytes.buffer);
  for(const [offset,text] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']] as const)for(let i=0;i<text.length;i++)bytes[offset+i]=text.charCodeAt(i);
  v.setUint32(4,bytes.length-8,true);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,48000,true);v.setUint32(28,192000,true);v.setUint16(32,4,true);v.setUint16(34,16,true);v.setUint32(40,samples*4,true);
  for(let i=0;i<samples;i++){v.setInt16(44+i*4,16000,true);v.setInt16(46+i*4,0,true);}
  const blob=new Blob([bytes],{type:'audio/wav'}),out=await recordingPcmWav(blob,new AbortController().signal),wav=new DataView(out.buffer);
  const controller=new AbortController();controller.abort();let cancelled=false;try{await recordingPcmWav(blob,controller.signal);}catch(e){cancelled=(e as Error).name==='AbortError';}
  return {rate:wav.getUint32(24,true),channels:wav.getUint16(22,true),samples:wav.getUint32(40,true)/2,middle:wav.getInt16(44+800*2,true),cancelled};
 });expect(result.rate).toBe(16000);expect(result.channels).toBe(1);expect(result.samples).toBe(1600);expect(result.middle).toBeCloseTo(8000,-1);expect(result.cancelled).toBe(true);
});
for(const outcome of ['review','cancel','disconnect'] as const)test(`rendered browser recording transcribes through local agent: ${outcome}`,async({page})=>{
 test.skip(process.env.VITE_LOCAL_AGENT!=='1','Requires the browser local-agent development profile');
 let calls=0,release:()=>void=()=>{};
 await page.route('**/__alpha-local-agent',async route=>{
  const input=route.request().postDataJSON();
  if(input.path==='/api/asr/whisper/status'){await route.fulfill({json:{status:200,body:JSON.stringify({ready:true,provider:'standalone-whisper.cpp'})}});return;}
  if(input.path==='/api/asr/whisper'){
   calls++;expect(input.ownerId).toBe('fixture-owner');const audio=Buffer.from(input.audioBase64,'base64');expect(audio.toString('ascii',0,4)).toBe('RIFF');expect(audio.readUInt32LE(24)).toBe(16000);expect(audio.readUInt16LE(22)).toBe(1);expect(audio.length).toBeGreaterThan(1000);
   if(outcome!=='review')await new Promise<void>(resolve=>{release=resolve;});
   await route.fulfill({json:{status:200,body:JSON.stringify({text:'Transcribed fixture recording',local:true,requestId:input.requestId,provider:'standalone-whisper.cpp'})}}).catch(()=>{});return;
  }
  await route.abort();
 });
 await attach(page);
 await page.evaluate(async()=>{const ctx=new AudioContext(),osc=ctx.createOscillator(),sink=ctx.createMediaStreamDestination();osc.connect(sink);osc.start();await ctx.resume();Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>sink.stream}});(window as any).source={ctx,osc};});
 await page.getByRole('button',{name:'Notes',exact:true}).click();await page.getByRole('button',{name:'Record and transcribe',exact:true}).click();
 await page.getByRole('button',{name:'Start recording',exact:true}).click();await page.waitForTimeout(400);await page.getByRole('button',{name:'Stop recording',exact:true}).click();
 await page.getByRole('button',{name:'Transcribe on this computer',exact:true}).click();await expect.poll(()=>calls).toBe(1);
 if(outcome==='cancel')await page.getByRole('button',{name:'Cancel transcription',exact:true}).click();
 if(outcome==='disconnect')await page.evaluate(()=>(window as any).speechClient.disconnect());
 release();
 if(outcome==='review'){await expect(page.getByRole('textbox',{name:'Review transcript',exact:true})).toHaveValue('Transcribed fixture recording');await expect(page.getByRole('dialog',{name:'Recording transcript'})).toHaveCount(0);}
 else{await expect(page.getByRole('textbox',{name:'Review transcript',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Cancel transcription',exact:true})).toHaveCount(0);}
 await page.evaluate(async()=>{(window as any).source.osc.stop();await (window as any).source.ctx.close();});
});

test('real browser capture transcribes synthetic speech through the actual local agent',async({page})=>{
 // This journey records, transcribes, and synthesizes three separate playbacks.
 // Preserve each stage's deadline without truncating it at the suite's 30s default.
 test.setTimeout(120000);
 test.skip(!process.env.ALPHA_SPEECH_FIXTURE,'Provide a locally generated synthetic WAV for the real host service check');
 await attach(page,true);
 const bytes=readFileSync(process.env.ALPHA_SPEECH_FIXTURE!).toString('base64');
 await page.evaluate(async(encoded)=>{
  const ctx=new AudioContext(),buffer=await ctx.decodeAudioData(Uint8Array.from(atob(encoded),x=>x.charCodeAt(0)).buffer),source=ctx.createBufferSource(),sink=ctx.createMediaStreamDestination();source.buffer=buffer;source.connect(sink);await ctx.resume();
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{setTimeout(()=>source.start(),150);return sink.stream;}}});(window as any).spoken={ctx,duration:buffer.duration};
 },bytes);
 await page.getByRole('button',{name:'Notes',exact:true}).click();await page.getByRole('button',{name:'Record and transcribe',exact:true}).click();await page.getByRole('button',{name:'Start recording',exact:true}).click();
 const duration=await page.evaluate(()=>(window as any).spoken.duration);await page.waitForTimeout(duration*1000+400);
 await page.getByRole('button',{name:'Stop recording',exact:true}).click();await page.getByRole('button',{name:'Transcribe on this computer',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Review transcript',exact:true})).toHaveValue(/water the plants tomorrow morning/i,{timeout:20000});
 await page.evaluate(async()=>{
  const {registerPlugin}=await import('/src/platform-plugins.ts');const voice=registerPlugin<any>('AlphaVoiceCloud');
  const events:any[]=[],revoked:string[]=[];const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{revoked.push(url);revoke(url);};
  await voice.addListener('playbackEnded',(event:any)=>events.push(event));(window as any).agentPlayback={voice,events,revoked};
 });
 await page.getByRole('button',{name:'Listen to transcript',exact:true}).click();
 await expect.poll(()=>page.evaluate(async()=>(await (window as any).agentPlayback.voice.state()).playing),{timeout:20000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).agentPlayback.events.length),{timeout:15000}).toBeGreaterThan(0);
 expect(await page.evaluate(()=>(window as any).agentPlayback.revoked.length)).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Listen to transcript',exact:true}).click();
 await expect.poll(()=>page.evaluate(async()=>(await (window as any).agentPlayback.voice.state()).playing),{timeout:20000}).toBe(true);
 await page.getByRole('button',{name:'Stop audio',exact:true}).click();
 await expect.poll(()=>page.evaluate(async()=>(await (window as any).agentPlayback.voice.state()).playing)).toBe(false);
 await page.screenshot({path:test.info().outputPath('real-local-agent-transcript.png')});
 await page.getByRole('button',{name:'Listen to transcript',exact:true}).click();
 await expect.poll(()=>page.evaluate(async()=>(await (window as any).agentPlayback.voice.state()).playing),{timeout:20000}).toBe(true);
 await page.evaluate(async()=>{const {connectionController}=await import('/src/runtime/connection-ui.tsx');await connectionController.offline();});
 await expect.poll(()=>page.evaluate(async()=>(await (window as any).agentPlayback.voice.state()).playing)).toBe(false);
 await page.evaluate(()=>(window as any).spoken.ctx.close());
});

test('first host speech request plays without a readiness probe',async({page})=>{
 test.skip(process.env.ALPHA_REAL_KOKORO!=='1','Opt in against a freshly restarted real local host');
 test.setTimeout(150000);
 const speechRequests:string[]=[];
 page.on('request',request=>{if(request.url().endsWith('/__alpha-local-agent')){const input=request.postDataJSON();if(input?.path?.startsWith('/api/tts/'))speechRequests.push(input.path);}});
 // Agent boot is separate from speech readiness; never call TTS status here.
 await expect.poll(async()=>{try{return (await page.request.get('/',{timeout:2000})).ok();}catch{return false;}},{timeout:60000}).toBe(true);
 await page.goto('/');
 await expect.poll(()=>page.evaluate(async()=>{
  try{const response=await fetch('/__alpha-local-agent',{method:'POST',headers:{'Content-Type':'application/json','X-Alpha-Local-Agent':'1'},body:JSON.stringify({path:'/api/agents',method:'GET'})});const envelope=await response.json();const agents=JSON.parse(envelope.body||'{}').agents;return envelope.status===200&&agents?.length===1&&agents[0].status==='running';}catch{return false;}
 }),{timeout:90000}).toBe(true);
 await attach(page,true);
 const result=await page.evaluate(async()=>{
  const {registerPlugin}=await import('/src/platform-plugins.ts');
  const voice=registerPlugin<any>('AlphaVoiceCloud');
  const started=performance.now();let completed=false;
  const listener=await voice.addListener('playbackEnded',()=>{completed=true;});
  try{
   const prepared=await voice.synthesizeLocal({text:'Local speech is ready.'});
   await voice.play({playbackId:prepared.playbackId});
   const playing=(await voice.state()).playing;
   const firstPlaybackMs=Math.round(performance.now()-started);
   const deadline=performance.now()+15000;
   while(!completed&&performance.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));
   return {playing,completed,firstPlaybackMs};
  }finally{await listener.remove();await voice.releaseLocalSpeech();}
 });
 expect(speechRequests).toEqual(['/api/tts/kokoro']);
 expect(result.playing).toBe(true);expect(result.completed).toBe(true);
 await test.info().attach('first-host-playback',{body:JSON.stringify(result),contentType:'application/json'});
});
