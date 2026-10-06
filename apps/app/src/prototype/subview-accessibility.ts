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
  const detailFocus=subviewFocus(),composeFocus=subviewFocus(),runFocus=subviewFocus(),builderFocus=subviewFocus();
  views[name].render=(state:Bag,api:Bag)=>{
   const out=output=render(state,api);
   if(name==='inbox'){
    contextModal.render(!!out.contextReviewOpen);attachmentModal.render(!!out.attachmentOpen);providerModal.render(!!out.providerReview);
    const review=!!(out.contextReviewOpen||out.attachmentOpen||out.providerReview);
    return {...out,contextModal:contextModal.ref,attachmentModal:attachmentModal.ref,providerModal:providerModal.ref,detailFocus,composeFocus,runFocus,builderFocus,listCovered:!!(out.detail||out.composing||review),detailCovered:!!(out.composing||review),composeCovered:review};
   }
   return {...out,detailFocus,composeFocus,runFocus,builderFocus,listCovered:!!(out.detail||out.runOpen||out.builder),detailCovered:!!(out.runOpen||out.builder),runCovered:!!out.builder};
  };
 }
}

/** Enter the visible screen; return to its opener only when it still exists. */
function subviewFocus(){
 let mounted:HTMLElement|null=null,previous:HTMLElement|null=null;
 return (element:HTMLElement|null)=>{
  if(element===mounted)return;
  const old=mounted,opener=previous;mounted=element;
  if(element){
   previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
   queueMicrotask(()=>{
    if(mounted!==element||!element.isConnected||element.closest('[inert]')||document.querySelector('dialog[open]'))return;
    element.querySelector<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]')?.focus({preventScroll:true});
   });
  }else{
   previous=null;
   queueMicrotask(()=>{
    if(mounted||!opener?.isConnected||opener.closest('[inert]'))return;
    if(document.activeElement===document.body||old?.contains(document.activeElement))opener.focus({preventScroll:true});
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
