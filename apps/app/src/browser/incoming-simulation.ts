import {browserDevProfile} from './dev-profile';
type Api=Record<string,any>;
/** Incoming data stays in the same durable local stores used by the development apps. */
export function openIncomingSimulation(kind:'message'|'email',api:Api){
 if(!browserDevProfile)return;
 const dialog=document.createElement('dialog');dialog.setAttribute('aria-label',kind==='message'?'Incoming message':'Incoming email');dialog.style.cssText='box-sizing:border-box;width:min(380px,92vw);max-height:85dvh;overflow:auto;border:0;border-radius:20px;padding:20px;background:var(--bg,#fff);color:var(--fg,#111);font:16px/1.4 system-ui';
 const shell=document.querySelector('.os');if(shell){const theme=getComputedStyle(shell);for(const name of ['--bg','--fg','--s2'])dialog.style.setProperty(name,theme.getPropertyValue(name));}
 const heading=document.createElement('h2');heading.textContent=dialog.getAttribute('aria-label');dialog.append(heading);
 const field=(name:string,control:HTMLElement)=>{control.setAttribute('aria-label',name);control.style.cssText='box-sizing:border-box;width:100%;padding:8px;font:inherit;background:var(--bg,#fff);color:inherit';const label=document.createElement('label');label.textContent=name;label.style.cssText='display:grid;gap:4px;margin:10px 0';label.append(control);dialog.append(label);};
 const sender=document.createElement('select');for(const person of api.get('contacts').list||api.people||[])sender.add(new Option(person.name,person.id));sender.value='maya';if(!sender.value)sender.selectedIndex=0;field('From',sender);
 const subject=document.createElement('input');subject.maxLength=500;if(kind==='email')field('Subject',subject);
 const body=document.createElement('textarea');body.rows=5;body.maxLength=12000;field(kind==='message'?'Message':'Email body',body);
 const status=document.createElement('p');status.setAttribute('role','status');const deliver=document.createElement('button');deliver.textContent='Deliver';deliver.onclick=()=>{try{
  const person=(api.get('contacts').list||api.people||[]).find((p:Api)=>p.id===sender.value);if(!person)throw Error('Choose a sender.');if(!body.value.trim())throw Error('Enter a message.');if(kind==='email'&&!subject.value.trim())throw Error('Enter a subject.');
  const id=crypto.randomUUID(),now=new Date();
  if(kind==='message'){const state=api.get('messages'),threads=state.threads||{},k=Math.max(now.getHours()*60+now.getMinutes()-1,...Object.values(threads).flat().map((row:any)=>Number(row.k)||0))+1;api.setView('messages',{threads:{...threads,[person.id]:[...(threads[person.id]||[]),{id,k,me:false,text:body.value,receivedAt:now.getTime()}]},unread:{...state.unread,[person.id]:(state.unread?.[person.id]||0)+1}});}
  else{const state=api.get('inbox');api.setView('inbox',{mails:[...(state.mails||[]),{id,pid:person.id,acct:'work',k:now.getTime(),time:now.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),unread:true,subj:subject.value,body:body.value,atts:[],receivedAt:now.getTime()}]});}dialog.close();
 }catch(error){status.textContent=error instanceof Error?error.message:'Incoming data could not be saved.';}};
 const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.onclick=()=>dialog.close();for(const button of [deliver,cancel])button.style.cssText='min-height:44px;margin:4px;padding:8px 12px;font:inherit';dialog.append(status,deliver,cancel);
 const retire=()=>dialog.close(),hidden=()=>{if(document.hidden)retire();},events=['pagehide','alpha:device-state','launcher-home','alpha:dev-incoming-call'];const back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();retire();};events.forEach(event=>window.addEventListener(event,retire));document.addEventListener('visibilitychange',hidden);window.addEventListener('alpha-back',back,true);dialog.onclose=()=>{events.forEach(event=>window.removeEventListener(event,retire));document.removeEventListener('visibilitychange',hidden);window.removeEventListener('alpha-back',back,true);dialog.remove();};document.body.append(dialog);dialog.showModal();
}
