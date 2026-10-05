import {layoutBrowserDialog} from './dialog-layout';
import type {DomainRecovery,BrowserDomainDocument} from './domain-document';
let current:HTMLDialogElement|undefined;
/** Exact-byte backup and explicitly confirmed, revision-checked recovery. */
export function openDomainRecovery(domain:Pick<BrowserDomainDocument,'capture'|'reset'>,name:'calendar'|'reminders',heading:string,description:string){
 if(current?.open)return;
 const dialog=current=document.createElement('dialog');dialog.setAttribute('aria-label',heading);dialog.style.cssText='box-sizing:border-box;width:min(400px,94vw);max-height:85dvh;overflow:auto;padding:24px;border:0;border-radius:20px;background:var(--bg,#fff);color:var(--fg,#111);font:16px/1.5 system-ui';
 const previous=document.activeElement as HTMLElement|null,abort=new AbortController();let closed=false,confirming=false,busy=false,captured:DomainRecovery|undefined;
 const title=document.createElement('h2');title.textContent=heading;
 const text=document.createElement('p');text.textContent=description;
 const status=document.createElement('p');status.setAttribute('role','status');status.textContent=`Reading saved ${name}…`;
 const button=(label:string)=>{const b=document.createElement('button');b.textContent=label;b.style.cssText='min-height:44px;margin:4px;padding:10px;font:inherit';return b;};
 const backup=button(`Download ${name} backup`),legacy=button(`Download older ${name} copy`),reset=button(`Reset browser ${name}`),close=button('Close recovery');backup.disabled=reset.disabled=true;legacy.hidden=true;
 const download=(raw:string,name:string)=>{const url=URL.createObjectURL(new Blob([raw],{type:'application/octet-stream'})),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);try{link.click();status.textContent='Backup download requested. Check Downloads before resetting.';}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}};
 backup.onclick=()=>{if(captured?.raw!==null&&captured?.raw!==undefined)download(captured.raw,captured.format==='domain'?`Alpha-${name}-recovery.txt`:`Alpha-${name}-store-recovery.txt`);};
 legacy.onclick=()=>{if(captured?.legacy!==null&&captured?.legacy!==undefined)download(captured.legacy,`Alpha-${name}-older-copy.txt`);};
 reset.onclick=()=>{if(busy||closed||!captured)return;if(!confirming){confirming=true;reset.textContent=`Confirm ${name} reset`;status.textContent=`This clears the active ${name}. Download any copies you want to keep before confirming.`;return;}busy=true;reset.disabled=true;
  void (async()=>{try{if(document.hidden)throw Error('Reset cancelled.');await domain.reset(captured!,abort.signal);if(!closed){status.textContent=`${name==='calendar'?'Calendar':'Reminders'} reset. Reloading…`;location.reload();}}catch(error){if(!closed){status.textContent=error instanceof Error?error.message:`Reset could not be confirmed. Reload to inspect the ${name}.`;confirming=false;reset.textContent=`Reset browser ${name}`;reset.disabled=false;}}finally{busy=false;}})();
 };
 const retireEvents=['pagehide','launcher-home','alpha:device-state','alpha:dev-incoming-call'];
 const dispose=()=>{if(closed)return;closed=true;abort.abort();dialog.remove();if(current===dialog)current=undefined;window.removeEventListener('alpha-back',back,true);for(const event of retireEvents)window.removeEventListener(event,dispose,true);document.removeEventListener('visibilitychange',visibility);previous?.focus();};
 const back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();dispose();},visibility=()=>{if(document.hidden)dispose();};close.onclick=dispose;dialog.oncancel=e=>{e.preventDefault();dispose();};window.addEventListener('alpha-back',back,true);for(const event of retireEvents)window.addEventListener(event,dispose,true);document.addEventListener('visibilitychange',visibility);dialog.append(title,text,backup,legacy,reset,status,close);layoutBrowserDialog(dialog,[close]);(document.querySelector('.os')||document.body).append(dialog);dialog.showModal();close.focus();
 void domain.capture(abort.signal).then(value=>{if(closed)return;captured=value;backup.disabled=value.raw===null;reset.disabled=value.raw===null&&!value.snapshot;legacy.hidden=value.legacy===null||value.legacy===value.raw;status.textContent=value.legacyChanged?'An older tab changed its saved copy. Download both versions and close older tabs before resetting.':value.format==='unrecognized'?`Saved ${name} metadata needs recovery. Download the original saved bytes before resetting.`:value.raw===null?`No saved browser ${name}.`:'Saved data is retained until you confirm a reset.';},()=>{if(!closed)status.textContent='Saved data could not be read. Reset is unavailable.';});
}
