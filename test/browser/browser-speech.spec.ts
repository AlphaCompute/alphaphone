import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

// In-browser Whisper tiny.en: synthetic WAV narration (a repository design asset with a known
// script) is played into a fake microphone stream, recorded by the real MediaRecorder,
// decoded and recognized by the self-hosted model in a worker. Nothing is mocked past getUserMedia.
const phrase=readFileSync(new URL('../../design-assets/video/narration/voice.wav',import.meta.url)).toString('base64');
const PHRASE='Hold the side key to talk, from anywhere.';
const words=(text:string)=>text.toLowerCase().replace(/[^a-z0-9' ]+/g,' ').split(/\s+/).filter(Boolean);
/** Word error rate by edit distance over normalized words. */
function wordErrorRate(reference:string,hypothesis:string){
 const a=words(reference),b=words(hypothesis),row=Array.from({length:b.length+1},(_,j)=>j);
 for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const current=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=current;}}
 return row[b.length]/a.length;
}

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));});

async function microphone(page:Page,input:'speech'|'silence'|'denied'){
 await page.evaluate(async({input,encoded})=>{
  const w=window as any,ctx=new AudioContext();w.microphone={requests:0,ctx};
  document.addEventListener('click',()=>{void ctx.resume();},{capture:true});
  let buffer:AudioBuffer;
  if(input==='speech')buffer=await ctx.decodeAudioData(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)).buffer);
  else buffer=ctx.createBuffer(1,Math.round(ctx.sampleRate*1.5),ctx.sampleRate);
  w.microphone.duration=buffer.duration;
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{
   w.microphone.requests++;
   if(input==='denied')throw new DOMException('Permission denied','NotAllowedError');
   // A fresh sink per request: the recorder stops every track it was given.
   const sink=ctx.createMediaStreamDestination(),source=ctx.createBufferSource();source.buffer=buffer;source.connect(sink);await ctx.resume();
   setTimeout(()=>source.start(),150);return sink.stream;
  }}});
 },{input,encoded:phrase});
}
function speechRequests(page:Page){const urls:string[]=[];page.on('request',request=>{const url=new URL(request.url());if(url.pathname.startsWith('/browser-speech/'))urls.push(url.pathname);});return urls;}
async function record(page:Page){
 await page.getByRole('button',{name:'Start recording',exact:true}).click();
 await expect(page.getByRole('button',{name:'Stop recording',exact:true})).toBeVisible();
 const seconds=await page.evaluate(()=>(window as any).microphone.duration as number);
 await page.waitForTimeout(seconds*1000+500);
 await page.getByRole('button',{name:'Stop recording',exact:true}).click();
}
const recorder=(page:Page)=>page.locator('[data-alpha-subview="notes-recording"]');
async function openRecorder(page:Page,input:'speech'|'silence'|'denied'){
 await page.goto('/');await microphone(page,input);
 await page.getByRole('button',{name:'Notes',exact:true}).click();
 await page.getByRole('button',{name:'Record and transcribe',exact:true}).click();
 await expect(recorder(page)).toContainText('English-only speech recognition runs in this browser');
}

test('Notes transcribes a known phrase in the browser, keeps review, and records provenance',async({page},info)=>{
 test.setTimeout(120000);
 const requests=speechRequests(page);
 await openRecorder(page,'speech');await record(page);
 // Stop never loads the model or uploads anything.
 expect(requests).toEqual([]);
 await page.getByRole('button',{name:'Transcribe in this browser',exact:true}).click();
 await expect(page.getByRole('button',{name:'Cancel transcription',exact:true})).toBeVisible();
 const review=page.getByRole('textbox',{name:'Review transcript',exact:true});
 await expect(review).not.toHaveValue('',{timeout:90000});
 const text=await review.inputValue();
 const rate=wordErrorRate(PHRASE,text);
 info.annotations.push({type:'transcript',description:`${JSON.stringify(text)} (WER ${rate.toFixed(2)})`});
 expect(rate,text).toBeLessThanOrEqual(0.25);
 expect(requests.filter(path=>path.endsWith('.onnx'))).toHaveLength(2);
 // The transcript is untrusted, editable text; nothing is saved until Save note.
 await review.fill(`${text} Reviewed.`);
 await page.screenshot({path:info.outputPath('browser-transcript-review.png')});
 await page.getByRole('button',{name:'Save note',exact:true}).click();
 await expect(page.getByRole('button',{name:'Play recording',exact:true})).toBeVisible();
 const saved=await page.evaluate(async()=>{const raw=await(await import('/src/runtime/browser-notes-document.ts')).readBrowserNotesRaw();return JSON.parse(raw!).records.find((note:any)=>note.kind==='voice');});
 expect(saved.body).toBe(`${text} Reviewed.`);
 expect(saved.transcription).toEqual({route:'browser',engine:'whisper',model:'whisper-tiny.en',modelRevision:'Xenova/whisper-tiny.en@79fb389fc764e7c395bd330e9531d9d32ada7049',runtime:'onnxruntime-web 1.30.0 (WebAssembly, single thread)',language:'en',edited:true});
});

