import {summarySourceOf,webSourceOf,type SummarySource,type WebSource} from './summary-source';
import type {Source} from './note-source-adapter';
/** A direct user edit/save, separate from an agent proposal. Never saves on reply arrival. */
export function reviewSummaryNote(input:{text:string;source:SummarySource;current:()=>boolean;save:(note:{title:string;body:string;documentSource?:Source;webSource?:WebSource})=>Promise<boolean>;complete:()=>void}){
 const source=summarySourceOf(input.source);if(!source||!input.current())throw Error('Source review expired. Ask about the source again.');
 const dialog=document.createElement('dialog');dialog.className='note-source-dialog';dialog.setAttribute('aria-label','Save reviewed summary note');
 const theme=document.querySelector('.os');if(theme){const style=getComputedStyle(theme);for(const token of ['bg','fg'])dialog.style.setProperty('--source-'+token,style.getPropertyValue('--'+token));}
 const heading=document.createElement('h2');heading.textContent='Review summary note';const content=document.createElement('div');content.className='note-source-content';
 const description=document.createElement('p');description.textContent='Review and edit the answer before saving it on this device. The note will link to '+source.name+(webSourceOf(source)?'. Opening the source visits the current page; its contents may have changed.':('reference' in source&&source.reference?'. The library link can reopen while access remains available; changed bytes are rejected.':'. Reopening the source requires choosing matching file bytes.'));
 const title=document.createElement('input');title.setAttribute('aria-label','Summary note title');title.maxLength=200;title.value=('Summary · '+source.name).slice(0,200);
 const body=document.createElement('textarea');body.setAttribute('aria-label','Summary note text');body.maxLength=32000;body.rows=8;body.value=input.text.slice(0,32000);for(const field of [title,body])field.style.cssText='box-sizing:border-box;width:100%;font:inherit;color:inherit;background:inherit;padding:8px;margin:8px 0';
 const status=document.createElement('p');status.setAttribute('role','status');if(input.text.length>32000)status.textContent='The answer exceeds the note limit. Review the first 32,000 characters before saving.';
 const footer=document.createElement('footer'),save=document.createElement('button'),cancel=document.createElement('button');save.textContent='Save reviewed note';cancel.textContent='Cancel';footer.append(save,cancel);content.append(description,title,body);dialog.append(heading,content,status,footer);
 let closed=false,busy=false;const previous=document.activeElement;
 const close=()=>{if(closed)return;closed=true;dialog.remove();window.removeEventListener('pagehide',close);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('alpha-back',back,true);if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};
 const visibility=()=>{if(document.hidden)close();};document.addEventListener('visibilitychange',visibility);
 const back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();close();};cancel.onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};window.addEventListener('pagehide',close);window.addEventListener('alpha-back',back,true);
 const update=()=>save.disabled=busy||!title.value.trim()||!body.value.trim();title.oninput=update;body.oninput=update;
 save.onclick=async()=>{if(busy||closed)return;if(!input.current()){status.textContent='Agent or conversation changed. Close this review and ask about the source again.';save.disabled=true;return;}busy=true;update();title.disabled=body.disabled=true;try{const saved=await input.save({title:title.value.trim(),body:body.value,...(webSourceOf(source)?{webSource:webSourceOf(source)!}:{documentSource:source as Source})});if(saved){input.complete();close();}else if(!closed)status.textContent='Save is unconfirmed. Reopen Notes before trying again.';}catch{if(!closed)status.textContent='Save is unconfirmed. Reopen Notes before trying again.';}};
 document.body.append(dialog);dialog.showModal();title.focus();update();return close;
}
