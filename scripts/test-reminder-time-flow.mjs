// Real renderer adapter -> native bridge boundary, under a controlled DST timezone.
// No Android/provider acceptance is implied by this host fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
process.env.TZ='America/New_York';
let writes=[],toasts=[];
const DailyApps={scheduleReminder:async input=>{writes.push(input);return {status:'scheduled'};},listReminders:async()=>({reminders:[]})};
let state={form:null},adapter;
class Shell{componentDidMount(){}componentWillUnmount(){}vset(){}toast(value){toasts.push(value);}}
const views={calendar:{state:{},render:()=>({f:{cals:[]}})}};
const source=stripTypeScriptTypes(fs.readFileSync(new URL('../apps/app/src/prototype/reminder-adapter.ts',import.meta.url),'utf8').replace(/^import .*?;\n/gm,'').replace('export function installReminderAdapter','function installReminderAdapter'));
vm.runInNewContext(source+'\ninstallReminderAdapter(Shell,views);',{Capacitor:{getPlatform:()=> 'android'},DailyApps,Shell,views,Date,crypto,console});
const api={get:()=>state,set:patch=>Object.assign(state,patch),toast:value=>toasts.push(value)};
const today=new Date();
const year=today.getFullYear()+1;
const march=new Date(Date.UTC(year,2,1));
const secondSunday=1+(7-march.getUTCDay())%7+7;
const off=(Date.UTC(year,2,secondSunday)-Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()))/86400000;
const form=time=>({title:'Disposable DST flow',notes:'',off,t:time,cal:'alpha-reminders',repeat:'none',alert:0});
state.form=form(2.5);adapter=views.calendar.render(state,api);await adapter.f.save();
assert.equal(writes.length,0,'Nonexistent local time must not reach native scheduling or its permission request');
assert.ok(toasts.some(t=>t.includes('Nothing was saved')));
state.form=form(3.5);await views.calendar.render(state,api).f.save();
assert.equal(writes.length,1);const saved=new Date(writes[0].at);assert.equal(saved.getHours(),3);assert.equal(saved.getMinutes(),30);assert.equal(saved.getDate(),secondSunday);
console.log('PASS real reminder adapter rejects DST-gap save before native bridge; valid neighboring wall time schedules once. Host boundary fixture only.');
