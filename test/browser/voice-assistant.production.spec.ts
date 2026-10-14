import {test,expect,type Page} from '@playwright/test';
import {flagOffAndroid,residentHome,fenceNetwork,button} from './flag-off-android';
// #423 in the flag-off renderer: Transcribe (dictation) and Talk (voice assistant) are separate
// controls over the native live capture. Synthetic ports only: the AlphaVoiceCloud live capture
// (frames and Silero VAD edges), the resident agent's live ASR route and local playback. This is
// routing, lifecycle and accounting evidence, not microphone, echo, JNI, model or device evidence.
async function setup(page:Page){
 const foreign=await fenceNetwork(page);await flagOffAndroid(page);
 await page.addInitScript(()=>{
  const w=window as any,c=w.Capacitor,prior=c.nativePromise;
  // Voice replies need correlated message identities; the generic chat fixture omits them.
  const emit=w.flagOff.emit;let reply=0;w.flagOff.emit=(plugin:string,event:string,value:any)=>{
   if(plugin==='Agent'&&event==='alphaAgentStream'&&value.event?.type==='chunk'){
    const data=JSON.parse(atob(value.event.dataBase64).slice(6));
    if(data.type==='done'){reply++;value={...value,event:{...value.event,dataBase64:btoa('data: '+JSON.stringify({...data,messageId:'11111111-1111-4111-8111-11111111111'+reply,userMessageId:'22222222-2222-4222-8222-22222222222'+reply})+'\n\n')}};}
   }
   return emit(plugin,event,value);
  };
  const f=w.live={noCanceller:false,captures:[] as any[],stops:[] as string[],active:null as string|null,routes:[] as any[],finals:[] as string[],spoken:[] as string[],plays:[] as string[],stopped:0,forbidden:[] as string[],onStop:null as null|((id:string)=>void)};
  const events:Array<{event:string;callback:(value:any)=>void}>=[];
  f.emit=(event:string,value:any)=>{for(const row of events)if(row.event===event)row.callback(value);};
  f.frame=(timestamp:number)=>({pcm16:btoa(String.fromCharCode(...new Uint8Array(1024))),sampleRate:16000,channels:1,samples:512,timestamp});
  f.frames=(frames:number[],vad:Array<{type:string;timestampMs:number}>=[])=>f.emit('liveCaptureFrames',{captureId:f.active,frames:frames.map(f.frame),vad,peak:.3});
  f.finishPlayback=()=>f.emit('playbackEnded',{playbackId:f.plays.at(-1)});
  const header=c.PluginHeaders.find((p:any)=>p.name==='AlphaVoiceCloud');
  header.methods=[...['checkPermissions','localSpeechStatus','liveCaptureStatus','startLiveCapture','stopLiveCapture','synthesizeLocal','play','stopPlayback','cancel','releaseLocalSpeech','cancelRecording'].map(name=>({name,rtype:'promise'})),{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'callback'}];
  const callback=c.nativeCallback;c.nativeCallback=(plugin:string,method:string,input:any,fn:any)=>{if(plugin==='AlphaVoiceCloud'&&method==='addListener'){events.push({event:input.eventName,callback:fn});return String(events.length);}return callback(plugin,method,input,fn);};
  c.nativePromise=async(plugin:string,method:string,input:any)=>{
   if(plugin==='Agent'&&method==='request'&&String(input.path).startsWith('/api/asr/local-inference/live')){
    if(input.path==='/api/asr/local-inference/live/status')return {status:200,body:JSON.stringify({ready:true,streaming:true,sessions:0,maxSessions:4})};
    const body=JSON.parse(input.body);f.routes.push(body);
    const end=Array.isArray(body.vad)&&body.vad.some((edge:any)=>edge.type==='speech-end');
    return {status:200,body:JSON.stringify({ok:true,sessionId:body.sessionId,mode:'stream',framesReceived:f.routes.length,...(end?{final:{turnId:'turn-'+f.routes.length,text:f.finals.shift()??'',mode:'stream',asrFinalFromSpeechEndMs:30}}:{}),...(body.close?{closed:true}:{})})};
   }
   if(plugin!=='AlphaVoiceCloud')return prior(plugin,method,input);
   if(method==='checkPermissions')return {microphone:'granted'};
   if(method==='localSpeechStatus')return {ready:true,execution:'device'};
   if(method==='liveCaptureStatus')return {permission:true,available:true};
   if(method==='startLiveCapture'){f.captures.push({captureId:input.captureId,echoCancel:input.echoCancel===true});f.active=input.captureId;return {captureId:input.captureId,sampleRate:16000,echoCancelled:input.echoCancel===true&&!f.noCanceller};}
   if(method==='stopLiveCapture'){const id=input.captureId;f.stops.push(id);f.onStop?.(id);if(f.active===id){f.active=null;}f.emit('liveCaptureEnded',{captureId:id});return {captureId:id,durationMs:1000};}
   if(method==='synthesizeLocal'){f.spoken.push(input.text);return {playbackId:'play-'+f.spoken.length,execution:'device'};}
   if(method==='play'){f.plays.push(input.playbackId);return {};}
   if(method==='stopPlayback'){f.stopped++;return {};}
   if(['cancel','releaseLocalSpeech','removeListener','cancelRecording'].includes(method))return {};
   f.forbidden.push(method);throw Error('Not part of the live voice path: '+method);
  };
 });await residentHome(page);return foreign;
}
const voice=(page:Page)=>page.getByRole('region',{name:'Voice conversation',exact:true});
const transcription=(page:Page)=>page.getByRole('region',{name:'Voice transcription',exact:true});
const live=<T,>(page:Page,read:(f:any)=>T)=>page.evaluate(`(${read.toString()})(window.live)`) as Promise<T>;
async function say(page:Page,text:string){
 await page.evaluate(text=>{const f=(window as any).live,t=Date.now();f.finals.push(text);f.frames([t-64,t-32,t],[{type:'speech-start',timestampMs:t-64}]);},text);
 await page.waitForTimeout(150);
 await page.evaluate(()=>{const f=(window as any).live,t=Date.now();f.frames([t],[{type:'speech-end',timestampMs:t}]);});
}
const posts=(page:Page)=>page.evaluate(()=>(window as any).flagOff.posts.map((text:string)=>text.split('[USER MESSAGE]\n').at(-1))) as Promise<string[]>;
async function clean(page:Page,foreign:string[]){expect(await live(page,f=>f.forbidden)).toEqual([]);expect(foreign).toEqual([]);}

