import { shareMap as sharedShareMap, type MapShare } from '../../../../.eliza/patched/plugins/plugin-maps/src/client/share.ts';
export { placeShare, routeShare, type MapShare } from '../../../../.eliza/patched/plugins/plugin-maps/src/client/share.ts';
const cancelled=()=>new DOMException('Share cancelled','AbortError');
export function shareMap(data:MapShare,signal:AbortSignal):Promise<'shared'|'copied'|'closed'> {
 return sharedShareMap(data, signal, shareDialog);
}
/** Alpha presentation and Back binding for hosts without share or clipboard access. */
function shareDialog(data:MapShare,text:string,signal:AbortSignal):Promise<'closed'> {
 return new Promise((resolve,reject)=>{
  signal.throwIfAborted();const previous=document.activeElement as HTMLElement|null;
  const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Share Maps');dialog.className='alpha-map-share';
  const theme=document.querySelector('.os');if(theme)for(const name of ['--bg','--fg','--s2'])dialog.style.setProperty(name,getComputedStyle(theme).getPropertyValue(name));
  const heading=document.createElement('h2');heading.textContent=data.title;
  const label=document.createElement('label');label.textContent='Share text';const field=document.createElement('textarea');field.readOnly=true;field.value=text;field.rows=7;label.append(field);
  const select=document.createElement('button');select.textContent='Select text';select.onclick=()=>{field.focus();field.select();};
  const download=document.createElement('a');download.textContent='Download text';download.download='alpha-maps.txt';const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));download.href=url;
  const close=document.createElement('button');close.textContent='Done';
  const content=document.createElement('div');content.className='alpha-map-share-content';content.setAttribute('role','region');content.setAttribute('aria-label','Map share content');content.tabIndex=0;content.append(heading,label);
  const actions=document.createElement('footer');actions.append(select,download,close);
  let settled=false;const finish=(abort=false)=>{if(settled)return;settled=true;signal.removeEventListener('abort',cancel);window.removeEventListener('alpha-back',back,true);dialog.close();dialog.remove();URL.revokeObjectURL(url);if(!abort&&previous?.isConnected)previous.focus();abort?reject(cancelled()):resolve('closed');};
  const cancel=()=>finish(true);const back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();finish();};close.onclick=()=>finish();dialog.onclose=()=>finish();
  signal.addEventListener('abort',cancel,{once:true});window.addEventListener('alpha-back',back,true);dialog.append(content,actions);document.body.append(dialog);try{dialog.showModal();field.focus();}catch{finish(true);}
 });
}
