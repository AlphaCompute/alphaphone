import type {HostedLiveSelection} from '../runtime/hosted-digests';
import {calendarRange,type CalendarRecord} from './calendar-records';
import type {DevelopmentIdentity} from './development-identity';
export const browserDigestAccount=(identity:DevelopmentIdentity,revision:string)=>({accountId:'browser:'+identity.namespace,accountRevision:revision,label:'Browser Inbox and Calendar',kinds:['email','calendar']});
export function validateBrowserDigestSelection(value:any,identity:DevelopmentIdentity,revision:string,account=browserDigestAccount(identity,revision)):HostedLiveSelection{
 if(!/^[a-f0-9]{64}$/.test(revision)||!value||value.provider!=='google'||value.accountId!==account.accountId||value.accountRevision!==revision||!account.kinds.includes(value.kind)||!Number.isInteger(value.windowHours)||value.windowHours<1||value.windowHours>168||!Number.isInteger(value.maxItems)||value.maxItems<1||value.maxItems>25||value.kind==='calendar'&&value.calendarId!=='local')throw Error('Source access changed.');
 return {provider:'google',accountId:value.accountId,accountRevision:revision,kind:value.kind,windowHours:value.windowHours,maxItems:value.maxItems,...(value.kind==='calendar'?{calendarId:'local'}:{})};
}
const text=(v:unknown,max:number)=>typeof v==='string'?v.slice(0,max):'';
/** Copy only the reviewed bounded fields, never attachments or full message bodies. */
export function readBrowserDigestSource(selection:HostedLiveSelection,now:number){
 const begin=selection.kind==='email'?now-selection.windowHours*3600000:now,end=selection.kind==='email'?now:now+selection.windowHours*3600000;
 if(selection.kind==='email'){
  const data=JSON.parse(localStorage.getItem('alpha.dev.app.inbox')||'{}');if(data.mails!==undefined&&!Array.isArray(data.mails))throw Error('Inbox data needs recovery.');
  const rows=(data.mails||[]).filter((row:any)=>!row.arch&&!row.del&&Number.isFinite(row.receivedAt)&&row.receivedAt>=begin&&row.receivedAt<=end).sort((a:any,b:any)=>b.receivedAt-a.receivedAt||String(a.id).localeCompare(String(b.id)));
  return {begin,end,truncated:rows.length>selection.maxItems,items:rows.slice(0,selection.maxItems).map((row:any)=>({id:String(row.id),subject:text(row.subj,300),snippet:text(row.snippet??row.body,200),receivedAt:new Date(row.receivedAt).toISOString()}))};
 }
 const data=JSON.parse(localStorage.getItem('alpha.browser.calendar.v1')||'{"events":[]}');if(!Array.isArray(data.events))throw Error('Calendar data needs recovery.');
 const rows=calendarRange((data.events as CalendarRecord[]).filter(row=>row.calendarId===selection.calendarId),{begin,end});
 return {begin,end,truncated:rows.truncated||rows.events.length>selection.maxItems,items:rows.events.slice(0,selection.maxItems).map(row=>({id:row.id,title:text(row.title,300),location:text(row.location,500),start:new Date(row.begin).toISOString(),end:new Date(row.end).toISOString(),allDay:row.allDay===true}))};
}
