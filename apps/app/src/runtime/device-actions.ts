import {isClockOperation,validateClockOperation,validateClockResult,assertClockTimeZone,describeClockHandoff,type ClockOperation,type ClockHandoffResult} from './clock-contract.ts';
import { isMapsOperation, validateMapsOperation, validateMapsResult, type MapsOperation, type MapsResult } from './maps-contract';
import { validateMapsSelectedObject } from '../maps/agent-context';
import {type ReminderOperation,type ReminderResult,isReminderOperation,validateReminderOperation,validateReminderResult} from './reminder-contract';
import {type NotesOperation,type NotesResult,isNotesOperation,validateNotesOperation,validateNotesResult} from './notes-contract';
import {type CalendarOperation,type CalendarResult,isCalendarOperation,validateCalendarOperation,validateCalendarResult} from './calendar-contract';
import { isMvpView } from "../prototype/mvp-features";
import { parseWorkflowBinding, parseWorkflowRead, validateWorkflowResult, assertWorkflowOperation, type WorkflowReadOperation, type WorkflowReadResult, type WorkflowDeviceBinding, type WorkflowPhoneReview } from './workflow-device-contract';
import type { ActionProposal, ContextEnvelope, OperationReceipt, VerifiedSession } from './alpha-client';

export type WorkflowPresentationOperation = {type:'post_notification';title:string;body:string}|{type:'speak_text';text:string};
export type DeviceOperation = WorkflowPresentationOperation | ClockOperation | MapsOperation | ReminderOperation | NotesOperation | CalendarOperation | WorkflowReadOperation | { type: 'create_note'; title: string; body: string }
  | { type: 'create_reminder'; title: string; dueAt: string }
  | { type: 'open_view'; view: string } | { type: 'browser_navigate'; url: string };
