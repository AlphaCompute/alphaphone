import {test,expect} from '@playwright/test';
import {createServer,type ViteDevServer} from 'vite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {localAgentStorage} from '../../scripts/local-agent-dev-storage';

test.describe.configure({mode:'serial'});
let server:ViteDevServer,origin:string,cache:string;
test.beforeAll(async()=>{cache=await mkdtemp(path.join(tmpdir(),'alpha-hosted-vite-'));server=await createServer({cacheDir:cache,define:{'import.meta.env.VITE_LOCAL_AGENT':JSON.stringify('1')},server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});await server.listen();origin=`http://127.0.0.1:${(server.httpServer!.address() as any).port}`;});
test.afterAll(async()=>{await server?.close();if(cache)await rm(cache,{recursive:true,force:true});});
async function fixture(page:any){
 const storage=await mkdtemp(path.join(tmpdir(),'alpha-hosted-store-')),now=new Date().toISOString();
 const f={acked:0,syncs:0,verifies:0,hold:false,release:null as null|(()=>void),result:{cursor:1,runId:'run-one',workflowId:'workflow',workflowVersionId:'version',templateVersion:'template',scheduledAt:now,source:{observedAt:now,expiresAt:now},status:'completed',startedAt:now,completedAt:now,output:'Retained morning briefing',error:null}};
 await page.route('**/__alpha-local-agent',async(route:any)=>{const input=route.request().postDataJSON();let body:any;
  if(input.storage){await route.fulfill({json:localAgentStorage(storage,input.storage)});return;}
  const p=input.path;
  if(p==='/api/auth/me')body={identity:{kind:'owner',id:'fixture-owner'},access:{role:'OWNER',mode:'session'}};
  else if(p==='/api/agents')body={agents:[{id:'fixture-agent',name:'Browser fixture',status:'running'}]};
  else if(p==='/api/client-devices/register')body={installationId:input.headers['X-Eliza-Device-Id'],enrollmentId:'fixture-enrollment',capabilities:[]};
  else if(p==='/api/conversations')body={conversations:[]};
  else if(p==='/api/workflow/status'){f.verifies++;if(f.hold)await new Promise<void>(resolve=>{f.release=resolve;});body={hostedDigestProtocol:1};}
  else if(p==='/api/workflow/hosted/sources')body={sources:[]};
  else if(p==='/api/workflow/hosted/loops')body={loops:[]};
  else if(p==='/api/workflow/hosted/live-accounts')body={accounts:[],truncated:false};
  else if(p.startsWith('/api/workflow/hosted/results?')){f.syncs++;body={entries:f.acked>=f.result.cursor?[]:[f.result]};}
  else if(p==='/api/workflow/hosted/results/ack'){f.acked=JSON.parse(input.body).cursor;body={};}
  else {await route.fulfill({json:{status:404,body:'{}'}});return;}
  await route.fulfill({json:{status:200,body:JSON.stringify(body)}});
 });
 await page.addInitScript(()=>{if(!localStorage.getItem('alpha.connection.selection.v1'))localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));});
 await page.goto(origin+'/?mode=dev&tools=1');await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:/Agent connection/}).click();await page.getByRole('button',{name:'Start local agent',exact:true}).click();await expect(page.locator('.alpha-connection-scrim')).toHaveCount(0);// The first sync and its acknowledgement follow the connection; allow for a loaded host.
 await expect.poll(()=>f.acked,{timeout:30000}).toBe(1);
 return {f,cleanup:async()=>{f.hold=false;f.release?.();try{if(!page.isClosed())await page.unrouteAll({behavior:'ignoreErrors'});}finally{await page.close().catch(()=>{});await rm(storage,{recursive:true,force:true});}}};
}
const device=async(page:any,name:string)=>{await page.getByRole('button',{name:'Device controls',exact:true}).click();await page.getByRole('dialog',{name:'Development device controls',exact:true}).getByRole('button',{name,exact:true}).click();};
const panel=(page:any)=>page.getByRole('dialog',{name:'Scheduled digests',exact:true});
test('connected browser saves before notification, opens retained output, toggles preferences and restores after reload',async({page},info)=>{
 const {f,cleanup}=await fixture(page);try{
  await device(page,'Notifications');await page.getByText('Scheduled digest',{exact:true}).click();await expect(panel(page)).toContainText('Retained morning briefing');await expect(panel(page)).toContainText('Opened from notification');await page.screenshot({path:info.outputPath('hosted-browser-panel.png')});
  const toggle=panel(page).getByRole('button',{name:'Result notifications',exact:true});await expect(toggle).toHaveAttribute('aria-pressed','true');await toggle.click();await expect(toggle).toHaveAttribute('aria-pressed','false');await panel(page).getByRole('button',{name:'Pause result checks',exact:true}).click();await expect(panel(page).getByRole('button',{name:'Enable result checks',exact:true})).toBeVisible();await page.reload();
  await page.evaluate(()=>window.dispatchEvent(new Event('alpha:hosted-digests')));await expect(panel(page)).toContainText('Retained morning briefing');await expect(panel(page).getByRole('button',{name:'Result notifications',exact:true})).toHaveAttribute('aria-pressed','false');await expect(panel(page).getByRole('button',{name:'Enable result checks',exact:true})).toBeVisible();expect(f.acked).toBe(1);
  await panel(page).getByRole('button',{name:'Close scheduled digests',exact:true}).click();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:/Agent connection/}).click();await page.getByRole('button',{name:'Disconnect agent',exact:true}).click();await expect(page.getByText('Agent disconnected. Cloud services keep their separate sign-in.',{exact:true})).toBeVisible();const status=await page.evaluate(async()=>{const {browserHostedResults}=await import('/src/browser/hosted-results.ts');return browserHostedResults.status();});expect(status.backgroundEnabled).toBe(false);
 }finally{await cleanup();}
});
test('a delayed result tap stays pending while the simulated device is locked and resumes after unlock',async({page})=>{
 const {f,cleanup}=await fixture(page);try{await device(page,'Notifications');f.hold=true;await page.getByText('Scheduled digest',{exact:true}).click();await expect.poll(()=>!!f.release).toBe(true);await device(page,'Power');f.hold=false;f.release!();await expect(panel(page)).toHaveCount(0);await device(page,'Unlock');await expect(panel(page)).toContainText('Retained morning briefing');await expect(panel(page)).toContainText('Opened from notification');}finally{await cleanup();}
});

