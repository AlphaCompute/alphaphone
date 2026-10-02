import {speakWorkflowText} from './workflow-speech';
import {publishWorkflowNotice} from './workflow-notices';
import {sendWorkflowLocal} from './workflow-local-send';
import {registerPlugin} from '../platform-plugins';
type Bag=Record<string,any>;
type Run={id:string;flowId:string|number;definition:string;workflow:Bag;status:string;when:string;sum:string;dur:string;log:string[][];out:string;cursor:number;inflight:number|null;started:number};
const definition=(flow:Bag)=>JSON.stringify({name:flow.name,trig:flow.trig,steps:flow.steps});
/** Persist intent and each completed local step; never derive success from a label alone. */
export function installSimulatedWorkflows(view:Bag){
 const device=registerPlugin<any>('AlphaDevice'),calendar=registerPlugin<any>('AlphaCalendar');
 const live=new Map<string,{abort:AbortController;run:Run}>();let recoveryAttempted=false;
 const savedState=(api:Bag)=>({...api.get('workflows'),...JSON.parse(localStorage.getItem('alpha.dev.app.workflows')||'{}')});
 const persist=(api:Bag,run:Run,reserve=0)=>{const state=savedState(api);const patch={localRuns:{...state.localRuns,[run.id]:structuredClone(run)},flows:state.flows.map((flow:Bag)=>String(flow.id)===String(run.flowId)?{...flow,runs:[structuredClone(run),...(flow.runs||[]).filter((old:Bag)=>old.id!==run.id)]}:flow)};if(JSON.stringify(patch).length+reserve>2_000_000)throw Error('Workflow history is full. Export or remove older runs before starting more work.');api.setView('workflows',patch);};
 const step=async(item:Bag,input:string,api:Bag,signal:AbortSignal,operationId:string):Promise<{output:string;skip?:boolean;detail?:string}>=>{
  signal.throwIfAborted();const text=String(item.t).toLowerCase();
  if(item.k==='Speak'&&text==='read it aloud'){await speakWorkflowText(input,signal);return {output:input,detail:'Finished reading aloud'};}
  if(item.k==='Notify'&&text==='a notification'){await publishWorkflowNotice(operationId,input,signal);return {output:input,detail:'Notification saved ('+operationId+')'};}
  if(item.k==='Send')return sendWorkflowLocal(item,input,operationId,api,signal);
  if(item.k==='Write'&&text==='a note in notes'){await api.localWorkflowNotes({operationId,text:input},signal);return {output:input,detail:'Note saved ('+operationId+')'};}
  if(item.k==='Read'){
   let output:string;
   if(text==='messages')output=JSON.stringify(api.get('messages').threads);
   else if(text==='inbox')output=JSON.stringify(api.get('inbox').mails);
   else if(text==='contacts')output=JSON.stringify(api.get('contacts').list);
   else if(text==='notes')output=JSON.stringify(await api.localWorkflowNotes({},signal));
   else if(text==="today's calendar"||text==='today’s calendar'){const begin=new Date();begin.setHours(0,0,0,0);const end=new Date(begin);end.setDate(end.getDate()+1);const result=await calendar.list({begin:begin.getTime(),end:end.getTime()});output=JSON.stringify(result.events||[]);}
   else throw Error('This local read source is not supported: '+item.t);
   if(output.length>16000)throw Error('Local input is too large for this run. Narrow the source before retrying.');
   return {output};
  }
  if(item.k==='Write')throw Error('Writing steps require a connected agent. No text was generated.');
  if(item.k==='If'){
   if(/money/.test(text))return {output:input,skip:!/(\$|\b(amount|price|payment|invoice)\b)/i.test(input)};
   if(/favorite|from maya/.test(text)){let messages:Bag;try{messages=JSON.parse(input);}catch{throw Error('Read messages before checking their sender.');}const ids=/from maya/.test(text)?['maya']:api.get('contacts').list.filter((p:Bag)=>p.fav).map((p:Bag)=>p.id);return {output:input,skip:!ids.some((id:string)=>Array.isArray(messages[id])&&messages[id].some((message:Bag)=>!message.me))};}
   throw Error('Choose a condition with local input for this run.');
  }
  if(item.k==='Do'&&/^turn (on|off) do not disturb$/.test(text)){const enabled=text.startsWith('turn on');await device.setSensor({field:'doNotDisturb',enabled});return {output:'Do Not Disturb '+(enabled?'on':'off')};}
  throw Error('This step needs its local action configured: '+item.t);
 };
 const start=async(flow:Bag,api:Bag)=>{
  if([...live.values()].some(item=>String(item.run.flowId)===String(flow.id)))return;
  const run:Run={id:crypto.randomUUID(),flowId:flow.id,definition:definition(flow),workflow:structuredClone(flow),status:'running',when:new Date().toLocaleString(),sum:'Running locally',dur:'',log:[],out:'',cursor:0,inflight:null,started:Date.now()};delete run.workflow.runs;
  const abort=new AbortController();live.set(run.id,{abort,run});
  try{
   persist(api,run);
   if(!run.workflow.steps.length)throw Error('Add a step before running this workflow.');
   for(let index=0;index<run.workflow.steps.length;index++){
    abort.signal.throwIfAborted();const current=savedState(api).flows.find((f:Bag)=>String(f.id)===String(run.flowId));if(!current||definition(current)!==run.definition)throw Error('Workflow changed during this run. Completed steps were retained.');
    run.inflight=index;persist(api,run,64_000);const item=run.workflow.steps[index];const result=await step(item,run.out,api,abort.signal,run.id+'-'+index);
    run.out=result.output;run.cursor=index+1;run.inflight=null;run.log.push([item.k,result.skip?'Condition did not match. Later steps skipped.':result.detail||result.output.slice(0,1000)||'Completed locally',result.skip?'skip':'ok']);persist(api,run);
    if(result.skip){run.status='skip';run.sum='Condition did not match';break;}
   }
   if(run.status==='running'){abort.signal.throwIfAborted();run.status='ok';run.sum='Completed locally';}
  }catch(error){run.status=abort.signal.aborted?'cancelled':'fail';run.sum=abort.signal.aborted?'Cancelled; completed steps retained':error instanceof Error?error.message:'Local run failed';}
  finally{run.dur=((Date.now()-run.started)/1000).toFixed(1)+' s';try{persist(api,run);}catch{api.toast('Run state could not be saved. Reload to inspect its last saved step.');}live.delete(run.id);api.setView('workflows',{localRunRevision:crypto.randomUUID()});}
 };
 const render=view.render,reply=view.reply;
 view.reply=(text:string,raw:string,api:Bag)=>{
  const match=text.match(/^run\s+(.+?)(?:\s+now)?$/);if(match){const flows=api.get('workflows').flows,flow=flows.find((f:Bag)=>f.name.toLowerCase()===match[1]||/^(this|it)$/.test(match[1])&&f.id===api.get('workflows').open);if(flow)return {text:'Starting '+flow.name+'.',nav:{view:'workflows',patch:{open:flow.id}},then:()=>void start(flow,api)};return {text:'Choose the workflow to run.',nav:{view:'workflows'}};}return reply(text,raw,api);
 };
 view.render=(state:Bag,api:Bag)=>{
  if(!recoveryAttempted){recoveryAttempted=true;const pending=Object.values(state.localRuns||{}).filter((run:any)=>run.status==='running');if(pending.length)api.later(()=>{const current=api.get('workflows'),runs={...current.localRuns};for(const old of pending as Run[])if(!live.has(old.id))runs[old.id]={...old,status:'interrupted',sum:'Interrupted; inspect completed steps before running again'};try{api.setView('workflows',{localRuns:runs,flows:current.flows.map((flow:Bag)=>({...flow,runs:(flow.runs||[]).map((run:Bag)=>runs[run.id]||run)}))});}catch{api.toast('Could not save interrupted run recovery.');}},0);}
  const out=render(state,api),flow=state.flows.find((f:Bag)=>String(f.id)===String(state.open));
  if(out.fd&&flow){const active=[...live.values()].find(item=>String(item.run.flowId)===String(flow.id));out.fd={...out.fd,localExecutor:true,isRunning:!!active,notRunning:!active,run:()=>void start(flow,api),cancelRun:()=>active?.abort.abort(),last:active?'Running locally…':out.fd.last};out.fd.runs=out.fd.runs.map((row:Bag,index:number)=>({...row,label:flow.runs[index].when+', '+flow.runs[index].status}));}
  if(out.r&&flow){const record=state.run==='latest'?flow.runs?.[0]:flow.runs?.find((run:Bag)=>run.id===state.run),active=[...live.values()].find(item=>String(item.run.flowId)===String(flow.id));out.r={...out.r,status:record?.status==='ok'?'Succeeded':record?.status==='fail'?'Failed':record?.status==='skip'?'Skipped':record?.status==='cancelled'?'Cancelled':record?.status==='interrupted'?'Interrupted':'Running',hasFix:!!record&&record.status!=='ok',fix:record?.sum||'',againLabel:active?'Cancel run':'Run again',againAria:active?'Cancel run':'Run again',again:()=>{if(active)active.abort.abort();else{api.set({run:null});void start(flow,api);}}};}
  return out;
 };
 const retire=()=>{for(const item of live.values())item.abort.abort();};window.addEventListener('pagehide',retire);return ()=>{retire();window.removeEventListener('pagehide',retire);};
}
