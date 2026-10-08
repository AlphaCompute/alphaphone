import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {isCalendarOperation,calendarCapabilityAvailable,validateCalendarOperation,validateCalendarResult} from '../.eliza/client-features/plugins/plugin-assistant/src/services/device-actions/calendar-contract.ts';
import {presentDeviceRecordOperation} from '../apps/app/src/runtime/device-record-presentation.ts';
const source=fs.readFileSync('apps/app/src/runtime/device-actions.ts','utf8').replace(/^import .*;\n/gm,'').replaceAll('export ','');
const box={crypto,TextEncoder,structuredClone,AbortController,isCalendarOperation,calendarCapabilityAvailable,validateCalendarOperation,validateCalendarResult,presentDeviceRecordOperation,isClockOperation:()=>false,isReminderOperation:()=>false,isReminderCreate:()=>false,isNotesOperation:()=>false,isMapsOperation:()=>false};
vm.runInNewContext(stripTypeScriptTypes(source,{mode:'transform'})+'\nglobalThis.DeviceActions=DeviceActions;',box);
const context={view:'home',revision:1,sensitive:false,timeZone:'America/Los_Angeles'};
const fields={title:'From Home',description:'Exact text',location:'',start:'2026-10-09T15:00:00.000Z',end:'2026-10-09T15:15:00.000Z',timeZone:context.timeZone};
function fixture(operation,capabilities=['calendar.create.v1','calendar.next-read.v1']){
 const session={ownerId:'owner',agentId:'agent',sessionId:'session',origin:'https://agent.test'},credential={installationId:'installation',enrollmentId:'enrollment',capabilities},digest='a'.repeat(64);
 const proposal={id:'owned-calendar-proposal',digest,state:'pending',subjectUserId:session.ownerId,requestedBy:session.agentId,action:'device_action',expiresAt:new Date(Date.now()+60000).toISOString(),payload:{action:'device_action',version:1,installationId:credential.installationId,enrollmentId:credential.enrollmentId,operation}};
 const f={executions:0,uploads:[],journal:[],result:operation.type==='calendar_create_local'?{version:1,kind:operation.type,sourceId:'native-local',eventId:'native-event',revision:'b'.repeat(64)}:{version:1,kind:operation.type,window:{start:'2026-10-08T19:00:00.000Z',end:'2026-11-07T08:00:00.000Z',timeZone:context.timeZone},event:null}};
 const journal={reserve:async input=>{f.journal.push({phase:'reserved',...input});return {created:true,entry:f.journal[0]};},markApplying:async()=>{f.journal.push({phase:'applying'});},finish:async input=>{f.journal.push({phase:'terminal',...input});}};
 f.actions=new box.DeviceActions(session,credential,'c'.repeat(64),async(path,body)=>{
  if(path.endsWith('/proposals'))return {proposals:[proposal]};
  if(path.endsWith('/receipt'))f.uploads.push(body);
  return {digest,proposal:{...proposal,state:path.endsWith('/claim')?'executing':path.endsWith('/receipt')?'done':'approved',execution:{attemptId:'owned-attempt'}}};
 },journal,async()=>{f.executions++;return {status:'succeeded',summary:'Approved Calendar result',calendarResult:f.result};});return f;
}
test('actual proposal coordinator offers Home Calendar intents, journals approval, and uploads only validated results',async()=>{
 for(const operation of [{type:'calendar_create_local',fields},{type:'calendar_read_next'}]){
  const f=fixture(operation),signal=new AbortController().signal,pending=await f.actions.pending(context,signal);
  assert.equal(pending.length,1);assert.equal(f.executions,0);assert.equal(f.uploads.length,0);
  const result=await f.actions.approve(pending[0].id,context,signal);assert.equal(result.status,'succeeded');assert.equal(f.executions,1);assert.deepEqual(f.journal.map(x=>x.phase),['reserved','applying','terminal']);assert.equal(f.uploads.length,1);assert.deepEqual(JSON.parse(JSON.stringify(f.uploads[0].receipt.result)),f.result);
 }
});
test('old capability, locked or changed Home context never executes a new Calendar intent',async()=>{
 const signal=new AbortController().signal;
 await assert.rejects(fixture({type:'calendar_read_next'},['calendar.local-event.v1']).actions.pending(context,signal),/not negotiated/);
 const locked=fixture({type:'calendar_read_next'});assert.equal((await locked.actions.pending({...context,sensitive:true},signal)).length,0);assert.equal(locked.executions,0);
 const changed=fixture({type:'calendar_create_local',fields}),pending=await changed.actions.pending(context,signal);await assert.rejects(changed.actions.approve(pending[0].id,{...context,revision:2},signal),/current screen/);assert.equal(changed.executions,0);
 const selected=fixture({type:'calendar_delete',target:{sourceId:'1',sourceRevision:'a'.repeat(64),eventId:'2',revision:'b'.repeat(64)}});assert.equal((await selected.actions.pending(context,signal)).length,0);assert.equal(selected.executions,0);
});
test('unapproved extra discovery content cannot become an applied upload',async()=>{
 const f=fixture({type:'calendar_read_next'}),signal=new AbortController().signal,pending=await f.actions.pending(context,signal);f.result={...f.result,privateNotes:'unapproved content'};
 const result=await f.actions.approve(pending[0].id,context,signal);assert.equal(result.status,'unknown');assert.equal(f.uploads.length,0);assert.equal(f.journal.filter(x=>x.phase==='terminal').length,0);
});
