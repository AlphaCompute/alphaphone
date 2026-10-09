import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
if(!process.execArgv.some((arg,index)=>arg==='--import'&&process.execArgv[index+1]==='tsx')){
 const child=spawnSync(process.execPath,['--import','tsx',process.argv[1]],{stdio:'inherit',timeout:60000});if(child.error)throw child.error;process.exit(child.status??1);
}
const {DeviceActions}=await import('../apps/app/src/runtime/device-actions.ts');
const origin={version:1,requestId:'original-nonce',conversationId:'original-room',inReplyTo:'original-user'},digest='a'.repeat(64),context={view:'home',revision:1,sensitive:false};
function fixture(options={}){
 const operation={type:'notes_query',query:{kind:'title',text:'Owned synthetic title'}},session={ownerId:'owner',agentId:'agent',sessionId:'session',origin:'https://owned.invalid'},credential={installationId:'device',enrollmentId:'enrollment',capabilities:['notes.query.v1']};
 const f={calls:[],executions:0,terminal:[],state:'pending',...options};
 const proposal=()=>({id:'proposal',digest,state:f.state,subjectUserId:'owner',requestedBy:'agent',action:'device_action',expiresAt:new Date(Date.now()+60000).toISOString(),payload:{action:'device_action',version:1,installationId:'device',enrollmentId:'enrollment',operation},...(f.state==='pending'&&!f.legacy?{readReplyOrigin:f.origin||origin}:{}),...(f.state!=='pending'?{execution:{attemptId:'attempt'}}:{})});
 const journal={reserve:async input=>({created:true,entry:input}),markApplying:async()=>{},finish:async input=>f.terminal.push(input)};
 f.actions=new DeviceActions(session,credential,'scope',async(path,body,signal)=>{
  f.calls.push({path,body});signal.throwIfAborted();
  if(path.endsWith('/proposals'))return {proposals:[proposal()]};
  if(path.endsWith('/read-completion')){if(f.completionFailure)throw Error('Disconnected after admission');if(f.holdReply)await f.holdReply;return {reply:f.reply||{...origin,messageId:'new-assistant',text:'Canonical answer from the approved result'}};}
  if(path.endsWith('/cancel-read-completion'))return {cancelled:true};
  if(path.endsWith('/decision'))f.state='approved';if(path.endsWith('/claim'))f.state='executing';if(path.endsWith('/receipt')){if(f.receiptFailure)throw Error('Receipt unavailable');f.state=f.incomplete?'executing':'done';}
  return {digest,proposal:proposal()};
 },journal,async()=>{f.executions++;return f.declined?{status:'failed',summary:'Nothing shared'}:{status:'succeeded',summary:'No matching note',notesResult:f.selectedEmpty?{version:1,kind:'notes_query',query:operation.query,basis:'title-match',target:{sourceId:'source',sourceRevision:'b'.repeat(64),noteId:'note',revision:'c'.repeat(64)},record:{version:1,kind:'notes_read_selected',sourceId:'source',noteId:'note',revision:'c'.repeat(64),fields:{title:'Owned synthetic title',body:''}}}:{version:1,kind:'notes_query',query:operation.query,basis:'no-match'}};});
 f.approve=async()=>{const signal=new AbortController().signal;f.pending=await f.actions.pending(context,signal);return f.actions.approve('proposal',context,signal);};return f;
}
test('validated pending origin and confirmed applied receipt bind exactly one original-room answer without another read',async()=>{const f=fixture(),receipt=await f.approve();assert.deepEqual(f.pending[0].readReply,{origin,digest});assert.deepEqual(receipt.readReply,{...origin,proposalId:'proposal',digest,attemptId:'attempt'});assert.equal(f.calls.filter(x=>x.path.endsWith('/read-completion')).length,0);const reply=await f.actions.completeReadReply(receipt.readReply,new AbortController().signal);assert.equal(reply.inReplyTo,origin.inReplyTo);assert.equal(reply.messageId,'new-assistant');assert.equal(f.executions,1);await assert.rejects(f.actions.completeReadReply(receipt.readReply,new AbortController().signal),/unavailable/);assert.equal(f.calls.filter(x=>x.path.endsWith('/read-completion')).length,1);});
for(const option of ['legacy','receiptFailure','incomplete','declined'])test(`${option} receipt never becomes inference authority`,async()=>{const f=fixture({[option]:true}),receipt=await f.approve();assert.equal(receipt.readReply,undefined);assert.equal(f.calls.filter(x=>x.path.endsWith('/read-completion')).length,0);assert.equal(f.executions,1);if(option==='receiptFailure')assert.equal(receipt.status,'succeeded');});
test('mutated nonce, room, user, digest or attempt cannot dispatch a completion',async()=>{for(const key of ['requestId','conversationId','inReplyTo','digest','attemptId']){const f=fixture(),receipt=await f.approve();await assert.rejects(f.actions.completeReadReply({...receipt.readReply,[key]:key==='digest'?'b'.repeat(64):'foreign'},new AbortController().signal));assert.equal(f.calls.filter(x=>x.path.endsWith('/read-completion')).length,0);}});
test('uncertain completion cannot retry inference or repeat the local read',async()=>{const f=fixture({completionFailure:true}),receipt=await f.approve();await assert.rejects(f.actions.completeReadReply(receipt.readReply,new AbortController().signal),/Disconnected/);await assert.rejects(f.actions.completeReadReply(receipt.readReply,new AbortController().signal),/unavailable/);assert.equal(f.executions,1);assert.equal(f.terminal[0].status,'succeeded');assert.equal(f.calls.filter(x=>x.path.endsWith('/read-completion')).length,1);});
test('foreign reply identities and malformed pending origin fail closed',async()=>{for(const key of ['requestId','conversationId','inReplyTo']){const f=fixture({reply:{...origin,messageId:'assistant',text:'Answer',[key]:'foreign'}}),receipt=await f.approve();await assert.rejects(f.actions.completeReadReply(receipt.readReply,new AbortController().signal),/changed/);}const malformed=fixture({origin:{...origin,extra:'not allowed'}});await assert.rejects(malformed.approve(),/Unexpected/);assert.equal(malformed.executions,0);});
test('explicit cancellation retires the known original reply without repeating an effect',async()=>{const f=fixture(),receipt=await f.approve();await f.actions.cancelReadReply('proposal',digest,new AbortController().signal);await assert.rejects(f.actions.completeReadReply(receipt.readReply,new AbortController().signal),/unavailable/);assert.deepEqual(f.calls.at(-1).body,{digest});assert.equal(f.executions,1);});

