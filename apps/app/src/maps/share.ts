import {coordinate,type Coordinate,type Route} from './contracts';
export type MapShare={title:string;text:string;url?:string};
const point=(value:Coordinate)=>{const p=coordinate(value);return `${p.latitude}, ${p.longitude}`;};
export function placeShare(label:string,value:Coordinate):MapShare{
 const p=coordinate(value);const url=`https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=17/${p.latitude}/${p.longitude}`;
 return {title:label,text:`${label}\n${point(p)}`,url};
}
export function routeShare(label:string,route:Route):MapShare{
 return {title:`Route to ${label}`,text:[`Route to ${label}`,`${route.mode}: ${point(route.from)} → ${point(route.to)}`,`${route.distanceMeters} m · ${route.durationSeconds} s`,...route.steps.map((step,index)=>`${index+1}. ${step.instruction}`),`Traffic: ${route.traffic}`,route.attribution].join('\n')};
}
const cancelled=()=>new DOMException('Share cancelled','AbortError');
/** Share only an explicit immutable selection; cancelled or retired requests never fall through to another transport. */
export async function shareMap(data:MapShare,signal:AbortSignal):Promise<'shared'|'copied'|'closed'>{
 signal.throwIfAborted();
 const wait=<T>(job:Promise<T>)=>new Promise<T>((resolve,reject)=>{const cancel=()=>{signal.removeEventListener('abort',cancel);reject(cancelled());};signal.addEventListener('abort',cancel,{once:true});job.then(value=>{signal.removeEventListener('abort',cancel);signal.aborted?reject(cancelled()):resolve(value);},error=>{signal.removeEventListener('abort',cancel);reject(error);});if(signal.aborted)cancel();});
 if(navigator.share){try{await wait(navigator.share(data));return 'shared';}catch(error){if(signal.aborted||error instanceof DOMException&&error.name==='AbortError')throw cancelled();}}
 const text=[data.text,data.url].filter(Boolean).join('\n');signal.throwIfAborted();
 if(navigator.clipboard?.writeText){try{await wait(navigator.clipboard.writeText(text));return 'copied';}catch{signal.throwIfAborted();}}
 return new Promise((resolve,reject)=>{
  signal.throwIfAborted();const previous=document.activeElement as HTMLElement|null;
  const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Share Maps');dialog.style.cssText='box-sizing:border-box;width:min(380px,92vw);max-height:85dvh;overflow:auto;border:0;border-radius:20px;padding:24px;background:var(--bg,#fff);color:var(--fg,#111);font:16px/1.5 system-ui';
  const theme=document.querySelector('.os');if(theme)for(const name of ['--bg','--fg','--s2'])dialog.style.setProperty(name,getComputedStyle(theme).getPropertyValue(name));
  const heading=document.createElement('h2');heading.textContent=data.title;
  const label=document.createElement('label');label.textContent='Share text';const field=document.createElement('textarea');field.readOnly=true;field.value=text;field.rows=7;field.style.cssText='box-sizing:border-box;width:100%;margin:12px 0;padding:10px;color:inherit;background:transparent;font:inherit;border:1px solid #999;border-radius:10px';label.append(field);
  const select=document.createElement('button');select.textContent='Select text';select.onclick=()=>{field.focus();field.select();};
  const download=document.createElement('a');download.textContent='Download text';download.download='alpha-maps.txt';const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));download.href=url;
  const close=document.createElement('button');close.textContent='Done';
  for(const el of [select,download,close])el.style.cssText='display:inline-block;padding:10px;margin:4px;border:1px solid #999;border-radius:10px;font:inherit;color:inherit;background:var(--s2,#eee)';
  let settled=false;const finish=(abort=false)=>{if(settled)return;settled=true;signal.removeEventListener('abort',cancel);window.removeEventListener('alpha-back',back,true);dialog.close();dialog.remove();URL.revokeObjectURL(url);if(!abort&&previous?.isConnected)previous.focus();abort?reject(cancelled()):resolve('closed');};
  const cancel=()=>finish(true);const back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();finish();};close.onclick=()=>finish();dialog.onclose=()=>finish();
  signal.addEventListener('abort',cancel,{once:true});window.addEventListener('alpha-back',back,true);dialog.append(heading,label,select,download,close);document.body.append(dialog);try{dialog.showModal();field.focus();}catch{finish(true);}
 });
}
