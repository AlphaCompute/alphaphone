import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';




// The normal package command is plain node --test; production TS includes parameter properties.
if(!process.execArgv.some((arg,index)=>arg==='--import'&&process.execArgv[index+1]==='tsx')){
 const child=spawnSync(process.execPath,['--import','tsx',process.argv[1]],{stdio:'inherit',timeout:60000});
 if(child.error)throw child.error;
 process.exit(child.status??1);
}
const {automationsRouteAllowed}=await import('../apps/app/src/runtime/automations-route-policy.ts');
const {CloudProtocol}=await import('../apps/app/src/runtime/cloud-protocol.ts');
const {LocalAgentProtocol}=await import('../apps/app/src/runtime/local-agent.ts');
const {createLocalAgentDevHandler}=await import('../scripts/local-agent-dev-bridge.ts');
const owner='11111111-1111-4111-8111-111111111111',org='22222222-2222-4222-8222-222222222222',agent='33333333-3333-4333-8333-333333333333';
const valid=[['GET','/api/automations'],['GET','/api/lifeops/reminders'],['GET','/api/lifeops/scheduled-tasks?ownerVisibleOnly=1'],['GET','/api/lifeops/scheduled-tasks/task:one.2'],['POST','/api/lifeops/definitions'],['PUT','/api/lifeops/definitions/reminder-1'],['POST','/api/lifeops/occurrences/occurrence-1/snooze'],['POST','/api/triggers'],['GET','/api/triggers/prompt-1'],['GET','/api/triggers/prompt-1/runs'],['PUT','/api/triggers/prompt-1'],['DELETE','/api/triggers/prompt-1'],['POST','/api/triggers/prompt-1/execute'],...['snooze','skip','complete','dismiss','escalate','acknowledge','edit','reopen','fire'].map(a=>['POST',`/api/lifeops/scheduled-tasks/task-1/${a}`])];
const invalid=[['PUT','/api/config'],['DELETE','/api/workflow/workflows/id'],['POST','/api/automations'],['GET','/api/triggers'],['GET','/api/lifeops/scheduled-tasks'],['GET','/api/lifeops/scheduled-tasks?ownerVisibleOnly=0'],['GET','/api/lifeops/scheduled-tasks?ownerVisibleOnly=1&ownerId=other'],['POST','/api/lifeops/scheduled-tasks/id/unknown'],['DELETE','/api/lifeops/definitions/id'],['PATCH','/api/triggers/id'],['GET','https://other/api/automations'],['GET','/api/triggers/%2e%2e'],['GET','/api/triggers/id%2fruns'],['GET','/api/triggers/a..b'],['GET','/api/triggers/id?other=1'],['GET','/api/triggers/id#fragment'],['GET','/api/triggers/id\n'],['GET','/api/triggers/id\\runs'],['GET','/api/triggers/.id'],['GET','/api/triggers/'+ 'a'.repeat(201)]];
const signal=()=>new AbortController().signal;
test('canonical automation methods match in real TS and compiled native Java boundary',async()=>{
 for(const [method,path]of valid)assert.equal(automationsRouteAllowed(path,method),true,`${method} ${path}`);
 for(const [method,path]of invalid)assert.equal(automationsRouteAllowed(path,method),false,`${method} ${path}`);
 const dir=await mkdtemp(join(tmpdir(),'alpha-automations-java-'));
 try{
  const source=await readFile('android/app/src/main/java/ai/elizaresearch/alphaphone/AutomationsRoutes.java','utf8');await writeFile(join(dir,'AutomationsRoutes.java'),source);
  const java=(value)=>JSON.stringify(value);
  const cases=[...valid.map(([m,p])=>[m,p,true]),...invalid.map(([m,p])=>[m,p,false])];
  const local=await readFile('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java','utf8');
  const guard=local.slice(local.indexOf('  boolean automation=AutomationsRoutes.owns(path);'),local.indexOf('   call.reject("Unsupported local agent request."'));
  const rejected='static boolean rejected(String path,String method,String body,String expectedOwner){'+guard+'return true;}return false;}';
  const remote=await readFile('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaConnectionPlugin.java','utf8');
  const routeGate=remote.split('\n').filter(line=>line.includes('String route=url.getRawPath()')||line.includes('AutomationsRoutes.owns(url.getPath())')).join('\n');
  const bodyGate=remote.split('\n').find(line=>line.includes('AutomationsRoutes.allowed(route,method)')&&line.includes('POST')&&line.includes('PUT'));
  const network='static boolean network(String path,String method,String body){try{java.net.URI url=new java.net.URI("https://agent.example"+path);'+routeGate+'if(body!=null){'+bodyGate+'}return true;}catch(Exception denied){return false;}}';
  await writeFile(join(dir,'Boundary.java'),'package ai.elizaresearch.alphaphone; import java.util.Set; public class Boundary {'+rejected+network+' public static void main(String[] args){'+cases.map(([m,p,allowed])=>`if(AutomationsRoutes.allowed(${java(p)},${java(m)})!=${allowed}||rejected(${java(p)},${java(m)},null,"owner")==${allowed})throw new AssertionError(${java(m+' '+p)});`).join('')+'if(!rejected("/api/automations","GET",null,null)||!rejected("/api/triggers/id","DELETE","{}","owner"))throw new AssertionError("Native owner/body boundary");if(!network("/api/triggers/id","PUT","{}")||!network("/api/triggers/id","DELETE",null)||network("/api/config","PUT","{}")||network("/api/config","DELETE",null)||network("/api/%6cifeops/reminders","GET",null)||network("/api/lifeops/unknown","POST","{}")||network("/api/triggers/id","DELETE","{}"))throw new AssertionError("Native HTTP method/path scope");}}');
  execFileSync('javac',['-d',dir,join(dir,'AutomationsRoutes.java'),join(dir,'Boundary.java')]);execFileSync('java',['-cp',dir,'ai.elizaresearch.alphaphone.Boundary']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
function cloudFixture(){
 let credential={credentialId:'one',token:'synthetic-token'};const calls=[];let respond=async()=>({status:200,data:{ok:true}});
 const target={agentId:agent,origin:`https://${agent}.cloud.eliza.app`,userId:owner,organizationId:org,credentialId:'one',headers:{'X-Eliza-Device-Id':'device'}};
 const client=new CloudProtocol('production',async req=>{
  calls.push(req);if(req.url.endsWith('/api/v1/user'))return {status:200,data:{success:true,data:{id:owner,organization_id:org}}};
  if(req.url.endsWith('/api/v1/eliza/agents/'+agent))return {status:200,data:{success:true,data:{id:agent,agentName:'Synthetic',status:'running',executionTier:'dedicated-always',webUiUrl:target.origin}}};
  return respond(req);
 },{read:async()=>credential,write:async()=>{},clear:async()=>{}},async()=>{});
 return {client,target,calls,replace:()=>{credential={credentialId:'two',token:'replacement'};},respond:fn=>{respond=fn;}};
}
test('Cloud automation PUT/DELETE retain verified owner runtime and billing credential',async()=>{
 const f=cloudFixture();for(const [method,path,body]of [['PUT','/api/triggers/prompt-1',{enabled:false}],['DELETE','/api/triggers/prompt-1',undefined]]){
  await f.client.phoneRequest(f.target,path,signal(),body,method);const sent=f.calls.at(-1);assert.equal(sent.url,f.target.origin+path);assert.equal(sent.method,method);assert.deepEqual(sent.body,body);assert.equal(sent.headers.Authorization,'Bearer synthetic-token');assert.equal(sent.headers['X-Eliza-Phone-Protocol'],'1');assert.equal(sent.headers['X-Eliza-Device-Id'],'device');
 }
 for(const [method,path]of invalid)await assert.rejects(f.client.phoneRequest(f.target,path,signal(),undefined,method));
 assert.equal(f.calls.filter(c=>c.url.startsWith(f.target.origin)).length,2);
});
test('Cloud changed account, wrong owner/runtime and aborted response never become accepted automation results',async()=>{
 const replaced=cloudFixture();replaced.respond(async()=>{replaced.replace();return {status:200,data:{ok:true}}});await assert.rejects(replaced.client.phoneRequest(replaced.target,'/api/automations',signal()),/account changed/);
 const before=cloudFixture();before.replace();await assert.rejects(before.client.phoneRequest(before.target,'/api/triggers/id',signal()),/account changed/);assert.equal(before.calls.length,0);
 for(const target of [{userId:org},{origin:'https://other.example'}]){const f=cloudFixture();await assert.rejects(f.client.phoneRequest({...f.target,...target},'/api/triggers/id',signal()));assert.equal(f.calls.filter(c=>c.url.startsWith(f.target.origin)).length,0);}
 const f=cloudFixture(),controller=new AbortController();f.respond(async()=>{controller.abort();return {status:200,data:{ok:true}}});await assert.rejects(f.client.phoneRequest(f.target,'/api/automations',controller.signal),e=>e.name==='AbortError');
});
test('resident transport binds explicit mutation methods to its current owner and rejects stale replies',async()=>{
 const calls=[],held=Promise.withResolvers();const protocol=new LocalAgentProtocol({start:async()=>{},request:async input=>{calls.push(input);return held.promise;}});protocol.session={ownerId:owner,agentId:agent,sessionId:'session',origin:protocol.origin};
 const pending=protocol.request('/api/triggers/id',{enabled:false},signal(),{},'PUT');assert.equal(calls[0].method,'PUT');assert.equal(calls[0].ownerId,owner);await protocol.disconnect();held.resolve({status:200,body:'{}'});await assert.rejects(pending,/connection changed/);
 const count=calls.length;await assert.rejects(protocol.request('/api/triggers/id',undefined,signal(),{},'DELETE'));await assert.rejects(protocol.request('/api/config',{},signal(),{},'PUT'));assert.equal(calls.length,count);
});
test('DEV bridge forwards only canonical scoped mutations; wrong owners and encoded/query routes never dispatch',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'alpha-automation-bridge-')),tokenFile=join(dir,'token');await writeFile(tokenFile,'a'.repeat(64),{mode:0o600});const calls=[];
 const handler=createLocalAgentDevHandler({origin:'http://127.0.0.1:9',tokenFile,request:async(url,options={})=>{
  const path=new URL(url).pathname;let data;
  if(path==='/api/auth/status')data={instanceId:'instance'};else if(path==='/api/auth/pair-code')data={code:'synthetic'};else if(path==='/api/auth/pair')data={access:'owner',token:'synthetic-machine',identityId:owner,instanceId:'instance'};else if(path==='/api/auth/me')data={identity:{id:owner},access:{role:'OWNER'},session:{id:'synthetic-machine',expiresAt:Date.now()+60000}};else{calls.push({url,...options});data={ok:true};}
  return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
 }});const server=createServer(handler);
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  const send=async input=>fetch(origin,{method:'POST',headers:{Origin:origin,'X-Alpha-Local-Agent':'1','Content-Type':'application/json'},body:JSON.stringify(input)});
  for(const [method,path,body]of [['PUT','/api/lifeops/definitions/reminder-1','{"title":"Synthetic"}'],['DELETE','/api/triggers/id',undefined]]){const response=await send({path,method,ownerId:owner,headers:{},...(body===undefined?{}:{body})});assert.equal(response.status,200);assert.equal((await response.json()).status,200);}
  for(const [method,path]of invalid){const response=await send({path,method,ownerId:owner,headers:{}});assert.equal(response.status,400,`${method} ${path}`);}
  assert.equal((await send({path:'/api/triggers/id',method:'DELETE',ownerId:org,headers:{}})).status,409);
  assert.equal((await send({path:'/api/triggers/id',method:'DELETE',headers:{}})).status,400);
  assert.equal(calls.length,2);assert.equal(calls[0].method,'PUT');assert.equal(calls[1].method,'DELETE');assert.equal(calls[0].headers.Authorization,'Bearer synthetic-machine');
 }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
test('connection automation client refuses stale sessions and credential replacement while retaining HTTP status',async()=>{
 const source=await readFile('apps/app/src/runtime/connection-ui.tsx','utf8'),method=source.slice(source.indexOf('  getAutomationsClient():'),source.indexOf('  getWorkflowClient():'));
 const session={ownerId:owner,sessionId:'one'},selected={kind:'remote',origin:'https://agent.example'},calls=[];let credential={identityId:owner,token:'synthetic',expiresAt:Date.now()+60000};let respond=async()=>({status:404,body:{}});
 class WorkflowHttpError extends Error{constructor(status,body){super('HTTP');this.status=status;this.data=body;}}
 const box={active:selected,state:{session},epoch:1,automationsRouteAllowed,automationsRequests:new Set(),AbortController,AbortSignal,DOMException,Date,Error,CloudProtocolError:class extends Error{},WorkflowHttpError,remoteCredentialStore:{read:async()=>credential},nativeRemoteRequest:async input=>{calls.push(input);return respond(input);}};
 vm.runInNewContext(stripTypeScriptTypes('globalThis.controller={'+method+'}',{mode:'transform'}),box);
 // Include the real empty Notes retirement registry used by the extracted lifecycle.
 const readRetirement=source.slice(source.indexOf('const readReplyOwners='),source.indexOf('let navigationContext:'));
 const retire=source.slice(source.indexOf('function retire('),source.indexOf('function persistOffline('));Object.assign(box,{pauseHostedBackground:async()=>{},retireClockReviews:async()=>{},actionReceipts:new Map(),conversationMemory:new Map(),sending:null,update:patch=>{box.state={...box.state,...patch};}});vm.runInNewContext(stripTypeScriptTypes(readRetirement+retire+'globalThis.retire=retire;',{mode:'transform'}),box);
 const bound=box.controller.getAutomationsClient();await assert.rejects(bound.request('/api/triggers/id','DELETE',undefined,signal()),e=>e.status===404);
 respond=async()=>{credential={...credential,token:'replaced'};return {status:200,body:{ok:true}}};await assert.rejects(bound.request('/api/triggers/id','DELETE',undefined,signal()),e=>e.name==='AbortError');
 box.epoch++;const count=calls.length;await assert.rejects(bound.request('/api/automations','GET',undefined,signal()),e=>e.name==='AbortError');assert.equal(calls.length,count);assert.equal(box.automationsRequests.size,0);
 const entered=Promise.withResolvers();respond=async input=>{entered.resolve(input);return new Promise((resolve,reject)=>input.signal.addEventListener('abort',()=>reject(input.signal.reason),{once:true}));};
 const pending=box.controller.getAutomationsClient().request('/api/automations','GET',undefined,signal());const sent=await entered.promise;await box.retire();await assert.rejects(pending,e=>e.name==='AbortError');assert.equal(sent.signal.aborted,true);assert.equal(box.state.session,null);assert.equal(box.automationsRequests.size,0);
});
