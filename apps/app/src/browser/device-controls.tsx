import {browserDevProfile} from './dev-profile';
import {showSimulatorRecovery} from './simulator-recovery';
import { useEffect, useRef, useState } from 'react';
import { registerPlugin } from '../platform-plugins';
type Command='home'|'back'|'power'|'unlock'|'boot'|'assistant'|'shade'|'background'|'resume';
export function BrowserDeviceControls({command}:{command:(command:Command)=>void}) {
 const dialog=useRef<HTMLDialogElement>(null),[role,setRole]=useState('');
 useEffect(()=>{const back=(event:Event)=>{if(!dialog.current?.open)return;event.preventDefault();event.stopImmediatePropagation();dialog.current.close();};window.addEventListener('alpha-back',back,true);return()=>window.removeEventListener('alpha-back',back,true);},[]);
 const run=(action:Command)=>{dialog.current?.close();command(action);};
 return <><button aria-label="Device controls" style={{position:'fixed',left:8,bottom:8,zIndex:90,fontSize:12}} onClick={()=>dialog.current?.showModal()}>Device controls</button>
 <dialog ref={dialog} aria-label="Development device controls" style={{maxWidth:'min(340px,85vw)',border:0,borderRadius:18,padding:24,background:'var(--bg)',color:'var(--fg)'}}>
 <h2>Device controls</h2><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
 {([['home','Home'],['back','Back'],['power','Power'],['unlock','Unlock'],['boot','Restart'],['assistant','Assistant'],['shade','Notifications'],['background','Background'],['resume','Resume']] as [Command,string][]).map(([action,label])=><button key={action} onClick={()=>run(action)}>{label}</button>)}
 <button onClick={()=>location.reload()}>Reload app</button>
 {browserDevProfile&&<button onClick={()=>{dialog.current?.close();showSimulatorRecovery();}}>Saved app recovery</button>}
 <button onClick={()=>{dialog.current?.close();void registerPlugin<{compose():Promise<void>}>('AlphaNotifications').compose();}}>Post notification</button>
 {['home','assistant','dialer','sms'].map(value=><button key={value} onClick={()=>{void registerPlugin<{requestRole(input:{role:string}):Promise<unknown>}>('ElizaSystem').requestRole({role:value}).then(()=>setRole(`${value} selected`));}}>Use as {value}</button>)}
 </div><p role="status">{role}</p><button onClick={()=>dialog.current?.close()}>Done</button>
 </dialog></>;
}
