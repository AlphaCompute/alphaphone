import {test,expect} from '@playwright/test';
for(const reason of ['disconnected','scope-revoked'] as const)test(`Gmail same-ID ${reason} clears read availability and recovers explicitly`,async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  const {connectionController:c}=await import('/src/runtime/connection-ui.tsx');
  const {inboxLocalStore:s}=await import('/src/runtime/inbox-local-store.ts');s.read=async()=>null;
  const w=window as any;w.gmailGrantFixture={connected:true,triage:true,reads:0,oauth:0};
  const client={gmailAccounts:async()=>[{connectionId:'same-grant',label:'Fixture mailbox',configured:true,connected:w.gmailGrantFixture.connected,grantedCapabilities:w.gmailGrantFixture.triage?['google.gmail.triage']:[]}],gmailSearch:async()=>{w.gmailGrantFixture.reads++;return {messages:[],syncedAt:'fixture-revision'};},initiateGmail:async()=>{w.gmailGrantFixture.oauth++;throw Error('No live OAuth in fixture');}};
  c.getCloudClient=()=>({client,sessionId:'fixture-cloud',credentialId:'fixture-only'} as any);
  const snapshot={...c.getSnapshot(),cloudAccount:{environment:'production',userId:'fixture-owner',sessionId:'fixture-cloud',credentialId:'fixture-only'}};c.getSnapshot=()=>snapshot as any;
 });
 await page.getByRole('button',{name:'Inbox',exact:true}).click();
 // Opening Inbox loads the connected account once, without another tap.
 await expect(page.getByRole('button',{name:'Refresh inbox',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>(window as any).gmailGrantFixture.reads)).toBe(1);
 await page.evaluate(reason=>{const f=(window as any).gmailGrantFixture;if(reason==='disconnected')f.connected=false;else f.triage=false;},reason);
 await page.evaluate(()=>window.dispatchEvent(new Event('alpha:google-accounts-changed')));
 await expect(page.getByRole('button',{name:'Refresh inbox',exact:true})).toHaveCount(0);
 await expect(page.getByText('Connect Gmail to read your inbox',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Fixture mailbox',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Refresh inbox',exact:true})).toHaveCount(0);
 await expect(page.getByText('Connect Gmail to read your inbox',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).gmailGrantFixture)).toMatchObject({reads:1,oauth:0});
 await page.evaluate(()=>{const f=(window as any).gmailGrantFixture;f.connected=true;f.triage=true;});
 await page.evaluate(()=>window.dispatchEvent(new Event('alpha:google-accounts-changed')));
 await expect(page.getByRole('button',{name:'Refresh inbox',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>(window as any).gmailGrantFixture.reads)).toBe(2);
 await page.getByRole('button',{name:'Refresh inbox',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).gmailGrantFixture.reads)).toBe(3);
 expect(await page.evaluate(()=>(window as any).gmailGrantFixture.oauth)).toBe(0);
});

