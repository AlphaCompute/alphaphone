import { DailyApps, type ClockRequest, type ClockResult } from '../daily';
type Bag=Record<string,any>;
const KEY='alphaphone:clock-handoff:v1';
const actions=['set','show','snooze','dismiss'] as const;
/** A reviewed handoff, never a local alarm database or a provider-success claim. */
export function installClockAdapter(Component:any,views:Bag,options:{simulated:boolean;browser?:boolean}) {
 const p=Component.prototype,render=views.calendar.render;
 let owner:any,open=false,action:ClockRequest['action']='set',time='07:00',label='',snooze='10',review:ClockRequest|null=null,busy=false,message='',generation=0;
 const simulated=()=>options.simulated||document.documentElement.dataset.connectionMode==='mock';
 const publish=()=>owner?.vset('calendar',{});
 const restore=()=>{
  if(simulated())return;
  try {const last=JSON.parse(localStorage.getItem(KEY)||'null');if(last&&actions.includes(last.action)&&typeof last.status==='string')message=last.status==='opening'||last.status==='unknown'?'Previous Clock result is unknown. Check Clock before repeating a request.':'Previous request was a handoff. Check Clock for its result.';}
  catch {message='Clock handoff history could not be read. Check Clock before repeating a request.';}
 };
 const close=()=>{if(!busy){open=false;review=null;publish();queueMicrotask(()=>document.querySelector<HTMLButtonElement>('button[aria-label="Clock alarms"]')?.focus());}};
 const back=(event:Event)=>{if(!open)return;event.preventDefault();event.stopImmediatePropagation();close();};
 const key=(event:KeyboardEvent)=>{
  if(!open)return;if(event.key==='Escape'){back(event);return;}
  if(event.key==='Tab'){
   const items=Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-label="Clock alarms"] button,[role="dialog"][aria-label="Clock alarms"] input'));
   const first=items[0],last=items.at(-1);
   if(first&&last&&((event.shiftKey&&document.activeElement===first)||(!event.shiftKey&&document.activeElement===last))){event.preventDefault();(event.shiftKey?last:first).focus();}
  }
 };
 const mount=p.componentDidMount,unmount=p.componentWillUnmount;
 p.componentDidMount=function(){mount.call(this);owner=this;restore();window.addEventListener('alpha-back',back,true);document.addEventListener('keydown',key,true);};
 p.componentWillUnmount=function(){if(owner===this){window.removeEventListener('alpha-back',back,true);document.removeEventListener('keydown',key,true);owner=null;open=false;review=null;++generation;}unmount.call(this);};
 const change=(fn:()=>void)=>{if(busy)return;fn();review=null;publish();};
 const build=():ClockRequest=>{
  if(action==='set'){
   if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||label.length>200||label.includes('\0'))throw Error('Choose a valid time and a label up to 200 characters.');
   const [hour,minute]=time.split(':').map(Number);return {action,hour,minute,label:label.trim(),reviewed:true};
  }
  if(action==='snooze'){
   if(!/^\d{1,2}$/.test(snooze)||Number(snooze)<1||Number(snooze)>60)throw Error('Choose 1 to 60 snooze minutes.');
   return {action,snoozeMinutes:Number(snooze),reviewed:true};
  }
  return {action,reviewed:true};
 };
 const description=(request:ClockRequest)=>request.action==='set'?`Ask Clock to set an alarm at ${String(request.hour).padStart(2,'0')}:${String(request.minute).padStart(2,'0')}${request.label?` named “${request.label}”`:''}, using the phone’s local time. Review the alarm in Clock.`:request.action==='show'?'Open the installed Clock app’s alarms page.':request.action==='snooze'?`Ask Clock to snooze ringing alarms, requesting ${request.snoozeMinutes} minutes. Clock may use its default duration and snooze all ringing alarms. If nothing is ringing, Clock may do nothing.`:'Ask Clock to dismiss the active alarm. If there is more than one, Clock may ask you to choose. A one-time alarm is disabled; a repeated alarm skips its upcoming occurrence.';
 const dispatch=async(request:ClockRequest)=>{
  if(busy||review!==request)return;
  if(document.hidden){message='Return to Alpha Phone and review again.';review=null;publish();return;}
  if(simulated()){message='Mock mode: Clock request simulated. No alarm was changed and no app was opened.';review=null;publish();return;}
  const id=crypto.randomUUID(),token=generation;
  try {localStorage.setItem(KEY,JSON.stringify({id,action:request.action,status:'opening',at:new Date().toISOString()}));}
  catch {message='Clock request was not sent because its handoff record could not be saved.';publish();return;}
  busy=true;review=null;message='Opening Clock…';publish();
  let result:ClockResult;
  try {result=await DailyApps.clockHandoff(request);if(result.action!==request.action||!['opened','unavailable','denied','failed','unknown'].includes(result.status))throw Error();}
  catch {result={action:request.action,status:'unknown',message:'Clock result is unknown. Check Clock before repeating the request.'};}
  // The Activity may now be backgrounded. Persist the handoff, never replay it.
  try {const current=JSON.parse(localStorage.getItem(KEY)||'null');if(current?.id===id)localStorage.setItem(KEY,JSON.stringify({id,action:request.action,status:result.status,at:new Date().toISOString()}));}
  catch {result={...result,message:'Clock may have opened, but its handoff record could not be saved. Check Clock before trying again.'};}
  busy=false;
  if(token===generation){message=result.message;publish();}
 };
 views.calendar.render=(state:Bag,api:Bag)=>{
  const out=render(state,api);
  out.openClock=()=>{if(busy)return;if(options.browser&&!simulated()){void DailyApps.clockHandoff({action:'show',reviewed:true}).catch(()=>api.toast('Clock could not be opened. Try again.'));return;}open=true;review=null;restore();publish();queueMicrotask(()=>document.querySelector<HTMLButtonElement>('button[aria-label="Close Clock"]')?.focus());};
  const currentReview=review;
  out.clock=open?{
   title:'Clock',topPadding:simulated()?'76px':'44px',message,busy,isSet:action==='set',isSnooze:action==='snooze',time,label,snooze,
   zone:Intl.DateTimeFormat().resolvedOptions().timeZone,
   close,
   actions:actions.map(kind=>({label:kind==='set'?'Set alarm':kind==='show'?'Show alarms':kind==='snooze'?'Snooze':'Dismiss',pick:()=>change(()=>{action=kind;}),css:action===kind?'background:var(--fg);color:var(--bg)':'background:var(--s2);color:var(--fg)'})),
   onTime:(e:Bag)=>change(()=>{time=e.target.value;}),onLabel:(e:Bag)=>change(()=>{label=e.target.value;}),onSnooze:(e:Bag)=>change(()=>{snooze=e.target.value;}),
   prepare:()=>{if(busy)return;try{review=build();message='';}catch(error){message=(error as Error).message;}publish();},
   review:currentReview?{text:description(currentReview),confirm:()=>dispatch(currentReview),cancel:()=>change(()=>{}),label:simulated()?'Simulate Clock request':'Continue to Clock'}:null,
  }:null;
  return out;
 };
}
