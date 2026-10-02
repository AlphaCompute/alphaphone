import {isFocusWorkflow,prepareFocus,waitForFocusEnd,waitForFocusReview,type FocusBlock} from './workflow-focus';
import {focusChanged,retireFocusRun} from './focus-state';
import {withWorkflowResource} from './workflow-resources';
import {WorkflowTriggerRuntime,hydrateTriggerJob,type TriggerJob} from './workflow-trigger-runtime';
import {assessWorkflowUrgency,type UrgencyDecision} from './workflow-urgency';
import {workflowAwayFromHome} from './workflow-location';
import {requestWorkflowReceipt,receiptAttachment,recordWorkflowExpense,type ReceiptInput} from './workflow-receipts';
import {readDatedWorkflowSource} from './workflow-dated-sources';
import {openWorkflowHistory} from './workflow-history';
import {readWorkflowMessages} from './workflow-messages';
import {workflowCalendarRange,readWorkflowCalendar,workflowInMeeting} from './workflow-calendar';
import {requestWorkflowResult} from './workflow-result-input';
import {speakWorkflowText,waitForWorkflowPickup} from './workflow-speech';
import {publishWorkflowNotice} from './workflow-notices';
import {sendWorkflowLocal} from './workflow-local-send';
import {registerPlugin} from '../platform-plugins';
type Bag=Record<string,any>;
type Run={id:string;flowId:string|number;definition:string;workflow:Bag;status:string;when:string;sum:string;dur:string;log:string[][];out:string;cursor:number;inflight:number|null;started:number;trigger?:TriggerJob;context:{focus?:FocusBlock;triggerAt?:number;triggerMessages?:Record<string,Bag[]>;triggerMail?:Bag;event?:Bag;messages?:Record<string,Bag[]>;receipt?:ReceiptInput;urgency?:Record<string,UrgencyDecision>}};
const definition=(flow:Bag)=>JSON.stringify({name:flow.name,trig:flow.trig,steps:flow.steps});
/** Persist intent and each completed local step; never derive success from a label alone. */
export function installSimulatedWorkflows(view:Bag){
 const device=registerPlugin<any>('AlphaDevice'),calendar=registerPlugin<any>('AlphaCalendar'),files=registerPlugin<any>('AlphaFiles');
 const live=new Map<string,{abort:AbortController;run:Run}>();let recoveryAttempted=false;
 const savedState=(api:Bag)=>({...api.get('workflows'),...JSON.parse(localStorage.getItem('alpha.dev.app.workflows')||'{}')});
 const persist=(api:Bag,run:Run,reserve=0)=>{const state=savedState(api);const claiming=!!run.trigger&&!state.localRuns?.[run.id];if(claiming&&!state.triggerState?.queue.some((job:TriggerJob)=>job.id===run.id&&job.definition===run.definition))throw Error('The queued trigger changed before its run started.');const patch={triggerState:claiming?{...state.triggerState,queue:state.triggerState.queue.filter((job:TriggerJob)=>job.id!==run.id)}:state.triggerState,localRuns:{...state.localRuns,[run.id]:structuredClone(run)},flows:state.flows.map((flow:Bag)=>String(flow.id)===String(run.flowId)?{...flow,runs:[structuredClone(run),...(flow.runs||[]).filter((old:Bag)=>old.id!==run.id)]}:flow)};if(JSON.stringify(patch).length+reserve>2_000_000)throw Error('Workflow history is full. Open Workflow history to download or remove finished runs before starting more work.');api.setView('workflows',patch);};
 const step=async(item:Bag,input:string,api:Bag,signal:AbortSignal,operationId:string,progress:(message:string)=>void,context:Run['context']):Promise<{output:string;skip?:boolean;detail?:string}>=>{
  signal.throwIfAborted();const text=String(item.t).toLowerCase();
  if(item.k==='Speak'&&(text==='read it aloud'||text==='speak it when i pick up the phone')){if(text!=='read it aloud'){progress('Waiting for pickup');await waitForWorkflowPickup(signal);}progress(context.triggerAt!==undefined?'Waiting for speaker':'Reading aloud');const speak=()=>speakWorkflowText(input,signal,()=>progress('Reading aloud'),context.triggerAt!==undefined);await (context.triggerAt!==undefined?withWorkflowResource('speech',signal,speak):speak());return {output:input,detail:'Finished reading aloud'};}
  if(item.k==='Notify'&&text==='a notification, only if urgent'){progress('Checking urgency');const decision=await assessWorkflowUrgency(input,(instruction,input,signal)=>api.localWorkflowText(instruction,input,signal),signal);context.urgency={...context.urgency,[operationId]:decision};progress(decision.urgent?'Urgent notification ready':'Not urgent');if(decision.urgent)await publishWorkflowNotice(operationId,input,signal);return {output:input,detail:(decision.urgent?'Notification saved':'Notification not posted')+' · '+decision.source+': '+decision.reason};}
  if(item.k==='Notify'&&(text==='a notification'||text==='a notification when the block ends'&&context.focus?.phase==='ended')){await publishWorkflowNotice(operationId,input,signal);return {output:input,detail:'Notification saved ('+operationId+')'};}
  if(item.k==='Send')return sendWorkflowLocal(item,input,operationId,api,signal,context.messages);
  if(item.k==='Write'&&text==='a note in notes'){await withWorkflowResource('notes',signal,()=>api.localWorkflowNotes({operationId,text:input},signal));return {output:input,detail:'Note saved ('+operationId+')'};}
  if(item.k==='Read'){
   context.messages=context.triggerMessages;let output:string;const when=new Date(context.triggerAt??Date.now()),range=workflowCalendarRange(text,when);const dated=await readDatedWorkflowSource(text,api,calendar,signal,when);
   if(dated)output=JSON.stringify(dated);
   else if(text==='messages'||text==='new messages'){const messages=context.triggerMessages||readWorkflowMessages(api,text==='new messages');output=JSON.stringify(messages);if(output.length<=16000)context.messages=messages;}
   else if(text==='inbox')output=JSON.stringify(context.triggerMail?[context.triggerMail]:api.get('inbox').mails);
   else if(text==='contacts')output=JSON.stringify(api.get('contacts').list);
   else if(text==='files'||text==='recent files')output=JSON.stringify(await files.workflowFiles({recent:text==='recent files'},signal));
   else if(text==='notes')output=JSON.stringify(await api.localWorkflowNotes({},signal));
   else if(range)output=JSON.stringify(await readWorkflowCalendar(calendar,range,signal));
   else throw Error('This local read source is not supported: '+item.t);
   if(output.length>16000)throw Error('Local input is too large for this run. Narrow the source before retrying.');
   return {output};
  }
  if(item.k==='Write'){progress('Generating step result');const generated=await api.localWorkflowText(String(item.t),input,signal);if(generated!==undefined){progress('Generated step result');return {output:generated,detail:'Generated by the connected agent'};}progress('Waiting for step result');const output=await requestWorkflowResult(String(item.t),input,signal);progress('Step result supplied');return {output,detail:'Supplied development result'};}
  if(item.k==='If'){
   if(text==='a message is from maya, let it through'&&context.focus){progress('Focus active');const output=await waitForFocusEnd(context.focus,api,signal,progress);return {output,detail:'Focus block ended; actual arrivals collected'};}
   if(text.replaceAll('’',"'")=="i'm not at home"){progress('Checking location');const result=await workflowAwayFromHome(signal);return {output:input,skip:!result.away,detail:result.detail};}
   if(text.replaceAll('’',"'")=="i'm in a meeting")return {output:input,skip:!await workflowInMeeting(calendar,signal),detail:'An active timed Calendar event has guests or a meeting link.'};
   if(/money/.test(text))return {output:input,skip:!/(\$|\b(amount|price|payment|invoice)\b)/i.test(input)};
   if(/favorite|from maya/.test(text)){const messages=context.messages;if(!messages)throw Error('Read messages before checking their sender.');const ids=/from maya/.test(text)?['maya']:api.get('contacts').list.filter((p:Bag)=>p.fav).map((p:Bag)=>p.id);const matches=Object.fromEntries(Object.entries(messages).filter(([id,rows])=>ids.includes(id)&&rows.some((message:Bag)=>!message.me)));context.messages=matches;return {output:input===JSON.stringify(messages)?JSON.stringify(matches):input,skip:!Object.keys(matches).length};}
   throw Error('Choose a condition with local input for this run.');
  }
  if(item.k==='Do'&&(text==='save the attachment to files'||text==='add the amount to wallet')){if(!context.receipt)throw Error('Choose a receipt for this run.');const attachment=await receiptAttachment(context.receipt,api,signal);if(text==='save the attachment to files'){const saved=await files.saveWorkflowAttachment({...attachment,operationId},signal);return {output:JSON.stringify(saved),detail:'Attachment saved in Files / Receipts ('+saved.name+')'};}recordWorkflowExpense(context.receipt,operationId,api,signal);return {output:JSON.stringify({merchant:context.receipt.merchant,amount:context.receipt.cents!/100,currency:'USD'}),detail:'Receipt recorded in local Wallet ('+operationId+')'};}
  if(item.k==='Do'&&/^turn (on|off) do not disturb$/.test(text)){const enabled=text.startsWith('turn on');if(enabled&&context.focus){focusChanged();return {output:'Focus Do Not Disturb on',detail:'Focus policy active until the Calendar block ends'};}await device.setSensor({field:'doNotDisturb',enabled});return {output:'Do Not Disturb '+(enabled?'on':'off')};}
  throw Error('This step needs its local action configured: '+item.t);
 };
 const start=async(flow:Bag,api:Bag,job?:TriggerJob)=>{
  if(job){const original=api.localWorkflowText;api={...api,localWorkflowText:async(instruction:string,input:string,signal:AbortSignal)=>{const result=await withWorkflowResource('agent',signal,async()=>{await api.localWorkflowIdle?.(signal);return original(instruction,input,signal,true);});if(result===undefined&&!api.isActive())throw Error('Open the workflow to provide its step result.');return result;}};}
  if([...live.values()].some(item=>String(item.run.flowId)===String(flow.id)))return;
  const run:Run={id:job?.id||crypto.randomUUID(),...(job?{trigger:job}:{}),flowId:flow.id,definition:definition(flow),workflow:structuredClone(flow),status:'running',when:new Date().toLocaleString(),sum:'Running locally',dur:'',log:[],out:'',cursor:0,inflight:null,started:Date.now(),context:{}};delete run.workflow.runs;
  const abort=new AbortController();live.set(run.id,{abort,run});
  try{
   if(job){const hydrated=await hydrateTriggerJob(job,api,abort.signal);const current=savedState(api).flows.find((item:Bag)=>String(item.id)===job.flowId);if(!current?.on||definition(current)!==job.definition)throw Error('Workflow changed before the queued run started.');run.out=hydrated.input;run.context={triggerAt:job.at,triggerMessages:hydrated.messages,messages:hydrated.messages,triggerMail:hydrated.mail,event:hydrated.event};run.log.push(['When','Triggered by '+job.source.kind+' at '+new Date(job.at).toLocaleString(),'ok']);}
   if(isFocusWorkflow(flow))run.context.focus={...await prepareFocus(api,run.context.event,abort.signal),flowId:String(flow.id),definition:definition(flow)};
   persist(api,run);if(run.context.focus)focusChanged();
   if(!run.workflow.steps.length)throw Error('Add a step before running this workflow.');
   if(run.workflow.steps.some((item:Bag)=>item.k==='Do'&&/^(save the attachment to files|add the amount to wallet)$/i.test(item.t))){run.sum='Waiting for receipt';persist(api,run);run.context.receipt=await requestWorkflowReceipt(api,run.workflow.steps.some((item:Bag)=>item.k==='Do'&&/^add the amount to wallet$/i.test(item.t)),abort.signal,run.context.triggerMail?.id);persist(api,run);}
   for(let index=0;index<run.workflow.steps.length;index++){
    abort.signal.throwIfAborted();const current=savedState(api).flows.find((f:Bag)=>String(f.id)===String(run.flowId));if(!current||definition(current)!==run.definition||run.trigger&&!current.on)throw Error('Workflow changed during this run. Completed steps were retained.');
    run.inflight=index;persist(api,run,128_000);const item=run.workflow.steps[index];if(run.context.focus?.phase==='ended'&&item.k==='Write'){run.sum='Waiting for focus summary';persist(api,run);await waitForFocusReview(api,run.flowId,abort.signal,run.definition);}const result=await step(item,run.out,api,abort.signal,run.id+'-'+index,message=>{abort.signal.throwIfAborted();const current=savedState(api).flows.find((f:Bag)=>String(f.id)===String(run.flowId));if(!current||definition(current)!==run.definition||run.trigger&&!current.on)throw Error('Workflow changed during this run. Completed steps were retained.');run.sum=message;persist(api,run);},run.context);
    run.out=result.output;run.cursor=index+1;run.inflight=null;run.log.push([item.k,result.skip?'Condition did not match. Later steps skipped.':result.detail||result.output.slice(0,1000)||'Completed locally',result.skip?'skip':'ok']);persist(api,run);
    if(result.skip){run.status='skip';run.sum='Condition did not match';break;}
   }
   if(run.status==='running'){abort.signal.throwIfAborted();run.status='ok';run.sum='Completed locally';}
  }catch(error){const cancelled=abort.signal.aborted||error instanceof DOMException&&error.name==='AbortError';run.status=cancelled?'cancelled':'fail';run.sum=cancelled?'Cancelled; completed steps retained':error instanceof Error?error.message:'Local run failed';}
  finally{if(run.context.focus){if(run.context.focus.phase==='active')run.context.focus.phase='cancelled';retireFocusRun(run.id);}run.dur=((Date.now()-run.started)/1000).toFixed(1)+' s';try{persist(api,run);}catch{api.toast('Run state could not be saved. Reload to inspect its last saved step.');}live.delete(run.id);api.setView('workflows',{localRunRevision:crypto.randomUUID()});}
 };
 const scheduler=new WorkflowTriggerRuntime(flowId=>[...live.values()].some(item=>String(item.run.flowId)===flowId),(flow,api,job)=>start(flow,api,job));
 const render=view.render,reply=view.reply,badge=view.badge;view.badge=(state:Bag,...args:any[])=>state.triggerState?.queue.length?true:badge?.(state,...args);
 view.reply=(text:string,raw:string,api:Bag)=>{
  const match=text.match(/^run\s+(.+?)(?:\s+now)?$/);if(match){const flows=api.get('workflows').flows,flow=flows.find((f:Bag)=>f.name.toLowerCase()===match[1]||/^(this|it)$/.test(match[1])&&f.id===api.get('workflows').open);if(flow)return {text:'Starting '+flow.name+'.',nav:{view:'workflows',patch:{open:flow.id}},then:()=>void start(flow,api)};return {text:'Choose the workflow to run.',nav:{view:'workflows'}};}return reply(text,raw,api);
 };
 view.render=(state:Bag,api:Bag)=>{
  if(!recoveryAttempted){recoveryAttempted=true;const pending=Object.values(state.localRuns||{}).filter((run:any)=>run.status==='running');if(pending.length)api.later(()=>{const current=api.get('workflows'),runs={...current.localRuns};for(const old of pending as Run[])if(!live.has(old.id))runs[old.id]={...old,status:'interrupted',sum:'Interrupted; inspect completed steps before running again'};try{api.setView('workflows',{localRuns:runs,flows:current.flows.map((flow:Bag)=>({...flow,runs:(flow.runs||[]).map((run:Bag)=>runs[run.id]||run)}))});}catch{api.toast('Could not save interrupted run recovery.');}},0);}
  const out=render(state,api),flow=state.flows.find((f:Bag)=>String(f.id)===String(state.open));
  out.localHistory=()=>openWorkflowHistory(()=>{const state=api.get('workflows');return {flows:state.flows,localRuns:state.localRuns||{}};},patch=>api.setView('workflows',patch),()=>live.size>0);
  if(out.cards)out.cards=out.cards.map((card:Bag,index:number)=>{const item=state.flows[index],count=state.triggerState?.queue.filter((job:TriggerJob)=>job.flowId===String(item?.id)).length;return count?{...card,short:count+' queued · Open to continue'}:card;});
  if(out.fd&&flow){const queued=state.triggerState?.queue.filter((job:TriggerJob)=>job.flowId===String(flow.id)&&job.definition===definition(flow))||[];const active=[...live.values()].find(item=>String(item.run.flowId)===String(flow.id));out.fd={...out.fd,localExecutor:true,history:out.localHistory,isRunning:!!active,notRunning:!active,run:()=>void start(flow,api,queued[0]),cancelRun:()=>active?.abort.abort(),last:active?active.run.sum:state.localTriggerError||(queued.length?queued.length+' queued · Ready to continue':out.fd.last)};out.fd.runs=out.fd.runs.map((row:Bag,index:number)=>({...row,label:flow.runs[index].when+', '+flow.runs[index].status}));}
  if(out.r&&flow){const record=state.run==='latest'?flow.runs?.[0]:flow.runs?.find((run:Bag)=>run.id===state.run),active=[...live.values()].find(item=>String(item.run.flowId)===String(flow.id));out.r={...out.r,status:record?.status==='ok'?'Succeeded':record?.status==='fail'?'Failed':record?.status==='skip'?'Skipped':record?.status==='cancelled'?'Cancelled':record?.status==='interrupted'?'Interrupted':'Running',hasFix:!!record&&record.status!=='ok',fix:record?.sum||'',againLabel:active?'Cancel run':'Run again',againAria:active?'Cancel run':'Run again',again:()=>{if(active)active.abort.abort();else{api.set({run:null});void start(flow,api);}}};}
  return out;
 };
 const retire=()=>{for(const item of live.values())item.abort.abort();};window.addEventListener('pagehide',retire);return Object.assign(()=>{scheduler.dispose();retire();window.removeEventListener('pagehide',retire);},{connect:(api:()=>Bag,ready:()=>boolean)=>scheduler.connect(api,ready)});
}
