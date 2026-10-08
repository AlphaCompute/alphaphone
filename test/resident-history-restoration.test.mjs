import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const key=JSON.stringify(['https://device.alpha.invalid','fixture-owner','fixture-agent']);
const selectionKey='alpha.connection.conversations.v1';
function fixture() {
  const memory=new Map([[selectionKey,JSON.stringify({[key]:'saved-conversation'})]]),secure=new Map(),calls=[];
  let credentialReads=0,changeSelectionAt=Infinity,pending=async()=>[],approved=0;
  let credential={credentialId:'fixture-credential'},readHistory=async()=>({messages:[{id:'u1',role:'user',text:'Earlier question'},{id:'a1',role:'assistant',text:'Earlier answer',actions:[{type:'never-replay'}]}]}),list=async()=>[{id:'saved-conversation',title:'Saved'}];
  class Cloud {
    environment='production';
    async identity(){return {userId:'fixture-account'};}
    async creditBalance(){return {balance:5,credentialId:credential.credentialId};}
  }
  class Resident {
    origin='https://device.alpha.invalid';
    async connect(){return {session:{origin:this.origin,ownerId:'fixture-owner',agentId:'fixture-agent',sessionId:'fixture-session'},name:'Alpha'};}
    async request(path,body,signal,headers){signal.throwIfAborted();calls.push({path,method:body===undefined?'GET':'POST'});if(path==='/api/client-devices/register')return {installationId:headers['X-Eliza-Device-Id'],enrollmentId:'fixture-enrollment'};return {};}
    async listConversations(){calls.push({path:'/api/conversations',method:'GET'});return list();}
    async messages(id){calls.push({path:`/api/conversations/${id}/messages`,method:'GET'});return readHistory();}
  }
  const box={document:{hidden:false},testMocksEnabled:false,devSurfacesEnabled:false,browserDevProfile:false,devProfileQuery:false,browserLocalAgentEnabled:false,isAndroid:true,Capacitor:{getPlatform:()=> 'android'},CloudProtocol:Cloud,LocalAgentProtocol:Resident,registerPlugin:()=>({}),stopLocalAgent:async()=>{},configureLocalCloudProvider:async()=>{},localAgentPackaged:async()=>true,workflowPresentationProtocol:async()=>1,actionScope:async()=> 'a'.repeat(64),negotiateEnabledViews:async()=>'',DeviceActions:class{async pending(context,signal){calls.push({path:'/api/client-devices/proposals',method:'GET'});return pending(context,signal);}async approve(id,context,signal){signal.throwIfAborted();approved++;return {proposalId:id,status:'succeeded',summary:'Fixture approved'};}},retireClockReviews:async()=>{},pauseHostedBackground:async()=>{},cloudCredentialStore:{read:async()=>{if(++credentialReads===changeSelectionAt)memory.set(selectionKey,JSON.stringify({[key]:'replacement-choice'}));return credential;}},secureConnectionStore:{read:async slot=>secure.get(slot)??null,write:async(slot,value)=>secure.set(slot,value)},openConnectionBrowser:()=>{},nativeCloudRequest:()=>{},localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},AbortController,DOMException,crypto,URL,URLSearchParams,console};
  let selections=fs.readFileSync('apps/app/src/runtime/conversation-selection.ts','utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'').replace(/\bdocument\b/g,'selectionDocument');
  vm.runInNewContext(stripTypeScriptTypes(selections,{mode:'transform'})+'\nglobalThis.selectionApi={captureConversationChoice,selectConversation};',box);
  Object.assign(box,box.selectionApi);
  let source=fs.readFileSync('apps/app/src/runtime/connection-ui.tsx','utf8').split('export function ConnectionChooser()')[0].replace(/^import .*;\n/gm,'').replace(/export /g,'');
  source+='\nglobalThis.api={controller:connectionController,restoreSaved:restoreSavedResidentHistory,restore:restoreConversationHistory,retire,newSession(){state={...state,session:{...state.session,sessionId:"new-session"}};},replaceService(){service={...service,identity:{...service.identity,sessionId:"new-account-session"}};}};';
  vm.runInNewContext(stripTypeScriptTypes(source,{mode:'transform'}),box);
  return {api:box.api,calls,memory,pending:fn=>{pending=fn;},approved:()=>approved,document:box.document,selection:box.selectionApi,changeSelectionOnCredentialRead:offset=>{changeSelectionAt=credentialReads+offset;},history:fn=>{readHistory=fn;},list:fn=>{list=fn;},replaceCredential:()=>{credential={credentialId:'replacement'};}};
}
test('production resident startup restores only saved verified prose without replay or preference writes',async()=>{
  const f=fixture(),before=f.memory.get(selectionKey);
  await f.api.controller.initialize();
  const state=f.api.controller.getSnapshot();
  assert.equal(state.history.automatic,true);assert.equal(state.history.conversationId,'saved-conversation');assert.equal(state.open,false);
  assert.deepEqual(Array.from(state.history.messages,m=>Object.keys(m).sort()),[['from','id','text'],['from','id','text']]);
  assert.deepEqual(Array.from(state.history.messages,m=>m.text),['Earlier question','Earlier answer']);
  assert.equal(f.memory.get(selectionKey),before);
  assert.deepEqual(f.calls.filter(c=>c.method==='GET').map(c=>c.path),['/api/conversations','/api/conversations/saved-conversation/messages']);
  assert.ok(f.calls.every(c=>c.method==='GET'||c.path==='/api/client-devices/register'));
});
test('automatic history preserves an opened connection panel and explicit retry clears read failure',async()=>{
  const f=fixture();f.history(async()=>{throw Error('Temporary read failure');});
  await f.api.controller.initialize();assert.ok(f.api.controller.getSnapshot().historyError);
  f.history(async()=>({messages:[{id:'restored',role:'assistant',text:'Retained reply'}]}));
  f.api.controller.open();await f.api.controller.retrySavedHistory();
  const state=f.api.controller.getSnapshot();assert.equal(state.open,true);assert.equal(state.historyError,'');assert.equal(state.history.automatic,true);
  assert.equal(state.history.messages[0].text,'Retained reply');
});
test('account change during membership read blocks the following history request',async()=>{
  const f=fixture(),entered=Promise.withResolvers(),held=Promise.withResolvers();
  f.list(async()=>{entered.resolve();await held.promise;return [{id:'saved-conversation'}];});
  const startup=f.api.controller.initialize();await entered.promise;f.replaceCredential();held.resolve();await startup;
  assert.equal(f.api.controller.getSnapshot().history,null);
  assert.equal(f.calls.filter(c=>c.path.endsWith('/messages')).length,0);
});
test('selection replacement during the final credential await cannot publish old conversation history',async()=>{
  const f=fixture();await f.api.controller.initialize();const previous=f.api.controller.getSnapshot().history;
  f.history(async()=>({messages:[{id:'late-old-conversation',role:'assistant',text:'Old conversation history'}]}));
  f.changeSelectionOnCredentialRead(4);await f.api.restoreSaved(new AbortController().signal);
  const state=f.api.controller.getSnapshot();
  assert.equal(JSON.parse(f.memory.get(selectionKey))[key],'replacement-choice');
  assert.equal(state.history,previous);assert.match(state.historyError,/could not be restored/);
  assert.ok(!state.history.messages.some(message=>message.id==='late-old-conversation'));
});
test('Android selection capture is synchronous at the publication boundary',()=>{
  const f=fixture();assert.equal(f.selection.captureConversationChoice(key).id,'saved-conversation');
});
for(const mode of ['missing','unsupported','read-failure'])test(`resident ${mode} history retains selection and local app access`,async()=>{
  const f=fixture(),before=f.memory.get(selectionKey);
  if(mode==='missing')f.list(async()=>[]);
  else if(mode==='unsupported')f.list(async()=>{throw Error('HTTP 404');});
  else f.history(async()=>{throw Error('HTTP 503');});
  await f.api.controller.initialize();const state=f.api.controller.getSnapshot();
  assert.equal(state.history,null);assert.match(state.historyError,/could not be restored/);assert.equal(state.open,false);assert.ok(state.session);
  assert.equal(f.memory.get(selectionKey),before);assert.ok(!f.calls.some(c=>c.path.includes('/messages')&&c.method==='POST'));
});
for(const mode of ['credential','account','session','epoch','abort','selection'])test(`late resident history cannot publish after ${mode} changes`,async()=>{
  const f=fixture();await f.api.controller.initialize();
  const held=Promise.withResolvers(),entered=Promise.withResolvers();f.history(async()=>{entered.resolve();return held.promise;});
  const signal=new AbortController();const previous=f.api.controller.getSnapshot().history;
  const reading=f.api.restoreSaved(signal.signal);await entered.promise;
  if(mode==='credential')f.replaceCredential();
  if(mode==='account')f.api.replaceService();
  if(mode==='session')f.api.newSession();
  if(mode==='epoch')await f.api.retire();
  if(mode==='abort')signal.abort(new DOMException('Cancelled','AbortError'));
  if(mode==='selection')f.memory.set(selectionKey,JSON.stringify({[key]:'new-choice'}));
  held.resolve({messages:[{id:'late',role:'assistant',text:'Late stale history'}]});
  if(mode==='abort')await assert.rejects(reading);else await reading;
  assert.ok(f.api.controller.getSnapshot().history===previous||f.api.controller.getSnapshot().history===null);
});
test('automatic and manual adapter restoration preserve their different draft and view behavior',()=>{
  const source=fs.readFileSync('apps/app/src/prototype/agent-adapter.ts','utf8');
  const start=source.indexOf('      const history = connectionController.getSnapshot().history;'),end=source.indexOf('      if (this.live) {context(this);',start);
  assert.ok(start>=0&&end>start);
  for(const automatic of [true,false]){
    let retired=0;const state={draft:'Unsent text',chat:'input',view:'notes',typing:true};
    const history={sessionId:'fixture-session',automatic,messages:[{id:'old',from:'agent',text:'Saved reply'}]};
    const shell={live:true,composerDraft:{retire(){retired++;}},setState(patch){Object.assign(state,patch);}};
    vm.runInNewContext('(function(){'+source.slice(start,end)+'}).call(shell)',{shell,session:'fixture-session',connectionController:{getSnapshot:()=>({history})},alphaClient:{disconnect(){}}});
    assert.equal(state.view,'notes');assert.equal(state.msgs[0].text,'Saved reply');assert.equal(state.msgs[0].card,null);
    assert.equal(state.draft,automatic?'Unsent text':'');assert.equal(state.chat,automatic?'input':'full');assert.equal(retired,automatic?0:1);
  }
});

