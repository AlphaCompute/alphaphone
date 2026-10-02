import {workflowCalendarRange,readWorkflowCalendar} from './workflow-calendar';
type Bag=Record<string,any>;
export function workflowDateRange(kind:'today'|'week'|'overnight',now=new Date()){
 const begin=new Date(now);begin.setHours(0,0,0,0);const end=new Date(begin);
 if(kind==='week'){begin.setDate(begin.getDate()-(begin.getDay()+6)%7);end.setTime(begin.getTime());end.setDate(end.getDate()+7);}
 else if(kind==='overnight'){begin.setDate(begin.getDate()-1);begin.setHours(18);end.setHours(9);end.setTime(Math.min(end.getTime(),now.getTime()));}
 else end.setDate(end.getDate()+1);
 return {begin:begin.getTime(),end:end.getTime()};
}
export function datedRows(rows:Bag[],range:{begin:number;end:number},kind:'notes'|'received'|'sent'){
 let undated=0;const items=rows.filter(row=>{const time=kind==='notes'?row.modifiedAt??row.createdAt:kind==='received'?row.receivedAt:row.sentAt??(row.k>10_000_000_000?row.k:undefined);if(typeof time!=='number'||!Number.isFinite(time)){undated++;return false;}return time>=range.begin&&time<range.end;});
 return {...range,items:structuredClone(items),undated};
}
export async function readDatedWorkflowSource(label:string,api:Bag,calendar:any,signal:AbortSignal,now=new Date()){
 const text=label.toLowerCase().replaceAll('’',"'");
 if(!["today's notes",'overnight inbox',"overnight inbox and today's calendar","this week's calendar, notes and sent mail","today's calendar, notes and sent mail"].includes(text))return undefined;
 signal.throwIfAborted();const current=()=>({...api.get('inbox'),...JSON.parse(localStorage.getItem('alpha.dev.app.inbox')||'{}')});
 if(text==='overnight inbox')return {inbox:datedRows(current().mails.filter((row:Bag)=>!row.arch&&!row.del),workflowDateRange('overnight',now),'received')};
 if(text==="today's notes"){const notes=await api.localWorkflowNotes({},signal);signal.throwIfAborted();return {notes:datedRows(notes,workflowDateRange('today',now),'notes')};}
 const week=text.startsWith("this week's"),range=workflowDateRange(week?'week':'today',now);
 const events=await readWorkflowCalendar(calendar,workflowCalendarRange(week?"this week's calendar":"today's calendar",now)!,signal);signal.throwIfAborted();
 if(text.startsWith('overnight'))return {calendar:events,inbox:datedRows(current().mails.filter((row:Bag)=>!row.arch&&!row.del),workflowDateRange('overnight',now),'received')};
 const notes=await api.localWorkflowNotes({},signal);signal.throwIfAborted();return {calendar:events,notes:datedRows(notes,range,'notes'),sentMail:datedRows(current().sent,range,'sent')};
}
