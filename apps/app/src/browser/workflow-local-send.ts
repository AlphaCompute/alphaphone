type Bag=Record<string,any>;
/** Local simulator destinations only; a saved message ID is its step receipt. */
export function sendWorkflowLocal(step:Bag,text:string,operationId:string,api:Bag,signal:AbortSignal){
 const action=String(step.t).toLowerCase();
 const current=(name:string)=>({...api.get(name),...JSON.parse(localStorage.getItem('alpha.dev.app.'+name)||'{}')});
 const save=(name:string,patch:Bag)=>{signal.throwIfAborted();const prior=JSON.parse(localStorage.getItem('alpha.dev.app.'+name)||'{}');if(JSON.stringify({...prior,...patch}).length>12_000_000)throw Error('Local '+name+' storage is full. Remove older records before retrying.');api.setView(name,patch);};
 if(!text.trim())throw Error('Read or write message content before sending.');
 if(action==='a message to maya'){
  const state=current('messages'),pid='maya',rows=state.threads[pid]||[],existing=rows.find((row:Bag)=>row.id===operationId);
  if(existing){if(existing.text!==text||!existing.me)throw Error('Saved message receipt does not match this step.');return {output:text,detail:'Local message to Maya saved ('+operationId+')'};}
  const now=new Date(),k=Math.max(now.getHours()*60+now.getMinutes()-1,...Object.values(state.threads as Bag).flatMap((messages:any)=>messages.map((m:Bag)=>Number(m.k)||0)))+1;
  save('messages',{threads:{...state.threads,[pid]:[...rows,{id:operationId,k,me:true,text,workflowStep:operationId}]}});
  return {output:text,detail:'Local message to Maya saved ('+operationId+')'};
 }
 if(action==='an email to me'){
  const state=current('inbox'),existing=state.sent.find((mail:Bag)=>mail.id===operationId);
  if(existing){if(existing.body!==text||existing.to?.[0]!=='you@alpha.local')throw Error('Saved email receipt does not match this step.');return {output:text,detail:'Local email saved ('+operationId+')'};}
  save('inbox',{sent:[{id:operationId,sent:true,to:['you@alpha.local'],cc:[],bcc:[],acct:'personal',subj:'Workflow output',body:text,time:'Now',k:Date.now(),atts:[],workflowStep:operationId},...state.sent]});
  return {output:text,detail:'Local email saved ('+operationId+')'};
 }
 throw Error('Choose a recipient for this local send step.');
}
