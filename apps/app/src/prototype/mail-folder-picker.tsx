import React,{useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';

let activeFallback:{visible:()=>boolean;dismiss:()=>void}|undefined;
/** The shell's central Back router consumes only an actually visible legacy menu. */
export function dismissMailFolderMenu():boolean{if(!activeFallback?.visible())return false;activeFallback.dismiss();return true;}

type Folder={label:string;on?:boolean;disabled?:boolean;icon?:string|null;pick:()=>void};
/** Native top-layer popovers where supported; explicitly hidden, unclipped fallback on WebView113. */
export function MailFolderPicker({folders}:{folders:Folder[]}){
 const trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
 const [open,setOpen]=useState(false),focusEdge=useRef<'first'|'last'|null>(null);
 const modern=typeof HTMLElement.prototype.showPopover==='function';
 const selected=folders.find(folder=>folder.on);
 const close=(restoreFocus=false)=>{
  if(modern&&menu.current)try{menu.current.hidePopover();}catch{/* Already closed or detached. */}
  setOpen(false);if(restoreFocus&&trigger.current?.isConnected)trigger.current.focus();
 };
 const items=()=>Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')||[]);
 useLayoutEffect(()=>{
  if(!open||!menu.current||!trigger.current)return;
  const node=menu.current,button=trigger.current,theme=getComputedStyle(button),rect=button.getBoundingClientRect();
  for(const name of ['--bg','--fg','--s2','--mut','--line','--acct'])node.style.setProperty(name,theme.getPropertyValue(name));
  node.style.font=theme.font;node.style.width=`${Math.min(224,Math.max(44,window.innerWidth-32))}px`;
  node.style.maxHeight=`${Math.max(44,window.innerHeight-32)}px`;
  if(modern)try{node.showPopover();}catch{close(true);return;}
  const box=node.getBoundingClientRect();
  node.style.left=`${Math.max(16,Math.min(rect.right-box.width,window.innerWidth-box.width-16))}px`;
  node.style.top=`${Math.max(16,Math.min(rect.bottom+8,window.innerHeight-box.height-16))}px`;
  const edge=focusEdge.current;focusEdge.current=null;if(edge)items().at(edge==='last'?-1:0)?.focus();
 },[open]);
 useLayoutEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!menu.current?.contains(event.target)&&!trigger.current?.contains(event.target))close();};
  const back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();close(true);};
  const fallback={visible:()=>!!menu.current&&!menu.current.hidden&&menu.current.getClientRects().length>0,dismiss:()=>close(true)};
  if(!modern)activeFallback=fallback;
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape')back(event);else if(event.key==='Tab')close();};
  const hidden=()=>{if(document.hidden)close();};
  const resized=()=>close();
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',key,true);
  window.addEventListener('resize',resized);document.addEventListener('visibilitychange',hidden);
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',key,true);if(activeFallback===fallback)activeFallback=undefined;window.removeEventListener('resize',resized);document.removeEventListener('visibilitychange',hidden);};
 },[open]);
 const keyMenu=(event:React.KeyboardEvent)=>{
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  event.preventDefault();const buttons=items();if(!buttons.length)return;const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:index<0?(event.key==='ArrowUp'?buttons.length-1:0):(index+(event.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length;
  buttons[next].focus();
 };
 const toggle=(event:React.MouseEvent)=>{event.preventDefault();if(open)close();else setOpen(true);};
 return <span className="mail-folder-picker" style={selected?{width:112,background:'var(--fg)',color:'var(--bg)'}:undefined}>
  <button ref={trigger} className="mail-folder-trigger" aria-label="Other mail folders" aria-haspopup="menu" aria-expanded={open} aria-controls="alpha-mail-folders" popoverTarget={modern?'alpha-mail-folders':undefined} onClick={toggle} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();focusEdge.current=event.key==='ArrowUp'?'last':'first';if(open)items().at(event.key==='ArrowUp'?-1:0)?.focus();else setOpen(true);}}}>
   {selected?.label||'More'}<span aria-hidden="true" className="mail-folder-chevron"/>
  </button>
  {createPortal(<div ref={menu} id="alpha-mail-folders" className="mail-folder-menu" popover={modern?'auto':undefined} hidden={!open} role="menu" aria-label="Mail folders" onToggle={event=>{if(modern&&(event.nativeEvent as ToggleEvent).newState==='closed')setOpen(false);}} onKeyDown={keyMenu}>
   {folders.map(folder=><button key={folder.label} className="mail-folder-option" role="menuitemradio" aria-checked={folder.on===true} disabled={folder.disabled} onClick={()=>{close(true);folder.pick();}}>
    <span aria-hidden="true" className="mail-folder-option-icon" style={folder.icon?{maskImage:`url('${folder.icon}')`,WebkitMaskImage:`url('${folder.icon}')`}:undefined}/><span>{folder.label}</span><span aria-hidden="true" className="mail-folder-check" style={{visibility:folder.on?'visible':'hidden'}}/>
   </button>)}
  </div>,document.body)}
 </span>;
}
