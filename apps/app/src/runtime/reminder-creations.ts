import {Capacitor} from '@capacitor/core';
import {secureConnectionStore} from './native-connection';
import {reminderFields,reminderTiming} from '../../../../.eliza/client-features/plugins/plugin-assistant/src/services/device-actions/reminder-contract.ts';
import {DailyApps,type Reminder} from '../daily';
export type ReminderCreation={id:string;request:{id:string;title:string;body:string;at:number;recurrence?:Reminder['recurrence'];dueAt?:number;alertMinutes?:number|null};state:'pending'|'found'};
type Store=Record<string,ReminderCreation>;
type Bag=Record<string,any>;
const slot='reminder-creations:v1:device';
const browserHistory=()=>import('../browser/reminder-creation-document');
function valid(value:Store|null):Store{
 if(value===null)return {};
 if(typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>32||new TextEncoder().encode(JSON.stringify(value)).length>128*1024)throw Error('Reminder creation history is full or unavailable');
 for(const [id,row]of Object.entries(value)){
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(id)||row.id!==id||row.request?.id!==id||!['pending','found'].includes(row.state)||Object.keys(row).some(k=>!['id','request','state'].includes(k))||Object.keys(row.request).some(k=>!['id','title','body','at','recurrence','dueAt','alertMinutes'].includes(k)))throw Error('Invalid reminder creation history');
  reminderFields({title:row.request.title,body:row.request.body,schedule:{at:row.request.at,recurrence:row.request.recurrence||null,...(row.request.dueAt!==undefined||row.request.alertMinutes!==undefined?{dueAt:row.request.dueAt,alertMinutes:row.request.alertMinutes}:{})}});
 }
 return value;
}
const read=async():Promise<Store|null>=>{
 if(Capacitor.getPlatform()==='android')return secureConnectionStore.read<Store>(slot);
 const {reminderCreationDocument}=await browserHistory();
 return reminderCreationDocument.readJson<Store>();
};
export async function reminderCreations(){return valid(await read());}
async function change(id:string,expected:ReminderCreation|null,value:ReminderCreation|null){
 const update=(raw:Store|null)=>{
  const all=valid(raw);if(!value&&!all[id])return raw;
  if(JSON.stringify(all[id]||null)!==JSON.stringify(expected))throw Error('Reminder creation changed');
  const next={...all};if(value)next[id]=value;else delete next[id];
  while(value&&(Object.keys(next).length>32||new TextEncoder().encode(JSON.stringify(next)).length>128*1024)){const retire=Object.keys(next).find(k=>k!==id&&next[k].state==='found');if(!retire)break;delete next[retire];}
  return valid(next);
 };
 if(Capacitor.getPlatform()==='android'){
  const raw=await read(),next=update(raw);
  if(next===raw)return;
  if((await secureConnectionStore.compareExchange(slot,raw,next)).status!=='saved')throw Error('Reminder creation changed');
 }else{
  if(!value&&!(await reminderCreations())[id])return;
  const {reminderCreationDocument}=await browserHistory();
  await reminderCreationDocument.editJson<Store>(update);
 }
 if(JSON.stringify((await reminderCreations())[id]||null)!==JSON.stringify(value))throw Error('Reminder creation save unconfirmed');
}
export async function retainReminderCreation(row:ReminderCreation){await change(row.id,null,row);}
/** Only the creating handler, before scheduleReminder was invoked. */
export async function discardUndispatchedCreation(row:ReminderCreation){await change(row.id,row,null);}
function matches(row:ReminderCreation,saved:Reminder){
 return saved.id===row.id&&saved.title===row.request.title&&saved.body===row.request.body&&saved.at===row.request.at&&(row.request.alertMinutes===undefined||(row.request.alertMinutes===null?saved.mode==='none'&&['pending','completed','cancelled'].includes(saved.status):saved.mode==='inexact'&&saved.status!=='pending'))&&JSON.stringify(reminderTiming(saved))===JSON.stringify(reminderTiming(row.request))&&(saved.recurrence&&row.request.recurrence?['rule','zone','date','time','leadMinutes'].every(k=>(saved.recurrence as any)[k]===(row.request.recurrence as any)[k]):!saved.recurrence&&!row.request.recurrence)&&!!saved.occurrenceId&&['pending','scheduled','posted','completed','cancelled','permission-denied','scheduling-failed'].includes(saved.status);
}
/** Native refusal codes (reminderStatusVersion 1, browser 'past'): nothing was scheduled for the request. */
export const reminderRefusals=['past','permission-denied','storage-full','failed'] as const;
export type ReminderRefusal=typeof reminderRefusals[number];
export const isReminderRefusal=(status:unknown):status is ReminderRefusal=>reminderRefusals.includes(status as ReminderRefusal);
/**
 * Retire a pending creation only after a definite native refusal AND a readback that
 * confirms the ID is absent. A saved row (for example permission-denied but stored) is
 * never retired here; checkReminderCreation finds it instead. Never schedules.
 */
