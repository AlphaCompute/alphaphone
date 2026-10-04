import { parseUnambiguousZonedDateTime as zonedTimeToEpoch } from '../vendor/eliza/packages/contracts/src/lifeops-normalize/time-util.ts';
import { DEVELOPMENT_PROPOSAL_VIEWS } from "../apps/app/src/runtime/development-view-contract.ts";
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { Action } from '@elizaos/core';
export const turns=new AsyncLocalStorage<{revision:number;proposals:any[];signal:AbortSignal}>();
export { zonedTimeToEpoch };
const views=new Set<string>(DEVELOPMENT_PROPOSAL_VIEWS);
const proposalAction:Action={
 name:'PREPARE_ALPHA_ACTION',contexts:['general','messaging'],roleGate:{minRole:'USER'},
 description:'When the user asks to create or save a note, create a one-time reminder, or open an Alpha Phone view, prepare a local action for explicit user approval. This only prepares a proposal; it NEVER saves, opens, or executes anything. Use kind create_note with title and body, kind create_reminder with title, body, localDateTime and timeZone, or kind open_view with view. Never claim the operation happened.',
 parameters:[
  {name:'kind',description:'create_note, create_reminder or open_view',required:true,schema:{type:'string',enum:['create_note','create_reminder','open_view']}},
  {name:'title',description:'Exact requested note or reminder title',required:false,schema:{type:'string'}},
  {name:'body',description:'Exact requested note or reminder body',required:false,schema:{type:'string'}},
  {name:'localDateTime',description:'Reminder wall-clock time as YYYY-MM-DDTHH:mm in the timeZone, exactly as the user stated it. Do not convert to UTC. Ask if the date or time is ambiguous. One-time only.',required:false,schema:{type:'string'}},
  {name:'timeZone',description:'IANA time zone for localDateTime, e.g. America/Los_Angeles. Ask if unknown.',required:false,schema:{type:'string'}},
  {name:'view',description:'Alpha view: '+[...views].join(', '),required:false,schema:{type:'string',enum:[...views]}}
 ],
 validate:async()=>true,
 handler:async(_runtime,_message,_state,options)=>{
  const turn=turns.getStore(),p=options?.parameters as any;
  if(!turn||turn.signal.aborted||turn.proposals.length>=4)return {success:false,text:'Proposal unavailable.'};
  let operation:any,title:string,description:string,at:number|null=null;
  if(p?.kind==='create_note'&&typeof p.title==='string'&&p.title.trim()&&p.title.length<=200&&typeof p.body==='string'&&p.body.length<=12000){
   operation={type:'create_note',title:p.title.trim(),body:p.body};title='Create note: '+operation.title;description='Save this note only on this device. Title: '+operation.title+'\n\n'+operation.body;
  }else if(p?.kind==='create_reminder'&&typeof p.title==='string'&&p.title.trim()&&p.title.length<=200&&typeof p.body==='string'&&p.body.length<=4000&&(at=zonedTimeToEpoch(p.localDateTime,p.timeZone))!==null&&at>Date.now()){
   operation={type:'create_reminder',title:p.title.trim(),body:p.body,at};title='Create reminder: '+operation.title;description='Schedule one reminder on this device at '+new Date(operation.at).toISOString()+'. Android delivery may be delayed. Title: '+operation.title+'\n\n'+operation.body;
  }else if(p?.kind==='open_view'&&views.has(p.view)){
   operation={type:'open_view',view:p.view};title='Open '+p.view;description='Navigate to the '+p.view+' view in Alpha Phone. No native action will run.';
  }else return {success:false,text:p?.kind==='create_reminder'?'Reminder parameters are invalid or the local time is ambiguous. Ask for an unambiguous date, time and time zone; nothing has been scheduled.':'Invalid local proposal parameters; nothing has been done.'};
  const proposal={id:randomUUID(),title,description,operation,contextRevision:turn.revision,expiresAt:Date.now()+120000};turn.proposals.push(proposal);
  return {success:true,text:'Prepared a proposal for explicit approval in the app. Nothing has been done yet.',data:{actionName:'PREPARE_ALPHA_ACTION',proposalId:proposal.id,executed:false}};
 }
};

export const proposalActions:Action[]=['create_note','create_reminder','open_view'].map(kind=>({
 ...proposalAction,
 name:kind==='create_note'?'CREATE_NOTE':kind==='create_reminder'?'CREATE_REMINDER':'OPEN_VIEW',
 description:kind==='create_note'?'Prepare a local note with title and body for user approval. Never saves anything. User approves separately in the app.':kind==='create_reminder'?'Prepare a one-time local reminder from title, body, local wall-clock localDateTime and IANA timeZone. Never schedules anything; separate explicit approval is required. Ask for clarification if timezone or date is ambiguous.':'Prepare opening an Alpha Phone view for user approval. Never navigates directly.',
 parameters:proposalAction.parameters!.filter(p=>kind==='create_note'?['title','body'].includes(p.name):kind==='create_reminder'?['title','body','localDateTime','timeZone'].includes(p.name):p.name==='view').map(p=>({...p,required:true})),
 handler:async(runtime,message,state,options,callback)=>proposalAction.handler(runtime,message,state,{...options,parameters:{...options?.parameters,kind}},callback)
}));
