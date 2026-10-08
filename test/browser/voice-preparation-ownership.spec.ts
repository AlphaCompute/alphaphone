import { returnToApps } from './app-navigation';
import {test,expect} from '@playwright/test';
for(const change of ['navigation','return','owner','none'] as const)test(`voice preparation rejection respects ${change}`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto('/');await expect(page.getByRole('button',{name:'Talk',exact:true})).toBeVisible();
 await page.evaluate(async()=>{
  const {BrowserVoice}=await import('/src/browser/voice.ts');const {connectionController}=await import('/src/runtime/connection-ui.tsx');const w=window as any;
  w.preparation={owner:'fixture-owner',probes:0,starts:0,uploads:0};
  (connectionController as any).getCloudEnvironment=()=> 'production';
  (connectionController as any).getCloudClient=()=>({sessionId:w.preparation.owner,credentialId:"synthetic-no-provider-credential"});
  BrowserVoice.prototype.localSpeechStatus=async()=>{w.preparation.probes++;return new Promise((_,reject)=>{w.preparation.reject=()=>reject(Error('Synthetic unavailable speech'));});};
  BrowserVoice.prototype.startRecording=async()=>{w.preparation.starts++;throw Error('Unexpected microphone');};
  BrowserVoice.prototype.transcribeLocalRecording=async()=>{w.preparation.uploads++;throw Error('Unexpected upload');};
 });
 await page.getByRole('button',{name:'Talk',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).preparation.probes)).toBe(1);
 if(change==='navigation'||change==='return')await page.getByRole('button',{name:'Settings',exact:true}).click();
 if(change==='return')await returnToApps(page);
 if(change==='owner')await page.evaluate(()=>{(window as any).preparation.owner='replacement-owner';});
 await page.evaluate(async()=>{(window as any).preparation.reject();await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));});
 if(change==='none')await expect(page.getByRole('button',{name:'Discard recording',exact:true})).toBeVisible();
 else {await expect(page.getByRole('button',{name:'Discard recording',exact:true})).toHaveCount(0);if(change==='navigation')await expect(page.getByText('Settings',{exact:true}).first()).toBeVisible();else await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();}
 expect(await page.evaluate(()=>({starts:(window as any).preparation.starts,uploads:(window as any).preparation.uploads}))).toEqual({starts:0,uploads:0});
});