test('silence reports no speech without loading the model and offers typing instead',async({page})=>{
 const requests=speechRequests(page);
 await openRecorder(page,'silence');await record(page);
 await page.getByRole('button',{name:'Transcribe in this browser',exact:true}).click();
 await expect(recorder(page)).toHaveAttribute('data-voice-state','no-speech');
 await expect(recorder(page)).toContainText('No speech was detected in this recording.');
 expect(requests).toEqual([]);
 await page.getByRole('button',{name:'Type transcript instead',exact:true}).click();
 const review=page.getByRole('textbox',{name:'Review transcript',exact:true});
 await expect(review).toHaveValue('');await review.fill('Typed after silence');
 await page.getByRole('button',{name:'Save note',exact:true}).click();
 await expect(page.getByRole('button',{name:'Play recording',exact:true})).toBeVisible();
 const saved=await page.evaluate(async()=>{const raw=await(await import('/src/runtime/browser-notes-document.ts')).readBrowserNotesRaw();return JSON.parse(raw!).records.find((note:any)=>note.kind==='voice');});
 expect(saved.transcription).toEqual({route:'manual'});expect(saved.body).toBe('Typed after silence');
});

test('microphone denial is a distinct state with guidance and retries cleanly',async({page},info)=>{
 await openRecorder(page,'denied');
 await page.getByRole('button',{name:'Start recording',exact:true}).click();
 await expect(recorder(page)).toHaveAttribute('data-voice-state','denied');
 await expect(recorder(page)).toContainText('Microphone access is blocked. Allow the microphone for this site');
 await expect(page.getByRole('button',{name:'Start recording',exact:true})).toBeEnabled();
 await expect(page.getByRole('button',{name:'Type transcript instead',exact:true})).toHaveCount(0);
 await page.screenshot({path:info.outputPath('microphone-denied.png')});
 await page.getByRole('button',{name:'Start recording',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).microphone.requests)).toBe(2);
});

test('model load failure is reported, keeps the recording and allows typing',async({page})=>{
 await page.route('**/browser-speech/manifest.json',route=>route.fulfill({status:404,body:''}));
 await openRecorder(page,'speech');await record(page);
 await page.getByRole('button',{name:'Transcribe in this browser',exact:true}).click();
 await expect(recorder(page)).toHaveAttribute('data-voice-state','model');
 await expect(recorder(page)).toContainText('The speech model could not be loaded.');
 await expect(page.getByRole('button',{name:'Transcribe in this browser',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Type transcript instead',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Review transcript',exact:true})).toHaveValue('');
});

for(const exit of ['cancel','background'] as const)test(`${exit} during model download retires the request; a late model cannot produce a transcript`,async({page})=>{
 test.setTimeout(90000);
 let release:()=>void=()=>{};const held=new Promise<void>(resolve=>{release=resolve;});let decoderRequests=0;
 await page.route('**/browser-speech/whisper-tiny.en/decoder_model_merged_quantized.onnx',async route=>{decoderRequests++;await held;await route.continue().catch(()=>{});});
 await openRecorder(page,'speech');await record(page);
 await page.getByRole('button',{name:'Transcribe in this browser',exact:true}).click();
 await expect(recorder(page)).toContainText(/Loading the speech model from this app: \d+ of 56 MB/);
 await expect.poll(()=>decoderRequests).toBe(1);
 if(exit==='cancel'){await page.getByRole('button',{name:'Cancel transcription',exact:true}).click();await expect(recorder(page)).toContainText('Transcription cancelled.');}
 else{await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await expect(recorder(page)).toContainText('Voice stopped when the app left the foreground.');}
 release();
 await page.waitForTimeout(1500);
 if(exit==='background')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(page.getByRole('textbox',{name:'Review transcript',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Cancel transcription',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Start recording',exact:true})).toBeEnabled();
 await expect(recorder(page)).toContainText(exit==='cancel'?'Transcription cancelled.':'Voice stopped when the app left the foreground.');
});

test('chat Talk transcribes in the browser into the composer without sending',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/');await microphone(page,'speech');
 let sent=0;page.on('request',request=>{if(request.method()==='POST'&&!new URL(request.url()).pathname.startsWith('/browser-speech/'))sent++;});
 await page.getByRole('button',{name:'Talk',exact:true}).first().click();
 await expect(recorder(page)).toBeVisible();await record(page);
 await page.getByRole('button',{name:'Transcribe in this browser',exact:true}).click();
 const review=page.getByRole('textbox',{name:'Review transcript',exact:true});
 await expect(review).not.toHaveValue('',{timeout:90000});
 expect(wordErrorRate(PHRASE,await review.inputValue())).toBeLessThanOrEqual(0.25);
 await review.fill('Edited voice message');
 await page.getByRole('button',{name:'Use in conversation',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Message Alpha',exact:true})).toHaveValue('Edited voice message');
 expect(sent).toBe(0);
});