export async function retireRefusedCreation(id:string,status:unknown,rows?:Reminder[]):Promise<boolean>{
 if(!isReminderRefusal(status))return false;
 const row=(await reminderCreations())[id];if(!row||row.state!=='pending')return false;
 const saved=(rows||(await DailyApps.listReminders()).reminders).some(r=>r.id===id);
 if(saved)return false;
 await change(id,row,null);return true;
}
export async function checkReminderCreation(id:string,rows?:Reminder[]){
 const row=(await reminderCreations())[id];if(!row)return 'unknown' as const;if(row.state==='found')return 'found' as const;
 const saved=(rows||(await DailyApps.listReminders()).reminders).find(r=>r.id===id);
 if(!saved||!matches(row,saved))return 'unknown' as const;
 await change(id,row,{...row,state:'found'});return 'found' as const;
}
export async function reconcileReminderCreations(){
 const all=await reminderCreations(),pending=Object.values(all).filter(r=>r.state==='pending');
 if(pending.length){const rows=(await DailyApps.listReminders()).reminders;for(const row of pending)try{await checkReminderCreation(row.id,rows);}catch{/* Retain unknown; never schedule here. */}}
 return Object.values(await reminderCreations()).filter(r=>r.state==='pending').length;
}

// ---- Pure reminder presentation helpers (used by reminder-adapter and Home) ----
// Construct the requested civil fields independently of local DST normalization.
export function reminderWallTime(off:number,hours:number):Date|null {
  if(!Number.isSafeInteger(off)||!Number.isFinite(hours))return null;
  const minutes=Math.round(hours*60),today=new Date();
  const target=new Date(Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()+off,0,minutes));
  const date=new Date(target.getUTCFullYear(),target.getUTCMonth(),target.getUTCDate(),target.getUTCHours(),target.getUTCMinutes());
  return date.getFullYear()===target.getUTCFullYear()&&date.getMonth()===target.getUTCMonth()&&date.getDate()===target.getUTCDate()&&date.getHours()===target.getUTCHours()&&date.getMinutes()===target.getUTCMinutes()?date:null;
}
/** Undated to-dos (reminderTodoVersion 1) have no instant, alarm or calendar day. */
export const isUndatedReminder=(r:Reminder)=>(r as Reminder&{undated?:boolean}).undated===true;
export const reminderDueAt=(r:Reminder)=>r.dueAt??r.at;
const dueOf=reminderDueAt;
/**
 * One-off reminders are absolute instants (dueAt). Only the rendered wall time follows the
 * phone's current time zone, so a zone change moves the displayed hour, never the instant.
 * Repeats keep their civil time in recurrence.zone (see docs/calendar-reminder-contract.md).
 */
