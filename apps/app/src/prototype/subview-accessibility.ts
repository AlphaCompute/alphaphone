import {createInlineModal} from '../runtime/inline-modal';
type Bag=Record<string,any>;
/** Full-screen subviews replace their covered content in accessibility navigation. */
export function installSubviewAccessibility(views:Bag){
 for(const name of ['inbox','workflows']){
  const render=views[name].render;
  let output:Bag={};
  const contextModal=reviewFocus(()=>output.contextReview?.close());
  const attachmentModal=reviewFocus(()=>output.attachment?.close());
  const providerModal=reviewFocus(()=>output.provider?.close());
  const focus=focusHistory();
  const detailFocus=subviewFocus(focus.read),composeFocus=subviewFocus(focus.read),runFocus=subviewFocus(focus.read),builderFocus=subviewFocus(focus.read);
  views[name].render=(state:Bag,api:Bag)=>{
   const out=output=render(state,api);
   if(name==='inbox'){
    contextModal.render(!!out.contextReviewOpen);attachmentModal.render(!!out.attachmentOpen);providerModal.render(!!out.providerReview);
    const review=!!(out.contextReviewOpen||out.attachmentOpen||out.providerReview);
    return {...out,captureSubviewFocus:focus.capture,contextModal:contextModal.ref,attachmentModal:attachmentModal.ref,providerModal:providerModal.ref,detailFocus,composeFocus,runFocus,builderFocus,listCovered:!!(out.detail||out.composing||review),detailCovered:!!(out.composing||review),composeCovered:review};
   }
   return {...out,captureSubviewFocus:focus.capture,detailFocus,composeFocus,runFocus,builderFocus,listCovered:!!(out.detail||out.automation?.detail||out.runOpen||out.builder),detailCovered:!!(out.runOpen||out.builder),runCovered:!!out.builder};
  };
 }
 for(const [name,keys,coverage] of [
  ['calendar',['detail','form'],(out:Bag)=>({listCovered:!!(out.detail||out.form),detailCovered:!!out.form})],
  ['browser',['tabs','library'],(out:Bag)=>({listCovered:!!(out.tabsOpen||out.lib),tabsCovered:!!out.lib})],
  ['photos',['album','viewer','edit','empty'],(out:Bag)=>({listCovered:!!(out.album||out.viewing||out.editing||out.viewEmpty),albumCovered:!!(out.viewing||out.editing||out.viewEmpty),viewerCovered:!!out.editing})],
  ['notes',['editor','voice','link','recording','trash'],(out:Bag)=>({listCovered:!!(out.isEdit||out.isVoice||out.isLink||out.recording||out.trashOpen),detailCovered:!!out.recording,trashCovered:!!out.trashConfirmOpen})],
  ['files',['folder','preview'],(out:Bag)=>({listCovered:!!(out.inFolder||out.isPreview),detailCovered:!!out.isPreview})],
 ] as Array<[string,string[],(out:Bag)=>Bag]>){
  const render=views[name].render,focus=focusHistory(),refs=Object.fromEntries(keys.map(key=>[key+'Focus',subviewFocus(focus.read)]));
  let output:Bag={};
  const deleteModal=name==='photos'?reviewFocus(()=>output.closeSheet?.()):name==='notes'?reviewFocus(()=>output.trashCancel?.()):null;
  views[name].render=(state:Bag,api:Bag)=>{
   const out=output=render(state,api);deleteModal?.render(!!(out.emptyOpen||out.trashConfirmOpen));
   return {...out,...refs,emptyModal:deleteModal?.ref,captureSubviewFocus:focus.capture,...coverage(out)};
  };
 }

}

/** Enter the visible screen; return to its opener only when it still exists. */
function subviewFocus(read:()=>FocusTarget){
 let mounted:HTMLElement|null=null,previous:HTMLElement|null=null,scope:HTMLElement|null=null;
 return (element:HTMLElement|null)=>{
  if(element===mounted)return;
  const old=mounted,opener=previous,openerScope=scope;mounted=element;
  if(element){
   const target=read();previous=target.element;scope=target.scope;
   queueMicrotask(()=>{
    if(mounted!==element||!element.isConnected||element.closest('[inert]')||document.querySelector('dialog[open]'))return;
    element.querySelector<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]')?.focus({preventScroll:true});
   });
  }else{
   previous=null;scope=null;
   queueMicrotask(()=>{
    if(mounted||!opener)return;
    let target=opener;
    // A refreshed list may recreate the button. Match only one exact control
    // within the original surviving screen, never a similarly named other app.
    if(!target.isConnected&&openerScope?.isConnected){
     const matches=Array.from(openerScope.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href]')).filter(candidate=>candidate.tagName===opener.tagName&&candidate.getAttribute('aria-label')===opener.getAttribute('aria-label')&&candidate.textContent===opener.textContent);
     if(matches.length===1)target=matches[0];
    }
    if(!target.isConnected||target.closest('[inert]'))return;
    if(document.activeElement===document.body||old?.contains(document.activeElement))target.focus({preventScroll:true});
   });
  }
 };
}

function reviewFocus(close:()=>void){
 let open=false,opener:HTMLElement|null=null;
 const modal=createInlineModal(close,()=>opener);
 return {...modal,render(next:boolean){
  if(next&&!open)opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
  open=next;
 }};
}

type FocusTarget={element:HTMLElement|null;scope:HTMLElement|null};
/** Keep the opener before an asynchronous read can replace its list item. */
function focusHistory(){
 let remembered:FocusTarget={element:null,scope:null};
 const current=():FocusTarget=>{
  const element=document.activeElement instanceof HTMLElement?document.activeElement:null;
  return {element,scope:element?.closest<HTMLElement>('[data-alpha-subview]')||null};
 };
 return {
  capture:()=>{const target=current();if(target.scope)remembered=target;},
  read:()=>{const target=current();return target.scope?target:remembered.scope?.isConnected?remembered:target;},
 };
}
