import {createScanEventReview} from './scan-event-review';
import type {ScanEventDraft} from './scan-event';
import {createScanLinkReview} from './scan-link-review';
import {exportScanPdf} from './scan-pdf';
import {Capacitor} from '@capacitor/core';
import {recognizeLocalText} from './local-ocr';

/** A scan is draft text until the user reviews it and receives a Notes commit. */
export function openScanReview(image:Blob,save:(text:string,id:string)=>Promise<boolean>,reviewEvent?:(draft:ScanEventDraft)=>boolean):()=>void {
  const controller=new AbortController();const previous=document.activeElement;
  const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Review scanned text');
  dialog.style.cssText='box-sizing:border-box;width:min(92vw,560px);max-height:85dvh;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--bd,#aaa);border-radius:20px;padding:24px;background:var(--bg,#fff);color:var(--fg,#111);font:inherit;line-height:1.45';
  const heading=document.createElement('h2');heading.textContent='Scan text';
  const disclosure=document.createElement('p');disclosure.textContent='English text recognition runs on this device. Check the result before saving. The captured photo remains in Photos.';
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-label','Scan status');status.textContent='Starting local scan…';
  const field=document.createElement('textarea');field.setAttribute('aria-label','Scanned text');field.rows=9;field.maxLength=100000;field.disabled=true;field.style.cssText='box-sizing:border-box;width:100%;font:inherit;background:inherit;color:inherit;padding:12px;border:1px solid currentColor;border-radius:8px';
  const actions=document.createElement('div');actions.style.cssText='flex-shrink:0;display:flex;flex-wrap:wrap;gap:12px;margin-top:16px';
  const button=(label:string)=>{const value=document.createElement('button');value.type='button';value.textContent=label;value.style.cssText='font:inherit;min-height:44px;padding:8px 16px;border-radius:8px;border:1px solid var(--bd,#aaa);background:var(--s2,#eee);color:inherit;cursor:pointer';actions.append(value);return value;};
  const pdf=button(Capacitor.isNativePlatform()?'Save photo PDF':'Download photo PDF');
  const copy=button('Copy text'),commit=button('Save to Notes'),close=button('Cancel scan');copy.disabled=true;commit.disabled=true;
  const pdfStatus=document.createElement('p');pdfStatus.setAttribute('role','status');pdfStatus.setAttribute('aria-label','PDF export status');
  let pdfAttempted=false;
  const previewUrl=URL.createObjectURL(image),preview=document.createElement('img');preview.src=previewUrl;preview.alt='Captured page for PDF export';preview.style.cssText='display:block;width:100%;max-height:160px;object-fit:contain;background:var(--s2,#eee);border-radius:8px';
  const pdfDisclosure=document.createElement('p');pdfDisclosure.textContent='Photo PDF exports this image. Text corrections are saved separately to Notes.';
  let closed=false,attempted=false;const noteId='scan-'+crypto.randomUUID();
  const dispose=()=>{if(closed)return;closed=true;controller.abort();URL.revokeObjectURL(previewUrl);dialog.remove();window.removeEventListener('alpha-back',back,true);window.removeEventListener('pagehide',dispose);document.removeEventListener('visibilitychange',visibility);if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};
  const back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();dispose();};
  const visibility=()=>{if(document.hidden)dispose();};
  close.onclick=dispose;dialog.addEventListener('cancel',event=>{event.preventDefault();dispose();});
  window.addEventListener('alpha-back',back,true);window.addEventListener('pagehide',dispose);document.addEventListener('visibilitychange',visibility);
  const eventReview=reviewEvent?createScanEventReview(()=>field.value,()=>!closed&&!field.disabled&&!document.hidden,draft=>{if(!reviewEvent(draft))return false;dispose();return true;}):undefined;
  if(eventReview)eventReview.hidden=true;
  const links=createScanLinkReview(()=>field.value,()=>!closed&&!document.hidden);
  field.oninput=()=>{links.update();copy.disabled=!field.value.trim();commit.disabled=attempted||!field.value.trim();};
  copy.onclick=()=>{void navigator.clipboard.writeText(field.value).then(()=>{if(!closed)status.textContent='Text copied.';},()=>{if(!closed)status.textContent='Copy unavailable. Select and copy the text manually.';});};
  pdf.onclick=()=>{if(pdfAttempted)return;pdfAttempted=true;pdf.disabled=true;pdfStatus.textContent='Preparing photo PDF…';void exportScanPdf(image,controller.signal,'Alpha scan '+new Date().toISOString().replace(/[:.]/g,'-')).then(result=>{if(closed)return;pdfStatus.textContent=result.message;if(result.status==='cancelled'){pdfAttempted=false;pdf.disabled=false;}},()=>{if(!closed)pdfStatus.textContent='PDF export unconfirmed. Inspect the destination before trying again.';});};
  commit.onclick=()=>{if(attempted||!field.value.trim())return;attempted=true;commit.disabled=true;field.readOnly=true;status.textContent='Saving to Notes…';void save(field.value.trim(),noteId).then(saved=>{if(!closed){status.textContent=saved?'Saved to Notes.':'Save unconfirmed. Keep or copy this text and inspect Notes before saving again.';commit.textContent=saved?'Saved':'Save unconfirmed';}},()=>{if(!closed)status.textContent='Save unconfirmed. Keep or copy this text and inspect Notes before saving again.';});};
  const content=document.createElement('div');content.style.cssText='min-height:0;overflow:auto';content.append(heading,disclosure,preview,pdfDisclosure,status,field,links.element,pdfStatus);
  if(eventReview)content.append(eventReview);
  dialog.append(content,actions);(document.querySelector('.os')||document.body).append(dialog);dialog.showModal();close.focus();
  void recognizeLocalText(image,controller.signal,value=>{if(!closed)status.textContent=`Scanning locally · ${Math.round(value.progress*100)}% · ${value.status}`;}).then(result=>{
    if(closed)return;field.disabled=false;if(eventReview)eventReview.hidden=false;field.value=result.text;links.update();copy.disabled=!result.text;commit.disabled=!result.text;close.textContent='Close scan';status.textContent=result.text?'Review and correct the recognized text.':'No text recognized. You can type a correction or close and try a clearer photo.';field.focus();
  },error=>{if(closed)return;close.textContent='Close scan';status.textContent=error instanceof Error?error.message:'Local scan failed. Try a clearer photo.';});
  return dispose;
}
