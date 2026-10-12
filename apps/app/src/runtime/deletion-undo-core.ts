import type {PendingReminderDeletion} from './reminder-deletions';
import type {Reminder} from '../daily';
import {
  commitDueDeletions,reconcileDeletions,requestDeletion,undoDeletion,pendingDeletions,undoRemaining,
  type DeletionProvider,type DeletionReport,type PendingDeletion,type PendingDeletionStore,type ReadbackOutcome,type CommitOutcome,type DeletionTarget,
} from './pending-deletions';
/** Platform-free wiring of the P-30 deletion policy; deletion-undo.ts binds it to the bridges. */
export type CalendarDeletionBridge={
  commitDeletion(input:{grant:string}):Promise<{status:string}>;
  revokeDeletion(input:{grant:string}):Promise<{status:string}>;
  deletionReadback(input:{id:string;calendarId:string;revision:string;scope:string;seriesId?:string;expected:unknown}):Promise<{status:string}>;
};
export type ReminderBridge={
  holdReminderDelivery(options:{id:string;holdId:string}):Promise<{status:string}>;
  releaseReminderDelivery(options:{id:string;holdId:string;redeliver:boolean}):Promise<{status:string}>;
  reminderDeliveryHolds():Promise<{holds:{id:string;reminderId:string}[]}>;
  operateReminder(input:PendingReminderDeletion):Promise<{status:string;result?:unknown}>;
  reminderOperationReceipt(input:PendingReminderDeletion):Promise<{status:string;result?:unknown}>;
  listReminders():Promise<{reminders:Pick<Reminder,'id'|'status'|'target'>[]}>;
};
export type ReminderJournal={pending():Promise<Record<string,PendingReminderDeletion>>;retain(input:PendingReminderDeletion):Promise<void>;acknowledge(input:PendingReminderDeletion,result:unknown):Promise<void>};

const commitStatuses:CommitOutcome[]=['deleted','conflict','permission-required','unavailable','unknown'];
const readbackStatuses:ReadbackOutcome[]=['absent','present','changed','permission-required','unavailable'];
async function bindingHash(value:unknown){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(v=>v.toString(16).padStart(2,'0')).join('');}
async function reminderInput(record:PendingDeletion):Promise<PendingReminderDeletion>{
  if(record.target.kind!=='reminder')throw Error('Not a reminder deletion');
  const operation={type:'reminder_cancel' as const,target:record.target.target};
  return {operationId:record.target.operationId,bindingHash:await bindingHash(operation),operation};
}

/** Provider effects for both builds: the Calendar bridge for events, the reminder engine for reminders. */
export function deletionProvider(calendar:CalendarDeletionBridge,reminders:ReminderBridge,journal:ReminderJournal):DeletionProvider{
  return {
    async commit(record){
      if(record.target.kind==='event'){const {status}=await calendar.commitDeletion({grant:record.target.grant});return commitStatuses.includes(status as CommitOutcome)?status as CommitOutcome:'unknown';}
      // The existing reminder action journal is written before dispatch, so an interrupted
      // cancellation is reconciled from its receipt and never dispatched a second time.
      const input=await reminderInput(record),retained=(await journal.pending())[input.operationId];
      if(!retained)await journal.retain(input);
      const result=retained?await reminders.reminderOperationReceipt(input):await reminders.operateReminder(input);
      if(result.status!=='succeeded'||!result.result)return retained?'unknown':result.status==='stale'||result.status==='conflict'?'conflict':'unknown';
      await journal.acknowledge(input,result.result);
      return 'deleted';
    },
    async readback(record){
      if(record.target.kind==='event'){
        const t=record.target,{status}=await calendar.deletionReadback({id:t.id,calendarId:t.calendarId,revision:t.revision,scope:t.scope,...(t.seriesId?{seriesId:t.seriesId}:{}),expected:t.expected});
        return readbackStatuses.includes(status as ReadbackOutcome)?status as ReadbackOutcome:'unavailable';
      }
      const input=await reminderInput(record);
      const receipt=await reminders.reminderOperationReceipt(input);
      if(receipt.status==='succeeded'&&receipt.result){await journal.acknowledge(input,receipt.result).catch(()=>undefined);return 'absent';}
      const target=record.target.target,row=(await reminders.listReminders()).reminders.find(row=>row.id===target.reminderId);
      if(!row||row.status==='cancelled')return 'absent';
      return row.target&&row.target.revision===target.revision&&row.target.occurrenceId===target.occurrenceId&&row.target.sourceRevision===target.sourceRevision?'present':'changed';
    },
    async hold(record){if(record.target.kind==='reminder')await reminders.holdReminderDelivery({id:record.target.target.reminderId,holdId:record.id});},
    async release(hold,redeliver){await reminders.releaseReminderDelivery({id:hold.reminderId,holdId:hold.id,redeliver});},
    async holds(){return (await reminders.reminderDeliveryHolds()).holds.map(({id,reminderId})=>({id,reminderId}));},
    async revoke(record){if(record.target.kind==='event')await calendar.revokeDeletion({grant:record.target.grant});},
  };
}

