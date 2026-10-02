import {registerPlugin} from '../platform-plugins';
const Voice=registerPlugin<any>('AlphaVoiceCloud');

/** Browser frames have opaque origins. Only text explicitly supplied here is read. */
export async function reviewBrowserReading(url:string,signal:AbortSignal,valid:()=>void):Promise<void>{
 valid();
 const previous=document.activeElement as HTMLElement|null;
 const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Read page excerpt');
 dialog.style.cssText='box-sizing:border-box;width:min(440px,calc(100vw - 24px));max-height:85dvh;overflow:auto;border:1px solid var(--bd,#aaa);border-radius:20px;padding:20px;background:var(--bg,#fff);color:var(--fg,#111);font:15px/1.45 system-ui,sans-serif';
 const theme=getComputedStyle(document.querySelector('.os')||document.documentElement);
 for(const name of ['--bg','--fg','--s2']){const value=theme.getPropertyValue(name).trim();if(value)dialog.style.setProperty(name,value);}
 const border=theme.getPropertyValue('--line').trim();if(border)dialog.style.setProperty('--bd',border);
 const title=document.createElement('h2');title.textContent='Read page excerpt';
 const source=document.createElement('p');source.textContent=new URL(url).origin;source.style.overflowWrap='anywhere';
 const explanation=document.createElement('p');explanation.textContent='This browser cannot extract text from the isolated website. Paste the excerpt you want to hear. Speech uses a device-local browser voice; this text is not sent to your agent or saved.';
 const label=document.createElement('label');label.textContent='Excerpt to read';
 const field=document.createElement('textarea');field.setAttribute('aria-label','Excerpt to read');field.maxLength=5000;field.rows=7;field.style.cssText='box-sizing:border-box;width:100%;font:inherit;background:var(--s2,#eee);color:inherit;border:1px solid var(--bd,#aaa);border-radius:8px;padding:8px';label.append(field);
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-label','Reading status');status.textContent='Up to 5,000 characters. Review the text before reading.';
 const controls=document.createElement('div');controls.style.cssText='display:flex;gap:12px;flex-wrap:wrap';
 const button=(text:string)=>{const b=document.createElement('button');b.textContent=text;b.style.cssText='min-height:44px;padding:8px 16px;font:inherit;border:1px solid var(--bd,#aaa);border-radius:10px;background:var(--s2,#eee);color:inherit';controls.append(b);return b;};
 const read=button('Read locally'),stop=button('Stop reading'),close=button('Close');stop.disabled=true;
 dialog.append(title,source,explanation,label,status,controls);
 let active=true,generation=0,playbackId:string|undefined,ownsPlayback=false;
 const listeners:Array<{remove:()=>Promise<void>}>=[];
 const stopSpeech=()=>{generation++;playbackId=undefined;if(ownsPlayback){ownsPlayback=false;void Voice.stopPlayback().catch(()=>{});}field.disabled=false;read.disabled=false;stop.disabled=true;};
 let finish!:()=>void;
 const closed=new Promise<void>(resolve=>{finish=()=>{if(!active)return;active=false;stopSpeech();signal.removeEventListener('abort',finish);window.removeEventListener('pagehide',finish);document.removeEventListener('visibilitychange',visibility);dialog.remove();for(const listener of listeners)void listener.remove();if(previous?.isConnected)previous.focus();resolve();};});
 const observe=async(event:string,message:string)=>{
  const listener=await Voice.addListener(event,(result:{playbackId?:string})=>{if(!active||!playbackId||result.playbackId!==playbackId)return;stopSpeech();status.textContent=message;});
  if(!active)await listener.remove();else listeners.push(listener);
 };
 const visibility=()=>{if(document.hidden)finish();};
 window.addEventListener('pagehide',finish);document.addEventListener('visibilitychange',visibility);signal.addEventListener('abort',finish,{once:true});
 dialog.oncancel=event=>{event.preventDefault();finish();};dialog.onclose=finish;close.onclick=finish;
 stop.onclick=()=>{if(!active)return;stopSpeech();status.textContent='Reading stopped.';};
 read.onclick=async()=>{
  if(!active||read.disabled)return;
  try{valid();}catch{finish();return;}
  const text=field.value.trim();if(!text||text.length>5000){status.textContent='Enter between 1 and 5,000 characters.';return;}
  const current=++generation;field.disabled=true;read.disabled=true;stop.disabled=false;status.textContent='Preparing local speech…';ownsPlayback=true;
  try{
   const prepared=await Voice.synthesizeLocal({text});valid();if(!active||current!==generation)return;
   playbackId=prepared.playbackId;await Voice.play({playbackId});valid();
   if(active&&current===generation)status.textContent='Reading locally…';
  }catch(error){if(active&&current===generation){stopSpeech();status.textContent=error instanceof Error?error.message:'Speech could not start. Try again.';}}
 };
 try{await Promise.all([observe('playbackEnded','Reading finished.'),observe('playbackFailed','Speech could not finish. Try again.')]);valid();if(!active)return;document.body.append(dialog);dialog.showModal();field.focus();await closed;}finally{finish();}
}
