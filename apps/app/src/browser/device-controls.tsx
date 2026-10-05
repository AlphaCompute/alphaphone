import {openBookmarkRecovery,openAlertSoundRecovery,openPasswordProviderRecovery} from './preference-recovery';
import './device-controls.css';
import {openNotificationRecovery} from './notification-recovery';
import {openLocationControls} from './location-simulation';
import {openReminderRecovery} from './reminder-recovery';
import {openCalendarRecovery} from './calendar-recovery';
import {browserDevProfile} from './dev-profile';
import {showSimulatorRecovery} from './simulator-recovery';
import { useEffect, useRef, useState } from 'react';
import { registerPlugin } from '../platform-plugins';
type Command='home'|'back'|'power'|'unlock'|'boot'|'assistant'|'shade'|'background'|'resume';
export function BrowserDeviceControls({command}:{command:(command:Command)=>void}) {
 const dialog=useRef<HTMLDialogElement>(null),[role,setRole]=useState(''),[savingRole,setSavingRole]=useState(false);
 useEffect(()=>{const back=(event:Event)=>{if(!dialog.current?.open)return;event.preventDefault();event.stopImmediatePropagation();dialog.current.close();};window.addEventListener('alpha-back',back,true);return()=>window.removeEventListener('alpha-back',back,true);},[]);
 const run=(action:Command)=>{dialog.current?.close();command(action);};
 const open=()=>{const phone=document.querySelector<HTMLElement>('.os');if(phone&&dialog.current){const theme=getComputedStyle(phone);for(const key of ['bg','fg','s2','line','mut'])dialog.current.style.setProperty(`--dev-${key}`,theme.getPropertyValue(`--${key}`));}dialog.current?.showModal();};
 const changeProfile=()=>{const url=new URL(location.href);if(browserDevProfile)url.searchParams.delete('mode');else url.searchParams.set('mode','dev');location.assign(url.href);};
 return <><div className="alpha-dev-tools" data-dev-profile={browserDevProfile?'true':'false'}>
 <button className="alpha-dev-opener" aria-label="Device controls" aria-describedby="alpha-dev-profile-label" title="Device controls" onClick={open}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h4m4 0h10M3 12h10m4 0h4M3 18h4m4 0h10"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/></svg></button>
 <span id="alpha-dev-profile-label">{browserDevProfile?'Dev data':'Tools'}</span></div>
 <dialog ref={dialog} className="alpha-dev-controls" aria-label="Development device controls">
 <header><h2>Device controls</h2><button aria-label="Close device controls" onClick={()=>dialog.current?.close()}>×</button></header>
 <p>{browserDevProfile?'Development profile · local simulated data':'App profile'}</p>
 <div className="alpha-dev-actions">
 {([['home','Home'],['back','Back'],['power','Power'],['unlock','Unlock'],['boot','Restart'],['assistant','Assistant'],['shade','Notifications'],['background','Background'],['resume','Resume']] as [Command,string][]).map(([action,label])=><button key={action} onClick={()=>run(action)}>{label}</button>)}
 <button onClick={()=>location.reload()}>Reload app</button>
 {browserDevProfile&&<button onClick={()=>{dialog.current?.close();try{openLocationControls();}catch(error){setRole(error instanceof Error?error.message:'Location could not be opened.');dialog.current?.showModal();}}}>Location</button>}
 {browserDevProfile&&<button onClick={()=>{dialog.current?.close();window.dispatchEvent(new Event('alpha:dev-pickup'));}}>Pick up phone</button>}
 {browserDevProfile&&<button onClick={()=>{dialog.current?.close();window.dispatchEvent(new Event('alpha:dev-incoming-call'));}}>Incoming call</button>}
 {browserDevProfile&&(['message','email'] as const).map(kind=><button key={kind} onClick={()=>{dialog.current?.close();window.dispatchEvent(new CustomEvent('alpha:dev-incoming-data',{detail:kind}));}}>Incoming {kind}</button>)}
 <button onClick={()=>{dialog.current?.close();openCalendarRecovery();}}>Calendar recovery</button>
 <button onClick={()=>{dialog.current?.close();openReminderRecovery();}}>Reminder recovery</button>
 <button onClick={()=>{dialog.current?.close();openNotificationRecovery();}}>Notification recovery</button>
 <button onClick={()=>{dialog.current?.close();openBookmarkRecovery();}}>Bookmark recovery</button>
 <button onClick={()=>{dialog.current?.close();openAlertSoundRecovery();}}>Notification sound recovery</button>
 {browserDevProfile&&<button onClick={()=>{dialog.current?.close();openPasswordProviderRecovery();}}>Password provider recovery</button>}
 {browserDevProfile&&<button onClick={()=>{dialog.current?.close();showSimulatorRecovery();}}>Saved app recovery</button>}
 <button onClick={()=>{dialog.current?.close();void registerPlugin<{compose():Promise<void>}>('AlphaNotifications').compose();}}>Post notification</button>
 {['home','assistant','dialer','sms'].map(value=><button key={value} disabled={savingRole} onClick={()=>{setSavingRole(true);void registerPlugin<{requestRole(input:{role:string}):Promise<unknown>}>('ElizaSystem').requestRole({role:value}).then(()=>setRole(`${value} selected`)).catch(()=>setRole('Role could not be saved. Try again.')).finally(()=>setSavingRole(false));}}>Use as {value}</button>)}
 </div><p role="status">{role}</p><button onClick={changeProfile}>{browserDevProfile?'Use app profile':'Use development profile'}</button><button onClick={()=>dialog.current?.close()}>Done</button>
 </dialog></>;
}
