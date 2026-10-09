import {test,expect,type Page} from '@playwright/test';
test.use({hasTouch:true});
const answer='Synthetic reply for message actions.';
const agent=(page:Page)=>page.locator('[data-alpha-message-text]').filter({hasText:answer});
const menu=(page:Page)=>page.getByRole('menu',{name:'Message actions'});
async function conversation(page:Page,theme='light'){
 await page.goto('/?mode=dev&theme='+theme);
 await page.evaluate(async()=>{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).copiedMessage=text;}}});
  const {connectionController:c}=await import('/src/runtime/connection-ui.tsx');await c.initialize();await c.startDevelopment('local');
  const {LocalAgentProtocol}=await import('/src/runtime/local-agent.ts');LocalAgentProtocol.prototype.send=async(room)=>{(window as any).messageActionsRoom=room;return {text:'Synthetic reply for message actions.'};};
 });
 const input=page.getByRole('textbox',{name:'Ask Alpha',exact:true});await input.fill('My original request');await input.press('Enter');await expect(agent(page)).toBeVisible();
 // Raw CDP touches bypass Playwright actionability. Wait for the opening sheet
 // to settle and receive input before measuring coordinates; no click is sent.
 await agent(page).click({trial:true});
}
for(const theme of ['light','dark'])test(`tap reveals quiet actions and copies exact message: ${theme}`,async({page},info)=>{
 await conversation(page,theme);await expect(menu(page)).toHaveCount(0);await expect(page.getByText('Listen with Cloud',{exact:true})).toHaveCount(0);await expect(page.getByText('Listen on phone',{exact:true})).toHaveCount(0);
 const bounds=await agent(page).boundingBox();await page.touchscreen.tap(bounds!.x+20,bounds!.y+10);await expect(menu(page)).toBeVisible();
 await menu(page).getByRole('menuitem',{name:'Copy',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copiedMessage)).toBe(answer);await expect(page.getByRole('status').filter({hasText:'Copied.'})).toBeVisible();
 await expect(menu(page).getByRole('menuitem',{name:'Copy',exact:true}).locator('[data-alpha-icon]')).toHaveAttribute('data-alpha-icon','/icons/lucide/copy.svg');
 await page.screenshot({path:info.outputPath('message-actions-'+theme+'.png'),animations:'disabled'});
 await page.getByRole('textbox',{name:'Message Alpha',exact:true}).click();await expect(menu(page)).toHaveCount(0);
});
test('keyboard focus, arrow navigation and Escape return to the selected message',async({page})=>{
 await conversation(page);await agent(page).focus();await agent(page).press('Enter');await expect(menu(page).getByRole('menuitem',{name:'Copy',exact:true})).toBeFocused();
 await page.keyboard.press('End');await expect(menu(page).getByRole('menuitem',{name:'Close message actions'})).toBeFocused();await page.keyboard.press('Home');await expect(menu(page).getByRole('menuitem',{name:'Copy',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(menu(page)).toHaveCount(0);await expect(agent(page)).toBeFocused();
});
test('long press reveals actions, pointer movement cancels a held gesture',async({page})=>{
 await conversation(page);const b=await agent(page).boundingBox(),cdp=await page.context().newCDPSession(page),point={x:b!.x+20,y:b!.y+10};
 await expect(menu(page)).toHaveCount(0);expect(await agent(page).evaluate((element,point)=>element.contains(document.elementFromPoint(point.x,point.y)),point)).toBe(true);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await expect(menu(page)).toBeVisible();await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(menu(page)).toBeVisible();await menu(page).getByRole('menuitem',{name:'Close message actions'}).click();
 await agent(page).dispatchEvent('pointerdown',{pointerType:'touch',clientX:30,clientY:30});await agent(page).dispatchEvent('pointermove',{pointerType:'touch',clientX:60,clientY:30});await page.waitForTimeout(550);await expect(menu(page)).toHaveCount(0);
});
test('copy denial stays in the menu and does not change the original messages',async({page})=>{
 await conversation(page);await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Denied');}}}));await agent(page).click();await menu(page).getByRole('menuitem',{name:'Copy',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Copy unavailable.'})).toBeVisible();await expect(agent(page)).toHaveText(answer);await expect(page.locator('[data-alpha-message-text]').filter({hasText:'My original request'})).toHaveText('My original request');
});
test('Read aloud invokes the existing speech path; fixture blocks all audio',async({page})=>{
 await conversation(page);await page.evaluate(async()=>{const {BrowserVoice}=await import('/src/browser/voice.ts');BrowserVoice.prototype.localSpeechStatus=async()=>({ready:true,execution:'browser',route:'browser'});BrowserVoice.prototype.synthesizeLocal=async(input)=>{(window as any).messageSpeechText=input.text;throw Error('Synthetic audio blocked');};});
 await agent(page).click();await menu(page).getByRole('menuitem',{name:'Read aloud'}).click();await expect.poll(()=>page.evaluate(()=>(window as any).messageSpeechText)).toBe(answer);await expect(page.getByRole('status').filter({hasText:'Synthetic audio blocked'})).toBeVisible();
});
test('user messages copy without unsupported playback, reply or edit controls',async({page})=>{
 await conversation(page);await page.locator('[data-alpha-message-text]').filter({hasText:'My original request'}).click();await expect(menu(page).getByRole('menuitem',{name:'Read aloud'})).toHaveCount(0);await expect(menu(page).getByRole('menuitem',{name:'Reply'})).toHaveCount(0);await expect(menu(page).getByRole('menuitem',{name:'Edit'})).toHaveCount(0);await menu(page).getByRole('menuitem',{name:'Copy',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copiedMessage)).toBe('My original request');
});
test('same bubble toggles; pointer close stays quiet and keyboard close restores visible focus',async({page},info)=>{
 await conversation(page);const message=agent(page);
 await message.tap();await expect(menu(page)).toBeVisible();await message.tap();await expect(menu(page)).toHaveCount(0);
 await message.tap();await menu(page).getByRole('menuitem',{name:'Close message actions'}).tap();await expect(menu(page)).toHaveCount(0);
 expect(await message.evaluate(element=>element.matches(':focus-visible'))).toBe(false);
 await page.screenshot({path:info.outputPath('pointer-close.png'),animations:'disabled'});
 await message.focus();await page.keyboard.press('Enter');await page.keyboard.press('Escape');await expect(message).toBeFocused();
 expect(await message.evaluate(element=>getComputedStyle(element).outlineWidth)).toBe('2px');
 await page.screenshot({path:info.outputPath('keyboard-focus.png'),animations:'disabled'});
 await message.press('Enter');await page.keyboard.press('End');await page.keyboard.press('Enter');await expect(menu(page)).toHaveCount(0);await expect(message).toBeFocused();
});
async function textPoint(locator:import('@playwright/test').Locator,end=false){
 return locator.evaluate((element,end)=>{const node=element.firstChild!;const range=document.createRange();const offset=end?Math.max(0,node.textContent!.length-1):0;range.setStart(node,offset);range.setEnd(node,offset+1);const rect=range.getBoundingClientRect();return {x:end?rect.right-1:rect.left+1,y:rect.top+rect.height/2};},end);
}
test('mouse selection follows chronological DOM across messages without shell gestures or menus',async({page},info)=>{
 await conversation(page);const first=page.locator('[data-alpha-message-text]').filter({hasText:'My original request'}),last=agent(page);
 expect(await page.locator('[data-alpha-message-text]').allTextContents()).toEqual(['My original request',answer]);
 const a=await textPoint(first),b=await textPoint(last,true);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:16});await page.mouse.up();
 const selected=await page.evaluate(()=>window.getSelection()!.toString());expect(selected).toContain('My original request');expect(selected).toContain('Synthetic reply for message actions');expect(selected.indexOf('My original request')).toBeLessThan(selected.indexOf('Synthetic reply'));
 await expect(menu(page)).toHaveCount(0);await expect(page.getByRole('textbox',{name:'Message Alpha',exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('chronological-selection.png'),animations:'disabled'});
});
test('touch long-press drag selects across messages without opening a message menu',async({page},info)=>{
 await conversation(page);const first=page.locator('[data-alpha-message-text]').filter({hasText:'My original request'}),last=agent(page),a=await textPoint(first),b=await textPoint(last,true),cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});await page.waitForTimeout(650);
 for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/12,y:a.y+(b.y-a.y)*i/12}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const selected=await page.evaluate(()=>window.getSelection()!.toString());expect(selected).toContain('My original request');expect(selected).toContain('Synthetic reply for message actions');await expect(menu(page)).toHaveCount(0);await page.screenshot({path:info.outputPath('touch-selection.png'),animations:'disabled'});
});
test('transcript keeps the older reading anchor and follows only bottom or a new user turn',async({page})=>{
 await conversation(page);await page.evaluate(async()=>{const {connectionController:c}=await import('/src/runtime/connection-ui.tsx');const {LocalAgentProtocol:P}=await import('/src/runtime/local-agent.ts');const rows=(window as any).scrollRows=Array.from({length:48},(_,i)=>({id:crypto.randomUUID(),role:i%2?'assistant':'user',text:`Historical ${i}: complete synthetic text for scroll anchoring. More text stays on this message.`}));P.prototype.messages=async()=>({messages:structuredClone(rows)});P.prototype.listConversations=async()=>[{id:(window as any).messageActionsRoom,title:'Synthetic scroll fixture'}];await c.restoreHistory((window as any).messageActionsRoom);});
 const transcript=page.locator('[data-alpha-transcript]');await expect(transcript.locator('[data-alpha-message-id]')).toHaveCount(48);
 await page.locator('[data-alpha-layer="conversation"]').evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
 const before=await transcript.evaluate(element=>{element.scrollTop=element.scrollHeight/3;const top=element.getBoundingClientRect().top;const anchor=Array.from(element.querySelectorAll('[data-alpha-message-id]')).find(row=>row.getBoundingClientRect().bottom>top)!;return {id:anchor.getAttribute('data-alpha-message-id'),y:anchor.getBoundingClientRect().top};});
 await page.evaluate(async()=>{(window as any).scrollRows.push({id:crypto.randomUUID(),role:'assistant',text:'New synthetic reply while reading older history.'});await(await import('/src/runtime/connection-ui.tsx')).connectionController.restoreHistory((window as any).messageActionsRoom);});
 const anchored=await page.locator(`[data-alpha-message-id="${before.id}"]`).boundingBox();expect(Math.abs(anchored!.y-before.y)).toBeLessThan(2);
 await transcript.evaluate(element=>element.scrollTop=element.scrollHeight);
 await page.evaluate(async()=>{(window as any).scrollRows.push({id:crypto.randomUUID(),role:'assistant',text:'Another synthetic reply while pinned to bottom.'});await(await import('/src/runtime/connection-ui.tsx')).connectionController.restoreHistory((window as any).messageActionsRoom);});
 await expect.poll(()=>transcript.evaluate(element=>element.scrollHeight-element.clientHeight-element.scrollTop)).toBeLessThan(2);
 await page.getByRole('button',{name:'Shrink chat',exact:true}).click();await page.locator('[data-alpha-layer="conversation"]').evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>{}))));await expect.poll(()=>transcript.evaluate(element=>element.scrollHeight-element.clientHeight-element.scrollTop)).toBeLessThan(2);
 await page.getByRole('button',{name:'Expand chat',exact:true}).click();await page.locator('[data-alpha-layer="conversation"]').evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
 await transcript.evaluate(element=>element.scrollTop=0);const composer=page.getByRole('textbox',{name:'Message Alpha',exact:true});await composer.fill('A new user turn');await composer.press('Enter');await expect(agent(page)).toBeVisible();await expect.poll(()=>transcript.evaluate(element=>element.scrollHeight-element.clientHeight-element.scrollTop)).toBeLessThan(2);
});
test('Home shows clean Calendar and Workflows tiles with Inbox last',async({page},info)=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));await page.goto('/?mode=dev');
 const home=page.getByRole('region',{name:'Home',exact:true});await expect(home.getByRole('button',{name:'Open your calendar',exact:true})).toContainText(/See your events|No upcoming events/);
 await expect(home.getByRole('button',{name:'Open workflows',exact:true})).toBeVisible();
 const tiles=home.locator(':scope > .scr').first().getByRole('button');await expect(tiles.nth(1)).toHaveAttribute('aria-label','Open workflows');await expect(tiles.nth(2)).toHaveAttribute('aria-label',/^Open Inbox:/);
 await page.screenshot({path:info.outputPath('home-clean-tiles.png'),animations:'disabled'});
 await page.evaluate(async()=>{const {BrowserCalendar}=await import('/src/browser/calendar.ts');await new BrowserCalendar().save({calendarId:'local',title:'Synthetic Home calendar check',begin:Date.now()+3600000,end:Date.now()+7200000,creationId:crypto.randomUUID()});});await page.reload();await expect(home.getByRole('button',{name:'Open calendar event: Synthetic Home calendar check',exact:true})).toContainText('Synthetic Home calendar check');await page.screenshot({path:info.outputPath('home-next-event.png'),animations:'disabled'});
});
