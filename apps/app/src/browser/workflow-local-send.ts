type Bag=Record<string,any>;
/** Local simulator destinations only; a saved message ID is its step receipt. */
export function sendWorkflowLocal(step:Bag,text:string,operationId:string,api:Bag,signal:AbortSignal,messages?:Record<string,Bag[]>){
 const action=String(step.t).toLowerCase();
 const current=(name:string)=>({...api.get(name),...JSON.parse(localStorage.getItem('alpha.dev.app.'+name)||'{}')});
 const save=(name:string,patch:Bag)=>{signal.throwIfAborted();const prior=JSON.parse(localStorage.getItem('alpha.dev.app.'+name)||'{}');if(JSON.stringify({...prior,...patch}).length>12_000_000)throw Error('Local '+name+' storage is full. Remove older records before retrying.');api.setView(name,patch);};
 if(!text.trim())throw Error('Read or write message content before sending.');
 if(action==='a message to maya'||action==='a reply to the sender'){
  const senders=Object.entries(messages||{}).filter(([,rows])=>rows.some(row=>!row.me));
  if(action==='a reply to the sender'&&senders.length!==1)throw Error('Read messages from one sender before replying.');
  const state=current('messages'),pid=action==='a message to maya'?'maya':senders[0][0],rows=state.threads[pid]||[];
  const receipts=Object.entries(state.threads as Record<string,Bag[]>).flatMap(([owner,thread])=>thread.filter(row=>row.id===operationId).map(row=>({owner,row})));
  if(receipts.some(receipt=>receipt.owner!==pid)||receipts.length>1)throw Error('Saved message receipt belongs to another recipient.');
  const existing=receipts[0]?.row;
  if(existing){if(existing.text!==text||!existing.me)throw Error('Saved message receipt does not match this step.');return {output:text,detail:'Local message saved ('+operationId+')'};}
  if(action==='a reply to the sender'&&senders[0][1].filter(row=>!row.me).some(original=>!rows.some((row:Bag)=>JSON.stringify(row)===JSON.stringify(original))))throw Error('Source messages changed. Read them again before replying.');
  const now=new Date(),k=Math.max(now.getHours()*60+now.getMinutes()-1,...Object.values(state.threads as Bag).flatMap((messages:any)=>messages.map((m:Bag)=>Number(m.k)||0)))+1;
  save('messages',{threads:{...state.threads,[pid]:[...rows,{id:operationId,k,me:true,text,workflowStep:operationId}]}});
  return {output:text,detail:'Local message saved ('+operationId+')'};
 }
 if(action==='an email to me'){
  const state=current('inbox'),existing=state.sent.find((mail:Bag)=>mail.id===operationId);
  if(existing){if(existing.body!==text||existing.to?.[0]!=='you@alpha.local')throw Error('Saved email receipt does not match this step.');return {output:text,detail:'Local email saved ('+operationId+')'};}
  save('inbox',{sent:[{id:operationId,sent:true,to:['you@alpha.local'],cc:[],bcc:[],acct:'personal',subj:'Workflow output',body:text,time:'Now',k:Date.now(),atts:[],workflowStep:operationId},...state.sent]});
  return {output:text,detail:'Local email saved ('+operationId+')'};
 }
 throw Error('Choose a recipient for this local send step.');
}