// The successful handoff. The authorization page is the system browser's (AlphaConnection.openExternal,
// stubbed at the Capacitor bridge); Google, OAuth and Eliza Cloud are not involved and no URL is opened.
test('Reconnect Gmail and the single Authorize Gmail changes chip hand off once with the selected grants; nothing is read until Check connection',async({page})=>{
 const AUTH='https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture&state=synthetic';
 await page.addInitScript(()=>{
  localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));
  const f=(window as any).handoffFixture={opened:[] as string[],cancels:0,hold:null as Promise<void>|null};
  const methods=(names:string[])=>names.map(name=>({name,rtype:'promise'}));
  (window as any).Capacitor={PluginHeaders:[{name:'AlphaConnection',methods:methods(['request','cancel','secureRead','secureWrite','secureRemove','secureCompareExchange','openExternal'])}],nativePromise:async(plugin:string,method:string,input:any)=>{
   if(plugin!=='AlphaConnection')throw Error('Unexpected fixture native plugin');
   if(method==='secureRead')return {value:null};if(method==='secureCompareExchange')return {status:'saved'};if(method==='secureWrite'||method==='secureRemove')return {};
   if(method==='cancel'){f.cancels++;return {};}
   if(method==='openExternal'){f.opened.push(input.url);if(f.hold)await f.hold;return {};}
   throw Error('No network in fixture');
  }};
 });
 await page.goto('/');
 await page.evaluate(async AUTH=>{
  const {connectionController:c}=await import('/src/runtime/connection-ui.tsx');
  const {CloudProtocolError}=await import('/src/runtime/cloud-protocol.ts');
  const w=window as any,f=w.handoffFixture;Object.assign(f,{reads:0,initiates:[] as unknown[],revokeNext:true,session:'fixture-cloud'});
  const client={gmailAccounts:async()=>[{connectionId:'grant-1',label:'Fixture mailbox',configured:true,connected:true,grantedCapabilities:['google.gmail.triage','google.gmail.send']}],
   gmailSearch:async()=>{f.reads++;if(f.revokeNext){f.revokeNext=false;throw new CloudProtocolError('http',409);}return {messages:[],syncedAt:'fixture-revision',nextPageToken:null};},
   initiateGmail:async(_signal:AbortSignal,permission:string,granted?:string[])=>{f.initiates.push([permission,granted??null]);return AUTH;}};
  c.getCloudClient=()=>({client,sessionId:f.session,credentialId:'fixture-only'} as any);
  const snapshot={...c.getSnapshot(),cloudAccount:{environment:'production',userId:'fixture-owner',sessionId:'fixture-cloud',credentialId:'fixture-only'}};c.getSnapshot=()=>snapshot as any;
 },AUTH);
 const f=()=>page.evaluate(()=>(window as any).handoffFixture);
 const chip=(name:string)=>page.getByRole('button',{name,exact:true});
 const next=page.getByText('After authorizing Gmail, tap Check connection.',{exact:true});
 await page.getByRole('button',{name:'Inbox',exact:true}).click();
 // The first read finds the grant revoked; Reconnect is offered and nothing retries on its own.
 await expect(chip('Reconnect Gmail')).toBeVisible();
 expect((await f()).reads).toBe(1);
 const grants=['google.gmail.triage','google.gmail.send'];
 for(const [label,permission] of [['Reconnect Gmail','read'],['Authorize Gmail changes','modify']] as const){
  const before=await f();
  await chip(label).click();
  await expect(next).toBeVisible();
  const after=await f();
  expect(after.initiates.slice(before.initiates.length),label).toEqual([[permission,grants]]);
  expect(after.opened.slice(before.opened.length),label).toEqual([AUTH]);
  expect(after.reads,label+': no mailbox read until Check connection').toBe(before.reads);
  if(label==='Reconnect Gmail'){await chip('Check connection').click();await expect.poll(async()=>(await f()).reads).toBe(before.reads+1);await expect(chip('Reconnect Gmail')).toHaveCount(0);}
 }
 // A handoff cancelled while the browser is open reports the cancellation, not a pending authorization.
 await page.evaluate(()=>{const f=(window as any).handoffFixture;f.hold=new Promise<void>(resolve=>{f.release=resolve;});});
 await chip('Authorize Gmail changes').click();
 await expect(chip('Cancel')).toBeVisible();
 await chip('Cancel').click();
 await expect(page.getByText('Gmail request cancelled',{exact:true})).toBeVisible();
 expect((await f()).cancels).toBeGreaterThan(0);
 await page.evaluate(()=>(window as any).handoffFixture.release());
 await expect(next).toHaveCount(0);
 // The Cloud account changes while the browser is open: the late handoff is not applied to it.
 await page.evaluate(()=>{const f=(window as any).handoffFixture;f.hold=new Promise<void>(resolve=>{f.release=resolve;});});
 const reads=(await f()).reads;
 await chip('Authorize Gmail changes').click();
 await expect.poll(async()=>(await f()).opened.length).toBe(4);
 await page.evaluate(()=>{const f=(window as any).handoffFixture;f.session='other-cloud';f.release();});
 await page.waitForTimeout(300);
 await expect(next).toHaveCount(0);
 expect((await f()).reads).toBe(reads);
});
