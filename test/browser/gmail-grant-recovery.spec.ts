import {test,expect} from '@playwright/test';
for(const reason of ['disconnected','scope-revoked'] as const)test(`Gmail same-ID ${reason} clears read availability and recovers explicitly`,async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  const {connectionController:c}=await import('/src/runtime/connection-ui.tsx');
  const {secureConnectionStore:s}=await import('/src/runtime/native-connection.ts');s.read=async()=>null;
  const w=window as any;w.gmailGrantFixture={connected:true,triage:true,reads:0,oauth:0};
  const client={gmailAccounts:async()=>[{connectionId:'same-grant',label:'Fixture mailbox',configured:true,connected:w.gmailGrantFixture.connected,grantedCapabilities:w.gmailGrantFixture.triage?['google.gmail.triage']:[]}],gmailSearch:async()=>{w.gmailGrantFixture.reads++;return {messages:[],syncedAt:'fixture-revision'};},initiateGmail:async()=>{w.gmailGrantFixture.oauth++;throw Error('No live OAuth in fixture');}};
  c.getCloudClient=()=>({client,sessionId:'fixture-cloud',credentialId:'fixture-only'} as any);
  const snapshot={...c.getSnapshot(),cloudAccount:{environment:'production',userId:'fixture-owner',sessionId:'fixture-cloud',credentialId:'fixture-only'}};c.getSnapshot=()=>snapshot as any;
 });
 await page.getByRole('button',{name:'Inbox',exact:true}).click();
 await expect(page.getByRole('button',{name:'Load Inbox',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Load Inbox',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).gmailGrantFixture.reads)).toBe(1);
 await page.evaluate(reason=>{const f=(window as any).gmailGrantFixture;if(reason==='disconnected')f.connected=false;else f.triage=false;},reason);
 await page.getByRole('button',{name:'Check connection',exact:true}).click();
 await expect(page.getByRole('button',{name:'Load Inbox',exact:true})).toHaveCount(0);
 await expect(page.getByText('Gmail connected. Tap Load Inbox.',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Fixture mailbox',exact:true}).click();
 await expect(page.getByRole('button',{name:'Load Inbox',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).gmailGrantFixture)).toMatchObject({reads:1,oauth:0});
 await page.evaluate(()=>{const f=(window as any).gmailGrantFixture;f.connected=true;f.triage=true;});
 await page.getByRole('button',{name:'Check connection',exact:true}).click();
 await expect(page.getByRole('button',{name:'Load Inbox',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).gmailGrantFixture.reads)).toBe(1);
 await page.getByRole('button',{name:'Load Inbox',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).gmailGrantFixture)).toMatchObject({reads:2,oauth:0});
});
