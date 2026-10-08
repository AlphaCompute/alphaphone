import type {NoteRecord} from '../runtime/notes-store';
import {holdPhoneInert} from '../runtime/modal-inert';
/** Local candidates never leave this dialog. Only an explicit record choice is returned. */
export function reviewNotesQuery(candidates:NoteRecord[],explanation:string,signal:AbortSignal,current:()=>void):Promise<string|null>{
 current();return new Promise((resolve,reject)=>{
  const previous=document.activeElement as HTMLElement|null,dialog=document.createElement('dialog');dialog.className='note-source-dialog';dialog.setAttribute('aria-label','Choose a note to share');
  const theme=document.querySelector('.os');if(theme){const style=getComputedStyle(theme);for(const token of ['bg','fg'])dialog.style.setProperty('--source-'+token,style.getPropertyValue('--'+token));}
  const content=document.createElement('div');content.className='note-source-content';content.tabIndex=0;content.setAttribute('role','region');content.setAttribute('aria-label','Note preview');
  const heading=document.createElement('h2');heading.textContent='Choose a note to share';const text=document.createElement('p');text.textContent=explanation;
  const select=document.createElement('select');select.style.minHeight='44px';select.style.maxWidth='100%';select.style.font='inherit';select.style.color='inherit';select.style.background='inherit';select.setAttribute('aria-label','Note');const empty=document.createElement('option');empty.value='';empty.textContent='Choose a note';select.append(empty);for(const note of candidates){const option=document.createElement('option');option.value=note.id;option.textContent=note.title||'Untitled note';select.append(option);}
  const preview=document.createElement('pre');preview.style.whiteSpace='pre-wrap';const share=document.createElement('button');share.textContent='Share this note';share.disabled=true;const cancel=document.createElement('button');cancel.textContent='Cancel';
  let done=false;const release=holdPhoneInert(document.querySelector<HTMLElement>('.os'));
  const close=(id:string|null,error?:unknown)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',abort);window.removeEventListener('alpha-back',back,true);dialog.remove();release();if(previous?.isConnected)previous.focus();error?reject(error):resolve(id);};
  const abort=()=>close(null),visibility=()=>{if(document.hidden)close(null);},back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();close(null);};
  select.onchange=()=>{const note=candidates.find(note=>note.id===select.value);preview.textContent=typeof note?.body==='string'?note.body:'This note has no shareable text in the current Notes read contract.';share.disabled=!note||typeof note.body!=='string';};
  share.onclick=()=>{try{current();const note=candidates.find(note=>note.id===select.value);if(!note||typeof note.body!=='string')throw Error('Choose a shareable note');close(note.id);}catch(error){close(null,error);}};
  cancel.onclick=()=>close(null);dialog.oncancel=event=>{event.preventDefault();close(null);};dialog.onclose=()=>close(null);
  signal.addEventListener('abort',abort,{once:true});document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',abort);window.addEventListener('alpha-back',back,true);const footer=document.createElement('footer');footer.append(cancel,share);content.append(heading,text,select,preview);dialog.append(content,footer);try{document.body.append(dialog);dialog.showModal();select.focus();if(signal.aborted)close(null);}catch(error){close(null,error);}
 });
}
