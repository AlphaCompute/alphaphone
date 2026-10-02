type Calendar={list:(range:{begin:number;end:number})=>Promise<{events:any[];truncated?:boolean}>};
const civil=(date:Date)=>Date.UTC(date.getFullYear(),date.getMonth(),date.getDate());
/** Calendar day ranges use local civil midnights; all-day records use UTC civil dates. */
export function workflowCalendarRange(label:string,now=new Date()){
 const text=label.toLowerCase().replaceAll('’',"'");const begin=new Date(now);begin.setHours(0,0,0,0);let days=1;
 if(text==="today's calendar"){}
 else if(text==="tomorrow's calendar")begin.setDate(begin.getDate()+1);
 else if(text==='calendar next 3 days')days=3;
 else if(text==="this week's calendar"){begin.setDate(begin.getDate()-(begin.getDay()+6)%7);days=7;}
 else return undefined;
 const end=new Date(begin);end.setDate(end.getDate()+days);
 return {begin:begin.getTime(),end:end.getTime(),civilBegin:civil(begin),civilEnd:civil(end)};
}
export async function readWorkflowCalendar(calendar:Calendar,range:NonNullable<ReturnType<typeof workflowCalendarRange>>,signal:AbortSignal){
 signal.throwIfAborted();const result=await calendar.list({begin:Math.min(range.begin,range.civilBegin),end:Math.max(range.end,range.civilEnd)});signal.throwIfAborted();
 if(result.truncated)throw Error('Calendar input exceeds the supported range. Choose fewer dates.');
 return result.events.filter(row=>row.allDay?row.begin<range.civilEnd&&row.end>range.civilBegin:row.begin<range.end&&row.end>range.begin);
}
export async function workflowInMeeting(calendar:Calendar,signal:AbortSignal,now=Date.now()){
 signal.throwIfAborted();const result=await calendar.list({begin:now,end:now+1});signal.throwIfAborted();
 if(result.truncated)throw Error('Calendar input is incomplete. Narrow the calendar before checking meetings.');
 return result.events.some(row=>!row.allDay&&row.begin<=now&&row.end>now&&(row.video===true||Array.isArray(row.who)&&row.who.length>0));
}
