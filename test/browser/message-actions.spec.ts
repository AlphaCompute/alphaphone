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
  const {LocalAgentProtocol}=await import('/src/runtime/local-agent.ts');LocalAgentProtocol.prototype.send=async()=>({text:'Synthetic reply for message actions.'});
 });
 const input=page.getByRole('textbox',{name:'Ask Alpha',exact:true});await input.fill('My original request');await input.press('Enter');await expect(agent(page)).toBeVisible();
}
for(const theme of ['light','dark'])test(`tap reveals quiet actions and copies exact message: ${theme}`,async({page},info)=>{
 await conversation(page,theme);await expect(menu(page)).toHaveCount(0);await expect(page.getByText('Listen with Cloud',{exact:true})).toHaveCount(0);await expect(page.getByText('Listen on phone',{exact:true})).toHaveCount(0);
 const bounds=await agent(page).boundingBox();await page.touchscreen.tap(bounds!.x+20,bounds!.y+10);await expect(menu(page)).toBeVisible();
 await menu(page).getByRole('menuitem',{name:'Copy',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copiedMessage)).toBe(answer);await expect(page.getByRole('status').filter({hasText:'Copied.'})).toBeVisible();
 await page.screenshot({path:info.outputPath('message-actions-'+theme+'.png'),animations:'disabled'});
 await page.getByRole('textbox',{name:'Message Alpha',exact:true}).click();await expect(menu(page)).toHaveCount(0);
});
test('keyboard focus, arrow navigation and Escape return to the selected message',async({page})=>{
 await conversation(page);await agent(page).focus();await agent(page).press('Enter');await expect(menu(page).getByRole('menuitem',{name:'Copy',exact:true})).toBeFocused();
 await page.keyboard.press('End');await expect(menu(page).getByRole('menuitem',{name:'Close message actions'})).toBeFocused();await page.keyboard.press('Home');await expect(menu(page).getByRole('menuitem',{name:'Copy',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(menu(page)).toHaveCount(0);await expect(agent(page)).toBeFocused();
});
test('long press reveals actions, pointer movement cancels a held gesture',async({page})=>{
 await conversation(page);const b=await agent(page).boundingBox(),cdp=await page.context().newCDPSession(page),point={x:b!.x+20,y:b!.y+10};
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
test('Home shows clean Calendar and Workflows tiles with Inbox last',async({page},info)=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));await page.goto('/?mode=dev');
 const home=page.getByRole('region',{name:'Home',exact:true});await expect(home.getByRole('button',{name:'Open your calendar',exact:true})).toContainText(/See your events|No upcoming events/);
 await expect(home.getByRole('button',{name:'Open workflows',exact:true})).toBeVisible();
 const tiles=home.locator(':scope > .scr').first().getByRole('button');await expect(tiles.nth(1)).toHaveAttribute('aria-label','Open workflows');await expect(tiles.nth(2)).toHaveAttribute('aria-label',/^Open Inbox:/);
 await page.screenshot({path:info.outputPath('home-clean-tiles.png'),animations:'disabled'});
 await page.evaluate(async()=>{const {BrowserCalendar}=await import('/src/browser/calendar.ts');await new BrowserCalendar().save({calendarId:'local',title:'Synthetic Home calendar check',begin:Date.now()+3600000,end:Date.now()+7200000,creationId:crypto.randomUUID()});});await page.reload();await expect(home.getByRole('button',{name:'Open calendar event: Synthetic Home calendar check',exact:true})).toContainText('Synthetic Home calendar check');await page.screenshot({path:info.outputPath('home-next-event.png'),animations:'disabled'});
});
