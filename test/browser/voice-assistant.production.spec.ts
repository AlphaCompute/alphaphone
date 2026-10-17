import {test,expect,type Page} from '@playwright/test';
import {button} from './flag-off-android';
import {setupLiveAssistant as setup} from './voice-assistant-fixture';
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

test('production assistant has one Talk control and no dictation launcher',async({page})=>{
 const foreign=await setup(page);await expect(button(page,'Transcribe')).toHaveCount(0);await expect(button(page,'Talk')).toHaveAttribute('title','Voice assistant');await clean(page,foreign);
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
 await expect(button(page,'Stop voice conversation')).toBeVisible();await expect(button(page,'Stop speaking')).toHaveCount(0);
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
 // The agent is asked to keep exactly the played sentence of that reply; the fully heard reply is untouched.
 const heard=await live(page,f=>f.heard);
 expect(heard.map((row:any)=>[row.path.split('/')[5],row.heardText])).toEqual([['11111111-1111-4111-8111-111111111111','You have two meetings today.']]);
 expect(heard[0].ownerId).toBeTruthy();
 // With the scorer unavailable both turns were submitted by the long gap.
 expect(await live(page,f=>f.eotCalls)).toEqual(['What is on my calendar today','and tomorrow']);
 const endpoints=await page.evaluate(()=>JSON.parse(localStorage.getItem('alphaphone:voice-timing:v1')||'[]').filter((row:any)=>row.endpoint).map((row:any)=>[row.endpoint.by,row.endpoint.semantic,row.endpoint.reason,row.heard??null]));
 expect(endpoints).toEqual([['gap','unavailable','voice-not-started','recorded'],['gap','unavailable','voice-not-started',null]]);
 await clean(page,foreign);
});

test('Mute controls capture and Stop retires playback without a separate interruption button',async({page})=>{
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
 await expect(button(page,'Stop speaking')).toHaveCount(0);
 await button(page,'Stop voice conversation').click();
 await expect(voice(page)).toHaveCount(0);
 await expect.poll(()=>live(page,f=>f.stopped)).toBeGreaterThan(0);
 await expect(page.getByText('(Interrupted before this reply was played.)')).toBeVisible();
 expect(await posts(page)).toEqual(['How is the weather']);
 // Nothing was heard: the route needs a non-empty prefix, so nothing is sent.
 expect(await live(page,f=>f.heard)).toEqual([]);
 await clean(page,foreign);
});

test('without an echo canceller, speech during playback never interrupts',async({page})=>{
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

test('semantic endpointing: a complete score submits after the short gap; an incomplete one waits for the long gap',async({page})=>{
 const foreign=await setup(page);
 await page.evaluate(()=>{(window as any).live.eot={available:true,endOfTurnProbability:.93,complete:true,commitThreshold:.7,nextSpeaker:'agent',source:'eliza-1-drafter',model:'eliza-1',latencyMs:18};});
 await button(page,'Talk').click();
 await expect(voice(page)).toHaveAttribute('data-voice-state','listening');
 await say(page,'What is on my calendar today');
 await expect.poll(()=>posts(page)).toEqual(['What is on my calendar today']);
 await expect(voice(page)).toHaveAttribute('data-voice-state','speaking');
 await page.evaluate(()=>(window as any).live.finishPlayback());
 await expect(voice(page)).toHaveAttribute('data-voice-state','listening');
 await page.evaluate(()=>{(window as any).live.eot={available:true,endOfTurnProbability:.2,complete:false,commitThreshold:.7,nextSpeaker:'user',source:'eliza-1-drafter',model:'eliza-1',latencyMs:15};});
 await say(page,'and remind me to');
 await expect.poll(()=>live(page,f=>f.eotCalls.length)).toBe(2);
 await page.waitForTimeout(500);
 expect(await posts(page)).toEqual(['What is on my calendar today'],'not complete: no early submit');
 await expect.poll(()=>posts(page)).toEqual(['What is on my calendar today','and remind me to']);
 const endpoints=await page.evaluate(()=>JSON.parse(localStorage.getItem('alphaphone:voice-timing:v1')||'[]').filter((row:any)=>row.endpoint).map((row:any)=>row.endpoint));
 expect(endpoints).toEqual([{by:'semantic',semantic:'complete',latencyMs:18},{by:'gap',semantic:'incomplete',latencyMs:15}]);
 expect(JSON.stringify(endpoints)).not.toContain('calendar');
 // The reply was fully heard: no heard request.
 expect(await live(page,f=>f.heard)).toEqual([]);
 await button(page,'Stop voice conversation').click();
 await clean(page,foreign);
});
