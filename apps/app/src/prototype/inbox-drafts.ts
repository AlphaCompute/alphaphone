import { registerPlugin } from '../platform-plugins';
const attachmentNative=registerPlugin<{readSelected(input:{selectionId:string}):Promise<MailAttachment & {size:number;sha256:string}>}>('AlphaMailAttachments');
import {DailyApps} from '../daily';
import {reviewMailAttachment,type MailAttachment} from '../runtime/inbox-attachment';
import { secureConnectionStore } from '../runtime/native-connection';
import { connectionController } from '../runtime/connection-ui';
import type { GmailMessage } from '../runtime/cloud-protocol';
type Bag = Record<string, any>;
type Draft = {version:1;id:string;revision:string;owner:string;to:string[];cc?:string[];bcc?:string[];attachments?:MailAttachment[];provider?:{draftId:string;providerDigest:string};subject:string;body:string;mode?:'compose'|'reply'|'reply-all'|'forward';reply?:{messageId:string;threadId:string}};
const address=(v:string)=>v.length<=254&&/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(v);
const valid=(v:any,owner:string):v is Draft=>!!v&&v.version===1&&v.owner===owner&&typeof v.id==='string'&&typeof v.revision==='string'&&Array.isArray(v.to)&&v.to.length<=20&&v.to.every((a:any)=>typeof a==='string'&&address(a))&&[v.cc||[],v.bcc||[]].every((list:any)=>Array.isArray(list)&&list.length<=20&&list.every((a:any)=>typeof a==='string'&&address(a)))&&typeof v.subject==='string'&&v.subject.length<=998&&!/[\r\n]/.test(v.subject)&&typeof v.body==='string'&&v.body.length<=64000&&(!v.reply||(typeof v.reply.messageId==='string'&&typeof v.reply.threadId==='string'));
/** Local encrypted drafts remain separate from explicitly reviewed provider operations. */
export function inboxDrafts(publish:()=>void,toast:(text:string)=>void, provider?:{prepare(proposal:Bag):Promise<void>;capabilities():{send:boolean;providerDrafts:boolean;from?:string}|null}) {
 let owner='',session='',epoch=0,saved:Draft|null=null,draft:Draft|null=null;
 const pendingEdits=new Map<string,Draft>();
 let loading=false,ready=false,busy=false,open=false,confirm=false,toQ='',label='',status='';
 const slot=()=>`inbox-drafts:v1:${owner}`;
 function reset(){pendingEdits.clear();epoch++;owner='';session='';saved=draft=null;loading=ready=busy=open=confirm=false;toQ='';status='';}
 async function bind(account:string,accountLabel:string){
  const identity=connectionController.getSnapshot().cloudAccount, binding=connectionController.getCloudClient();
  const next=identity&&binding?.sessionId===identity.sessionId&&account?JSON.stringify([identity.environment,identity.userId,identity.organizationId||'',account]):'';
  if(next===owner&&binding?.sessionId===session&&ready)return;
  if(draft)pendingEdits.set(owner,{...draft,to:[...draft.to]});
  epoch++;saved=draft=null;loading=ready=busy=open=confirm=false;toQ='';status='';owner=next;session=binding?.sessionId||'';label=accountLabel;
  if(!owner)return;
  const token=epoch, key=slot();loading=true;status='Checking local draft…';publish();
  try{const value=await secureConnectionStore.read<Draft>(key);if(token!==epoch)return;
   if(value!==null&&!valid(value,owner))throw Error();saved=value;draft=pendingEdits.get(owner)||null;ready=true;status=draft?'Unsaved edits retained in this session':value?'Saved draft on this device':'No saved local draft';
  }catch{if(token===epoch)status='Local draft storage unavailable. Retry connection to reload.';}
  if(token===epoch){loading=false;publish();}
 }
 function begin(reply?:GmailMessage,mode:'reply'|'reply-all'|'forward'='reply',forwardedBody=''){
  if(!ready||busy){toast(status||'Connect a Gmail account first.');return;}
  if(draft){open=true;confirm=false;publish();return;}
  if(saved){toast('Restore or discard the saved local draft before creating another.');return;}
  if(reply&&mode!=='forward'&&!address(reply.replyTo||reply.fromEmail||'')){toast('This message has no valid literal reply address.');return;}
  const self=provider?.capabilities()?.from?.toLowerCase(), primary=reply?(reply.replyTo||reply.fromEmail||''):'';
  const to=reply&&mode!=='forward'?[...new Set([primary,...(mode==='reply-all'?reply.to:[])])].filter(a=>a.toLowerCase()!==self):[];
  const cc=mode==='reply-all'?[...new Set(reply?.cc||[])].filter(a=>a.toLowerCase()!==self&&!to.some(t=>t.toLowerCase()===a.toLowerCase())):[];
  if([...to,...cc].some(a=>!address(a))){toast('A reply recipient is ambiguous. Compose with explicitly reviewed literal addresses instead.');return;}
  draft={version:1,id:crypto.randomUUID(),revision:crypto.randomUUID(),owner,mode:reply?mode:'compose',to,cc,bcc:[],subject:reply&&mode==='forward'?`Fwd: ${reply.subject}`.slice(0,998):reply?(/^re:/i.test(reply.subject)?reply.subject:`Re: ${reply.subject}`).slice(0,998):'',body:reply&&mode==='forward'?`\n\nForwarded message from ${reply.from}\nSubject: ${reply.subject}\n\n${forwardedBody}`:'',...(reply&&mode!=='forward'?{reply:{messageId:reply.id,threadId:reply.threadId}}:{})};
  open=true;confirm=false;toQ='';status=mode==='forward'?'Forwarded text only. Original attachments are not copied; add a supported file explicitly.':'Unsaved local draft';publish();
 }
 function add(){if(!draft||busy)return;const value=toQ.trim();if(!address(value)||draft.to.length>=20){toast('Enter one literal email address, up to 20 recipients.');return;}if(!draft.to.includes(value))draft.to.push(value);toQ='';status='Unsaved local draft';publish();}
 async function update(remove=false){
  if(!draft||!ready||busy)return;
  if(!remove&&toQ.trim()){add();if(toQ.trim())return;}
  const value=remove?null:{...draft,revision:crypto.randomUUID(),to:[...draft.to]};
  if(value&&(!valid(value,owner)||new TextEncoder().encode(JSON.stringify(value)).length>8*1024*1024)){toast('Draft is too large or contains an invalid subject.');return;}
  const token=epoch,key=slot(),expected=saved;busy=true;publish();
  try{const receipt=await secureConnectionStore.compareExchange(key,expected,value);if(token!==epoch)return;
   if(receipt.status!=='saved'){status='Draft changed in another window. Close this composer and reload before replacing it.';ready=false;toast(status);return;}
   pendingEdits.delete(owner);saved=value;draft=value?{...value,to:[...value.to]}:null;status=remove?'Local draft discarded':'Saved locally on this device';confirm=false;if(remove)open=false;toast(status);
  }catch{if(token===epoch){status='Local draft update failed. Your edits remain here.';toast(status);}}
  finally{if(token===epoch){busy=false;publish();}}
 }
 async function attach(){if(!draft||busy)return;const token=epoch;let selectionId:string|undefined;busy=true;publish();try{const selected=await DailyApps.perform({action:'files'});selectionId=selected.selectionId;if(token!==epoch)return;if(selected.status==='cancelled')return;if(selected.status!=='selected'||!selected.selectionId||!selected.name)throw new Error('Select one supported document or image');const file=await attachmentNative.readSelected({selectionId:selected.selectionId});const checked=await reviewMailAttachment(file);if(checked.sha256!==file.sha256||checked.size!==file.size)throw new Error('Selected file changed');if(token!==epoch)return;draft!.attachments=[{name:file.name,mimeType:file.mimeType,dataBase64:file.dataBase64}];status='Attachment selected locally. Nothing uploaded until provider review.';}catch(error){if(token===epoch)toast(error instanceof Error?error.message:'Attachment unavailable');}finally{if(selectionId)await DailyApps.forgetSelected({selectionId}).catch(()=>{});if(token===epoch){busy=false;publish();}}}
 function edit(key:'subject'|'body',value:string){if(draft&&!busy){draft[key]=value;status='Unsaved local draft';publish();}}
 return {
  bind,reset,begin,
  async editProvider(proposal:Bag,reference:{draftId:string;providerDigest:string}){if(!ready||busy){toast('Local draft storage unavailable');return false;}if(draft&&(draft.body!==proposal.bodyText||draft.subject!==proposal.subject||JSON.stringify(draft.to)!==JSON.stringify(proposal.to)||JSON.stringify(draft.cc||[])!==JSON.stringify(proposal.cc||[])||JSON.stringify(draft.bcc||[])!==JSON.stringify(proposal.bcc||[])||JSON.stringify(draft.attachments||[])!==JSON.stringify(proposal.attachments||[])))return false;draft={version:1,id:crypto.randomUUID(),revision:crypto.randomUUID(),owner,to:[...proposal.to],cc:[...(proposal.cc||[])],bcc:[...(proposal.bcc||[])],subject:proposal.subject,body:proposal.bodyText,mode:proposal.mode,attachments:proposal.attachments||[],provider:reference,...(proposal.replyMessageId?{reply:{messageId:proposal.replyMessageId,threadId:''}}:{})};open=true;confirm=false;status='Editing provider draft. Save locally to preserve edits. Gmail replacement is not atomic.';publish();await update();return saved?.provider?.draftId===reference.draftId&&saved?.provider?.providerDigest===reference.providerDigest;},
  close(){if(!open)return false;if(busy){toast('Wait for the local draft update.');return true;}open=false;confirm=false;if(status==='Unsaved local draft')toast('Unsaved edits remain in this session. Save locally before closing the app.');publish();return true;},
  chips(chip:(label:string,action:()=>void)=>Bag){return ready?[
   ...(draft?[chip('Continue draft',()=>{open=true;publish();})]:saved?[chip('Restore local draft',()=>{draft={...saved!,to:[...saved!.to]};open=true;confirm=false;toQ='';publish();})]:[]),
  ]:[];},
  render(){return {composeDisabled:loading||busy,composing:open&&!!draft,c: draft?{
   local:true,status,busy,confirm,save:()=>void update(),discard:()=>{if(!busy){confirm=true;publish();}},cancelDiscard:()=>{confirm=false;publish();},confirmDiscard:()=>void update(true),
   send:()=>{if(!provider?.capabilities()?.send){toast('Sending is unavailable for this account. Save locally; no email has been sent.');return;}if(toQ.trim()){add();if(toQ.trim())return;}void provider.prepare({kind:'send',mode:draft!.mode||(draft!.reply?'reply':'compose'),to:[...draft!.to],cc:[...(draft!.cc||[])],bcc:[...(draft!.bcc||[])],subject:draft!.subject,bodyText:draft!.body,attachments:[...(draft!.attachments||[])],...(draft!.reply?{replyMessageId:draft!.reply.messageId}:{})});},
   canSaveProvider:!!provider?.capabilities()?.providerDrafts,saveProvider:()=>{if(toQ.trim()){add();if(toQ.trim())return;}void provider?.prepare({kind:draft!.provider?'draft-replace':'draft-create',...(draft!.provider?{draftId:draft!.provider.draftId,expectedDigest:draft!.provider.providerDigest,acceptNonAtomicReplacement:true}:{}),mode:draft!.mode||(draft!.reply?'reply':'compose'),to:[...draft!.to],cc:[...(draft!.cc||[])],bcc:[...(draft!.bcc||[])],subject:draft!.subject,bodyText:draft!.body,attachments:[...(draft!.attachments||[])],...(draft!.reply?{replyMessageId:draft!.reply.messageId}:{})});},multi:true,from:label,cycleFrom:()=>toast('Close this composer to choose another Gmail account.'),
   chips:draft.to.map(name=>({name,rm:()=>{if(!busy){draft!.to=draft!.to.filter(a=>a!==name);status='Unsaved local draft';publish();}}})),
   toQ,toPh:'To',onTo:(e:Bag)=>{if(!busy){toQ=String(e.target.value);publish();}},toKey:(e:Bag)=>{if(e.key==='Enter'){e.preventDefault();add();}},hasRaw:!!toQ.trim(),rawAddr:toQ.trim(),addRaw:add,hasSugg:false,sugg:[],
   cc:(draft.cc||[]).join(', '),bcc:(draft.bcc||[]).join(', '),onCc:(e:Bag)=>{if(!busy){draft!.cc=String(e.target.value).split(',').map(v=>v.trim()).filter(Boolean);status='Unsaved local draft';publish();}},onBcc:(e:Bag)=>{if(!busy){draft!.bcc=String(e.target.value).split(',').map(v=>v.trim()).filter(Boolean);status='Unsaved local draft';publish();}},
   subject:draft.subject,body:draft.body,onSubj:(e:Bag)=>edit('subject',String(e.target.value)),onBody:(e:Bag)=>edit('body',String(e.target.value)),hasAtts:!!draft.attachments?.length,atts:(draft.attachments||[]).map(a=>({name:a.name,rm:()=>{if(!busy){draft!.attachments=[];status='Unsaved local draft';publish();}}})),attach:()=>void attach()
  }:null};}
 };
}