const reviewContext={view:'notes',revision:9,sensitive:false,selectedObject:{kind:'note',id:'selected',revision:'a'.repeat(64),accountId:'fixture-source',sourceRevision:'b'.repeat(64)}};
const pendingReview={id:'existing-proposal',title:'notes read selected',description:'Share the exact selected note',expiresAt:Date.now()+600000,contextRevision:9};
test('resident recovery reads existing pending reviews without sending, changing history or approving',async()=>{
 const f=fixture();await f.api.controller.initialize();const before=f.api.controller.getSnapshot().history,choice=f.memory.get(selectionKey);
 f.pending(async()=>[pendingReview]);const result=await f.api.controller.pendingActions(reviewContext,new AbortController().signal);
 assert.equal(result[0].id,pendingReview.id);assert.equal(f.api.controller.getSnapshot().history,before);assert.equal(f.memory.get(selectionKey),choice);assert.equal(f.approved(),0);
 assert.ok(f.calls.every(c=>c.method==='GET'||c.path==='/api/client-devices/register'));
});
for(const mode of ['credential','account','session','epoch','abort','selection','hidden','panel','history'])test(`pending recovery refuses stale ${mode}`,async()=>{
 const f=fixture();await f.api.controller.initialize();const held=Promise.withResolvers(),entered=Promise.withResolvers();
 f.pending(async()=>{entered.resolve();return held.promise;});const signal=new AbortController(),reading=f.api.controller.pendingActions(reviewContext,signal.signal);await entered.promise;
 if(mode==='credential')f.replaceCredential();if(mode==='account')f.api.replaceService();if(mode==='session')f.api.newSession();if(mode==='epoch')await f.api.retire();if(mode==='abort')signal.abort();if(mode==='selection')f.memory.set(selectionKey,JSON.stringify({[key]:'replacement'}));if(mode==='hidden')f.document.hidden=true;if(mode==='panel')f.api.controller.open();if(mode==='history')await f.api.restoreSaved(new AbortController().signal);
 held.resolve([pendingReview]);await assert.rejects(reading);assert.equal(f.approved(),0);
});
test('sensitive or hidden recovery never queries pending actions',async()=>{
 const f=fixture();await f.api.controller.initialize();f.pending(async()=>{throw Error('Must not query');});
 assert.equal((await f.api.controller.pendingActions({...reviewContext,sensitive:true},new AbortController().signal)).length,0);
 f.document.hidden=true;assert.equal((await f.api.controller.pendingActions(reviewContext,new AbortController().signal)).length,0);
 assert.equal(f.calls.filter(c=>c.path==='/api/client-devices/proposals').length,0);
});
test('recovered approval rereads exact pending identity before existing journaled execute',async()=>{
 const f=fixture();await f.api.controller.initialize();let reads=0;f.pending(async()=>{reads++;return [pendingReview];});
 const receipt=await f.api.controller.approvePendingAction(pendingReview.id,reviewContext,new AbortController().signal);assert.equal(receipt.proposalId,pendingReview.id);assert.equal(reads,1);assert.equal(f.approved(),1);
 await f.api.controller.approvePendingAction(pendingReview.id,reviewContext,new AbortController().signal);assert.equal(reads,2);assert.equal(f.approved(),1);
 f.pending(async()=>[]);await assert.rejects(f.api.controller.approvePendingAction(pendingReview.id,reviewContext,new AbortController().signal),/no longer pending/);assert.equal(f.approved(),1);
});

