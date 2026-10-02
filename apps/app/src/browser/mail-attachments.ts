import { WebPlugin } from '@capacitor/core';
import { reviewMailAttachment, type MailAttachment } from '../runtime/inbox-attachment';
import { BrowserFiles } from './files';
/** Same byte/type/hash validation as the provider review; no uploads. */
export class BrowserMailAttachments extends WebPlugin {
 private generation=0;
 private dialog?:HTMLDialogElement;
 private url?:string;
 constructor(private files:BrowserFiles){super();window.addEventListener('pagehide',()=>this.clear());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});}
 async readSelected(input:{selectionId:string}){const generation=this.generation,file=await this.files.attachment(input),review=await reviewMailAttachment(file);if(generation!==this.generation)throw new DOMException('Cancelled','AbortError');return {...file,...review};}
 private clear(){++this.generation;this.dialog?.close();this.dialog?.remove();this.dialog=undefined;if(this.url)URL.revokeObjectURL(this.url);this.url=undefined;}
 async cancel(){this.clear();}
 async openReviewed(input:MailAttachment&{reviewed:boolean;sha256:string}){
  const generation=this.generation,review=await reviewMailAttachment(input);if(!input.reviewed||review.sha256!==input.sha256||generation!==this.generation)throw Error('Review this attachment again.');this.clear();
  const bytes=Uint8Array.from(atob(input.dataBase64),c=>c.charCodeAt(0)),url=this.url=URL.createObjectURL(new Blob([bytes],{type:input.mimeType})),dialog=this.dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Reviewed attachment');dialog.style.cssText='width:min(700px,90vw);height:80vh;border:0;border-radius:16px;padding:20px';const heading=document.createElement('h2');heading.textContent=input.name;const close=document.createElement('button');close.textContent='Done';close.onclick=()=>void this.cancel();dialog.append(heading,close);
  if(review.text!==undefined){const text=document.createElement('pre');text.textContent=review.text;text.style.whiteSpace='pre-wrap';dialog.append(text);}else{const frame=document.createElement('iframe');frame.title=input.name;frame.setAttribute('sandbox','');frame.src=url;frame.style.cssText='width:100%;height:75%;border:0';dialog.append(frame);}
  const download=document.createElement('a');download.href=url;download.download=input.name;download.textContent='Download';dialog.append(download);dialog.onclose=()=>{if(this.dialog===dialog)this.clear();};dialog.oncancel=()=>{if(this.dialog===dialog)this.clear();};document.body.append(dialog);dialog.showModal();return {status:'opened',message:'Attachment opened.'};
}

}
