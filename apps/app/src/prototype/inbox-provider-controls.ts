import { InboxOperation } from '../runtime/inbox-operation';
import { secureConnectionStore } from '../runtime/native-connection';
import { connectionController } from '../runtime/connection-ui';
import type { GmailInboxCapabilities, GmailInboxReceipt } from '../runtime/cloud-protocol';
import { classifyGmailFailure, type GmailFailureKind } from '../runtime/gmail-mailbox';
type Bag=Record<string,any>;
/** Explicit provider review; state never enters prototype persistence or agent context. */
export function inboxProviderControls(publish:()=>void,toast:(message:string)=>void){
 let editor:((proposal:Bag,reference:{draftId:string;providerDigest:string})=>Promise<boolean>)|null=null;
 let selected='',session='',epoch=0,operation:InboxOperation|null=null,caps:GmailInboxCapabilities|null=null,busy=false,visible=false,status='';
 let draftRead:AbortController|null=null,failure:GmailFailureKind|null=null;
 let onStale:(()=>void)|null=null,onReceipt:((receipt:GmailInboxReceipt)=>void)|null=null,reported='';
 function reset(){epoch++;draftRead?.abort();draftRead=null;operation?.stop();operation=null;selected=session='';caps=null;busy=visible=false;status='';failure=null;reported='';}
 async function bind(grant:string){
  const binding=connectionController.getCloudClient(),account=connectionController.getSnapshot().cloudAccount;
  if(binding&&grant===selected&&binding.sessionId===session&&operation){const token=epoch;try{const next=await binding.client.gmailInboxCapabilities(grant,new AbortController().signal);if(token===epoch){caps=next;publish();}}catch{if(token===epoch){caps=null;publish();}}return;}
  reset();if(!binding||!account||!grant||document.documentElement.dataset.connectionMode==='mock')return;
  selected=grant;session=binding.sessionId;const token=epoch;
  operation=new InboxOperation({owner:JSON.stringify([account.environment,account.userId,account.organizationId||'']),grantId:grant,store:secureConnectionStore,client:binding.client,active:()=>epoch===token&&session===connectionController.getCloudClient()?.sessionId&&document.documentElement.dataset.connectionMode!=='mock'});
  try{await operation.load();if(token!==epoch)return;
   if(operation.snapshot()){status='Saved mail operation. Check its exact review and receipt before continuing.';visible=true;}
   const next=await binding.client.gmailInboxCapabilities(grant,new AbortController().signal);if(token!==epoch)return;caps=next;
  }catch{if(token===epoch)status='Provider actions unavailable. Your local drafts remain on this device.';}
  if(token===epoch)publish();
 }
 async function run(task:(owned:InboxOperation,check:()=>void)=>Promise<unknown>){if(busy||!operation)return;const token=epoch,owned=operation,ownerSession=session;const check=()=>{if(token!==epoch||owned!==operation||ownerSession!==connectionController.getCloudClient()?.sessionId)throw new DOMException('Inbox account changed','AbortError');};busy=true;failure=null;publish();try{check();await task(owned,check);if(token===epoch){status='';const receipt=owned.snapshot()?.receipt;if(receipt?.state==='succeeded'&&receipt.requestId!==reported){reported=receipt.requestId;onReceipt?.(receipt);}}}catch(error){if(token===epoch){const aborted=error instanceof DOMException&&error.name==='AbortError',classified=aborted?null:classifyGmailFailure(error,'operation');failure=classified?.kind||null;status=classified&&classified.kind!=='unavailable'?classified.message:error instanceof Error?error.message:'Mail operation unavailable';toast(status);}}finally{if(token===epoch){busy=false;publish();}}}
 /** Explicit retry after a classified failure. It never confirms or dispatches: a stale review is
  * discarded (it was never dispatched) and the message reloaded; otherwise the idempotent review is
  * reloaded or the saved receipt is checked. */
 async function retry(){const record=operation?.snapshot();if(!record)return;
  if(failure==='stale'&&(record.phase==='preparing'||record.phase==='review')){await run(async(owned,check)=>{await owned.clear();check();visible=false;});if(!operation?.snapshot()){failure=null;onStale?.();}return;}
  if(record.phase==='preparing'){await run(owned=>owned.reloadReview());return;}
  await run(owned=>owned.refresh());}
 async function prepare(proposal:Bag){if(!operation)return;const kind=proposal.kind;if(!(kind==='send'?caps?.send:kind.startsWith('draft-')?caps?.providerDrafts:caps?.mailboxMutations)){toast('The selected account has not granted this provider action.');return;}visible=true;await run(owned=>owned.prepare(proposal));}
 async function editSavedDraft(){await run(async(owned,check)=>{const record=owned.snapshot(),reference=record?.receipt?.providerResult,binding=connectionController.getCloudClient(),grant=selected;if(!record||!binding||!reference||typeof reference.draftId!=='string'||typeof reference.providerDigest!=='string')throw new Error('No provider draft receipt');const controller=new AbortController();draftRead=controller;try{const current=await binding.client.gmailDraft(grant,reference.draftId,controller.signal);check();if(current.providerDigest!==reference.providerDigest)throw new Error('Gmail draft changed outside this app. The saved content will not overwrite it. Open Gmail to inspect the conflict.');if(!await editor?.(record.proposal,current))throw new Error('Save or discard changed local edits before opening this provider draft.');check();await owned.clear();check();visible=false;}finally{if(draftRead===controller)draftRead=null;controller.abort();}});}
 async function followup(kind:'delete-draft'|'undo'){await run(async(owned,check)=>{const record=owned.snapshot(),result=record?.receipt?.providerResult;if(!record||!result)throw new Error('No confirmed provider result');const proposal=kind==='delete-draft'?{kind:'draft-delete',draftId:result.draftId,expectedDigest:result.providerDigest,confirmPermanentDelete:true}:{kind:record.proposal.kind==='archive'?'unarchive':'untrash',messageId:result.messageId,expectedHistoryId:result.historyId};await owned.clear();check();await owned.prepare(proposal);});}

 return {bind,reset,prepare,setEditor:(value:typeof editor)=>{editor=value;},capabilities:()=>caps,
 setObservers(value:{stale?:()=>void;receipt?:(receipt:GmailInboxReceipt)=>void}){onStale=value.stale||null;onReceipt=value.receipt||null;},
 close(){if(!visible)return false;visible=false;publish();return true;},
 chips(chip:(label:string,action:()=>void)=>Bag){return operation?.snapshot()?[chip('Mail review / receipt',()=>{visible=true;publish();})]:[];},
 render(){const record=operation?.snapshot(),review=record?.review;const uncertain=record&&(record.phase==='dispatching'||record.receipt?.state==='outcome-unknown'||record.receipt?.state==='dispatched');return {providerReview:visible,provider:{busy,status:status||(uncertain?'Delivery outcome is unknown. Check the saved receipt; do not send this message again.':record?.receipt?.state==='succeeded'?'Provider confirmed this operation.':record?.receipt?.state==='rejected'?'Provider rejected this operation.':'Review every field before confirming. No mail has been sent.'),
  title:({send:'Send email','draft-create':'Save Gmail draft','draft-replace':'Replace Gmail draft','draft-delete':'Delete Gmail draft',archive:'Archive message',unarchive:'Restore to Inbox',trash:'Move message to Trash',untrash:'Restore from Trash'} as Bag)[String(review?.kind||record?.proposal.kind)]||'Mail review',confirmLabel:review?.kind==='send'?'Send this email':review?.kind==='draft-delete'?'Permanently delete draft':'Confirm this change',replacementWarning:review?.kind==='draft-replace',deletionWarning:review?.kind==='draft-delete',clearLabel:record?.phase==='review'||record?.phase==='preparing'?'Cancel unsent review':'Close receipt',kind:review?.kind||record?.proposal.kind||'Mail operation',from:review?.from||'',to:Array.isArray(review?.to)?review.to.join(', '):'',cc:Array.isArray(review?.cc)?review.cc.join(', '):'',bcc:Array.isArray(review?.bcc)?review.bcc.join(', '):'',subject:review?.subject||'',body:review?.bodyText||'',target:review?.messageId||review?.replyMessageId||review?.draftId||'',requestId:record?.requestId||'',result:record?.receipt?.providerResult?JSON.stringify(record.receipt.providerResult):'',attachments:Array.isArray(review?.attachments)&&review.attachments.length?review.attachments.map((a:Bag)=>`${a.name} · ${a.mimeType} · ${a.size} bytes · SHA-256 ${a.sha256}`).join('\n'):'No attachments.',
  canEditDraft:record?.receipt?.state==='succeeded'&&['draft-create','draft-replace'].includes(record.receipt.kind),editDraft:()=>void editSavedDraft(),deleteDraft:()=>void followup('delete-draft'),canUndo:record?.receipt?.state==='succeeded'&&['archive','trash'].includes(record.receipt.kind)&&typeof record.receipt.providerResult?.historyId==='string',undo:()=>void followup('undo'),
  canRetry:!!failure&&!!record&&!busy,retryLabel:failure==='stale'?'Retry with the current message':'Retry',retry:()=>void retry(),
  confirm:()=>void run(owned=>owned.confirm()),canConfirm:!!record&&record.phase==='review'&&record.receipt?.state==='prepared',check:()=>void run(owned=>owned.refresh()),reload:()=>void run(owned=>owned.reloadReview()),canReload:record?.phase==='preparing',clear:()=>void run(async(owned,check)=>{await owned.clear();check();visible=false;}),canClear:record?.phase==='review'||record?.phase==='preparing'||['succeeded','rejected'].includes(record?.receipt?.state||''),close:()=>{visible=false;publish();}}};}
 };
}