function adapterRecoveryFixture() {
 const source=fs.readFileSync('apps/app/src/prototype/agent-adapter.ts','utf8'),start=source.indexOf('  function recoverPendingActions('),end=source.indexOf('  function context(',start);
 let context={...reviewContext},connection={session:{sessionId:'fixture-session',ownerId:'owner',agentId:'agent',origin:'https://fixture.invalid'},history:{revision:1},phoneActionsAvailable:true,open:false,busy:false},read=async()=>[pendingReview];
 const calls=[],toasts=[],document={hidden:false},state={msgs:[{id:'saved',from:'agent',text:'Queued for review',card:null}],draft:'Unsent draft',chat:'full',typing:false};
 const shell={live:true,S:()=>state,toast:text=>toasts.push(text),setState(update){const patch=typeof update==='function'?update(state):update;if(patch)Object.assign(state,patch);}};
 const box={document,crypto,AbortController,alphaClient:{getState:()=>({context})},connectionController:{getSnapshot:()=>connection,pendingActions:async(c,signal)=>{calls.push({context:c,signal});return read(c,signal);}}};
 vm.runInNewContext(stripTypeScriptTypes(source.slice(start,end))+'\nglobalThis.recover=recoverPendingActions;',box);
 return {shell,state,calls,toasts,document,recover:()=>box.recover(shell),read:fn=>{read=fn;},context:patch=>{context={...context,...patch};},connection:patch=>{connection={...connection,...patch};}};
}
const flushRecovery=()=>new Promise(resolve=>setImmediate(resolve));
test('adapter rehydrates existing cards once, dedupes restored proposals and preserves prose/draft',async()=>{
 const f=adapterRecoveryFixture();f.recover();await flushRecovery();
 assert.equal(f.calls.length,1);assert.equal(f.state.msgs.length,2);assert.equal(f.state.msgs[0].card,null);assert.equal(f.state.msgs[1].card.proposalId,pendingReview.id);assert.equal(f.state.msgs[1].card.title,'Approve: '+pendingReview.title);assert.equal(f.state.draft,'Unsent draft');assert.equal(f.state.chat,'full');
 f.recover();await flushRecovery();assert.equal(f.calls.length,1);
 f.connection({history:{revision:2}});f.recover();await flushRecovery();assert.equal(f.calls.length,2);assert.equal(f.state.msgs.length,2);
 f.document.hidden=true;f.recover();f.document.hidden=false;f.recover();await flushRecovery();assert.equal(f.calls.length,3);assert.equal(f.state.msgs.length,2);
});
for(const mode of ['context','session','hidden','sensitive','panel','unmount'])test(`adapter cannot append a late recovered card after ${mode}`,async()=>{
 const f=adapterRecoveryFixture(),held=Promise.withResolvers();f.read(async()=>held.promise);f.recover();
 if(mode==='context')f.context({revision:10});if(mode==='session')f.connection({session:{sessionId:'replacement'}});if(mode==='hidden')f.document.hidden=true;if(mode==='sensitive')f.context({sensitive:true});if(mode==='panel')f.connection({open:true});if(mode==='unmount')f.shell.live=false;
 f.read(async()=>[]);f.recover();held.resolve([pendingReview]);await flushRecovery();assert.equal(f.state.msgs.length,1);
});
test('sensitive, busy and workflow contexts do not query or disturb workflow reviews',async()=>{
 const f=adapterRecoveryFixture();f.context({sensitive:true});f.recover();f.context({sensitive:false,view:'workflows'});f.recover();f.context({view:'notes'});f.connection({busy:true});f.recover();await flushRecovery();assert.equal(f.calls.length,0);
});

