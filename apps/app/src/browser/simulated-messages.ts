import {DailyApps} from '../daily';
import {devSurfacesEnabled} from '../build-flags';
import {registerPlugin} from '../platform-plugins';
import {reviewMailAttachment} from '../runtime/inbox-attachment';
type Bag=Record<string,any>;
const attachments=registerPlugin<any>('AlphaMailAttachments');
const recipient=(state:Bag)=>state.thread||(typeof state.compose==='string'?state.compose:null);
/** Local message copies never enter the SMS/provider transport. */
export function installSimulatedMessages(view:Bag){
 if(!devSurfacesEnabled)return ()=>{};
 const render=view.render,leave=view.onLeave,back=view.back;let epoch=0,busy=false,activeApi:Bag|undefined;
 const hidden=()=>{if(document.hidden)retirePage();},retirePage=()=>{epoch++;busy=false;void attachments.cancel();if(activeApi?.isActive())activeApi.set({browserAttachmentRevision:crypto.randomUUID()});};
 window.addEventListener('pagehide',retirePage);window.addEventListener('alpha:device-state',retirePage);document.addEventListener('visibilitychange',hidden);
 const retire=(api:Bag)=>{epoch++;busy=false;void attachments.cancel();api.set({browserAttachment:null});};
 view.onLeave=(api:Bag)=>{retire(api);return leave?.(api);};
 view.back=(state:Bag,api:Bag)=>{if(!state.tray)retire(api);return back?.(state,api);};
 view.render=(state:Bag,api:Bag)=>{
  const out=render(state,api),pid=recipient(state);if(!out.t||!pid)return out;activeApi=api;
  const current=()=>api.get('messages'),file=state.browserAttachment?.pid===pid?state.browserAttachment.file:null;
  const repaint=()=>api.set({browserAttachmentRevision:crypto.randomUUID()});
  const save=(patch:Bag)=>{const next={...current(),...patch};const stored=Object.fromEntries(view.persist.map((key:string)=>[key,next[key]]));if(JSON.stringify(stored).length>12_000_000)throw Error('Messages storage is full. Remove older conversations before saving.');api.set(patch);};
  const fail=(error:unknown)=>api.toast(error instanceof Error?error.message:'Could not save. Your draft is still here.');
  const base=out.t;
  out.t={...base,local:true,busy,hasSavedDraft:!!state.localDrafts?.[pid],
   attachFile:async()=>{if(busy)return;busy=true;const ticket=epoch;repaint();let selectionId:string|undefined;
    const valid=()=>ticket===epoch&&api.isActive()&&recipient(current())===pid;
    try{const selection=await DailyApps.perform({action:'files'});selectionId=selection.selectionId;if(!valid()||selection.status==='cancelled')return;if(!selectionId)throw Error('Choose a file.');const selected=await attachments.readSelected({selectionId});const checked=await reviewMailAttachment(selected);if(!valid())return;api.set({browserAttachment:{pid,file:{...checked,dataBase64:selected.dataBase64}}});}
    catch(error){if(valid())fail(error);}finally{if(selectionId)await DailyApps.forgetSelected({selectionId}).catch(()=>{});if(ticket===epoch){busy=false;repaint();}}
   },
   saveDraft:()=>{try{save({localDrafts:{...current().localDrafts,[pid]:{text:current().text||'',file:current().browserAttachment?.pid===pid?current().browserAttachment.file:null}}});api.toast('Draft saved locally');}catch(error){fail(error);}},
   restoreDraft:()=>{const draft=current().localDrafts?.[pid];if(draft)api.set({text:draft.text,browserAttachment:draft.file?{pid,file:draft.file}:null});},
   send:()=>{if(busy)return;const s=current(),selected=s.browserAttachment?.pid===pid?s.browserAttachment.file:null;if(!selected&&!s.localDrafts?.[pid]){base.send();return;}
    const text=String(s.text||'').trim();if(!selected&&!text)return;const threads={...s.threads},drafts={...s.localDrafts};delete drafts[pid];const k=Math.max(api.now.getHours()*60+api.now.getMinutes()-1,...Object.values(s.threads as Bag).flatMap((rows:any)=>rows.map((m:Bag)=>Number(m.k)||0)))+1;
    const messages=[...(selected?[{id:crypto.randomUUID(),k,me:true,file:selected.name,size:selected.size+' bytes',browserAttachment:selected}]:[]),...(text?[{id:crypto.randomUUID(),k,me:true,text}]:[])];threads[pid]=[...(threads[pid]||[]),...messages];
    try{save({threads,localDrafts:drafts,text:'',browserAttachment:null,tray:false});}catch(error){fail(error);}
   }
  };
  out.t.onKey=(event:KeyboardEvent)=>{if(event.key==='Enter'){event.preventDefault();out.t.send();}};
  if(file){out.t.hasAtts=true;out.t.hasSmart=false;out.t.sendCss='background:var(--acc);color:#fff';out.t.atts=[...base.atts,{name:file.name,rm:()=>api.set({browserAttachment:null})}];}
  out.t.bubbles=base.bubbles.map((bubble:Bag,index:number)=>{const stored=state.threads[pid]?.[index]?.browserAttachment;return stored?{...bubble,openFile:()=>void attachments.openReviewed({...stored,reviewed:true}).catch(fail)}:bubble;});
  return out;
 };
 return ()=>{activeApi=undefined;retirePage();window.removeEventListener('pagehide',retirePage);window.removeEventListener('alpha:device-state',retirePage);document.removeEventListener('visibilitychange',hidden);};
}
