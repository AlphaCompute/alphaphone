import {inboxUnsaved} from './inbox-unsaved';
import { registerPlugin } from '../platform-plugins';
const attachmentNative=registerPlugin<{readSelected(input:{selectionId:string}):Promise<MailAttachment & {size:number;sha256:string}>}>('AlphaMailAttachments');
import {DailyApps} from '../daily';
import {reviewMailAttachment,type MailAttachment} from '../runtime/inbox-attachment';
import { secureConnectionStore } from '../runtime/native-connection';
import { connectionController } from '../runtime/connection-ui';
import type { GmailMessage } from '../runtime/cloud-protocol';
type Bag = Record<string, any>;
/** Content handed to a new composer: shared from another app or moved to another From account. */
export type ComposePrefill = {to:string[];cc?:string[];bcc?:string[];subject:string;body:string;attachments?:MailAttachment[];status?:string};
type Draft = {version:1;id:string;revision:string;owner:string;to:string[];cc?:string[];bcc?:string[];attachments?:MailAttachment[];provider?:{draftId:string;providerDigest:string};subject:string;body:string;mode?:'compose'|'reply'|'reply-all'|'forward';reply?:{messageId:string;threadId:string}};
const address=(v:string)=>v.length<=254&&/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(v);
const valid=(v:any,owner:string):v is Draft=>!!v&&v.version===1&&v.owner===owner&&typeof v.id==='string'&&typeof v.revision==='string'&&Array.isArray(v.to)&&v.to.length<=20&&v.to.every((a:any)=>typeof a==='string'&&address(a))&&[v.cc||[],v.bcc||[]].every((list:any)=>Array.isArray(list)&&list.length<=20&&list.every((a:any)=>typeof a==='string'&&address(a)))&&typeof v.subject==='string'&&v.subject.length<=998&&!/[\r\n]/.test(v.subject)&&typeof v.body==='string'&&v.body.length<=64000&&(!v.reply||(typeof v.reply.messageId==='string'&&typeof v.reply.threadId==='string'));
/** Local encrypted drafts remain separate from explicitly reviewed provider operations. */
export function inboxDrafts(publish:()=>void,toast:(text:string)=>void, provider?:{prepare(proposal:Bag):Promise<void>;capabilities():{send:boolean;providerDrafts:boolean;from?:string}|null}) {
 let owner='',session='',epoch=0,saved:Draft|null=null,draft:Draft|null=null;
 const pendingEdits=new Map<string,{draft:Draft;toQ:string;baseRevision:string|null}>();
 let retained:ReturnType<typeof inboxUnsaved>|null=null,baseRevision:string|null=null,staleBase=false;
 function persist(){if(draft)retained?.edit({version:1,owner,baseRevision,draft:structuredClone(draft),toQ});}
 function restoreRetained(value:any){draft=structuredClone(value.draft);toQ=value.toQ;baseRevision=value.baseRevision;staleBase=baseRevision!==(saved?.revision||null);open=true;confirm=false;status=staleBase?'The saved local draft changed. Review the latest saved copy before saving these edits.':'Retained email edits restored. Review before provider actions.';publish();}
 let loading=false,ready=false,busy=false,open=false,confirm=false,toQ='',label='',status='';
 let fromSwitch:{count():number;cycle():void}|null=null;
 const slot=()=>`inbox-drafts:v1:${owner}`;
 function reset(){retained?.retire();retained=null;baseRevision=null;staleBase=false;pendingEdits.clear();epoch++;owner='';session='';saved=draft=null;loading=ready=busy=open=confirm=false;toQ='';status='';}
 async function bind(account:string,accountLabel:string){
  const identity=connectionController.getSnapshot().cloudAccount, binding=connectionController.getCloudClient();
  const next=identity&&binding?.sessionId===identity.sessionId&&account?JSON.stringify([identity.environment,identity.userId,identity.organizationId||'',account]):'';
  if(next===owner&&binding?.sessionId===session&&ready)return;
  if(draft)pendingEdits.set(owner,{draft:structuredClone(draft),toQ,baseRevision});
  retained?.retire();retained=null;baseRevision=null;staleBase=false;
  epoch++;saved=draft=null;loading=ready=busy=open=confirm=false;toQ='';status='';owner=next;session=binding?.sessionId||'';label=accountLabel;
  if(!owner)return;
  const token=epoch, key=slot();loading=true;status='Checking local draft…';publish();
  try{const value=await secureConnectionStore.read<Draft>(key);if(token!==epoch)return;
   if(value!==null&&!valid(value,owner))throw Error();saved=value;const pending=pendingEdits.get(owner);draft=pending?.draft||null;toQ=pending?.toQ||'';baseRevision=pending?pending.baseRevision:value?.revision||null;staleBase=!!pending&&baseRevision!==(saved?.revision||null);const recovery=retained=inboxUnsaved(owner,publish,restored=>{if(token===epoch)restoreRetained(restored);});await recovery.ready;if(token!==epoch)return;ready=true;status=draft?'Edits retained for this account':value?'Saved draft on this device':'No saved local draft';
  }catch{if(token===epoch)status='Local draft storage unavailable. Retry connection to reload.';}
  if(token===epoch){loading=false;publish();}
 }
 function begin(reply?:GmailMessage,mode:'reply'|'reply-all'|'forward'='reply',forwardedBody='',prefill?:ComposePrefill):boolean{
  if(!ready||busy){toast(status||'Connect a Gmail account first.');return false;}
  if(draft){if(prefill){toast('Finish, save or discard the open email draft first. The shared content was not added.');return false;}open=true;confirm=false;publish();return true;}
  if(retained?.available){toast(prefill?'Resume the retained email edits first. The shared content was not added.':'Resume the retained email edits before creating another.');return false;}
  if(saved){toast(prefill?'Restore or discard the saved local draft first. The shared content was not added.':'Restore or discard the saved local draft before creating another.');return false;}
  if(prefill&&!reply){
   const clean=(list:unknown)=>Array.isArray(list)?[...new Set(list.filter((a):a is string=>typeof a==='string'&&address(a.trim())).map(a=>a.trim()))].slice(0,20):[];
   draft={version:1,id:crypto.randomUUID(),revision:crypto.randomUUID(),owner,mode:'compose',to:clean(prefill.to),cc:clean(prefill.cc),bcc:clean(prefill.bcc),subject:String(prefill.subject||'').replace(/[\r\n]+/g,' ').slice(0,998),body:String(prefill.body||'').slice(0,64000),...(prefill.attachments?.length?{attachments:structuredClone(prefill.attachments.slice(0,1))}:{})};
   baseRevision=null;staleBase=false;open=true;confirm=false;toQ='';persist();status=prefill.status||'Unsaved local draft. Review before sending; nothing has been sent.';publish();return true;
  }
  if(reply&&mode!=='forward'&&!address(reply.replyTo||reply.fromEmail||'')){toast('This message has no valid literal reply address.');return false;}
  const self=provider?.capabilities()?.from?.toLowerCase(), primary=reply?(reply.replyTo||reply.fromEmail||''):'';
  const to=reply&&mode!=='forward'?[...new Set([primary,...(mode==='reply-all'?reply.to:[])])].filter(a=>a.toLowerCase()!==self):[];
  const cc=mode==='reply-all'?[...new Set(reply?.cc||[])].filter(a=>a.toLowerCase()!==self&&!to.some(t=>t.toLowerCase()===a.toLowerCase())):[];
  if([...to,...cc].some(a=>!address(a))){toast('A reply recipient is ambiguous. Compose with explicitly reviewed literal addresses instead.');return false;}
  draft={version:1,id:crypto.randomUUID(),revision:crypto.randomUUID(),owner,mode:reply?mode:'compose',to,cc,bcc:[],subject:reply&&mode==='forward'?`Fwd: ${reply.subject}`.slice(0,998):reply?(/^re:/i.test(reply.subject)?reply.subject:`Re: ${reply.subject}`).slice(0,998):'',body:reply&&mode==='forward'?`\n\nForwarded message from ${reply.from}\nSubject: ${reply.subject}\n\n${forwardedBody}`:'',...(reply&&mode!=='forward'?{reply:{messageId:reply.id,threadId:reply.threadId}}:{})};
  baseRevision=null;staleBase=false;open=true;confirm=false;toQ='';persist();status=mode==='forward'?'Forwarded text only. Original attachments are not copied; add a supported file explicitly.':'Unsaved local draft';publish();return true;
 }
 /** Moves an open new email out of this account so it can continue under another From account.
  * Replies and provider drafts belong to their mailbox and are never moved. */
 async function transfer():Promise<(ComposePrefill&{savedRemains:boolean})|null>{
  if(!draft||busy)return null;
  if(draft.reply||draft.provider||(draft.mode&&draft.mode!=='compose')){toast('Replies, forwards and Gmail drafts stay with the account they came from.');return null;}
  if(toQ.trim()){toast('Add or clear the address you are typing before changing the From account.');return null;}
  const content={to:[...draft.to],cc:[...(draft.cc||[])],bcc:[...(draft.bcc||[])],subject:draft.subject,body:draft.body,attachments:structuredClone(draft.attachments||[]),savedRemains:!!saved};
  const token=epoch;try{await retained?.clear();}catch{if(token===epoch)toast('Retained email edits changed. Review recovery before changing the From account.');return null;}
  if(token!==epoch)return null;
  pendingEdits.delete(owner);draft=null;open=false;confirm=false;baseRevision=null;staleBase=false;toQ='';publish();return content;
 }
 function add(){if(!draft||busy)return;const value=toQ.trim();if(!address(value)||draft.to.length>=20){toast('Enter one literal email address, up to 20 recipients.');return;}if(!draft.to.includes(value))draft.to.push(value);toQ='';status='Unsaved local draft';persist();publish();}
 async function update(remove=false){
  if(!draft||!ready||busy)return;
  if(staleBase){toast('The saved local draft changed. Review the latest saved copy before saving these edits.');return;}
  if(!remove&&toQ.trim()){add();if(toQ.trim())return;}
  const value=remove?null:{...draft,revision:crypto.randomUUID(),to:[...draft.to]};
  if(value&&(!valid(value,owner)||new TextEncoder().encode(JSON.stringify(value)).length>8*1024*1024)){toast('Draft is too large or contains an invalid subject.');return;}
  const token=epoch,key=slot(),expected=saved;busy=true;publish();
  try{const receipt=await secureConnectionStore.compareExchange(key,expected,value);if(token!==epoch)return;
   if(receipt.status!=='saved'){status='Draft changed in another window. Close this composer and reload before replacing it.';ready=false;toast(status);return;}
   pendingEdits.delete(owner);saved=value;let cleared=true;try{await retained?.clear();}catch{cleared=false;}if(token!==epoch)return;baseRevision=value?.revision||null;staleBase=false;draft=value?structuredClone(value):cleared?null:draft;status=cleared?(remove?'Local draft discarded':'Saved locally on this device'):(remove?'Saved local draft removed; retained edits could not be cleared. Review recovery before closing.':'Saved locally; retained edits could not be cleared. Review recovery before closing.');confirm=false;if(remove&&cleared)open=false;toast(status);
  }catch{if(token===epoch){status='Local draft update failed. Your edits remain here.';toast(status);}}
  finally{if(token===epoch){busy=false;publish();}}
 }
 async function attach(){if(!draft||busy)return;const token=epoch;let selectionId:string|undefined;busy=true;publish();try{const selected=await DailyApps.perform({action:'files'});selectionId=selected.selectionId;if(token!==epoch)return;if(selected.status==='cancelled')return;if(selected.status!=='selected'||!selected.selectionId||!selected.name)throw new Error('Select one supported document or image');const file=await attachmentNative.readSelected({selectionId:selected.selectionId});const checked=await reviewMailAttachment(file);if(checked.sha256!==file.sha256||checked.size!==file.size)throw new Error('Selected file changed');if(token!==epoch)return;draft!.attachments=[{name:file.name,mimeType:file.mimeType,dataBase64:file.dataBase64}];status='Attachment selected locally. Nothing uploaded until provider review.';persist();}catch(error){if(token===epoch)toast(error instanceof Error?error.message:'Attachment unavailable');}finally{if(selectionId)await DailyApps.forgetSelected({selectionId}).catch(()=>{});if(token===epoch){busy=false;publish();}}}
 function edit(key:'subject'|'body',value:string){if(draft&&!busy){draft[key]=value;status='Unsaved local draft';persist();publish();}}
 return {
  bind,reset,begin,transfer,setFromSwitch(value:typeof fromSwitch){fromSwitch=value;},get ready(){return ready&&!busy;},
  async editProvider(proposal:Bag,reference:{draftId:string;providerDigest:string}){if(retained?.available&&!draft){toast('Resume retained email edits before editing another provider draft.');return false;}if(!ready||busy){toast('Local draft storage unavailable');return false;}if(draft&&(draft.body!==proposal.bodyText||draft.subject!==proposal.subject||JSON.stringify(draft.to)!==JSON.stringify(proposal.to)||JSON.stringify(draft.cc||[])!==JSON.stringify(proposal.cc||[])||JSON.stringify(draft.bcc||[])!==JSON.stringify(proposal.bcc||[])||JSON.stringify(draft.attachments||[])!==JSON.stringify(proposal.attachments||[])))return false;draft={version:1,id:crypto.randomUUID(),revision:crypto.randomUUID(),owner,to:[...proposal.to],cc:[...(proposal.cc||[])],bcc:[...(proposal.bcc||[])],subject:proposal.subject,body:proposal.bodyText,mode:proposal.mode,attachments:proposal.attachments||[],provider:reference,...(proposal.replyMessageId?{reply:{messageId:proposal.replyMessageId,threadId:''}}:{})};baseRevision=saved?.revision||null;staleBase=false;open=true;confirm=false;status='Editing provider draft. Save locally to preserve edits. Gmail replacement is not atomic.';publish();await update();return saved?.provider?.draftId===reference.draftId&&saved?.provider?.providerDigest===reference.providerDigest;},
  close(){if(!open)return false;if(busy){toast('Wait for the local draft update.');return true;}open=false;confirm=false;if(status==='Unsaved local draft')toast(retained?.status||'Edits remain in this session.');publish();return true;},
  chips(chip:(label:string,action:()=>void)=>Bag){return ready?[
   ...(draft?[chip('Continue draft',()=>{open=true;publish();})]:retained?.available?[chip('Resume unsaved email',()=>retained?.resume())]:saved?[chip('Restore local draft',()=>{draft=structuredClone(saved!);baseRevision=saved!.revision;staleBase=false;open=true;confirm=false;toQ='';publish();})]:[]),
   ...(retained?.error?[chip('Recover email edits',()=>retained?.recover(draft))]:[]),
  ]:[];},
  render(){return {composeDisabled:loading||busy,composing:open&&!!draft,c: draft?{
   local:true,status,busy,confirm,retainedStatus:retained?.status,retainedConflict:retained?.conflict,retainedError:retained?.error,restoreEdits:()=>retained?.resume(),replaceEdits:()=>{if(window.confirm('Replace the retained email edits with this composer?'))retained?.replace();},retryEdits:()=>void retained?.retry(),recoverEdits:()=>retained?.recover({draft,toQ}),staleBase,useLatest:async()=>{if(!window.confirm('Discard these edits and review the latest saved local draft?'))return;const token=epoch;try{await retained?.clear();if(token!==epoch)return;draft=saved?structuredClone(saved):null;toQ='';baseRevision=saved?.revision||null;staleBase=false;open=!!draft;status='Review the latest saved local draft.';publish();}catch{if(token===epoch)toast('Retained edits changed. Review recovery before discarding them.');}},save:()=>void update(),discard:()=>{if(!busy){confirm=true;publish();}},cancelDiscard:()=>{confirm=false;publish();},confirmDiscard:()=>void update(true),
   send:()=>{if(!provider?.capabilities()?.send){toast('Sending is unavailable for this account. Save locally; no email has been sent.');return;}if(toQ.trim()){add();if(toQ.trim())return;}void provider.prepare({kind:'send',mode:draft!.mode||(draft!.reply?'reply':'compose'),to:[...draft!.to],cc:[...(draft!.cc||[])],bcc:[...(draft!.bcc||[])],subject:draft!.subject,bodyText:draft!.body,attachments:[...(draft!.attachments||[])],...(draft!.reply?{replyMessageId:draft!.reply.messageId}:{})});},
   canSaveProvider:!!provider?.capabilities()?.providerDrafts,saveProvider:()=>{if(toQ.trim()){add();if(toQ.trim())return;}void provider?.prepare({kind:draft!.provider?'draft-replace':'draft-create',...(draft!.provider?{draftId:draft!.provider.draftId,expectedDigest:draft!.provider.providerDigest,acceptNonAtomicReplacement:true}:{}),mode:draft!.mode||(draft!.reply?'reply':'compose'),to:[...draft!.to],cc:[...(draft!.cc||[])],bcc:[...(draft!.bcc||[])],subject:draft!.subject,bodyText:draft!.body,attachments:[...(draft!.attachments||[])],...(draft!.reply?{replyMessageId:draft!.reply.messageId}:{})});},multi:(fromSwitch?.count()||0)>1,from:label?`From ${label}`:'',cycleFrom:()=>{if(busy)return;if(fromSwitch&&fromSwitch.count()>1)fromSwitch.cycle();else toast('Only one Gmail account is connected.');},
   chips:draft.to.map(name=>({name,rm:()=>{if(!busy){draft!.to=draft!.to.filter(a=>a!==name);status='Unsaved local draft';persist();publish();}}})),
   toQ,toPh:'To',onTo:(e:Bag)=>{if(!busy){toQ=String(e.target.value);status='Unsaved local draft';persist();publish();}},toKey:(e:Bag)=>{if(e.key==='Enter'){e.preventDefault();add();}},hasRaw:!!toQ.trim(),rawAddr:toQ.trim(),addRaw:add,hasSugg:false,sugg:[],
   cc:(draft.cc||[]).join(', '),bcc:(draft.bcc||[]).join(', '),onCc:(e:Bag)=>{if(!busy){draft!.cc=String(e.target.value).split(',').map(v=>v.trim()).filter(Boolean);status='Unsaved local draft';persist();publish();}},onBcc:(e:Bag)=>{if(!busy){draft!.bcc=String(e.target.value).split(',').map(v=>v.trim()).filter(Boolean);status='Unsaved local draft';persist();publish();}},
   subject:draft.subject,body:draft.body,onSubj:(e:Bag)=>edit('subject',String(e.target.value)),onBody:(e:Bag)=>edit('body',String(e.target.value)),hasAtts:!!draft.attachments?.length,atts:(draft.attachments||[]).map(a=>({name:a.name,rm:()=>{if(!busy){draft!.attachments=[];status='Unsaved local draft';persist();publish();}}})),attach:()=>void attach()
  }:null};}
 };
}