test('pending read failure keeps a visible retry explanation without a render retry loop',async()=>{
 const f=adapterRecoveryFixture();f.read(async()=>{throw Error('HTTP 503');});f.recover();await flushRecovery();
 assert.equal(f.state.msgs.length,1);assert.equal(f.toasts.length,1);assert.match(f.toasts[0],/could not be checked/);
 f.recover();await flushRecovery();assert.equal(f.calls.length,1);assert.equal(f.toasts.length,1);
 f.document.hidden=true;f.recover();f.read(async()=>[pendingReview]);f.document.hidden=false;f.recover();await flushRecovery();
 assert.equal(f.calls.length,2);assert.equal(f.state.msgs.length,2);assert.equal(f.toasts.length,1);
});

test('recovered approval stays alive for unchanged context but cancels on source navigation',()=>{
 const f=adapterRecoveryFixture(),approval=new AbortController();f.shell.pendingActionApproval=approval;f.shell.pendingActionApprovalContext={...reviewContext};f.shell.pendingActionApprovalSession={sessionId:'fixture-session',ownerId:'owner',agentId:'agent',origin:'https://fixture.invalid'};
 f.recover();assert.equal(approval.signal.aborted,false);assert.equal(f.calls.length,0);
 f.context({revision:10});f.recover();assert.equal(approval.signal.aborted,true);assert.equal(f.calls.length,0);
});

test('resume refreshes an existing interrupted review card without duplicating or reviving completed cards',async()=>{
 const f=adapterRecoveryFixture();f.state.msgs.push({id:'existing',from:'agent',text:pendingReview.description,card:{proposalId:pendingReview.id,title:'Approve existing'}},{id:'done',from:'agent',text:'Completed before',card:{proposalId:pendingReview.id,done:true}});
 f.recover();await flushRecovery();assert.equal(f.state.msgs.length,3);assert.equal(f.state.msgs[1].card.recovered,true);assert.equal(f.state.msgs[1].card.proposalSession.sessionId,'fixture-session');assert.equal(f.state.msgs[2].card.done,true);assert.equal(f.state.msgs[2].card.recovered,undefined);
});
