import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

// Explicit optional-engine qualification. The production recorder remains Cloud-only.
// Decode an owned repository fixture offline: no microphone, recording or playback.
test('explicit optional Whisper engine recognizes an owned phrase without capture or foreign requests',async({page},info)=>{
 test.setTimeout(120000);
 const encoded=readFileSync(new URL('../../design-assets/video/narration/voice.wav',import.meta.url)).toString('base64');
 const foreign:string[]=[],models:string[]=[];
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(!['127.0.0.1','localhost'].includes(url.hostname)&&!['data:','blob:'].includes(url.protocol)){foreign.push(url.href);await route.abort();return;}if(url.pathname.endsWith('.onnx'))models.push(url.pathname);await route.continue();});
 await page.addInitScript(()=>{localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{throw Error('Engine qualification must not capture');}}});HTMLMediaElement.prototype.play=async()=>{throw Error('Engine qualification must not play audio');};});
 await page.goto('/?mode=dev');
 const result=await page.evaluate(async encoded=>{
  const {BrowserSpeechRecognizer}=await import('/src/browser/speech-recognizer.ts'),{recordingPcmSamples}=await import('/src/browser/recording-pcm.ts');
  const controller=new AbortController(),engine=new BrowserSpeechRecognizer();
  try{const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),samples=await recordingPcmSamples(new Blob([bytes],{type:'audio/wav'}),controller.signal);return await engine.transcribe(samples,controller.signal);}finally{controller.abort();engine.cancel();}
 },encoded);
 const words=(text:string)=>text.toLowerCase().replace(/[^a-z0-9' ]+/g,' ').split(/\s+/).filter(Boolean),a=words('Hold the side key to talk, from anywhere.'),b=words(result.text),row=Array.from({length:b.length+1},(_,j)=>j);
 for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const current=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=current;}}
 const rate=row[b.length]/a.length;info.annotations.push({type:'transcript',description:`${JSON.stringify(result.text)} (WER ${rate.toFixed(2)})`});
 expect(result.noSpeech).toBe(false);expect(rate,result.text).toBeLessThanOrEqual(.25);expect(models).toHaveLength(2);expect(foreign).toEqual([]);
});