export type DeletionUndoListener=(event:{type:'changed'}|{type:'reports';reports:DeletionReport[]})=>void;

/**
 * One controller per renderer: it owns the expiry timer, runs reconciliation on start and resume,
 * and tells Calendar which targets to hide and which Undo is still available.
 */
/** Pause before another dispatch attempt after the provider reported it could not act yet. */
export const RETRY_LATER_MS=30_000;
type Clock={now():number;monotonic?():number;setTimeout(fn:()=>void,ms:number):unknown;clearTimeout(id:unknown):void};
const systemClock:Clock={now:()=>Date.now(),monotonic:()=>performance.now(),setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout:id=>clearTimeout(id as ReturnType<typeof setTimeout>)};
export function createDeletionUndo(store:PendingDeletionStore,provider:DeletionProvider,clock:Clock=systemClock){
  const listeners=new Set<DeletionUndoListener>();
  let records:PendingDeletion[]=[],timer:unknown,queue:Promise<unknown>=Promise.resolve();
  // Monotonic deadlines for windows observed by this process. A stalled or rewound wall clock
  // cannot keep a deletion pending longer than its window while the process stays alive.
  const deadlines=new Map<string,number>();
  const monotonic=()=>clock.monotonic?.();
  const elapsed=(record:PendingDeletion)=>{const at=deadlines.get(record.id),now=monotonic();return at!==undefined&&now!==undefined&&now>=at;};
  const observe=()=>{const now=monotonic();if(now===undefined)return;const live=new Set(records.map(r=>r.id));for(const id of deadlines.keys())if(!live.has(id))deadlines.delete(id);for(const record of records)if(record.phase==='pending'&&!deadlines.has(record.id))deadlines.set(record.id,now+undoRemaining(record,clock.now()));};
  const emit=(event:Parameters<DeletionUndoListener>[0])=>{for(const listener of [...listeners])try{listener(event);}catch{/* A view error must not stop deletion bookkeeping. */}};
  const serial=<T>(work:()=>Promise<T>):Promise<T>=>{const result=queue.then(work,work);queue=result.catch(()=>undefined);return result;};
  async function refresh(){records=await pendingDeletions(store);observe();emit({type:'changed'});arm();}
  function arm(){
    if(timer!==undefined)clock.clearTimeout(timer);timer=undefined;
    const now=clock.now(),mono=monotonic(),waiting=records.filter(row=>row.phase==='pending').map(row=>{const wall=undoRemaining(row,now),at=deadlines.get(row.id);const due=at!==undefined&&mono!==undefined?Math.min(wall,Math.max(0,at-mono)):wall;return Math.max(due,(retryAt.get(row.id)??0)-now);});
    if(!waiting.length)return;
    timer=clock.setTimeout(()=>{timer=undefined;void controller.commitDue();},Math.max(0,Math.min(...waiting))+50);
  }
  // A provider that cannot act yet (locked, not foreground) is retried after a pause, not in a loop.
  const retryAt=new Map<string,number>();
  const done=async(reports:DeletionReport[])=>{for(const report of reports)if(report.status==='retry-later')retryAt.set(report.id,clock.now()+RETRY_LATER_MS);else retryAt.delete(report.id);await refresh();if(reports.length)emit({type:'reports',reports});return reports;};
  const controller={
    subscribe(listener:DeletionUndoListener){listeners.add(listener);return ()=>{listeners.delete(listener);};},
    records:()=>records,
    remaining:(id:string)=>{const row=records.find(row=>row.id===id);if(!row)return 0;const wall=undoRemaining(row,clock.now()),at=deadlines.get(id),mono=monotonic();return at!==undefined&&mono!==undefined?Math.min(wall,Math.max(0,Math.round(at-mono))):wall;},
    request:(input:{label:string;target:DeletionTarget})=>serial(async()=>{const result=await requestDeletion(store,provider,{id:crypto.randomUUID(),...input},clock.now());await refresh();return result;}),
    undo:(id:string)=>serial(async()=>{const row=records.find(r=>r.id===id),now=row&&elapsed(row)?Math.max(clock.now(),row.expiresAt):clock.now();const result=await undoDeletion(store,provider,id,now);await refresh();return result;}),
    commitDue:()=>serial(async()=>done(await commitDueDeletions(store,provider,clock.now(),elapsed))),
    reconcile:()=>serial(async()=>{if(!records.length){records=await pendingDeletions(store);observe();}return done(await reconcileDeletions(store,provider,clock.now(),elapsed));}),
  };
  return controller;
}
export type DeletionUndo=ReturnType<typeof createDeletionUndo>;