test('Transcribe and Talk are separate controls: dictation fills an editable draft, the assistant sends a spoken turn',async({page})=>{
 const foreign=await setup(page);
 await expect(button(page,'Transcribe')).toHaveAttribute('title','Transcribe into draft');
 await expect(button(page,'Talk')).toHaveAttribute('title','Voice assistant');
 await page.locator('textarea[data-alpha-composer]').fill('Existing text');
 await button(page,'Transcribe').click();
 await expect(transcription(page)).toHaveAttribute('data-voice-state','recording');
 expect(await live(page,f=>f.captures.map((c:any)=>c.echoCancel))).toEqual([false]);
 await say(page,'Pick up the dry cleaning');
 // Stop: one frame read before the tap is still in flight; one stamped after it must not be used.
 await page.evaluate(()=>{const f=(window as any).live;f.onStop=(id:string)=>{const t=Date.now();f.emit('liveCaptureFrames',{captureId:id,frames:[f.frame(t-1000),f.frame(t+400)],vad:[],peak:.2});f.finals.push('and the mail');f.onStop=null;};});
 await page.evaluate(()=>{const f=(window as any).live,t=Date.now();f.frames([t],[{type:'speech-start',timestampMs:t}]);});
 await button(page,'Stop recording').click();
 await expect(transcription(page)).toHaveAttribute('data-voice-state','review');
 await expect(page.getByRole('textbox',{name:'Review transcript',exact:true})).toHaveValue('Pick up the dry cleaning and the mail');
 const routes=await live(page,f=>f.routes);
 const stopAt=Math.max(...routes.flatMap((r:any)=>r.vad??[]).filter((e:any)=>e.type==='speech-end').map((e:any)=>e.timestampMs));
 expect(routes.flatMap((r:any)=>(r.frames??[]).map((x:any)=>x.timestamp)).every((t:number)=>t<=stopAt)).toBe(true);
 expect(routes.at(-1).close).toBe(true);
 await page.getByRole('textbox',{name:'Review transcript',exact:true}).fill('Pick up the dry cleaning and the mail today');
 await button(page,'Use in draft').click();
 await expect(page.locator('textarea[data-alpha-composer]')).toHaveValue('Existing text\nPick up the dry cleaning and the mail today');
 expect(await posts(page)).toEqual([]);

 await page.locator('textarea[data-alpha-composer]').fill('');
 await button(page,'Talk').click();
 await expect(voice(page)).toHaveAttribute('data-voice-state','listening');
 expect(await live(page,f=>f.captures.map((c:any)=>c.echoCancel))).toEqual([false,true]);
 await expect(voice(page)).toContainText('Speak at any time to interrupt');
 await say(page,'What is on my calendar today');
 await expect.poll(()=>posts(page)).toEqual(['What is on my calendar today']);
 await expect(voice(page)).toHaveAttribute('data-voice-state','speaking');
 await button(page,'Stop voice conversation').click();
 await expect(voice(page)).toHaveCount(0);
 await expect.poll(()=>live(page,f=>f.stops.length)).toBe(2);
 await clean(page,foreign);
});

