import { returnToApps } from './app-navigation';
import {test,expect} from '@playwright/test';
test('development entry surfaces do not expose native-only missing-feature messages',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));await page.goto('/?mode=dev');
 for(const name of ['Inbox','Calendar','Browser','Camera','Photos','Maps','Notes','Files','Workflows','Settings','Phone','Messages','Contacts','Wallet']){
  await page.getByRole('button',{name,exact:true}).first().click();await expect(page.locator('html')).toHaveAttribute('data-active-view',name.toLowerCase());
  const text=await page.locator('body').innerText();expect(text,name).not.toMatch(/Use the installed Android app|needs a connected native provider|Storage usage unavailable|not implemented on web|Native action unavailable/i);
  await returnToApps(page);
 }
});
