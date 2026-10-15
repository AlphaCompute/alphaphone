import {test,expect,type Page} from '@playwright/test';
import {button} from './flag-off-android';
import {setupNativeSpeech as setup} from './native-speech-fixture';
const voice=(page:Page)=>page.getByRole('region',{name:'Voice conversation',exact:true});
async function utterance(page:Page){await page.evaluate(()=>(window as any).nativeSpeech.peak=.25);await page.waitForTimeout(950);await page.evaluate(()=>(window as any).nativeSpeech.peak=0);}
async function noCloud(page:Page,foreign:string[]){expect(await page.evaluate(()=>(window as any).nativeSpeech.forbidden)).toEqual([]);expect(foreign).toEqual([]);}
test('production chat captures locally, transcribes locally, plays local reply and cancels playback',async({page})=>{
 const foreign=await setup(page);await button(page,'Talk').click();await expect(voice(page)).toHaveAttribute('data-voice-state','listening');await expect(voice(page)).toContainText('transcribed on this device');await utterance(page);await expect(voice(page)).toHaveAttribute('data-voice-state','speaking');
 expect(await page.evaluate(()=>{const f=(window as any).nativeSpeech;return {starts:f.starts,stops:f.stops,transcripts:f.transcripts,spoken:f.spoken,plays:f.plays,posts:(window as any).flagOff.posts.map((text:string)=>text.split('[USER MESSAGE]\n').at(-1))};})).toEqual({starts:1,stops:1,transcripts:1,spoken:['Resident reply 1'],plays:1,posts:['Local spoken request']});
 await button(page,'Stop voice conversation').click();await expect(voice(page)).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>(window as any).nativeSpeech.stopped)).toBeGreaterThan(0);await noCloud(page,foreign);
});
test('unavailable local speech offers keyboard without trying network speech',async({page})=>{
 const foreign=await setup(page);await page.evaluate(()=>(window as any).nativeSpeech.ready=false);await button(page,'Talk').click();await expect(voice(page)).toContainText('On-device speech is unavailable');await button(page,'Minimize chat').click();await expect(voice(page)).toHaveCount(0);await button(page,'Type').click();await expect(page.locator('textarea[data-alpha-composer]')).toBeVisible();expect(await page.evaluate(()=>(window as any).nativeSpeech.starts)).toBe(0);await noCloud(page,foreign);
});
test('cancelling local transcription rejects late output without submitting a turn',async({page})=>{
 const foreign=await setup(page);await page.evaluate(()=>(window as any).nativeSpeech.holdTranscript=true);await button(page,'Talk').click();await expect(voice(page)).toHaveAttribute('data-voice-state','listening');await utterance(page);await expect(voice(page)).toHaveAttribute('data-voice-state','transcribing');await button(page,'Stop voice conversation').click();await expect(voice(page)).toHaveCount(0);await page.evaluate(()=>(window as any).nativeSpeech.releaseTranscript());await expect.poll(()=>page.evaluate(()=>(window as any).nativeSpeech.cancels.length)).toBeGreaterThan(0);expect(await page.evaluate(()=>(window as any).flagOff.posts)).toEqual([]);await noCloud(page,foreign);
});
test('production Notes reads through local synthesis and Stop retires owned playback',async({page})=>{
 const foreign=await setup(page);await button(page,'Notes').click();await button(page,'New note').click();await page.getByRole('textbox',{name:'Title',exact:true}).fill('Groceries');await page.getByRole('textbox',{name:'Note',exact:true}).fill('Milk and eggs.');await button(page,'Read aloud').click();await expect.poll(()=>page.evaluate(()=>(window as any).nativeSpeech.spoken)).toEqual(['Groceries. Milk and eggs.']);await button(page,'Stop reading').click();await expect.poll(()=>page.evaluate(()=>(window as any).nativeSpeech.stopped)).toBeGreaterThan(0);await noCloud(page,foreign);
});

test('Maps local speech adapter cancels owned guidance and refuses local-unready without a network fallback',async({page})=>{
 const foreign=await setup(page);
 // Evaluate the unchanged production adapter and shared guidance state machine in the
 // browser, injecting only their voice port. The full Maps UI/provider is outside this test.
 const {readFileSync}=await import('node:fs');const {stripTypeScriptTypes}=await import('node:module');
 const source=(path:string)=>stripTypeScriptTypes(readFileSync(path,'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,''),{mode:'transform'});
 const shared=source('.eliza/client-features/plugins/plugin-maps/src/client/navigation-voice.ts').replace('class NavigationVoice','class SharedNavigationVoice');
 const adapter=source('apps/app/src/maps/navigation-voice.ts');
 await page.evaluate(`(()=>{let ready=true;const f=window.mapsVoice={spoken:[],aborted:0,failed:0,setReady:value=>ready=value};const createOnDeviceVoice=()=>({ready:async()=>{throw Error("navigation speech must not use transcription readiness");},playbackReady:async()=>ready,speak:(text,signal)=>{f.spoken.push(text);return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{f.aborted++;reject(signal.reason);},{once:true}));}});${shared}\n${adapter}\nf.voice=new NavigationVoice(()=>f.failed++);f.voice.update('step-1','Turn right');})()`);
 await expect.poll(()=>page.evaluate(()=>(window as any).mapsVoice.spoken)).toEqual(['Turn right']);
 await page.evaluate(()=>(window as any).mapsVoice.voice.pause());await expect.poll(()=>page.evaluate(()=>(window as any).mapsVoice.aborted)).toBe(1);
 await page.evaluate(()=>{const f=(window as any).mapsVoice;f.setReady(false);f.voice.update('step-2','Continue ahead');});await expect.poll(()=>page.evaluate(()=>(window as any).mapsVoice.failed)).toBe(1);
 expect(await page.evaluate(()=>(window as any).mapsVoice.spoken)).toEqual(['Turn right']);await noCloud(page,foreign);
});

test('production chat exposes one voice mic and no duplicate dictation launcher',async({page})=>{
 const foreign=await setup(page);await expect(button(page,'Talk')).toHaveCount(1);await expect(button(page,'Transcribe')).toHaveCount(0);await noCloud(page,foreign);
});
