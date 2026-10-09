import {test,expect,type Page} from '@playwright/test';
import {recorder} from './voice-fixture';

// A signed-in Eliza Cloud session never selects Cloud speech by itself. The recorder's explicit,
// disclosed choice is persisted (voice-route:v1) and survives a reload. The Cloud session is a
// synthetic in-page binding; no Cloud request is made.
// The development server is shared and slow on a loaded machine.
test.describe.configure({timeout:120000});
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));});
async function signedInCloud(page:Page){
 await page.evaluate(async()=>{
  const {connectionController}=await import('/src/runtime/connection-ui.tsx');
  (connectionController as any).getCloudEnvironment=()=>'production';
  (connectionController as any).getCloudClient=()=>({client:{},sessionId:'synthetic-cloud-session',credentialId:'synthetic-credential'});
 });
}
async function openRecorder(page:Page){
 await page.getByRole('button',{name:'Notes',exact:true}).click();
 await page.getByRole('button',{name:'Record and transcribe',exact:true}).click();
 await expect(recorder(page)).toBeVisible();
}
test('on-device speech stays the default with a Cloud account until the disclosed choice, which persists',async({page})=>{
 const cloud:string[]=[];page.on('request',request=>{if(/elizacloud|eliza\.how|\/api\/v1\//.test(request.url()))cloud.push(request.url());});
 await page.goto('/');await signedInCloud(page);await openRecorder(page);
 await expect(recorder(page)).toContainText('English-only speech recognition runs in this browser');
 const choose=page.getByRole('button',{name:'Use Eliza Cloud voice (uses credits)',exact:true});
 await expect(choose).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('alphaphone:voice-route:v1'))).toBeNull();
 await choose.click();
 await expect(page.getByRole('button',{name:'Use on-device voice',exact:true})).toBeVisible();
 const stored=JSON.parse(await page.evaluate(()=>localStorage.getItem('alphaphone:voice-route:v1'))||'null');
 expect(stored).toMatchObject({version:1,route:'cloud',disclosed:'cloud-speech-uses-credits'});
 // Restart: the persisted choice is the default for the signed-in account.
 await page.reload();await signedInCloud(page);await openRecorder(page);
 await expect(page.getByRole('button',{name:'Use on-device voice',exact:true})).toBeVisible();
 await expect(recorder(page)).not.toContainText('English-only speech recognition runs in this browser');
 // Choosing on-device again persists across another restart.
 await page.getByRole('button',{name:'Use on-device voice',exact:true}).click();
 await expect(page.getByRole('button',{name:'Use Eliza Cloud voice (uses credits)',exact:true})).toBeVisible();
 await page.reload();await signedInCloud(page);await openRecorder(page);
 await expect(recorder(page)).toContainText('English-only speech recognition runs in this browser');
 // Signed out: a stored Cloud choice can never select Cloud.
 await page.evaluate(()=>localStorage.setItem('alphaphone:voice-route:v1',JSON.stringify({version:1,route:'cloud',disclosed:'cloud-speech-uses-credits',chosenAt:1})));
 await page.reload();await openRecorder(page);
 await expect(recorder(page)).toContainText('English-only speech recognition runs in this browser');
 expect(cloud).toEqual([]);
});
