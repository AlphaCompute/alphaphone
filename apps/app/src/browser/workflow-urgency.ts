import {browserScreenLocked} from './screen-locked';
export type UrgencyDecision={urgent:boolean;reason:string;source:'agent'|'development-review'};
const instruction='Decide whether the supplied workflow input needs immediate attention or prompt action. Routine informational content is not urgent. Consider the actual meaning, including negation, quoted text and deadlines; the presence of the word urgent alone is insufficient. Return exactly one JSON object with only urgent (a boolean) and reason (a brief string). Do not return Markdown or propose actions.';
export async function assessWorkflowUrgency(input:string,generate:(instruction:string,input:string,signal:AbortSignal)=>Promise<string|undefined>,signal:AbortSignal):Promise<UrgencyDecision>{
 signal.throwIfAborted();if(!input.trim()||input.length>16000)throw Error('Read or write notification content before checking urgency.');
 const text=await generate(instruction,input,signal);signal.throwIfAborted();
 if(text===undefined)return reviewUrgency(input,signal);
 let value:any;try{value=JSON.parse(text);}catch{throw Error('The agent did not return a valid urgency decision.');}
 if(!value||Array.isArray(value)||typeof value.urgent!=='boolean'||typeof value.reason!=='string'||!value.reason.trim()||value.reason.length>500||Object.keys(value).sort().join(',')!=='reason,urgent')throw Error('The agent did not return a valid urgency decision.');
 return {urgent:value.urgent,reason:value.reason.trim(),source:'agent'};
}
function reviewUrgency(input:string,signal:AbortSignal):Promise<UrgencyDecision>{
 signal.throwIfAborted();const blocked=()=>document.hidden||document.documentElement.dataset.devBackground==='true'||!!browserScreenLocked();
 if(blocked())return Promise.reject(new DOMException('Urgency review cancelled','AbortError'));
 return new Promise((resolve,reject)=>{
  const previous=document.activeElement as HTMLElement|null,dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Workflow urgency');dialog.style.cssText='box-sizing:border-box;width:min(380px,92vw);max-height:85dvh;overflow:auto;border:0;border-radius:20px;padding:20px;background:var(--bg,#fff);color:var(--fg,#111);font:16px/1.4 system-ui';
  const shell=document.querySelector('.os');if(shell){const theme=getComputedStyle(shell);for(const name of ['--bg','--fg','--s2'])dialog.style.setProperty(name,theme.getPropertyValue(name));}
  const title=document.createElement('h2');title.textContent='Workflow urgency';const intro=document.createElement('p');intro.textContent='Choose the urgency for this development run.';const label=document.createElement('label');label.textContent='Notification content';label.style.cssText='display:grid;gap:8px;margin:12px 0';const content=document.createElement('textarea');content.readOnly=true;content.value=input;content.rows=6;content.style.cssText='box-sizing:border-box;width:100%;padding:10px;border:1px solid #999;border-radius:10px;font:inherit;color:inherit;background:transparent';label.append(content);dialog.append(title,intro,label);
  let settled=false;const events=['pagehide','alpha:device-state','launcher-home','alpha:dev-incoming-call'];
  const finish=(urgent?:boolean)=>{if(settled)return;settled=true;signal.removeEventListener('abort',close);window.removeEventListener('alpha-back',back,true);for(const event of events)window.removeEventListener(event,close);document.removeEventListener('visibilitychange',hidden);dialog.close();dialog.remove();if(previous?.isConnected&&!blocked())previous.focus();urgent===undefined?reject(new DOMException('Urgency review cancelled','AbortError')):resolve({urgent,reason:urgent?'Marked urgent in development review.':'Marked not urgent in development review.',source:'development-review'});};
  const close=()=>finish(),hidden=()=>{if(document.hidden)close();},back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();close();};
  for(const [text,value] of [['Urgent',true],['Not urgent',false],['Cancel run',undefined]] as const){const button=document.createElement('button');button.textContent=text;button.style.cssText='min-height:44px;padding:10px 14px;margin:4px;border:1px solid #ccc;border-radius:10px;font:inherit;color:inherit;background:var(--s2,#f3f3f3)';button.onclick=()=>finish(value);dialog.append(button);}
  signal.addEventListener('abort',close,{once:true});window.addEventListener('alpha-back',back,true);for(const event of events)window.addEventListener(event,close);document.addEventListener('visibilitychange',hidden);dialog.onclose=close;document.body.append(dialog);if(signal.aborted||blocked()){close();return;}try{dialog.showModal();content.focus();}catch{close();}
 });
}