export interface DeviceCredential { installationId: string; key: string; enrollmentId?: string }
export interface JournalEntry {
  scope: string; proposalId: string; operationId: string; operationHash: string;
  record: Record<string, unknown>; phase: 'reserved' | 'applying' | 'terminal'; attemptId?: string;
  status?: 'succeeded' | 'failed' | 'unknown' | 'cancelled'; summary?: string; result?: Record<string, unknown>;
}
export interface ActionJournal {
  reserve(input: Omit<JournalEntry, 'phase'>): Promise<{ created: boolean; entry: JournalEntry }>;
  markApplying(input: { scope: string; proposalId: string; attemptId: string }): Promise<unknown>;
  finish(input: { scope: string; proposalId: string; status: NonNullable<JournalEntry['status']>; summary: string; result?: Record<string, unknown> }): Promise<unknown>;
  recoverReminder?(input:{scope:string;proposalId:string;bindingHash:string}):Promise<{entry:JournalEntry|null}>;
  get(input: { scope: string; proposalId: string }): Promise<{ entry: JournalEntry | null }>;
  list(input: { scope: string }): Promise<{ entries: JournalEntry[] }>;
}
export type DeviceExecutor = (operation: DeviceOperation, operationId: string, context: ContextEnvelope, signal: AbortSignal, bindingHash: string) => Promise<{ status: 'succeeded' | 'failed' | 'unknown'; summary: string; readResult?: WorkflowReadResult; calendarResult?:CalendarResult; notesResult?:NotesResult; reminderResult?:ReminderResult; mapsResult?:MapsResult;clockResult?:ClockHandoffResult }>;
export type DeviceRecovery = (operation:DeviceOperation,operationId:string,bindingHash:string,signal:AbortSignal)=>Promise<{status:string;reminderResult?:ReminderResult}>;
interface Proposal { id: string; digest: string; state: string; expiresAt: number; operation: DeviceOperation; workflow?:WorkflowDeviceBinding; attemptId?: string }
const views = new Set(['home','notes','reminders','browser','calendar','files','photos','camera','maps','inbox','settings','workflows']);
function object(value: unknown): Record<string, any> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid device action response'); return value as Record<string, any>; }
function text(value: unknown, max = 128): string { if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) throw new Error('Invalid device action field'); return value; }
function id(value: unknown): string { const valueText = text(value); if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(valueText)) throw new Error('Invalid device action identifier'); return valueText; }
export function validateDeviceOperation(value: unknown): DeviceOperation {
  const p = object(value);
  if(isClockOperation(p))return validateClockOperation(p);
  if(isMapsOperation(p))return validateMapsOperation(p);
  if(isReminderOperation(p))return validateReminderOperation(p);
  if(isNotesOperation(p))return validateNotesOperation(p);
  if(isCalendarOperation(p))return validateCalendarOperation(p);
  if(p.type==='read_selected_notes'||p.type==='read_calendar_range')return parseWorkflowRead(p);
  if(p.type==='post_notification'){if(Object.keys(p).some(k=>!['type','title','body'].includes(k)))throw Error('Invalid notification fields');return {type:p.type,title:text(p.title,200),body:text(p.body,2000)};}
  if(p.type==='speak_text'){if(Object.keys(p).some(k=>!['type','text'].includes(k)))throw Error('Invalid speech fields');return {type:p.type,text:text(p.text,5000)};}
  if (p.type === 'create_note') {
    if (typeof p.body !== 'string' || p.body.length > 32000 || p.body.includes('\0')) throw new Error('Invalid note');
    return { type: p.type, title: text(p.title, 256), body: p.body };
  }
  if (p.type === 'create_reminder') {
    const dueAt = text(p.dueAt, 40), time = Date.parse(dueAt);
    if (!Number.isFinite(time) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(dueAt) || new Date(time).toISOString().replace('.000Z','Z') !== dueAt.replace('.000Z','Z')) throw new Error('Invalid reminder time');
    return { type: p.type, title: text(p.title, 200), dueAt };
  }
  if (p.type === 'open_view' && views.has(p.view) && (p.view==='home'||p.view==='reminders'||isMvpView(p.view))) return { type: p.type, view: p.view };
  if (p.type === 'browser_navigate') { const url = new URL(text(p.url, 4096)); if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid browser destination'); return { type: p.type, url: url.href }; }
  throw new Error('Unsupported device operation');
}
function contextKey(value: ContextEnvelope): string {
  const selected = value.selectedObject;
  return JSON.stringify([value.view, value.sensitive === true, value.revision, value.timeZone ?? null, selected ? [selected.kind, selected.id, selected.revision ?? null, selected.accountId ?? null,selected.sourceRevision??null,selected.occurrenceId??null] : null]);
}
function assertCalendarContext(operation:CalendarOperation,context:ContextEnvelope){
 const selected=context.selectedObject;
 if(context.view!=='calendar'||context.sensitive||!selected)throw Error('Open the selected calendar source or event');
 if(operation.type==='calendar_create'){
  if(selected.kind!=='calendar-source'||selected.id!==operation.source.sourceId||selected.revision!==operation.source.sourceRevision)throw Error('Calendar source changed');
 }else if(selected.kind!=='calendar-event'||selected.id!==operation.target.eventId||selected.revision!==operation.target.revision||selected.accountId!==operation.target.sourceId||selected.sourceRevision!==operation.target.sourceRevision)throw Error('Selected calendar event changed');
}
function assertMapsContext(operation:MapsOperation,context:ContextEnvelope){const selected=context.selectedObject,t=operation.target;if(context.sensitive||context.view!=='maps'||!selected||selected.kind!==t.kind||selected.id!==t.id||selected.revision!==t.revision||!validateMapsSelectedObject(t))throw Error('Selected Maps context changed');}
function assertReminderContext(operation:ReminderOperation,context:ContextEnvelope){const s=context.selectedObject,t=operation.target;if(context.sensitive||context.view!=='calendar'||!s||s.kind!=='reminder'||s.id!==t.reminderId||s.revision!==t.revision||s.accountId!==t.sourceId||s.sourceRevision!==t.sourceRevision||s.occurrenceId!==t.occurrenceId||s.timingVersion!==t.timingVersion)throw Error('Selected reminder context changed');}
function assertNotesContext(operation:NotesOperation,context:ContextEnvelope){const s=context.selectedObject,t=operation.target;if(context.sensitive||context.view!=='notes'||!s||s.kind!=='note'||s.id!==t.noteId||s.revision!==t.revision||s.accountId!==t.sourceId||s.sourceRevision!==t.sourceRevision)throw Error('Selected note context changed');}
export async function actionScope(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
/** Authenticated structured actions only. Neither reply prose nor restored history
 * can enter this boundary. A durable journal gates every device effect. */
export class DeviceActions {
  private proposals = new Map<string, { proposal: Proposal; context: ContextEnvelope; workflowReview?:WorkflowPhoneReview }>();
  private busy = false;
  constructor(readonly session: VerifiedSession, readonly credential: DeviceCredential, readonly scope: string,
    private request: (path: string, body: unknown | undefined, signal: AbortSignal) => Promise<unknown>,
    private journal: ActionJournal, private execute: DeviceExecutor, private recover?:DeviceRecovery, private reminderV2=false) {}
  private parse(value: unknown): Proposal {
    const p = object(value), payload = object(p.payload);
    if (p.subjectUserId !== this.session.ownerId || p.requestedBy !== this.session.agentId || p.action !== 'device_action' || payload.action !== 'device_action' || payload.version !== 1 || payload.installationId !== this.credential.installationId || payload.enrollmentId !== this.credential.enrollmentId) throw new Error('Device action belongs to another identity');
    const expiresAt = Date.parse(text(p.expiresAt, 40)), digest = text(p.digest, 64);
    if (!Number.isFinite(expiresAt) || !/^[a-f0-9]{64}$/.test(digest)) throw new Error('Invalid action expiry or digest');
    const workflow=payload.workflow===undefined?undefined:parseWorkflowBinding(payload.workflow),op=validateDeviceOperation(payload.operation);
    if(isReminderOperation(op)&&(op.target.timingVersion===2||op.type==='reminder_update'&&op.fields.schedule?.alertMinutes!==undefined)&&!this.reminderV2)throw Error('This agent does not support this reminder timing. Reconnect to a compatible agent.');
    if((['read_selected_notes','read_calendar_range','post_notification','speak_text'].includes(op.type))&&!workflow)throw new Error('Workflow binding required for phone reads');
    return { id: id(p.id), digest, state: text(p.state, 32), expiresAt, operation:op,...(workflow?{workflow}:{}), ...(p.execution?.attemptId ? { attemptId: id(p.execution.attemptId) } : {}) };
  }
  async list(signal: AbortSignal): Promise<Proposal[]> {
    const response = object(await this.request('/api/client-devices/proposals', undefined, signal));
    if (!Array.isArray(response.proposals)) throw new Error('Invalid device action list');
    return response.proposals.map(value => this.parse(value));
  }
  async pending(context: ContextEnvelope, signal: AbortSignal): Promise<ActionProposal[]> {
    const pending = (await this.list(signal)).filter(p => {
      if (p.workflow || p.state !== 'pending' || p.expiresAt <= Date.now()) return false;
      if(isClockOperation(p.operation)){try{assertClockTimeZone(p.operation,context.timeZone);}catch{return false;}}
      if (isMapsOperation(p.operation)) {try {assertMapsContext(p.operation,context);}catch{return false;}}
      if (isReminderOperation(p.operation)) {try {assertReminderContext(p.operation,context);}catch{return false;}}
      if (isNotesOperation(p.operation)) {try {assertNotesContext(p.operation,context);}catch{return false;}}
      if (isCalendarOperation(p.operation)) { try { assertCalendarContext(p.operation, context); } catch { return false; } }
      return true;
    });
    signal.throwIfAborted(); this.proposals.clear();
    return pending.map(proposal => {
      if(isClockOperation(proposal.operation))assertClockTimeZone(proposal.operation,context.timeZone);
      if(isMapsOperation(proposal.operation))assertMapsContext(proposal.operation,context);
      if(isReminderOperation(proposal.operation))assertReminderContext(proposal.operation,context);
      if(isNotesOperation(proposal.operation))assertNotesContext(proposal.operation,context);
      if(isCalendarOperation(proposal.operation))assertCalendarContext(proposal.operation,context);
      this.proposals.set(proposal.id, { proposal, context: structuredClone(context) });
      const op = proposal.operation;
      const description = isClockOperation(op) ? describeClockHandoff(op) : isMapsOperation(op) ? 'Send the exact selected place location or route endpoints, mode and distance to the connected agent. This shares location information. It does not start navigation.' : isReminderOperation(op) ? `${op.type.replaceAll('_',' ')} · selected reminder ${op.target.reminderId}\n${op.type==='reminder_update'?JSON.stringify(op.fields):op.type==='reminder_read_selected'?'Send this exact reminder title, details and schedule to the connected agent.':op.type==='reminder_cancel'?'Cancel this reminder and all its future repeats.':op.type==='reminder_snooze'?'Snooze this occurrence for ten minutes.':'Complete this occurrence; a repeat advances to its next future occurrence.'}` : isNotesOperation(op) ? `${op.type.replaceAll('_',' ')} · selected note ${op.target.noteId}\n${op.type==='notes_update'?JSON.stringify(op.fields):op.type==='notes_read_selected'?'Send this exact note title and body to the connected agent.':'Delete this exact note. Attached audio files are retained.'}` : isCalendarOperation(op) ? `${op.type.replaceAll('_',' ')} · source ${(op.type==='calendar_create'?op.source:op.target).sourceId}\n${'fields' in op?JSON.stringify(op.fields):'Review the exact selected event on this phone.'}` : op.type === 'create_note' ? `Create note “${op.title}”\n${op.body}` : op.type === 'create_reminder' ? `Create reminder “${op.title}” at ${new Date(op.dueAt).toLocaleString()}` : op.type === 'open_view' ? `Open ${op.view} on this phone` : op.type==='browser_navigate'?`Open browser destination ${op.url}`:'Workflow phone read';
      return { id: proposal.id, title: op.type.replaceAll('_', ' '), description, expiresAt: proposal.expiresAt, contextRevision: context.revision };
    });
  }
  async pendingForWorkflow(review:WorkflowPhoneReview,context:ContextEnvelope,signal:AbortSignal):Promise<ActionProposal[]> {
    if(context.view!=='workflows'||context.sensitive||context.selectedObject?.kind!=='workflow-run'||context.selectedObject.id!==review.runId||context.selectedObject.revision!==review.versionId)throw new Error('Open this exact workflow execution before reviewing phone steps');
    const pending=(await this.list(signal)).filter(p=>p.workflow?.runId===review.runId&&p.state==='pending'&&p.expiresAt>Date.now());signal.throwIfAborted();this.proposals.clear();
    return pending.map(p=>{assertWorkflowOperation(review,p.workflow!,{installationId:this.credential.installationId,enrollmentId:this.credential.enrollmentId!},p.operation);this.proposals.set(p.id,{proposal:p,context:structuredClone(context),workflowReview:structuredClone(review)});
      const op=p.operation;const scope=op.type==='read_selected_notes'?`Read only ${op.notes.length} selected Notes at the recorded revisions. Text and titles will be sent to this agent.\nSelected IDs: ${op.notes.map(n=>n.id).join(', ')}`:op.type==='read_calendar_range'?`Read calendars ${op.calendarIds.join(', ')} from ${op.start} up to (excluding) ${op.end}, shown in ${op.timeZone}. At most ${op.maximumEvents} events; overflow fails. Event titles, times and IDs will be sent; descriptions, locations and attendees are excluded.`:op.type==='create_note'?`Save one note “${op.title}” on this phone:\n${op.body}`:op.type==='post_notification'?`Post this notification in the browser Inbox: ${op.title}\n${op.body}`:op.type==='speak_text'?`Read this exact text aloud on this device:\n${op.text}`:'Unsupported phone step';
      return {id:p.id,title:op.type.replaceAll('_',' '),reviewScope:`${scope}\nAgent: ${this.session.origin}`,reviewIdentity:`Owner: ${this.session.ownerId}\nWorkflow: ${p.workflow!.workflowId}\nRun: ${p.workflow!.runId}\nVersion: ${p.workflow!.versionId}\nStep: ${p.workflow!.stepId}\nSpec: ${p.workflow!.specDigest}`,description:`Agent: ${this.session.origin}\nOwner: ${this.session.ownerId}\nWorkflow: ${p.workflow!.workflowId}\nRun: ${p.workflow!.runId}\nVersion: ${p.workflow!.versionId}\nStep: ${p.workflow!.stepId}\nSpec: ${p.workflow!.specDigest}\n${scope}`,expiresAt:p.expiresAt,contextRevision:context.revision};});
  }
  private async mutation(p: Proposal, suffix: string, body: Record<string, unknown>, signal: AbortSignal): Promise<Proposal> {
    if(isMapsOperation(p.operation)&&(suffix==='receipt'||suffix==='reconciliation')&&!validateMapsSelectedObject(p.operation.target))throw Error('Maps selection changed before upload');
    const response = object(await this.request(`/api/client-devices/proposals/${p.id}/${suffix}`, { digest: p.digest, ...body }, signal));
    const result = this.parse({ ...object(response.proposal), digest: response.digest });
    if (result.id !== p.id || result.digest !== p.digest) throw new Error('Device action changed during review');
    return result;
  }
  async approve(proposalId: string, context: ContextEnvelope, signal: AbortSignal): Promise<OperationReceipt> {
    if (this.busy) throw new Error('Another device action is being reviewed');
    const reviewed = this.proposals.get(proposalId);
    if (!reviewed || contextKey(reviewed.context) !== contextKey(context) || context.sensitive || reviewed.proposal.expiresAt <= Date.now()) throw new Error('Review this action again from the current screen');
    if(isClockOperation(reviewed.proposal.operation))assertClockTimeZone(reviewed.proposal.operation,context.timeZone);
    this.busy = true; this.proposals.delete(proposalId);
    const p = reviewed.proposal, operationId = crypto.randomUUID();
    try {
      if(p.workflow){if(!reviewed.workflowReview)throw new Error('Workflow step must be reviewed from its execution');assertWorkflowOperation(reviewed.workflowReview,p.workflow,{installationId:this.credential.installationId,enrollmentId:this.credential.enrollmentId!},p.operation);}
      signal.throwIfAborted();
      if(isClockOperation(p.operation))assertClockTimeZone(p.operation,context.timeZone);
      if(isMapsOperation(p.operation))assertMapsContext(p.operation,context);
      if(isReminderOperation(p.operation))assertReminderContext(p.operation,context);
      if(isNotesOperation(p.operation))assertNotesContext(p.operation,context);
      if(isCalendarOperation(p.operation))assertCalendarContext(p.operation,context);
      const reserved = await this.journal.reserve({ scope: this.scope, proposalId, operationId, operationHash: await actionScope(JSON.stringify(p.operation)), record: { digest: p.digest, operation: p.operation, context, expiresAt: p.expiresAt, installationId: this.credential.installationId, enrollmentId: this.credential.enrollmentId, sessionId:this.session.sessionId,ownerId:this.session.ownerId,agentId:this.session.agentId,origin:this.session.origin,...(p.workflow?{workflow:p.workflow}:{}) } });
      if (!reserved.created) return { proposalId, status: 'unknown', summary: 'This action already has a device journal entry. Review action history; it was not repeated.' };
      signal.throwIfAborted();
      await this.mutation(p, 'decision', { decision: 'approve' }, signal);
      const claimed = await this.mutation(p, 'claim', {}, signal);
      if (!claimed.attemptId || claimed.state !== 'executing') throw new Error('The server did not grant an execution claim');
      signal.throwIfAborted();
      await this.journal.markApplying({ scope: this.scope, proposalId, attemptId: claimed.attemptId });
      let result: Awaited<ReturnType<DeviceExecutor>>;
      try { signal.throwIfAborted(); if (p.expiresAt <= Date.now()) throw new Error('Expired action'); result = await this.execute(p.operation, operationId, context, signal, await actionScope(JSON.stringify([this.scope,this.session.ownerId,this.session.agentId,this.session.sessionId,this.session.origin,this.credential.installationId,this.credential.enrollmentId,p.id,p.digest,operationId]))); }
      catch { result = { status: 'unknown', summary: 'Action outcome needs review. It will not be repeated automatically.' }; }
      let clockResult:ClockHandoffResult|undefined;
      if(isClockOperation(p.operation)){
        if(result.clockResult!==undefined){clockResult=validateClockResult(p.operation,result.clockResult);const expected=clockResult.status==='opened'?'succeeded':clockResult.status==='unknown'?'unknown':'failed';if(result.status!==expected)throw Error('Clock handoff outcome mismatch');}
        else if(result.status==='succeeded')throw Error('Missing Clock handoff result');
      }else if(result.clockResult!==undefined)throw Error('Unexpected Clock handoff result');
      let mapsResult:MapsResult|undefined;
      if(isMapsOperation(p.operation)){if(result.status==='succeeded')mapsResult=validateMapsResult(p.operation,result.mapsResult);else if(result.mapsResult!==undefined)throw Error('Failed Maps read cannot return content');}else if(result.mapsResult!==undefined)throw Error('Unexpected Maps result');
      let reminderResult:ReminderResult|undefined;
      if(isReminderOperation(p.operation)){if(result.status==='succeeded')reminderResult=validateReminderResult(p.operation,result.reminderResult);else if(result.reminderResult!==undefined)throw Error('Unconfirmed reminder cannot return a result');}else if(result.reminderResult!==undefined)throw Error('Unexpected reminder result');
      let notesResult:NotesResult|undefined;
      if(isReminderOperation(p.operation))assertReminderContext(p.operation,context);
      if(isNotesOperation(p.operation)){if(result.status==='succeeded')notesResult=validateNotesResult(p.operation,result.notesResult);else if(result.notesResult!==undefined)throw Error('Failed Notes action cannot return content');}else if(result.notesResult!==undefined)throw Error('Unexpected Notes result');
      let calendarResult:CalendarResult|undefined;
      if(isCalendarOperation(p.operation)){if(result.status==='succeeded')calendarResult=validateCalendarResult(p.operation,result.calendarResult);else if(result.calendarResult!==undefined)throw Error('Failed Calendar action cannot return content');}else if(result.calendarResult!==undefined)throw Error('Unexpected Calendar result');
      let readResult:WorkflowReadResult|undefined;
      if(p.operation.type==='read_selected_notes'||p.operation.type==='read_calendar_range'){
        if(result.status==='succeeded')readResult=await validateWorkflowResult(p.operation,result.readResult);
        else if(result.readResult!==undefined)throw new Error('Failed read cannot return content');
      }else if(result.readResult!==undefined)throw new Error('Unexpected read content');
      await this.journal.finish({ scope: this.scope, proposalId, status:result.status, summary:result.summary, result: { operationId,...(clockResult?{clockResult}:{}),...(mapsResult?{mapsResult}:{}),...(readResult?{readResult}:{}),...(calendarResult?{calendarResult}:{}),...(notesResult?{notesResult}:{}),...(reminderResult?{reminderResult}:{}) } });
      // A completed device effect is journaled even if the UI epoch was cancelled.
      // Receipt upload is retried only by the explicit history control.
      try { if(isMapsOperation(p.operation))assertMapsContext(p.operation,context); await this.mutation(p, 'receipt', { attemptId: claimed.attemptId, receipt: { outcome: result.status === 'succeeded' ? 'applied' : result.status === 'failed' ? 'failed' : 'unknown', operationId,...(clockResult?{result:clockResult}:mapsResult?{result:mapsResult}:readResult?{result:readResult}:calendarResult?{result:calendarResult}:notesResult?{result:notesResult}:reminderResult?{result:reminderResult}:{}) } }, signal); }
      catch { return { proposalId, status: result.status, summary: `${result.summary} Server receipt is pending; check action history.` }; }
      finally {if(typeof window!=='undefined'){if(isCalendarOperation(p.operation)&&p.operation.type!=='calendar_read_selected'&&result.status==='succeeded')window.dispatchEvent(new CustomEvent('alpha:calendar-committed'));if(isNotesOperation(p.operation))window.dispatchEvent(new CustomEvent('alpha:notes-committed'));if(isReminderOperation(p.operation)||p.operation.type==='create_reminder')window.dispatchEvent(new CustomEvent('alpha:reminders-committed'));}}
      return { proposalId, status:result.status, summary:result.summary };
    } catch {
      return { proposalId, status: 'unknown', summary: 'Action did not reach a confirmed result. Check action history before requesting it again.' };
    } finally { this.busy = false; }
  }
  async reject(proposalId: string, signal: AbortSignal): Promise<void> {
    const p = (await this.list(signal)).find(item => item.id === proposalId);
    if (!p || p.state !== 'pending') throw new Error('This proposal can no longer be rejected');
    await this.mutation(p, 'decision', { decision: 'reject' }, signal);
    this.proposals.delete(proposalId);
  }
  async history(signal: AbortSignal) {
    const proposals = await this.list(signal), local = await this.journal.list({ scope: this.scope });
    return proposals.map(p => ({ id: p.id, state: p.state, operation: p.operation, local: local.entries.find(entry => entry.proposalId === p.id) }));
  }
  private async recoverReminder(p:Proposal,entry:JournalEntry,signal:AbortSignal):Promise<JournalEntry>{
    if(!this.recover||!isReminderOperation(p.operation)||entry.status==='succeeded'||!entry.attemptId||entry.record.digest!==p.digest||entry.record.ownerId!==this.session.ownerId||entry.record.agentId!==this.session.agentId||entry.record.origin!==this.session.origin||entry.record.installationId!==this.credential.installationId||entry.record.enrollmentId!==this.credential.enrollmentId||typeof entry.record.sessionId!=='string')return entry;
    const bindingHash=await actionScope(JSON.stringify([this.scope,this.session.ownerId,this.session.agentId,entry.record.sessionId,this.session.origin,this.credential.installationId,this.credential.enrollmentId,p.id,p.digest,entry.operationId]));
    signal.throwIfAborted();const result=await this.recover(p.operation,entry.operationId,bindingHash,signal);signal.throwIfAborted();
    if(result.status!=='succeeded')return entry;
    validateReminderResult(p.operation,result.reminderResult);
    if(!this.journal.recoverReminder)return entry;
    const recovered=await this.journal.recoverReminder({scope:this.scope,proposalId:p.id,bindingHash});
    if(recovered.entry?.status==='succeeded')validateReminderResult(p.operation,recovered.entry.result?.reminderResult);
    return recovered.entry ?? entry;
  }
  async syncReceipts(signal: AbortSignal, workflow?:{runId:string;versionId:string;specDigest:string}): Promise<void> {
    const proposals = await this.list(signal), local = await this.journal.list({ scope: this.scope });
    for (let entry of local.entries) {
      signal.throwIfAborted();
      const p = proposals.find(item => item.id === entry.proposalId);
      if(p)entry=await this.recoverReminder(p,entry,signal);
      if (!p || entry.phase !== 'terminal' || !entry.attemptId || entry.record.digest !== p.digest || !entry.status) continue;
      if(p.workflow&&(!workflow||p.workflow.runId!==workflow.runId||p.workflow.versionId!==workflow.versionId||p.workflow.specDigest!==workflow.specDigest))continue;
      const clockResult=await this.savedClockResult(p,entry);
      const mapsResult=await this.savedMapsResult(p,entry);
      const readResult=await this.savedReadResult(p,entry);
      const calendarResult=await this.savedCalendarResult(p,entry);
      const notesResult=await this.savedNotesResult(p,entry);
      const reminderResult=await this.savedReminderResult(p,entry);
      if(isReminderOperation(p.operation)&&p.state==='reconciliation_required'&&entry.status==='succeeded'&&reminderResult){
        await this.mutation(p,'reconciliation',{attemptId:entry.attemptId,resolution:{confirmed:true,outcome:'applied',operationId:entry.operationId,result:reminderResult}},signal);
      }else await this.mutation(p, 'receipt', { attemptId: entry.attemptId, receipt: { outcome: entry.status === 'succeeded' ? 'applied' : entry.status === 'failed' ? 'failed' : 'unknown', operationId: entry.operationId,...(clockResult?{result:clockResult}:mapsResult?{result:mapsResult}:readResult?{result:readResult}:calendarResult?{result:calendarResult}:notesResult?{result:notesResult}:reminderResult?{result:reminderResult}:{}) } }, signal);
    }
  }
  private async savedClockResult(p:Proposal,summary:JournalEntry):Promise<ClockHandoffResult|undefined>{
    if(!isClockOperation(p.operation))return undefined;
    const {entry}=await this.journal.get({scope:this.scope,proposalId:p.id});
    if(!entry||entry.phase!=='terminal'||entry.operationId!==summary.operationId||entry.record.digest!==p.digest||entry.record.ownerId!==this.session.ownerId||entry.record.agentId!==this.session.agentId||entry.record.origin!==this.session.origin||entry.record.installationId!==this.credential.installationId||entry.record.enrollmentId!==this.credential.enrollmentId)throw Error('No exact saved Clock receipt; handoff will not be repeated');
    if(entry.result?.clockResult===undefined){if(entry.status==='succeeded')throw Error('Missing Clock receipt');return undefined;}
    const result=validateClockResult(p.operation,entry.result.clockResult);const status=result.status==='opened'?'succeeded':result.status==='unknown'?'unknown':'failed';if(entry.status!==status)throw Error('Saved Clock outcome mismatch');return result;
  }
  private async savedMapsResult(p:Proposal,summary:JournalEntry):Promise<MapsResult|undefined>{
    if(!isMapsOperation(p.operation)||summary.status!=='succeeded')return undefined;
    const {entry}=await this.journal.get({scope:this.scope,proposalId:p.id});
    if(!entry||entry.phase!=='terminal'||entry.status!=='succeeded'||entry.operationId!==summary.operationId||entry.record.digest!==p.digest||entry.record.ownerId!==this.session.ownerId||entry.record.agentId!==this.session.agentId||entry.record.origin!==this.session.origin||entry.record.installationId!==this.credential.installationId||entry.record.enrollmentId!==this.credential.enrollmentId||entry.record.sessionId!==this.session.sessionId)throw Error('No exact saved Maps receipt; the selection will not be read again');
    // Replay only the already approved snapshot while its current capability is
    // still valid. Reload/leave does not authorize a fresh read or late upload.
    assertMapsContext(p.operation,entry.record.context as ContextEnvelope);
    return validateMapsResult(p.operation,entry.result?.mapsResult);
  }
  private async savedCalendarResult(p:Proposal,summary:JournalEntry):Promise<CalendarResult|undefined>{
    if(!isCalendarOperation(p.operation)||summary.status!=='succeeded')return undefined;
    const {entry}=await this.journal.get({scope:this.scope,proposalId:p.id});
    if(!entry||entry.phase!=='terminal'||entry.status!=='succeeded'||entry.operationId!==summary.operationId||entry.record.digest!==p.digest||entry.record.ownerId!==this.session.ownerId||entry.record.agentId!==this.session.agentId||entry.record.origin!==this.session.origin)throw Error('No exact saved Calendar receipt; operation will not be repeated');
    return validateCalendarResult(p.operation,entry.result?.calendarResult);
  }
  private async savedReminderResult(p:Proposal,summary:JournalEntry):Promise<ReminderResult|undefined>{
    if(!isReminderOperation(p.operation)||summary.status!=='succeeded')return undefined;
    const {entry}=await this.journal.get({scope:this.scope,proposalId:p.id});
    if(!entry||entry.phase!=='terminal'||entry.status!=='succeeded'||entry.operationId!==summary.operationId||entry.record.digest!==p.digest||entry.record.ownerId!==this.session.ownerId||entry.record.agentId!==this.session.agentId||entry.record.origin!==this.session.origin)throw Error('No exact saved Reminder receipt; operation will not be repeated');
    return validateReminderResult(p.operation,entry.result?.reminderResult);
  }
  private async savedNotesResult(p:Proposal,summary:JournalEntry):Promise<NotesResult|undefined>{
    if(!isNotesOperation(p.operation)||summary.status!=='succeeded')return undefined;
    const {entry}=await this.journal.get({scope:this.scope,proposalId:p.id});
    if(!entry||entry.phase!=='terminal'||entry.status!=='succeeded'||entry.operationId!==summary.operationId||entry.record.digest!==p.digest||entry.record.ownerId!==this.session.ownerId||entry.record.agentId!==this.session.agentId||entry.record.origin!==this.session.origin)throw Error('No exact saved Notes receipt; operation will not be repeated');
    return validateNotesResult(p.operation,entry.result?.notesResult);
  }
  private async savedReadResult(p:Proposal,summary:JournalEntry):Promise<WorkflowReadResult|undefined>{
    if(p.operation.type!=='read_selected_notes'&&p.operation.type!=='read_calendar_range')return undefined;
    if(summary.status!=='succeeded')return undefined;
    const {entry}=await this.journal.get({scope:this.scope,proposalId:p.id});
    if(!entry||entry.phase!=='terminal'||entry.status!=='succeeded'||entry.operationId!==summary.operationId||entry.record.digest!==p.digest||JSON.stringify(entry.record.workflow)!==JSON.stringify(p.workflow)||entry.record.ownerId!==this.session.ownerId||entry.record.agentId!==this.session.agentId||entry.record.origin!==this.session.origin)throw new Error('No exact saved read receipt is available; the source will not be read again');
    return validateWorkflowResult(p.operation,entry.result?.readResult);
  }
  async reconcile(proposalId: string, outcome: 'applied' | 'not_applied', signal: AbortSignal): Promise<void> {
    const p = (await this.list(signal)).find(item => item.id === proposalId);
    if (!p?.attemptId) throw new Error('No dispatched action to reconcile');
    let { entry } = await this.journal.get({ scope: this.scope, proposalId });
    if(entry&&outcome==='applied')entry=await this.recoverReminder(p,entry,signal);
    const clockResult=entry?await this.savedClockResult(p,entry):undefined;
    if(isClockOperation(p.operation)&&(!clockResult||clockResult.status==='unknown'||(outcome==='applied')!==(clockResult.status==='opened')))throw Error('Clock reconciliation requires the exact saved handoff result; alarm state cannot be inferred');
    const mapsResult=outcome==='applied'&&entry?await this.savedMapsResult(p,entry):undefined;
    if(outcome==='applied'&&isMapsOperation(p.operation)&&!mapsResult)throw Error('Applied Maps read requires exact saved receipt');
    const readResult=outcome==='applied'&&entry?await this.savedReadResult(p,entry):undefined;
    const calendarResult=outcome==='applied'&&entry?await this.savedCalendarResult(p,entry):undefined;
    const notesResult=outcome==='applied'&&entry?await this.savedNotesResult(p,entry):undefined;
    const reminderResult=outcome==='applied'&&entry?await this.savedReminderResult(p,entry):undefined;
    if(outcome==='applied'&&isReminderOperation(p.operation)&&!reminderResult)throw Error('Applied reminder reconciliation requires exact saved receipt');
    if(outcome==='applied'&&isNotesOperation(p.operation)&&!notesResult)throw Error('Applied Notes reconciliation requires its exact saved receipt');
    if(outcome==='applied'&&isCalendarOperation(p.operation)&&!calendarResult)throw Error('Applied Calendar reconciliation requires exact saved provider receipt');
    if(outcome==='applied'&&(p.operation.type==='read_selected_notes'||p.operation.type==='read_calendar_range')&&!readResult)throw new Error('Applied read requires its exact saved result');
    await this.mutation(p, 'reconciliation', { attemptId: p.attemptId, resolution: { confirmed: true, outcome, ...((outcome === 'applied'||isClockOperation(p.operation)) && entry ? { operationId: entry.operationId } : {}),...(clockResult?{result:clockResult}:mapsResult?{result:mapsResult}:readResult?{result:readResult}:calendarResult?{result:calendarResult}:notesResult?{result:notesResult}:reminderResult?{result:reminderResult}:{}) } }, signal);
  }
}
