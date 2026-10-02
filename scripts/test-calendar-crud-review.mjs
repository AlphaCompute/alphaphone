// Real calendar adapter state transitions with a controlled native boundary.
// The native confirmation/provider assertions require CalendarCrudInstrumentedTest.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);tomorrow.setHours(12,0,0,0);
const event={id:'71',calendarId:'19',title:'Reviewed local fixture',body:'Original',location:'Here',begin:tomorrow.getTime(),end:tomorrow.getTime()+3600000,allDay:false,recurring:false};
let exists=true,removeStatus='cancelled',inspectStatus='ready',holdInspect;
const calls=[],toasts=[];
const calendar={pendingCreations:async()=>({status:'ready',creations:[]}),list:async()=>({status:'ready',calendars:[{id:'19',name:'On this phone',local:true,account:'Alpha Phone',writable:true}],events:exists?[event]:[]}),inspect:async args=>{calls.push(['inspect',structuredClone(args)]);if(holdInspect)return holdInspect;return {status:inspectStatus,revision:'reviewed-revision'};},remove:async args=>{calls.push(['remove',structuredClone(args)]);if(removeStatus==='deleted')exists=false;return {status:removeStatus};},open:async()=>calls.push(['open']),requestAccess:async()=>({status:'granted'}),save:async args=>{calls.push(['save',structuredClone(args)]);return {status:'conflict'};}};
let state={day:1,month:null,events:[]};
const views={calendar:{render:()=>({events:[],hours:[],week:[],mdays:[],ev:{},f:state.form?{cals:[]}:null})}};
const api={now:Date.now(),track:()=>'',kx:()=>0,toast:t=>toasts.push(t),set:patch=>Object.assign(state,patch),get:()=>state};
class Shell {componentDidMount(){} componentWillUnmount(){} vget(){return state;} vset(view,patch){Object.assign(state,patch);} async refreshReminders(){state.events=this.nativeCalendarRows||[];}}
let source=fs.readFileSync(new URL('../apps/app/src/prototype/calendar-adapter.ts',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace("const calendar = registerPlugin<any>('AlphaCalendar');",'').replace('export function installCalendarAdapter','function installCalendarAdapter');
source=stripTypeScriptTypes(source);vm.runInNewContext(source+'\ninstallCalendarAdapter(Shell,views);',{openCalendarRecovery:()=>{throw Error('Browser recovery must not open in native fixture');},Capacitor:{getPlatform:()=> 'android',isNativePlatform:()=>true},calendar,DailyApps:{addListener:async()=>({remove(){}})},Shell,views,Date,queueMicrotask,console});
const shell=new Shell();shell.componentDidMount();await new Promise(r=>setTimeout(r,0));
const select=()=>{state.open=state.events[0].id;return views.calendar.render(state,api);};
await select().ev.edit();assert.equal(state.form.expected.revision,'reviewed-revision');assert.equal(state.form.expected.title,event.title);state.form=null;
await select().ev.del();assert.equal(exists,true);assert.equal(calls.at(-1)[0],'remove');assert.equal(calls.at(-1)[1].revision,'reviewed-revision');assert.equal(state.open,state.events[0].id);
inspectStatus='conflict';const before=calls.filter(c=>c[0]==='remove').length;await select().ev.del();assert.equal(calls.filter(c=>c[0]==='remove').length,before,'Stale selection cannot reach mutation');
inspectStatus='external';await select().ev.del();assert.equal(calls.at(-1)[0],'open');assert.equal(calls.filter(c=>c[0]==='remove').length,before,'Unsupported scope uses explicit handoff');
inspectStatus='ready';removeStatus='unknown';await select().ev.del();assert.equal(shell.calendarWriteUncertain,true);await select().ev.del();assert.equal(calls.filter(c=>c[0]==='remove').length,before+1,'Unknown outcome blocks repeat until refresh');
shell.calendarWriteUncertain=false;removeStatus='deleted';await select().ev.del();assert.equal(exists,false);assert.equal(state.open,null);assert.equal(state.events.length,0);
exists=true;shell.componentWillUnmount();const second=new Shell();second.componentDidMount();await new Promise(r=>setTimeout(r,0));let release;holdInspect=new Promise(r=>{release=r;});const pending=select().ev.del();second.componentWillUnmount();const count=calls.filter(c=>c[0]==='remove').length;release({status:'ready',revision:'late'});await pending;assert.equal(calls.filter(c=>c[0]==='remove').length,count,'Unmounted selection cannot show delete confirmation');
console.log('PASS actual Calendar adapter: revision-bound edit/delete, cancellation, conflict, external handoff, unknown no-repeat, deletion refresh, unmount cancellation. Native provider acceptance separate.');
