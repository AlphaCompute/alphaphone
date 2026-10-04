import {holdPhoneInert} from './modal-inert';

/** Focus ownership for a phone-positioned modal and its pointer-only backdrop. */
export function createInlineModal(close:()=>void,returnFocus?:()=>HTMLElement|null) {
 let mounted:HTMLElement|null=null, dispose:(()=>void)|undefined;
 const ref=(container:HTMLElement|null):void=>{
  if(container===mounted)return;
  dispose?.();dispose=undefined;mounted=container;
  if(!container)return;
  const dialog=container.querySelector<HTMLElement>('[role="dialog"]');
  if(!dialog)return;
  const previous=returnFocus?.()||(document.activeElement instanceof HTMLElement?document.activeElement:null);
  const releases:Array<()=>void>=[],backgrounds:HTMLElement[]=[];
  let branch:HTMLElement=container;
  const phone=container.closest<HTMLElement>('.os');
  while(branch!==phone&&branch.parentElement){
   for(const sibling of branch.parentElement.children)if(sibling!==branch&&sibling instanceof HTMLElement&&!sibling.inert)backgrounds.push(sibling);
   branch=branch.parentElement;
  }
  const ownsFocus=()=>container.isConnected&&!container.closest('[inert]')&&!document.querySelector('dialog[open]');
  const controls=()=>Array.from(dialog.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href],[tabindex]')).filter(element=>!element.matches(':disabled,[tabindex="-1"]')&&!element.closest('[inert],[hidden]')&&element.getClientRects().length>0);
  const focus=()=>{(controls()[0]||dialog).focus({preventScroll:true});};
  dialog.tabIndex=-1;
  const key=(event:KeyboardEvent)=>{
   if(!ownsFocus())return;
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}
   if(event.key!=='Tab')return;
   const items=controls(),first=items[0],last=items.at(-1),active=document.activeElement;
   if(!first){event.preventDefault();dialog.focus();}
   else if(event.shiftKey&&(active===first||!dialog.contains(active))){event.preventDefault();last!.focus();}
   else if(!event.shiftKey&&(active===last||!dialog.contains(active))){event.preventDefault();first.focus();}
  };
  const contain=()=>{if(ownsFocus()&&!dialog.contains(document.activeElement))focus();};
  document.addEventListener('keydown',key,true);
  document.addEventListener('focusin',contain);
  const observer=new MutationObserver(contain);
  observer.observe(dialog,{childList:true,subtree:true});
  focus();
  for(const sibling of backgrounds){
   const hidden=sibling.getAttribute('aria-hidden'),release=holdPhoneInert(sibling);
   sibling.setAttribute('aria-hidden','true');
   releases.push(()=>{release();if(sibling.getAttribute('aria-hidden')==='true'){if(hidden===null)sibling.removeAttribute('aria-hidden');else sibling.setAttribute('aria-hidden',hidden);}});
  }
  dispose=()=>{
   observer.disconnect();document.removeEventListener('keydown',key,true);document.removeEventListener('focusin',contain);
   releases.reverse().forEach(release=>release());
   if(previous?.isConnected&&!previous.closest('[inert]'))previous.focus({preventScroll:true});
  };
 };
 return {ref};
}
