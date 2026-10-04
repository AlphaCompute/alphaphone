import {layoutBrowserDialog} from './dialog-layout';
type Bag=Record<string,any>;
type Failure={title:string;raw?:string};
const failures=new Map<string,Failure>();
const key=(name:string)=>'alpha.dev.app.'+name;
const object=(value:unknown):value is Bag=>!!value&&typeof value==='object'&&!Array.isArray(value);
/** Only persisted fields can enter a simulator; damaged records stay untouched. */
export function loadSimulatedState(name:string,view:Bag,onRead?:(raw:string|null)=>void){
 let raw:string|null|undefined;
 try{
  raw=localStorage.getItem(key(name));onRead?.(raw);if(raw===null)return {};
  if(raw.length>(['inbox','messages'].includes(name)?12_000_000:2_000_000))throw Error('Saved app is too large');
  const saved=JSON.parse(raw);if(!object(saved))throw Error('Invalid saved app');
  for(const [field,value] of Object.entries(saved)){
   if(!view.persist.includes(field))throw Error('Unknown saved field');const initial=view.state[field];
   if(Array.isArray(initial)){if(!Array.isArray(value)||value.some(row=>!object(row)))throw Error('Invalid saved list');}
   else if(object(initial)){if(!object(value))throw Error('Invalid saved map');}
   else if(typeof value!==typeof initial||typeof value==='number'&&!Number.isFinite(value))throw Error('Invalid saved value');
   if(name==='messages'&&field==='threads'&&Object.values(value as Bag).some(rows=>!Array.isArray(rows)||rows.some(row=>!object(row))))throw Error('Invalid saved messages');
  }
  return saved;
 }catch{failures.set(name,{title:view.title,raw:raw??undefined});return {};}
}
export function simulatorNeedsRecovery(name:string){return failures.has(name);}
let dialog:HTMLDialogElement|undefined;
export function showSimulatorRecovery(){
 if(dialog?.open)return;
 const own=dialog=document.createElement('dialog');own.setAttribute('aria-label','Saved app recovery');own.style.cssText='box-sizing:border-box;width:min(400px,94vw);max-height:85dvh;overflow:auto;border:0;border-radius:22px;padding:24px;background:var(--bg,#fff);color:var(--fg,#111);font:16px/1.5 system-ui';
 const shell=document.querySelector('.os');if(shell){const theme=getComputedStyle(shell);for(const k of ['--bg','--fg','--s2'])own.style.setProperty(k,theme.getPropertyValue(k));}
 const heading=document.createElement('h2');heading.textContent='Saved app recovery';const intro=document.createElement('p');intro.textContent=failures.size?'Some saved development apps could not be opened. Their original data is retained. Other apps remain available.':'Saved development apps are ready.';own.append(heading,intro);
 const button=(text:string)=>{const b=document.createElement('button');b.textContent=text;b.style.cssText='min-height:44px;margin:4px;padding:10px 14px;border:1px solid #aaa;border-radius:12px;background:var(--s2,#eee);color:inherit;font:inherit';return b;};
 for(const [name,failure] of failures){
  const section=document.createElement('section'),title=document.createElement('h3'),status=document.createElement('p');title.textContent=failure.title;status.setAttribute('role','status');const backup=button('Download '+failure.title+' backup'),reset=button('Reset '+failure.title);backup.disabled=reset.disabled=failure.raw===undefined;
  backup.onclick=()=>{const url=URL.createObjectURL(new Blob([failure.raw!],{type:'application/octet-stream'})),link=document.createElement('a');link.href=url;link.download='Alpha-'+name+'-recovery.txt';document.body.append(link);try{link.click();status.textContent='Backup download requested. Check Downloads before resetting.';}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}};
  let confirming=false;reset.onclick=()=>{if(!confirming){confirming=true;reset.textContent='Confirm reset '+failure.title;status.textContent='Reset deletes this app’s saved development data and restores its examples. Download a backup first if you want to keep it.';return;}try{if(localStorage.getItem(key(name))!==failure.raw)throw Error('Changed');localStorage.removeItem(key(name));if(localStorage.getItem(key(name))!==null)throw Error('Unconfirmed');location.reload();}catch{confirming=false;reset.textContent='Reset '+failure.title;status.textContent='Reset could not be confirmed. Reload to inspect the current saved data.';}};
  section.append(title,backup,reset,status);own.append(section);
 }
 const close=button('Close recovery');close.onclick=()=>own.close();own.append(close);const previous=document.activeElement as HTMLElement|null;const back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();own.close();};window.addEventListener('alpha-back',back,true);own.onclose=()=>{window.removeEventListener('alpha-back',back,true);own.remove();if(dialog===own)dialog=undefined;previous?.focus();};layoutBrowserDialog(own,[close]);document.body.append(own);own.showModal();heading.tabIndex=-1;heading.focus();own.scrollTop=0;
}