test('barge-in stops playback, keeps only the played sentence and sends the new speech once as the next turn',async({page})=>{
 const foreign=await setup(page);
 await page.evaluate(()=>{(window as any).flagOff.replies.push('You have two meetings today. The first one starts at nine with Priya.','Tomorrow is clear.');});
 await button(page,'Talk').click();
 await expect(voice(page)).toHaveAttribute('data-voice-state','listening');
 await say(page,'What is on my calendar today');
 await expect(voice(page)).toHaveAttribute('data-voice-state','speaking');
 expect(await live(page,f=>f.spoken)).toEqual(['You have two meetings today.']);
 await page.evaluate(()=>(window as any).live.finishPlayback());
 await expect.poll(()=>live(page,f=>f.spoken.length)).toBe(2);
 await expect(button(page,'Stop speaking')).toBeVisible();
 const stoppedBefore=await live(page,f=>f.stopped);
 // The user talks over the second sentence.
 await say(page,'and tomorrow');
 await expect.poll(()=>live(page,f=>f.stopped)).toBeGreaterThan(stoppedBefore);
 await expect.poll(()=>posts(page)).toEqual(['What is on my calendar today','and tomorrow']);
 await expect(voice(page)).toHaveAttribute('data-voice-state','speaking');
 await page.evaluate(()=>(window as any).live.finishPlayback());
 await expect(voice(page)).toHaveAttribute('data-voice-state','listening');
 await button(page,'Stop voice conversation').click();
 await expect(voice(page)).toHaveCount(0);
 // Conversation state keeps only what was played of the interrupted reply.
 await expect(page.getByText('(Interrupted. The rest of this reply was not played.)')).toBeVisible();
 await expect(page.getByText('starts at nine with Priya')).toHaveCount(0);
 await expect(page.getByText('Tomorrow is clear.')).toBeVisible();
 await clean(page,foreign);
});

