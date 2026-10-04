import './mail-attachments.css';
import { WebPlugin } from '@capacitor/core';
import { reviewMailAttachment, type MailAttachment } from '../runtime/inbox-attachment';
import { BrowserFiles } from './files';
/** Same byte/type/hash validation as the provider review; no uploads. */
export class BrowserMailAttachments extends WebPlugin {
 private generation=0;
 private saveController?:AbortController;
 private dialog?:HTMLDialogElement;
 private url?:string;
 private cleanup?:()=>void;
 constructor(private files:BrowserFiles){super();window.addEventListener('pagehide',()=>this.clear());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});}
 async readSelected(input:{selectionId:string}){const generation=this.generation,file=await this.files.attachment(input),review=await reviewMailAttachment(file);if(generation!==this.generation)throw new DOMException('Cancelled','AbortError');return {...file,...review};}
 private clear(){++this.generation;this.saveController?.abort();const cleanup=this.cleanup;this.cleanup=undefined;cleanup?.();this.dialog?.close();this.dialog?.remove();this.dialog=undefined;if(this.url)URL.revokeObjectURL(this.url);this.url=undefined;}
 async cancel(){this.clear();}
 async saveReviewed(input:MailAttachment&{reviewed:boolean;sha256:string}){
  if(this.saveController)throw Error('An attachment save is already pending.');
  input={...input};const controller=new AbortController(),generation=this.generation;this.saveController=controller;let selectionId:string|undefined,started=false;
  try{
   const review=await reviewMailAttachment(input);if(!input.reviewed||review.sha256!==input.sha256||generation!==this.generation)throw Error('Review this attachment again.');controller.signal.throwIfAborted();
   const bytes=Uint8Array.from(atob(input.dataBase64),c=>c.charCodeAt(0));started=true;
   const selected=await this.files.importFile(new File([bytes],input.name,{type:input.mimeType}),'root',controller.signal);selectionId=selected.selectionId;
   const retained=await this.files.attachment({selectionId}),checked=await reviewMailAttachment(retained);controller.signal.throwIfAborted();if(checked.sha256!==review.sha256||checked.size!==review.size)throw Error('Saved bytes did not match.');
   return {status:'saved',message:'Saved in Files. Exact bytes verified.'};
  }catch(error){if(!started)throw error;return {status:'unverified',message:'Save not confirmed. Inspect Files before trying again; a copy may already exist.'};}
  finally{if(selectionId)await this.files.forgetSelected({selectionId}).catch(()=>{});if(this.saveController===controller)this.saveController=undefined;}
 }
 async openReviewed(input:MailAttachment&{reviewed:boolean;sha256:string}){
  const generation=this.generation,review=await reviewMailAttachment(input);if(!input.reviewed||review.sha256!==input.sha256||generation!==this.generation)throw Error('Review this attachment again.');this.clear();
  const bytes=Uint8Array.from(atob(input.dataBase64),c=>c.charCodeAt(0)),url=this.url=URL.createObjectURL(new Blob([bytes],{type:input.mimeType})),dialog=this.dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Reviewed attachment');dialog.className='alpha-mail-attachment';const theme=document.querySelector('.os');if(theme){const style=getComputedStyle(theme);for(const token of ['bg','fg','s2','line'])dialog.style.setProperty('--attachment-'+token,style.getPropertyValue('--'+token));dialog.style.colorScheme=style.getPropertyValue('--bg').trim().toUpperCase()==='#000000'?'dark':'light';};const heading=document.createElement('h2');heading.textContent=input.name;heading.tabIndex=0;const close=document.createElement('button');close.textContent='Done';close.onclick=()=>void this.cancel();dialog.append(heading);
  if(review.text!==undefined){const text=document.createElement('pre');text.textContent=review.text;text.tabIndex=0;dialog.append(text);}else{const frame=document.createElement('iframe');frame.title=input.name;frame.setAttribute('sandbox','');frame.src=url;dialog.append(frame);}
  const download=document.createElement('a');download.href=url;download.download=input.name;download.textContent='Download';const footer=document.createElement('footer');footer.append(close,download);dialog.append(footer);const previous=document.activeElement as HTMLElement|null;const back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();this.clear();};window.addEventListener('alpha-back',back,true);this.cleanup=()=>{window.removeEventListener('alpha-back',back,true);queueMicrotask(()=>{if(previous?.isConnected&&!this.dialog)previous.focus();});};dialog.onclose=()=>{if(this.dialog===dialog)this.clear();};dialog.oncancel=()=>{if(this.dialog===dialog)this.clear();};document.body.append(dialog);dialog.showModal();close.focus();return {status:'opened',message:'Attachment opened.'};
}

}
