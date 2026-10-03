import { validateReminderOperation, reminderFields, type ReminderOperation, type ReminderResult, type ReminderTarget } from '../runtime/reminder-contract';
import { BrowserFiles } from './files';
import { initialReminderDue, nextReminderOccurrence } from './reminder-recurrence';
import { WebPlugin } from '@capacitor/core';
import type { Reminder, ClockRequest } from '../daily';
import { editStore, readStore, revision } from './store';
type Row=Reminder & {revision:string};
type State={sourceRevision:string;reminders:Row[];receipts?:Record<string,{binding:string;result:ReminderResult}>};
const key='alpha.browser.reminders.v1',initial=():State=>({sourceRevision:revision(),reminders:[]});
function target(data:State,row:Row):ReminderTarget {return {sourceId:'browser-reminders',sourceRevision:data.sourceRevision,reminderId:row.id,occurrenceId:row.occurrenceId!,revision:row.revision};}
function operationBinding(input:{operationId:string;bindingHash:string},operation:ReminderOperation) {
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(input.operationId)||!/^[a-f0-9]{64}$/.test(input.bindingHash))throw Error('Invalid reminder operation binding.');
  return JSON.stringify([input.bindingHash,operation]);
}
function decide(row:Row,action:'done'|'snooze') {
  const now=Date.now();
  if(action==='snooze'){
    if(row.status==='scheduled'&&row.snoozedAt!==undefined)return 'unchanged';
    row.at=now+600000;row.snoozedAt=now;row.status='scheduled';
  } else {
    const next=row.recurrence?nextReminderOccurrence(row.recurrence,now):undefined;
    row.history=[...(row.history||[]),{occurrenceId:row.occurrenceId!,dueAt:row.dueAt||row.at,completedAt:now,skippedDates:next?.skippedDates||0}].slice(-32);
    if(next){row.recurrence!.date=next.date;row.dueAt=next.dueAt;row.at=next.at;row.occurrenceId=crypto.randomUUID();row.status='scheduled';delete row.completedAt;}
    else {row.status='completed';row.completedAt=now;}
    delete row.snoozedAt;delete row.postedAt;
  }
  row.revision=revision();return row.status;
}
export class BrowserDaily extends WebPlugin {
  constructor(private files:BrowserFiles){super();window.addEventListener('focus',()=>void this.notifyListeners('appResumed',{}));}
  async notifyReminder(id:string,occurrenceId:string){await this.notifyListeners('reminderOpened',{id,occurrenceId});}
  async surfaceInfo(){return {developmentBuild:true,assistant:false,topInset:0,bottomInset:0};}
  async closeAssistant(){window.dispatchEvent(new Event('alpha-back',{cancelable:true}));return {closed:true};}
  async scheduleReminder(input:{id:string;title:string;body?:string;at:number;recurrence?:Reminder['recurrence']}) {
    if(!Number.isSafeInteger(input.at)||input.at<=Date.now())return {status:'past',id:input.id,mode:'inexact'};
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(input.id))throw Error('Invalid reminder identity.');
    reminderFields({title:input.title,body:input.body||'',schedule:{at:input.at,recurrence:input.recurrence||null}});
    const dueAt=input.recurrence?initialReminderDue(input.recurrence,input.at):input.at;
    return editStore(key,initial,data=>{const previous=data.reminders.find(r=>r.id===input.id);data.reminders=data.reminders.filter(r=>r.id!==input.id);data.reminders.push({...input,body:input.body||'',mode:'inexact',createdAt:previous?.createdAt||Date.now(),status:'scheduled',occurrenceId:crypto.randomUUID(),dueAt,history:previous?.history||[],revision:revision()});return {status:'scheduled',id:input.id,mode:'inexact'};});
  }
  async listReminders(){return editStore(key,initial,data=>{for(const row of data.reminders)if(row.status==='scheduled'&&row.at<=Date.now()){row.status='posted';row.postedAt=Date.now();row.revision=revision();}return {reminders:data.reminders.filter(r=>r.status!=='cancelled').map(r=>({...r,target:{sourceId:'browser-reminders',sourceRevision:data.sourceRevision,reminderId:r.id,occurrenceId:r.occurrenceId!,revision:r.revision}})),notificationsEnabled:true};});}
  async cancelReminder(input:{id:string;target:ReminderTarget;operationId:string;bindingHash:string}){if(input.target?.reminderId!==input.id)throw Error('Reviewed reminder target required.');const response=await this.operateReminder({...input,operation:{type:'reminder_cancel',target:input.target}});return {status:response.status==='succeeded'?'cancelled':'unknown',id:input.id};}
  async selectedReminder(input:{id:string}):Promise<ReminderTarget>{const data=readStore(key,initial),row=data.reminders.find(r=>r.id===input.id);if(!row)throw Error('Reminder no longer exists.');return target(data,row);}
  async reminderOperationReceipt(input:{operationId:string;bindingHash:string;operation:ReminderOperation}) {
    const operation=validateReminderOperation(input.operation),binding=operationBinding(input,operation),receipt=readStore(key,initial).receipts?.[input.operationId];
    if(!receipt)return {status:'unknown'};if(receipt.binding!==binding)throw Error('Reminder receipt binding changed.');return {status:'succeeded',result:receipt.result};
  }
  async operateReminder(input:{operationId:string;bindingHash:string;operation:ReminderOperation}) {
    const operation=validateReminderOperation(input.operation),binding=operationBinding(input,operation);
    return editStore(key,initial,data=>{
      const receipt=data.receipts?.[input.operationId];if(receipt){if(receipt.binding!==binding)throw Error('Reminder receipt binding changed.');return {status:'succeeded',result:receipt.result};}
      if(document.hidden)throw Error('Return to Alpha to review the reminder.');
      const row=data.reminders.find(r=>r.id===operation.target.reminderId);
      if(!row||Object.entries(target(data,row)).some(([k,v])=>operation.target[k as keyof ReminderTarget]!==v))throw Error('Reminder changed. Review it again.');
      if(operation.type!=='reminder_read_selected'&&(row.status==='cancelled'||row.status==='completed'&&operation.type!=='reminder_cancel'&&operation.type!=='reminder_update'))throw Error('Reminder is no longer active.');
      if(operation.type==='reminder_update'){
        row.title=operation.fields.title;row.body=operation.fields.body;
        if(operation.fields.schedule){const schedule=operation.fields.schedule;if(schedule.at<=Date.now())throw Error('Choose a future reminder time.');row.at=schedule.at;row.recurrence=schedule.recurrence||undefined;row.dueAt=schedule.recurrence?initialReminderDue(schedule.recurrence,schedule.at):schedule.at;row.occurrenceId=crypto.randomUUID();row.status='scheduled';delete row.snoozedAt;delete row.postedAt;delete row.completedAt;}
        row.revision=revision();
      }else if(operation.type==='reminder_cancel'){row.status='cancelled';row.cancelledAt=Date.now();row.revision=revision();}
      else if(operation.type==='reminder_complete'||operation.type==='reminder_snooze')decide(row,operation.type==='reminder_complete'?'done':'snooze');
      const result:ReminderResult={version:1,kind:operation.type,sourceId:'browser-reminders',reminderId:row.id,occurrenceId:row.occurrenceId!,revision:row.revision,status:row.status,at:row.at};
      if(operation.type==='reminder_read_selected')result.fields={title:row.title,body:row.body,schedule:{at:row.at,recurrence:row.recurrence||null}};
      (data.receipts??={})[input.operationId]={binding,result};return {status:'succeeded',result};
    });
  }
  async reminderDecision(input:{id:string;occurrenceId:string;action:'done'|'snooze'}){return editStore(key,initial,data=>{
    if(!['done','snooze'].includes(input.action))throw Error('Invalid reminder decision.');
    const row=data.reminders.find(r=>r.id===input.id);if(!row||row.occurrenceId!==input.occurrenceId||['completed','cancelled'].includes(row.status))return {status:'stale'};
    return {status:decide(row,input.action)};
  });}
  async clockDecision(input:{id:string;revision:string;action:'cancel'|'dismiss'|'snooze';minutes?:number}){
    if(!['cancel','dismiss','snooze'].includes(input.action)||input.action==='snooze'&&(!Number.isInteger(input.minutes)||input.minutes!<1||input.minutes!>60))throw Error('Choose 1 to 60 snooze minutes.');
    return editStore(key,initial,data=>{const row=data.reminders.find(r=>r.id===input.id&&r.id.startsWith('alarm_'));if(!row||row.revision!==input.revision)return {status:'stale'};
      if(input.action==='cancel'){row.status='cancelled';row.cancelledAt=Date.now();row.revision=revision();}
      else if(row.status!=='posted')return {status:'stale'};
      else if(input.action==='dismiss')decide(row,'done');
      else{row.at=Date.now()+input.minutes!*60000;row.snoozedAt=Date.now();row.status='scheduled';delete row.postedAt;row.revision=revision();}
      return {status:'applied'};
    });
  }
  async clockHandoff(input:ClockRequest){
    if(input.reviewed!==true||!['set','show','dismiss','snooze'].includes(input.action))throw Error('Review the alarm action first.');
    if(input.action==='set'){
      if(!Number.isInteger(input.hour)||input.hour<0||input.hour>23||!Number.isInteger(input.minute)||input.minute<0||input.minute>59||typeof input.label!=='string'||input.label.length>200||input.label.includes('\0'))throw Error('Choose a valid alarm time and label.');
      const date=new Date();date.setHours(input.hour,input.minute,0,0);if(date.getTime()<=Date.now())date.setDate(date.getDate()+1);const saved=await this.scheduleReminder({id:'alarm_'+crypto.randomUUID(),title:input.label||'Alarm',at:date.getTime()});if(saved.status!=='scheduled')throw Error('The alarm time passed. Choose another time.');
    }else if(input.action==='show')window.dispatchEvent(new Event('alpha:clock-open'));
    else{
      if(input.action==='snooze'&&(!Number.isInteger(input.snoozeMinutes)||input.snoozeMinutes<1||input.snoozeMinutes>60))throw Error('Choose 1 to 60 snooze minutes.');
      await editStore(key,initial,data=>{for(const row of data.reminders.filter(r=>r.id.startsWith('alarm_')&&r.status==='posted')){if(input.action==='dismiss')decide(row,'done');else if(input.action==='snooze'){row.at=Date.now()+input.snoozeMinutes*60000;row.snoozedAt=Date.now();row.status='scheduled';delete row.postedAt;row.revision=revision();}}});
    }
    window.dispatchEvent(new Event('alpha:alarms-changed'));return {action:input.action,status:'opened',message:input.action==='set'?'Alarm saved.':input.action==='show'?'Alarms':input.action==='dismiss'?'Alarm dismissed.':'Alarm snoozed.'};
  }
  async capabilities(){return {platform:'web',actions:['calendar','reminder','browser','files','photos','maps','settings','notifications'].map(action=>({action,available:true,mode:'browser'}))};}
  pdfSelected(input:{selectionId:string;page:number}){return this.files.pdfSelected(input);}
  readSelected(input:{selectionId:string}){return this.files.readSelected(input);}
  openSelected(input:{selectionId:string}){return this.files.openSelected(input);}
  shareSelected(input:{selectionId:string}){return this.files.shareSelected(input);}
  renameSelected(input:{selectionId:string;name:string}){return this.files.renameSelected(input);}
  forgetSelected(input:{selectionId:string}){return this.files.forgetSelected(input);}
  restoreSelected(){return this.files.restoreSelected();}
  async perform(input:{action:string;url?:string}){if(input.action==='files'||input.action==='photos')return this.files.pick(input.action==='photos');if(input.action==='browser'&&input.url){const url=new URL(input.url);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('Enter an HTTP or HTTPS address.');window.open(url.href,'_blank','noopener,noreferrer');}else window.dispatchEvent(new CustomEvent('alpha:browser-open-view',{detail:input.action==='reminder'?'calendar':input.action}));return {status:'opened',action:input.action,message:''};}
}
