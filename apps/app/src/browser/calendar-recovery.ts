import {layoutBrowserDialog} from './dialog-layout';
const key='alpha.browser.calendar.v1';
let current:HTMLDialogElement|undefined;
/** Explicit local-data recovery. Never rewrite or discard unreadable bytes on load. */
export function openCalendarRecovery(){
 if(current?.open)return;
 const dialog=current=document.createElement('dialog');dialog.setAttribute('aria-label','Browser calendar recovery');dialog.style.cssText='box-sizing:border-box;width:min(400px,94vw);max-height:85dvh;overflow:auto;padding:24px;border:0;border-radius:20px;background:var(--bg,#fff);color:var(--fg,#111);font:16px/1.5 system-ui';
 const previous=document.activeElement as HTMLElement|null;let closed=false,confirming=false,busy=false,raw:string|null=null,readable=true;
 try{raw=localStorage.getItem(key);}catch{readable=false;}
 const title=document.createElement('h2');title.textContent='Browser calendar recovery';
 const text=document.createElement('p');text.textContent='Download the saved browser calendar before resetting. Reset removes all local events, preferences and action receipts. Other apps are unaffected.';
 const status=document.createElement('p');status.setAttribute('role','status');status.textContent=readable?(raw===null?'No saved browser calendar.':'Saved data is retained until you confirm a reset.'):'Saved data could not be read. Reset is unavailable.';
 const button=(label:string)=>{const b=document.createElement('button');b.textContent=label;b.style.cssText='min-height:44px;margin:4px;padding:10px;font:inherit';return b;};
 const backup=button('Download calendar backup'),reset=button('Reset browser calendar'),close=button('Close recovery');backup.disabled=reset.disabled=!readable||raw===null;
 backup.onclick=()=>{const url=URL.createObjectURL(new Blob([raw!],{type:'application/octet-stream'})),link=document.createElement('a');link.href=url;link.download='Alpha-calendar-recovery.txt';document.body.append(link);try{link.click();status.textContent='Backup download requested. Check Downloads before resetting.';}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}};
 reset.onclick=()=>{if(busy||closed)return;if(!confirming){confirming=true;reset.textContent='Confirm calendar reset';status.textContent='This deletes all saved browser calendar data. Download a backup first if you want to keep it.';return;}busy=true;reset.disabled=true;
  void (async()=>{try{if(!navigator.locks?.request)throw Error('Safe browser storage is unavailable. Reset was not performed.');await navigator.locks.request(key,{mode:'exclusive'},()=>{if(closed||document.hidden)throw Error('Reset cancelled.');if(localStorage.getItem(key)!==raw)throw Error('Calendar data changed. Close and reopen recovery before resetting.');localStorage.removeItem(key);if(localStorage.getItem(key)!==null)throw Error('Reset could not be confirmed. Reload to inspect the calendar.');});if(!closed){status.textContent='Calendar reset. Reloading…';location.reload();}}catch(error){if(!closed){status.textContent=error instanceof Error?error.message:'Reset could not be confirmed. Reload to inspect the calendar.';confirming=false;reset.textContent='Reset browser calendar';reset.disabled=false;}}finally{busy=false;}})();
 };
 const dispose=()=>{if(closed)return;closed=true;dialog.remove();if(current===dialog)current=undefined;window.removeEventListener('alpha-back',back,true);window.removeEventListener('pagehide',dispose);window.removeEventListener('launcher-home',dispose);document.removeEventListener('visibilitychange',visibility);previous?.focus();};
 const back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();dispose();},visibility=()=>{if(document.hidden)dispose();};close.onclick=dispose;dialog.oncancel=e=>{e.preventDefault();dispose();};window.addEventListener('alpha-back',back,true);window.addEventListener('pagehide',dispose);window.addEventListener('launcher-home',dispose);document.addEventListener('visibilitychange',visibility);dialog.append(title,text,backup,reset,status,close);layoutBrowserDialog(dialog,[close]);(document.querySelector('.os')||document.body).append(dialog);dialog.showModal();close.focus();
}
