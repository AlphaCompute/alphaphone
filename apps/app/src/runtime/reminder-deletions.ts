import {Capacitor} from '@capacitor/core';
import {secureConnectionStore} from './native-connection';
import {validateReminderOperation,validateReminderResult,type ReminderTarget} from './reminder-contract';
import {DailyApps} from '../daily';
export type PendingReminderDeletion={operationId:string;bindingHash:string;operation:{type:'reminder_cancel'|'reminder_complete'|'reminder_snooze';target:ReminderTarget}};
// Legacy deletion slot retained: old cancel records remain readable alongside reviewed decisions.
const slot='reminder-deletions:v1:device',webKey='alpha.browser.reminder-deletions.v1';
type Pending=Record<string,PendingReminderDeletion>;
function validate(raw:Pending|null):Pending{
 if(raw===null)return {};
 if(new TextEncoder().encode(JSON.stringify(raw)).length>128*1024)throw Error('Pending deletion store is full');
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>100)throw Error('Invalid pending deletion store');
 for(const [id,input] of Object.entries(raw)){
  const op=validateReminderOperation(input.operation);
  if(!['reminder_cancel','reminder_complete','reminder_snooze'].includes(op.type)||input.operationId!==id||!/^[A-Za-z0-9_-]{1,128}$/.test(input.operationId)||!/^[a-f0-9]{64}$/.test(input.bindingHash))throw Error('Invalid pending deletion');
 }
 return raw;
}
async function read():Promise<Pending|null>{return Capacitor.getPlatform()==='android'?secureConnectionStore.read<Pending>(slot):JSON.parse(localStorage.getItem(webKey)||'null');}
export async function pendingReminderDeletions(){return validate(await read());}
async function change(id:string,expected:PendingReminderDeletion|null,value:PendingReminderDeletion|null){
 if(Capacitor.getPlatform()==='android')return changeLocked(id,expected,value);
 if(!navigator.locks?.request)throw Error('Safe browser storage requires Web Locks');
 return navigator.locks.request(webKey,{mode:'exclusive'},()=>changeLocked(id,expected,value));
}
async function changeLocked(id:string,expected:PendingReminderDeletion|null,value:PendingReminderDeletion|null){
 const raw=await read(),all=validate(raw);
 if(value===null&&!all[id])return;
 if(JSON.stringify(all[id]||null)!==JSON.stringify(expected))throw Error('Pending deletion changed');
 const next={...all};if(value)next[id]=value;else delete next[id];validate(next);
 if(Capacitor.getPlatform()==='android'){
  if((await secureConnectionStore.compareExchange(slot,raw,next)).status!=='saved')throw Error('Pending deletion changed');
 }else{
  if(localStorage.getItem(webKey)!==(raw===null?null:JSON.stringify(raw)))throw Error('Pending deletion changed');
  localStorage.setItem(webKey,JSON.stringify(next));
 }
 if(JSON.stringify((await pendingReminderDeletions())[id]||null)!==JSON.stringify(value))throw Error('Pending deletion save unconfirmed');
}
export async function retainReminderDeletion(input:PendingReminderDeletion){await change(input.operationId,null,input);}
/** Only the creating live handler may call this before it has invoked operateReminder. */
export async function discardUndispatchedReminderDeletion(input:PendingReminderDeletion){await change(input.operationId,input,null);}
export async function acknowledgeReminderDeletion(input:PendingReminderDeletion,result:unknown){const checked=validateReminderResult(input.operation,result);if(input.operation.type==='reminder_snooze'&&!['scheduled','permission-denied','scheduling-failed'].includes(checked.status))throw Error('Invalid snooze outcome');if(input.operation.type==='reminder_complete'&&!['completed','scheduled','permission-denied','scheduling-failed'].includes(checked.status))throw Error('Invalid completion outcome');await change(input.operationId,input,null);}
export async function reconcileReminderDeletions(){
 const pending=await pendingReminderDeletions();
 for(const input of Object.values(pending))try{
  const receipt=await DailyApps.reminderOperationReceipt(input);
  if(receipt.status==='succeeded'&&receipt.result)await acknowledgeReminderDeletion(input,receipt.result);
 }catch{/* Keep unknown records; reconciliation never executes a mutation. */}
 return Object.keys(await pendingReminderDeletions()).length;
}