test('Stop speaking interrupts by button; Mute turns the microphone off and on with a pressed state',async({page})=>{
 const foreign=await setup(page);
 await page.evaluate(()=>{(window as any).flagOff.replies.push('Here is a long answer about the weather this week.');});
 await button(page,'Talk').click();
 await expect(voice(page)).toHaveAttribute('data-voice-state','listening');
 const mute=voice(page).getByRole('button',{name:'Mute microphone',exact:true});
 await expect(mute).toHaveAttribute('aria-pressed','false');
 await mute.click();
 await expect(voice(page).getByRole('button',{name:'Unmute microphone',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect.poll(()=>live(page,f=>f.stops.length)).toBe(1);
 await expect(voice(page)).toContainText('Microphone off');
 await voice(page).getByRole('button',{name:'Unmute microphone',exact:true}).click();
 await expect.poll(()=>live(page,f=>f.captures.length)).toBe(2);
 await say(page,'How is the weather');
 await expect(voice(page)).toHaveAttribute('data-voice-state','speaking');
 await button(page,'Stop speaking').click();
 await expect(voice(page)).toHaveAttribute('data-voice-state','listening');
 await expect.poll(()=>live(page,f=>f.stopped)).toBeGreaterThan(0);
 await button(page,'Stop voice conversation').click();
 await expect(page.getByText('(Interrupted before this reply was played.)')).toBeVisible();
 expect(await posts(page)).toEqual(['How is the weather']);
 await clean(page,foreign);
});

test('without an echo canceller, speech during playback never interrupts; a lost Transcribe capture can start again',async({page})=>{
 const foreign=await setup(page);
 await page.evaluate(()=>{const w=window as any;w.live.noCanceller=true;w.flagOff.replies.push('The library closes at six tonight.');});
 await button(page,'Talk').click();
 await expect(voice(page)).toHaveAttribute('data-voice-state','listening');
 await say(page,'When does the library close');
 await expect(voice(page)).toHaveAttribute('data-voice-state','speaking');
 const stopped=await live(page,f=>f.stopped);
 await say(page,'closes at six tonight');
 await page.waitForTimeout(1600);
 expect(await live(page,f=>f.stopped)).toBe(stopped);
 await expect(voice(page)).toHaveAttribute('data-voice-state','speaking');
 expect(await posts(page)).toEqual(['When does the library close']);
 await button(page,'Stop voice conversation').click();
 await expect(voice(page)).toHaveCount(0);
 // Transcribe: the microphone is lost mid-recording; recording again works.
 await button(page,'Transcribe').click();
 await expect(transcription(page)).toHaveAttribute('data-voice-state','recording');
 await page.evaluate(()=>{const f=(window as any).live;f.emit('liveCaptureEnded',{captureId:f.active,error:'capture'});f.active=null;});
 await expect(transcription(page)).toHaveAttribute('data-voice-state','ready');
 await button(page,'Start recording').click();
 await expect(transcription(page)).toHaveAttribute('data-voice-state','recording');
 await say(page,'Buy stamps');
 await button(page,'Stop recording').click();
 await expect(page.getByRole('textbox',{name:'Review transcript',exact:true})).toHaveValue('Buy stamps');
 expect(await live(page,f=>f.captures.length)).toBe(3);
 await clean(page,foreign);
});

test('stopping before the pause discards the unsent utterance and late transcripts',async({page})=>{
 const foreign=await setup(page);
 await button(page,'Talk').click();
 await expect(voice(page)).toHaveAttribute('data-voice-state','listening');
 // The user is mid-sentence when they stop; the segment's end and transcript arrive late.
 const capture=await live(page,f=>f.active);
 await page.evaluate(()=>{const f=(window as any).live,t=Date.now();f.finals.push('Send a text to');f.frames([t-64,t-32,t],[{type:'speech-start',timestampMs:t-64}]);});
 await button(page,'Stop voice conversation').click();
 await page.evaluate(id=>{const f=(window as any).live,t=Date.now();f.emit('liveCaptureFrames',{captureId:id,frames:[f.frame(t)],vad:[{type:'speech-end',timestampMs:t}],peak:.2});},capture);
 await expect(voice(page)).toHaveCount(0);
 await page.waitForTimeout(1600);
 expect(await posts(page)).toEqual([]);
 expect(await live(page,f=>f.routes.at(-1).close)).toBe(true);
 await clean(page,foreign);
});
