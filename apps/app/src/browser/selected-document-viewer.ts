import './selected-document-viewer.css';

/** The document remains sandboxed; closing the preview does not forget its selection. */
export function openSelectedDocumentViewer(name:string,url:string,onClose:()=>void){
 const previous=document.activeElement as HTMLElement|null;
 const dialog=document.createElement('dialog');dialog.className='alpha-document-viewer';dialog.setAttribute('aria-label','Selected document');
 const theme=document.querySelector('.os');if(theme){const style=getComputedStyle(theme);for(const token of ['bg','fg','s2','line'])dialog.style.setProperty('--document-'+token,style.getPropertyValue('--'+token));dialog.style.colorScheme=style.getPropertyValue('--bg').trim().toUpperCase()==='#000000'?'dark':'light';}
 const title=document.createElement('h2');title.textContent=name;title.tabIndex=0;
 const frame=document.createElement('iframe');frame.title=name;frame.setAttribute('sandbox','');frame.src=url;
 const footer=document.createElement('footer'),done=document.createElement('button');done.textContent='Done';footer.append(done);dialog.append(title,frame,footer);
 let active=true;
 const close=()=>{if(!active)return;active=false;window.removeEventListener('alpha-back',back,true);window.removeEventListener('pagehide',close);window.removeEventListener('alpha:device-state',close);document.removeEventListener('visibilitychange',visibility);dialog.remove();onClose();if(previous?.isConnected)previous.focus();};
 const back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();close();},visibility=()=>{if(document.hidden)close();};
 done.onclick=close;dialog.oncancel=close;dialog.onclose=close;window.addEventListener('alpha-back',back,true);window.addEventListener('pagehide',close);window.addEventListener('alpha:device-state',close);document.addEventListener('visibilitychange',visibility);
 document.body.append(dialog);dialog.showModal();done.focus();return close;
}
