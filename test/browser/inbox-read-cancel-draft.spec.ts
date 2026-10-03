import {test,expect} from '@playwright/test';

for(const request of ['Load Inbox','Search Gmail','Check connection'])for(const saved of [false,true])test(`Cancelling ${request} retains ${saved?'edited saved':'unsaved'} local mail`,async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  const {connectionController:c}=await import('/src/runtime/connection-ui.tsx');
  const {secureConnectionStore:s}=await import('/src/runtime/native-connection.ts');
  const f=(window as any).cancelMail={slots:{},writes:0,hold:false,release:null,aborts:0,mutations:0};
  s.read=async key=>structuredClone(f.slots[key]??null);
  s.compareExchange=async(key,prior,next)=>{if(JSON.stringify(f.slots[key]??null)!==JSON.stringify(prior))return {status:'conflict'};f.writes++;f.slots[key]=structuredClone(next);return {status:'saved'};};
  const accounts=[{connectionId:'fixture-grant',label:'Fixture mailbox',connected:true,grantedCapabilities:['google.gmail.triage']}];
  const deferred=(result:any,signal:AbortSignal)=>{if(!f.hold)return Promise.resolve(result);signal.addEventListener('abort',()=>f.aborts++,{once:true});return new Promise(resolve=>{f.release=()=>resolve(result);});};
  const client={gmailAccounts:(signal:AbortSignal)=>deferred(accounts,signal),gmailSearch:(_account:string,_query:string,signal:AbortSignal)=>deferred({messages:[{id:'late',threadId:'late',from:'Late response',to:[],subject:'Must not appear',snippet:'stale',receivedAt:'2026-10-03T12:00:00Z',unread:false}],syncedAt:'late'},signal),gmailInboxCapabilities:async()=>({send:false,providerDrafts:false,mailboxMutations:false}),gmailPrepareOperation:async()=>{f.mutations++;throw Error('No provider mutation expected');}};
  c.getCloudClient=()=>({client,sessionId:'fixture-session',credentialId:'fixture'} as any);
  const original=c.getSnapshot();c.getSnapshot=()=>({...original,cloudAccount:{environment:'production',userId:'fixture-owner',sessionId:'fixture-session',credentialId:'fixture'}} as any);
 });
 await page.getByRole('button',{name:'Inbox',exact:true}).click();
 await expect(page.getByRole('button',{name:'Load Inbox',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Compose',exact:true}).click();
 await page.getByPlaceholder('To',{exact:true}).fill('fixture@example.invalid');
 await page.getByPlaceholder('To',{exact:true}).press('Enter');
 await page.getByRole('textbox',{name:'Subject',exact:true}).fill('Retained subject');
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('Original text');
 if(saved)await page.getByRole('button',{name:'Save draft locally',exact:true}).click();
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('Unsaved important text');
 await page.getByRole('textbox',{name:'Cc',exact:true}).fill('copy@example.invalid');
 await page.getByRole('textbox',{name:'Bcc',exact:true}).fill('blind@example.invalid');
 await page.getByRole('button',{name:'Back from draft',exact:true}).click();
 if(request==='Search Gmail'){
  await page.getByRole('button',{name:'Search email',exact:true}).click();
  await page.getByPlaceholder('Search mail').fill('fixture');
 }
 const before=await page.evaluate(()=>JSON.stringify((window as any).cancelMail.slots));
 await page.evaluate(()=>(window as any).cancelMail.hold=true);
 await page.getByRole('button',{name:request,exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>typeof (window as any).cancelMail.release)).toBe('function');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByRole('button',{name:'Continue draft',exact:true})).toBeVisible();
 await page.evaluate(async()=>{(window as any).cancelMail.release();await new Promise(resolve=>setTimeout(resolve,0));});
 await expect(page.getByText('Must not appear',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Continue draft',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Subject',exact:true})).toHaveValue('Retained subject');
 await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Unsaved important text');
 await expect(page.getByRole('textbox',{name:'Cc',exact:true})).toHaveValue('copy@example.invalid');
 await expect(page.getByRole('textbox',{name:'Bcc',exact:true})).toHaveValue('blind@example.invalid');
 await expect(page.getByText('fixture@example.invalid',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.stringify((window as any).cancelMail.slots))).toBe(before);
 expect(await page.evaluate(()=>({aborts:(window as any).cancelMail.aborts,mutations:(window as any).cancelMail.mutations}))).toEqual({aborts:1,mutations:0});
});
