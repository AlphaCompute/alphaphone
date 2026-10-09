import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const source=stripTypeScriptTypes(fs.readFileSync('apps/app/src/prototype/data-adapter.ts','utf8').replace(/^import .*;\n/gm,'').replaceAll('export ',''));
function summary(calendarSource,events=[]){
 class Shell {
  renderVals(){return {};}
  S(){return {view:'home'};}
  vget(view){return view==='calendar'?{events,nativeCalendarStatus:'Local calendar ready'}:{};}
 }
 const views={calendar:{displaySources:()=>calendarSource}};
 vm.runInNewContext(source+'\ninstallPrototypeDataAdapter(Shell,views);',{Shell,views,browserDevProfile:false,Date,WeakSet});
 return new Shell().renderVals();
}
test('Home Calendar uses provider readiness rather than a display status string',()=>{
 for(const [state,title] of [[{ready:true},'No upcoming events'],[{loading:true},'Loading events…'],[{error:true},'Calendar unavailable'],[{ready:false},'Calendar unavailable'],[{ready:true,truncated:true},'Calendar results limited']]){
  const value=summary(state);assert.equal(value.homeCalendarTitle,title);
  assert.equal(value.homeCalendarTime,new Date().toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'}));
  assert.equal(value.homeCalendarHasEvent,false);assert.equal(value.homeCalendarFooter,'');
 }
});
test('Home shows the next permitted event and excludes expired, completed and unavailable cached events',()=>{
 const now=Date.now(),event=(id,title,begin,end)=>({id,title,alphaCalendarId:id,nativeEvent:{begin,end}});
 const rows=[event('old','Expired',now-20000,now-10000),{...event('done','Completed',now+1000,now+2000),reminderStatus:'completed'},event('later','Later meeting',now+20000,now+30000),event('next','Next meeting',now+10000,now+15000)];
 const value=summary({ready:true},rows);assert.equal(value.homeCalendarTitle,'Next meeting');assert.ok(value.homeCalendarLabel.startsWith('Open calendar event: Next meeting, '));assert.ok(value.homeCalendarLabel.endsWith(value.homeCalendarFooter));assert.equal(value.homeCalendarHasEvent,true);
 assert.equal(summary({error:true,ready:false},rows).homeCalendarTitle,'Calendar unavailable');
});
test('real event metadata keeps the complete long title, future day and time range',()=>{
 const day=new Date(Date.now()+3*86400000);day.setHours(12,0,0,0);const begin=day.getTime(),end=begin+3600000,title='Owned synthetic calendar title with a long unbroken word '+ 'LongTitle'.repeat(12),value=summary({ready:true},[{id:'synthetic',title,alphaCalendarId:'synthetic',nativeEvent:{begin,end}}]);
 const time=instant=>new Date(instant).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 assert.equal(value.homeCalendarTitle,title);assert.equal(value.homeCalendarTime,day.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'}));assert.equal(value.homeCalendarFooter,time(begin)+' – '+time(end));assert.ok(value.homeCalendarLabel.includes(title));assert.ok(value.homeCalendarLabel.includes(value.homeCalendarTime));assert.ok(value.homeCalendarLabel.includes(value.homeCalendarFooter));
});
test('all-day events retain their calendar date and expose All day without a fabricated clock time',()=>{
 const future=new Date(Date.now()+3*86400000),begin=Date.UTC(future.getFullYear(),future.getMonth(),future.getDate()),value=summary({ready:true},[{id:'all-day',title:'Synthetic all-day event',alphaCalendarId:'synthetic',nativeEvent:{begin,end:begin+86400000,allDay:true}}]);
 assert.equal(value.homeCalendarFooter,'All day');assert.equal(value.homeCalendarHasEvent,true);assert.equal(value.homeCalendarTime,new Date(future.getFullYear(),future.getMonth(),future.getDate()).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'}));
});
test('an untitled reminder keeps a single real time and an accessible fallback title',()=>{
 const reminderAt=Date.now()+3600000,value=summary({ready:true},[{id:'reminder',title:'',reminderAt}]);assert.equal(value.homeCalendarTitle,'Untitled event');assert.equal(value.homeCalendarFooter,new Date(reminderAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}));assert.ok(value.homeCalendarLabel.includes('Untitled event'));
});
test('a cross-day event names the end day in its time footer',()=>{
 const begin=new Date(Date.now()+3*86400000);begin.setHours(23,0,0,0);const end=new Date(begin.getTime()+2*3600000),value=summary({ready:true},[{id:'overnight',title:'Synthetic overnight event',alphaCalendarId:'synthetic',nativeEvent:{begin:begin.getTime(),end:end.getTime()}}]);assert.ok(value.homeCalendarFooter.includes(end.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})));
});