export function reminderEvents(rows:Reminder[],now=new Date()):Bag[]{
  return rows.filter(r=>!isUndatedReminder(r)&&(r.status === 'pending' || r.status === 'completed' || r.status === 'scheduled' || r.status === 'posted' || r.status === 'permission-denied' || r.status === 'scheduling-failed')).map(r => {
    const date = new Date(dueOf(r)), today = new Date(now); today.setHours(0,0,0,0);
    const day = new Date(date); day.setHours(0,0,0,0);
    return { id: 'reminder:' + r.id, alphaReminderId: r.id, reminderBody:r.body, reminderAt:r.at, reminderDueAt:dueOf(r), reminderOccurrence:r.occurrenceId, reminderRecurrence:r.recurrence, reminderHistory:r.history, reminderStatus:r.status, reminderTarget:r.target, off: Math.round((day.getTime()-today.getTime())/86400000), t: date.getHours()+date.getMinutes()/60, d: .25, title:r.title, cal:'personal', who:[], repeat:'none', alert:r.alertMinutes!==undefined?r.alertMinutes:r.recurrence?.leadMinutes || 0, notes:[r.body, r.snoozedAt && r.status==='scheduled' ? `Snoozed until ${new Date(r.at).toLocaleString()} · approximate delivery` : '', r.recurrence ? `${r.recurrence.rule} · ${r.recurrence.zone}. ${r.alertMinutes===null?'Next occurrence is saved with no alert after Done.':'Next occurrence is scheduled after Done.'} Future missing clock times use the first valid time after the gap; repeated clock times use the earlier offset.` : '', r.status === 'scheduling-failed' ? 'Saved, scheduling failed. Tap Snooze 10 minutes to retry.' : '', r.status === 'pending' ? 'No alert · saved on this device' : r.status === 'completed' ? 'Completed · no further alarm scheduled' : r.status === 'posted' ? 'Notification posted' : r.status === 'permission-denied' ? `Not delivered · notifications were disabled. Enable notifications in ${Capacitor.isNativePlatform()?'Android settings':'Settings'}, then edit this reminder to choose a new time and save.` : 'Scheduled · approximate delivery'].filter(Boolean).join('\n') };
  });
}
/** Due and not done: posted, or still scheduled (delayed or snoozed) after its due instant. Oldest first. */
export function overdueReminders(rows:Reminder[],now=Date.now()):Reminder[]{
  return rows.filter(r=>!isUndatedReminder(r)&&Number.isFinite(dueOf(r))&&dueOf(r)<now&&(r.status==='posted'||r.status==='scheduled')).sort((a,b)=>dueOf(a)-dueOf(b));
}
/** Open and completed undated to-dos, open first, in creation order. */
export function undatedTodos(rows:Reminder[]):Reminder[]{
  return rows.filter(r=>isUndatedReminder(r)&&((r.status as string)==='todo'||r.status==='completed')).sort((a,b)=>Number(a.status==='completed')-Number(b.status==='completed')||a.createdAt-b.createdAt);
}
/** Specific, stable reason for a definite native refusal. Nothing was saved in every case. */
export function reminderRefusalMessage(status:ReminderRefusal,native=Capacitor.isNativePlatform()):string{
  switch(status){
    case 'past':return 'This reminder time has passed. Choose a future time. Nothing was saved.';
    case 'permission-denied':return `Notifications are off for Alpha. Enable them in ${native?'Android settings':'Settings'}, then save again. Nothing was saved.`;
    case 'storage-full':return 'Reminder storage is full. Complete or delete a reminder, then save again. Nothing was saved.';
    default:return 'This reminder could not be saved. Check its title and time, then save again. Nothing was saved.';
  }
}
/**
 * Reviewed reopen schedule for a completed one-off reminder. 'open' keeps it open with no
 * alert (its original due instant, or the next minute if that has passed); 'tomorrow'
 * alerts at the original local clock time tomorrow. Returns null for a missing local time.
 */
export function reopenSchedule(reminder:{dueAt:number;alertMinutes:number|null},mode:'open'|'tomorrow',now=Date.now()):{at:number;recurrence:null;dueAt:number;alertMinutes:number|null}|null{
  if(mode==='open'){const dueAt=Math.max(reminder.dueAt,Math.ceil((now+60000)/60000)*60000);return {at:dueAt,recurrence:null,dueAt,alertMinutes:null};}
  // Tomorrow relative to the phone's current day (reminderWallTime reads the current clock).
  const original=new Date(reminder.dueAt),date=reminderWallTime(1,original.getHours()+original.getMinutes()/60);if(!date)return null;
  const lead=reminder.alertMinutes??0,dueAt=date.getTime();if(dueAt-lead*60000<=now)return null;
  return {at:dueAt-lead*60000,recurrence:null,dueAt,alertMinutes:lead};
}