test('turning notifications off suppresses new result notices while retaining their output',async({page})=>{
 const {f,cleanup}=await fixture(page);try{await page.evaluate(()=>window.dispatchEvent(new Event('alpha:hosted-digests')));const toggle=panel(page).getByRole('button',{name:'Result notifications',exact:true});await expect(toggle).toHaveAttribute('aria-pressed','true');await toggle.click();f.result={...f.result,cursor:2,runId:'run-two',output:'Second saved briefing'};await panel(page).getByRole('button',{name:'Refresh',exact:true}).click();await expect(panel(page)).toContainText('Second saved briefing');expect(f.acked).toBe(2);const rows=await page.evaluate(async()=>{const {browserHostedResults}=await import('/src/browser/hosted-results.ts');return browserHostedResults.list();});expect(rows).toEqual([]);await toggle.click();await expect(toggle).toHaveAttribute('aria-pressed','true');const enabled=await page.evaluate(async()=>{const {browserHostedResults}=await import('/src/browser/hosted-results.ts');return browserHostedResults.list();});expect(enabled).toHaveLength(1); // The earlier active notice returns; the denied new result is not replayed.
 }finally{await cleanup();}
});

test('paused periodic checks stay quiet and enabling checks fetches the next retained result',async({page})=>{
 await page.clock.install();const {f,cleanup}=await fixture(page);try{await page.evaluate(()=>window.dispatchEvent(new Event('alpha:hosted-digests')));await expect(panel(page)).toContainText('Synced with this agent.');await panel(page).getByRole('button',{name:'Pause result checks',exact:true}).click();await expect(panel(page).getByRole('button',{name:'Enable result checks',exact:true})).toBeVisible();const before=f.syncs;f.result={...f.result,cursor:2,runId:'run-two',output:'Periodic result'};await page.clock.runFor(16000);expect(f.syncs).toBe(before);expect(f.acked).toBe(1);await panel(page).getByRole('button',{name:'Enable result checks',exact:true}).click();await page.clock.runFor(16000);await expect(panel(page)).toContainText('Periodic result');expect(f.acked).toBe(2);
 }finally{await cleanup();}
});
