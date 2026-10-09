import {test,expect,type Page} from '@playwright/test';
// MAC64's promoted VIEWS_SHOW prepared receipt shape; all IDs below are owned synthetic data.
async function ready(page:Page,scenario='valid'){
 await page.addInitScript(scenario=>{
  localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));
  const f=(window as any).promotedViewFixture={scenario,requests:[],sent:[],acks:[],claims:[],secure:{},profile:null,installationId:'',claimWaiting:false};
  const methods=(names:string[])=>names.map(name=>({name,rtype:'promise'}));
  (window as any).Capacitor={PluginHeaders:[{name:'AlphaConnection',methods:methods(['request','cancel','secureRead','secureWrite','secureRemove','openExternal'])}],nativePromise:async(plugin:string,method:string,input:any)=>{
   if(plugin!=='AlphaConnection')throw Error('Unexpected native plugin');
   if(method==='secureRead')return {value:f.secure[input.slot]??null};if(method==='secureWrite'){f.secure[input.slot]=input.value;return {};}if(method==='secureRemove'){delete f.secure[input.slot];return {};}if(method==='cancel')return {};if(method==='openExternal')throw Error('No auth browser is part of this fixture');
   const url=new URL(input.url),path=url.pathname,body=input.body?JSON.parse(input.body):undefined;f.requests.push(path);const data=(value:any,status=200)=>({status,data:value}),token='owned-view-session',owner='view-owner';
   if(url.hostname!=='owned-views.invalid')throw Error('Only owned fixture transport is permitted');
   if(path==='/api/auth/status')return data({required:true,authenticated:false,pairingEnabled:true,bootstrapRequired:false,instanceId:'owned-view-host',expiresAt:null});
   if(path==='/api/auth/pair')return data({token,identityId:owner,access:'owner',instanceId:'owned-view-host'});
   if(input.headers.Authorization!=='Bearer '+token)throw Error('Wrong request owner');
   if(path==='/api/auth/me')return data({identity:{id:owner,displayName:'Owned fixture',kind:'owner'},session:{id:token,kind:'machine',expiresAt:Date.now()+600000},access:{role:'OWNER',mode:'session'}});
   if(path==='/api/agents')return data({agents:[{id:'33333333-3333-4333-8333-333333333333',name:'Owned navigation',status:'running'}]});
   if(path==='/api/client-devices/register'){f.installationId=input.headers['X-Eliza-Device-Id'];return data({installationId:f.installationId,enrollmentId:'owned-view-enrollment',viewProfileVersion:1,capabilities:[]});}
   if(path==='/api/client-devices/view-profile'){if(body)f.profile={version:1,revision:crypto.randomUUID(),views:body.views};return data(body?{version:1,profile:f.profile}:{version:1,supportedViews:['home','notes','calendar'],profile:f.profile});}
   if(path==='/api/client-devices/proposals')return data({proposals:[]});
   if(path==='/api/conversations')return data(input.method==='POST'?{conversation:{id:'owned-view-room',title:'Owned view turn'}}:{conversations:[{id:'owned-view-room',title:'Owned view turn'}]});
   if(path==='/api/conversations/owned-view-room/messages'){
    if(input.method!=='POST')return data({messages:[]});f.sent.push(body);const clientId=body.metadata?.viewClientId;if(!clientId||body.metadata.viewDelivery!=='completed-action')throw Error('Originating renderer metadata missing');
    return data({text:'Opening Notes.',agentName:'Owned navigation',userMessageId:crypto.randomUUID(),messageId:crypto.randomUUID(),actionResults:[{actionName:f.scenario==='unknown-child'?'VIEWS_LIST':'VIEWS_SHOW',success:true,values:{mode:'show',viewId:'notes',viewPath:'/notes',viewType:'gui',label:'Notes',completedActionDelivered:false,completedActionHandoffId:'owned-promoted-handoff',navigationPrepared:true,navigationBinding:{requestId:'owned-promoted-handoff',clientId:f.scenario==='wrong-client'?'other-client':clientId,viewId:'notes',viewType:'gui',installationId:f.installationId}}}]});
   }
   if(path==='/api/views/interact-claim'){
    if(body.clientId!==f.sent[0]?.metadata.viewClientId||body.installationId!==f.installationId||body.requestId!=='owned-promoted-handoff')throw Error('Claim does not match originating turn');f.claims.push(body);
    if(f.scenario==='owner-change'){f.claimWaiting=true;await new Promise<void>(resolve=>f.releaseClaim=resolve);}
    return data({claimId:'owned-renderer-claim'});
   }
   if(path==='/api/views/interact-result'){
    const shown=document.documentElement.dataset.activeView;const heading=[...document.querySelectorAll('h1')].some(el=>el.textContent?.trim()==='Notes'&&el.getClientRects().length>0);
    f.acks.push({body,shown,heading});if(body.claimId!=='owned-renderer-claim'||body.requestId!=='owned-promoted-handoff'||body.clientId!==f.sent[0]?.metadata.viewClientId||body.installationId!==f.installationId)throw Error('Ack identity mismatch');return data({ok:true,accepted:true});
   }
   return data({},404);
  }};
 },scenario);await page.goto('/');await page.evaluate(async()=>{const c=(await import('/src/runtime/connection-ui.tsx')).connectionController;await c.pair('remote','https://owned-views.invalid','owned-fixture-code');if(!c.getSnapshot().phoneActionsAvailable)throw Error('Owned device enrollment did not complete');});
 const input=page.getByRole('textbox',{name:'Ask Alpha',exact:true});await input.fill('Open Notes');await input.press('Enter');
}
test('promoted prepared receipt crosses actual React chat, current-client claim and committed Notes acknowledgment',async({page},info)=>{
 await ready(page);await expect(page.locator('html')).toHaveAttribute('data-active-view','notes');await expect(page.getByRole('heading',{name:'Notes',exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as any).promotedViewFixture.acks.length)).toBe(1);const f=await page.evaluate(()=>(window as any).promotedViewFixture);expect(f.sent).toHaveLength(1);expect(f.sent[0].metadata.uiView).toBe('chat');expect(f.sent[0].metadata.viewClientId).toMatch(/^[a-f0-9-]{36}$/);expect(f.claims).toHaveLength(1);expect(f.acks[0]).toMatchObject({shown:'notes',heading:true,body:{success:true,result:{switched:true},claimId:'owned-renderer-claim'}});expect(Object.keys(f.acks[0].body).sort()).toEqual(['claimId','clientId','installationId','requestId','result','success','viewId','viewType']);await page.screenshot({path:'test-results/promoted-view-react/notes-committed.png',animations:'disabled'});
});
for(const scenario of ['unknown-child','wrong-client'])test(`actual React chat does not deliver ${scenario}`,async({page})=>{
 await ready(page,scenario);await expect(page.getByText('Opening Notes.',{exact:true})).toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-active-view','home');await expect(page.getByRole('heading',{name:'Notes',exact:true})).toHaveCount(0);const f=await page.evaluate(()=>(window as any).promotedViewFixture);expect(f.claims).toHaveLength(0);expect(f.acks).toHaveLength(0);
});
test('account retirement while claiming cannot switch or acknowledge in the replacement context',async({page})=>{
 await ready(page,'owner-change');await expect.poll(()=>page.evaluate(()=>(window as any).promotedViewFixture.claimWaiting)).toBe(true);await page.evaluate(async()=>{await(await import('/src/runtime/connection-ui.tsx')).connectionController.offline();(window as any).promotedViewFixture.releaseClaim();});await expect(page.getByRole('heading',{name:'Notes',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>(window as any).promotedViewFixture.acks)).toEqual([]);
});
