import {isReminderCreate,validateReminderCreateResult} from '../runtime/reminder-create-contract';
import type {WorkflowDeviceBinding} from '../runtime/workflow-device-contract';
import {developmentIdentity,assertDevelopmentIdentity,type DevelopmentIdentity} from './development-identity';
import {isReminderOperation,validateReminderResult} from '../runtime/reminder-contract';
import {browserDevProfile} from './dev-profile';
import {editStore,readStore} from './store';
import {actionScope,validateDeviceOperation,type DeviceOperation,type ActionJournal,type JournalEntry} from '../runtime/device-actions';
import type {DevelopmentProfile} from './development-connection';
type Proposal={id:string;digest:string;state:string;subjectUserId:string;requestedBy:string;action:'device_action';expiresAt:string;payload:{action:'device_action';version:1;installationId:string;enrollmentId:string;workflow?:WorkflowDeviceBinding;operation:DeviceOperation};execution?:{attemptId:string};receipt?:Record<string,unknown>};
type State={version:1;proposals:Proposal[];journal:JournalEntry[]};
const initial=():State=>({version:1,proposals:[],journal:[]});
const key=(identity:DevelopmentIdentity)=>`alpha.browser.agent.actions.${identity.namespace}.v1`;
const allowed=(p:DevelopmentProfile)=>{if(!browserDevProfile||!['local','cloud','remote'].includes(p))throw Error('Choose a development profile.');};
function validate(s:State){if(!s||s.version!==1||!Array.isArray(s.proposals)||!Array.isArray(s.journal)||s.proposals.length>100||s.journal.length>100)throw Error('Development action data needs recovery.');return s;}
function current(profile:DevelopmentProfile,signal?:AbortSignal){allowed(profile);signal?.throwIfAborted();const selection=JSON.parse(localStorage.getItem('alpha.connection.selection.v1')||'null');if(selection?.kind!=='development'||selection.profile!==profile)throw Error('Development profile changed.');}
/** These fixed IDs are public local-fixture labels, never network credentials. */
export function developmentCredential(profile:DevelopmentProfile,identity=developmentIdentity(profile)){allowed(profile);return {installationId:`00000000-0000-4000-8000-00000000000${identity.account?(identity.account==='first'?4:5):['local','cloud','remote'].indexOf(profile)+1}`,key:'0'.repeat(64),enrollmentId:`development-${identity.namespace}-enrollment`};}
export async function authorDevelopmentAction(profile:DevelopmentProfile,json:string,signal:AbortSignal){
 const identity=developmentIdentity(profile);current(profile,signal);if(json.length>64000)throw Error('Action is too large.');const operation=validateDeviceOperation(JSON.parse(json)),id=crypto.randomUUID(),credential=developmentCredential(profile,identity),digest=await actionScope(JSON.stringify(operation));
 if(operation.type==='read_selected_notes'||operation.type==='read_calendar_range')throw Error('Configure this read through a workflow with a bound step and run.');
 return editStore(key(identity),initial,data=>{assertDevelopmentIdentity(identity);current(profile,signal);validate(data);if(data.proposals.length>=100)throw Error('Development action history is full.');data.proposals.push({id,digest,state:'pending',subjectUserId:identity.ownerId,requestedBy:identity.agentId,action:'device_action',expiresAt:new Date(Date.now()+3600000).toISOString(),payload:{action:'device_action',version:1,installationId:credential.installationId,enrollmentId:credential.enrollmentId,operation}});return id;},signal);
}
export function existingWorkflowProposal(identity:DevelopmentIdentity,runId:string,stepId:string){const matches=validate(readStore(key(identity),initial)).proposals.filter(p=>p.payload.workflow?.runId===runId&&p.payload.workflow.stepId===stepId);if(matches.length>1)throw Error('Workflow proposal history needs recovery.');return matches[0];}
export function developmentProposal(identity:DevelopmentIdentity,id:string){return validate(readStore(key(identity),initial)).proposals.find(p=>p.id===id);}
export async function authorWorkflowProposal(identity:DevelopmentIdentity,id:string,operation:DeviceOperation,workflow:WorkflowDeviceBinding,signal?:AbortSignal){
 assertDevelopmentIdentity(identity);current(identity.profile,signal);const credential=developmentCredential(identity.profile,identity),digest=await actionScope(JSON.stringify([operation,workflow]));
 return editStore(key(identity),initial,data=>{assertDevelopmentIdentity(identity);current(identity.profile,signal);validate(data);const prior=data.proposals.find(p=>p.id===id);if(prior){if(prior.digest!==digest)throw Error('Workflow proposal changed.');return prior;}if(data.proposals.length>=100)throw Error('Development action history is full.');const proposal:Proposal={id,digest,state:'pending',subjectUserId:identity.ownerId,requestedBy:identity.agentId,action:'device_action',expiresAt:new Date(Date.now()+3600000).toISOString(),payload:{action:'device_action',version:1,installationId:credential.installationId,enrollmentId:credential.enrollmentId,operation:validateDeviceOperation(operation),workflow}};data.proposals.push(proposal);return proposal;},signal);
}
export async function developmentActionRequest(profile:DevelopmentProfile,path:string,body:any,signal?:AbortSignal,identity=developmentIdentity(profile)){
 return navigator.locks.request('alpha.browser.workflow-admission.'+identity.namespace,{...(signal?{signal}:{})},()=>actionRequest(profile,path,body,signal,identity));
}
async function actionRequest(profile:DevelopmentProfile,path:string,body:any,signal?:AbortSignal,identity=developmentIdentity(profile)){
 assertDevelopmentIdentity(identity);current(profile,signal);if(path==='/api/client-devices/proposals'&&body===undefined)return {proposals:validate(readStore(key(identity),initial)).proposals};
 const route=/^\/api\/client-devices\/proposals\/([a-f0-9-]+)\/(decision|claim|receipt|reconciliation)$/.exec(path);if(!route)throw Error('Choose a development action request.');
 return editStore(key(identity),initial,data=>{assertDevelopmentIdentity(identity);current(profile,signal);validate(data);const p=data.proposals.find(p=>p.id===route[1]);if(!p||body?.digest!==p.digest)throw Error('Action changed.');const kind=route[2];if(p.payload.workflow&&(kind==='decision'||kind==='claim')){const binding=p.payload.workflow,state=readStore<any>(`alpha.browser.workflows.${identity.namespace}.v1`,()=>({runs:[]})),run=state.runs?.find((r:any)=>r.id===binding.runId);if(!run||run.finished||run.workflowVersionId!==binding.versionId||run.spec.steps[run.stepIndex]?.id!==binding.stepId)throw Error('Workflow no longer admits this phone step.');}
  if(kind==='decision'){if(p.state!=='pending'||Date.parse(p.expiresAt)<=Date.now()||!['approve','reject'].includes(body.decision))throw Error('Action is no longer pending.');p.state=body.decision==='approve'?'approved':'rejected';}
  else if(kind==='claim'){if(p.state!=='approved'||Date.parse(p.expiresAt)<=Date.now())throw Error('Action cannot be claimed.');p.execution={attemptId:crypto.randomUUID()};p.state='executing';}
  else{if(!p.execution||body.attemptId!==p.execution.attemptId)throw Error('Action attempt changed.');const receipt=kind==='receipt'?body.receipt:body.resolution;if(!receipt||typeof receipt.operationId!=='string'&&receipt.outcome==='applied'||!['applied','failed','unknown','not_applied'].includes(receipt.outcome)||kind==='reconciliation'&&receipt.confirmed!==true)throw Error('Invalid action receipt.');
   if(p.receipt&&p.state!=='reconciliation_required'){if(JSON.stringify(p.receipt)!==JSON.stringify(receipt))throw Error('Receipt already recorded.');}
   else{if(!['executing','reconciliation_required'].includes(p.state))throw Error('Action is already terminal.');p.receipt=receipt;p.state=receipt.outcome==='unknown'?'reconciliation_required':receipt.outcome==='applied'?'completed':receipt.outcome==='failed'?'failed':'not_applied';}
  }return {proposal:p,digest:p.digest};
 },signal);
}
export function developmentJournal(profile:DevelopmentProfile,identity=developmentIdentity(profile)):ActionJournal{
 allowed(profile);const edit=<T>(run:(data:State)=>T)=>editStore(key(identity),initial,data=>run(validate(data)));
 const find=(data:State,input:{scope:string;proposalId:string})=>data.journal.find(e=>e.scope===input.scope&&e.proposalId===input.proposalId);
 return {
  reserve:input=>edit(data=>{if(!/^[a-f0-9]{64}$/.test(input.scope)||!/^[a-f0-9]{64}$/.test(input.operationHash))throw Error('Invalid journal identity.');const prior=find(data,input);if(prior)return {created:false,entry:prior};const proposal=data.proposals.find(p=>p.id===input.proposalId);if(!proposal||proposal.digest!==input.record.digest||data.journal.length>=100)throw Error('Action reservation changed.');const entry:JournalEntry={...input,phase:'reserved'};data.journal.push(entry);return {created:true,entry};}),
  markApplying:input=>edit(data=>{const e=find(data,input);if(!e||e.phase!=='reserved'&&!(e.phase==='applying'&&e.attemptId===input.attemptId))throw Error('Invalid journal transition.');const proposal=data.proposals.find(p=>p.id===input.proposalId);if(proposal?.execution?.attemptId!==input.attemptId||proposal.state!=='executing')throw Error('Claim changed.');e.phase='applying';e.attemptId=input.attemptId;}),
  finish:input=>edit(data=>{const e=find(data,input);if(!e||!['succeeded','failed','unknown','cancelled'].includes(input.status))throw Error('Journal result is invalid.');if(e.phase==='terminal'){if(e.status!==input.status||e.summary!==input.summary||JSON.stringify(e.result)!==JSON.stringify(input.result))throw Error('Terminal result changed.');return;}if(input.status==='succeeded'&&e.phase!=='applying')throw Error('Action was not admitted.');Object.assign(e,{phase:'terminal',status:input.status,summary:input.summary,...(input.result?{result:input.result}:{})});}),
  recoverReminder:async input=>{
   const entry=find(validate(readStore(key(identity),initial)),input);if(!entry)throw Error('Reminder journal is missing.');
   if(entry.phase==='terminal'&&entry.status!=='unknown')return {entry};
   const operation=validateDeviceOperation(entry.record.operation);if(!(isReminderOperation(operation)||isReminderCreate(operation))||!entry.attemptId||entry.phase!=='applying'&&entry.status!=='unknown')throw Error('Reminder recovery requires an admitted attempt.');
   const expected=await actionScope(JSON.stringify([input.scope,entry.record.ownerId,entry.record.agentId,entry.record.sessionId,entry.record.origin,entry.record.installationId,entry.record.enrollmentId,input.proposalId,entry.record.digest,entry.operationId]));
   if(expected!==input.bindingHash||await actionScope(JSON.stringify(operation))!==entry.operationHash)throw Error('Reminder recovery binding changed.');
   const {DailyApps}=await import('../daily');const receipt=await DailyApps.reminderOperationReceipt({operationId:entry.operationId,bindingHash:input.bindingHash,operation});if(receipt.status!=='succeeded')return {entry};const reminderResult=isReminderCreate(operation)?validateReminderCreateResult(operation,receipt.result,entry.operationId):validateReminderResult(operation,receipt.result);
   return edit(data=>{const current=find(data,input);if(JSON.stringify(current)!==JSON.stringify(entry))throw Error('Reminder journal changed. Refresh history.');const proposal=data.proposals.find(p=>p.id===input.proposalId);if(!proposal||proposal.digest!==entry.record.digest||proposal.execution?.attemptId!==entry.attemptId)throw Error('Reminder claim changed.');Object.assign(current!,{phase:'terminal',status:'succeeded',summary:'Recovered the original saved reminder receipt. No action was repeated.',result:{operationId:entry.operationId,reminderResult}});return {entry:current!};});
  },
  get:async input=>({entry:find(validate(readStore(key(identity),initial)),input)||null}),
  list:async input=>({entries:validate(readStore(key(identity),initial)).journal.filter(e=>e.scope===input.scope)}),
 };
}
