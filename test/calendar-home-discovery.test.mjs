import {execFileSync} from "node:child_process";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
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

test('actual native request header guard admits negotiated Calendar capabilities and rejects unknown or conflicting grants',async()=>{
 const source=fs.readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaConnectionPlugin.java','utf8'),start=source.indexOf(' static boolean validDeviceCapabilities(');let depth=0,end=-1;for(let i=source.indexOf('{',start);i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0){end=i+1;break;}}assert.ok(start>=0&&end>start);
 const dir=await mkdtemp(join(tmpdir(),'calendar-capability-')),java=process.env.JAVA_HOME||'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
 try{await writeFile(join(dir,'CalendarCapabilityProof.java'),`import java.util.Set;public final class CalendarCapabilityProof {${source.slice(start,end)} static void check(boolean value){if(!value)throw new AssertionError();}public static void main(String[] args){String old="calendar.local-event.v1,notes.local-record.v1,reminders.local-record.v2,reminders.create.v1,maps.selected-read.v1,clock.handoff.v1";check(validDeviceCapabilities(old));check(validDeviceCapabilities(old+",calendar.create.v1,calendar.next-read.v1"));check(validDeviceCapabilities(old+",calendar.create.v1,calendar.next-read.v1,notes.query.v1"));check(!validDeviceCapabilities(old+",FutureModelDeviceCapabilities"));check(!validDeviceCapabilities(old+",calendar.next-read.v1,calendar.next-read.v1"));check(!validDeviceCapabilities(old+",reminders.local-record.v1"));check(!validDeviceCapabilities(old+",unknown"));check(!validDeviceCapabilities(old+"\\n"));System.out.println("PASS exact native Calendar capability guard");}}`);execFileSync(join(java,'bin/javac'),['--release','11','-d',dir,join(dir,'CalendarCapabilityProof.java')]);assert.match(execFileSync(join(java,'bin/java'),['-cp',dir,'CalendarCapabilityProof'],{encoding:'utf8'}),/PASS exact native Calendar capability guard/);}finally{await rm(dir,{recursive:true,force:true});}
});

test('actual native journal finish uses typed Calendar kinds, immutable operation identity and existing size gates',{skip:!process.env.ALPHA_JSON_JAR},async()=>{
 const source=fs.readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaActionJournalPlugin.java','utf8');
 const utilities=source.slice(source.indexOf(' private static String key('),source.indexOf(' private void work('));
 const marker='@PluginMethod public void finish(PluginCall call){work(call,true,(store,scope,id)->{',start=source.indexOf(marker)+marker.length,end=source.indexOf('\n });}',start);assert.ok(start>=marker.length&&end>start);
 const dir=await mkdtemp(join(tmpdir(),'calendar-journal-')),java=process.env.JAVA_HOME||'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',jar=process.env.ALPHA_JSON_JAR;
 try{
  const proof=`import java.util.*;import org.json.*;public final class CalendarJournalProof {
 static class JSObject extends JSONObject{} static class PluginCall {JSONObject value;PluginCall(JSONObject value){this.value=value;}String getString(String key){return value.optString(key,null);}JSONObject getObject(String key){return value.optJSONObject(key);}}static class AlphaConnectionPlugin {Map<String,String> values=new HashMap<>();String readCredentialSlot(String key){return values.get(key);}void writeCredentialSlot(String key,String value){values.put(key,value);}}
 ${utilities}
 static JSObject finish(PluginCall call,AlphaConnectionPlugin store,String scope,String id)throws Exception{${source.slice(start,end)}}
 static void check(boolean value){if(!value)throw new AssertionError();}interface Work{void run()throws Exception;}static void rejects(Work work)throws Exception{try{work.run();}catch(IllegalArgumentException expected){return;}throw new AssertionError("Malformed native journal receipt admitted");}
 static AlphaConnectionPlugin applying(String type)throws Exception{AlphaConnectionPlugin store=new AlphaConnectionPlugin();JSONObject fields=new JSONObject().put("description","x".repeat(16000));JSONObject operation=new JSONObject().put("type",type).put("fields",fields);JSONObject entry=new JSONObject().put("operationId","native-op").put("phase","applying").put("record",new JSONObject().put("operation",operation));store.writeCredentialSlot(key("scope","proposal"),entry.toString());return store;}
 static JSONObject result(String type)throws Exception {return new JSONObject().put("operationId","native-op").put("calendarResult",type.equals("calendar_create_local")?new JSONObject().put("version",1).put("kind",type).put("sourceId","1").put("eventId","2").put("revision","a".repeat(64)):new JSONObject().put("version",1).put("kind",type).put("window",new JSONObject().put("start","2026-10-08T19:00:00.000Z").put("end","2026-11-07T08:00:00.000Z").put("timeZone","America/Los_Angeles")).put("event",JSONObject.NULL));}
 static PluginCall call(JSONObject result)throws Exception {return new PluginCall(new JSONObject().put("status","succeeded").put("summary","Reviewed Calendar result").put("result",result));}
 public static void main(String[] args)throws Exception{for(String type:new String[]{"calendar_create_local","calendar_read_next"}){AlphaConnectionPlugin store=applying(type);JSONObject result=result(type);check(result.toString().length()<8000);finish(call(result),store,"scope","proposal");JSONObject saved=read(store,"scope","proposal");check(saved.getString("phase").equals("terminal"));check(sameJson(saved.getJSONObject("result"),result));check(saved.getJSONObject("record").getJSONObject("operation").getJSONObject("fields").getString("description").length()==16000);finish(call(result),store,"scope","proposal");
 JSONObject badKind=result(type);badKind.getJSONObject("calendarResult").put("kind","calendar_delete");rejects(()->finish(call(badKind),applying(type),"scope","proposal"));JSONObject badId=result(type).put("operationId","other-op");rejects(()->finish(call(badId),applying(type),"scope","proposal"));JSONObject badVersion=result(type);badVersion.getJSONObject("calendarResult").put("version",2);rejects(()->finish(call(badVersion),applying(type),"scope","proposal"));rejects(()->finish(call(null),applying(type),"scope","proposal"));JSONObject oversized=result(type);oversized.getJSONObject("calendarResult").put("padding","x".repeat(80000));rejects(()->finish(call(oversized),applying(type),"scope","proposal"));}System.out.println("PASS actual native Calendar journal small receipt, full approved body retention, mismatch and size gates");}}`;
  await writeFile(join(dir,'CalendarJournalProof.java'),proof);execFileSync(join(java,'bin/javac'),['--release','11','-cp',jar,'-d',dir,join(dir,'CalendarJournalProof.java')]);assert.match(execFileSync(join(java,'bin/java'),['-cp',dir+':'+jar,'CalendarJournalProof'],{encoding:'utf8'}),/PASS actual native Calendar journal/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
