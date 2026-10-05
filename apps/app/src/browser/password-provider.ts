import {layoutBrowserDialog} from './dialog-layout';
import {browserDevProfile} from './dev-profile';
import {revision} from './store';
import {passwordProviderDocument} from './preference-documents';
import {browserScreenLocked} from './screen-locked';
const key='alpha.browser.password-provider.v1';
type State={installed:boolean;selection:'none'|'proton';revision:string};
const initial=():State=>({installed:false,selection:'none',revision:'initial'});
function validate(state:State){if(!state||typeof state.installed!=='boolean'||!['none','proton'].includes(state.selection)||typeof state.revision!=='string'||state.selection==='proton'&&!state.installed)throw Error('Password settings could not be read.');return state;}
export async function passwordProviderStatus(){const state=validate(await passwordProviderDocument.read(initial));return {installation:state.installed?'installed':'absent',selection:state.selection,support:'available'};}
let dismiss:(()=>void)|undefined;
let opening:AbortController|undefined;
/** Development-only provider lifecycle. No secrets or host-provider APIs. */
export async function openPasswordProvider(action:string){
 if(!browserDevProfile||!['settings','install','open'].includes(action))throw Error('Choose a password provider action.');
 dismiss?.();opening?.abort();const abort=new AbortController();opening=abort;
 const pendingEvents=['pagehide','launcher-home','alpha:device-state','alpha:dev-incoming-call','alpha:password-provider-document-changed'];
 const pendingStorage=(event:StorageEvent)=>{if(event.key===key||event.key===null)abort.abort();};
 const cancelPending=()=>abort.abort(),pendingHidden=()=>{if(document.hidden)cancelPending();},pendingBack=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();cancelPending();};
 window.addEventListener('storage',pendingStorage);pendingEvents.forEach(event=>window.addEventListener(event,cancelPending));window.addEventListener('alpha-back',pendingBack,true);document.addEventListener('visibilitychange',pendingHidden);
 try{
 const state=validate(await passwordProviderDocument.read(initial,abort.signal));abort.signal.throwIfAborted();
 if(document.hidden||browserScreenLocked()||document.documentElement.dataset.devBackground==='true')throw Error('Open password settings in the foreground.');
 if(action==='open'&&!state.installed)throw Error('Add the development provider first.');
 const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Development password provider');dialog.style.cssText='box-sizing:border-box;width:min(92vw,380px);max-height:85dvh;overflow:auto;border:0;border-radius:20px;padding:24px;background:var(--bg,#fff);color:var(--fg,#111);font:16px system-ui';
 let closed=false,busy=false,unlocked=false;const previous=document.activeElement as HTMLElement|null;
 const events=['pagehide','launcher-home','alpha:device-state','alpha:dev-incoming-call','alpha:password-provider-document-changed'];
 const close=()=>{if(closed)return;closed=true;abort.abort();events.forEach(e=>window.removeEventListener(e,close));window.removeEventListener('storage',storage);window.removeEventListener('alpha-back',back,true);document.removeEventListener('visibilitychange',hidden);dialog.remove();if(dismiss===close)dismiss=undefined;previous?.focus();window.dispatchEvent(new Event('focus'));};
 const hidden=()=>{if(document.hidden)close();},back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();close();};
 const storage=(event:StorageEvent)=>{if(event.key===key||event.key===null)close();};
 const heading=document.createElement('h2');heading.textContent=action==='settings'?'Choose password provider':action==='install'?'Add development provider':'Development vault';
 const status=document.createElement('p');status.setAttribute('role','status');
 const content=document.createElement('div');
 const button=(label:string,run:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='display:block;width:100%;min-height:44px;margin:8px 0;font:inherit';b.onclick=run;return b;};
 const change=async(edit:(s:State)=>void)=>{if(busy||closed)return;busy=true;content.querySelectorAll('button').forEach(b=>b.disabled=true);try{await passwordProviderDocument.edit(initial,current=>{validate(current);if(current.revision!==state.revision)throw Error('Changed settings');edit(current);current.revision=revision();},abort.signal);if(!closed)close();}catch{if(!closed){status.textContent='Settings could not be saved. Close and reopen to try again.';}}finally{busy=false;}};
 if(action==='install'){status.textContent='Add a local provider with a sample account.';content.append(button('Add provider',()=>void change(s=>{s.installed=true;})));}
 else if(action==='settings'){status.textContent=state.selection==='proton'?'Development provider selected':'No provider selected';content.append(button('None',()=>void change(s=>{s.selection='none';})));if(state.installed)content.append(button('Proton Pass · development',()=>void change(s=>{s.selection='proton';})));else status.textContent='Add the development provider to select it.';}
 else{status.textContent='Vault locked';content.append(button('Unlock development vault',()=>{unlocked=true;status.textContent='Vault unlocked';content.replaceChildren();const sample=document.createElement('p');sample.textContent='Sample account · example.test · alex@example.test';content.append(sample,button('Fill sample sign-in',()=>void (async()=>{if(!unlocked||closed||busy)return;let current:State;try{current=validate(await passwordProviderDocument.read(initial,abort.signal));if(closed||abort.signal.aborted)return;}catch{if(closed)return;status.textContent='Password settings could not be read. Close and reopen to try again.';return;}if(current.revision!==state.revision){close();return;}if(current.selection!=='proton'){status.textContent='Choose the development provider before filling.';return;}const result=document.createElement('output');result.setAttribute('aria-label','Sample sign-in');result.textContent='example.test\nUsername: alex@example.test\nPassword: demo-only-password';result.style.whiteSpace='pre-line';content.replaceChildren(result,button('Lock vault',close));status.textContent='Sample sign-in filled';})()),button('Lock vault',close));}));}
 const done=button('Done',close);dialog.append(heading,status,content,done);layoutBrowserDialog(dialog,[done]);dialog.oncancel=e=>{e.preventDefault();close();};events.forEach(e=>window.addEventListener(e,close));window.addEventListener('storage',storage);window.addEventListener('alpha-back',back,true);document.addEventListener('visibilitychange',hidden);dismiss=close;(document.querySelector('.os')||document.body).append(dialog);dialog.showModal();return {status:'opened',destination:'development'};
 }finally{window.removeEventListener('storage',pendingStorage);pendingEvents.forEach(event=>window.removeEventListener(event,cancelPending));window.removeEventListener('alpha-back',pendingBack,true);document.removeEventListener('visibilitychange',pendingHidden);if(opening===abort)opening=undefined;}
}
