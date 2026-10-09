import {expect,type Page} from '@playwright/test';

/** Synthetic silent microphone and local browser voice. Nothing past getUserMedia/speechSynthesis is mocked. */
export async function silentMicrophone(page:Page){
 await page.evaluate(()=>{
  const w=window as any,ctx=new AudioContext();w.microphone={requests:0};
  document.addEventListener('click',()=>{void ctx.resume();},{capture:true});
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{
   w.microphone.requests++;const sink=ctx.createMediaStreamDestination(),source=ctx.createBufferSource();
   source.buffer=ctx.createBuffer(1,Math.round(ctx.sampleRate*1.5),ctx.sampleRate);source.connect(sink);await ctx.resume();setTimeout(()=>source.start(),100);return sink.stream;
  }}});
 });
}
/** Records utterances instead of producing sound; an utterance ends only when the test says so. */
export async function localBrowserVoice(page:Page){
 await page.evaluate(()=>{
  const f=(window as any).voiceFixture={spoken:[] as string[],cancels:0,utterances:[] as SpeechSynthesisUtterance[]};
  const engine=new EventTarget();
  Object.assign(engine,{getVoices:()=>[{name:'Synthetic local',lang:'en-US',localService:true,default:true,voiceURI:'synthetic'}],speak:(u:SpeechSynthesisUtterance)=>{f.spoken.push(u.text);f.utterances.push(u);},cancel:()=>{f.cancels++;},pause(){},resume(){},speaking:false,pending:false,paused:false});
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:engine});
  // The platform utterance only accepts platform voices; this records the same fields.
  Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{text:string;voice:unknown=null;volume=1;onend:((e:Event)=>void)|null=null;onerror:((e:Event)=>void)|null=null;constructor(text:string){this.text=text;}}});
  f.finish=()=>{const u=f.utterances.at(-1);u?.onend?.(new Event('end') as SpeechSynthesisEvent);};
 });
}
export const recorder=(page:Page)=>page.locator('[data-alpha-subview="notes-recording"]');
/** Record a short silent clip; recognition then reports no speech, so the transcript is typed. */
export async function typedTranscript(page:Page,text:string){
 await page.getByRole('button',{name:'Start recording',exact:true}).click();
 await expect(page.getByRole('button',{name:'Stop recording',exact:true})).toBeVisible();
 await page.waitForTimeout(1200);
 await page.getByRole('button',{name:'Stop recording',exact:true}).click();
 await page.getByRole('button',{name:'Transcribe in this browser',exact:true}).click();
 await expect(recorder(page)).toHaveAttribute('data-voice-state','no-speech');
 await page.getByRole('button',{name:'Type transcript instead',exact:true}).click();
 await page.getByRole('textbox',{name:'Review transcript',exact:true}).fill(text);
}
export function agentContext(page:Page){
 return page.evaluate(async()=>{const {alphaClient}=await import('/src/runtime/alpha-client.ts');return JSON.parse(JSON.stringify(alphaClient.getState().context));});
}
