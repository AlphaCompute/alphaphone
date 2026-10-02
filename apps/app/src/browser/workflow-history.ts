type Bag=Record<string,any>;
const terminal=new Set(['ok','fail','skip','cancelled']);
const object=(value:unknown):value is Bag=>!!value&&typeof value==='object'&&!Array.isArray(value);
/** Retain uncertain/interrupted records; destinations own their independent effect receipts. */
export function finishedWorkflowHistory(state:Bag){
 if(!Array.isArray(state.flows)||!object(state.localRuns))throw Error('Workflow history needs saved app recovery.');
 const identities=new Set<string>();let pending=false;
 const keep=(run:unknown,flowId:unknown)=>{
  if(!object(run)||!['string','number'].includes(typeof run.id)||typeof run.status!=='string')throw Error('Workflow history needs saved app recovery.');
  if(run.status==='running')pending=true;
  if(!terminal.has(run.status))return true;
  identities.add(JSON.stringify([String(flowId),String(run.id)]));return false;
 };
 const flows=state.flows.map((flow:Bag)=>{
  if(!object(flow)||!['string','number'].includes(typeof flow.id)||!Array.isArray(flow.runs))throw Error('Workflow history needs saved app recovery.');
  return {...flow,runs:flow.runs.filter((run:unknown)=>keep(run,flow.id))};
 });
 const localRuns=Object.fromEntries(Object.entries(state.localRuns).filter(([id,run])=>{
  if(!object(run)||run.id!==id||!['string','number'].includes(typeof run.flowId))throw Error('Workflow history needs saved app recovery.');
  return keep(run,run.flowId);
 }));
 return {patch:{flows,localRuns},count:identities.size,pending};
}
let current:HTMLDialogElement|undefined;
export function openWorkflowHistory(read:()=>Bag,write:(patch:Bag)=>void,isRunning:()=>boolean){
 if(current?.open)return;
 const snapshot=JSON.stringify(read());let plan:ReturnType<typeof finishedWorkflowHistory>|undefined,error='';
 try{plan=finishedWorkflowHistory(JSON.parse(snapshot));}catch(cause){error=cause instanceof Error?cause.message:'History unavailable.';}
 const dialog=current=document.createElement('dialog');dialog.setAttribute('aria-label','Workflow history');dialog.style.cssText='box-sizing:border-box;width:min(380px,92vw);max-height:85dvh;overflow:auto;border:0;border-radius:20px;padding:24px;background:var(--bg,#fff);color:var(--fg,#111);font:16px/1.5 system-ui';
 const shell=document.querySelector('.os');if(shell)for(const name of ['--bg','--fg','--s2'])dialog.style.setProperty(name,getComputedStyle(shell).getPropertyValue(name));
 const heading=document.createElement('h2');heading.textContent='Workflow history';
 const description=document.createElement('p');description.textContent='Download a copy of local workflow definitions and run history. Remove finished runs to free space; running and interrupted records are retained. Saved notes, messages and notification receipts remain available.';
 const status=document.createElement('p');status.setAttribute('role','status');status.textContent=error||(plan?.pending||isRunning()?'Wait for running workflows to finish or cancel them first.':`${plan!.count} finished runs can be removed.`);
 const download=document.createElement('a');download.textContent='Download history';download.download='alpha-workflow-history.json';const url=URL.createObjectURL(new Blob([snapshot],{type:'application/json'}));download.href=url;
 const remove=document.createElement('button');remove.textContent='Remove finished runs';remove.disabled=!plan||!plan.count||plan.pending||isRunning();
 let confirming=false;
 remove.onclick=()=>{
  if(!plan)return;
  if(!confirming){confirming=true;remove.textContent='Confirm remove finished runs';status.textContent='This removes finished run logs and outputs from this browser. Download history first if you want to retain them.';return;}
  try{
   if(isRunning()||JSON.stringify(read())!==snapshot)throw Error('Workflow history changed. Close and reopen this dialog to review it again.');
   write(plan.patch);remove.disabled=true;status.textContent=`Removed ${plan.count} finished runs.`;
  }catch(cause){remove.disabled=true;status.textContent=cause instanceof Error?cause.message:'Could not save history. Close and reopen to inspect it.';}
 };
 const close=document.createElement('button');close.textContent='Close history';close.onclick=()=>finish();
 for(const item of [download,remove,close])item.style.cssText='display:inline-block;min-height:44px;box-sizing:border-box;margin:4px;padding:10px;border:1px solid #999;border-radius:10px;color:inherit;background:var(--s2,#eee);font:inherit';
 const previous=document.activeElement as HTMLElement|null;const back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();finish();};const retire=()=>finish();const hidden=()=>{if(document.hidden)retire();};const events=['pagehide','launcher-home','alpha:device-state','alpha:dev-incoming-call'];
 let closed=false;const finish=()=>{if(closed)return;closed=true;dialog.close();window.removeEventListener('alpha-back',back,true);for(const event of events)window.removeEventListener(event,retire);document.removeEventListener('visibilitychange',hidden);URL.revokeObjectURL(url);dialog.remove();if(current===dialog)current=undefined;if(previous?.isConnected)previous.focus();};
 dialog.onclose=finish;dialog.oncancel=event=>{event.preventDefault();finish();};
 window.addEventListener('alpha-back',back,true);for(const event of events)window.addEventListener(event,retire);document.addEventListener('visibilitychange',hidden);dialog.append(heading,description,download,remove,close,status);document.body.append(dialog);dialog.showModal();heading.tabIndex=-1;heading.focus();
}
