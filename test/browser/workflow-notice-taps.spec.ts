import {test,expect} from '@playwright/test';
// Production renderer and authenticated connection; controlled transport/native queue, no real notification.
for(const scenario of ['two','other-owner','wrong-version','unconfirmed','navigation-race','owner-race','reconnect','queue-changed','builder-race','new-tap-during-read'] as const){
 test('scoped native workflow tap '+scenario,async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(scenario=>{
   const w=window as any;w.androidBridge={};
   localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));
   const store=new Map();
   const f=w.deliveryFixture={configured:0,cancelled:0,disabled:[] as string[],nativeSync:0,foregroundSync:0,polling:true,enabled:false,notifications:false,events:[] as string[],input:null as any,release:null as any,holdRetire:false,retireRelease:null as any,mockHold:false,mockReleases:{} as Record<string,()=>void>,removed:[] as string[]};
   const methods=(names:string[])=>names.map(name=>({name,rtype:'promise'}));
   w.Capacitor={PluginHeaders:[
    {name:'AlphaNotifications',methods:methods(['pendingWorkflowTap','consumeWorkflowTap','addListener','removeListener'])},
    {name:'Agent',methods:methods(['getStatus','start','request'])},
    {name:'AlphaConnection',methods:methods(['secureRead','secureWrite','secureCompareExchange','secureRemove','cancel','addListener','removeListener','pauseNotificationCollection'])},
    {name:'AlphaActionJournal',methods:methods(['list'])},
    {name:'DeviceApps',methods:methods(['buildInfo'])},
    {name:'AlphaHostedResults',methods:methods(['beginBackground','cancelBackground','configureBackground','disableBackground','inboxHistory','syncInbox','status','setBackgroundPolling','enable','pendingResult','addListener','removeListener'])},
   ],nativePromise:async(plugin:string,method:string,input:any)=>{
    if(plugin==='AlphaNotifications'){
     if(method==='pendingWorkflowTap'){f.pendingReads=(f.pendingReads||0)+1;return f.taps?.[0]||{};}
     if(method==='consumeWorkflowTap'){f.consumed=(f.consumed||[]);if(f.taps[0]?.token!==input.token)throw Error('Changed');f.consumed.push(input.token);f.taps.shift();return {};}
     return {};
    }
    if(plugin==='Agent'){
     if(method==='getStatus')return {packaged:true,state:'ready'};
     if(method==='start')return {state:'ready'};
     if(method==='request'){
      const path=input.path;let body:any;
      if(input.method==='POST'&&path.startsWith('/api/workflow/'))throw Error('Unexpected effect');
      if(path.startsWith('/api/workflow/executions/')){f.reads=(f.reads||0)+1;if(f.queueChanged){f.taps.reverse();f.queueChanged=false;}if(f.hold)await new Promise(r=>f.release=r);body={execution:{id:path.split('/').at(-1),workflowId:'flow',workflowVersionId:f.wrongVersion?'v2':'v1',status:'completed',finished:true,startedAt:'2026-10-01T12:00:00Z',output:'Verified retained result '+path.split('/').at(-1),events:[]}};return {status:200,body:JSON.stringify(body)};}
      if(path==='/api/workflow/workflows/flow')return {status:200,body:JSON.stringify({id:'flow',name:'Notice workflow',versionId:'v1',active:false,steps:[]})};

      if(path==='/api/auth/me')body={identity:{kind:'owner',id:'fixture-owner'},access:{role:'OWNER',mode:'session'}};
      else if(path==='/api/agents')body={agents:[{id:'fixture-agent',name:'Resident fixture',status:'running'}]};
      else if(path==='/api/client-devices/register')body={installationId:input.headers['X-Eliza-Device-Id'],enrollmentId:'fixture-enrollment',capabilities:[]};
      else if(path==='/api/conversations')body={conversations:[]};
      else if(path==='/api/workflow/status')body={hostedDigestProtocol:1};
      else if(path==='/api/workflow/hosted/sources')body={sources:[]};
      else if(path==='/api/workflow/hosted/loops')body={loops:[]};
      else if(path==='/api/workflow/hosted/live-accounts')body={accounts:[]};
      else if(path.startsWith('/api/workflow/hosted/results?')){f.foregroundSync++;f.events.push('foreground');body={entries:[]};}
      else return {status:404,body:'{}'};
      return {status:200,body:JSON.stringify(body)};
     }
    }
    if(plugin==='AlphaConnection'){
     if(method==='secureRead')return {value:store.get(input.slot)??null};
     if(method==='secureCompareExchange'){if((store.get(input.slot)??null)!==input.expectedValue)return {status:'conflict'};if(input.value===null)store.delete(input.slot);else store.set(input.slot,input.value);return {status:'saved'};}
     if(method==='secureWrite'){store.set(input.slot,input.value);return {};}
     if(method==='secureRemove'){f.removed.push(input.slot);store.delete(input.slot);return {};}
     if(method==='pauseNotificationCollection'&&f.mockHold){await new Promise<void>(resolve=>{f.mockReleases.notifications=resolve;});return {};}
     return {};
    }
    if(plugin==='AlphaActionJournal')return {entries:[]};
    if(plugin==='DeviceApps')return {launcher:false,version:'fixture'};
    if(plugin==='AlphaHostedResults'){
     if(method==='configureBackground'){
      f.configured++;f.input=input;
      if(scenario==='rejected')throw Error('Synthetic verification failure');
      if(scenario==='late')await new Promise(resolve=>{f.release=resolve;});
      f.enabled=true;return {generation:'fixture-generation',scope:'a'.repeat(64)};
     }
     if(method==='cancelBackground'){f.cancelled++;f.enabled=false;f.events.push('cancel');return {};}
     if(method==='disableBackground'){f.disabled.push(input?.sessionId);if(f.mockHold){const kind=input?.sessionId?'scoped':'unscoped';await new Promise<void>(resolve=>{f.mockReleases[kind]=resolve;});if(kind==='scoped'&&scenario==='mock-retire-rejected')throw Error('Synthetic session retirement rejection');}if(f.holdRetire)await new Promise(resolve=>{f.retireRelease=resolve;});f.enabled=false;return {};}
     if(method==='inboxHistory'||method==='syncInbox'){if(method==='syncInbox')f.nativeSync++;return {entries:[]};}
     if(method==='status')return {enabled:f.notifications,backgroundEnabled:f.enabled&&f.polling};
     if(method==='setBackgroundPolling'){f.polling=input.enabled;return {backgroundEnabled:f.enabled&&f.polling};}
     if(method==='enable'){f.notifications=true;return {enabled:true};}
     return {};
    }
    return {};
   }};
  },'ready');

 await page.goto('/');await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:/Agent connection/}).click();await page.getByRole('button',{name:'Start local agent',exact:true}).click();await expect(page.locator('.alpha-connection-scrim')).toHaveCount(0);
 if(scenario==='builder-race'){await page.evaluate(()=>window.dispatchEvent(new Event('launcher-home')));await page.getByRole('button',{name:'Workflows',exact:true}).click();}
 await page.evaluate(async(scenario)=>{
  const {connectionController:c}=await import('/src/runtime/connection-ui.tsx');const s=c.getSnapshot().session!,b=c.getWorkflowClient()!,f=(window as any).deliveryFixture;
  const tap=(id:string)=>({scope:b.scope,origin:s.origin,ownerId:s.ownerId,agentId:s.agentId,workflowId:'flow',runId:id,versionId:'v1',token:id,operationId:'operation-'+id,bindingHash:'b'.repeat(64),retained:true});
  f.pendingReads=0;f.taps=scenario==='two'?[tap('run1')]:[tap('run1'),tap('run2')];f.second=tap('run2');if(scenario==='other-owner')f.taps[0].ownerId='another-owner';if(scenario==='wrong-version')f.wrongVersion=true;if(scenario==='queue-changed')f.queueChanged=true;if(scenario==='unconfirmed')f.taps[0].retained=false;if(['navigation-race','owner-race','reconnect','builder-race','new-tap-during-read'].includes(scenario))f.hold=true;
  document.dispatchEvent(new Event('visibilitychange'));
 },scenario);
 if(scenario==='two'){
  await expect(page.getByText('Verified retained result run1',{exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as any).deliveryFixture.consumed?.length)).toBe(1);
  await page.evaluate(()=>{const f=(window as any).deliveryFixture;f.taps.push(f.second);document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.getByText('Verified retained result run2',{exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as any).deliveryFixture.consumed?.length)).toBe(2);
 }else if(scenario==='new-tap-during-read'){
  await expect.poll(()=>page.evaluate(()=>Boolean((window as any).deliveryFixture.release))).toBe(true);
  await page.evaluate(()=>{const f=(window as any).deliveryFixture;f.taps.reverse();f.hold=false;document.dispatchEvent(new Event('visibilitychange'));f.release();});
  await expect(page.getByText('Verified retained result run2',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>({ids:(window as any).deliveryFixture.taps.map((t:any)=>t.runId),consumed:(window as any).deliveryFixture.consumed||[]}))).toEqual({ids:['run1'],consumed:['run2']});
 }else if(scenario==='queue-changed'){
  await expect.poll(()=>page.evaluate(()=>(window as any).deliveryFixture.pendingReads)).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(()=>({ids:(window as any).deliveryFixture.taps.map((t:any)=>t.runId),consumed:(window as any).deliveryFixture.consumed||[]}))).toEqual({ids:['run2','run1'],consumed:[]});
  await expect(page.getByText('Verified retained result run1',{exact:true})).toHaveCount(0);
 }else if(scenario==='builder-race'){
  await expect.poll(()=>page.evaluate(()=>Boolean((window as any).deliveryFixture.release))).toBe(true);
  await page.getByRole('button',{name:'New workflow',exact:true}).click();
  await page.evaluate(()=>(window as any).deliveryFixture.release());
  await expect(page.getByText('Verified retained result run1',{exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).deliveryFixture.consumed?.length||0)).toBe(0);
  await expect(page.getByRole('button',{name:'Back to workflows',exact:true})).toBeVisible();
 }else if(scenario==='owner-race'||scenario==='reconnect'){
  await expect.poll(()=>page.evaluate(()=>Boolean((window as any).deliveryFixture.release))).toBe(true);
  await page.evaluate(async()=>{const {connectionController:c}=await import('/src/runtime/connection-ui.tsx');await c.offline();(window as any).deliveryFixture.release();(window as any).deliveryFixture.hold=false;});
  await expect(page.getByText('Verified retained result run1',{exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).deliveryFixture.consumed?.length||0)).toBe(0);
  if(scenario==='reconnect'){
   await page.getByRole('button',{name:/Agent connection/}).click();await page.getByRole('button',{name:'Start local agent',exact:true}).click();await expect(page.locator('.alpha-connection-scrim')).toHaveCount(0);
   await expect(page.getByText('Verified retained result run1',{exact:true})).toBeVisible();
  }
 }else if(scenario==='navigation-race'){
  await expect.poll(()=>page.evaluate(()=>Boolean((window as any).deliveryFixture.release))).toBe(true);
  await page.evaluate(()=>window.dispatchEvent(new Event('launcher-home')));await expect(page.locator('html')).toHaveAttribute('data-active-view','home');
  await page.evaluate(()=>(window as any).deliveryFixture.release());
  await expect(page.getByText('Verified retained result run1',{exact:true})).toHaveCount(0);
 }else{
  await expect(page.getByText(/Workflow notification saved\./)).toBeVisible();
  expect(await page.evaluate(()=>(window as any).deliveryFixture.taps.length)).toBe(2);
  expect(await page.evaluate(()=>(window as any).deliveryFixture.consumed?.length||0)).toBe(0);
 }
 expect(errors).toEqual([]);
 });
}
