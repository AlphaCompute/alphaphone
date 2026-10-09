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
 }
});
test('Home shows the next permitted event and excludes expired, completed and unavailable cached events',()=>{
 const now=Date.now(),event=(id,title,begin,end)=>({id,title,alphaCalendarId:id,nativeEvent:{begin,end}});
 const rows=[event('old','Expired',now-20000,now-10000),{...event('done','Completed',now+1000,now+2000),reminderStatus:'completed'},event('later','Later meeting',now+20000,now+30000),event('next','Next meeting',now+10000,now+15000)];
 const value=summary({ready:true},rows);assert.equal(value.homeCalendarTitle,'Next meeting');assert.equal(value.homeCalendarLabel,'Open calendar event: Next meeting');
 assert.equal(summary({error:true,ready:false},rows).homeCalendarTitle,'Calendar unavailable');
});