test('explicitly selected empty Notes body remains a valid applied receipt and original answer input',async()=>{const f=fixture({selectedEmpty:true}),receipt=await f.approve();assert.equal(receipt.status,'succeeded');assert.equal(f.terminal[0].result.notesResult.record.fields.body,'');await f.actions.completeReadReply(receipt.readReply,new AbortController().signal);assert.equal(f.executions,1);});

test('pending Notes discovery outside Home stays visible as navigation only and cannot claim a read',async()=>{
 const f=fixture(),signal=new AbortController().signal,calendar={view:'calendar',revision:2,sensitive:false};
 const pending=await f.actions.pending(calendar,signal);
 assert.equal(pending.length,1);assert.equal(pending[0].reviewDestination,'home');
 await assert.rejects(f.actions.approve('proposal',calendar,signal),/Home or Notes/);
 assert.equal(f.executions,0);assert.equal(f.terminal.length,0);assert.equal(f.calls.some(c=>/decision|claim|receipt/.test(c.path)),false);
 const home=await f.actions.pending(context,signal);assert.equal(home.length,1);assert.equal(home[0].reviewDestination,undefined);
 const receipt=await f.actions.approve('proposal',context,signal);assert.equal(receipt.status,'succeeded');assert.equal(f.executions,1);
 const privateContext=await fixture().actions.pending({...calendar,sensitive:true},signal);assert.equal(privateContext.length,0);
});
