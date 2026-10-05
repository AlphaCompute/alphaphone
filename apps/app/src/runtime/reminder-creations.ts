import {Capacitor} from '@capacitor/core';
import {secureConnectionStore} from './native-connection';
import {reminderFields,reminderTiming} from './reminder-contract';
import {DailyApps,type Reminder} from '../daily';
export type ReminderCreation={id:string;request:{id:string;title:string;body:string;at:number;recurrence?:Reminder['recurrence'];dueAt?:number;alertMinutes?:number|null};state:'pending'|'found'};
type Store=Record<string,ReminderCreation>;
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
