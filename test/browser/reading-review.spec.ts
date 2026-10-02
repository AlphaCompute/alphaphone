import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));
  const state=(window as any).speechTest={spoken:[] as string[],cancelled:0,voices:[{name:'Device voice',lang:'en-US',localService:true}],utterance:null as any};
  const engine=new EventTarget();Object.assign(engine,{getVoices:()=>state.voices,speak:(utterance:any)=>{state.spoken.push(utterance.text);state.utterance=utterance;},cancel:()=>{state.cancelled++;}});
  Object.defineProperty(window,'speechSynthesis',{value:engine});
  Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class {text:string;constructor(text:string){this.text=text;}}});
 });
 await page.route('https://example.com/**',route=>route.abort());
 await page.goto('/');
});
async function open(page:any){await page.evaluate(async()=>{
 const {reviewBrowserReading}=await import('/src/browser/reading-review.ts');const state=window as any;state.readAbort=new AbortController();state.readDone=reviewBrowserReading('https://example.com/article',state.readAbort.signal,()=>state.readAbort.signal.throwIfAborted());
});}
test('review requires explicit text and confirmation, uses the exact excerpt, and releases playback on close',async({page})=>{
 await open(page);const dialog=page.getByRole('dialog',{name:'Read page excerpt'});
 await expect(dialog).toBeVisible();expect(await page.evaluate(()=>(window as any).speechTest.spoken)).toEqual([]);
 await dialog.getByRole('button',{name:'Read locally',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Enter between');
 await dialog.getByRole('textbox',{name:'Excerpt to read'}).fill('Reviewed excerpt\nSecond line.');
 await dialog.getByRole('button',{name:'Read locally',exact:true}).click();
 await expect(dialog.getByRole('status')).toHaveText('Reading locally…');
 expect(await page.evaluate(()=>(window as any).speechTest.spoken)).toEqual(['Reviewed excerpt\nSecond line.']);
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).speechTest.cancelled)).toBeGreaterThan(0);
});
test('stop retires old callbacks, a retry reads new text, and lifecycle cancellation closes the review',async({page})=>{
 await open(page);const dialog=page.getByRole('dialog',{name:'Read page excerpt'}),field=dialog.getByRole('textbox');
 await field.fill('First');await dialog.getByRole('button',{name:'Read locally',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText('Reading locally…');
 await page.evaluate(()=>{(window as any).oldEnd=(window as any).speechTest.utterance.onend;});
 await dialog.getByRole('button',{name:'Stop reading',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText('Reading stopped.');
 await field.fill('Second');await dialog.getByRole('button',{name:'Read locally',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText('Reading locally…');
 await page.evaluate(()=>(window as any).oldEnd());await expect(dialog.getByRole('status')).toHaveText('Reading locally…');
 await page.evaluate(()=>(window as any).readAbort.abort());await expect(dialog).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).speechTest.spoken)).toEqual(['First','Second']);
});
test('remote-only voices never receive the excerpt and cancel before confirmation is silent',async({page})=>{
 await page.evaluate(()=>{(window as any).speechTest.voices=[{name:'Remote voice',lang:'en-US',localService:false}];});
 await open(page);let dialog=page.getByRole('dialog',{name:'Read page excerpt'});await dialog.getByRole('textbox').fill('Private reviewed text');await dialog.getByRole('button',{name:'Read locally',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('No local browser voice');
 expect(await page.evaluate(()=>(window as any).speechTest.spoken)).toEqual([]);
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await open(page);dialog=page.getByRole('dialog',{name:'Read page excerpt'});await dialog.getByRole('textbox').fill('Unconfirmed text');await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);expect(await page.evaluate(()=>(window as any).speechTest.spoken)).toEqual([]);
});

test('rendered Browser menu opens local review offline and HOME cancels it',async({page})=>{
 await page.route('https://example.com/**',route=>route.fulfill({contentType:'text/html',headers:{'access-control-allow-origin':'*'},body:'<h1>Public article</h1><p>Fixture excerpt.</p>'}));
 await page.getByRole('button',{name:'Browser',exact:true}).click();
 await page.getByRole('button',{name:'Search or type address',exact:true}).click();
 await page.getByRole('textbox',{name:'Address',exact:true}).fill('https://example.com/article');await page.getByRole('textbox',{name:'Address',exact:true}).press('Enter');
 await expect(page.frameLocator('iframe[title="Website"]').getByRole('heading',{name:'Public article'})).toBeVisible();
 await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('button',{name:'Read aloud',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Read page excerpt'});await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('textbox')).toHaveValue('Public article\n\nFixture excerpt.');
 await dialog.getByRole('textbox').fill('Fixture excerpt.');await dialog.getByRole('button',{name:'Read locally',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText('Reading locally…');
 await page.screenshot({path:'test-results/reading-review.png'});
 await page.evaluate(()=>window.dispatchEvent(new Event('launcher-home')));await expect(dialog).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).speechTest.spoken)).toEqual(['Fixture excerpt.']);
});

test('compact dark review keeps controls reachable and page hide retires the draft',async({page})=>{
 await page.setViewportSize({width:360,height:640});await page.goto('/?theme=dark');await open(page);
 const dialog=page.getByRole('dialog',{name:'Read page excerpt'});await dialog.getByRole('textbox').fill('Compact review');
 await dialog.getByRole('button',{name:'Read locally',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText('Reading locally…');
 await dialog.getByRole('button',{name:'Close',exact:true}).scrollIntoViewIfNeeded();await expect(dialog.getByRole('button',{name:'Close',exact:true})).toBeInViewport();
 expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 expect(await dialog.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(0, 0, 0)');await page.screenshot({path:'test-results/reading-review-dark.png'});
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await expect(dialog).toHaveCount(0);
});

test('closing a replaced reading session does not stop another speech consumer',async({page})=>{
 await open(page);const dialog=page.getByRole('dialog',{name:'Read page excerpt'});await dialog.getByRole('textbox').fill('Reading excerpt');await dialog.getByRole('button',{name:'Read locally',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText('Reading locally…');
 await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');const voice=registerPlugin<any>('AlphaVoiceCloud');await voice.play(await voice.synthesizeLocal({text:'Other consumer'}));});
 const before=await page.evaluate(()=>(window as any).speechTest.cancelled);await dialog.getByRole('button',{name:'Close',exact:true}).click();expect(await page.evaluate(()=>(window as any).speechTest.cancelled)).toBe(before);
});
