import {browserDevProfile} from './dev-profile';
type Bag=Record<string,any>;
export const focusOwner=crypto.randomUUID();
const retired=new Set<string>();
export function focusChanged(){window.dispatchEvent(new Event('alpha:device-settings'));window.dispatchEvent(new Event('focus'));}
export function retireFocusRun(id:string){retired.add(id);focusChanged();}
export function activeFocusBlocks(){
 if(!browserDevProfile)return [];
 // An unreadable workflow store cannot own a device policy; preserve it for recovery.
 try{
  const state=JSON.parse(localStorage.getItem('alpha.dev.app.workflows')||'{}');
  if(!state||!Array.isArray(state.flows)||!state.localRuns||typeof state.localRuns!=='object'||Array.isArray(state.localRuns))return [];
  return (Object.values(state.localRuns) as Bag[]).filter(run=>{
   if(!run||typeof run!=='object')return false;
   const f=run.context?.focus,flow=state.flows.find((item:Bag)=>item&&String(item.id)===String(run.flowId));
   return !retired.has(run.id)&&run.status==='running'&&f?.owner===focusOwner&&f.phase==='active'&&f.dnd===true&&Number.isFinite(f.begin)&&Number.isFinite(f.end)&&Array.isArray(f.arrivals)&&f.arrivals.every((row:unknown)=>row&&typeof row==='object')&&f.begin<=Date.now()&&f.end>Date.now()&&flow?.on&&JSON.stringify({name:flow.name,trig:flow.trig,steps:flow.steps})===run.definition;
  });
 }catch{return [];}
}
export function focusActive(){return activeFocusBlocks().length>0;}
export function focusHoldsNotice(at:number){return activeFocusBlocks().some(run=>at>=run.context.focus.begin&&at<run.context.focus.end);}
export function focusAllowedNotices(){const rows=activeFocusBlocks().flatMap(run=>run.context.focus.arrivals.filter((row:Bag)=>row.allowed).map((row:Bag)=>({id:'focus:'+row.key,revision:row.key,source:'own',appLabel:'Messages',title:row.title,text:row.text,at:row.at,clearable:true,canOpen:true})));return [...new Map(rows.map(row=>[row.id,row])).values()];}
