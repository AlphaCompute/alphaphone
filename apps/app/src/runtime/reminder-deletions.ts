import {Capacitor} from '@capacitor/core';
import {secureConnectionStore} from './native-connection';
import {validateReminderOperation,validateReminderResult,type ReminderOperation,type ReminderTarget} from '../../../../.eliza/client-features/plugins/plugin-assistant/src/services/device-actions/reminder-contract.ts';
import {DailyApps} from '../daily';
export type PendingReminderDeletion={operationId:string;bindingHash:string;operation:Extract<ReminderOperation,{type:'reminder_update'}>|{type:'reminder_cancel'|'reminder_complete'|'reminder_snooze';target:ReminderTarget}};
const slot='reminder-deletions:v1:device';
const browserHistory=()=>import('../browser/reminder-action-document');
type Pending=Record<string,PendingReminderDeletion>;
function validate(raw:Pending|null):Pending{
 if(raw===null)return {};
 if(new TextEncoder().encode(JSON.stringify(raw)).length>128*1024)throw Error('Pending deletion store is full');
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>100)throw Error('Invalid pending deletion store');
 for(const [id,input] of Object.entries(raw)){
  const op=validateReminderOperation(input.operation);
  if(!['reminder_cancel','reminder_complete','reminder_snooze','reminder_update'].includes(op.type)||input.operationId!==id||!/^[A-Za-z0-9_-]{1,128}$/.test(input.operationId)||!/^[a-f0-9]{64}$/.test(input.bindingHash))throw Error('Invalid pending deletion');
 }
 return raw;
}
async function read():Promise<Pending|null>{
 if(Capacitor.getPlatform()==='android')return secureConnectionStore.read<Pending>(slot);
 return (await browserHistory()).reminderActionDocument.readJson<Pending>();
}
export async function pendingReminderDeletions(){return validate(await read());}
async function change(id:string,expected:PendingReminderDeletion|null,value:PendingReminderDeletion|null){
 const update=(raw:Pending|null)=>{
  const all=validate(raw);if(value===null&&!all[id])return raw;
  if(JSON.stringify(all[id]||null)!==JSON.stringify(expected))throw Error('Pending deletion changed');
  const next={...all};if(value)next[id]=value;else delete next[id];return validate(next);
 };
 if(Capacitor.getPlatform()==='android'){
  const raw=await read(),next=update(raw);if(next===raw)return;
  if((await secureConnectionStore.compareExchange(slot,raw,next)).status!=='saved')throw Error('Pending deletion changed');
 }else{
  if(value===null&&!(await pendingReminderDeletions())[id])return;
  await (await browserHistory()).reminderActionDocument.editJson<Pending>(update);
 }
 if(JSON.stringify((await pendingReminderDeletions())[id]||null)!==JSON.stringify(value))throw Error('Pending deletion save unconfirmed');
}
export async function retainReminderDeletion(input:PendingReminderDeletion){await change(input.operationId,null,input);}
/** Only the creating live handler may call this before it has invoked operateReminder. */
export async function discardUndispatchedReminderDeletion(input:PendingReminderDeletion){await change(input.operationId,input,null);}
export async function acknowledgeReminderDeletion(input:PendingReminderDeletion,result:unknown){const checked=validateReminderResult(input.operation,result);if(input.operation.type==='reminder_update'){const schedule=input.operation.fields.schedule;if(schedule&&(!['pending','scheduled','permission-denied','scheduling-failed'].includes(checked.status)||checked.at!==schedule.at||checked.occurrenceId===input.operation.target.occurrenceId||schedule.alertMinutes!==undefined&&(checked.dueAt!==schedule.dueAt||checked.alertMinutes!==schedule.alertMinutes)))throw Error('Invalid reschedule outcome');if(!schedule&&(checked.status==='cancelled'||checked.occurrenceId!==input.operation.target.occurrenceId))throw Error('Invalid metadata edit outcome');}if(input.operation.type==='reminder_snooze'&&!['scheduled','permission-denied','scheduling-failed'].includes(checked.status))throw Error('Invalid snooze outcome');if(input.operation.type==='reminder_complete'&&!['completed','pending','scheduled','permission-denied','scheduling-failed'].includes(checked.status))throw Error('Invalid completion outcome');await change(input.operationId,input,null);}
export async function reconcileReminderDeletions(){
 const pending=await pendingReminderDeletions();
 for(const input of Object.values(pending))try{
  const receipt=await DailyApps.reminderOperationReceipt(input);
  if(receipt.status==='succeeded'&&receipt.result)await acknowledgeReminderDeletion(input,receipt.result);
 }catch{/* Keep unknown records; reconciliation never executes a mutation. */}
 return Object.keys(await pendingReminderDeletions()).length;
}
