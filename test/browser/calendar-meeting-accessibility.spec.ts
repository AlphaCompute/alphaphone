import {test,expect} from '@playwright/test';
for(const theme of ['light','dark'])for(const height of [640,360])test(`local meeting preview supports large text: ${theme} ${height}`,async({page},info)=>{
 await page.setViewportSize({width:360,height});await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));await page.goto('/?mode=dev&theme='+theme);
 await page.evaluate(async()=>{const {BrowserDevice}=await import('/src/browser/device.ts');await BrowserDevice.prototype.setTextScale({percent:150});navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});
 const trigger=page.getByRole('button',{name:'Calendar',exact:true});await trigger.focus();await page.evaluate(async()=>{const {openCalendarMeeting}=await import('/src/browser/calendar-meeting.ts');openCalendarMeeting('Planning'+'UnbrokenTitle'.repeat(25),['Alexandra'+'LongSurname'.repeat(25),'Maya']);});
 const room=page.getByRole('dialog',{name:'Calendar meeting'}),leave=room.getByRole('button',{name:'Leave meeting',exact:true});
 expect(await room.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await expect(leave).toBeInViewport();expect((await leave.boundingBox())!.height).toBeGreaterThanOrEqual(44);await expect(leave).toHaveCSS('font-size','24px');await expect(leave).toHaveCSS('color-scheme',theme);
 const heading=room.getByRole('heading');await heading.scrollIntoViewIfNeeded();await expect(leave).toBeInViewport();
 for(const [name,error] of [['Turn camera on','Camera could not start. Try again.'],['Unmute microphone','Microphone could not start. Try again.']]){
  const button=room.getByRole('button',{name,exact:true});await button.click();await expect(room.getByRole('status')).toHaveText(error);await expect(room.getByRole('status')).toBeInViewport();await expect(button).toBeEnabled();await expect(leave).toBeInViewport();expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 }
 await page.screenshot({path:info.outputPath('meeting-preview.png')});await leave.click();await expect(room).toHaveCount(0);await expect(trigger).toBeFocused();
});
