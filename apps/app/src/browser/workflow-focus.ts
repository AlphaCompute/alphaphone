import {notificationState} from './notification-store';
import {focusOwner,focusChanged} from './focus-state';
import {registerPlugin} from '../platform-plugins';
type Bag=Record<string,any>;
export type FocusBlock={dnd?:boolean;flowId?:string;definition?:string;notificationEpoch?:string;owner:string;phase:'active'|'ended'|'cancelled';eventId:string;begin:number;end:number;eventSignature:string;seen:string[];arrivals:Bag[]};
export const isFocusWorkflow=(flow:Bag)=>flow.trig?.kind==='event'&&flow.trig.ev==='A deep-work event starts'&&flow.steps.some((step:Bag)=>step.k==='If'&&step.t.toLowerCase()==='a message is from maya, let it through');
const signature=(event:Bag)=>JSON.stringify([String(event.id),event.begin,event.end,event.title]);
async function sources(api:Bag){
 const app=(name:string)=>({...api.get(name),...JSON.parse(localStorage.getItem('alpha.dev.app.'+name)||'{}')});const rows:Bag[]=[],contacts=app('contacts').list||[];
 for(const [person,messages] of Object.entries(app('messages').threads||{}) as [string,Bag[]][])for(const message of messages)if(!message.me){const id=message.id??message.k;if(id===undefined)throw Error('An incoming message has no stable identity.');rows.push({key:JSON.stringify(['message',person,id]),kind:'message',person,title:contacts.find((p:Bag)=>p.id===person)?.name||person,text:message.text||message.file||'',at:message.receivedAt??Date.now(),allowed:person==='maya'});}
 for(const mail of app('inbox').mails||[])if(!mail.sent&&!mail.del&&!mail.arch)rows.push({key:JSON.stringify(['email',mail.id]),kind:'email',title:mail.subj||'Email',text:mail.body||'',at:mail.receivedAt??Date.now(),allowed:false});
 for(const notice of (await registerPlugin<any>('AlphaNotifications').focusSnapshot()).items)rows.push({key:JSON.stringify(['notification',notice.id,notice.revision]),kind:'notification',title:notice.source==='external'?(notice.appLabel||'Notification'):notice.title,text:notice.source==='external'?'Notification received':notice.text,at:notice.at,allowed:false});
 return rows;
}
export async function prepareFocus(api:Bag,event:Bag|undefined,signal:AbortSignal):Promise<FocusBlock>{
 signal.throwIfAborted();const now=Date.now();if(!event){const result=await registerPlugin<any>('AlphaCalendar').list({begin:now,end:now+1});if(result.truncated)throw Error('Focus Calendar input is incomplete.');const matches=result.events.filter((row:Bag)=>!row.allDay&&row.begin<=now&&row.end>now&&/deep[ -]?work/i.test(row.title));if(matches.length!==1)throw Error('Choose one active deep-work Calendar block before running.');event=matches[0];}
 if(!event||event.allDay||!Number.isFinite(event.begin)||!Number.isFinite(event.end)||event.end<=now||event.begin>now)throw Error('The focus block is not active.');
 const notificationEpoch=(await notificationState(signal)).epoch,seen=(await sources(api)).map(row=>row.key);signal.throwIfAborted();if((await notificationState(signal)).epoch!==notificationEpoch)throw Error('Notification settings changed. Review focus again.');signal.throwIfAborted();
 return {notificationEpoch,owner:focusOwner,phase:'active',eventId:String(event.id),begin:event.begin,end:event.end,eventSignature:signature(event),seen,arrivals:[]};
}
export function waitForFocusEnd(focus:FocusBlock,api:Bag,signal:AbortSignal,progress:(message:string)=>void):Promise<string>{
 return new Promise((resolve,reject)=>{
 let settled=false,busy=false;const finish=(error?:unknown,value?:string)=>{if(settled)return;settled=true;clearInterval(timer);window.removeEventListener('alpha:dev-app-change',tick);window.removeEventListener('focus',tick);signal.removeEventListener('abort',cancel);error?reject(error):resolve(value!);};
 const cancel=()=>finish(new DOMException('Focus cancelled','AbortError'));
 const tick=async()=>{if(busy||settled)return;busy=true;try{
  signal.throwIfAborted();const state={...api.get('workflows'),...JSON.parse(localStorage.getItem('alpha.dev.app.workflows')||'{}')},flow=state.flows.find((row:Bag)=>String(row.id)===focus.flowId);if(!flow?.on||JSON.stringify({name:flow.name,trig:flow.trig,steps:flow.steps})!==focus.definition)throw Error('The focus workflow changed. Focus was released.');const result=await registerPlugin<any>('AlphaCalendar').list({begin:focus.begin,end:focus.end});signal.throwIfAborted();if(settled)return;
  if(result.truncated||!result.events.some((event:Bag)=>signature(event)===focus.eventSignature))throw Error('The focus Calendar block changed. Focus was released.');
  const sourceSnapshot=['messages','inbox'].map(name=>localStorage.getItem('alpha.dev.app.'+name));const notificationEpoch=(await notificationState(signal)).epoch,policyChanged=notificationEpoch!==focus.notificationEpoch;const rows=await sources(api),currentEpoch=(await notificationState(signal)).epoch;signal.throwIfAborted();if(settled||sourceSnapshot.some((value,index)=>value!==localStorage.getItem('alpha.dev.app.'+['messages','inbox'][index]))||currentEpoch!==notificationEpoch)return;const seen=new Set(focus.seen),current=new Map(rows.map(row=>[row.key,row])),arrivals=focus.arrivals.flatMap(row=>{if(row.kind==='notification')return policyChanged?[]:[row];const updated=current.get(row.key);return updated?[{...updated,at:row.at}]:[];});for(const row of rows){if(seen.has(row.key))continue;seen.add(row.key);if(row.at>=focus.begin&&row.at<focus.end)arrivals.push(row);}
  if(seen.size>10000||arrivals.length>100||JSON.stringify(arrivals).length>15000)throw Error('The focus activity is too large for one summary. Focus was released.');
  const changed=policyChanged||seen.size!==focus.seen.length||JSON.stringify(arrivals)!==JSON.stringify(focus.arrivals);focus.notificationEpoch=notificationEpoch;focus.seen=[...seen];focus.arrivals=arrivals;
  if(Date.now()>=focus.end){focus.phase='ended';progress('Focus block ended');focusChanged();finish(undefined,JSON.stringify({begin:focus.begin,end:focus.end,held:arrivals.filter(row=>!row.allowed),allowed:arrivals.filter(row=>row.allowed)}));}
  else if(changed){progress('Focus active · '+arrivals.filter(row=>!row.allowed).length+' held · '+arrivals.filter(row=>row.allowed).length+' allowed');focusChanged();}
 }catch(error){finish(error);}finally{busy=false;}};
 const timer=setInterval(()=>void tick(),500);window.addEventListener('alpha:dev-app-change',tick);window.addEventListener('focus',tick);signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();else void tick();
 });
}
export function waitForFocusReview(api:Bag,flowId:string|number,signal:AbortSignal,definition?:string):Promise<void>{
 return new Promise((resolve,reject)=>{const finish=(error?:Error)=>{clearInterval(timer);signal.removeEventListener('abort',cancel);error?reject(error):resolve();},cancel=()=>finish(new DOMException('Focus cancelled','AbortError'));const check=()=>{try{const state={...api.get('workflows'),...JSON.parse(localStorage.getItem('alpha.dev.app.workflows')||'{}')},flow=state.flows.find((row:Bag)=>String(row.id)===String(flowId));if(!flow?.on||definition&&JSON.stringify({name:flow.name,trig:flow.trig,steps:flow.steps})!==definition){finish(Error('The focus workflow changed.'));return;}if(signal.aborted){cancel();return;}const foreground=!document.hidden&&document.documentElement.dataset.devBackground!=='true'&&!Array.from(document.querySelectorAll('[aria-label="Unlock with fingerprint"], [aria-label="Wake"]')).some(element=>element.getClientRects().length);if(foreground&&(api.localWorkflowReady?.()||api.isActive()&&String(api.get('workflows').open)===String(flowId)&&!document.querySelector('dialog[open]')))finish();}catch(error){finish(error instanceof Error?error:Error('Focus state could not be read.'));}};const timer=setInterval(check,250);signal.addEventListener('abort',cancel,{once:true});check();});
}
