import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const key=JSON.stringify(['https://device.alpha.invalid','fixture-owner','fixture-agent']);
const selectionKey='alpha.connection.conversations.v1';
function fixture() {
  const memory=new Map([[selectionKey,JSON.stringify({[key]:'saved-conversation'})]]),secure=new Map(),calls=[];
  let credentialReads=0,changeSelectionAt=Infinity;
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
  const box={testMocksEnabled:false,devSurfacesEnabled:false,browserDevProfile:false,devProfileQuery:false,browserLocalAgentEnabled:false,isAndroid:true,Capacitor:{getPlatform:()=> 'android'},CloudProtocol:Cloud,LocalAgentProtocol:Resident,registerPlugin:()=>({}),stopLocalAgent:async()=>{},configureLocalCloudProvider:async()=>{},localAgentPackaged:async()=>true,workflowPresentationProtocol:async()=>1,actionScope:async()=> 'a'.repeat(64),negotiateEnabledViews:async()=>'',DeviceActions:class{},retireClockReviews:async()=>{},pauseHostedBackground:async()=>{},cloudCredentialStore:{read:async()=>{if(++credentialReads===changeSelectionAt)memory.set(selectionKey,JSON.stringify({[key]:'replacement-choice'}));return credential;}},secureConnectionStore:{read:async slot=>secure.get(slot)??null,write:async(slot,value)=>secure.set(slot,value)},openConnectionBrowser:()=>{},nativeCloudRequest:()=>{},localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},AbortController,DOMException,crypto,URL,URLSearchParams,console};
  let selections=fs.readFileSync('apps/app/src/runtime/conversation-selection.ts','utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
  vm.runInNewContext(stripTypeScriptTypes(selections,{mode:'transform'})+'\nglobalThis.selectionApi={captureConversationChoice,selectConversation};',box);
  Object.assign(box,box.selectionApi);
  let source=fs.readFileSync('apps/app/src/runtime/connection-ui.tsx','utf8').split('export function ConnectionChooser()')[0].replace(/^import .*;\n/gm,'').replace(/export /g,'');
  source+='\nglobalThis.api={controller:connectionController,restoreSaved:restoreSavedResidentHistory,restore:restoreConversationHistory,retire,newSession(){state={...state,session:{...state.session,sessionId:"new-session"}};},replaceService(){service={...service,identity:{...service.identity,sessionId:"new-account-session"}};}};';
  vm.runInNewContext(stripTypeScriptTypes(source,{mode:'transform'}),box);
  return {api:box.api,calls,memory,selection:box.selectionApi,changeSelectionOnCredentialRead:offset=>{changeSelectionAt=credentialReads+offset;},history:fn=>{readHistory=fn;},list:fn=>{list=fn;},replaceCredential:()=>{credential={credentialId:'replacement'};}};
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
