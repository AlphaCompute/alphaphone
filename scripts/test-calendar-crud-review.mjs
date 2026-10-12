// Real calendar adapter state transitions with a controlled native boundary.
// The native confirmation/provider assertions require CalendarCrudInstrumentedTest.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {mapsEventOriginFor} from '../apps/app/src/runtime/maps-event-return.ts';
import {deletionReviewText,hiddenDeletionTargets,UNDO_WINDOW_MS} from '../apps/app/src/runtime/pending-deletions.ts';
import {createDeletionUndo,deletionProvider} from '../apps/app/src/runtime/deletion-undo-core.ts';
const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);tomorrow.setHours(12,0,0,0);
const event={id:'71',calendarId:'19',title:'Reviewed local fixture',body:'Original',location:'Here',begin:tomorrow.getTime(),end:tomorrow.getTime()+3600000,allDay:false,recurring:false};
let readbackDown=false,exists=true,reviewStatus='cancelled',commitStatus='deleted',inspectStatus='ready',holdInspect,listReads=0;
const calendarEvents=new EventTarget();
const calls=[],toasts=[],opened=[],forgotten=[];
const calendar={pendingCreations:async()=>({status:'ready',creations:[]}),list:async()=>{listReads++;return {status:'ready',calendars:[{id:'19',name:'On this phone',local:true,account:'Alpha Phone',writable:true}],events:exists?[event]:[]};},inspect:async args=>{calls.push(['inspect',structuredClone(args)]);if(holdInspect)return holdInspect;return {status:inspectStatus,revision:'reviewed-revision'};},remove:async()=>{throw Error('Calendar must not delete without the Undo window');},reviewDeletion:async args=>{calls.push(['review',structuredClone(args)]);return reviewStatus==='reviewed'?{status:'reviewed',grant:'grant-'+calls.length,scope:'event',invitation:false,revision:args.revision}:{status:reviewStatus};},commitDeletion:async args=>{calls.push(['commit',structuredClone(args)]);if(commitStatus==='deleted')exists=false;return {status:commitStatus};},revokeDeletion:async args=>{calls.push(['revoke',structuredClone(args)]);return {status:'revoked'};},deletionReadback:async()=>({status:readbackDown?'unavailable':exists?'present':'absent'}),open:async()=>calls.push(['open']),requestAccess:async()=>({status:'granted'}),save:async args=>{calls.push(['save',structuredClone(args)]);return {status:'conflict'};}};
let saved=null,now=Date.now();const timers=[];
const store={read:async()=>saved===null?null:JSON.parse(saved),compareExchange:async(expected,next)=>{if(JSON.stringify(expected)!==(saved??'null'))return false;saved=next===null?null:JSON.stringify(next);return true;}};
const clock={now:()=>now,setTimeout:(fn,ms)=>{const t={at:now+ms,fn};timers.push(t);return t;},clearTimeout:t=>{const i=timers.indexOf(t);if(i>=0)timers.splice(i,1);}};
const noReminders={holdReminderDelivery:async()=>({status:'held'}),releaseReminderDelivery:async()=>({status:'released'}),reminderDeliveryHolds:async()=>({holds:[]}),operateReminder:async()=>{throw Error('No reminder in this fixture');},reminderOperationReceipt:async()=>({status:'unknown'}),listReminders:async()=>({reminders:[]})};
const undo=createDeletionUndo(store,deletionProvider(calendar,noReminders,{pending:async()=>({}),retain:async()=>{},acknowledge:async()=>{},discard:async()=>{}}),clock);
let state={day:1,month:null,events:[]};
const views={calendar:{render:()=>({events:[],hours:[],week:[],mdays:[],ev:{},f:state.form?{cals:[]}:null})}};
const api={now:Date.now(),open:(view,patch)=>opened.push([view,structuredClone(patch)]),isActive:()=>true,track:()=>'',kx:()=>0,toast:t=>toasts.push(t),set:patch=>Object.assign(state,patch),get:()=>state};
class Shell {componentDidMount(){} componentWillUnmount(){} toast(t,opts){toasts.push(t);if(opts?.undo)undoOffers.push({text:t,...opts});} vget(){return state;} vset(view,patch){Object.assign(state,patch);} async refreshReminders(){const hidden=hiddenDeletionTargets(undo.records());state.events=(this.nativeCalendarRows||[]).filter(e=>!hidden.event(String(e.nativeEvent.id)));}}
const undoOffers=[];
let source=fs.readFileSync(new URL('../apps/app/src/prototype/calendar-adapter.ts',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace("const calendar = registerPlugin<any>('AlphaCalendar');",'').replace(/^export /gm,'');
source=stripTypeScriptTypes(source);vm.runInNewContext(source+'\ninstallCalendarAdapter(Shell,views);',{window:calendarEvents,document:{hidden:false},openCalendarRecovery:()=>{throw Error('Browser recovery must not open in native fixture');},openReminderRecovery:()=>{throw Error('Browser reminder recovery must not open in native fixture');},openReminderActionRecovery:()=>{throw Error('Browser action recovery must not open in native fixture');},openReminderCreationRecovery:()=>{throw Error('Browser reminder creation recovery must not open in native fixture');},Capacitor:{getPlatform:()=> 'android',isNativePlatform:()=>true},calendar,DailyApps:{addListener:async()=>({remove(){}})},Shell,views,Date,queueMicrotask,console,mapsEventOriginFor,noteOriginSupported:()=>false,rememberNoteOrigin:async()=>{throw Error('Native events are not linked to notes');},forgetNoteOrigin:async(kind,id)=>{forgotten.push([kind,id]);},deletionUndo:()=>undo,deletionReviewText,setTimeout});
const shell=new Shell();shell.componentDidMount();await new Promise(r=>setTimeout(r,0));
const select=()=>{state.open=state.events[0].id;return views.calendar.render(state,api);};
state.reminderStale=true;assert.equal(select().reminderRecovery,false,'Native reminders do not offer browser document recovery');delete state.reminderStale;
select().ev.goWhere();assert.deepEqual(opened,[['maps',{query:'Here',fromEvent:{version:1,id:'71',begin:event.begin,rowId:state.events[0].id,day:1,title:event.title}}]],'The location hand-off names exactly the open event and carries only its identity');
await select().ev.edit();assert.equal(state.form.expected.revision,'reviewed-revision');assert.equal(state.form.expected.title,event.title);state.form=null;
const deletes=()=>calls.filter(c=>c[0]==='commit').length;
await select().ev.del();assert.equal(exists,true);assert.equal(calls.at(-1)[0],'review');assert.equal(calls.at(-1)[1].revision,'reviewed-revision');assert.match(calls.at(-1)[1].reviewText,/undo for 10 seconds/);assert.equal(state.open,state.events[0].id,'Cancelled review keeps the event open');assert.deepEqual(undo.records(),[]);
inspectStatus='conflict';const before=calls.filter(c=>c[0]==='review').length;await select().ev.del();assert.equal(calls.filter(c=>c[0]==='review').length,before,'Stale selection cannot reach review');
inspectStatus='external';await select().ev.del();assert.equal(calls.at(-1)[0],'open');assert.equal(calls.filter(c=>c[0]==='review').length,before,'Unsupported scope uses explicit handoff');
inspectStatus='ready';reviewStatus='conflict';await select().ev.del();assert.ok(toasts.includes('This event changed. Nothing was deleted.'));assert.deepEqual(undo.records(),[]);
// Policy P-30: a reviewed deletion is held for UNDO_WINDOW_MS; Undo inside it is lossless.
reviewStatus='reviewed';await select().ev.del();
assert.equal(deletes(),0,'Review does not delete');assert.equal(exists,true);assert.equal(undo.records().length,1);assert.equal(state.open,null,'The reviewed event closes at once');assert.equal(state.events.length,0,'The pending event is hidden');
assert.equal(undoOffers.length,1);assert.equal(undoOffers[0].ms,UNDO_WINDOW_MS);assert.match(undoOffers[0].text,/will be deleted/);
now+=4000;await undoOffers[0].undo();assert.deepEqual(undo.records(),[]);assert.equal(calls.at(-1)[0],'revoke','Undo revokes the native grant');assert.ok(toasts.includes('Event kept. Nothing was deleted.'));
await shell.refreshReminders();assert.equal(state.events.length,1,'Undo shows the event again');assert.equal(deletes(),0);
assert.deepEqual(forgotten,[],'Cancelled, stale, external and undone deletions keep any note link');
// Expiry commits once with the grant and reads the provider back.
await select().ev.del();assert.equal(undo.records().length,1);now+=UNDO_WINDOW_MS;await timers.shift().fn();await undo.commitDue();
assert.equal(deletes(),1);assert.equal(exists,false);assert.deepEqual(undo.records(),[]);assert.deepEqual(forgotten,[['event','71']],'A confirmed deletion drops only that event link');
// Unknown outcome with no readback: listed as unconfirmed, not repeated, resolved by readback.
const reload=async()=>{calendarEvents.dispatchEvent(new Event('alpha:calendar-committed'));await new Promise(r=>setTimeout(r,0));};
exists=true;await reload();await select().ev.del();commitStatus='unknown';readbackDown=true;exists=true;now+=UNDO_WINDOW_MS;await undo.commitDue();commitStatus='deleted';
assert.equal(undo.records()[0].phase,'unknown');assert.equal(undo.unconfirmed().length,1);assert.equal(deletes(),2);await undo.commitDue();assert.equal(deletes(),2,'Unknown outcome is not redispatched');
readbackDown=false;exists=false;await undo.reconcile();assert.deepEqual(undo.records(),[]);assert.equal(deletes(),2);
// A dispatch whose provider readback still shows the reviewed event is "not deleted", never redispatched.
exists=true;await reload();await select().ev.del();commitStatus='unknown';now+=UNDO_WINDOW_MS;await undo.commitDue();commitStatus='deleted';
assert.deepEqual(undo.records(),[]);assert.equal(deletes(),3);assert.match(toasts.at(-1)||'',/deletion did not happen/);
exists=true;await reload();
const draft={title:'Unsent calendar draft',notes:'Keep this text',cal:'native:local'},beforeRefresh=listReads;state.form=draft;
exists=true;calendarEvents.dispatchEvent(new Event('alpha:calendar-committed'));await new Promise(r=>setTimeout(r,0));
assert.equal(listReads,beforeRefresh+1,'Native committed receipt refreshes the existing provider list');assert.equal(state.events.length,1);assert.equal(state.events[0].alphaCalendarId,event.id);assert.equal(state.form,draft,'Receipt refresh preserves the current unsaved form');
state.form=null;
exists=true;shell.componentWillUnmount();const second=new Shell();second.componentDidMount();await new Promise(r=>setTimeout(r,0));let release;holdInspect=new Promise(r=>{release=r;});const pending=select().ev.del();second.componentWillUnmount();const closedReads=listReads;calendarEvents.dispatchEvent(new Event('alpha:calendar-committed'));await new Promise(r=>setTimeout(r,0));assert.equal(listReads,closedReads,'Unmount removes the committed receipt listener');const count=calls.filter(c=>c[0]==='review').length;release({status:'ready',revision:'late'});await pending;assert.equal(calls.filter(c=>c[0]==='review').length,count,'Unmounted selection cannot show delete confirmation');
console.log('PASS actual Calendar adapter: revision-bound edit, reviewed deletion held for the Undo window, lossless Undo with grant revoke, single commit after expiry with readback, cancellation, conflict, external handoff, unknown no-repeat, native committed receipt refresh with retained draft, unmount cancellation. Native provider acceptance separate.');
